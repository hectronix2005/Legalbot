const express = require('express');
const router = express.Router();
const { authenticate, authorize, requireSuperAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const CompanyUser = require('../models/CompanyUser');
const Company = require('../models/Company');
const User = require('../models/User');

// Obtener todas las empresas
router.get('/companies', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const companies = await Company.find({ active: true })
      .sort({ name: 1 });

    res.json(companies);
  } catch (error) {
    console.error('Error al obtener empresas:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// Obtener todos los usuarios
router.get('/users', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const users = await User.find({ active: true })
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Obtener todas las relaciones empresa-usuario
router.get('/relations', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const relations = await CompanyUser.find({ isActive: true })
      .populate('company', 'name tax_id email phone address')
      .populate('user', 'name email role')
      .populate('assignedBy', 'name email')
      .sort({ 'company.name': 1, 'user.name': 1 });

    res.json(relations);
  } catch (error) {
    console.error('Error al obtener relaciones:', error);
    res.status(500).json({ error: 'Error al obtener relaciones' });
  }
});

// Asignar usuario a empresa
router.post('/assign', 
  authenticate, 
  requireSuperAdmin,
  [
    body('companyId').notEmpty().withMessage('El ID de la empresa es requerido'),
    body('userId').notEmpty().withMessage('El ID del usuario es requerido'),
    body('role').isIn(['admin', 'lawyer', 'requester']).withMessage('Rol inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { companyId, userId, role, permissions } = req.body;

      // Verificar que la empresa existe
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }

      // Verificar que el usuario existe
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Verificar que no existe ya la relación
      const existingRelation = await CompanyUser.findOne({ company: companyId, user: userId });
      if (existingRelation) {
        return res.status(400).json({ error: 'El usuario ya está asignado a esta empresa' });
      }

      // Crear la relación
      const companyUser = await CompanyUser.create({
        company: companyId,
        user: userId,
        role,
        permissions: permissions || {
          canView: true,
          canEdit: role === 'admin' || role === 'lawyer',
          canDelete: role === 'admin',
          canManageUsers: role === 'admin',
          canManageContracts: role === 'admin' || role === 'lawyer',
          canManageTemplates: role === 'admin' || role === 'lawyer'
        },
        assignedBy: req.user.id
      });

      res.status(201).json({ 
        message: 'Usuario asignado exitosamente',
        id: companyUser._id 
      });
    } catch (error) {
      console.error('Error al asignar usuario:', error);
      res.status(500).json({ error: 'Error al asignar usuario' });
    }
  }
);

// Actualizar permisos de usuario en empresa
router.put('/update-permissions/:id',
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role, permissions } = req.body;

      const companyUser = await CompanyUser.findById(id);
      if (!companyUser) {
        return res.status(404).json({ error: 'Relación no encontrada' });
      }

      companyUser.role = role || companyUser.role;
      companyUser.permissions = { ...companyUser.permissions, ...permissions };
      await companyUser.save();

      res.json({ message: 'Permisos actualizados exitosamente' });
    } catch (error) {
      console.error('Error al actualizar permisos:', error);
      res.status(500).json({ error: 'Error al actualizar permisos' });
    }
  }
);

// Remover usuario de empresa
router.delete('/remove/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const companyUser = await CompanyUser.findById(id);
    if (!companyUser) {
      return res.status(404).json({ error: 'Relación no encontrada' });
    }

    await CompanyUser.findByIdAndDelete(id);

    res.json({ message: 'Usuario removido de la empresa exitosamente' });
  } catch (error) {
    console.error('Error al remover usuario:', error);
    res.status(500).json({ error: 'Error al remover usuario' });
  }
});

// Obtener usuarios de una empresa específica
router.get('/company/:companyId/users', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Verificar que el usuario tiene acceso a esta empresa
    if (req.user.role !== 'super_admin') {
      const hasAccess = await CompanyUser.findOne({
        company: companyId,
        user: req.user.id,
        isActive: true
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'No tienes acceso a esta empresa' });
      }
    }

    const companyUsers = await CompanyUser.find({ company: companyId, isActive: true })
      .populate('user', 'name email role')
      .populate('assignedBy', 'name email')
      .sort({ role: 1, 'user.name': 1 });

    res.json(companyUsers);
  } catch (error) {
    console.error('Error al obtener usuarios de la empresa:', error);
    res.status(500).json({ error: 'Error al obtener usuarios de la empresa' });
  }
});

// Obtener empresas de un usuario específico
router.get('/user/:userId/companies', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar que el usuario puede ver esta información
    if (req.user.role !== 'super_admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'No tienes permisos para ver esta información' });
    }

    const userCompanies = await CompanyUser.find({ user: userId, isActive: true })
      .populate('company', 'name tax_id email phone address')
      .populate('assignedBy', 'name email')
      .sort({ 'company.name': 1 });

    res.json(userCompanies);
  } catch (error) {
    console.error('Error al obtener empresas del usuario:', error);
    res.status(500).json({ error: 'Error al obtener empresas del usuario' });
  }
});

module.exports = router;
