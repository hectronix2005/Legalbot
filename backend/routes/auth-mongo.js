const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Company = require('../models/Company');
const UserCompany = require('../models/UserCompany');
const { authenticate } = require('../middleware/auth');

// Registro de usuario
router.post('/register',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('role').isIn(['super_admin', 'admin', 'lawyer', 'requester']).withMessage('Rol inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, role, company_id } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'El email ya está registrado' });
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const user = await User.create({
        email,
        password: hashedPassword,
        name,
        role,
        company: company_id || null
      });

      res.status(201).json({ 
        message: 'Usuario creado exitosamente',
        userId: user._id 
      });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  }
);

// Login
router.post('/login',
  [
    body('email').isEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Buscar usuario
      const user = await User.findOne({ email, active: true });

      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Obtener empresas y roles del usuario (multi-tenant)
      const userCompanies = await UserCompany.find({
        user: user._id,
        isActive: true
      }).populate('company', 'name tax_id');

      // Formatear companyRoles para el frontend
      const companyRoles = {};
      for (const uc of userCompanies) {
        if (uc.company) {
          companyRoles[uc.company._id.toString()] = {
            name: uc.company.name,
            roles: [uc.role] // Cada UserCompany tiene un solo rol, pero lo ponemos en array
          };
        }
      }

      // Generar token JWT
      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          role: user.role,
          company_id: null
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          company_id: null,
          companyRoles: Object.keys(companyRoles).length > 0 ? companyRoles : undefined
        }
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error al iniciar sesión' });
    }
  }
);

// Endpoint /me para obtener usuario actual
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener empresas y roles del usuario (multi-tenant)
    const userCompanies = await UserCompany.find({
      user: user._id,
      isActive: true
    }).populate('company', 'name tax_id');

    // Formatear companyRoles para el frontend
    const companyRoles = {};
    for (const uc of userCompanies) {
      if (uc.company) {
        companyRoles[uc.company._id.toString()] = {
          name: uc.company.name,
          roles: [uc.role]
        };
      }
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: null,
        companyRoles: Object.keys(companyRoles).length > 0 ? companyRoles : undefined
      }
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

module.exports = router;

