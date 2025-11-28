/**
 * GestorSolicitudesVacaciones - Sistema Completo de Gestión
 *
 * Funcionalidades:
 * - Formularios de solicitud con validación
 * - Sugerencias de rangos alternativos si saldo insuficiente
 * - Notificaciones a jefe con SLA configurable
 * - Eventos/Logs: solicitud_creada, aprobada, rechazada, disfrute_registrado
 * - Idempotencia y bloqueos contra doble registro
 * - Consistencia transaccional
 *
 * @module gestorSolicitudesVacaciones
 */

const mongoose = require('mongoose');
const VacationRequest = require('../models/VacationRequest');
const VacationBalance = require('../models/VacationBalance');
const VacationAuditLog = require('../models/VacationAuditLog');
const User = require('../models/User');
const {
  calcularCausacion,
  saldoDisponible,
  validarSolicitud,
  validarTransicionEstado,
  calcularImpactoSaldo,
  MOTOR_CONSTANTS
} = require('./motorVacaciones');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CONFIG = {
  // SLA de aprobación (en horas)
  SLA_APROBACION_HORAS: 48,

  // Días mínimos de anticipación para solicitar
  DIAS_ANTICIPACION_MINIMO: 5,

  // Máximo de días por solicitud
  DIAS_MAXIMO_POR_SOLICITUD: 15,

  // Permitir solicitudes parciales (medio día)
  PERMITIR_DIAS_PARCIALES: true,

  // Reintentos para operaciones idempotentes
  MAX_REINTENTOS: 3,

  // Tiempo entre reintentos (ms)
  TIEMPO_ENTRE_REINTENTOS: 1000,

  // TTL para locks de idempotencia (segundos)
  LOCK_TTL_SECONDS: 300
};

// ============================================================================
// MODELO DE EVENTOS
// ============================================================================

const EVENTOS = {
  SOLICITUD_CREADA: 'solicitud_creada',
  SOLICITUD_APROBADA: 'solicitud_aprobada',
  SOLICITUD_RECHAZADA: 'solicitud_rechazada',
  SOLICITUD_PROGRAMADA: 'solicitud_programada',
  SOLICITUD_CANCELADA: 'solicitud_cancelada',
  DISFRUTE_REGISTRADO: 'disfrute_registrado',
  SALDO_ACTUALIZADO: 'saldo_actualizado',
  NOTIFICACION_ENVIADA: 'notificacion_enviada',
  SLA_VENCIDO: 'sla_vencido',
  ERROR_PROCESAMIENTO: 'error_procesamiento'
};

// Cola en memoria para eventos (en producción usar Redis/RabbitMQ)
const colaEventos = [];
const suscriptores = new Map();

// Registro de operaciones idempotentes (en producción usar Redis)
const registroIdempotencia = new Map();

// ============================================================================
// SISTEMA DE EVENTOS
// ============================================================================

/**
 * Publica un evento en la cola
 */
function publicarEvento(tipo, datos, metadata = {}) {
  const evento = {
    id: generarIdEvento(),
    tipo,
    datos,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  };

  colaEventos.push(evento);

  // Notificar a suscriptores síncronamente (en producción sería async)
  const handlers = suscriptores.get(tipo) || [];
  handlers.forEach(handler => {
    try {
      handler(evento);
    } catch (error) {
      console.error(`[EVENTO] Error en handler para ${tipo}:`, error.message);
    }
  });

  return evento;
}

/**
 * Suscribe un handler a un tipo de evento
 */
function suscribirEvento(tipo, handler) {
  if (!suscriptores.has(tipo)) {
    suscriptores.set(tipo, []);
  }
  suscriptores.get(tipo).push(handler);
}

/**
 * Genera ID único para evento
 */
function generarIdEvento() {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Genera ID único para operación idempotente
 */
function generarIdempotencyKey(operacion, datos) {
  const hash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify({ operacion, ...datos }))
    .digest('hex')
    .substring(0, 16);
  return `idem_${operacion}_${hash}`;
}

// ============================================================================
// IDEMPOTENCIA Y BLOQUEOS
// ============================================================================

/**
 * Verifica si una operación ya fue procesada (idempotencia)
 */
async function verificarIdempotencia(idempotencyKey) {
  const registro = registroIdempotencia.get(idempotencyKey);

  if (registro) {
    const ahora = Date.now();
    const expiracion = registro.timestamp + (CONFIG.LOCK_TTL_SECONDS * 1000);

    if (ahora < expiracion) {
      return {
        duplicada: true,
        resultado: registro.resultado,
        mensaje: 'Operación ya procesada anteriormente'
      };
    } else {
      // Expirado, limpiar
      registroIdempotencia.delete(idempotencyKey);
    }
  }

  return { duplicada: false };
}

/**
 * Registra una operación como procesada
 */
function registrarOperacion(idempotencyKey, resultado) {
  registroIdempotencia.set(idempotencyKey, {
    timestamp: Date.now(),
    resultado
  });
}

/**
 * Adquiere un lock para evitar doble procesamiento
 */
