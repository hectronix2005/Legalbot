/**
 * MotorVacaciones - REST API Endpoints
 *
 * Endpoints para el sistema de vacaciones según especificación:
 * - GET  /empleados/:id/saldo
 * - POST /vacaciones/solicitud
 * - POST /vacaciones/:id/aprobar
 * - POST /vacaciones/:id/registrar-disfrute
 * - GET  /vacaciones/:id
 */

const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorizeCompanyRole } = require('../middleware/auth');
const VacationBalance = require('../models/VacationBalance');
const VacationRequest = require('../models/VacationRequest');
const VacationAuditLog = require('../models/VacationAuditLog');
const User = require('../models/User');
const {
  calcularCausacion,
  saldoDisponible,
  validarSolicitud,
  validarTransicionEstado,
  calcularImpactoSaldo,
  calcularProyeccion,
  MOTOR_CONSTANTS
} = require('../services/motorVacaciones');

// Middleware de autenticación y tenant
router.use(authenticate);
router.use(verifyTenant);

// ============================================================================
// GET /api/motor-vacaciones/empleados/:id/saldo
// Obtener saldo de vacaciones de un empleado
// ============================================================================
router.get('/empleados/:id/saldo', async (req, res) => {
  try {
    const { id: employeeId } = req.params;
    const { fechaCorte, base = '365', incluirProyeccion = 'false' } = req.query;
    const companyId = req.companyId;

    // Verificar permisos (empleados solo ven su propio saldo)
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        employeeId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ver este saldo'
      });
    }

    // Obtener balance del empleado
    const balance = await VacationBalance.findOne({ employeeId, companyId });

    if (!balance) {
      return res.status(404).json({
        success: false,
        error: 'Balance no encontrado. Empleado no tiene vacaciones inicializadas.'
      });
    }

    // Calcular causación usando MotorVacaciones
    const fechaCalcular = fechaCorte ? new Date(fechaCorte) : new Date();
    const causacion = calcularCausacion(balance.hireDate, fechaCalcular, {
      base,
      diasAnuales: MOTOR_CONSTANTS.DIAS_VACACIONES_ANUALES
    });

    if (!causacion.valido) {
      return res.status(400).json({
        success: false,
        error: causacion.error
      });
    }

    // Calcular saldo disponible
    const saldo = saldoDisponible(
      causacion.diasCausados,
      balance.enjoyedDays,
      balance.approvedPendingDays
    );

    // Obtener solicitudes pendientes
    const solicitudesPendientes = await VacationRequest.find({
      employeeId,
      companyId,
      status: { $in: ['requested', 'approved', 'scheduled'] }
    }).select('_id status requestedDays startDate endDate').sort({ startDate: 1 });

    // Preparar respuesta
    const response = {
      success: true,
      data: {
        empleadoId: employeeId,
        fechaContratacion: balance.hireDate.toISOString().split('T')[0],
        fechaCorte: fechaCalcular.toISOString().split('T')[0],
        base: causacion.base,

        // Causación
        causacion: {
          diasCausados: causacion.diasCausados,
          diasTrabajados: causacion.diasTrabajados,
          anosServicio: causacion.anosServicio,
          tasaDiaria: causacion.tasaDiaria
        },

        // Saldo
        saldo: {
          causados: saldo.accrued,
          disfrutados: saldo.enjoyed,
          aprobadosPendientes: saldo.approvedPending,
          disponible: saldo.disponible,
          valido: saldo.valido
        },

        // Solicitudes activas
        solicitudesPendientes: solicitudesPendientes.map(s => ({
          id: s._id,
          estado: s.status,
          diasSolicitados: s.requestedDays,
          fechaInicio: s.startDate?.toISOString().split('T')[0],
          fechaFin: s.endDate?.toISOString().split('T')[0]
        })),

        ultimaActualizacion: balance.lastAccrualDate?.toISOString()
      }
    };

    // Agregar proyección si se solicita
    if (incluirProyeccion === 'true') {
      const finDeAno = new Date(fechaCalcular.getFullYear(), 11, 31);
      const proyeccion = calcularProyeccion(
        balance.hireDate,
        fechaCalcular,
        finDeAno,
        balance.enjoyedDays,
        balance.approvedPendingDays,
        { base }
      );

      if (proyeccion.valido) {
        response.data.proyeccion = proyeccion.proyeccion;
      }
    }

    res.json(response);

  } catch (error) {
    console.error('[MotorVacaciones] Error obteniendo saldo:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno obteniendo saldo'
    });
  }
});

