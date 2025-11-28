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
    // Obtener companyId del header manualmente (ya que no usamos verifyTenant aquí)
    const companyId = req.headers['x-company-id'];

    const filter = { active: true };

    // Super admin ve todos, otros usuarios ven solo los de su empresa o genéricos
    if (req.user.role !== 'super_admin' && companyId) {
      filter.$or = [
        { isGeneric: true }, // Tipos genéricos (aplican a todas las empresas)
        { companies: companyId }, // Tipos específicos de su empresa
        { company: companyId }, // DEPRECATED: Compatibilidad con versión anterior
        { company: null } // DEPRECATED: Compatibilidad con versión anterior
      ];
    }

    console.log('🔍 [DEBUG /third-party-types] Fetching types with filter:', JSON.stringify(filter));
    console.log('🔍 [DEBUG /third-party-types] User role:', req.user.role, 'CompanyId:', companyId);

    const types = await ThirdPartyTypeConfig.find(filter)
      .populate('created_by', 'name email')
      .populate('company', 'name')
      .populate('companies', 'name')
      .sort({ code: 1 });

    console.log('✅ [DEBUG /third-party-types] Types found:', types.length);
    console.log('📋 [DEBUG /third-party-types] Type codes:', types.map(t => t.code).join(', '));

    res.json(types);
  } catch (error) {
    console.error('❌ Error al obtener tipos de terceros:', error);
    res.status(500).json({ error: 'Error al obtener tipos de terceros', details: error.message });
  }
});

