const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorizeCompanyRole } = require('../middleware/auth');
const vacationService = require('../services/vacationService');
const VacationRequest = require('../models/VacationRequest');
const VacationAuditLog = require('../models/VacationAuditLog');
const vacationAuditService = require('../services/vacationAuditService');
const AuditReport = require('../models/AuditReport');

// All routes require authentication and tenant verification
router.use(authenticate);
router.use(verifyTenant);

/**
 * POST /api/vacations/requests
 * Create a new vacation request
 */
router.post('/requests', async (req, res) => {
  try {
    const { requestedDays, startDate, endDate } = req.body;
    const employeeId = req.user.id; // Employee creating their own request
    const companyId = req.companyId;

    // Validate required fields
    if (!requestedDays || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Campos requeridos: requestedDays, startDate, endDate'
      });
    }

    // Validate requestedDays is a positive number
    if (typeof requestedDays !== 'number' || requestedDays <= 0) {
      return res.status(400).json({
        error: 'requestedDays debe ser un número positivo'
      });
    }

    const request = await vacationService.createRequest(
      employeeId,
      requestedDays,
      startDate,
      endDate,
      companyId,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud de vacaciones creada exitosamente',
      data: request
    });
  } catch (error) {
    console.error('Error creating vacation request:', error);
    res.status(400).json({
      error: error.message || 'Error creando solicitud de vacaciones'
    });
  }
});

/**
 * GET /api/vacations/requests
 * Get vacation requests with filters
 */
router.get('/requests', async (req, res) => {
  try {
    const { employeeId, status, startDate, endDate, limit = 50, skip = 0 } = req.query;
    const companyId = req.companyId;

    const filters = {};

    if (employeeId) {
      filters.employeeId = employeeId;
    } else if (req.user.role !== 'super_admin' && !['admin', 'talento_humano'].includes(req.companyRole)) {
      // Regular employees can only see their own requests
      filters.employeeId = req.user.id;
    }

    if (status) {
      filters.status = status;
    }

    if (startDate) {
      filters.startDate = startDate;
    }

    if (endDate) {
      filters.endDate = endDate;
    }

    const result = await vacationService.getRequests(
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
    res.status(500).json({
      error: error.message || 'Error obteniendo solicitudes de vacaciones'
    });
  }
});

/**
 * GET /api/vacations/requests/:id
 * Get vacation request details
 */
router.get('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const request = await VacationRequest.findOne({ _id: id, companyId })
      .populate('employeeId', 'name email')
      .populate('approverId', 'name email');

    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Check permissions - employees can only see their own requests
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        request.employeeId._id.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permisos para ver esta solicitud'
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error getting vacation request:', error);
    res.status(500).json({
      error: error.message || 'Error obteniendo solicitud'
    });
  }
});

/**
 * PUT /api/vacations/requests/:id/approve
 * Approve a vacation request (admin, talento_humano only)
 */
router.put('/requests/:id/approve',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = req.companyId;
      const approverId = req.user.id;

      const request = await vacationService.approveRequest(id, approverId, companyId);

      res.json({
        success: true,
        message: 'Solicitud aprobada exitosamente',
        data: request
      });
    } catch (error) {
      console.error('Error approving vacation request:', error);
      res.status(400).json({
        error: error.message || 'Error aprobando solicitud'
      });
    }
  }
);

/**
 * PUT /api/vacations/requests/:id/reject
 * Reject a vacation request (admin, talento_humano only)
 */
router.put('/requests/:id/reject',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const companyId = req.companyId;
      const approverId = req.user.id;

      if (!rejectionReason) {
        return res.status(400).json({
          error: 'Se requiere proporcionar una razón de rechazo'
        });
      }

      const request = await vacationService.rejectRequest(
        id,
        approverId,
        rejectionReason,
        companyId
      );

      res.json({
        success: true,
        message: 'Solicitud rechazada',
        data: request
      });
    } catch (error) {
      console.error('Error rejecting vacation request:', error);
      res.status(400).json({
        error: error.message || 'Error rechazando solicitud'
      });
    }
  }
);

/**
 * PUT /api/vacations/requests/:id/schedule
 * Schedule vacation dates (admin, talento_humano only)
 */
router.put('/requests/:id/schedule',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.body;
      const companyId = req.companyId;
      const performedBy = req.user.id;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Se requieren startDate y endDate'
        });
      }

      const request = await vacationService.scheduleRequest(
        id,
        startDate,
        endDate,
        companyId,
        performedBy
      );

      res.json({
        success: true,
        message: 'Vacaciones programadas exitosamente',
        data: request
      });
    } catch (error) {
      console.error('Error scheduling vacation:', error);
      res.status(400).json({
        error: error.message || 'Error programando vacaciones'
      });
    }
  }
);