async function adquirirLock(recurso, timeout = 5000) {
  const lockKey = `lock_${recurso}`;
  const inicio = Date.now();

  while (Date.now() - inicio < timeout) {
    if (!registroIdempotencia.has(lockKey)) {
      registroIdempotencia.set(lockKey, {
        timestamp: Date.now(),
        holder: process.pid
      });
      return true;
    }

    // Esperar y reintentar
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Libera un lock
 */
function liberarLock(recurso) {
  const lockKey = `lock_${recurso}`;
  registroIdempotencia.delete(lockKey);
}

// ============================================================================
// VALIDACIONES Y SUGERENCIAS
// ============================================================================

/**
 * Valida formulario de solicitud completo
 */
function validarFormularioSolicitud(datos) {
  const errores = [];

  // Campos requeridos
  const camposRequeridos = ['empleadoId', 'fechaInicio', 'fechaFin', 'diasSolicitados'];
  for (const campo of camposRequeridos) {
    if (!datos[campo]) {
      errores.push({ campo, mensaje: `El campo ${campo} es requerido` });
    }
  }

  if (errores.length > 0) {
    return { valido: false, errores };
  }

  // Validar días solicitados
  if (datos.diasSolicitados <= 0) {
    errores.push({ campo: 'diasSolicitados', mensaje: 'Debe solicitar al menos 0.5 días' });
  }

  if (!CONFIG.PERMITIR_DIAS_PARCIALES && datos.diasSolicitados % 1 !== 0) {
    errores.push({ campo: 'diasSolicitados', mensaje: 'No se permiten días parciales' });
  }

  if (datos.diasSolicitados > CONFIG.DIAS_MAXIMO_POR_SOLICITUD) {
    errores.push({
      campo: 'diasSolicitados',
      mensaje: `Máximo ${CONFIG.DIAS_MAXIMO_POR_SOLICITUD} días por solicitud`
    });
  }

  // Validar fechas
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaInicio = new Date(datos.fechaInicio);
  const fechaFin = new Date(datos.fechaFin);

  if (fechaInicio < hoy) {
    errores.push({ campo: 'fechaInicio', mensaje: 'La fecha de inicio debe ser futura' });
  }

  if (fechaFin < fechaInicio) {
    errores.push({ campo: 'fechaFin', mensaje: 'La fecha de fin debe ser posterior al inicio' });
  }

  // Validar anticipación mínima
  const diasAnticipacion = Math.floor((fechaInicio - hoy) / (1000 * 60 * 60 * 24));
  if (diasAnticipacion < CONFIG.DIAS_ANTICIPACION_MINIMO) {
    errores.push({
      campo: 'fechaInicio',
      mensaje: `Debe solicitar con al menos ${CONFIG.DIAS_ANTICIPACION_MINIMO} días de anticipación`
    });
  }

  // Validar observaciones (longitud máxima)
  if (datos.observaciones && datos.observaciones.length > 500) {
    errores.push({ campo: 'observaciones', mensaje: 'Observaciones máximo 500 caracteres' });
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Sugiere rangos alternativos cuando el saldo es insuficiente
 */
function sugerirRangosAlternativos(saldoActual, diasSolicitados, fechaInicio) {
  const sugerencias = [];

  if (saldoActual <= 0) {
    return {
      sugerencias: [],
      mensaje: 'No tiene saldo disponible. Debe esperar a acumular más días.'
    };
  }

  // Sugerencia 1: Usar todo el saldo disponible
  if (saldoActual >= 0.5) {
    const fechaFinSugerida = new Date(fechaInicio);
    fechaFinSugerida.setDate(fechaFinSugerida.getDate() + Math.floor(saldoActual) - 1);

    sugerencias.push({
      tipo: 'saldo_completo',
      diasSugeridos: Math.floor(saldoActual * 10) / 10, // 1 decimal
      fechaInicio: fechaInicio,
      fechaFin: fechaFinSugerida.toISOString().split('T')[0],
      mensaje: `Puede solicitar ${Math.floor(saldoActual * 10) / 10} días (su saldo disponible)`
    });
  }

  // Sugerencia 2: Mitad del saldo
  if (saldoActual >= 2) {
    const mitad = Math.floor((saldoActual / 2) * 10) / 10;
    const fechaFinMitad = new Date(fechaInicio);
    fechaFinMitad.setDate(fechaFinMitad.getDate() + Math.floor(mitad) - 1);

    sugerencias.push({
      tipo: 'mitad_saldo',
      diasSugeridos: mitad,
      fechaInicio: fechaInicio,
      fechaFin: fechaFinMitad.toISOString().split('T')[0],
      mensaje: `Puede solicitar ${mitad} días y guardar el resto`
    });
  }

  // Sugerencia 3: Una semana si hay saldo
  if (saldoActual >= 5 && diasSolicitados > 5) {
    const fechaFinSemana = new Date(fechaInicio);
    fechaFinSemana.setDate(fechaFinSemana.getDate() + 4); // 5 días hábiles

    sugerencias.push({
      tipo: 'una_semana',
      diasSugeridos: 5,
      fechaInicio: fechaInicio,
      fechaFin: fechaFinSemana.toISOString().split('T')[0],
      mensaje: 'Puede solicitar 5 días (una semana hábil)'
    });
  }

  return {
    sugerencias,
    mensaje: `Saldo insuficiente. Tiene ${saldoActual} días disponibles, solicitó ${diasSolicitados}.`
  };
}

// ============================================================================
// GESTIÓN DE SOLICITUDES
// ============================================================================

class GestorSolicitudesVacaciones {
  /**
   * Crea una nueva solicitud de vacaciones
   * @param {Object} datos - Datos del formulario
   * @param {string} datos.empleadoId - ID del empleado
   * @param {string} datos.fechaInicio - Fecha inicio (ISO)
   * @param {string} datos.fechaFin - Fecha fin (ISO)
   * @param {number} datos.diasSolicitados - Días a solicitar
   * @param {string} [datos.observaciones] - Observaciones
   * @param {string} companyId - ID de la compañía
   * @param {string} solicitanteId - ID de quien crea la solicitud
   * @param {string} [idempotencyKey] - Clave para idempotencia
   */
  async crearSolicitud(datos, companyId, solicitanteId, idempotencyKey = null) {
    // Generar clave de idempotencia si no se proporciona
    const idemKey = idempotencyKey || generarIdempotencyKey('crear_solicitud', {
      empleadoId: datos.empleadoId,
      fechaInicio: datos.fechaInicio,
      companyId
    });

    // Verificar idempotencia
    const checkIdem = await verificarIdempotencia(idemKey);
    if (checkIdem.duplicada) {
      return {
        success: true,
        duplicada: true,
        data: checkIdem.resultado,
        mensaje: checkIdem.mensaje
      };
    }

    // Adquirir lock para evitar doble registro
    const lockKey = `solicitud_${datos.empleadoId}_${datos.fechaInicio}`;
    const lockAdquirido = await adquirirLock(lockKey);

    if (!lockAdquirido) {
      return {
        success: false,
        error: 'Operación en progreso. Intente nuevamente.',
        codigo: 'LOCK_TIMEOUT'
      };
    }

    // Iniciar transacción
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validar formulario
      const validacionForm = validarFormularioSolicitud(datos);
      if (!validacionForm.valido) {
        throw {
          tipo: 'VALIDACION_FORMULARIO',
          errores: validacionForm.errores
        };
      }

      // 2. Obtener balance del empleado
      const balance = await VacationBalance.findOne({
        employeeId: datos.empleadoId,
        companyId
      }).session(session);

      if (!balance) {
        throw {
          tipo: 'BALANCE_NO_ENCONTRADO',
          mensaje: 'Empleado no tiene balance de vacaciones inicializado'
        };
      }

      // 3. Calcular causación actual
      const causacion = calcularCausacion(balance.hireDate, new Date());
      if (!causacion.valido) {
        throw {
          tipo: 'ERROR_CAUSACION',
          mensaje: causacion.error
        };
      }

      // 4. Calcular saldo disponible
      const saldo = saldoDisponible(
        causacion.diasCausados,
        balance.enjoyedDays,
        balance.approvedPendingDays
      );

      // 5. Validar solicitud contra saldo
      const validacionSaldo = validarSolicitud(datos.diasSolicitados, saldo.disponible);

      if (validacionSaldo.bloqueado) {
        // Generar sugerencias de rangos alternativos
        const alternativas = sugerirRangosAlternativos(
          saldo.disponible,
          datos.diasSolicitados,
          datos.fechaInicio
        );

        await session.abortTransaction();
        liberarLock(lockKey);

        return {
          success: false,
          error: validacionSaldo.razon,
          codigo: 'SALDO_INSUFICIENTE',
          saldoDisponible: saldo.disponible,
          diasSolicitados: datos.diasSolicitados,
          faltante: validacionSaldo.faltante,
          sugerencias: alternativas.sugerencias
        };
      }

      // 6. Verificar solapamiento con solicitudes existentes
      const solapada = await VacationRequest.findOne({
        employeeId: datos.empleadoId,
        companyId,
        status: { $in: ['requested', 'approved', 'scheduled'] },
        $or: [
          {
            startDate: { $lte: new Date(datos.fechaFin) },
            endDate: { $gte: new Date(datos.fechaInicio) }
          }
        ]
      }).session(session);

      if (solapada) {
        throw {
          tipo: 'SOLICITUD_SOLAPADA',
          mensaje: 'Ya existe una solicitud activa que se solapa con las fechas',
          solicitudExistente: {
            id: solapada._id,
            estado: solapada.status,
            fechas: `${solapada.startDate.toISOString().split('T')[0]} - ${solapada.endDate.toISOString().split('T')[0]}`
          }
        };
      }

      // 7. Crear la solicitud
      const solicitud = new VacationRequest({
        employeeId: datos.empleadoId,
        requestedDays: datos.diasSolicitados,
        startDate: new Date(datos.fechaInicio),
        endDate: new Date(datos.fechaFin),
        status: MOTOR_CONSTANTS.ESTADOS.REQUESTED,
        notes: datos.observaciones,
        companyId
      });

      await solicitud.save({ session });

      // 8. Crear log de auditoría
      await VacationAuditLog.createLog({
        employeeId: datos.empleadoId,
        action: 'request',
        requestId: solicitud._id,
        performedBy: solicitanteId,
        quantity: datos.diasSolicitados,
        description: `Solicitud creada: ${datos.diasSolicitados} días del ${datos.fechaInicio} al ${datos.fechaFin}`,
        newState: {
          status: MOTOR_CONSTANTS.ESTADOS.REQUESTED,
          startDate: datos.fechaInicio,
          endDate: datos.fechaFin
        },
        companyId
      });

      // 9. Commit transacción
      await session.commitTransaction();

      // 10. Publicar evento
      const evento = publicarEvento(EVENTOS.SOLICITUD_CREADA, {
        solicitudId: solicitud._id,
        empleadoId: datos.empleadoId,
        diasSolicitados: datos.diasSolicitados,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        saldoDisponible: saldo.disponible,
        saldoRestante: validacionSaldo.saldoRestante
      }, { companyId, solicitanteId });

      // 11. Calcular SLA de aprobación
      const slaVencimiento = new Date();
      slaVencimiento.setHours(slaVencimiento.getHours() + CONFIG.SLA_APROBACION_HORAS);

      // 12. Preparar resultado
      const resultado = {
        solicitudId: solicitud._id,
        estado: solicitud.status,
        diasSolicitados: datos.diasSolicitados,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        saldoAntes: saldo.disponible,
        saldoDespuesAprobacion: validacionSaldo.saldoRestante,
        sla: {
          horasParaAprobacion: CONFIG.SLA_APROBACION_HORAS,
          vencimiento: slaVencimiento.toISOString()
        },
        eventoId: evento.id
      };

      // Registrar para idempotencia
      registrarOperacion(idemKey, resultado);
      liberarLock(lockKey);

      return {
        success: true,
        mensaje: 'Solicitud creada exitosamente',
        data: resultado
      };

    } catch (error) {
      await session.abortTransaction();
      liberarLock(lockKey);

      // Publicar evento de error
      publicarEvento(EVENTOS.ERROR_PROCESAMIENTO, {
        operacion: 'crear_solicitud',
        error: error.mensaje || error.message,
        datos: { empleadoId: datos.empleadoId, fechaInicio: datos.fechaInicio }
      }, { companyId });

      if (error.tipo) {
        return {
          success: false,
          error: error.mensaje || 'Error de validación',
          codigo: error.tipo,
          detalles: error.errores || error.solicitudExistente
        };
      }

      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Aprueba una solicitud de vacaciones
   */
  async aprobarSolicitud(solicitudId, aprobadorId, companyId, observaciones = null, idempotencyKey = null) {
    const idemKey = idempotencyKey || generarIdempotencyKey('aprobar_solicitud', {
      solicitudId,
      aprobadorId
    });

    const checkIdem = await verificarIdempotencia(idemKey);
    if (checkIdem.duplicada) {
      return { success: true, duplicada: true, data: checkIdem.resultado };
    }

    const lockKey = `aprobar_${solicitudId}`;
    const lockAdquirido = await adquirirLock(lockKey);

    if (!lockAdquirido) {
      return { success: false, error: 'Operación en progreso', codigo: 'LOCK_TIMEOUT' };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Obtener solicitud con lock
      const solicitud = await VacationRequest.findOne({
        _id: solicitudId,
        companyId
      }).session(session);

      if (!solicitud) {
        throw { tipo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'Solicitud no encontrada' };
      }

      // 2. Validar transición de estado
      const transicion = validarTransicionEstado(solicitud.status, MOTOR_CONSTANTS.ESTADOS.APPROVED);
      if (!transicion.valida) {
        throw { tipo: 'TRANSICION_INVALIDA', mensaje: transicion.razon };
      }

      // 3. Obtener y validar balance
      const balance = await VacationBalance.findOne({
        employeeId: solicitud.employeeId,
        companyId
      }).session(session);

      const causacion = calcularCausacion(balance.hireDate, new Date());
      const saldo = saldoDisponible(
        causacion.diasCausados,
        balance.enjoyedDays,
        balance.approvedPendingDays
      );

      const validacionSaldo = validarSolicitud(solicitud.requestedDays, saldo.disponible);
      if (validacionSaldo.bloqueado) {
        throw {
          tipo: 'SALDO_INSUFICIENTE',
          mensaje: `No se puede aprobar: ${validacionSaldo.razon}`,
          saldoDisponible: saldo.disponible,
          diasSolicitados: solicitud.requestedDays
        };
      }

      // 4. Calcular impacto
      const impacto = calcularImpactoSaldo(
        solicitud.status,
        MOTOR_CONSTANTS.ESTADOS.APPROVED,
        solicitud.requestedDays
      );

      const estadoPrevio = {
        status: solicitud.status,
        approvedPendingDays: balance.approvedPendingDays
      };

      // 5. Actualizar solicitud
      solicitud.status = MOTOR_CONSTANTS.ESTADOS.APPROVED;
      solicitud.approverId = aprobadorId;
      solicitud.approvalDate = new Date();
      solicitud.approvalNotes = observaciones;
      await solicitud.save({ session });

      // 6. Actualizar balance (reservar días)
      balance.approvedPendingDays += impacto.approvedPendingDelta;
      await balance.save({ session });

      // 7. Audit log
      await VacationAuditLog.createLog({
        employeeId: solicitud.employeeId,
        action: 'approve',
        requestId: solicitud._id,
        performedBy: aprobadorId,
        quantity: solicitud.requestedDays,
        description: `Solicitud aprobada. ${impacto.descripcion}`,
        previousState: estadoPrevio,
        newState: {
          status: MOTOR_CONSTANTS.ESTADOS.APPROVED,
          approvedPendingDays: balance.approvedPendingDays
        },
        companyId
      });

      await session.commitTransaction();

      // 8. Publicar eventos
      publicarEvento(EVENTOS.SOLICITUD_APROBADA, {
        solicitudId: solicitud._id,
        empleadoId: solicitud.employeeId,
        diasAprobados: solicitud.requestedDays,
        aprobadorId
      }, { companyId });

      publicarEvento(EVENTOS.SALDO_ACTUALIZADO, {
        empleadoId: solicitud.employeeId,
        accion: 'reserva_aprobacion',
        cantidad: impacto.approvedPendingDelta,
        nuevoApprovedPending: balance.approvedPendingDays
      }, { companyId });

      const resultado = {
        solicitudId: solicitud._id,
        estadoAnterior: estadoPrevio.status,
        estadoActual: solicitud.status,
        diasAprobados: solicitud.requestedDays,
        fechaAprobacion: solicitud.approvalDate.toISOString(),
        impactoSaldo: {
          delta: impacto.approvedPendingDelta,
          nuevoApprovedPending: balance.approvedPendingDays
        }
      };

      registrarOperacion(idemKey, resultado);
      liberarLock(lockKey);

      return { success: true, mensaje: 'Solicitud aprobada', data: resultado };

    } catch (error) {
      await session.abortTransaction();
      liberarLock(lockKey);

      publicarEvento(EVENTOS.ERROR_PROCESAMIENTO, {
        operacion: 'aprobar_solicitud',
        solicitudId,
        error: error.mensaje || error.message
      }, { companyId });

      if (error.tipo) {
        return { success: false, error: error.mensaje, codigo: error.tipo, detalles: error };
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Rechaza una solicitud de vacaciones
   */
  async rechazarSolicitud(solicitudId, rechazadorId, companyId, razon, idempotencyKey = null) {
    if (!razon || razon.trim().length === 0) {
      return { success: false, error: 'Debe proporcionar una razón de rechazo', codigo: 'RAZON_REQUERIDA' };
    }

    const idemKey = idempotencyKey || generarIdempotencyKey('rechazar_solicitud', { solicitudId });

    const checkIdem = await verificarIdempotencia(idemKey);
    if (checkIdem.duplicada) {
      return { success: true, duplicada: true, data: checkIdem.resultado };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const solicitud = await VacationRequest.findOne({ _id: solicitudId, companyId }).session(session);

      if (!solicitud) {
        throw { tipo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'Solicitud no encontrada' };
      }

      const transicion = validarTransicionEstado(solicitud.status, MOTOR_CONSTANTS.ESTADOS.REJECTED);
      if (!transicion.valida) {
        throw { tipo: 'TRANSICION_INVALIDA', mensaje: transicion.razon };
      }

      const estadoPrevio = { status: solicitud.status };

      solicitud.status = MOTOR_CONSTANTS.ESTADOS.REJECTED;
      solicitud.rejectionReason = razon;
      solicitud.approverId = rechazadorId;
      solicitud.approvalDate = new Date();
      await solicitud.save({ session });

      await VacationAuditLog.createLog({
        employeeId: solicitud.employeeId,
        action: 'reject',
        requestId: solicitud._id,
        performedBy: rechazadorId,
        quantity: solicitud.requestedDays,
        description: `Solicitud rechazada: ${razon}`,
        previousState: estadoPrevio,
        newState: { status: MOTOR_CONSTANTS.ESTADOS.REJECTED, rejectionReason: razon },
        companyId
      });

      await session.commitTransaction();

      publicarEvento(EVENTOS.SOLICITUD_RECHAZADA, {
        solicitudId: solicitud._id,
        empleadoId: solicitud.employeeId,
        diasSolicitados: solicitud.requestedDays,
        rechazadorId,
        razon
      }, { companyId });

      const resultado = {
        solicitudId: solicitud._id,
        estadoFinal: solicitud.status,
        razon
      };

      registrarOperacion(idemKey, resultado);
      return { success: true, mensaje: 'Solicitud rechazada', data: resultado };

    } catch (error) {
      await session.abortTransaction();
      if (error.tipo) {
        return { success: false, error: error.mensaje, codigo: error.tipo };
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Registra el disfrute de vacaciones y descuenta del saldo
   */
  async registrarDisfrute(solicitudId, registradorId, companyId, opciones = {}, idempotencyKey = null) {
    const { diasEfectivos, observaciones } = opciones;

    const idemKey = idempotencyKey || generarIdempotencyKey('registrar_disfrute', { solicitudId });

    const checkIdem = await verificarIdempotencia(idemKey);
    if (checkIdem.duplicada) {
      return { success: true, duplicada: true, data: checkIdem.resultado };
    }

    const lockKey = `disfrute_${solicitudId}`;
    const lockAdquirido = await adquirirLock(lockKey);

    if (!lockAdquirido) {
      return { success: false, error: 'Operación en progreso', codigo: 'LOCK_TIMEOUT' };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const solicitud = await VacationRequest.findOne({ _id: solicitudId, companyId }).session(session);

      if (!solicitud) {
        throw { tipo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'Solicitud no encontrada' };
      }

      const transicion = validarTransicionEstado(solicitud.status, MOTOR_CONSTANTS.ESTADOS.ENJOYED);
      if (!transicion.valida) {
        throw { tipo: 'TRANSICION_INVALIDA', mensaje: transicion.razon };
      }

      const balance = await VacationBalance.findOne({
        employeeId: solicitud.employeeId,
        companyId
      }).session(session);

      if (!balance) {
        throw { tipo: 'BALANCE_NO_ENCONTRADO', mensaje: 'Balance no encontrado' };
      }

      // Días a descontar (permite disfrute parcial)
      const diasDescontar = diasEfectivos !== undefined ? diasEfectivos : solicitud.requestedDays;

      if (diasDescontar > solicitud.requestedDays) {
        throw {
          tipo: 'DIAS_EXCEDIDOS',
          mensaje: `No puede descontar más días (${diasDescontar}) de los aprobados (${solicitud.requestedDays})`
        };
      }

      if (diasDescontar < 0) {
        throw { tipo: 'DIAS_INVALIDOS', mensaje: 'Los días efectivos no pueden ser negativos' };
      }

      const impacto = calcularImpactoSaldo(
        solicitud.status,
        MOTOR_CONSTANTS.ESTADOS.ENJOYED,
        diasDescontar
      );

      const estadoPrevio = {
        status: solicitud.status,
        enjoyedDays: balance.enjoyedDays,
        approvedPendingDays: balance.approvedPendingDays
      };

      // Actualizar solicitud
      solicitud.status = MOTOR_CONSTANTS.ESTADOS.ENJOYED;
      solicitud.enjoyedDate = new Date();
      solicitud.actualDaysEnjoyed = diasDescontar;
      solicitud.closedBy = registradorId;
      solicitud.closingNotes = observaciones;
      await solicitud.save({ session });

      // Actualizar balance
      balance.enjoyedDays += diasDescontar;
      balance.approvedPendingDays -= solicitud.requestedDays; // Liberar todos los aprobados
      await balance.save({ session });

      // Audit log
      await VacationAuditLog.createLog({
        employeeId: solicitud.employeeId,
        action: 'enjoy',
        requestId: solicitud._id,
        performedBy: registradorId,
        quantity: diasDescontar,
        description: `Disfrute registrado: ${diasDescontar} días descontados`,
        previousState: estadoPrevio,
        newState: {
          status: MOTOR_CONSTANTS.ESTADOS.ENJOYED,
          enjoyedDays: balance.enjoyedDays,
          approvedPendingDays: balance.approvedPendingDays
        },
        companyId
      });

      // Si hubo disfrute parcial, registrar retorno
      const diasNoUsados = solicitud.requestedDays - diasDescontar;
      if (diasNoUsados > 0) {
        await VacationAuditLog.createLog({
          employeeId: solicitud.employeeId,
          action: 'partial_return',
          requestId: solicitud._id,
          performedBy: registradorId,
          quantity: diasNoUsados,
          description: `${diasNoUsados} días retornados al saldo (disfrute parcial)`,
          companyId
        });
      }

      await session.commitTransaction();

      // Publicar eventos
      publicarEvento(EVENTOS.DISFRUTE_REGISTRADO, {
        solicitudId: solicitud._id,
        empleadoId: solicitud.employeeId,
        diasAprobados: solicitud.requestedDays,
        diasDisfrutados: diasDescontar,
        diasRetornados: diasNoUsados,
        registradorId
      }, { companyId });

      publicarEvento(EVENTOS.SALDO_ACTUALIZADO, {
        empleadoId: solicitud.employeeId,
        accion: 'disfrute',
        diasDescontados: diasDescontar,
        diasLiberados: solicitud.requestedDays,
        nuevoEnjoyedDays: balance.enjoyedDays,
        nuevoApprovedPending: balance.approvedPendingDays
      }, { companyId });

      const resultado = {
        solicitudId: solicitud._id,
        estadoFinal: solicitud.status,
        diasAprobados: solicitud.requestedDays,
        diasDisfrutados: diasDescontar,
        diasNoUsados,
        nuevoSaldo: {
          disfrutados: balance.enjoyedDays,
          aprobadosPendientes: balance.approvedPendingDays
        },
        fechaCierre: solicitud.enjoyedDate.toISOString()
      };

      registrarOperacion(idemKey, resultado);
      liberarLock(lockKey);

      return { success: true, mensaje: 'Disfrute registrado', data: resultado };

    } catch (error) {
      await session.abortTransaction();
      liberarLock(lockKey);

      publicarEvento(EVENTOS.ERROR_PROCESAMIENTO, {
        operacion: 'registrar_disfrute',
        solicitudId,
        error: error.mensaje || error.message
      }, { companyId });

      if (error.tipo) {
        return { success: false, error: error.mensaje, codigo: error.tipo };
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Obtiene solicitudes pendientes de aprobación con SLA
   */
  async obtenerSolicitudesPendientesSLA(companyId, opciones = {}) {
    const { soloVencidas = false, limite = 50 } = opciones;

    const ahora = new Date();
    const limitesSLA = new Date(ahora.getTime() - (CONFIG.SLA_APROBACION_HORAS * 60 * 60 * 1000));

    const query = {
      companyId,
      status: MOTOR_CONSTANTS.ESTADOS.REQUESTED
    };

    if (soloVencidas) {
      query.requestDate = { $lt: limitesSLA };
    }

    const solicitudes = await VacationRequest.find(query)
      .populate('employeeId', 'name email')
      .sort({ requestDate: 1 })
      .limit(limite)
      .lean();

    return solicitudes.map(s => {
      const tiempoTranscurrido = ahora - new Date(s.requestDate);
      const horasTranscurridas = Math.floor(tiempoTranscurrido / (1000 * 60 * 60));
      const slaVencido = horasTranscurridas > CONFIG.SLA_APROBACION_HORAS;

      return {
        ...s,
        sla: {
          horasTranscurridas,
          horasRestantes: Math.max(0, CONFIG.SLA_APROBACION_HORAS - horasTranscurridas),
          vencido: slaVencido,
          porcentajeConsumido: Math.min(100, (horasTranscurridas / CONFIG.SLA_APROBACION_HORAS) * 100)
        }
      };
    });
  }

  /**
   * Obtiene el historial de eventos de una solicitud
   */
  async obtenerHistorialEventos(solicitudId, companyId) {
    const eventos = await VacationAuditLog.find({
      requestId: solicitudId,
      companyId
    }).sort({ timestamp: 1 });

    return eventos.map(e => ({
      id: e._id,
      accion: e.action,
      fecha: e.timestamp,
      cantidad: e.quantity,
      descripcion: e.description,
      estadoPrevio: e.previousState,
      estadoNuevo: e.newState
    }));
  }
}

// ============================================================================
// PLANTILLAS DE NOTIFICACIÓN
// ============================================================================

const PLANTILLAS = {
  email: {
    solicitud_creada_empleado: {
      asunto: 'Solicitud de vacaciones creada - #{solicitudId}',
      cuerpo: `
Hola {empleadoNombre},

Tu solicitud de vacaciones ha sido creada exitosamente.

**Detalles:**
- Días solicitados: {diasSolicitados}
- Fecha inicio: {fechaInicio}
- Fecha fin: {fechaFin}
- Saldo disponible después de aprobación: {saldoRestante} días

Tu solicitud será revisada por tu jefe inmediato en un plazo máximo de {slaHoras} horas (antes del {slaVencimiento}).

Estado actual: PENDIENTE DE APROBACIÓN

Puedes consultar el estado de tu solicitud en cualquier momento desde el portal de empleados.

Saludos,
Sistema de Gestión de Vacaciones
      `.trim()
    },

    solicitud_pendiente_jefe: {
      asunto: 'Nueva solicitud de vacaciones pendiente - {empleadoNombre}',
      cuerpo: `
Estimado/a {jefeNombre},

Tiene una nueva solicitud de vacaciones pendiente de aprobación.

**Solicitante:** {empleadoNombre}
**Departamento:** {departamento}
**Días solicitados:** {diasSolicitados}
**Fechas:** {fechaInicio} al {fechaFin}
**Observaciones:** {observaciones}

**SLA de aprobación:** {slaHoras} horas
**Vencimiento:** {slaVencimiento}

**Saldo del empleado:**
- Días causados: {diasCausados}
- Días disponibles: {saldoDisponible}

Por favor, revise y apruebe/rechace esta solicitud antes del vencimiento del SLA.

[Aprobar Solicitud] [Rechazar Solicitud]

Saludos,
Sistema de Gestión de Vacaciones
      `.trim()
    },

    solicitud_aprobada: {
      asunto: 'Solicitud de vacaciones APROBADA - #{solicitudId}',
      cuerpo: `
Hola {empleadoNombre},

¡Buenas noticias! Tu solicitud de vacaciones ha sido APROBADA.

**Detalles:**
- Días aprobados: {diasAprobados}
- Fecha inicio: {fechaInicio}
- Fecha fin: {fechaFin}
- Aprobado por: {aprobadorNombre}
- Fecha de aprobación: {fechaAprobacion}

**Tu nuevo saldo:**
- Días disponibles: {saldoDisponible}
- Días reservados (aprobados): {diasAprobadosPendientes}

Recuerda presentarte el día {fechaRetorno} para reincorporarte a tus labores.

¡Disfruta tus vacaciones!

Saludos,
Sistema de Gestión de Vacaciones
      `.trim()
    },

    solicitud_rechazada: {
      asunto: 'Solicitud de vacaciones RECHAZADA - #{solicitudId}',
      cuerpo: `
Hola {empleadoNombre},

Lamentamos informarte que tu solicitud de vacaciones ha sido RECHAZADA.

**Detalles:**
- Días solicitados: {diasSolicitados}
- Fechas: {fechaInicio} al {fechaFin}
- Rechazado por: {rechazadorNombre}

**Razón del rechazo:**
{razonRechazo}

Tu saldo de vacaciones no ha sido afectado. Puedes crear una nueva solicitud con fechas diferentes.

Si tienes preguntas, contacta a tu jefe inmediato o al departamento de Recursos Humanos.

Saludos,
Sistema de Gestión de Vacaciones
      `.trim()
    },

    disfrute_registrado: {
      asunto: 'Vacaciones registradas - Bienvenido de vuelta',
      cuerpo: `
Hola {empleadoNombre},

Tus vacaciones han sido registradas exitosamente.

**Resumen:**
- Días disfrutados: {diasDisfrutados}
- Período: {fechaInicio} al {fechaFin}

**Tu saldo actualizado:**
- Días causados: {diasCausados}
- Días disfrutados (total): {totalDisfrutados}
- Días disponibles: {saldoDisponible}

¡Esperamos que hayas tenido un excelente descanso!

Saludos,
Sistema de Gestión de Vacaciones
      `.trim()
    },

    sla_proximo_vencer: {
      asunto: 'URGENTE: Solicitud de vacaciones próxima a vencer SLA',
      cuerpo: `
Estimado/a {jefeNombre},

La siguiente solicitud de vacaciones está próxima a vencer su SLA de aprobación:

**Solicitante:** {empleadoNombre}
**Días solicitados:** {diasSolicitados}
**Fechas:** {fechaInicio} al {fechaFin}

**SLA:**
- Tiempo restante: {horasRestantes} horas
- Vencimiento: {slaVencimiento}

Por favor, tome acción inmediata.

[Aprobar] [Rechazar]

Sistema de Gestión de Vacaciones
      `.trim()
    }
  },

  whatsapp: {
    solicitud_creada: `
*Solicitud de Vacaciones Creada*

Hola {empleadoNombre}, tu solicitud ha sido registrada:
- Días: {diasSolicitados}
- Fechas: {fechaInicio} - {fechaFin}
- Estado: Pendiente de aprobación

Te notificaremos cuando sea procesada.
    `.trim(),

    solicitud_pendiente_jefe: `
*Nueva Solicitud Pendiente*

{empleadoNombre} solicita vacaciones:
- Días: {diasSolicitados}
- Fechas: {fechaInicio} - {fechaFin}
- SLA: {horasRestantes}h restantes

Responde APROBAR o RECHAZAR
    `.trim(),

    solicitud_aprobada: `
*Vacaciones Aprobadas*

¡{empleadoNombre}, tus vacaciones fueron aprobadas!
- Días: {diasAprobados}
- Fechas: {fechaInicio} - {fechaFin}

¡Disfruta tu descanso!
    `.trim(),

    solicitud_rechazada: `
*Solicitud Rechazada*

{empleadoNombre}, tu solicitud fue rechazada.
Razón: {razonRechazo}

Contacta a RRHH para más información.
    `.trim()
  }
};

/**
 * Renderiza una plantilla con datos
 */
function renderizarPlantilla(tipo, canal, datos) {
  const plantilla = PLANTILLAS[canal]?.[tipo];

  if (!plantilla) {
    return null;
  }

  let contenido = typeof plantilla === 'string'
    ? plantilla
    : { asunto: plantilla.asunto, cuerpo: plantilla.cuerpo };

  // Reemplazar variables
  const reemplazar = (texto) => {
    return texto.replace(/\{(\w+)\}/g, (match, key) => {
      return datos[key] !== undefined ? datos[key] : match;
    });
  };

  if (typeof contenido === 'string') {
    return reemplazar(contenido);
  }

  return {
    asunto: reemplazar(contenido.asunto),
    cuerpo: reemplazar(contenido.cuerpo)
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

const gestorInstance = new GestorSolicitudesVacaciones();

module.exports = {
  // Clase principal
  GestorSolicitudesVacaciones,

  // Instancia singleton
  gestor: gestorInstance,

  // Sistema de eventos
  publicarEvento,
  suscribirEvento,
  EVENTOS,

  // Idempotencia
  verificarIdempotencia,
  generarIdempotencyKey,

  // Validaciones
  validarFormularioSolicitud,
  sugerirRangosAlternativos,

  // Plantillas
  PLANTILLAS,
  renderizarPlantilla,

  // Configuración
  CONFIG,

  // Cola de eventos (para testing)
  _colaEventos: colaEventos
};
