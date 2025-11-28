/**
 * GestorSolicitudesVacaciones - REST API Endpoints
 *
 * Endpoints para gestión completa de solicitudes con:
 * - Validación de formularios
 * - Sugerencias de rangos alternativos
 * - Notificaciones con SLA
 * - Idempotencia
 * - Trazabilidad completa
 */

const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorizeCompanyRole } = require('../middleware/auth');
const {
  gestor,
  publicarEvento,
  suscribirEvento,
  EVENTOS,
  validarFormularioSolicitud,
  sugerirRangosAlternativos,
  renderizarPlantilla,
  PLANTILLAS,
  CONFIG
} = require('../services/gestorSolicitudesVacaciones');
const {
  calcularCausacion,
  saldoDisponible,
  MOTOR_CONSTANTS
} = require('../services/motorVacaciones');
const VacationBalance = require('../models/VacationBalance');
const VacationRequest = require('../models/VacationRequest');
const User = require('../models/User');

// Middleware de autenticación
router.use(authenticate);
router.use(verifyTenant);

// ============================================================================
// POST /api/gestor-solicitudes/solicitud
// Crear nueva solicitud de vacaciones
// ============================================================================
router.post('/solicitud', async (req, res) => {
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

    // Header de idempotencia (opcional)
    const idempotencyKey = req.headers['idempotency-key'] || null;

    // Verificar permisos (empleados solo crean sus propias solicitudes)
    const empleadoIdFinal = empleadoId || req.user.id;

    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        empleadoIdFinal !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para crear solicitudes para otro empleado'
      });
    }

    // Llamar al gestor
    const resultado = await gestor.crearSolicitud(
      {
        empleadoId: empleadoIdFinal,
        fechaInicio,
        fechaFin,
        diasSolicitados,
        observaciones
      },
      companyId,
      solicitanteId,
      idempotencyKey
    );

    if (resultado.duplicada) {
      return res.status(200).json({
        success: true,
        duplicada: true,
        mensaje: 'Solicitud ya procesada anteriormente',
        data: resultado.data
      });
    }

    if (!resultado.success) {
      const statusCode = resultado.codigo === 'SALDO_INSUFICIENTE' ? 400 : 400;
      return res.status(statusCode).json(resultado);
    }

    // Si hay sugerencias (saldo insuficiente), incluirlas
    if (resultado.sugerencias) {
      return res.status(400).json(resultado);
    }

    res.status(201).json(resultado);

  } catch (error) {
    console.error('[GestorSolicitudes] Error creando solicitud:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
});

