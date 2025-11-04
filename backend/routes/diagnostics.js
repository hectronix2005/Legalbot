const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticate, authorize } = require('../middleware/auth');
const { fullSystemCheck } = require('../services/dataLossProtection');
const { listBackups } = require('../services/robustBackup');

/**
 * Rutas de diagnóstico para verificar el estado del sistema
 * Solo accesibles para super_admin y admin
 */

// Health check completo del sistema
router.get('/health-check', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'ok',
      services: {},
      database: {},
      backups: {}
    };

    // 1. Verificar MongoDB
    const mongoState = mongoose.connection.readyState;
    healthCheck.services.mongodb = {
      connected: mongoState === 1,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState],
      database: mongoose.connection.name
    };

    // 2. Verificar colecciones críticas
    if (mongoState === 1) {
      const collections = ['contracttemplates', 'contracts', 'companies', 'users', 'suppliers', 'thirdpartytypeconfigs', 'usercompanies'];
      const counts = {};

      for (const collectionName of collections) {
        try {
          const collection = mongoose.connection.db.collection(collectionName);
          counts[collectionName] = await collection.countDocuments();
        } catch (error) {
          counts[collectionName] = { error: error.message };
        }
      }

      healthCheck.database.counts = counts;
      healthCheck.database.totalDocuments = Object.values(counts)
        .filter(v => typeof v === 'number')
        .reduce((a, b) => a + b, 0);
    }

    // 3. Verificar backups
    try {
      const backups = await listBackups();
      healthCheck.backups = {
        total: backups.length,
        latest: backups[0] ? {
          filename: backups[0].filename,
          timestamp: backups[0].timestamp || backups[0].created,
          type: backups[0].type,
          stats: backups[0].stats
        } : null
      };
    } catch (error) {
      healthCheck.backups.error = error.message;
    }

    // 4. Verificar sistema de protección
    try {
      const systemCheck = await fullSystemCheck();
      healthCheck.protection = {
        dataLossDetected: systemCheck.lossDetection.hasLoss,
        criticalLoss: systemCheck.lossDetection.criticalLoss,
        mongoConnected: systemCheck.mongoConnected,
        backupsAvailable: systemCheck.backupsCount
      };
    } catch (error) {
      healthCheck.protection = { error: error.message };
    }

    res.json(healthCheck);
  } catch (error) {
    console.error('Error en health check:', error);
    res.status(500).json({ error: 'Error al verificar estado del sistema' });
  }
});

// Verificar terceros/suppliers específicamente
router.get('/suppliers-check', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const Supplier = require('../models/Supplier');

    // Obtener todos los suppliers sin filtrar por compañía
    const allSuppliers = await Supplier.find({})
      .select('legal_name identification_number company active')
      .populate('company', 'name')
      .lean();

    // Agrupar por compañía
    const byCompany = {};
    allSuppliers.forEach(supplier => {
      const companyId = supplier.company?._id?.toString() || 'sin_empresa';
      if (!byCompany[companyId]) {
        byCompany[companyId] = {
          companyName: supplier.company?.name || 'Sin Empresa',
          suppliers: []
        };
      }
      byCompany[companyId].suppliers.push({
        id: supplier._id,
        name: supplier.legal_name,
        identification: supplier.identification_number,
        active: supplier.active
      });
    });

    res.json({
      timestamp: new Date().toISOString(),
      total: allSuppliers.length,
      active: allSuppliers.filter(s => s.active).length,
      inactive: allSuppliers.filter(s => !s.active).length,
      byCompany,
      suppliers: allSuppliers.map(s => ({
        id: s._id,
        name: s.legal_name,
        identification: s.identification_number,
        company: s.company?.name || 'Sin Empresa',
        companyId: s.company?._id,
        active: s.active
      }))
    });
  } catch (error) {
    console.error('Error verificando suppliers:', error);
    res.status(500).json({ error: 'Error al verificar terceros' });
  }
});

// Verificar datos de usuario y permisos
router.get('/my-context', authenticate, async (req, res) => {
  try {
    const User = require('../models/User');
    const Company = require('../models/Company');

    const user = await User.findById(req.user.id)
      .select('name email role company_id')
      .populate('company_id', 'name')
      .lean();

    let company = null;
    if (req.companyId) {
      company = await Company.findById(req.companyId)
        .select('name')
        .lean();
    }

    res.json({
      timestamp: new Date().toISOString(),
      user: {
        id: req.user.id,
        name: user?.name,
        email: user?.email,
        role: req.user.role
      },
      context: {
        companyId: req.companyId,
        companyName: company?.name,
        userCompanyId: user?.company_id?._id,
        userCompanyName: user?.company_id?.name
      },
      headers: {
        hasCompanyIdHeader: !!req.headers['x-company-id'],
        companyIdHeader: req.headers['x-company-id']
      }
    });
  } catch (error) {
    console.error('Error obteniendo contexto:', error);
    res.status(500).json({ error: 'Error al obtener contexto' });
  }
});

// Ejecutar verificación completa del sistema
router.get('/full-system-check', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const systemCheck = await fullSystemCheck();
    res.json({
      timestamp: new Date().toISOString(),
      ...systemCheck
    });
  } catch (error) {
    console.error('Error en full system check:', error);
    res.status(500).json({ error: 'Error al verificar sistema' });
  }
});

// Listar backups disponibles
router.get('/backups', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({
      timestamp: new Date().toISOString(),
      total: backups.length,
      backups: backups.map(b => ({
        filename: b.filename,
        timestamp: b.timestamp || b.created,
        type: b.type,
        stats: b.stats,
        size: b.size,
        sizeMB: (b.size / 1024 / 1024).toFixed(2)
      }))
    });
  } catch (error) {
    console.error('Error listando backups:', error);
    res.status(500).json({ error: 'Error al listar backups' });
  }
});

module.exports = router;
