const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Company = require('../models/Company');
const User = require('../models/User');
const ContractTemplate = require('../models/ContractTemplate');
const ContractRequest = require('../models/ContractRequest');
const Contract = require('../models/Contract');
const ActivityLog = require('../models/ActivityLog');

// Obtener estadísticas
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = {};

    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      stats.totalCompanies = await Company.countDocuments({ active: true });
      stats.totalUsers = await User.countDocuments({ active: true });
      stats.totalTemplates = await ContractTemplate.countDocuments({ active: true });
      stats.totalRequests = await ContractRequest.countDocuments();
      stats.totalContracts = await Contract.countDocuments();

      // Solicitudes por estado
      const requestsByStatus = await ContractRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      stats.requestsByStatus = requestsByStatus.map(r => ({
        status: r._id,
        count: r.count
      }));

    } else if (req.user.role === 'lawyer') {
      stats.assignedRequests = await ContractRequest.countDocuments({ assigned_lawyer: req.user.id });
      stats.pendingReview = await ContractRequest.countDocuments({ 
        assigned_lawyer: req.user.id, 
        status: 'in_review' 
      });
      stats.contractsGenerated = await Contract.countDocuments({ generated_by: req.user.id });
      stats.unassignedRequests = await ContractRequest.countDocuments({ 
        assigned_lawyer: null, 
        status: 'pending' 
      });

    } else if (req.user.role === 'requester') {
      stats.myRequests = await ContractRequest.countDocuments({ requester: req.user.id });
      stats.pendingRequests = await ContractRequest.countDocuments({ 
        requester: req.user.id, 
        status: 'pending' 
      });
      stats.approvedRequests = await ContractRequest.countDocuments({ 
        requester: req.user.id, 
        status: 'approved' 
      });
      
      const myRequestIds = await ContractRequest.find({ requester: req.user.id }).select('_id');
      stats.myContracts = await Contract.countDocuments({ 
        request: { $in: myRequestIds.map(r => r._id) } 
      });
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
    const limit = parseInt(req.query.limit) || 10;
    
    const filter = {};
    if (req.user.role === 'requester') {
      filter.user = req.user.id;
    }

    const activity = await ActivityLog.find(filter)
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(activity);
  } catch (error) {
    console.error('Error al obtener actividad:', error);
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

module.exports = router;

