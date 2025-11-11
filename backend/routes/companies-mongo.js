const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Company = require('../models/Company');
const UserCompany = require('../models/UserCompany');

// Obtener empresas del usuario actual (para company switcher)
router.get('/my-companies', authenticate, async (req, res) => {
  try {
    let companies;

    // Si es super_admin, devolver TODAS las empresas
    if (req.user.role === 'super_admin') {
      const allCompanies = await Company.find({ active: true }).sort({ name: 1 });
      companies = allCompanies.map(company => ({
        companyId: company._id.toString(),
        companyName: company.name,
        roles: ['super_admin']
      }));
    } else {
      // Para otros usuarios, consultar UserCompany
      const userCompanies = await UserCompany.find({
        user: req.user.id,
        isActive: true
      }).populate('company', 'name active');

      // Filtrar solo empresas activas y mapear
      companies = userCompanies
        .filter(uc => uc.company && uc.company.active)
        .map(uc => ({
          companyId: uc.company._id.toString(),
          companyName: uc.company.name,
          roles: [uc.role]
        }));
    }

    res.json(companies);
  } catch (error) {
    console.error('Error al obtener empresas del usuario:', error);
    res.status(500).json({ error: 'Error al obtener empresas del usuario' });
  }
});

// Obtener todas las empresas (admin y super_admin)
router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const companies = await Company.find({ active: true }).sort({ name: 1 });
    res.json(companies);
  } catch (error) {
    console.error('Error al obtener empresas:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// Obtener una empresa
router.get('/:id', authenticate, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json(company);
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

// Crear empresa (solo admin)
router.post('/',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('tax_id').notEmpty().withMessage('El NIT es requerido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, tax_id, email, address, phone } = req.body;

      const company = await Company.create({
        name,
        tax_id,
        email,
        address,
        phone
      });

      res.status(201).json({
        message: 'Empresa creada exitosamente',
        id: company._id
      });
    } catch (error) {
      console.error('Error al crear empresa:', error);
      if (error.code === 11000) {
        res.status(400).json({ error: 'El NIT ya está registrado' });
      } else {
        res.status(500).json({ error: 'Error al crear empresa' });
      }
    }
  }
);

// Actualizar empresa (solo admin)
router.put('/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { name, tax_id, email, address, phone } = req.body;

      await Company.findByIdAndUpdate(req.params.id, {
        name,
        tax_id,
        email,
        address,
        phone
      });

      res.json({ message: 'Empresa actualizada exitosamente' });
    } catch (error) {
      console.error('Error al actualizar empresa:', error);
      res.status(500).json({ error: 'Error al actualizar empresa' });
    }
  }
);

// Desactivar empresa (solo admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Company.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ message: 'Empresa desactivada exitosamente' });
  } catch (error) {
    console.error('Error al desactivar empresa:', error);
    res.status(500).json({ error: 'Error al desactivar empresa' });
  }
});

module.exports = router;