// ============================================================================
// POST /api/motor-vacaciones/vacaciones/solicitud
// Crear solicitud de vacaciones
// ============================================================================
router.post('/vacaciones/solicitud', async (req, res) => {
  try {
    const {
      empleadoId,
      fechaInicio,
      fechaFin,
      diasSolicitados,
      observaciones
    } = req.body;
    const companyId = req.companyId;
    const solicitanteId = req.user.id;

    // Validar campos requeridos
    if (!empleadoId || !fechaInicio || !fechaFin || !diasSolicitados) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: empleadoId, fechaInicio, fechaFin, diasSolicitados'
      });
    }

    // Verificar permisos (empleados solo crean sus propias solicitudes)
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        empleadoId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para crear solicitudes para otro empleado'
      });
    }

    // Validar que días solicitados sea positivo
    if (diasSolicitados <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Días solicitados debe ser mayor a 0'
      });
    }

    // Obtener balance del empleado
    const balance = await VacationBalance.findOne({ employeeId: empleadoId, companyId });

    if (!balance) {
      return res.status(404).json({
        success: false,
        error: 'Empleado no tiene balance de vacaciones inicializado'
      });
    }

    // Calcular causación actual
    const causacion = calcularCausacion(balance.hireDate, new Date());

    if (!causacion.valido) {
      return res.status(400).json({
        success: false,
        error: `Error calculando causación: ${causacion.error}`
      });
    }

    // Calcular saldo disponible
    const saldo = saldoDisponible(
      causacion.diasCausados,
      balance.enjoyedDays,
      balance.approvedPendingDays
    );

    // Validar solicitud (BLOQUEO: no solicitar > saldo)
    const validacion = validarSolicitud(diasSolicitados, saldo.disponible);

    if (validacion.bloqueado) {
      return res.status(400).json({
        success: false,
        error: validacion.razon,
        detalle: {
          diasSolicitados,
          saldoDisponible: saldo.disponible,
          faltante: validacion.faltante
        }
      });
    }

    // Validar que fechas sean futuras
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioDate = new Date(fechaInicio);
    const finDate = new Date(fechaFin);

    if (inicioDate < hoy) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de inicio debe ser futura'
      });
    }

    if (finDate < inicioDate) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de fin debe ser igual o posterior a la fecha de inicio'
      });
    }

    // Verificar solicitudes solapadas
    const solapada = await VacationRequest.findOne({
      employeeId: empleadoId,
      companyId,
      status: { $in: ['requested', 'approved', 'scheduled'] },
      $or: [
        { startDate: { $lte: finDate }, endDate: { $gte: inicioDate } }
      ]
    });

    if (solapada) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una solicitud activa que se solapa con las fechas solicitadas',
        solicitudExistente: {
          id: solapada._id,
          estado: solapada.status,
          fechaInicio: solapada.startDate?.toISOString().split('T')[0],
          fechaFin: solapada.endDate?.toISOString().split('T')[0]
        }
      });
    }

    // Crear solicitud
    const solicitud = new VacationRequest({
      employeeId: empleadoId,
      requestedDays: diasSolicitados,
      startDate: inicioDate,
      endDate: finDate,
      status: MOTOR_CONSTANTS.ESTADOS.REQUESTED,
      notes: observaciones,
      companyId
    });

    await solicitud.save();

    // Crear log de auditoría
    await VacationAuditLog.createLog({
      employeeId: empleadoId,
      action: 'request',
      requestId: solicitud._id,
      performedBy: solicitanteId,
      quantity: diasSolicitados,
      description: `Solicitud de vacaciones creada: ${diasSolicitados} días del ${fechaInicio} al ${fechaFin}`,
      newState: {
        status: MOTOR_CONSTANTS.ESTADOS.REQUESTED,
        startDate: fechaInicio,
        endDate: fechaFin
      },
      companyId
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud de vacaciones creada exitosamente',
      data: {
        solicitudId: solicitud._id,
        empleadoId,
        estado: solicitud.status,
        diasSolicitados,
        fechaInicio,
        fechaFin,
        saldoDisponible: saldo.disponible,
        saldoRestantePostAprobacion: validacion.saldoRestante
      }
    });

  } catch (error) {
    console.error('[MotorVacaciones] Error creando solicitud:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno creando solicitud'
    });
  }
});

