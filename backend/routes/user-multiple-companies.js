const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const UserCompany = require('../models/UserCompany');
const { body, validationResult } = require('express-validator');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

// Obtener todas las empresas disponibles
router.get('/companies', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const companies = await Company.find({ active: true }).select('name tax_id email phone address');
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// Obtener todos los usuarios con sus empresas múltiples
router.get('/users', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    // Solo traer usuarios activos (excluir los eliminados con soft delete)
    const users = await User.find({ active: { $ne: false } })
      .select('email name role active createdAt');
    
    // Para cada usuario, obtener sus empresas
    const usersWithCompanies = await Promise.all(
      users.map(async (user) => {
        const userCompanies = await UserCompany.find({ user: user._id, isActive: true })
          .populate('company', 'name tax_id')
          .select('company role permissions isActive assignedAt');
        
        return {
          ...user.toObject(),
          companies: userCompanies
        };
      })
    );
    
    res.json(usersWithCompanies);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Asignar usuario a una empresa
router.post('/assign-user-company',
  [
    body('userId').notEmpty().withMessage('ID de usuario requerido'),
    body('companyId').notEmpty().withMessage('ID de empresa requerido'),
    body('role').optional().isIn(['super_admin', 'admin', 'lawyer', 'requester', 'talento_humano', 'colaboradores']).withMessage('Rol inválido'),
    body('permissions').optional().isObject().withMessage('Permisos deben ser un objeto')
  ],
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, companyId, role = 'requester', permissions = {} } = req.body;

      // Verificar que el usuario existe
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Verificar que la empresa existe
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }

      // Verificar si ya existe la relación
      const existingRelation = await UserCompany.findOne({ user: userId, company: companyId });
      if (existingRelation) {
        if (existingRelation.isActive) {
          return res.status(400).json({ error: 'El usuario ya está asignado a esta empresa' });
        } else {
          // Reactivar la relación existente
          existingRelation.isActive = true;
          existingRelation.role = role;
          existingRelation.permissions = {
            canView: permissions.canView !== undefined ? permissions.canView : true,
            canEdit: permissions.canEdit !== undefined ? permissions.canEdit : false,
            canDelete: permissions.canDelete !== undefined ? permissions.canDelete : false,
            canManageUsers: permissions.canManageUsers !== undefined ? permissions.canManageUsers : false
          };
          existingRelation.assignedBy = req.user.id;
          existingRelation.assignedAt = new Date();
          await existingRelation.save();
        }
      } else {
        // Crear nueva relación
        await UserCompany.create({
          user: userId,
          company: companyId,
          role,
          permissions: {
            canView: permissions.canView !== undefined ? permissions.canView : true,
            canEdit: permissions.canEdit !== undefined ? permissions.canEdit : false,
            canDelete: permissions.canDelete !== undefined ? permissions.canDelete : false,
            canManageUsers: permissions.canManageUsers !== undefined ? permissions.canManageUsers : false
          },
          assignedBy: req.user.id
        });
      }

      // Obtener la relación actualizada
      const userCompany = await UserCompany.findOne({ user: userId, company: companyId })
        .populate('company', 'name tax_id');

      res.json({
        message: 'Usuario asignado a empresa exitosamente',
        userCompany: {
          id: userCompany._id,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          company: userCompany.company,
          role: userCompany.role,
          permissions: userCompany.permissions,
          isActive: userCompany.isActive
        }
      });
    } catch (error) {
      console.error('Error assigning user to company:', error);
      res.status(500).json({ error: 'Error al asignar usuario a empresa' });
    }
  }
);

// Remover usuario de una empresa
router.post('/remove-user-company',
  [
    body('userId').notEmpty().withMessage('ID de usuario requerido'),
    body('companyId').notEmpty().withMessage('ID de empresa requerido')
  ],
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, companyId } = req.body;

      // Verificar que el usuario existe
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Verificar que la empresa existe
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }

      // Desactivar la relación
      const userCompany = await UserCompany.findOne({ user: userId, company: companyId });
      if (!userCompany) {
        return res.status(404).json({ error: 'Relación usuario-empresa no encontrada' });
      }

      userCompany.isActive = false;
      await userCompany.save();

      res.json({
        message: 'Usuario removido de empresa exitosamente',
        userCompany: {
          id: userCompany._id,
          user: {
            id: user._id,
            email: user.email,
            name: user.name
          },
          company: {
            id: company._id,
            name: company.name,
            tax_id: company.tax_id
          },
          isActive: false
        }
      });
    } catch (error) {
      console.error('Error removing user from company:', error);
      res.status(500).json({ error: 'Error al remover usuario de empresa' });
    }
  }
);