// Obtener un tipo de tercero específico
router.get('/:id', authenticate, async (req, res) => {
  try {
    const type = await ThirdPartyTypeConfig.findById(req.params.id)
      .populate('created_by', 'name email')
      .populate('company', 'name')
      .populate('companies', 'name');

    if (!type) {
      return res.status(404).json({ error: 'Tipo de tercero no encontrado' });
    }

    // Verificar permisos
    if (req.user.role !== 'super_admin') {
      // Si es genérico, todos pueden verlo
      if (type.isGeneric) {
        return res.json(type);
      }

      // Si tiene empresas específicas, verificar si el usuario pertenece a una de ellas
      const userCompanyId = req.companyId?.toString();
      const hasAccess = type.companies.some(c => c._id.toString() === userCompanyId) ||
                       (type.company && type.company._id.toString() === userCompanyId); // Compatibilidad

      if (!hasAccess) {
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
  authorize('admin', 'super_admin', 'lawyer'),
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

      const {
        code, label, description, icon, fields, default_identification_types,
        is_system, isGeneric, companies, company
      } = req.body;

      console.log('📝 [POST /third-party-types] Creating type with data:', {
        code, label, isGeneric, companies: companies?.length,
        default_identification_types: default_identification_types?.length
      });

      // Verificar si ya existe un tipo con el mismo código
      const existing = await ThirdPartyTypeConfig.findOne({
        code: code.toLowerCase()
      });

      if (existing) {
        return res.status(400).json({ error: 'Ya existe un tipo con ese código' });
      }

      // Solo super admin y admin pueden crear tipos genéricos
      if (isGeneric && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Solo Super Admin y Admin pueden crear tipos genéricos'
        });
      }

      // Solo super admin puede crear tipos del sistema
      if (is_system && req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Solo el super admin puede crear tipos del sistema'
        });
      }

      // Validar que si no es genérico, se proporcionen empresas
      if (!isGeneric && (!companies || companies.length === 0)) {
        return res.status(400).json({
          error: 'Debes seleccionar al menos una empresa o marcar el tipo como genérico'
        });
      }

      const typeData = {
        code: code.toLowerCase().trim(),
        label,
        description: description || '',
        icon: icon || '📄',
        fields: fields || [],
        default_identification_types: default_identification_types || [],
        is_system: is_system || false,
        isGeneric: isGeneric || false,
        companies: isGeneric ? [] : (companies || []),
        company: company || null, // Mantener por compatibilidad
        created_by: req.user.id
      };

      console.log('💾 [POST /third-party-types] Saving type:', typeData);

      const newType = await ThirdPartyTypeConfig.create(typeData);
      await newType.populate('companies', 'name');

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
  authorize('admin', 'super_admin', 'lawyer'),
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

      // Verificar permisos para tipos no genéricos
      if (req.user.role !== 'super_admin' && !type.isGeneric) {
        const userCompanyId = req.companyId?.toString();

        // Si el tipo no tiene empresas asignadas (legacy), permitir edición a admins
        const hasNoCompanies = (!type.companies || type.companies.length === 0) && !type.company;

        // Verificar si el usuario tiene acceso a este tipo
        const hasAccess = hasNoCompanies ||
                         type.companies.some(c => c.toString() === userCompanyId) ||
                         (type.company && type.company.toString() === userCompanyId);

        if (!hasAccess) {
          return res.status(403).json({ error: 'No tienes permiso para modificar este tipo' });
        }
      }

      const { label, description, icon, fields, default_identification_types, active, isGeneric, companies } = req.body;

      console.log('✏️ [PUT /third-party-types] Updating type with data:', {
        label, isGeneric, companies: companies?.length,
        default_identification_types: default_identification_types?.length
      });

      // Solo super admin y admin pueden modificar el flag isGeneric
      if (isGeneric !== undefined && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Solo Super Admin y Admin pueden modificar el tipo genérico'
        });
      }

      // Validar que si no es genérico, se proporcionen empresas
      const newIsGeneric = isGeneric !== undefined ? isGeneric : type.isGeneric;
      const newCompanies = companies !== undefined ? companies : type.companies;

      if (!newIsGeneric && (!newCompanies || newCompanies.length === 0)) {
        return res.status(400).json({
          error: 'Debes seleccionar al menos una empresa o marcar el tipo como genérico'
        });
      }

      // Actualizar campos
      if (label) type.label = label;
      if (description !== undefined) type.description = description;
      if (icon) type.icon = icon;
      if (fields) type.fields = fields;
      if (default_identification_types !== undefined) {
        type.default_identification_types = default_identification_types;
        console.log('💾 [PUT /third-party-types] Updated default_identification_types:', default_identification_types);
      }
      if (active !== undefined) type.active = active;
      if (isGeneric !== undefined) type.isGeneric = isGeneric;
      if (companies !== undefined) type.companies = isGeneric ? [] : companies;

      type.updated_by = req.user.id;

      await type.save();
      await type.populate('companies', 'name');

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
  authorize('admin', 'super_admin', 'lawyer'),
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

// Obtener lista de empresas (solo para Super Admin y Admin)
router.get('/config/companies', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const Company = require('../models/Company');
    const companies = await Company.find({ active: true })
      .select('_id name tax_id')
      .sort({ name: 1 });

    res.json(companies);
  } catch (error) {
    console.error('Error al obtener empresas:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
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
  authorize('admin', 'super_admin', 'lawyer'),
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

      // Verificar permisos para tipos no genéricos (consistente con PUT /:id)
      if (req.user.role !== 'super_admin' && !thirdPartyType.isGeneric) {
        const userCompanyId = req.companyId?.toString();

        // Si el tipo no tiene empresas asignadas (legacy), permitir edición a admins
        const hasNoCompanies = (!thirdPartyType.companies || thirdPartyType.companies.length === 0) && !thirdPartyType.company;

        // Verificar si el usuario tiene acceso a este tipo
        const hasAccess = hasNoCompanies ||
                         thirdPartyType.companies?.some(c => c.toString() === userCompanyId) ||
                         (thirdPartyType.company && thirdPartyType.company.toString() === userCompanyId);

        if (!hasAccess) {
          return res.status(403).json({
            error: 'No tienes permisos para modificar este tipo de tercero'
          });
        }
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