// ============================================================================
// POST /api/motor-vacaciones/vacaciones/:id/aprobar
// Aprobar solicitud de vacaciones (jefe/RRHH)
// ============================================================================
router.post('/vacaciones/:id/aprobar',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id: solicitudId } = req.params;
      const { observaciones } = req.body;
      const companyId = req.companyId;
      const aprobadorId = req.user.id;

      // Obtener solicitud
      const solicitud = await VacationRequest.findOne({ _id: solicitudId, companyId });

      if (!solicitud) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      // Validar transición de estado
      const transicion = validarTransicionEstado(
        solicitud.status,
        MOTOR_CONSTANTS.ESTADOS.APPROVED
      );

      if (!transicion.valida) {
        return res.status(400).json({
          success: false,
          error: transicion.razon
        });
      }

      // Obtener balance y verificar saldo
      const balance = await VacationBalance.findOne({
        employeeId: solicitud.employeeId,
        companyId
      });

      if (!balance) {
        return res.status(404).json({
          success: false,
          error: 'Balance de empleado no encontrado'
        });
      }

      // Calcular causación actual
      const causacion = calcularCausacion(balance.hireDate, new Date());
      const saldo = saldoDisponible(
        causacion.diasCausados,
        balance.enjoyedDays,
        balance.approvedPendingDays
      );

      // Validar bloqueo de aprobación
      const validacion = validarSolicitud(solicitud.requestedDays, saldo.disponible);

      if (validacion.bloqueado) {
        return res.status(400).json({
          success: false,
          error: `No se puede aprobar: ${validacion.razon}`,
          detalle: {
            diasSolicitados: solicitud.requestedDays,
            saldoDisponible: saldo.disponible
          }
        });
      }

      // Calcular impacto en saldo
      const impacto = calcularImpactoSaldo(
        solicitud.status,
        MOTOR_CONSTANTS.ESTADOS.APPROVED,
        solicitud.requestedDays
      );

      // Estado previo para auditoría
      const estadoPrevio = {
        status: solicitud.status,
        approvedPendingDays: balance.approvedPendingDays
      };

      // Actualizar solicitud
      solicitud.status = MOTOR_CONSTANTS.ESTADOS.APPROVED;
      solicitud.approverId = aprobadorId;
      solicitud.approvalDate = new Date();
      solicitud.approvalNotes = observaciones;
      await solicitud.save();

      // Actualizar balance (incrementar approvedPendingDays)
      balance.approvedPendingDays += impacto.approvedPendingDelta;
      await balance.save();

      // Log de auditoría
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

      res.json({
        success: true,
        message: 'Solicitud aprobada exitosamente',
        data: {
          solicitudId: solicitud._id,
          estadoAnterior: estadoPrevio.status,
          estadoActual: solicitud.status,
          diasAprobados: solicitud.requestedDays,
          fechaAprobacion: solicitud.approvalDate.toISOString(),
          impactoSaldo: {
            approvedPendingDelta: impacto.approvedPendingDelta,
            nuevoApprovedPending: balance.approvedPendingDays
          }
        }
      });

    } catch (error) {
      console.error('[MotorVacaciones] Error aprobando solicitud:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno aprobando solicitud'
      });
    }
  }
);