/**
 * POST /api/vacations/enjoy/:id
 * Mark vacation as enjoyed and deduct from balance (admin, talento_humano only)
 */
router.post('/enjoy/:id',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = req.companyId;
      const performedBy = req.user.id;

      const result = await vacationService.enjoyVacation(id, companyId, performedBy);

      res.json({
        success: true,
        message: 'Vacaciones registradas como disfrutadas y descontadas del saldo',
        data: result
      });
    } catch (error) {
      console.error('Error marking vacation as enjoyed:', error);
      res.status(400).json({
        error: error.message || 'Error registrando disfrute de vacaciones'
      });
    }
  }
);

/**
 * GET /api/vacations/balance/:employeeId
 * Get vacation balance for an employee
 */
router.get('/balance/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.companyId;

    // Check permissions - employees can only see their own balance
    if (req.user.role !== 'super_admin' &&
        !['admin', 'talento_humano'].includes(req.companyRole) &&
        employeeId !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permisos para ver este balance'
      });
    }

    const balance = await vacationService.getBalance(employeeId, companyId);

    if (!balance) {
      return res.status(404).json({
        error: 'Balance no encontrado. Es posible que el empleado no tenga balance inicializado.'
      });
    }

    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error('Error getting vacation balance:', error);
    res.status(500).json({
      error: error.message || 'Error obteniendo balance de vacaciones'
    });
  }
});

/**
 * POST /api/vacations/accrue
 * Run daily accrual job (admin, talento_humano only)
 */
router.post('/accrue',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      // Super admin must specify company
      if (req.user.role === 'super_admin' && companyId === 'ALL') {
        return res.status(400).json({
          error: 'Se requiere especificar una compañía para ejecutar la causación'
        });
      }

      const result = await vacationService.dailyAccrual(companyId);

      res.json({
        success: true,
        message: 'Causación diaria ejecutada exitosamente',
        data: result
      });
    } catch (error) {
      console.error('Error running daily accrual:', error);
      res.status(500).json({
        error: error.message || 'Error ejecutando causación diaria'
      });
    }
  }
);

/**
 * GET /api/vacations/audit
 * Get audit trail (admin, talento_humano only)
 */
router.get('/audit',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { employeeId, action, startDate, endDate, limit = 100 } = req.query;
      const companyId = req.companyId;

      // Super admin must specify company
      if (req.user.role === 'super_admin' && companyId === 'ALL') {
        return res.status(400).json({
          error: 'Se requiere especificar una compañía para ver auditoría'
        });
      }

      const filters = {};

      if (employeeId) {
        filters.employeeId = employeeId;
      }

      if (action) {
        filters.action = action;
      }

      if (startDate || endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }

      const auditLogs = await VacationAuditLog.getCompanyAudit(
        companyId,
        filters,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: {
          logs: auditLogs,
          total: auditLogs.length,
          filters
        }
      });
    } catch (error) {
      console.error('Error getting audit trail:', error);
      res.status(500).json({
        error: error.message || 'Error obteniendo auditoría'
      });
    }
  }
);

/**
 * POST /api/vacations/initialize/:employeeId
 * Initialize vacation balance for an employee (admin, talento_humano only)
 */
router.post('/initialize/:employeeId',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { hireDate } = req.body;
      const companyId = req.companyId;

      if (!hireDate) {
        return res.status(400).json({ error: 'Se requiere la fecha de contratación (hireDate)' });
      }

      const balance = await vacationService.initializeEmployeeBalance(
        employeeId,
        hireDate,
        companyId
      );

      res.status(201).json({
        success: true,
        message: 'Balance de vacaciones inicializado exitosamente',
        data: balance
      });
    } catch (error) {
      console.error('Error initializing vacation balance:', error);
      res.status(400).json({
        error: error.message || 'Error inicializando balance de vacaciones'
      });
    }
  }
);

// ===================================================================
// AUDIT ENDPOINTS - Sistema de Auditoría Automática
// ===================================================================

/**
 * GET /api/vacations/audit/run
 * Ejecutar auditoría completa para una compañía
 * Roles: super_admin, admin, talento_humano
 */
