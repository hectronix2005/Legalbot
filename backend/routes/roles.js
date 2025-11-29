const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

/**
 * GET /api/roles
 * Obtener todos los roles (sistema + personalizados)
 * Filtros opcionales: ?companyId=xxx&includeSystem=true&active=true
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { companyId, includeSystem = 'true', active = 'true' } = req.query;

    const filter = {};

    // Si es super_admin puede ver todos, sino solo los de su empresa
    if (req.user.role === 'super_admin') {
      if (companyId) {
        filter.$or = [
          { companyId: companyId },
          { companyId: null } // Roles globales
        ];
      }
    } else {
      // Usuario normal solo ve roles globales y de sus empresas
      filter.$or = [{ companyId: null }];
      if (companyId) {
        filter.$or.push({ companyId: companyId });
      }
    }

    // Incluir roles del sistema
    if (includeSystem === 'false') {
      filter.isSystemRole = false;
    }

    // Filtrar por activos
    if (active === 'true') {
      filter.active = true;
    }

    const roles = await Role.find(filter)
      .populate('companyId', 'name')
      .populate('createdBy', 'name email')
      .sort({ hierarchyLevel: -1, name: 1 });

    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Error al obtener roles' });
  }
});

/**
 * GET /api/roles/system
 * Obtener solo roles del sistema (para select de usuario)
 */
router.get('/system', authenticate, async (req, res) => {
  try {
    const roles = await Role.find({ isSystemRole: true, active: true })
      .select('name code description hierarchyLevel color icon')
      .sort({ hierarchyLevel: -1 });

    res.json(roles);
  } catch (error) {
    console.error('Error fetching system roles:', error);
    res.status(500).json({ error: 'Error al obtener roles del sistema' });
  }
});

/**
 * GET /api/roles/:id
 * Obtener un rol por ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate('companyId', 'name tax_id')
      .populate('createdBy', 'name email');

    if (!role) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    res.json(role);
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Error al obtener rol' });
  }
});

/**
 * POST /api/roles
 * Crear un nuevo rol personalizado
 */
router.post('/',
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('code').notEmpty().withMessage('El código es requerido')
      .matches(/^[a-z_]+$/).withMessage('El código solo puede contener letras minúsculas y guiones bajos'),
    body('description').optional(),
    body('hierarchyLevel').optional().isInt({ min: 0, max: 99 }).withMessage('El nivel debe estar entre 0 y 99'),
    body('permissions').optional().isObject().withMessage('Los permisos deben ser un objeto'),
    body('accessibleModules').optional().isArray().withMessage('Los módulos deben ser un array'),
    body('color').optional(),
    body('icon').optional(),
    body('companyId').optional()
  ],
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        code,
        description,
        hierarchyLevel = 20,
        permissions,
        accessibleModules,
        color,
        icon,
        companyId
      } = req.body;

      // Verificar que el código no exista para esa empresa
      const existingRole = await Role.findOne({
        code: code.toLowerCase(),
        companyId: companyId || null
      });

      if (existingRole) {
        return res.status(400).json({ error: 'Ya existe un rol con ese código' });
      }

      // No permitir nivel 100 (reservado para super_admin)
      if (hierarchyLevel >= 100) {
        return res.status(400).json({ error: 'El nivel de jerarquía no puede ser 100 o superior' });
      }

      const role = await Role.create({
        name,
        code: code.toLowerCase(),
        description,
        hierarchyLevel,
        permissions: permissions || {},
        accessibleModules: accessibleModules || ['dashboard'],
        color: color || '#6c757d',
        icon: icon || '👤',
        companyId: companyId || null,
        createdBy: req.user.id,
        isSystemRole: false
      });

      const populatedRole = await Role.findById(role._id)
        .populate('companyId', 'name')
        .populate('createdBy', 'name email');

      res.status(201).json({
        message: 'Rol creado exitosamente',
        role: populatedRole
      });
    } catch (error) {
      console.error('Error creating role:', error);
      res.status(500).json({ error: 'Error al crear rol' });
    }
  }
);

/**
 * PUT /api/roles/:id
 * Actualizar un rol existente
 */
router.put('/:id',
  [
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('description').optional(),
    body('hierarchyLevel').optional().isInt({ min: 0, max: 99 }).withMessage('El nivel debe estar entre 0 y 99'),
    body('permissions').optional().isObject().withMessage('Los permisos deben ser un objeto'),
    body('accessibleModules').optional().isArray().withMessage('Los módulos deben ser un array'),
    body('color').optional(),
    body('icon').optional()
  ],
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const role = await Role.findById(req.params.id);

      if (!role) {
        return res.status(404).json({ error: 'Rol no encontrado' });
      }

      // Para roles del sistema: Super Admin puede editar todo con force=true
      // Otros usuarios solo pueden editar descripción, color e icono
      if (role.isSystemRole) {
        const { force } = req.query;
        const isSuperAdmin = req.user.role === 'super_admin';

        // Si es Super Admin con force=true, permitir edición completa
        if (isSuperAdmin && force === 'true') {
          // Continuar con la edición normal (saltar este bloque)
        } else {
          // Comportamiento restringido: solo campos permitidos
          const { description, color, icon } = req.body;

          if (description !== undefined) role.description = description;
          if (color !== undefined) role.color = color;
          if (icon !== undefined) role.icon = icon;

          await role.save();

          const populatedRole = await Role.findById(role._id)
            .populate('companyId', 'name')
            .populate('createdBy', 'name email');

          return res.json({
            message: 'Rol del sistema actualizado (solo campos permitidos)',
            role: populatedRole
          });
        }
      }

      // Actualizar rol personalizado
      const {
        name,
        description,
        hierarchyLevel,
        permissions,
        accessibleModules,
        color,
        icon
      } = req.body;

      if (name) role.name = name;
      if (description !== undefined) role.description = description;
      if (hierarchyLevel !== undefined && hierarchyLevel < 100) role.hierarchyLevel = hierarchyLevel;
      if (permissions) role.permissions = { ...role.permissions, ...permissions };
      if (accessibleModules) role.accessibleModules = accessibleModules;
      if (color) role.color = color;
      if (icon) role.icon = icon;

      await role.save();

      const populatedRole = await Role.findById(role._id)
        .populate('companyId', 'name')
        .populate('createdBy', 'name email');

      res.json({
        message: 'Rol actualizado exitosamente',
        role: populatedRole
      });
    } catch (error) {
      console.error('Error updating role:', error);
      res.status(500).json({ error: 'Error al actualizar rol' });
    }
  }
);