// ============================================================================
// POST /api/motor-vacaciones/vacaciones/:id/programar
// Programar fechas definitivas de disfrute
// ============================================================================
router.post('/vacaciones/:id/programar',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id: solicitudId } = req.params;
      const { fechaInicio, fechaFin, observaciones } = req.body;
      const companyId = req.companyId;
      const programadorId = req.user.id;

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({
          success: false,
          error: 'Campos requeridos: fechaInicio, fechaFin'
        });
      }

      const solicitud = await VacationRequest.findOne({ _id: solicitudId, companyId });

      if (!solicitud) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      // Validar transición
      const transicion = validarTransicionEstado(
        solicitud.status,
        MOTOR_CONSTANTS.ESTADOS.SCHEDULED
      );

      if (!transicion.valida) {
        return res.status(400).json({
          success: false,
          error: transicion.razon
        });
      }

      const estadoPrevio = {
        status: solicitud.status,
        startDate: solicitud.startDate?.toISOString().split('T')[0],
        endDate: solicitud.endDate?.toISOString().split('T')[0]
      };

      // Actualizar solicitud
      solicitud.status = MOTOR_CONSTANTS.ESTADOS.SCHEDULED;
      solicitud.startDate = new Date(fechaInicio);
      solicitud.endDate = new Date(fechaFin);
      solicitud.scheduledBy = programadorId;
      solicitud.scheduledDate = new Date();
      await solicitud.save();

      // Log de auditoría
      await VacationAuditLog.createLog({
        employeeId: solicitud.employeeId,
        action: 'schedule',
        requestId: solicitud._id,
        performedBy: programadorId,
        quantity: solicitud.requestedDays,
        description: `Vacaciones programadas del ${fechaInicio} al ${fechaFin}`,
        previousState: estadoPrevio,
        newState: {
          status: MOTOR_CONSTANTS.ESTADOS.SCHEDULED,
          startDate: fechaInicio,
          endDate: fechaFin
        },
        companyId
      });

      res.json({
        success: true,
        message: 'Vacaciones programadas exitosamente',
        data: {
          solicitudId: solicitud._id,
          estadoActual: solicitud.status,
          fechaInicio,
          fechaFin,
          diasProgramados: solicitud.requestedDays
        }
      });

    } catch (error) {
      console.error('[MotorVacaciones] Error programando vacaciones:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno programando vacaciones'
      });
    }
  }
);

// ============================================================================
// POST /api/motor-vacaciones/vacaciones/:id/registrar-disfrute
// Registrar disfrute y descontar del saldo (RRHH cierra la solicitud)
// ============================================================================
router.post('/vacaciones/:id/registrar-disfrute',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id: solicitudId } = req.params;
      const { diasEfectivosDisfrutados, observaciones } = req.body;
      const companyId = req.companyId;
      const registradorId = req.user.id;

      const solicitud = await VacationRequest.findOne({ _id: solicitudId, companyId });

      if (!solicitud) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      // Validar transición
      const transicion = validarTransicionEstado(
        solicitud.status,
        MOTOR_CONSTANTS.ESTADOS.ENJOYED
      );

      if (!transicion.valida) {
        return res.status(400).json({
          success: false,
          error: transicion.razon
        });
      }

      // Obtener balance
      const balance = await VacationBalance.findOne({
        employeeId: solicitud.employeeId,
        companyId
      });

      if (!balance) {
        return res.status(404).json({
          success: false,
          error: 'Balance de empleado no encontrado'
        });
      }

      // Días a descontar (por defecto los solicitados, permite disfrute parcial)
      const diasDescontar = diasEfectivosDisfrutados !== undefined
        ? diasEfectivosDisfrutados
        : solicitud.requestedDays;

      // Validar que no descuente más de lo aprobado
      if (diasDescontar > solicitud.requestedDays) {
        return res.status(400).json({
          success: false,
          error: `No se pueden descontar más días (${diasDescontar}) de los aprobados (${solicitud.requestedDays})`
        });
      }

      // Calcular impacto
      const impacto = calcularImpactoSaldo(
        solicitud.status,
        MOTOR_CONSTANTS.ESTADOS.ENJOYED,
        diasDescontar
      );

      const estadoPrevio = {
        status: solicitud.status,
        enjoyedDays: balance.enjoyedDays,
        approvedPendingDays: balance.approvedPendingDays,
        availableDays: balance.availableDays
      };

      // Actualizar solicitud
      solicitud.status = MOTOR_CONSTANTS.ESTADOS.ENJOYED;
      solicitud.enjoyedDate = new Date();
      solicitud.actualDaysEnjoyed = diasDescontar;
      solicitud.closedBy = registradorId;
      solicitud.closingNotes = observaciones;
      await solicitud.save();

      // Actualizar balance
      balance.enjoyedDays += diasDescontar;
      balance.approvedPendingDays -= solicitud.requestedDays; // Liberar todos los aprobados
      // availableDays se recalcula en pre-save hook
      await balance.save();

      // Log de auditoría
      await VacationAuditLog.createLog({
        employeeId: solicitud.employeeId,
        action: 'enjoy',
        requestId: solicitud._id,
        performedBy: registradorId,
        quantity: diasDescontar,
        description: `Disfrute registrado: ${diasDescontar} días descontados del saldo`,
        previousState: estadoPrevio,
        newState: {
          status: MOTOR_CONSTANTS.ESTADOS.ENJOYED,
          enjoyedDays: balance.enjoyedDays,
          approvedPendingDays: balance.approvedPendingDays,
          availableDays: balance.availableDays
        },
        companyId
      });

      // Si hubo disfrute parcial, registrar diferencia
      const diasNoUsados = solicitud.requestedDays - diasDescontar;
      if (diasNoUsados > 0) {
        await VacationAuditLog.createLog({
          employeeId: solicitud.employeeId,
          action: 'partial_return',
          requestId: solicitud._id,
          performedBy: registradorId,
          quantity: diasNoUsados,
          description: `${diasNoUsados} días aprobados no disfrutados - retornados al saldo`,
          companyId
        });
      }

      res.json({
        success: true,
        message: 'Disfrute de vacaciones registrado exitosamente',
        data: {
          solicitudId: solicitud._id,
          estadoFinal: solicitud.status,
          diasAprobados: solicitud.requestedDays,
          diasDisfrutados: diasDescontar,
          diasNoUsados,
          nuevoSaldo: {
            disfrutados: balance.enjoyedDays,
            aprobadosPendientes: balance.approvedPendingDays,
            disponible: balance.availableDays
          },
          fechaCierre: solicitud.enjoyedDate.toISOString()
        }
      });

    } catch (error) {
      console.error('[MotorVacaciones] Error registrando disfrute:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno registrando disfrute'
      });
    }
  }
);