router.get('/audit/run',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      if (req.user.role === 'super_admin' && companyId === 'ALL') {
        return res.status(400).json({ error: 'Se requiere especificar una compañía para ejecutar la auditoría' });
      }

      console.log(`[AUDIT] Ejecutando auditoría para compañía ${companyId} por usuario ${req.user.id}`);

      const findings = await vacationAuditService.runFullAudit(companyId);

      res.json({
        success: true,
        data: findings
      });

    } catch (error) {
      console.error('[AUDIT] Error ejecutando auditoría:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/vacations/audit/history
 * Obtener historial de auditorías
 * Roles: super_admin, admin, talento_humano
 */
router.get('/audit/history',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      if (req.user.role === 'super_admin' && companyId === 'ALL') {
        return res.status(400).json({ error: 'Se requiere especificar una compañía' });
      }

      const {
        limit = 10,
        status = null,
        daysBack = 30
      } = req.query;

      const history = await vacationAuditService.getAuditHistory(companyId, {
        limit: parseInt(limit),
        status,
        daysBack: parseInt(daysBack)
      });

      res.json({
        success: true,
        data: history,
        count: history.length
      });

    } catch (error) {
      console.error('[AUDIT] Error obteniendo historial:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/vacations/audit/last
 * Obtener última auditoría ejecutada
 * Roles: super_admin, admin, talento_humano
 */
router.get('/audit/last',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      if (req.user.role === 'super_admin' && companyId === 'ALL') {
        return res.status(400).json({ error: 'Se requiere especificar una compañía' });
      }

      const lastAudit = await vacationAuditService.getLastAudit(companyId);

      if (!lastAudit) {
        return res.json({
          success: true,
          data: null,
          message: 'No se encontraron auditorías previas'
        });
      }

      res.json({
        success: true,
        data: lastAudit
      });

    } catch (error) {
      console.error('[AUDIT] Error obteniendo última auditoría:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/vacations/audit/metrics
 * Obtener métricas de auditoría
 * Roles: super_admin, admin, talento_humano
 */
router.get('/audit/metrics',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      if (req.user.role === 'super_admin' && companyId === 'ALL') {
        return res.status(400).json({ error: 'Se requiere especificar una compañía' });
      }

      const { daysBack = 30 } = req.query;

      const metrics = await vacationAuditService.getAuditMetrics(companyId, parseInt(daysBack));

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('[AUDIT] Error obteniendo métricas:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/vacations/audit/manual
 * Ejecutar auditoría manual inmediata (todas las compañías)
 * Roles: super_admin
 */
router.post('/audit/manual', authenticate, async (req, res) => {
  try {
    // Solo super_admin puede ejecutar auditoría manual de todas las compañías
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super_admin puede ejecutar auditoría manual global' });
    }

    console.log(`[AUDIT] Auditoría manual iniciada por usuario ${req.user.id}`);

    const results = await vacationAuditService.scheduledAudit();

    res.json({
      success: true,
      message: 'Auditoría manual completada',
      data: results
    });

  } catch (error) {
    console.error('[AUDIT] Error en auditoría manual:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vacations/audit/critical
 * Obtener reportes con errores críticos
 * Roles: super_admin, admin
 */
router.get('/audit/critical',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const companyId = req.companyId;

      if (req.user.role === 'super_admin' && companyId === 'ALL') {
        return res.status(400).json({ error: 'Se requiere especificar una compañía' });
      }

      const { daysBack = 7 } = req.query;

      const criticalReports = await AuditReport.getCriticalReports(companyId, parseInt(daysBack));

      res.json({
        success: true,
        data: criticalReports,
        count: criticalReports.length
      });

    } catch (error) {
      console.error('[AUDIT] Error obteniendo reportes críticos:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/vacations/audit/report/:reportId
 * Obtener detalle de un reporte específico
 * Roles: super_admin, admin, talento_humano
 */
router.get('/audit/report/:reportId',
  authorizeCompanyRole('admin', 'talento_humano'),
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const companyId = req.companyId;

      const report = await AuditReport.findOne({
        _id: reportId,
        companyId: req.user.role === 'super_admin' ? { $exists: true } : companyId
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Reporte no encontrado'
        });
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('[AUDIT] Error obteniendo reporte:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/vacations/audit/status
 * Verificar estado del sistema de auditoría
 * Roles: super_admin
 */
router.get('/audit/status', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super_admin puede ver el estado del sistema de auditoría' });
    }

    const totalReports = await AuditReport.countDocuments();
    const recentReports = await AuditReport.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    const lastReport = await AuditReport.findOne().sort({ timestamp: -1 });

    const criticalCount = await AuditReport.countDocuments({
      'findings.summary.criticalErrors': { $gt: 0 },
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      data: {
        totalReports,
        recentReports24h: recentReports,
        lastReportTimestamp: lastReport ? lastReport.timestamp : null,
        lastReportStatus: lastReport ? lastReport.status : null,
        criticalReportsLast7Days: criticalCount,
        systemHealthy: criticalCount === 0
      }
    });

  } catch (error) {
    console.error('[AUDIT] Error obteniendo estado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
