const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Obtener todos los usuarios (solo admin)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, company_id } = req.query;
    
    let query = `
      SELECT u.id, u.email, u.name, u.role, u.company_id, u.active, u.created_at,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.active = 1
    `;
    const params = [];

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (company_id) {
      query += ' AND u.company_id = ?';
      params.push(company_id);
    }

    query += ' ORDER BY u.created_at DESC';

    const users = await db.all(query, params);
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Obtener abogados disponibles
router.get('/lawyers', authenticate, async (req, res) => {
  try {
    const lawyers = await db.all(`
      SELECT id, name, email, company_id
      FROM users
      WHERE role = 'lawyer' AND active = 1
      ORDER BY name
    `);
    res.json(lawyers);
  } catch (error) {
    console.error('Error al obtener abogados:', error);
    res.status(500).json({ error: 'Error al obtener abogados' });
  }
});

// Obtener perfil del usuario actual
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db.get(`
      SELECT u.id, u.email, u.name, u.role, u.company_id, u.created_at,
             c.name as company_name, c.tax_id
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = ?
    `, [req.user.id]);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Actualizar usuario (solo admin)
router.put('/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { name, email, role, company_id } = req.body;

      await db.run(
        'UPDATE users SET name = ?, email = ?, role = ?, company_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, email, role, company_id, req.params.id]
      );

      res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  }
);

// Cambiar contraseña
router.patch('/me/password',
  authenticate,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Se requieren ambas contraseñas' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
      }

      // Verificar contraseña actual
      const user = await db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
      const validPassword = await bcrypt.compare(currentPassword, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }

      // Actualizar contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.run(
        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, req.user.id]
      );

      res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
  }
);

// Desactivar usuario (solo admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puede desactivar su propia cuenta' });
    }

    await db.run('UPDATE users SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario desactivado exitosamente' });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

module.exports = router;