/**
 * DELETE /api/roles/:id
 * Eliminar/desactivar un rol
 */
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    // Para roles del sistema: Super Admin puede eliminar con force=true
    if (role.isSystemRole) {
      const { force } = req.query;
      const isSuperAdmin = req.user.role === 'super_admin';

      if (!(isSuperAdmin && force === 'true')) {
        return res.status(400).json({ error: 'No se pueden eliminar roles del sistema. Use force=true si es Super Admin.' });
      }
      // Si es Super Admin con force=true, continuar con la eliminación
    }

    // Verificar si hay usuarios con este rol
    const usersWithRole = await User.countDocuments({ role: role.code });
    if (usersWithRole > 0) {
      return res.status(400).json({
        error: `No se puede eliminar el rol. Hay ${usersWithRole} usuario(s) asignados a este rol.`
      });
    }

    // Soft delete
    role.active = false;
    await role.save();

    res.json({
      message: 'Rol eliminado exitosamente',
      role: {
        id: role._id,
        name: role.name,
        code: role.code
      }
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Error al eliminar rol' });
  }
});

/**
 * POST /api/roles/initialize
 * Inicializar roles del sistema (solo desarrollo/setup)
 */
router.post('/initialize', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await Role.initializeSystemRoles();

    const roles = await Role.find({ isSystemRole: true })
      .select('name code hierarchyLevel')
      .sort({ hierarchyLevel: -1 });

    res.json({
      message: 'Roles del sistema inicializados',
      roles
    });
  } catch (error) {
    console.error('Error initializing roles:', error);
    res.status(500).json({ error: 'Error al inicializar roles' });
  }
});

/**
 * GET /api/roles/by-code/:code
 * Obtener rol por código
 */
router.get('/by-code/:code', authenticate, async (req, res) => {
  try {
    const { code } = req.params;
    const { companyId } = req.query;

    // Buscar primero en roles de la empresa, luego en globales
    let role = null;
    if (companyId) {
      role = await Role.findOne({ code, companyId, active: true });
    }
    if (!role) {
      role = await Role.findOne({ code, companyId: null, active: true });
    }

    if (!role) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    res.json(role);
  } catch (error) {
    console.error('Error fetching role by code:', error);
    res.status(500).json({ error: 'Error al obtener rol' });
  }
});

/**
 * GET /api/roles/permissions/:roleCode
 * Obtener permisos de un rol específico
 */
router.get('/permissions/:roleCode', authenticate, async (req, res) => {
  try {
    const { roleCode } = req.params;
    const { companyId } = req.query;

    // Buscar primero en roles de la empresa, luego en globales
    let role = null;
    if (companyId) {
      role = await Role.findOne({ code: roleCode, companyId, active: true });
    }
    if (!role) {
      role = await Role.findOne({ code: roleCode, companyId: null, active: true });
    }

    if (!role) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    res.json({
      code: role.code,
      name: role.name,
      hierarchyLevel: role.hierarchyLevel,
      permissions: role.permissions,
      accessibleModules: role.accessibleModules
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ error: 'Error al obtener permisos' });
  }
});

/**
 * POST /api/roles/duplicate/:id
 * Duplicar un rol existente
 */
router.post('/duplicate/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const sourceRole = await Role.findById(req.params.id);

    if (!sourceRole) {
      return res.status(404).json({ error: 'Rol origen no encontrado' });
    }

    const { name, code, companyId } = req.body;

    // Verificar que el nuevo código no exista
    const existingRole = await Role.findOne({
      code: code?.toLowerCase() || `${sourceRole.code}_copy`,
      companyId: companyId || null
    });

    if (existingRole) {
      return res.status(400).json({ error: 'Ya existe un rol con ese código' });
    }

    const newRole = await Role.create({
      name: name || `${sourceRole.name} (Copia)`,
      code: code?.toLowerCase() || `${sourceRole.code}_copy`,
      description: sourceRole.description,
      hierarchyLevel: Math.min(sourceRole.hierarchyLevel, 99), // No duplicar nivel 100
      permissions: sourceRole.permissions,
      accessibleModules: sourceRole.accessibleModules,
      color: sourceRole.color,
      icon: sourceRole.icon,
      companyId: companyId || null,
      createdBy: req.user.id,
      isSystemRole: false
    });

    const populatedRole = await Role.findById(newRole._id)
      .populate('companyId', 'name')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Rol duplicado exitosamente',
      role: populatedRole
    });
  } catch (error) {
    console.error('Error duplicating role:', error);
    res.status(500).json({ error: 'Error al duplicar rol' });
  }
});

module.exports = router;
