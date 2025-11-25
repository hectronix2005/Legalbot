/**
 * API de Perfiles de Terceros por Plantilla
 *
 * Permite gestionar perfiles específicos de terceros para cada plantilla,
 * habilitando que un mismo tercero tenga diferentes roles y campos según la plantilla.
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, verifyTenant } = require('../middleware/auth');
const ThirdPartyProfile = require('../models/ThirdPartyProfile');
const Supplier = require('../models/Supplier');
const ContractTemplate = require('../models/ContractTemplate');
const templateVariableAnalyzer = require('../services/templateVariableAnalyzer');

// ===================================================================
// CRUD BÁSICO DE PERFILES
// ===================================================================

/**
 * POST /api/third-party-profiles
 * Crear un nuevo perfil de tercero para una plantilla
 */
router.post('/', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const {
      supplier_id,
      template_id,
      role_in_template,
      role_label,
      template_specific_fields,
      field_mappings,
      notes
    } = req.body;

    console.log('📝 [ThirdPartyProfile] Creating profile:', {
      supplier_id,
      template_id,
      role_in_template,
      company: req.companyId,
      user: req.user._id
    });

    // Validar que el tercero existe y pertenece a la empresa
    const supplier = await Supplier.findOne({
      _id: supplier_id,
      company: req.companyId
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    // Validar que la plantilla existe y pertenece a la empresa
    const template = await ContractTemplate.findOne({
      _id: template_id,
      company: req.companyId
    });

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Verificar si ya existe un perfil con este rol
    const existingProfile = await ThirdPartyProfile.findOne({
      supplier: supplier_id,
      template: template_id,
      role_in_template: role_in_template.toLowerCase()
    });

    if (existingProfile) {
      return res.status(400).json({
        error: 'Ya existe un perfil para este tercero, plantilla y rol',
        existing_profile_id: existingProfile._id
      });
    }

    // Crear el perfil
    const profile = await ThirdPartyProfile.create({
      supplier: supplier_id,
      template: template_id,
      company: req.companyId,
      role_in_template: role_in_template.toLowerCase(),
      role_label: role_label || role_in_template,
      template_specific_fields: template_specific_fields || {},
      field_mappings: field_mappings || [],
      notes: notes || '',
      created_by: req.user._id,
      updated_by: req.user._id
    });

    // Calcular completitud
    profile.calculateCompleteness();
    await profile.save();

    // Populate para respuesta
    await profile.populate([
      { path: 'supplier', select: 'legal_name full_name identification_number' },
      { path: 'template', select: 'name category' }
    ]);

    console.log('✅ [ThirdPartyProfile] Profile created:', profile._id);

    res.status(201).json({
      success: true,
      message: 'Perfil creado exitosamente',
      profile
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error creating profile:', error);
    res.status(500).json({ error: 'Error al crear perfil' });
  }
});

/**
 * GET /api/third-party-profiles
 * Listar perfiles de la empresa
 */
router.get('/', authenticate, verifyTenant, async (req, res) => {
  try {
    const {
      supplier_id,
      template_id,
      role,
      active_only = 'true',
      page = 1,
      limit = 50
    } = req.query;

    const filter = { company: req.companyId };

    if (supplier_id) filter.supplier = supplier_id;
    if (template_id) filter.template = template_id;
    if (role) filter.role_in_template = role.toLowerCase();
    if (active_only === 'true') filter.active = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [profiles, total] = await Promise.all([
      ThirdPartyProfile.find(filter)
        .populate('supplier', 'legal_name full_name identification_number')
        .populate('template', 'name category')
        .sort({ last_used_at: -1, usage_count: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ThirdPartyProfile.countDocuments(filter)
    ]);

    res.json({
      success: true,
      profiles,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error listing profiles:', error);
    res.status(500).json({ error: 'Error al listar perfiles' });
  }
});

/**
 * GET /api/third-party-profiles/:id
 * Obtener un perfil específico
 */
router.get('/:id', authenticate, verifyTenant, async (req, res) => {
  try {
    const profile = await ThirdPartyProfile.findOne({
      _id: req.params.id,
      company: req.companyId
    })
    .populate('supplier', 'legal_name full_name identification_number email phone address third_party_type custom_fields')
    .populate('template', 'name category content variables')
    .populate('created_by', 'name email')
    .populate('updated_by', 'name email');

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error getting profile:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

/**
 * PUT /api/third-party-profiles/:id
 * Actualizar un perfil
 */
router.put('/:id', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const {
      role_label,
      template_specific_fields,
      field_mappings,
      notes
    } = req.body;

    const profile = await ThirdPartyProfile.findOne({
      _id: req.params.id,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Actualizar campos
    if (role_label !== undefined) profile.role_label = role_label;
    if (template_specific_fields !== undefined) {
      profile.template_specific_fields = new Map(Object.entries(template_specific_fields));
    }
    if (field_mappings !== undefined) profile.field_mappings = field_mappings;
    if (notes !== undefined) profile.notes = notes;

    profile.updated_by = req.user._id;

    // Calcular completitud
    profile.calculateCompleteness();

    await profile.save();

    await profile.populate([
      { path: 'supplier', select: 'legal_name full_name identification_number' },
      { path: 'template', select: 'name category' }
    ]);

    console.log('✅ [ThirdPartyProfile] Profile updated:', profile._id);

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      profile
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error updating profile:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

/**
 * DELETE /api/third-party-profiles/:id
 * Eliminar (desactivar) un perfil
 */
router.delete('/:id', authenticate, verifyTenant, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const profile = await ThirdPartyProfile.findOne({
      _id: req.params.id,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Soft delete
    profile.active = false;
    profile.updated_by = req.user._id;
    await profile.save();

    console.log('🗑️  [ThirdPartyProfile] Profile deactivated:', profile._id);

    res.json({
      success: true,
      message: 'Perfil desactivado exitosamente'
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error deleting profile:', error);
    res.status(500).json({ error: 'Error al eliminar perfil' });
  }
});

// ===================================================================
// ENDPOINTS ESPECIALIZADOS
// ===================================================================

/**
 * GET /api/third-party-profiles/by-supplier/:supplierId
 * Obtener todos los perfiles de un tercero
 */
router.get('/by-supplier/:supplierId', authenticate, verifyTenant, async (req, res) => {
  try {
    const profiles = await ThirdPartyProfile.getSupplierProfiles(
      req.params.supplierId,
      req.companyId
    );

    res.json({
      success: true,
      profiles,
      count: profiles.length
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error getting supplier profiles:', error);
    res.status(500).json({ error: 'Error al obtener perfiles del tercero' });
  }
});

/**
 * GET /api/third-party-profiles/by-template/:templateId
 * Obtener todos los perfiles disponibles para una plantilla
 */
router.get('/by-template/:templateId', authenticate, verifyTenant, async (req, res) => {
  try {
    const { role } = req.query;

    let filter = {
      template: req.params.templateId,
      company: req.companyId,
      active: true
    };

    if (role) {
      filter.role_in_template = role.toLowerCase();
    }

    const profiles = await ThirdPartyProfile.find(filter)
      .populate('supplier', 'legal_name full_name identification_number third_party_type')
      .sort({ usage_count: -1, last_used_at: -1 });

    res.json({
      success: true,
      profiles,
      count: profiles.length
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error getting template profiles:', error);
    res.status(500).json({ error: 'Error al obtener perfiles de la plantilla' });
  }
});

/**
 * POST /api/third-party-profiles/find-or-create
 * Buscar o crear un perfil
 */
router.post('/find-or-create', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { supplier_id, template_id, role_in_template } = req.body;

    if (!supplier_id || !template_id || !role_in_template) {
      return res.status(400).json({
        error: 'Se requieren supplier_id, template_id y role_in_template'
      });
    }

    const profile = await ThirdPartyProfile.findOrCreateProfile(
      supplier_id,
      template_id,
      role_in_template,
      req.companyId,
      req.user._id
    );

    await profile.populate([
      { path: 'supplier', select: 'legal_name full_name identification_number custom_fields' },
      { path: 'template', select: 'name category' }
    ]);

    const isNew = profile.createdAt.getTime() === profile.updatedAt.getTime();

    res.json({
      success: true,
      profile,
      is_new: isNew,
      message: isNew ? 'Perfil creado' : 'Perfil existente encontrado'
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error in find-or-create:', error);
    res.status(500).json({ error: 'Error al buscar o crear perfil' });
  }
});

/**
 * POST /api/third-party-profiles/:id/update-field
 * Actualizar un campo específico del perfil
 */
router.post('/:id/update-field', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { template_variable, value, source_field } = req.body;

    if (!template_variable) {
      return res.status(400).json({ error: 'template_variable es requerido' });
    }

    const profile = await ThirdPartyProfile.findOne({
      _id: req.params.id,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Actualizar campo
    profile.updateField(template_variable, value, source_field);
    profile.updated_by = req.user._id;

    await profile.save();

    res.json({
      success: true,
      message: 'Campo actualizado exitosamente',
      profile,
      completeness: profile.completeness
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error updating field:', error);
    res.status(500).json({ error: 'Error al actualizar campo' });
  }
});

/**
 * POST /api/third-party-profiles/:id/record-usage
 * Registrar uso del perfil en un contrato
 */
router.post('/:id/record-usage', authenticate, verifyTenant, async (req, res) => {
  try {
    const { contract_id } = req.body;

    const profile = await ThirdPartyProfile.findOne({
      _id: req.params.id,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    await profile.recordUsage(contract_id);

    res.json({
      success: true,
      message: 'Uso registrado',
      usage_count: profile.usage_count,
      last_used_at: profile.last_used_at
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error recording usage:', error);
    res.status(500).json({ error: 'Error al registrar uso' });
  }
});

/**
 * GET /api/third-party-profiles/stats/usage
 * Obtener estadísticas de uso de perfiles
 */
router.get('/stats/usage', authenticate, verifyTenant, async (req, res) => {
  try {
    const stats = await ThirdPartyProfile.getUsageStats(req.companyId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error getting usage stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * POST /api/third-party-profiles/batch-create
 * Crear múltiples perfiles en lote (para migración)
 */
router.post('/batch-create', authenticate, verifyTenant, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { profiles } = req.body;

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de perfiles' });
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [],
      created_ids: []
    };

    for (const profileData of profiles) {
      try {
        const existingProfile = await ThirdPartyProfile.findOne({
          supplier: profileData.supplier_id,
          template: profileData.template_id,
          role_in_template: profileData.role_in_template.toLowerCase()
        });

        if (existingProfile) {
          results.skipped++;
          continue;
        }

        const profile = await ThirdPartyProfile.create({
          supplier: profileData.supplier_id,
          template: profileData.template_id,
          company: req.companyId,
          role_in_template: profileData.role_in_template.toLowerCase(),
          role_label: profileData.role_label || profileData.role_in_template,
          template_specific_fields: profileData.template_specific_fields || {},
          field_mappings: profileData.field_mappings || [],
          created_by: req.user._id,
          updated_by: req.user._id
        });

        results.created++;
        results.created_ids.push(profile._id);
      } catch (error) {
        results.errors.push({
          profile_data: profileData,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Creación en lote completada: ${results.created} creados, ${results.skipped} omitidos`,
      results
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error in batch create:', error);
    res.status(500).json({ error: 'Error en creación masiva' });
  }
});

/**
 * POST /api/third-party-profiles/analyze-template/:templateId
 * Analizar variables de una plantilla para detectar roles
 */
router.post('/analyze-template/:templateId', authenticate, verifyTenant, async (req, res) => {
  try {
    console.log('🔍 [TemplateAnalysis] Analyzing template:', req.params.templateId);

    const analysis = await templateVariableAnalyzer.analyzeTemplate(req.params.templateId);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('❌ [TemplateAnalysis] Error analyzing template:', error);
    res.status(500).json({ error: 'Error al analizar plantilla' });
  }
});

/**
 * POST /api/third-party-profiles/auto-fill
 * Auto-llenar perfil desde datos base del tercero
 */
router.post('/auto-fill', authenticate, verifyTenant, async (req, res) => {
  try {
    const { supplier_id, template_id, role_in_template } = req.body;

    if (!supplier_id || !template_id || !role_in_template) {
      return res.status(400).json({
        error: 'Se requieren supplier_id, template_id y role_in_template'
      });
    }

    // Obtener análisis de la plantilla
    const analysis = await templateVariableAnalyzer.analyzeTemplate(template_id);

    // Buscar el rol específico
    const roleGroup = analysis.role_groups.find(
      g => g.role === role_in_template.toLowerCase()
    );

    if (!roleGroup) {
      return res.status(404).json({
        error: `Rol '${role_in_template}' no encontrado en la plantilla`,
        available_roles: analysis.roles_detected
      });
    }

    // Obtener datos del tercero
    const supplier = await Supplier.findOne({
      _id: supplier_id,
      company: req.companyId
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    // Generar estructura de perfil con auto-fill
    const profileStructure = templateVariableAnalyzer.generateProfileStructure(
      roleGroup,
      supplier.toObject()
    );

    // Buscar o crear perfil
    let profile = await ThirdPartyProfile.findOne({
      supplier: supplier_id,
      template: template_id,
      role_in_template: role_in_template.toLowerCase()
    });

    if (profile) {
      // Actualizar perfil existente
      profile.field_mappings = profileStructure.field_mappings;
      profile.template_specific_fields = new Map(Object.entries(profileStructure.template_specific_fields));
      profile.updated_by = req.user._id;
      profile.calculateCompleteness();
      await profile.save();
    } else {
      // Crear nuevo perfil
      profile = await ThirdPartyProfile.create({
        supplier: supplier_id,
        template: template_id,
        company: req.companyId,
        role_in_template: role_in_template.toLowerCase(),
        role_label: profileStructure.role_label,
        field_mappings: profileStructure.field_mappings,
        template_specific_fields: profileStructure.template_specific_fields,
        created_by: req.user._id,
        updated_by: req.user._id
      });
    }

    await profile.populate([
      { path: 'supplier', select: 'legal_name full_name identification_number' },
      { path: 'template', select: 'name category' }
    ]);

    // Contar cuántos campos se auto-llenaron
    const autoFilledCount = profile.field_mappings.filter(m => m.is_auto_filled).length;

    console.log(`✅ [AutoFill] Profile auto-filled: ${autoFilledCount}/${profile.field_mappings.length} fields`);

    res.json({
      success: true,
      message: `Perfil auto-llenado: ${autoFilledCount} de ${profile.field_mappings.length} campos`,
      profile,
      auto_filled_count: autoFilledCount,
      total_fields: profile.field_mappings.length,
      completeness: profile.completeness
    });
  } catch (error) {
    console.error('❌ [AutoFill] Error in auto-fill:', error);
    res.status(500).json({ error: 'Error al auto-llenar perfil' });
  }
});

// ===================================================================
// ENDPOINTS PARA GESTIÓN DE VARIANTES
// ===================================================================

/**
 * POST /api/third-party-profiles/:profileId/variants
 * Crear una nueva variante para un perfil
 */
router.post('/:profileId/variants', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { profileId } = req.params;
    const {
      variant_name,
      variant_description,
      context_tags,
      field_mappings,
      template_specific_fields,
      is_default
    } = req.body;

    if (!variant_name) {
      return res.status(400).json({ error: 'variant_name es requerido' });
    }

    const profile = await ThirdPartyProfile.findOne({
      _id: profileId,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Crear variante
    const newVariant = profile.createVariant({
      variant_name,
      variant_description,
      context_tags,
      field_mappings,
      template_specific_fields,
      is_default
    }, req.user._id);

    profile.updated_by = req.user._id;
    profile.calculateCompleteness();
    await profile.save();

    console.log(`✅ [ThirdPartyProfile] Variant created: ${newVariant._id} for profile ${profileId}`);

    res.status(201).json({
      success: true,
      message: 'Variante creada exitosamente',
      variant: newVariant,
      profile
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error creating variant:', error);
    res.status(500).json({ error: error.message || 'Error al crear variante' });
  }
});

/**
 * GET /api/third-party-profiles/:profileId/variants
 * Obtener todas las variantes de un perfil
 */
router.get('/:profileId/variants', authenticate, verifyTenant, async (req, res) => {
  try {
    const { profileId } = req.params;
    const { active_only = 'true' } = req.query;

    const profile = await ThirdPartyProfile.findOne({
      _id: profileId,
      company: req.companyId
    })
    .populate('supplier', 'legal_name full_name')
    .populate('template', 'name category');

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    let variants = profile.variants || [];

    if (active_only === 'true') {
      variants = variants.filter(v => v.active);
    }

    res.json({
      success: true,
      profile: {
        _id: profile._id,
        supplier: profile.supplier,
        template: profile.template,
        role_in_template: profile.role_in_template,
        role_label: profile.role_label
      },
      variants,
      variants_count: variants.length
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error getting variants:', error);
    res.status(500).json({ error: 'Error al obtener variantes' });
  }
});

/**
 * GET /api/third-party-profiles/:profileId/variants/:variantId
 * Obtener una variante específica
 */
router.get('/:profileId/variants/:variantId', authenticate, verifyTenant, async (req, res) => {
  try {
    const { profileId, variantId } = req.params;

    const profile = await ThirdPartyProfile.findOne({
      _id: profileId,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const variant = profile.variants.id(variantId);

    if (!variant) {
      return res.status(404).json({ error: 'Variante no encontrada' });
    }

    res.json({
      success: true,
      variant
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error getting variant:', error);
    res.status(500).json({ error: 'Error al obtener variante' });
  }
});

/**
 * PUT /api/third-party-profiles/:profileId/variants/:variantId
 * Actualizar una variante
 */
router.put('/:profileId/variants/:variantId', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { profileId, variantId } = req.params;
    const variantData = req.body;

    const profile = await ThirdPartyProfile.findOne({
      _id: profileId,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const updatedVariant = profile.updateVariant(variantId, variantData, req.user._id);
    profile.updated_by = req.user._id;
    profile.calculateCompleteness();
    await profile.save();

    console.log(`✅ [ThirdPartyProfile] Variant updated: ${variantId}`);

    res.json({
      success: true,
      message: 'Variante actualizada exitosamente',
      variant: updatedVariant,
      profile
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error updating variant:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar variante' });
  }
});

/**
 * DELETE /api/third-party-profiles/:profileId/variants/:variantId
 * Eliminar (desactivar) una variante
 */
router.delete('/:profileId/variants/:variantId', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { profileId, variantId } = req.params;

    const profile = await ThirdPartyProfile.findOne({
      _id: profileId,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    profile.deleteVariant(variantId);
    profile.updated_by = req.user._id;
    profile.calculateCompleteness();
    await profile.save();

    console.log(`🗑️  [ThirdPartyProfile] Variant deleted: ${variantId}`);

    res.json({
      success: true,
      message: 'Variante desactivada exitosamente'
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error deleting variant:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar variante' });
  }
});

/**
 * POST /api/third-party-profiles/:profileId/variants/:variantId/set-default
 * Establecer una variante como predeterminada
 */
router.post('/:profileId/variants/:variantId/set-default', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { profileId, variantId } = req.params;

    const profile = await ThirdPartyProfile.findOne({
      _id: profileId,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Remover default de todas
    profile.variants.forEach(v => { v.is_default = false; });

    // Establecer default en la seleccionada
    const variant = profile.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ error: 'Variante no encontrada' });
    }

    variant.is_default = true;
    variant.updated_by = req.user._id;
    profile.updated_by = req.user._id;

    await profile.save();

    console.log(`✅ [ThirdPartyProfile] Variant set as default: ${variantId}`);

    res.json({
      success: true,
      message: 'Variante establecida como predeterminada',
      variant
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error setting default variant:', error);
    res.status(500).json({ error: 'Error al establecer variante predeterminada' });
  }
});

/**
 * POST /api/third-party-profiles/:profileId/variants/:variantId/clone
 * Clonar una variante existente
 */
router.post('/:profileId/variants/:variantId/clone', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { profileId, variantId } = req.params;
    const { variant_name } = req.body;

    if (!variant_name) {
      return res.status(400).json({ error: 'variant_name es requerido para el clon' });
    }

    const profile = await ThirdPartyProfile.findOne({
      _id: profileId,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const sourceVariant = profile.variants.id(variantId);
    if (!sourceVariant) {
      return res.status(404).json({ error: 'Variante fuente no encontrada' });
    }

    // Crear clon
    const clonedVariant = profile.createVariant({
      variant_name,
      variant_description: `Clon de: ${sourceVariant.variant_name}`,
      context_tags: [...(sourceVariant.context_tags || [])],
      field_mappings: JSON.parse(JSON.stringify(sourceVariant.field_mappings)),
      template_specific_fields: new Map(sourceVariant.template_specific_fields),
      is_default: false
    }, req.user._id);

    profile.updated_by = req.user._id;
    await profile.save();

    console.log(`✅ [ThirdPartyProfile] Variant cloned: ${variantId} -> ${clonedVariant._id}`);

    res.status(201).json({
      success: true,
      message: 'Variante clonada exitosamente',
      variant: clonedVariant,
      source_variant_id: variantId
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error cloning variant:', error);
    res.status(500).json({ error: error.message || 'Error al clonar variante' });
  }
});

/**
 * POST /api/third-party-profiles/:profileId/variants/:variantId/record-usage
 * Registrar uso de una variante en un contrato
 */
router.post('/:profileId/variants/:variantId/record-usage', authenticate, verifyTenant, async (req, res) => {
  try {
    const { profileId, variantId } = req.params;
    const { contract_id } = req.body;

    const profile = await ThirdPartyProfile.findOne({
      _id: profileId,
      company: req.companyId
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    await profile.recordVariantUsage(variantId, contract_id);

    const variant = profile.variants.id(variantId);

    res.json({
      success: true,
      message: 'Uso de variante registrado',
      variant: {
        usage_count: variant.usage_count,
        last_used_at: variant.last_used_at
      }
    });
  } catch (error) {
    console.error('❌ [ThirdPartyProfile] Error recording variant usage:', error);
    res.status(500).json({ error: error.message || 'Error al registrar uso' });
  }
});

// ===================================================================
// ENDPOINTS PARA CREAR TERCERO BASADO EN PLANTILLA
// ===================================================================

/**
 * GET /api/third-party-profiles/template-fields/:templateId
 * Obtener los campos necesarios para crear un tercero según una plantilla
 * Agrupa los campos por rol detectado en las variables
 */
router.get('/template-fields/:templateId', authenticate, verifyTenant, async (req, res) => {
  try {
    const { templateId } = req.params;

    console.log('📋 [TemplateFields] Getting fields for template:', templateId);

    // Obtener la plantilla
    const template = await ContractTemplate.findOne({
      _id: templateId,
      $or: [
        { company: req.companyId },
        { is_shared: true },
        { shared_with_companies: req.companyId }
      ]
    });

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Analizar variables de la plantilla
    const analysis = await templateVariableAnalyzer.analyzeTemplate(templateId);

    // Campos base siempre requeridos
    const baseFields = [
      {
        field_name: 'identification_type',
        field_label: 'Tipo de Identificación',
        field_type: 'select',
        required: true,
        options: ['NIT', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
        category: 'identification',
        description: 'Tipo de documento de identificación'
      },
      {
        field_name: 'identification_number',
        field_label: 'Número de Identificación',
        field_type: 'text',
        required: true,
        category: 'identification',
        description: 'Número del documento de identificación'
      }
    ];

    // Mapeo de sufijos de variables a campos del supplier
    const variableToSupplierField = {
      'nombre': 'legal_name',
      'razon_social': 'legal_name',
      'razon_social_corta': 'legal_name_short',
      'nombre_corto': 'legal_name_short',
      'nit': 'identification_number',
      'cedula': 'identification_number',
      'cc': 'identification_number',
      'identificacion': 'identification_number',
      'representante': 'legal_representative_name',
      'representante_legal': 'legal_representative_name',
      'cedula_representante': 'legal_representative_id_number',
      'direccion': 'address',
      'ciudad': 'city',
      'pais': 'country',
      'email': 'email',
      'correo': 'email',
      'telefono': 'phone',
      'celular': 'phone'
    };

    // Procesar cada grupo de roles
    const roleFieldsMap = {};

    for (const roleGroup of analysis.role_groups) {
      const roleName = roleGroup.role;
      const roleFields = [];

      for (const variable of roleGroup.variables) {
        // Quitar el prefijo del rol para obtener el campo
        const fieldSuffix = variable.variable
          .replace(new RegExp(`^${roleName}_`, 'i'), '')
          .toLowerCase();

        // Determinar si es un campo base del supplier o personalizado
        const supplierField = variableToSupplierField[fieldSuffix];

        const fieldDef = {
          field_name: variable.variable,
          field_label: variable.suggested_label || formatLabel(variable.variable),
          field_type: variable.suggested_type || 'text',
          required: variable.required !== false,
          original_marker: `{{${variable.variable}}}`,
          supplier_field: supplierField || null,
          is_custom_field: !supplierField,
          category: supplierField ? 'supplier_base' : 'template_specific'
        };

        roleFields.push(fieldDef);
      }

      roleFieldsMap[roleName] = {
        role: roleName,
        role_label: roleGroup.role_label || formatLabel(roleName),
        fields: roleFields,
        total_fields: roleFields.length,
        base_fields_count: roleFields.filter(f => f.supplier_field).length,
        custom_fields_count: roleFields.filter(f => f.is_custom_field).length
      };
    }

    console.log(`✅ [TemplateFields] Found ${Object.keys(roleFieldsMap).length} roles with fields`);

    res.json({
      success: true,
      template: {
        _id: template._id,
        name: template.name,
        category: template.category,
        third_party_type: template.third_party_type
      },
      base_fields: baseFields,
      roles: roleFieldsMap,
      roles_detected: analysis.roles_detected,
      total_variables: analysis.total_variables
    });
  } catch (error) {
    console.error('❌ [TemplateFields] Error:', error);
    res.status(500).json({ error: 'Error al obtener campos de la plantilla' });
  }
});

/**
 * POST /api/third-party-profiles/create-with-supplier
 * Crear un nuevo tercero Y su perfil de plantilla en una sola operación
 */
router.post('/create-with-supplier', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const {
      template_id,
      role_in_template,
      // Campos base del tercero
      identification_type,
      identification_number,
      legal_name,
      legal_name_short,
      full_name,
      legal_representative_name,
      legal_representative_id_type,
      legal_representative_id_number,
      email,
      phone,
      address,
      city,
      country,
      // Campos específicos de la plantilla
      template_fields
    } = req.body;

    console.log('📝 [CreateWithSupplier] Creating supplier with template profile:', {
      template_id,
      role_in_template,
      identification_number,
      company: req.companyId
    });

    // Validaciones básicas
    if (!template_id || !role_in_template) {
      return res.status(400).json({
        error: 'Se requiere template_id y role_in_template'
      });
    }

    if (!identification_type || !identification_number) {
      return res.status(400).json({
        error: 'Tipo y número de identificación son requeridos'
      });
    }

    // Verificar que la plantilla existe
    const template = await ContractTemplate.findOne({
      _id: template_id,
      $or: [
        { company: req.companyId },
        { is_shared: true },
        { shared_with_companies: req.companyId }
      ]
    });

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Verificar si ya existe el tercero
    let supplier = await Supplier.findOne({
      identification_number,
      company: req.companyId
    });

    let isNewSupplier = false;

    if (!supplier) {
      // Crear nuevo tercero
      isNewSupplier = true;
      const isCompany = identification_type === 'NIT';

      supplier = await Supplier.create({
        identification_type,
        identification_number,
        legal_name: isCompany ? legal_name : (full_name || legal_name),
        legal_name_short: legal_name_short || null,
        full_name: !isCompany ? full_name : null,
        legal_representative_name,
        legal_representative_id_type,
        legal_representative_id_number,
        email,
        phone,
        address,
        city,
        country,
        company: req.companyId,
        created_by: req.user._id,
        active: true
      });

      console.log('✅ [CreateWithSupplier] Supplier created:', supplier._id);
    } else {
      console.log('ℹ️  [CreateWithSupplier] Using existing supplier:', supplier._id);
    }

    // Crear o actualizar el perfil de plantilla
    let profile = await ThirdPartyProfile.findOne({
      supplier: supplier._id,
      template: template_id,
      role_in_template: role_in_template.toLowerCase()
    });

    // Preparar los mapeos de campos
    const fieldMappings = [];

    // Mapear campos base del supplier
    const supplierFieldMappings = {
      'nombre': supplier.legal_name,
      'razon_social': supplier.legal_name,
      'razon_social_corta': supplier.legal_name_short,
      'nit': supplier.identification_number,
      'cedula': supplier.identification_number,
      'identificacion': supplier.identification_number,
      'representante': supplier.legal_representative_name,
      'representante_legal': supplier.legal_representative_name,
      'cedula_representante': supplier.legal_representative_id_number,
      'direccion': supplier.address,
      'ciudad': supplier.city,
      'email': supplier.email,
      'telefono': supplier.phone
    };

    // Analizar variables de la plantilla para este rol
    const analysis = await templateVariableAnalyzer.analyzeTemplate(template_id);
    const roleGroup = analysis.role_groups.find(g => g.role === role_in_template.toLowerCase());

    if (roleGroup) {
      for (const variable of roleGroup.variables) {
        const varName = variable.variable;
        const fieldSuffix = varName
          .replace(new RegExp(`^${role_in_template}_`, 'i'), '')
          .toLowerCase();

        // Buscar valor: primero en template_fields, luego en mapeo automático
        let value = null;
        let isAutoFilled = false;

        if (template_fields && template_fields[varName] !== undefined) {
          value = template_fields[varName];
        } else if (supplierFieldMappings[fieldSuffix]) {
          value = supplierFieldMappings[fieldSuffix];
          isAutoFilled = true;
        }

        fieldMappings.push({
          template_variable: `{{${varName}}}`,
          source_field: fieldSuffix,
          value: value,
          is_auto_filled: isAutoFilled,
          last_updated: new Date()
        });
      }
    }

    if (profile) {
      // Actualizar perfil existente
      profile.field_mappings = fieldMappings;
      profile.updated_by = req.user._id;
      profile.calculateCompleteness();
      await profile.save();
      console.log('✅ [CreateWithSupplier] Profile updated:', profile._id);
    } else {
      // Crear nuevo perfil
      profile = await ThirdPartyProfile.create({
        supplier: supplier._id,
        template: template_id,
        company: req.companyId,
        role_in_template: role_in_template.toLowerCase(),
        role_label: formatLabel(role_in_template),
        field_mappings: fieldMappings,
        created_by: req.user._id,
        updated_by: req.user._id
      });

      profile.calculateCompleteness();
      await profile.save();
      console.log('✅ [CreateWithSupplier] Profile created:', profile._id);
    }

    // Populate para la respuesta
    await supplier.populate('third_party_type', 'code label');
    await profile.populate([
      { path: 'supplier', select: 'legal_name full_name identification_number' },
      { path: 'template', select: 'name category' }
    ]);

    res.status(201).json({
      success: true,
      message: isNewSupplier
        ? 'Tercero y perfil creados exitosamente'
        : 'Perfil actualizado para tercero existente',
      supplier,
      profile,
      is_new_supplier: isNewSupplier,
      completeness: profile.completeness
    });
  } catch (error) {
    console.error('❌ [CreateWithSupplier] Error:', error);
    res.status(500).json({ error: 'Error al crear tercero con perfil' });
  }
});

/**
 * GET /api/third-party-profiles/supplier-templates/:supplierId
 * Obtener todas las plantillas disponibles para un tercero con estado de perfil
 */
router.get('/supplier-templates/:supplierId', authenticate, verifyTenant, async (req, res) => {
  try {
    const { supplierId } = req.params;

    // Verificar que el tercero existe
    const supplier = await Supplier.findOne({
      _id: supplierId,
      company: req.companyId
    }).populate('third_party_type', 'code label');

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    // Obtener todas las plantillas disponibles para la empresa
    const templates = await ContractTemplate.find({
      $or: [
        { company: req.companyId },
        { is_shared: true },
        { shared_with_companies: req.companyId }
      ],
      active: true
    }).select('name category third_party_type fields');

    // Obtener perfiles existentes del tercero
    const existingProfiles = await ThirdPartyProfile.find({
      supplier: supplierId,
      company: req.companyId,
      active: true
    }).select('template role_in_template completeness usage_count');

    // Crear mapa de perfiles por plantilla
    const profileMap = {};
    for (const profile of existingProfiles) {
      if (!profileMap[profile.template.toString()]) {
        profileMap[profile.template.toString()] = [];
      }
      profileMap[profile.template.toString()].push(profile);
    }

    // Construir respuesta con estado de cada plantilla
    const templateStatus = templates.map(template => {
      const profiles = profileMap[template._id.toString()] || [];

      return {
        template: {
          _id: template._id,
          name: template.name,
          category: template.category,
          third_party_type: template.third_party_type,
          total_fields: template.fields ? template.fields.length : 0
        },
        has_profile: profiles.length > 0,
        profiles: profiles.map(p => ({
          _id: p._id,
          role: p.role_in_template,
          completeness: p.completeness,
          usage_count: p.usage_count
        })),
        profiles_count: profiles.length
      };
    });

    res.json({
      success: true,
      supplier: {
        _id: supplier._id,
        name: supplier.legal_name || supplier.full_name,
        identification: supplier.identification_number,
        type: supplier.third_party_type
      },
      templates: templateStatus,
      total_templates: templates.length,
      templates_with_profiles: templateStatus.filter(t => t.has_profile).length
    });
  } catch (error) {
    console.error('❌ [SupplierTemplates] Error:', error);
    res.status(500).json({ error: 'Error al obtener plantillas del tercero' });
  }
});

/**
 * Función auxiliar para formatear etiquetas
 */
function formatLabel(text) {
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

module.exports = router;
