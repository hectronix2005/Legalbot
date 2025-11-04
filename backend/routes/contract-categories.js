const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorizeCompanyRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const ContractCategory = require('../models/ContractCategory');
const ActivityLog = require('../models/ActivityLog');

// Obtener todas las categorías de contratos activas (todos los usuarios autenticados)
router.get('/',
  authenticate,
  verifyTenant,
  async (req, res) => {
    try {
      const categories = await ContractCategory.find({
        company: req.companyId,
        active: true
      })
      .populate('template', 'name')
      .populate('created_by', 'name email')
      .sort({ name: 1 });

      res.json(categories);
    } catch (error) {
      console.error('Error al obtener categorías:', error);
      res.status(500).json({ error: 'Error al obtener categorías de contratos' });
    }
  }
);

// Obtener una categoría específica con su cuestionario
router.get('/:id',
  authenticate,
  verifyTenant,
  async (req, res) => {
    try {
      const category = await ContractCategory.findOne({
        _id: req.params.id,
        company: req.companyId
      })
      .populate('template', 'name description')
      .populate('created_by', 'name email');

      if (!category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      res.json(category);
    } catch (error) {
      console.error('Error al obtener categoría:', error);
      res.status(500).json({ error: 'Error al obtener categoría' });
    }
  }
);

// Crear una nueva categoría (solo admin)
router.post('/',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('admin'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('description').notEmpty().withMessage('La descripción es requerida'),
    body('questionnaire').isArray().withMessage('El cuestionario debe ser un array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        description,
        icon,
        color,
        questionnaire,
        template,
        requires_approval,
        auto_assign_lawyer
      } = req.body;

      // Verificar que no exista una categoría con el mismo nombre
      const existingCategory = await ContractCategory.findOne({
        company: req.companyId,
        name: name.trim()
      });

      if (existingCategory) {
        return res.status(400).json({ error: 'Ya existe una categoría con este nombre' });
      }

      // Crear la categoría
      const category = await ContractCategory.create({
        name: name.trim(),
        description: description.trim(),
        icon: icon || 'document',
        color: color || '#3B82F6',
        questionnaire: questionnaire || [],
        template,
        requires_approval: requires_approval !== false,
        auto_assign_lawyer: auto_assign_lawyer || false,
        company: req.companyId,
        created_by: req.user.id
      });

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'create',
        resource_type: 'ContractCategory',
        resource_id: category._id,
        description: `Creó la categoría de contrato: ${category.name}`,
        ip_address: req.ip
      });

      res.status(201).json({
        message: 'Categoría creada exitosamente',
        category
      });
    } catch (error) {
      console.error('Error al crear categoría:', error);
      res.status(500).json({ error: 'Error al crear categoría' });
    }
  }
);

// Actualizar una categoría (solo admin)
router.put('/:id',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('admin'),
  async (req, res) => {
    try {
      const {
        name,
        description,
        icon,
        color,
        questionnaire,
        template,
        requires_approval,
        auto_assign_lawyer,
        active
      } = req.body;

      const category = await ContractCategory.findOne({
        _id: req.params.id,
        company: req.companyId
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      // Actualizar campos
      if (name) category.name = name.trim();
      if (description) category.description = description.trim();
      if (icon) category.icon = icon;
      if (color) category.color = color;
      if (questionnaire !== undefined) category.questionnaire = questionnaire;
      if (template !== undefined) category.template = template;
      if (requires_approval !== undefined) category.requires_approval = requires_approval;
      if (auto_assign_lawyer !== undefined) category.auto_assign_lawyer = auto_assign_lawyer;
      if (active !== undefined) category.active = active;
      category.updated_by = req.user.id;

      await category.save();

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'update',
        resource_type: 'ContractCategory',
        resource_id: category._id,
        description: `Actualizó la categoría de contrato: ${category.name}`,
        ip_address: req.ip
      });

      res.json({
        message: 'Categoría actualizada exitosamente',
        category
      });
    } catch (error) {
      console.error('Error al actualizar categoría:', error);
      res.status(500).json({ error: 'Error al actualizar categoría' });
    }
  }
);

// Desactivar una categoría (solo admin)
router.delete('/:id',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('admin'),
  async (req, res) => {
    try {
      const category = await ContractCategory.findOne({
        _id: req.params.id,
        company: req.companyId
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      category.active = false;
      category.updated_by = req.user.id;
      await category.save();

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        company: req.companyId,
        action: 'delete',
        resource_type: 'ContractCategory',
        resource_id: category._id,
        description: `Desactivó la categoría de contrato: ${category.name}`,
        ip_address: req.ip
      });

      res.json({ message: 'Categoría desactivada exitosamente' });
    } catch (error) {
      console.error('Error al desactivar categoría:', error);
      res.status(500).json({ error: 'Error al desactivar categoría' });
    }
  }
);

// Validar respuestas de un cuestionario
router.post('/:id/validate-answers',
  authenticate,
  verifyTenant,
  async (req, res) => {
    try {
      const category = await ContractCategory.findOne({
        _id: req.params.id,
        company: req.companyId,
        active: true
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      const { answers } = req.body;
      const validation = category.validateAnswers(answers);

      res.json(validation);
    } catch (error) {
      console.error('Error al validar respuestas:', error);
      res.status(500).json({ error: 'Error al validar respuestas' });
    }
  }
);

module.exports = router;
