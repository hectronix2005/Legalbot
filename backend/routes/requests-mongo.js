const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const ContractRequest = require('../models/ContractRequest');
const ContractTemplate = require('../models/ContractTemplate');
const ActivityLog = require('../models/ActivityLog');

// Obtener todas las solicitudes
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, company_id } = req.query;
    
    const filter = {};
    
    // Filtrar según el rol
    if (req.user.role === 'requester') {
      filter.requester = req.user.id;
    } else if (req.user.role === 'lawyer') {
      filter.$or = [
        { assigned_lawyer: req.user.id },
        { assigned_lawyer: null }
      ];
    }
    
    if (status) filter.status = status;
    if (company_id) filter.company = company_id;

    const requests = await ContractRequest.find(filter)
      .populate('template', 'name category version')
      .populate('requester', 'name email')
      .populate('company', 'name')
      .populate('assigned_lawyer', 'name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Obtener una solicitud
router.get('/:id', authenticate, async (req, res) => {
  try {
    const request = await ContractRequest.findById(req.params.id)
      .populate('template', 'name content category')
      .populate('requester', 'name email')
      .populate('company', 'name')
      .populate('assigned_lawyer', 'name');

    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Verificar permisos
    if (req.user.role === 'requester' && request.requester._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tiene permisos para ver esta solicitud' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({ error: 'Error al obtener solicitud' });
  }
});

// Crear solicitud
router.post('/',
  authenticate,
  [
    body('template_id').notEmpty().withMessage('La plantilla es requerida'),
    body('title').notEmpty().withMessage('El título es requerido'),
    body('field_data').isObject().withMessage('Los datos del formulario son requeridos')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { template_id, title, field_data } = req.body;
      const company_id = req.user.company_id;

      if (!company_id) {
        return res.status(400).json({ error: 'El usuario debe estar asociado a una empresa' });
      }

      const request = await ContractRequest.create({
        template: template_id,
        requester: req.user.id,
        company: company_id,
        title,
        field_data,
        status: 'pending'
      });

      await ActivityLog.create({
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'request',
        entity_id: request._id,
        description: `Creó solicitud: ${title}`
      });

      res.status(201).json({ 
        message: 'Solicitud creada exitosamente',
        id: request._id 
      });
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      res.status(500).json({ error: 'Error al crear solicitud' });
    }
  }
);

// Asignar abogado
router.patch('/:id/assign',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { lawyer_id } = req.body;

      await ContractRequest.findByIdAndUpdate(req.params.id, {
        assigned_lawyer: lawyer_id,
        status: 'in_review'
      });

      await ActivityLog.create({
        user: req.user.id,
        action: 'ASSIGN',
        entity_type: 'request',
        entity_id: req.params.id,
        description: `Asignó solicitud al abogado`
      });

      res.json({ message: 'Abogado asignado exitosamente' });
    } catch (error) {
      console.error('Error al asignar abogado:', error);
      res.status(500).json({ error: 'Error al asignar abogado' });
    }
  }
);

// Aprobar solicitud
router.patch('/:id/approve',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { legal_notes } = req.body;

      const request = await ContractRequest.findById(req.params.id);
      
      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (req.user.role === 'lawyer' && request.assigned_lawyer?.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Solo el abogado asignado puede aprobar esta solicitud' });
      }

      await ContractRequest.findByIdAndUpdate(req.params.id, {
        status: 'approved',
        legal_notes,
        reviewed_at: new Date()
      });

      await ActivityLog.create({
        user: req.user.id,
        action: 'APPROVE',
        entity_type: 'request',
        entity_id: req.params.id,
        description: 'Aprobó solicitud de contrato'
      });

      res.json({ message: 'Solicitud aprobada exitosamente' });
    } catch (error) {
      console.error('Error al aprobar solicitud:', error);
      res.status(500).json({ error: 'Error al aprobar solicitud' });
    }
  }
);

// Rechazar solicitud
router.patch('/:id/reject',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { rejection_reason } = req.body;

      if (!rejection_reason) {
        return res.status(400).json({ error: 'Debe proporcionar un motivo de rechazo' });
      }

      await ContractRequest.findByIdAndUpdate(req.params.id, {
        status: 'rejected',
        rejection_reason,
        reviewed_at: new Date()
      });

      await ActivityLog.create({
        user: req.user.id,
        action: 'REJECT',
        entity_type: 'request',
        entity_id: req.params.id,
        description: `Rechazó solicitud: ${rejection_reason}`
      });

      res.json({ message: 'Solicitud rechazada' });
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
      res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
  }
);

// Actualizar solicitud
router.put('/:id',
  authenticate,
  async (req, res) => {
    try {
      const { field_data, title } = req.body;
      
      const request = await ContractRequest.findById(req.params.id);
      
      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (request.requester.toString() !== req.user.id) {
        return res.status(403).json({ error: 'No tiene permisos para editar esta solicitud' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Solo se pueden editar solicitudes pendientes' });
      }

      await ContractRequest.findByIdAndUpdate(req.params.id, {
        title,
        field_data
      });

      res.json({ message: 'Solicitud actualizada exitosamente' });
    } catch (error) {
      console.error('Error al actualizar solicitud:', error);
      res.status(500).json({ error: 'Error al actualizar solicitud' });
    }
  }
);

module.exports = router;

