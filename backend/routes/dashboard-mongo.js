const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant } = require('../middleware/auth');
const Company = require('../models/Company');
const User = require('../models/User');
const ContractTemplate = require('../models/ContractTemplate');
const ContractRequest = require('../models/ContractRequest');
const Contract = require('../models/Contract');
const ActivityLog = require('../models/ActivityLog');

// Obtener estadísticas
router.get('/stats', authenticate, verifyTenant, async (req, res) => {
  try {
    const stats = {};

    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      // Si companyId es "ALL", no filtrar por empresa
      // Si no, filtrar por empresa seleccionada
      const companyFilter = (req.companyId && req.companyId !== 'ALL') ? { company: req.companyId } : {};

      const templateFilter = (req.companyId && req.companyId !== 'ALL')
        ? { active: true, $or: [{ company: req.companyId }, { is_shared: true }] }
        : { active: true };

      stats.totalCompanies = await Company.countDocuments({ active: true });
      stats.totalUsers = await User.countDocuments({ active: true });
      stats.totalTemplates = await ContractTemplate.countDocuments(templateFilter);
      stats.totalRequests = await ContractRequest.countDocuments(companyFilter);
      stats.totalContracts = await Contract.countDocuments(companyFilter);

      // Solicitudes por estado (filtrado por empresa si aplica)
      const aggregatePipeline = [];
      if (req.companyId && req.companyId !== 'ALL') {
        aggregatePipeline.push({ $match: { company: req.companyId } });
      }
      aggregatePipeline.push({ $group: { _id: '$status', count: { $sum: 1 } } });

      const requestsByStatus = await ContractRequest.aggregate(aggregatePipeline);
      stats.requestsByStatus = requestsByStatus.map(r => ({
        status: r._id,
        count: r.count
      }));

    } else if (req.user.role === 'lawyer') {
      const lawyerFilter = { assigned_lawyer: req.user.id };
      if (req.companyId) lawyerFilter.company = req.companyId;

      stats.assignedRequests = await ContractRequest.countDocuments(lawyerFilter);
      stats.pendingReview = await ContractRequest.countDocuments({
        ...lawyerFilter,
        status: 'in_review'
      });

      const contractFilter = { generated_by: req.user.id };
      if (req.companyId) contractFilter.company = req.companyId;
      stats.contractsGenerated = await Contract.countDocuments(contractFilter);

      const unassignedFilter = {
        assigned_lawyer: null,
        status: 'pending'
      };
      if (req.companyId) unassignedFilter.company = req.companyId;
      stats.unassignedRequests = await ContractRequest.countDocuments(unassignedFilter);

    } else if (req.user.role === 'requester') {
      const requesterFilter = { requester: req.user.id };
      if (req.companyId) requesterFilter.company = req.companyId;

      stats.myRequests = await ContractRequest.countDocuments(requesterFilter);
      stats.pendingRequests = await ContractRequest.countDocuments({
        ...requesterFilter,
        status: 'pending'
      });
      stats.approvedRequests = await ContractRequest.countDocuments({
        ...requesterFilter,
        status: 'approved'
      });

      const myRequestIds = await ContractRequest.find(requesterFilter).select('_id');
      const contractFilter = { request: { $in: myRequestIds.map(r => r._id) } };
      if (req.companyId) contractFilter.company = req.companyId;
      stats.myContracts = await Contract.countDocuments(contractFilter);
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

    // Requester solo ve su propia actividad
    if (req.user.role === 'requester') {
      filter.user = req.user.id;
    }

    // Nota: ActivityLog no tiene campo company, por lo que no se puede filtrar por empresa
    // Para filtrar por empresa, se necesitaría agregar el campo company al modelo ActivityLog

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

