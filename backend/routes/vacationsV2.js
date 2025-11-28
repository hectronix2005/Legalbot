/**
 * Vacation Routes V2 - Sistema de Vacaciones con Doble Aprobación
 *
 * Implementa endpoints para:
 * - Gestión de balance de empleados
 * - Registro de vacaciones históricas
 * - Flujo de doble aprobación (Líder + Talento Humano)
 * - Consultas y reportes
 *
 * Según legislación laboral colombiana (CST Art. 186)
 */

const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorizeCompanyRole } = require('../middleware/auth');
const vacationServiceV2 = require('../services/vacationServiceV2');
const VacationBalance = require('../models/VacationBalance');
const VacationRequest = require('../models/VacationRequest');
const HistoricalVacation = require('../models/HistoricalVacation');

// All routes require authentication and tenant verification
router.use(authenticate);
router.use(verifyTenant);

// ============================================================================
// GESTIÓN DE BALANCE DE EMPLEADOS
// ============================================================================

/**
 * POST /api/vacations-v2/balance/initialize
 * Inicializa el balance de vacaciones de un empleado
 * Roles: admin, talento_humano
 */
router.post('/balance/initialize',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { employeeId, hireDate, leaderId, position, department, historicalEnjoyedDays, workTimeFactor, calculationBase, notes } = req.body;
      const companyId = req.companyId;
      const performedBy = req.user.id;

      if (!employeeId || !hireDate) {
        return res.status(400).json({
          error: 'Se requieren employeeId y hireDate'
        });
      }

      const balance = await vacationServiceV2.initializeEmployeeBalance(
        employeeId,
        { hireDate, leaderId, position, department, historicalEnjoyedDays, workTimeFactor, calculationBase, notes },
        companyId,
        performedBy
      );

      res.status(201).json({
        success: true,
        message: 'Balance de vacaciones inicializado exitosamente',
        data: balance
      });
    } catch (error) {
      console.error('Error initializing balance:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/vacations-v2/balance/:employeeId
 * Actualiza información del empleado (líder, cargo, departamento)
 * Roles: admin, talento_humano
 */
router.put('/balance/:employeeId',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { leaderId, position, department, workTimeFactor, notes } = req.body;
      const companyId = req.companyId;
      const performedBy = req.user.id;

      const balance = await vacationServiceV2.updateEmployeeInfo(
        employeeId,
        { leaderId, position, department, workTimeFactor, notes },
        companyId,
        performedBy
      );

      res.json({
        success: true,
        message: 'Información del empleado actualizada',
        data: balance
      });
    } catch (error) {
      console.error('Error updating employee info:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /api/vacations-v2/balance/:employeeId
 * Obtiene el balance de vacaciones de un empleado
 */
router.get('/balance/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.companyId;

    // Verificar permisos
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        employeeId !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permisos para ver este balance'
      });
    }

    const result = await vacationServiceV2.getEmployeeBalance(employeeId, companyId);

    if (!result) {
      return res.status(404).json({
        error: 'Balance no encontrado. Es posible que el empleado no esté registrado.'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vacations-v2/balance
 * Obtiene mi propio balance (para empleados)
 */
router.get('/my-balance', async (req, res) => {
  try {
    const employeeId = req.user.id;
    const companyId = req.companyId;

    const result = await vacationServiceV2.getEmployeeBalance(employeeId, companyId);

    if (!result) {
      return res.status(404).json({
        error: 'No tienes balance de vacaciones. Contacta a Talento Humano.'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting my balance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vacations-v2/employees
 * Obtiene todos los empleados con balance (vista TH)
 * Roles: admin, talento_humano
 */
router.get('/employees',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { department, leaderId } = req.query;
      const companyId = req.companyId;

      const balances = await vacationServiceV2.getAllEmployeeBalances(companyId, { department, leaderId });

      res.json({
        success: true,
        data: balances,
        total: balances.length
      });
    } catch (error) {
      console.error('Error getting employees:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================================
// REGISTRO DE VACACIONES HISTÓRICAS
// ============================================================================

/**
 * POST /api/vacations-v2/historical
 * Registra vacaciones históricas de un empleado
 * Roles: admin, talento_humano
 */
router.post('/historical',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const {
        employeeId,
        servicePeriodStart,
        servicePeriodEnd,
        daysEnjoyed,
        enjoyedStartDate,
        enjoyedEndDate,
        type,
        supportDocument,
        notes
      } = req.body;

      const companyId = req.companyId;
      const registeredBy = req.user.id;

      if (!employeeId || !daysEnjoyed || !enjoyedStartDate || !enjoyedEndDate) {
        return res.status(400).json({
          error: 'Se requieren: employeeId, daysEnjoyed, enjoyedStartDate, enjoyedEndDate'
        });
      }

      const result = await vacationServiceV2.registerHistoricalVacation(
        employeeId,
        {
          servicePeriodStart: servicePeriodStart || enjoyedStartDate,
          servicePeriodEnd: servicePeriodEnd || enjoyedEndDate,
          daysEnjoyed,
          enjoyedStartDate,
          enjoyedEndDate,
          type,
          supportDocument,
          notes
        },
        companyId,
        registeredBy
      );

      res.status(201).json({
        success: true,
        message: 'Vacaciones históricas registradas exitosamente',
        data: result
      });
    } catch (error) {
      console.error('Error registering historical vacation:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /api/vacations-v2/historical/:employeeId
 * Obtiene historial de vacaciones de un empleado
 */
router.get('/historical/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.companyId;

    // Verificar permisos
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        employeeId !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permisos para ver este historial'
      });
    }

    const result = await vacationServiceV2.getHistoricalVacations(employeeId, companyId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting historical vacations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/vacations-v2/historical/:id/verify
 * Verifica un registro histórico
 * Roles: admin, talento_humano
 */
router.put('/historical/:id/verify',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = req.companyId;
      const verifiedBy = req.user.id;

      const record = await vacationServiceV2.verifyHistoricalRecord(id, verifiedBy, companyId);

      res.json({
        success: true,
        message: 'Registro histórico verificado',
        data: record
      });
    } catch (error) {
      console.error('Error verifying historical record:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============================================================================
// SOLICITUDES DE VACACIONES
// ============================================================================

/**
 * POST /api/vacations-v2/requests
 * Crea una nueva solicitud de vacaciones (empleado)
 */
router.post('/requests', async (req, res) => {
  try {
    const { requestedDays, startDate, endDate, employeeNotes } = req.body;
    const employeeId = req.user.id;
    const companyId = req.companyId;

    if (!requestedDays || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Se requieren: requestedDays, startDate, endDate'
      });
    }

    if (requestedDays <= 0) {
      return res.status(400).json({
        error: 'Los días solicitados deben ser mayor a 0'
      });
    }

    const result = await vacationServiceV2.createRequest(
      employeeId,
      { requestedDays, startDate, endDate, employeeNotes },
      companyId,
      employeeId
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud de vacaciones creada exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error creating vacation request:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/vacations-v2/requests
 * Obtiene solicitudes de vacaciones con filtros
 */
router.get('/requests', async (req, res) => {
  try {
    const { employeeId, status, startDate, endDate, limit = 50, skip = 0 } = req.query;
    const companyId = req.companyId;

    const filters = {};

    // Empleados regulares solo ven sus propias solicitudes
    if (req.user.role !== 'super_admin' && !['admin', 'talento_humano'].includes(req.companyRole)) {
      filters.employeeId = req.user.id;
    } else if (employeeId) {
      filters.employeeId = employeeId;
    }

    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const result = await vacationServiceV2.getRequests(
      filters,
      companyId,
      parseInt(limit),
      parseInt(skip)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting vacation requests:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vacations-v2/requests/my
 * Obtiene mis solicitudes de vacaciones
 */
router.get('/requests/my', async (req, res) => {
  try {
    const employeeId = req.user.id;
    const companyId = req.companyId;
    const { status, limit = 50, skip = 0 } = req.query;

    const filters = { employeeId };
    if (status) filters.status = status;

    const result = await vacationServiceV2.getRequests(
      filters,
      companyId,
      parseInt(limit),
      parseInt(skip)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting my requests:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vacations-v2/requests/:id
 * Obtiene detalle de una solicitud
 */
router.get('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const request = await VacationRequest.findOne({ _id: id, companyId })
      .populate('employeeId', 'name email')
      .populate('leaderId', 'name email')
      .populate('hrApproverId', 'name email');

    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Verificar permisos
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        request.employeeId._id.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permisos para ver esta solicitud'
      });
    }

    res.json({
      success: true,
      data: {
        request,
        approvalStage: request.getApprovalStage()
      }
    });
  } catch (error) {
    console.error('Error getting vacation request:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// APROBACIONES - FLUJO LÍDER
// ============================================================================

/**
 * GET /api/vacations-v2/pending/leader
 * Obtiene solicitudes pendientes de aprobación por líder
 */
router.get('/pending/leader', async (req, res) => {
  try {
    const leaderId = req.user.id;
    const companyId = req.companyId;

    const requests = await vacationServiceV2.getPendingForLeader(leaderId, companyId);

    res.json({
      success: true,
      data: requests,
      total: requests.length
    });
  } catch (error) {
    console.error('Error getting pending for leader:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/vacations-v2/requests/:id/approve-leader
 * Aprueba una solicitud como líder
 */
router.put('/requests/:id/approve-leader', async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const leaderId = req.user.id;
    const companyId = req.companyId;

    const result = await vacationServiceV2.approveByLeader(id, leaderId, companyId, comments);

    res.json({
      success: true,
      message: 'Solicitud aprobada por líder',
      data: result
    });
  } catch (error) {
    console.error('Error approving by leader:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/vacations-v2/requests/:id/reject-leader
 * Rechaza una solicitud como líder
 */
router.put('/requests/:id/reject-leader', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const leaderId = req.user.id;
    const companyId = req.companyId;

    if (!reason) {
      return res.status(400).json({
        error: 'Se requiere una razón de rechazo'
      });
    }

    const result = await vacationServiceV2.rejectByLeader(id, leaderId, companyId, reason);

    res.json({
      success: true,
      message: 'Solicitud rechazada por líder',
      data: result
    });
  } catch (error) {
    console.error('Error rejecting by leader:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// APROBACIONES - FLUJO TALENTO HUMANO
// ============================================================================

/**
 * GET /api/vacations-v2/pending/hr
 * Obtiene solicitudes pendientes de aprobación por TH
 * Roles: admin, talento_humano
 */
router.get('/pending/hr',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      const requests = await vacationServiceV2.getPendingForHR(companyId);

      res.json({
        success: true,
        data: requests,
        total: requests.length
      });
    } catch (error) {
      console.error('Error getting pending for HR:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/vacations-v2/requests/:id/approve-hr
 * Aprueba una solicitud como Talento Humano (aprobación final)
 * Roles: admin, talento_humano
 */
router.put('/requests/:id/approve-hr',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const hrUserId = req.user.id;
      const companyId = req.companyId;

      const result = await vacationServiceV2.approveByHR(id, hrUserId, companyId, comments);

      res.json({
        success: true,
        message: 'Solicitud aprobada por Talento Humano (aprobación final)',
        data: result
      });
    } catch (error) {
      console.error('Error approving by HR:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/vacations-v2/requests/:id/reject-hr
 * Rechaza una solicitud como Talento Humano
 * Roles: admin, talento_humano
 */
router.put('/requests/:id/reject-hr',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const hrUserId = req.user.id;
      const companyId = req.companyId;

      if (!reason) {
        return res.status(400).json({
          error: 'Se requiere una razón de rechazo'
        });
      }

      const result = await vacationServiceV2.rejectByHR(id, hrUserId, companyId, reason);

      res.json({
        success: true,
        message: 'Solicitud rechazada por Talento Humano',
        data: result
      });
    } catch (error) {
      console.error('Error rejecting by HR:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============================================================================
// DISFRUTE DE VACACIONES
// ============================================================================

/**
 * PUT /api/vacations-v2/requests/:id/enjoy
 * Marca vacaciones como disfrutadas
 * Roles: admin, talento_humano
 */
router.put('/requests/:id/enjoy',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const performedBy = req.user.id;
      const companyId = req.companyId;

      const result = await vacationServiceV2.markAsEnjoyed(id, performedBy, companyId);

      res.json({
        success: true,
        message: 'Vacaciones registradas como disfrutadas',
        data: result
      });
    } catch (error) {
      console.error('Error marking as enjoyed:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============================================================================
// GESTIÓN DE SUSPENSIONES
// ============================================================================

/**
 * POST /api/vacations-v2/suspensions/:employeeId
 * Registra un período de suspensión (los días no causan vacaciones)
 * Roles: admin, talento_humano
 */
router.post('/suspensions/:employeeId',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate, reason, description } = req.body;
      const companyId = req.companyId;
      const performedBy = req.user.id;

      if (!startDate || !endDate || !reason) {
        return res.status(400).json({
          error: 'Se requieren: startDate, endDate, reason'
        });
      }

      const validReasons = ['licencia_no_remunerada', 'ausencia_injustificada', 'suspension_disciplinaria', 'otro'];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({
          error: `Razón inválida. Opciones: ${validReasons.join(', ')}`
        });
      }

      const result = await vacationServiceV2.registerSuspensionPeriod(
        employeeId,
        { startDate, endDate, reason, description },
        companyId,
        performedBy
      );

      res.status(201).json({
        success: true,
        message: `Suspensión registrada: ${result.suspensionAdded.daysCount} días no causarán vacaciones`,
        data: result
      });
    } catch (error) {
      console.error('Error registering suspension:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/vacations-v2/suspensions/:employeeId/:index
 * Elimina un período de suspensión
 * Roles: admin, talento_humano
 */
router.delete('/suspensions/:employeeId/:index',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { employeeId, index } = req.params;
      const companyId = req.companyId;
      const performedBy = req.user.id;

      const result = await vacationServiceV2.removeSuspensionPeriod(
        employeeId,
        parseInt(index),
        companyId,
        performedBy
      );

      res.json({
        success: true,
        message: `Suspensión eliminada: ${result.suspensionRemoved.daysCount} días restaurados`,
        data: result
      });
    } catch (error) {
      console.error('Error removing suspension:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============================================================================
// CAMBIO DE BASE DE CÁLCULO
// ============================================================================

/**
 * PUT /api/vacations-v2/balance/:employeeId/change-base
 * Cambia la base de cálculo (365 ↔ 360) con registro ADR
 * Roles: admin, talento_humano
 */
router.put('/balance/:employeeId/change-base',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { newBase, reason } = req.body;
      const companyId = req.companyId;
      const performedBy = req.user.id;

      if (!newBase || !['365', '360'].includes(newBase)) {
        return res.status(400).json({
          error: 'newBase debe ser "365" o "360"'
        });
      }

      if (!reason) {
        return res.status(400).json({
          error: 'Se requiere una razón para el cambio de base'
        });
      }

      const result = await vacationServiceV2.changeCalculationBase(
        employeeId,
        newBase,
        reason,
        companyId,
        performedBy
      );

      res.json({
        success: true,
        message: result.message,
        data: {
          balance: result.balance,
          ajuste: {
            baseAnterior: result.ajuste.baseAnterior,
            baseNueva: result.ajuste.baseNueva,
            diasAjustados: result.ajuste.ajusteDias,
            adr: result.ajuste.adr
          }
        }
      });
    } catch (error) {
      console.error('Error changing calculation base:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============================================================================
// BALANCE FORMATEADO PARA UI
// ============================================================================

/**
 * GET /api/vacations-v2/balance/:employeeId/formatted
 * Obtiene balance formateado para interfaz (2 decimales display, 4 interno)
 */
router.get('/balance/:employeeId/formatted', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.companyId;

    // Verificar permisos
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        employeeId !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permisos para ver este balance'
      });
    }

    const result = await vacationServiceV2.getFormattedBalance(employeeId, companyId);

    if (!result) {
      return res.status(404).json({
        error: 'Balance no encontrado'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting formatted balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CÁLCULO DE DÍAS HÁBILES
// ============================================================================

/**
 * GET /api/vacations-v2/calculate-business-days
 * Calcula días hábiles entre dos fechas
 */
router.get('/calculate-business-days', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const companyId = req.companyId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Se requieren: startDate, endDate'
      });
    }

    const result = await vacationServiceV2.calculateBusinessDays(startDate, endDate, companyId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error calculating business days:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/vacations-v2/convert-days
 * Convierte días hábiles a calendario o viceversa
 */
router.get('/convert-days', (req, res) => {
  try {
    const { days, direction } = req.query;

    if (!days || !direction) {
      return res.status(400).json({
        error: 'Se requieren: days (número), direction (habiles_a_calendario | calendario_a_habiles)'
      });
    }

    const daysNum = parseFloat(days);
    if (isNaN(daysNum) || daysNum < 0) {
      return res.status(400).json({
        error: 'days debe ser un número positivo'
      });
    }

    let result;
    if (direction === 'habiles_a_calendario') {
      result = vacationServiceV2.convertBusinessToCalendarDays(daysNum);
    } else if (direction === 'calendario_a_habiles') {
      const { convertirCalendarioAHabiles } = require('../services/motorVacaciones');
      result = convertirCalendarioAHabiles(daysNum);
    } else {
      return res.status(400).json({
        error: 'direction debe ser: habiles_a_calendario | calendario_a_habiles'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error converting days:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// REPORTES Y ESTADÍSTICAS
// ============================================================================

/**
 * GET /api/vacations-v2/stats/company
 * Obtiene estadísticas de vacaciones de la compañía
 * Roles: admin, talento_humano
 */
router.get('/stats/company',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      // Total de empleados con balance
      const totalEmployees = await VacationBalance.countDocuments({ companyId });

      // Solicitudes por estado
      const requestsByStatus = await VacationRequest.aggregate([
        { $match: { companyId: require('mongoose').Types.ObjectId(companyId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Días totales disfrutados
      const totalEnjoyed = await VacationBalance.aggregate([
        { $match: { companyId: require('mongoose').Types.ObjectId(companyId) } },
        { $group: {
          _id: null,
          totalEnjoyed: { $sum: '$enjoyedDays' },
          totalHistorical: { $sum: '$historicalEnjoyedDays' },
          totalAccrued: { $sum: '$accruedDays' },
          totalPending: { $sum: '$approvedPendingDays' }
        }}
      ]);

      // Solicitudes pendientes de aprobación
      const pendingLeader = await VacationRequest.countDocuments({
        companyId,
        status: 'requested'
      });

      const pendingHR = await VacationRequest.countDocuments({
        companyId,
        status: 'leader_approved'
      });

      res.json({
        success: true,
        data: {
          totalEmployees,
          requestsByStatus: requestsByStatus.reduce((acc, r) => {
            acc[r._id] = r.count;
            return acc;
          }, {}),
          totals: totalEnjoyed[0] || {
            totalEnjoyed: 0,
            totalHistorical: 0,
            totalAccrued: 0,
            totalPending: 0
          },
          pendingApprovals: {
            leader: pendingLeader,
            hr: pendingHR,
            total: pendingLeader + pendingHR
          }
        }
      });
    } catch (error) {
      console.error('Error getting company stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/vacations-v2/stats/department
 * Obtiene estadísticas por departamento
 * Roles: admin, talento_humano
 */
router.get('/stats/department',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      const stats = await VacationBalance.aggregate([
        { $match: { companyId: require('mongoose').Types.ObjectId(companyId) } },
        { $group: {
          _id: '$department',
          employeeCount: { $sum: 1 },
          totalAccrued: { $sum: '$accruedDays' },
          totalEnjoyed: { $sum: '$enjoyedDays' },
          totalPending: { $sum: '$approvedPendingDays' },
          avgAvailable: { $avg: '$availableDays' }
        }},
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting department stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