// ============================================================================
// GET /api/motor-vacaciones/vacaciones/:id
// Obtener estado y trazabilidad de una solicitud
// ============================================================================
router.get('/vacaciones/:id', async (req, res) => {
  try {
    const { id: solicitudId } = req.params;
    const companyId = req.companyId;

    const solicitud = await VacationRequest.findOne({ _id: solicitudId, companyId })
      .populate('employeeId', 'name email')
      .populate('approverId', 'name email');

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        solicitud.employeeId._id?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ver esta solicitud'
      });
    }

    // Obtener historial de auditoría (trazabilidad)
    const historial = await VacationAuditLog.find({
      requestId: solicitudId,
      companyId
    }).sort({ timestamp: 1 }).select('action timestamp performedBy quantity description');

    // Calcular transiciones válidas desde estado actual
    const transicionesDisponibles = MOTOR_CONSTANTS.TRANSICIONES_VALIDAS[solicitud.status] || [];

    res.json({
      success: true,
      data: {
        solicitud: {
          id: solicitud._id,
          empleado: {
            id: solicitud.employeeId._id,
            nombre: solicitud.employeeId.name,
            email: solicitud.employeeId.email
          },
          estado: solicitud.status,
          diasSolicitados: solicitud.requestedDays,
          diasDisfrutados: solicitud.actualDaysEnjoyed,
          fechaInicio: solicitud.startDate?.toISOString().split('T')[0],
          fechaFin: solicitud.endDate?.toISOString().split('T')[0],
          fechaSolicitud: solicitud.requestDate?.toISOString(),
          fechaAprobacion: solicitud.approvalDate?.toISOString(),
          aprobador: solicitud.approverId ? {
            id: solicitud.approverId._id,
            nombre: solicitud.approverId.name
          } : null,
          fechaDisfrute: solicitud.enjoyedDate?.toISOString(),
          observaciones: solicitud.notes
        },
        transicionesDisponibles,
        trazabilidad: historial.map(h => ({
          accion: h.action,
          fecha: h.timestamp.toISOString(),
          cantidad: h.quantity,
          descripcion: h.description
        }))
      }
    });

  } catch (error) {
    console.error('[MotorVacaciones] Error obteniendo solicitud:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno obteniendo solicitud'
    });
  }
});

