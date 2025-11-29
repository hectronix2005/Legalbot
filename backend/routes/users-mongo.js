const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Company = require('../models/Company');

// Obtener todos los usuarios (solo admin)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, company_id } = req.query;
    
    const filter = { active: true };
    if (role) filter.role = role;
    if (company_id) filter.company = company_id;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Obtener abogados
router.get('/lawyers', authenticate, async (req, res) => {
  try {
    const lawyers = await User.find({ role: 'lawyer', active: true })
      .select('name email company')
      .sort({ name: 1 });

    res.json(lawyers);
  } catch (error) {
    console.error('Error al obtener abogados:', error);
    res.status(500).json({ error: 'Error al obtener abogados' });
  }
});

// Obtener perfil
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('company', 'name tax_id')
      .select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Actualizar usuario
router.put('/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { name, email, role, company_id } = req.body;

      await User.findByIdAndUpdate(req.params.id, {
        name,
        email,
        role,
        company: company_id
      });

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

      const user = await User.findById(req.user.id);
      const validPassword = await bcrypt.compare(currentPassword, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await User.findByIdAndUpdate(req.user.id, { password: hashedPassword });

      res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
  }
);

// Reiniciar contraseña de un usuario (solo Admin/Super Admin)
router.post('/:id/reset-password',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ error: 'Se requiere la nueva contraseña' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Verificar jerarquía: solo super_admin puede resetear a otro super_admin
      if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'No tiene permisos para modificar este usuario' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });

      res.json({ message: 'Contraseña reiniciada exitosamente' });
    } catch (error) {
      console.error('Error al reiniciar contraseña:', error);
      res.status(500).json({ error: 'Error al reiniciar contraseña' });
    }
  }
);

// Desactivar usuario
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'No puede desactivar su propia cuenta' });
    }

    await User.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ message: 'Usuario desactivado exitosamente' });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

module.exports = router;

