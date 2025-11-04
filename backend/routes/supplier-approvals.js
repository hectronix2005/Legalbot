const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorizeCompanyRole } = require('../middleware/auth');
const Supplier = require('../models/Supplier');
const ActivityLog = require('../models/ActivityLog');

// Obtener terceros pendientes de aprobación (solo abogados y admins)
router.get('/pending',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('lawyer', 'admin'),
  async (req, res) => {
    try {
      const pendingSuppliers = await Supplier.find({
        company: req.companyId,
        approval_status: 'pending',
        active: true
      })
      .populate('created_by', 'name email')
      .populate('third_party_type', 'name')
      .sort({ createdAt: -1 });

      res.json(pendingSuppliers);
    } catch (error) {
      console.error('Error al obtener terceros pendientes:', error);
      res.status(500).json({ error: 'Error al obtener terceros pendientes' });
    }
  }
);

// Obtener todos los terceros con filtros de aprobación
router.get('/all',
  authenticate,
  verifyTenant,
  async (req, res) => {
    try {
      const { status } = req.query;

      const filter = {
        company: req.companyId,
        active: true
      };

      if (status) {
        filter.approval_status = status;
      }

      const suppliers = await Supplier.find(filter)
        .populate('created_by', 'name email')
        .populate('approved_by', 'name email')
        .populate('third_party_type', 'name')
        .sort({ createdAt: -1 });

      res.json(suppliers);
    } catch (error) {
      console.error('Error al obtener terceros:', error);
      res.status(500).json({ error: 'Error al obtener terceros' });
    }
  }
);

// Aprobar un tercero (solo abogados y admins)
router.post('/:id/approve',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('lawyer', 'admin'),
  async (req, res) => {
    try {
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        company: req.companyId
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Tercero no encontrado' });
      }

      if (supplier.approval_status !== 'pending') {
        return res.status(400).json({
          error: `Este tercero ya fue ${supplier.approval_status === 'approved' ? 'aprobado' : 'rechazado'}`
        });
      }

      // Aprobar el tercero
      supplier.approval_status = 'approved';
      supplier.approved_by = req.user.id;
      supplier.approved_at = new Date();
      supplier.updated_by = req.user.id;
      await supplier.save();

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'approve',
        resource_type: 'Supplier',
        resource_id: supplier._id,
        description: `Aprobó el tercero: ${supplier.legal_name}`,
        ip_address: req.ip
      });

      // Poblar los datos para la respuesta
      await supplier.populate('approved_by', 'name email');
      await supplier.populate('created_by', 'name email');

      res.json({
        message: 'Tercero aprobado exitosamente',
        supplier
      });
    } catch (error) {
      console.error('Error al aprobar tercero:', error);
      res.status(500).json({ error: 'Error al aprobar tercero' });
    }
  }
);

// Rechazar un tercero (solo abogados y admins)
router.post('/:id/reject',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('lawyer', 'admin'),
  async (req, res) => {
    try {
      const { rejection_reason } = req.body;

      if (!rejection_reason || rejection_reason.trim() === '') {
        return res.status(400).json({ error: 'La razón del rechazo es requerida' });
      }

      const supplier = await Supplier.findOne({
        _id: req.params.id,
        company: req.companyId
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Tercero no encontrado' });
      }

      if (supplier.approval_status !== 'pending') {
        return res.status(400).json({
          error: `Este tercero ya fue ${supplier.approval_status === 'approved' ? 'aprobado' : 'rechazado'}`
        });
      }

      // Rechazar el tercero
      supplier.approval_status = 'rejected';
      supplier.rejection_reason = rejection_reason.trim();
      supplier.rejected_at = new Date();
      supplier.approved_by = req.user.id; // Guarda quién rechazó
      supplier.updated_by = req.user.id;
      await supplier.save();

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'reject',
        resource_type: 'Supplier',
        resource_id: supplier._id,
        description: `Rechazó el tercero: ${supplier.legal_name}. Razón: ${rejection_reason}`,
        ip_address: req.ip
      });

      // Poblar los datos para la respuesta
      await supplier.populate('approved_by', 'name email');
      await supplier.populate('created_by', 'name email');

      res.json({
        message: 'Tercero rechazado',
        supplier
      });
    } catch (error) {
      console.error('Error al rechazar tercero:', error);
      res.status(500).json({ error: 'Error al rechazar tercero' });
    }
  }
);

// Obtener estadísticas de aprobaciones
router.get('/stats',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('lawyer', 'admin'),
  async (req, res) => {
    try {
      const stats = await Supplier.aggregate([
        {
          $match: {
            company: req.companyId,
            active: true
          }
        },
        {
          $group: {
            _id: '$approval_status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        pending: 0,
        approved: 0,
        rejected: 0
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
