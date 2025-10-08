const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Obtener todas las empresas (solo admin)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const companies = await db.all('SELECT * FROM companies WHERE active = 1 ORDER BY name');
    res.json(companies);
  } catch (error) {
    console.error('Error al obtener empresas:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// Obtener una empresa
router.get('/:id', authenticate, async (req, res) => {
  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    
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

      const result = await db.run(
        'INSERT INTO companies (name, tax_id, address, phone) VALUES (?, ?, ?, ?)',
        [name, tax_id, address, phone]
      );

      res.status(201).json({ 
        message: 'Empresa creada exitosamente',
        id: result.id 
      });
    } catch (error) {
      console.error('Error al crear empresa:', error);
      if (error.message.includes('UNIQUE')) {
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

      await db.run(
        'UPDATE companies SET name = ?, tax_id = ?, address = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, tax_id, address, phone, req.params.id]
      );

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
    await db.run('UPDATE companies SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Empresa desactivada exitosamente' });
  } catch (error) {
    console.error('Error al desactivar empresa:', error);
    res.status(500).json({ error: 'Error al desactivar empresa' });
  }
});

module.exports = router;

