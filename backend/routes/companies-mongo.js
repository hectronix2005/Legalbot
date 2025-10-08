const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Company = require('../models/Company');

// Obtener todas las empresas (solo admin)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
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
    body('tax_id').notEmpty().withMessage('El RUC/NIT es requerido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, tax_id, address, phone } = req.body;

      const company = await Company.create({
        name,
        tax_id,
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
        res.status(400).json({ error: 'El RUC/NIT ya está registrado' });
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
      const { name, tax_id, address, phone } = req.body;

      await Company.findByIdAndUpdate(req.params.id, {
        name,
        tax_id,
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

