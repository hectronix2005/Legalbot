const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const { body, validationResult } = require('express-validator');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

// Obtener todas las empresas
router.get('/companies', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const companies = await Company.find({}).select('name tax_id email phone address');
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// Obtener todos los usuarios con sus empresas
router.get('/users', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select('email name role active createdAt');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Asignar usuario a empresa
router.post('/assign-user-company',
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

      // Actualizar usuario con la empresa
      user.company = companyId;
      await user.save();

      res.json({
        message: 'Usuario asignado a empresa exitosamente',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: {
            id: company._id,
            name: company.name,
            tax_id: company.tax_id
          }
        }
      });
    } catch (error) {
      console.error('Error assigning user to company:', error);
      res.status(500).json({ error: 'Error al asignar usuario a empresa' });
    }
  }
);

// Remover usuario de empresa
router.post('/remove-user-company',
  [
    body('userId').notEmpty().withMessage('ID de usuario requerido')
  ],
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.body;

      // Verificar que el usuario existe
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Remover empresa del usuario
      user.company = null;
      await user.save();

      res.json({
        message: 'Usuario removido de empresa exitosamente',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: null
        }
      });
    } catch (error) {
      console.error('Error removing user from company:', error);
      res.status(500).json({ error: 'Error al remover usuario de empresa' });
    }
  }
);

// Crear nuevo usuario
router.post('/create-user',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('role').isIn(['admin', 'lawyer', 'requester']).withMessage('Rol inválido'),
    body('companyId').optional().isMongoId().withMessage('ID de empresa inválido')
  ],
  authenticate,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, role, companyId } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'El email ya está registrado' });
      }

      // Verificar empresa si se proporciona
      if (companyId) {
        const company = await Company.findById(companyId);
        if (!company) {
          return res.status(404).json({ error: 'Empresa no encontrada' });
        }
      }

      // Hash de la contraseña
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const user = await User.create({
        email,
        password: hashedPassword,
        name,
        role,
        company: companyId || null
      });

      // Poblar la empresa si existe
      if (companyId) {
        await user.populate('company', 'name tax_id');
      }

      res.status(201).json({
        message: 'Usuario creado exitosamente',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: user.company
        }
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  }
);

module.exports = router;
