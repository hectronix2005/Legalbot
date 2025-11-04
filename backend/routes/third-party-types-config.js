const express = require('express');
const router = express.Router();
const { authenticate, authorize, requireSuperAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');
const { IDENTIFICATION_TYPES, IDENTIFICATION_TYPES_PERSON } = require('../config/thirdPartyTypes');
const { analyzeTemplateVariables, applyRecommendations } = require('../services/thirdPartyFieldSuggester');

// Obtener todos los tipos de terceros configurados
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = { active: true };

    // Super admin ve todos, otros usuarios ven solo los de su empresa o globales
    if (req.user.role !== 'super_admin' && req.companyId) {
      filter.$or = [
        { company: req.companyId },
        { company: null } // Tipos globales
      ];
    }

    console.log('🔍 [DEBUG /third-party-types] Fetching types with filter:', JSON.stringify(filter));
    console.log('🔍 [DEBUG /third-party-types] User role:', req.user.role, 'CompanyId:', req.companyId);

    const types = await ThirdPartyTypeConfig.find(filter)
      .populate('created_by', 'name email')
      .populate('company', 'name')
      .sort({ code: 1 });

    console.log('✅ [DEBUG /third-party-types] Types found:', types.length);
    console.log('📋 [DEBUG /third-party-types] Type codes:', types.map(t => t.code).join(', '));

    res.json(types);
  } catch (error) {
    console.error('Error al obtener tipos de terceros:', error);
    res.status(500).json({ error: 'Error al obtener tipos de terceros' });
  }
});

// Obtener un tipo de tercero específico
router.get('/:id', authenticate, async (req, res) => {
  try {
    const type = await ThirdPartyTypeConfig.findById(req.params.id)
      .populate('created_by', 'name email')
      .populate('company', 'name');

    if (!type) {
      return res.status(404).json({ error: 'Tipo de tercero no encontrado' });
    }

    // Verificar permisos
    if (req.user.role !== 'super_admin') {
      if (type.company && type.company._id.toString() !== req.companyId) {
        return res.status(403).json({ error: 'No tienes permiso para ver este tipo' });
      }
    }

    res.json(type);
  } catch (error) {
    console.error('Error al obtener tipo de tercero:', error);
    res.status(500).json({ error: 'Error al obtener tipo de tercero' });
  }
});

// Crear nuevo tipo de tercero
router.post('/',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('code').notEmpty().withMessage('El código es requerido'),
    body('label').notEmpty().withMessage('El nombre es requerido'),
    body('fields').isArray().withMessage('Los campos deben ser un array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { code, label, description, icon, fields, is_system, company } = req.body;

      // Verificar si ya existe
      const existing = await ThirdPartyTypeConfig.findOne({
        code: code.toLowerCase(),
        company: company || null
      });

      if (existing) {
        return res.status(400).json({ error: 'Ya existe un tipo con ese código' });
      }

      // Solo super admin puede crear tipos del sistema o globales
      if ((is_system || !company) && req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Solo el super admin puede crear tipos del sistema o globales'
        });
      }

      const typeData = {
        code: code.toLowerCase().trim(),
        label,
        description: description || '',
        icon: icon || '📄',
        fields: fields || [],
        is_system: is_system || false,
        company: company || null,
        created_by: req.user.id
      };

      const newType = await ThirdPartyTypeConfig.create(typeData);

      res.status(201).json({
        message: 'Tipo de tercero creado exitosamente',
        type: newType
      });
    } catch (error) {
      console.error('Error al crear tipo de tercero:', error);
      res.status(500).json({ error: 'Error al crear tipo de tercero' });
    }
  }
);

// Actualizar tipo de tercero
router.put('/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const type = await ThirdPartyTypeConfig.findById(req.params.id);

      if (!type) {
        return res.status(404).json({ error: 'Tipo de tercero no encontrado' });
      }

      // Verificar permisos
      if (type.is_system && req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Solo el super admin puede modificar tipos del sistema'
        });
      }

      if (req.user.role !== 'super_admin') {
        if (type.company && type.company.toString() !== req.companyId) {
          return res.status(403).json({ error: 'No tienes permiso para modificar este tipo' });
        }
      }

      const { label, description, icon, fields, active } = req.body;

      // Actualizar campos
      if (label) type.label = label;
      if (description !== undefined) type.description = description;
      if (icon) type.icon = icon;
      if (fields) type.fields = fields;
      if (active !== undefined) type.active = active;
      type.updated_by = req.user.id;

      await type.save();

      res.json({
        message: 'Tipo de tercero actualizado exitosamente',
        type
      });
    } catch (error) {
      console.error('Error al actualizar tipo de tercero:', error);
      res.status(500).json({ error: 'Error al actualizar tipo de tercero' });
    }
  }
);

