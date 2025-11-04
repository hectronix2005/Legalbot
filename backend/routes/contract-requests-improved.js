const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorizeCompanyRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const ContractRequest = require('../models/ContractRequest');
const ContractCategory = require('../models/ContractCategory');
const ContractTemplate = require('../models/ContractTemplate');
const Contract = require('../models/Contract');
const ActivityLog = require('../models/ActivityLog');

// Obtener todas las solicitudes (con filtros por rol)
router.get('/',
  authenticate,
  verifyTenant,
  async (req, res) => {
    try {
      const { status, priority } = req.query;

      const filter = {
        company: req.companyId
      };

      // Filtrar según el rol
      if (req.companyRole === 'requester') {
        // Los requesters solo ven sus propias solicitudes
        filter.requester = req.user.id;
      } else if (req.companyRole === 'lawyer') {
        // Los abogados ven las asignadas a ellos o las no asignadas
        filter.$or = [
          { assigned_lawyer: req.user.id },
          { assigned_lawyer: null, status: { $in: ['pending', 'in_review'] } }
        ];
      }
      // Los admins ven todas las solicitudes de la empresa

      if (status) filter.status = status;
      if (priority) filter.priority = priority;

      const requests = await ContractRequest.find(filter)
        .populate('category', 'name icon color')
        .populate('template', 'name')
        .populate('requester', 'name email')
        .populate('assigned_lawyer', 'name email')
        .populate('generated_contract', 'contract_number')
        .sort({ createdAt: -1 });

      res.json(requests);
    } catch (error) {
      console.error('Error al obtener solicitudes:', error);
      res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
  }
);

// Obtener una solicitud específica
router.get('/:id',
  authenticate,
  verifyTenant,
  async (req, res) => {
    try {
      const request = await ContractRequest.findOne({
        _id: req.params.id,
        company: req.companyId
      })
        .populate('category', 'name description icon color questionnaire')
        .populate('template', 'name content')
        .populate('requester', 'name email')
        .populate('assigned_lawyer', 'name email')
        .populate('generated_contract');

      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      // Verificar permisos
      if (req.companyRole === 'requester' && request.requester._id.toString() !== req.user.id) {
        return res.status(403).json({ error: 'No tiene permisos para ver esta solicitud' });
      }

      res.json(request);
    } catch (error) {
      console.error('Error al obtener solicitud:', error);
      res.status(500).json({ error: 'Error al obtener solicitud' });
    }
  }
);

// Crear solicitud de contrato (cualquier usuario autenticado)
router.post('/',
  authenticate,
  verifyTenant,
  [
    body('category_id').notEmpty().withMessage('La categoría es requerida'),
    body('title').notEmpty().withMessage('El título es requerido'),
    body('questionnaire_answers').isObject().withMessage('Las respuestas del cuestionario son requeridas'),
    body('field_data').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { category_id, title, questionnaire_answers, field_data, priority } = req.body;

      // Obtener la categoría
      const category = await ContractCategory.findOne({
        _id: category_id,
        company: req.companyId,
        active: true
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      // Validar respuestas del cuestionario
      const validation = category.validateAnswers(questionnaire_answers);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Respuestas del cuestionario inválidas',
          validation_errors: validation.errors
        });
      }

      // Crear la solicitud (la plantilla es opcional, se puede asignar después)
      const request = await ContractRequest.create({
        category: category_id,
        template: category.template || null, // Puede ser null, se asignará al aprobar
        requester: req.user.id,
        company: req.companyId,
        title,
        questionnaire_answers,
        field_data: field_data || {},
        priority: priority || 'medium',
        status: 'pending' // Siempre pendiente, requiere aprobación
      });

      // Si auto-asigna abogado, buscar uno disponible
      if (category.auto_assign_lawyer) {
        // TODO: Implementar lógica de asignación automática
        // Por ahora, dejarlo sin asignar
      }

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'create',
        entity_type: 'ContractRequest',
        entity_id: request._id,
        description: `Creó solicitud de contrato: ${title} (${category.name})`,
        ip_address: req.ip
      });

      await request.populate('category', 'name icon color');
      await request.populate('template', 'name');

      res.status(201).json({
        message: 'Solicitud creada exitosamente',
        request
      });
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      res.status(500).json({ error: 'Error al crear solicitud' });
    }
  }
);

