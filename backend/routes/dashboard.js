const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Obtener estadísticas del dashboard
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = {};

    // Estadísticas según el rol
    if (req.user.role === 'admin') {
      // Total de empresas
      const companies = await db.get('SELECT COUNT(*) as count FROM companies WHERE active = 1');
      stats.totalCompanies = companies.count;

      // Total de usuarios
      const users = await db.get('SELECT COUNT(*) as count FROM users WHERE active = 1');
      stats.totalUsers = users.count;

      // Total de plantillas
      const templates = await db.get('SELECT COUNT(*) as count FROM contract_templates WHERE active = 1');
      stats.totalTemplates = templates.count;

      // Total de solicitudes
      const requests = await db.get('SELECT COUNT(*) as count FROM contract_requests');
      stats.totalRequests = requests.count;

      // Solicitudes por estado
      const requestsByStatus = await db.all(`
        SELECT status, COUNT(*) as count 
        FROM contract_requests 
        GROUP BY status
      `);
      stats.requestsByStatus = requestsByStatus;

      // Total de contratos
      const contracts = await db.get('SELECT COUNT(*) as count FROM contracts');
      stats.totalContracts = contracts.count;

    } else if (req.user.role === 'lawyer') {
      // Solicitudes asignadas
      const assigned = await db.get(
        'SELECT COUNT(*) as count FROM contract_requests WHERE assigned_lawyer_id = ?',
        [req.user.id]
      );
      stats.assignedRequests = assigned.count;

      // Solicitudes pendientes de revisar
      const pending = await db.get(
        'SELECT COUNT(*) as count FROM contract_requests WHERE assigned_lawyer_id = ? AND status = ?',
        [req.user.id, 'in_review']
      );
      stats.pendingReview = pending.count;

      // Contratos generados por el abogado
      const generated = await db.get(
        'SELECT COUNT(*) as count FROM contracts WHERE generated_by = ?',
        [req.user.id]
      );
      stats.contractsGenerated = generated.count;

      // Solicitudes sin asignar
      const unassigned = await db.get(
        'SELECT COUNT(*) as count FROM contract_requests WHERE assigned_lawyer_id IS NULL AND status = ?',
        ['pending']
      );
      stats.unassignedRequests = unassigned.count;

    } else if (req.user.role === 'requester') {
      // Mis solicitudes
      const myRequests = await db.get(
        'SELECT COUNT(*) as count FROM contract_requests WHERE requester_id = ?',
        [req.user.id]
      );
      stats.myRequests = myRequests.count;

      // Solicitudes pendientes
      const pending = await db.get(
        'SELECT COUNT(*) as count FROM contract_requests WHERE requester_id = ? AND status = ?',
        [req.user.id, 'pending']
      );
      stats.pendingRequests = pending.count;

      // Solicitudes aprobadas
      const approved = await db.get(
        'SELECT COUNT(*) as count FROM contract_requests WHERE requester_id = ? AND status = ?',
        [req.user.id, 'approved']
      );
      stats.approvedRequests = approved.count;

      // Mis contratos
      const myContracts = await db.get(`
        SELECT COUNT(*) as count 
        FROM contracts c
        JOIN contract_requests cr ON c.request_id = cr.id
        WHERE cr.requester_id = ?
      `, [req.user.id]);
      stats.myContracts = myContracts.count;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Obtener actividad reciente
router.get('/activity', authenticate, async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    
    let query = `
      SELECT a.*, u.name as user_name
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
    `;
    const params = [];

    // Filtrar actividad según el rol
    if (req.user.role === 'requester') {
      query += ' WHERE a.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const activity = await db.all(query, params);
    res.json(activity);
  } catch (error) {
    console.error('Error al obtener actividad:', error);
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

module.exports = router;