// Eliminar tipo de tercero (solo si no es del sistema)
router.delete('/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const type = await ThirdPartyTypeConfig.findById(req.params.id);

      if (!type) {
        return res.status(404).json({ error: 'Tipo de tercero no encontrado' });
      }

      if (type.is_system) {
        return res.status(403).json({
          error: 'No se pueden eliminar tipos del sistema'
        });
      }

      // Verificar permisos
      if (req.user.role !== 'super_admin') {
        if (type.company && type.company.toString() !== req.companyId) {
          return res.status(403).json({ error: 'No tienes permiso para eliminar este tipo' });
        }
      }

      await type.deleteOne();

      res.json({ message: 'Tipo de tercero eliminado exitosamente' });
    } catch (error) {
      console.error('Error al eliminar tipo de tercero:', error);
      res.status(500).json({ error: 'Error al eliminar tipo de tercero' });
    }
  }
);

// Obtener listas de opciones para configuración
router.get('/config/field-options', authenticate, (req, res) => {
  res.json({
    field_types: [
      { value: 'text', label: 'Texto' },
      { value: 'number', label: 'Número' },
      { value: 'date', label: 'Fecha' },
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Teléfono' },
      { value: 'textarea', label: 'Área de texto' },
      { value: 'select', label: 'Selección' },
      { value: 'checkbox', label: 'Casilla de verificación' }
    ],
    identification_types: IDENTIFICATION_TYPES,
    identification_types_person: IDENTIFICATION_TYPES_PERSON
  });
});

// Analizar variables de plantilla y sugerir configuración de campos
router.post('/suggest-from-template',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { fields, third_party_type } = req.body;

      if (!fields || !Array.isArray(fields)) {
        return res.status(400).json({ error: 'Se requiere un array de campos (fields)' });
      }

      if (!third_party_type) {
        return res.status(400).json({ error: 'Se requiere el tipo de tercero (third_party_type)' });
      }

      console.log(`🔍 Analizando ${fields.length} variables para tipo: ${third_party_type}`);

      // Analizar variables y obtener sugerencias
      const analysis = analyzeTemplateVariables(fields);

      // Aplicar recomendaciones basadas en el tipo de tercero
      const suggestedWithRecommendations = applyRecommendations(
        analysis.suggested,
        third_party_type
      );

      res.json({
        success: true,
        suggested: suggestedWithRecommendations,
        categories: analysis.categories,
        stats: analysis.stats,
        third_party_type
      });
    } catch (error) {
      console.error('Error al analizar variables:', error);
      res.status(500).json({ error: 'Error al analizar variables de plantilla' });
    }
  }
);

// Actualizar configuración de tipo de tercero con campos sugeridos
router.put('/:typeId/apply-suggested-fields',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { typeId } = req.params;
      const { fields } = req.body;

      if (!fields || !Array.isArray(fields)) {
        return res.status(400).json({ error: 'Se requiere un array de campos' });
      }

      // Buscar tipo de tercero
      const thirdPartyType = await ThirdPartyTypeConfig.findById(typeId);

      if (!thirdPartyType) {
        return res.status(404).json({ error: 'Tipo de tercero no encontrado' });
      }

      // Verificar permisos
      if (thirdPartyType.is_system && req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Solo el super administrador puede modificar tipos del sistema'
        });
      }

      if (thirdPartyType.company && thirdPartyType.company.toString() !== req.companyId?.toString()) {
        return res.status(403).json({
          error: 'No tienes permisos para modificar este tipo de tercero'
        });
      }

      console.log(`📝 Actualizando tipo de tercero: ${thirdPartyType.label}`);

      // Filtrar campos excluidos
      const includedFields = fields.filter(f => !f.excluded);

      // Preparar campos para guardar
      const fieldsToSave = includedFields.map((field, index) => ({
        name: field.name,
        label: field.label,
        field_type: field.field_type,
        required: field.required || false,
        display_order: field.display_order !== undefined ? field.display_order : index,
        options: field.options || []
      }));

      // Actualizar campos del tipo de tercero
      thirdPartyType.fields = fieldsToSave;
      await thirdPartyType.save();

      console.log(`✅ Tipo de tercero actualizado con ${fieldsToSave.length} campos`);

      res.json({
        success: true,
        message: 'Configuración de tipo de tercero actualizada exitosamente',
        thirdPartyType,
        fieldsAdded: fieldsToSave.length,
        fieldsExcluded: fields.length - fieldsToSave.length
      });
    } catch (error) {
      console.error('Error al actualizar tipo de tercero:', error);
      res.status(500).json({ error: 'Error al actualizar configuración' });
    }
  }
);

module.exports = router;
