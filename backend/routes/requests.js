const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Obtener todas las solicitudes
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, company_id } = req.query;
    
    let query = `
      SELECT cr.*, 
             ct.name as template_name,
             u.name as requester_name,
             c.name as company_name,
             l.name as lawyer_name
      FROM contract_requests cr
      LEFT JOIN contract_templates ct ON cr.template_id = ct.id
      LEFT JOIN users u ON cr.requester_id = u.id
      LEFT JOIN companies c ON cr.company_id = c.id
      LEFT JOIN users l ON cr.assigned_lawyer_id = l.id
      WHERE 1=1
    `;
    const params = [];

    // Filtrar según el rol del usuario
    if (req.user.role === 'requester') {
      query += ' AND cr.requester_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'lawyer') {
      query += ' AND (cr.assigned_lawyer_id = ? OR cr.assigned_lawyer_id IS NULL)';
      params.push(req.user.id);
    }

    if (status) {
      query += ' AND cr.status = ?';
      params.push(status);
    }

    if (company_id) {
      query += ' AND cr.company_id = ?';
      params.push(company_id);
    }

    query += ' ORDER BY cr.created_at DESC';

    const requests = await db.all(query, params);
    
    // Parsear field_data JSON
    const requestsWithData = requests.map(req => ({
      ...req,
      field_data: JSON.parse(req.field_data)
    }));

    res.json(requestsWithData);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Obtener una solicitud específica
router.get('/:id', authenticate, async (req, res) => {
  try {
    const request = await db.get(`
      SELECT cr.*, 
             ct.name as template_name,
             ct.content as template_content,
             u.name as requester_name,
             u.email as requester_email,
             c.name as company_name,
             l.name as lawyer_name
      FROM contract_requests cr
      LEFT JOIN contract_templates ct ON cr.template_id = ct.id
      LEFT JOIN users u ON cr.requester_id = u.id
      LEFT JOIN companies c ON cr.company_id = c.id
      LEFT JOIN users l ON cr.assigned_lawyer_id = l.id
      WHERE cr.id = ?
    `, [req.params.id]);

    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Verificar permisos
    if (req.user.role === 'requester' && request.requester_id !== req.user.id) {
      return res.status(403).json({ error: 'No tiene permisos para ver esta solicitud' });
    }

    request.field_data = JSON.parse(request.field_data);
    res.json(request);
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({ error: 'Error al obtener solicitud' });
  }
});

// Crear solicitud de contrato
router.post('/',
  authenticate,
  [
    body('template_id').isInt().withMessage('La plantilla es requerida'),
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

      const result = await db.run(
        `INSERT INTO contract_requests 
        (template_id, requester_id, company_id, title, field_data, status) 
        VALUES (?, ?, ?, ?, ?, 'pending')`,
        [template_id, req.user.id, company_id, title, JSON.stringify(field_data)]
      );

      // Log de actividad
      await db.run(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'CREATE', 'request', result.id, `Creó solicitud: ${title}`]
      );

      res.status(201).json({ 
        message: 'Solicitud creada exitosamente',
        id: result.id 
      });
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      res.status(500).json({ error: 'Error al crear solicitud' });
    }
  }
);

// Asignar abogado a solicitud (admin o lawyer)
router.patch('/:id/assign',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { lawyer_id } = req.body;

      await db.run(
        'UPDATE contract_requests SET assigned_lawyer_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [lawyer_id, 'in_review', req.params.id]
      );

      await db.run(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'ASSIGN', 'request', req.params.id, `Asignó solicitud al abogado ID: ${lawyer_id}`]
      );

      res.json({ message: 'Abogado asignado exitosamente' });
    } catch (error) {
      console.error('Error al asignar abogado:', error);
      res.status(500).json({ error: 'Error al asignar abogado' });
    }
  }
);

// Aprobar solicitud (admin o lawyer asignado)
router.patch('/:id/approve',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { legal_notes } = req.body;

      const request = await db.get('SELECT * FROM contract_requests WHERE id = ?', [req.params.id]);
      
      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (req.user.role === 'lawyer' && request.assigned_lawyer_id !== req.user.id) {
        return res.status(403).json({ error: 'Solo el abogado asignado puede aprobar esta solicitud' });
      }

      await db.run(
        `UPDATE contract_requests 
        SET status = 'approved', legal_notes = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [legal_notes, req.params.id]
      );

      await db.run(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'APPROVE', 'request', req.params.id, 'Aprobó solicitud de contrato']
      );

      res.json({ message: 'Solicitud aprobada exitosamente' });
    } catch (error) {
      console.error('Error al aprobar solicitud:', error);
      res.status(500).json({ error: 'Error al aprobar solicitud' });
    }
  }
);

// Rechazar solicitud (admin o lawyer asignado)
router.patch('/:id/reject',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { rejection_reason } = req.body;

      if (!rejection_reason) {
        return res.status(400).json({ error: 'Debe proporcionar un motivo de rechazo' });
      }

      const request = await db.get('SELECT * FROM contract_requests WHERE id = ?', [req.params.id]);
      
      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (req.user.role === 'lawyer' && request.assigned_lawyer_id !== req.user.id) {
        return res.status(403).json({ error: 'Solo el abogado asignado puede rechazar esta solicitud' });
      }

      await db.run(
        `UPDATE contract_requests 
        SET status = 'rejected', rejection_reason = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [rejection_reason, req.params.id]
      );

      await db.run(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'REJECT', 'request', req.params.id, `Rechazó solicitud: ${rejection_reason}`]
      );

      res.json({ message: 'Solicitud rechazada' });
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
      res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
  }
);

// Actualizar datos de solicitud (solo si está pendiente)
router.put('/:id',
  authenticate,
  async (req, res) => {
    try {
      const { field_data, title } = req.body;
      
      const request = await db.get('SELECT * FROM contract_requests WHERE id = ?', [req.params.id]);
      
      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      // Solo el solicitante puede editar su solicitud y solo si está pendiente
      if (request.requester_id !== req.user.id) {
        return res.status(403).json({ error: 'No tiene permisos para editar esta solicitud' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Solo se pueden editar solicitudes pendientes' });
      }

      await db.run(
        'UPDATE contract_requests SET title = ?, field_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, JSON.stringify(field_data), req.params.id]
      );

      res.json({ message: 'Solicitud actualizada exitosamente' });
    } catch (error) {
      console.error('Error al actualizar solicitud:', error);
      res.status(500).json({ error: 'Error al actualizar solicitud' });
    }
  }
);

module.exports = router;