// ============================================================================
// POST /api/motor-vacaciones/vacaciones/:id/rechazar
// Rechazar solicitud de vacaciones
// ============================================================================
router.post('/vacaciones/:id/rechazar',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id: solicitudId } = req.params;
      const { razon } = req.body;
      const companyId = req.companyId;
      const rechazadorId = req.user.id;

      if (!razon) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere proporcionar una razón de rechazo'
        });
      }

      const solicitud = await VacationRequest.findOne({ _id: solicitudId, companyId });

      if (!solicitud) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      const transicion = validarTransicionEstado(
        solicitud.status,
        MOTOR_CONSTANTS.ESTADOS.REJECTED
      );

      if (!transicion.valida) {
        return res.status(400).json({
          success: false,
          error: transicion.razon
        });
      }

      const estadoPrevio = { status: solicitud.status };

      solicitud.status = MOTOR_CONSTANTS.ESTADOS.REJECTED;
      solicitud.rejectionReason = razon;
      solicitud.approverId = rechazadorId;
      solicitud.approvalDate = new Date();
      await solicitud.save();

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

      res.json({
        success: true,
        message: 'Solicitud rechazada',
        data: {
          solicitudId: solicitud._id,
          estadoFinal: solicitud.status,
          razon
        }
      });

    } catch (error) {
      console.error('[MotorVacaciones] Error rechazando solicitud:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno rechazando solicitud'
      });
    }
  }
);

// ============================================================================
// POST /api/motor-vacaciones/vacaciones/:id/cancelar
// Cancelar solicitud (empleado o RRHH)
// ============================================================================
router.post('/vacaciones/:id/cancelar', async (req, res) => {
  try {
    const { id: solicitudId } = req.params;
    const { razon } = req.body;
    const companyId = req.companyId;
    const canceladorId = req.user.id;

    const solicitud = await VacationRequest.findOne({ _id: solicitudId, companyId });

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada'
      });
    }

    // Empleados solo pueden cancelar sus propias solicitudes
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        solicitud.employeeId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para cancelar esta solicitud'
      });
    }

    const transicion = validarTransicionEstado(
      solicitud.status,
      MOTOR_CONSTANTS.ESTADOS.CANCELLED
    );

    if (!transicion.valida) {
      return res.status(400).json({
        success: false,
        error: transicion.razon
      });
    }

    // Si estaba aprobada o programada, liberar approvedPending
    let balance = null;
    let impacto = null;

    if (['approved', 'scheduled'].includes(solicitud.status)) {
      balance = await VacationBalance.findOne({
        employeeId: solicitud.employeeId,
        companyId
      });

      if (balance) {
        impacto = calcularImpactoSaldo(
          solicitud.status,
          MOTOR_CONSTANTS.ESTADOS.CANCELLED,
          solicitud.requestedDays
        );
        balance.approvedPendingDays += impacto.approvedPendingDelta;
        await balance.save();
      }
    }

    const estadoPrevio = { status: solicitud.status };

    solicitud.status = MOTOR_CONSTANTS.ESTADOS.CANCELLED;
    solicitud.cancellationReason = razon;
    solicitud.cancelledBy = canceladorId;
    solicitud.cancelledDate = new Date();
    await solicitud.save();

    await VacationAuditLog.createLog({
      employeeId: solicitud.employeeId,
      action: 'cancel',
      requestId: solicitud._id,
      performedBy: canceladorId,
      quantity: solicitud.requestedDays,
      description: `Solicitud cancelada: ${razon || 'Sin razón especificada'}`,
      previousState: estadoPrevio,
      newState: { status: MOTOR_CONSTANTS.ESTADOS.CANCELLED },
      metadata: impacto ? { saldoLiberado: -impacto.approvedPendingDelta } : {},
      companyId
    });

    res.json({
      success: true,
      message: 'Solicitud cancelada',
      data: {
        solicitudId: solicitud._id,
        estadoFinal: solicitud.status,
        diasLiberados: impacto ? -impacto.approvedPendingDelta : 0
      }
    });

  } catch (error) {
    console.error('[MotorVacaciones] Error cancelando solicitud:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno cancelando solicitud'
    });
  }
});

// ============================================================================
// GET /api/motor-vacaciones/calcular
// Endpoint de cálculo puro (sin persistencia) - útil para simulaciones
// ============================================================================
router.get('/calcular', async (req, res) => {
  try {
    const {
      hireDate,
      fechaCorte,
      base = '365',
      diasAnuales = '15',
      factorJornada = '1.0'
    } = req.query;

    if (!hireDate) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro requerido: hireDate'
      });
    }

    const resultado = calcularCausacion(hireDate, fechaCorte || new Date(), {
      base,
      diasAnuales: parseFloat(diasAnuales),
      factorJornada: parseFloat(factorJornada)
    });

    res.json({
      success: resultado.valido,
      data: resultado,
      error: resultado.error
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