// Actualizar permisos de usuario en una empresa
router.put('/update-user-company-permissions',
  [
    body('userId').notEmpty().withMessage('ID de usuario requerido'),
    body('companyId').notEmpty().withMessage('ID de empresa requerido'),
    body('role').optional().isIn(['super_admin', 'admin', 'lawyer', 'requester', 'talento_humano', 'colaboradores']).withMessage('Rol inválido'),
    body('permissions').isObject().withMessage('Permisos deben ser un objeto')
  ],
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, companyId, role, permissions } = req.body;

      const userCompany = await UserCompany.findOne({ user: userId, company: companyId, isActive: true });
      if (!userCompany) {
        return res.status(404).json({ error: 'Relación usuario-empresa no encontrada' });
      }

      if (role) userCompany.role = role;
      userCompany.permissions = {
        canView: permissions.canView !== undefined ? permissions.canView : userCompany.permissions.canView,
        canEdit: permissions.canEdit !== undefined ? permissions.canEdit : userCompany.permissions.canEdit,
        canDelete: permissions.canDelete !== undefined ? permissions.canDelete : userCompany.permissions.canDelete,
        canManageUsers: permissions.canManageUsers !== undefined ? permissions.canManageUsers : userCompany.permissions.canManageUsers
      };

      await userCompany.save();

      const updatedUserCompany = await UserCompany.findById(userCompany._id)
        .populate('user', 'email name role')
        .populate('company', 'name tax_id');

      res.json({
        message: 'Permisos actualizados exitosamente',
        userCompany: updatedUserCompany
      });
    } catch (error) {
      console.error('Error updating user company permissions:', error);
      res.status(500).json({ error: 'Error al actualizar permisos' });
    }
  }
);

// Obtener empresas de un usuario específico
router.get('/user/:userId/companies', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userCompanies = await UserCompany.find({ user: userId, isActive: true })
      .populate('company', 'name tax_id email phone address')
      .select('company role permissions isActive assignedAt');

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      companies: userCompanies
    });
  } catch (error) {
    console.error('Error fetching user companies:', error);
    res.status(500).json({ error: 'Error al obtener empresas del usuario' });
  }
});

// Editar información de un usuario
router.put('/edit-user/:userId',
  [
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('role').optional().isIn(['super_admin', 'admin', 'lawyer', 'requester', 'talento_humano', 'colaboradores']).withMessage('Rol inválido')
  ],
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { name, email, role } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Verificar si el email ya existe (si se está cambiando)
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ error: 'El email ya está registrado' });
        }
      }

      // Actualizar campos
      if (name) user.name = name;
      if (email) user.email = email;
      if (role) user.role = role;

      await user.save();

      res.json({
        message: 'Usuario actualizado exitosamente',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active
        }
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  }
);

// Desactivar/activar usuario
router.patch('/toggle-user-status/:userId',
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Toggle del estado activo
      user.active = !user.active;
      await user.save();

      res.json({
        message: `Usuario ${user.active ? 'activado' : 'desactivado'} exitosamente`,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active
        }
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      res.status(500).json({ error: 'Error al cambiar estado del usuario' });
    }
  }
);

// Eliminar usuario (soft delete - solo desactiva)
router.delete('/delete-user/:userId',
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Prevenir que el super admin se elimine a sí mismo
      if (userId === req.user.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
      }

      // Desactivar todas las relaciones UserCompany
      await UserCompany.updateMany(
        { user: userId },
        { isActive: false }
      );

      // Desactivar usuario
      user.active = false;
      await user.save();

      res.json({
        message: 'Usuario eliminado exitosamente',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          active: user.active
        }
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Error al eliminar usuario' });
    }
  }
);

module.exports = router;