// ============================================================================
// POST /api/gestor-solicitudes/validar
// Validar formulario sin crear (dry-run)
// ============================================================================
router.post('/validar', async (req, res) => {
  try {
    const { empleadoId, fechaInicio, fechaFin, diasSolicitados, observaciones } = req.body;
    const companyId = req.companyId;

    // 1. Validar formulario
    const validacionForm = validarFormularioSolicitud({
      empleadoId: empleadoId || req.user.id,
      fechaInicio,
      fechaFin,
      diasSolicitados,
      observaciones
    });

    if (!validacionForm.valido) {
      return res.status(400).json({
        success: false,
        valido: false,
        errores: validacionForm.errores
      });
    }

    // 2. Obtener balance
    const balance = await VacationBalance.findOne({
      employeeId: empleadoId || req.user.id,
      companyId
    });

    if (!balance) {
      return res.status(404).json({
        success: false,
        error: 'Empleado no tiene balance inicializado'
      });
    }

    // 3. Calcular saldo
    const causacion = calcularCausacion(balance.hireDate, new Date());
    const saldo = saldoDisponible(
      causacion.diasCausados,
      balance.enjoyedDays,
      balance.approvedPendingDays
    );

    // 4. Validar contra saldo
    const puedeCrear = diasSolicitados <= saldo.disponible;
    let sugerencias = null;

    if (!puedeCrear) {
      sugerencias = sugerirRangosAlternativos(saldo.disponible, diasSolicitados, fechaInicio);
    }

    res.json({
      success: true,
      valido: puedeCrear,
      formulario: {
        empleadoId: empleadoId || req.user.id,
        fechaInicio,
        fechaFin,
        diasSolicitados
      },
      saldo: {
        causados: causacion.diasCausados,
        disfrutados: balance.enjoyedDays,
        aprobadosPendientes: balance.approvedPendingDays,
        disponible: saldo.disponible
      },
      analisis: {
        puedeCrear,
        saldoSuficiente: puedeCrear,
        saldoRestantePostAprobacion: puedeCrear ? saldo.disponible - diasSolicitados : null,
        faltante: !puedeCrear ? diasSolicitados - saldo.disponible : 0
      },
      sugerencias: sugerencias?.sugerencias || [],
      configuracion: {
        diasMinimosAnticipacion: CONFIG.DIAS_ANTICIPACION_MINIMO,
        diasMaximoPorSolicitud: CONFIG.DIAS_MAXIMO_POR_SOLICITUD,
        slaAprobacionHoras: CONFIG.SLA_APROBACION_HORAS
      }
    });

  } catch (error) {
    console.error('[GestorSolicitudes] Error validando:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/gestor-solicitudes/:id/aprobar
// Aprobar solicitud (jefe/RRHH)
// ============================================================================
router.post('/:id/aprobar',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { observaciones } = req.body;
      const companyId = req.companyId;
      const aprobadorId = req.user.id;
      const idempotencyKey = req.headers['idempotency-key'] || null;

      const resultado = await gestor.aprobarSolicitud(
        id,
        aprobadorId,
        companyId,
        observaciones,
        idempotencyKey
      );

      if (resultado.duplicada) {
        return res.status(200).json({
          success: true,
          duplicada: true,
          mensaje: 'Aprobación ya procesada',
          data: resultado.data
        });
      }

      if (!resultado.success) {
        return res.status(400).json(resultado);
      }

      res.json(resultado);

    } catch (error) {
      console.error('[GestorSolicitudes] Error aprobando:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================================
// POST /api/gestor-solicitudes/:id/rechazar
// Rechazar solicitud
// ============================================================================
router.post('/:id/rechazar',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { razon } = req.body;
      const companyId = req.companyId;
      const rechazadorId = req.user.id;
      const idempotencyKey = req.headers['idempotency-key'] || null;

      if (!razon) {
        return res.status(400).json({
          success: false,
          error: 'Debe proporcionar una razón de rechazo'
        });
      }

      const resultado = await gestor.rechazarSolicitud(
        id,
        rechazadorId,
        companyId,
        razon,
        idempotencyKey
      );

      if (!resultado.success) {
        return res.status(400).json(resultado);
      }

      res.json(resultado);

    } catch (error) {
      console.error('[GestorSolicitudes] Error rechazando:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================================
// POST /api/gestor-solicitudes/:id/registrar-disfrute
// Registrar disfrute de vacaciones
// ============================================================================
router.post('/:id/registrar-disfrute',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { diasEfectivos, observaciones } = req.body;
      const companyId = req.companyId;
      const registradorId = req.user.id;
      const idempotencyKey = req.headers['idempotency-key'] || null;

      const resultado = await gestor.registrarDisfrute(
        id,
        registradorId,
        companyId,
        { diasEfectivos, observaciones },
        idempotencyKey
      );

      if (resultado.duplicada) {
        return res.status(200).json({
          success: true,
          duplicada: true,
          mensaje: 'Disfrute ya registrado',
          data: resultado.data
        });
      }

      if (!resultado.success) {
        return res.status(400).json(resultado);
      }

      res.json(resultado);

    } catch (error) {
      console.error('[GestorSolicitudes] Error registrando disfrute:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================================
// GET /api/gestor-solicitudes/pendientes-sla
// Obtener solicitudes pendientes con información de SLA
// ============================================================================
router.get('/pendientes-sla',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { soloVencidas = 'false', limite = '50' } = req.query;
      const companyId = req.companyId;

      const solicitudes = await gestor.obtenerSolicitudesPendientesSLA(companyId, {
        soloVencidas: soloVencidas === 'true',
        limite: parseInt(limite)
      });

      // Estadísticas de SLA
      const stats = {
        total: solicitudes.length,
        vencidas: solicitudes.filter(s => s.sla.vencido).length,
        proximas: solicitudes.filter(s => !s.sla.vencido && s.sla.horasRestantes < 12).length,
        enTiempo: solicitudes.filter(s => !s.sla.vencido && s.sla.horasRestantes >= 12).length
      };

      res.json({
        success: true,
        data: {
          solicitudes,
          estadisticas: stats,
          configuracion: {
            slaHoras: CONFIG.SLA_APROBACION_HORAS
          }
        }
      });

    } catch (error) {
      console.error('[GestorSolicitudes] Error obteniendo pendientes SLA:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================================
// GET /api/gestor-solicitudes/:id/historial
// Obtener historial de eventos de una solicitud
// ============================================================================
router.get('/:id/historial', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    // Verificar que la solicitud existe y pertenece a la compañía
    const solicitud = await VacationRequest.findOne({
      _id: id,
      companyId
    }).populate('employeeId', 'name email');

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        solicitud.employeeId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ver esta solicitud'
      });
    }

    const historial = await gestor.obtenerHistorialEventos(id, companyId);

    res.json({
      success: true,
      data: {
        solicitud: {
          id: solicitud._id,
          empleado: solicitud.employeeId,
          estado: solicitud.status,
          diasSolicitados: solicitud.requestedDays,
          fechaInicio: solicitud.startDate,
          fechaFin: solicitud.endDate
        },
        historial,
        totalEventos: historial.length
      }
    });

  } catch (error) {
    console.error('[GestorSolicitudes] Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/gestor-solicitudes/plantillas
// Obtener plantillas de notificación disponibles
// ============================================================================
router.get('/plantillas', async (req, res) => {
  try {
    const { canal = 'email' } = req.query;

    const plantillasCanal = PLANTILLAS[canal];

    if (!plantillasCanal) {
      return res.status(400).json({
        success: false,
        error: `Canal no soportado. Disponibles: ${Object.keys(PLANTILLAS).join(', ')}`
      });
    }

    const plantillasInfo = Object.keys(plantillasCanal).map(nombre => ({
      nombre,
      canal,
      tieneAsunto: typeof plantillasCanal[nombre] === 'object',
      variables: extraerVariables(
        typeof plantillasCanal[nombre] === 'string'
          ? plantillasCanal[nombre]
          : plantillasCanal[nombre].cuerpo
      )
    }));

    res.json({
      success: true,
      data: {
        canal,
        plantillas: plantillasInfo,
        canalesDisponibles: Object.keys(PLANTILLAS)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/gestor-solicitudes/plantillas/preview
// Previsualizar una plantilla con datos
// ============================================================================
router.post('/plantillas/preview', async (req, res) => {
  try {
    const { tipo, canal = 'email', datos } = req.body;

    if (!tipo || !datos) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: tipo, datos'
      });
    }

    const resultado = renderizarPlantilla(tipo, canal, datos);

    if (!resultado) {
      return res.status(404).json({
        success: false,
        error: `Plantilla "${tipo}" no encontrada para canal "${canal}"`
      });
    }

    res.json({
      success: true,
      data: {
        tipo,
        canal,
        renderizado: resultado
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/gestor-solicitudes/configuracion
// Obtener configuración del sistema
// ============================================================================
router.get('/configuracion', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        slaAprobacionHoras: CONFIG.SLA_APROBACION_HORAS,
        diasAnticipacionMinimo: CONFIG.DIAS_ANTICIPACION_MINIMO,
        diasMaximoPorSolicitud: CONFIG.DIAS_MAXIMO_POR_SOLICITUD,
        permitirDiasParciales: CONFIG.PERMITIR_DIAS_PARCIALES,
        maxReintentos: CONFIG.MAX_REINTENTOS,
        estados: MOTOR_CONSTANTS.ESTADOS,
        transiciones: MOTOR_CONSTANTS.TRANSICIONES_VALIDAS,
        eventos: EVENTOS
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/gestor-solicitudes/eventos
// Obtener cola de eventos (para debug/monitoring)
// ============================================================================
router.get('/eventos',
  authorizeCompanyRole('admin'),
  async (req, res) => {
    try {
      const { limite = '100', tipo = null } = req.query;
      const { _colaEventos } = require('../services/gestorSolicitudesVacaciones');

      let eventos = _colaEventos.slice(-parseInt(limite));

      if (tipo) {
        eventos = eventos.filter(e => e.tipo === tipo);
      }

      res.json({
        success: true,
        data: {
          eventos,
          total: _colaEventos.length,
          mostrados: eventos.length,
          tiposDisponibles: Object.values(EVENTOS)
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================================
// HELPER: Extraer variables de una plantilla
// ============================================================================
function extraerVariables(texto) {
  const regex = /\{(\w+)\}/g;
  const variables = new Set();
  let match;

  while ((match = regex.exec(texto)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

module.exports = router;