// Asignar abogado a una solicitud (solo admins y lawyers)
router.post('/:id/assign',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('lawyer', 'admin'),
  [
    body('lawyer_id').optional().isMongoId()
  ],
  async (req, res) => {
    try {
      const { lawyer_id } = req.body;

      const request = await ContractRequest.findOne({
        _id: req.params.id,
        company: req.companyId
      });

      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (request.status === 'completed' || request.status === 'rejected') {
        return res.status(400).json({ error: 'No se puede modificar una solicitud completada o rechazada' });
      }

      // Si no se proporciona lawyer_id, auto-asignarse
      const assignedLawyerId = lawyer_id || req.user.id;

      request.assigned_lawyer = assignedLawyerId;
      request.assigned_at = new Date();
      request.status = 'in_review';
      await request.save();

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'assign',
        resource_type: 'ContractRequest',
        resource_id: request._id,
        description: `Asignó la solicitud a ${lawyer_id ? 'un abogado' : 'sí mismo'}`,
        ip_address: req.ip
      });

      await request.populate('assigned_lawyer', 'name email');

      res.json({
        message: 'Solicitud asignada exitosamente',
        request
      });
    } catch (error) {
      console.error('Error al asignar solicitud:', error);
      res.status(500).json({ error: 'Error al asignar solicitud' });
    }
  }
);

// Aprobar solicitud y generar contrato (solo lawyers y admins)
router.post('/:id/approve',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('lawyer', 'admin'),
  [
    body('legal_notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const { legal_notes } = req.body;

      const request = await ContractRequest.findOne({
        _id: req.params.id,
        company: req.companyId
      }).populate('template');

      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (request.status === 'approved' || request.status === 'completed') {
        return res.status(400).json({ error: 'Esta solicitud ya fue aprobada' });
      }

      if (request.status === 'rejected') {
        return res.status(400).json({ error: 'No se puede aprobar una solicitud rechazada' });
      }

      // Generar número de contrato
      const contractCount = await Contract.countDocuments({ company: req.companyId });
      const contract_number = `CONT-${String(contractCount + 1).padStart(6, '0')}`;

      // Crear el contrato
      const contract = await Contract.create({
        contract_number,
        template: request.template._id,
        company: req.companyId,
        created_by: req.user.id,
        field_data: request.field_data,
        status: 'active'
      });

      // Actualizar la solicitud
      request.status = 'completed';
      request.reviewed_at = new Date();
      request.legal_notes = legal_notes || '';
      request.generated_contract = contract._id;
      await request.save();

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'approve',
        resource_type: 'ContractRequest',
        resource_id: request._id,
        description: `Aprobó la solicitud y generó el contrato ${contract_number}`,
        ip_address: req.ip
      });

      await request.populate('generated_contract');

      res.json({
        message: 'Solicitud aprobada y contrato generado exitosamente',
        request,
        contract
      });
    } catch (error) {
      console.error('Error al aprobar solicitud:', error);
      res.status(500).json({ error: 'Error al aprobar solicitud' });
    }
  }
);

// Rechazar solicitud (solo lawyers y admins)
router.post('/:id/reject',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('lawyer', 'admin'),
  [
    body('rejection_reason').notEmpty().withMessage('La razón del rechazo es requerida')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { rejection_reason } = req.body;

      const request = await ContractRequest.findOne({
        _id: req.params.id,
        company: req.companyId
      });

      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (request.status === 'rejected') {
        return res.status(400).json({ error: 'Esta solicitud ya fue rechazada' });
      }

      if (request.status === 'completed') {
        return res.status(400).json({ error: 'No se puede rechazar una solicitud completada' });
      }

      request.status = 'rejected';
      request.rejection_reason = rejection_reason;
      request.reviewed_at = new Date();
      await request.save();

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'reject',
        resource_type: 'ContractRequest',
        resource_id: request._id,
        description: `Rechazó la solicitud. Razón: ${rejection_reason}`,
        ip_address: req.ip
      });

      res.json({
        message: 'Solicitud rechazada',
        request
      });
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
      res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
  }
);

// Obtener estadísticas de solicitudes
router.get('/stats/overview',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('lawyer', 'admin'),
  async (req, res) => {
    try {
      const stats = await ContractRequest.aggregate([
        {
          $match: {
            company: req.companyId
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        pending: 0,
        in_review: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        cancelled: 0
      };

      stats.forEach(stat => {
        result[stat._id] = stat.count;
      });

      res.json(result);
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
  }
);

module.exports = router;
