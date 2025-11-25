const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');
const SupplierAuditLog = require('../models/SupplierAuditLog');
const ActivityLog = require('../models/ActivityLog');
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const {
  preventBulkDeletion,
  backupBeforeCriticalOperation,
  auditSupplierOperation,
  validateNotInUse
} = require('../middleware/supplierProtection');

// Obtener tipos de terceros disponibles
router.get('/types', authenticate, async (req, res) => {
  try {
    const filter = { active: true };

    // Si el usuario no es super_admin, filtrar por empresa o tipos globales
    if (req.user.role !== 'super_admin' && req.companyId) {
      filter.$or = [
        { company: req.companyId },
        { company: null } // Tipos globales
      ];
    }

    console.log('🔍 [DEBUG] Fetching types with filter:', JSON.stringify(filter));
    console.log('🔍 [DEBUG] User role:', req.user.role, 'CompanyId:', req.companyId);

    const types = await ThirdPartyTypeConfig.find(filter)
      .select('code label icon description fields default_identification_types')
      .sort({ label: 1 });

    console.log('✅ [DEBUG] Types found:', types.length);
    console.log('📋 [DEBUG] Type codes:', types.map(t => t.code).join(', '));

    res.json({
      success: true,
      types
    });
  } catch (error) {
    console.error('Error al obtener tipos de terceros:', error);
    res.status(500).json({ error: 'Error al obtener tipos de terceros' });
  }
});

// Obtener todos los proveedores de la empresa (o todos si es super_admin)
router.get('/', authenticate, verifyTenant, async (req, res) => {
  try {
    const { active, includeDeleted } = req.query;

    const filter = {};

    // Super admin con companyId='ALL' ve todos los terceros
    // Super admin con companyId específico ve solo esa empresa
    // Otros usuarios solo ven los de su compañía
    if (req.companyId && req.companyId !== 'ALL') {
      filter.company = req.companyId;
    }

    if (active !== undefined) {
      filter.active = active === 'true';
    }

    // PROTECCIÓN: Por defecto, NO mostrar eliminados
    if (includeDeleted !== 'true') {
      filter.deleted = { $ne: true };
    }

    const suppliers = await Supplier.find(filter)
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email')
      .populate('deletedBy', 'name email')
      .populate('company', 'name')
      .populate('third_party_type', 'code label icon fields default_identification_types')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: suppliers.length,
      suppliers
    });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// Verificar si un tercero tiene referencias en contratos o plantillas
router.get('/:id/check-references', authenticate, verifyTenant, async (req, res) => {
  try {
    // Construir query del supplier - si es "ALL", no filtrar por company
    const supplierQuery = { _id: req.params.id };
    if (req.companyId && req.companyId !== 'ALL') {
      supplierQuery.company = req.companyId;
    }

    const supplier = await Supplier.findOne(supplierQuery)
      .populate('third_party_type', 'code');

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    const references = {
      hasReferences: false,
      canDelete: true,
      details: {
        contracts: 0,
        templates: 0
      }
    };

    // Buscar contratos que mencionen al tercero
    // Buscamos en el contenido del contrato si aparece su nombre o identificación
    const contractQuery = {
      $or: [
        { content: { $regex: supplier.legal_name, $options: 'i' } },
        { content: { $regex: supplier.identification_number, $options: 'i' } },
        { title: { $regex: supplier.legal_name, $options: 'i' } }
      ]
    };
    if (req.companyId && req.companyId !== 'ALL') {
      contractQuery.company = req.companyId;
    }

    const contractsWithReference = await Contract.find(contractQuery).countDocuments();

    references.details.contracts = contractsWithReference;

    // Buscar plantillas del mismo tipo de tercero
    if (supplier.third_party_type) {
      const templateQuery = {
        third_party_type: supplier.third_party_type.code,
        active: true
      };
      if (req.companyId && req.companyId !== 'ALL') {
        templateQuery.company = req.companyId;
      }

      const templatesWithType = await ContractTemplate.find(templateQuery).countDocuments();

      references.details.templates = templatesWithType;
    }

    // Si hay referencias, no se puede eliminar
    if (contractsWithReference > 0 || references.details.templates > 0) {
      references.hasReferences = true;
      references.canDelete = false;
    }

    res.json({
      success: true,
      references
    });
  } catch (error) {
    console.error('Error al verificar referencias del tercero:', error);
    res.status(500).json({ error: 'Error al verificar referencias' });
  }
});

// Obtener un proveedor específico
router.get('/:id', authenticate, verifyTenant, async (req, res) => {
  try {
    const { includeSuggestions } = req.query;

    // Build query - handle super_admin with ALL access
    const query = { _id: req.params.id };
    if (req.companyId && req.companyId !== 'ALL') {
      query.company = req.companyId;
    }

    const supplier = await Supplier.findOne(query)
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email')
      .populate('company', 'name')
      .populate('third_party_type', 'code label icon fields default_identification_types');

    if (!supplier) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    const response = {
      success: true,
      supplier
    };

    // Si se solicitan sugerencias, analizar plantillas automáticamente
    if (includeSuggestions === 'true' && supplier.third_party_type) {
      try {
        // Construir lista de campos actuales del tercero
        const supplierFields = new Set();

        // Campos estándar
        if (supplier.legal_name) supplierFields.add('razon_social');
        if (supplier.legal_name_short) supplierFields.add('razon_social_corta');
        if (supplier.full_name) supplierFields.add('nombre_completo');
        if (supplier.identification_type) supplierFields.add('tipo_identificacion');
        if (supplier.identification_number) supplierFields.add('numero_identificacion');
        if (supplier.legal_representative_name) supplierFields.add('representante_legal');
        if (supplier.legal_representative_id_type) supplierFields.add('tipo_id_representante');
        if (supplier.legal_representative_id_number) supplierFields.add('numero_id_representante');
        if (supplier.address) supplierFields.add('direccion');
        if (supplier.city) supplierFields.add('ciudad');
        if (supplier.country) supplierFields.add('pais');
        if (supplier.email) supplierFields.add('email');
        if (supplier.phone) supplierFields.add('telefono');

        // Campos personalizados
        if (supplier.custom_fields) {
          Object.keys(supplier.custom_fields).forEach(key => {
            if (supplier.custom_fields[key]) {
              supplierFields.add(key);
            }
          });
        }

        // Build query - handle super_admin with ALL access
        const templatesQuery = {
          active: true,
          third_party_type: supplier.third_party_type.code
        };
        if (supplier.company && supplier.company.toString() !== 'ALL') {
          templatesQuery.company = supplier.company;
        }

        // Buscar plantillas que usan este tipo de tercero
        const templates = await ContractTemplate.find(templatesQuery).select('name category fields');

        const templateSuggestions = [];

        for (const template of templates) {
          const missingFields = [];
          const matchedFields = [];

          if (template.fields && Array.isArray(template.fields)) {
            for (const templateField of template.fields) {
              const fieldName = templateField.field_name || templateField.name;
              const fieldLabel = templateField.field_label || templateField.label || fieldName;

              // Verificar si el tercero tiene este campo (coincidencia flexible)
              let found = false;
              for (const supplierField of supplierFields) {
                if (fieldsMatch(supplierField, fieldName)) {
                  found = true;
                  matchedFields.push({
                    field_name: fieldName,
                    field_label: fieldLabel
                  });
                  break;
                }
              }

              if (!found) {
                missingFields.push({
                  field_name: fieldName,
                  field_label: fieldLabel,
                  field_type: templateField.field_type || templateField.type || 'text',
                  required: templateField.required || false,
                  description: `Campo requerido por la plantilla ${template.name}`
                });
              }
            }
          }

          // Solo incluir plantillas con campos faltantes
          if (missingFields.length > 0) {
            templateSuggestions.push({
              template_id: template._id,
              template_name: template.name,
              template_category: template.category,
              missing_fields: missingFields,
              matched_fields: matchedFields,
              completion_percentage: Math.round(
                (matchedFields.length / (matchedFields.length + missingFields.length)) * 100
              )
            });
          }
        }

        // Ordenar por porcentaje de completitud
        templateSuggestions.sort((a, b) => b.completion_percentage - a.completion_percentage);

        response.field_suggestions = {
          current_fields: Array.from(supplierFields),
          templates_analyzed: templates.length,
          templates_needing_fields: templateSuggestions.length,
          suggestions: templateSuggestions
        };
      } catch (suggestionError) {
        console.error('Error al generar sugerencias:', suggestionError);
        // No fallar la petición, solo omitir sugerencias
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

// Función auxiliar para comparar nombres de campos (coincidencia flexible)
function fieldsMatch(supplierFieldName, templateFieldName) {
  const normalized1 = normalizeFieldName(supplierFieldName);
  const normalized2 = normalizeFieldName(templateFieldName);

  if (normalized1 === normalized2) return true;
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  return false;
}

function normalizeFieldName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_\s\/\-]+/g, '')
    .replace(/de/g, '').replace(/del/g, '')
    .replace(/la/g, '').replace(/el/g, '');
}

// Crear proveedor
router.post('/',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin', 'lawyer'),
  async (req, res) => {
    try {
      // Validación dinámica basada en el tipo de identificación
      const isCompany = req.body.identification_type === 'NIT';

      // Validaciones comunes
      await body('identification_type').notEmpty().withMessage('El tipo de identificación es requerido').run(req);
      await body('identification_number').notEmpty().withMessage('El número de identificación es requerido').run(req);

      if (isCompany) {
        // Validaciones para empresas
        await body('legal_name').notEmpty().withMessage('La razón social es requerida').run(req);
        await body('legal_name_short').notEmpty().withMessage('La razón social abreviada es requerida').run(req);
        await body('legal_representative_name').notEmpty().withMessage('El nombre del representante legal es requerido').run(req);
        await body('legal_representative_id_type').notEmpty().withMessage('El tipo de identificación del representante es requerido').run(req);
        await body('legal_representative_id_number').notEmpty().withMessage('El número de identificación del representante es requerido').run(req);
      } else {
        // Validación para personas naturales
        await body('full_name').notEmpty().withMessage('El nombre completo es requerido').run(req);
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Errores de validación:', JSON.stringify(errors.array(), null, 2));
        // DO NOT LOG PII - Sanitize request body before logging (GDPR/CCPA compliance)
        const { sanitizeRequestBody } = require('../utils/sanitizeLogs');
        console.log('📦 Request body (sanitized):', JSON.stringify(sanitizeRequestBody(req.body), null, 2));
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        identification_type,
        identification_number,
        id_issue_city,
        legal_name,
        legal_name_short,
        legal_representative_name,
        legal_representative_id_type,
        legal_representative_id_number,
        licensee_name,
        full_name,
        email,
        phone,
        address,
        city,
        country,
        third_party_type,
        custom_fields
      } = req.body;

      // Determinar la empresa: usar company del body si existe, sino req.companyId
      // Super admins deben especificar la empresa en el body
      let targetCompany = req.body.company || req.companyId;

      // Validar que super_admin proporcione una empresa específica
      if (req.user.role === 'super_admin' && (!targetCompany || targetCompany === 'ALL')) {
        return res.status(400).json({
          error: 'Los super administradores deben especificar una empresa al crear un tercero'
        });
      }

      // Build query - handle super_admin with ALL access
      const duplicateQuery = { identification_number };
      if (targetCompany && targetCompany !== 'ALL') {
        duplicateQuery.company = targetCompany;
      }

      // Verificar si ya existe un proveedor con ese número de identificación en esta empresa
      const existingSupplier = await Supplier.findOne(duplicateQuery);

      if (existingSupplier) {
        return res.status(400).json({
          error: 'Ya existe un proveedor con ese número de identificación en esta empresa'
        });
      }

      // Crear proveedor
      const supplier = await Supplier.create({
        identification_type,
        identification_number,
        id_issue_city,
        legal_name: isCompany ? legal_name : full_name,
        legal_name_short,
        legal_representative_name,
        legal_representative_id_type,
        legal_representative_id_number,
        licensee_name,
        full_name,
        email,
        phone,
        address,
        city,
        country,
        third_party_type,
        custom_fields: custom_fields || {},
        company: targetCompany,
        created_by: req.user.id
      });

      // Log de actividad
      const displayName = isCompany ? legal_name : full_name;
      await ActivityLog.create({
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'supplier',
        entity_id: supplier._id,
        description: `Creó el tercero: ${displayName}`,
        company: targetCompany
      });

      res.status(201).json({
        success: true,
        message: 'Proveedor creado exitosamente',
        supplier
      });
    } catch (error) {
      console.error('Error al crear proveedor:', error);
      res.status(500).json({ error: 'Error al crear proveedor' });
    }
  }
);

// Actualizar proveedor
router.put('/:id',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin', 'lawyer'),
  async (req, res) => {
    try {
      // Build query - handle super_admin with ALL access
      const query = { _id: req.params.id };
      if (req.companyId && req.companyId !== 'ALL') {
        query.company = req.companyId;
      }

      const supplier = await Supplier.findOne(query);

      if (!supplier) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }

      const {
        identification_type,
        identification_number,
        id_issue_city,
        legal_name,
        legal_name_short,
        legal_representative_name,
        legal_representative_id_type,
        legal_representative_id_number,
        licensee_name,
        email,
        phone,
        address,
        city,
        country,
        third_party_type,
        custom_fields
      } = req.body;

      // Si se está cambiando el número de identificación, verificar que no exista otro con ese número
      if (identification_number && identification_number !== supplier.identification_number) {
        // Build query - handle super_admin with ALL access
        const duplicateQuery = {
          identification_number,
          _id: { $ne: req.params.id }
        };
        if (supplier.company && supplier.company.toString() !== 'ALL') {
          duplicateQuery.company = supplier.company;
        }

        const existingSupplier = await Supplier.findOne(duplicateQuery);

        if (existingSupplier) {
          return res.status(400).json({
            error: 'Ya existe otro proveedor con ese número de identificación'
          });
        }
      }

      // Actualizar campos
      if (identification_type) supplier.identification_type = identification_type;
      if (identification_number) supplier.identification_number = identification_number;
      if (id_issue_city !== undefined) supplier.id_issue_city = id_issue_city;
      if (legal_name) supplier.legal_name = legal_name;
      if (legal_name_short) supplier.legal_name_short = legal_name_short;
      if (legal_representative_name) supplier.legal_representative_name = legal_representative_name;
      if (legal_representative_id_type) supplier.legal_representative_id_type = legal_representative_id_type;
      if (legal_representative_id_number) supplier.legal_representative_id_number = legal_representative_id_number;
      if (licensee_name !== undefined) supplier.licensee_name = licensee_name;
      if (email !== undefined) supplier.email = email;
      if (phone !== undefined) supplier.phone = phone;
      if (address !== undefined) supplier.address = address;
      if (city !== undefined) supplier.city = city;
      if (country !== undefined) supplier.country = country;
      if (third_party_type !== undefined) supplier.third_party_type = third_party_type;
      if (custom_fields !== undefined) supplier.custom_fields = custom_fields;

      supplier.updated_by = req.user.id;
      await supplier.save();

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'UPDATE',
        entity_type: 'supplier',
        entity_id: supplier._id,
        description: `Actualizó el proveedor: ${supplier.legal_name}`,
        company: supplier.company
      });

      res.json({
        success: true,
        message: 'Proveedor actualizado exitosamente',
        supplier
      });
    } catch (error) {
      console.error('Error al actualizar proveedor:', error);
      res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
  }
);

// Desactivar/Activar proveedor
router.patch('/:id/toggle-status',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin', 'lawyer'),
  async (req, res) => {
    try {
      // Build query - handle super_admin with ALL access
      const query = { _id: req.params.id };
      if (req.companyId && req.companyId !== 'ALL') {
        query.company = req.companyId;
      }

      const supplier = await Supplier.findOne(query);

      if (!supplier) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }

      supplier.active = !supplier.active;
      supplier.updated_by = req.user.id;
      await supplier.save();

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'UPDATE',
        entity_type: 'supplier',
        entity_id: supplier._id,
        description: `${supplier.active ? 'Activó' : 'Desactivó'} el proveedor: ${supplier.legal_name}`,
        company: supplier.company
      });

      res.json({
        success: true,
        message: `Proveedor ${supplier.active ? 'activado' : 'desactivado'} exitosamente`,
        supplier
      });
    } catch (error) {
      console.error('Error al cambiar estado del proveedor:', error);
      res.status(500).json({ error: 'Error al cambiar estado del proveedor' });
    }
  }
);

// SOFT DELETE de proveedor con protección robusta
router.delete('/:id',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin', 'lawyer'),
  preventBulkDeletion,
  validateNotInUse,
  auditSupplierOperation('DELETE'),
  async (req, res) => {
    try {
      // Build query - handle super_admin with ALL access
      const query = { _id: req.params.id };
      if (req.companyId && req.companyId !== 'ALL') {
        query.company = req.companyId;
      }

      const supplier = await Supplier.findOne(query).populate('third_party_type', 'code');

      if (!supplier) {
        return res.status(404).json({ error: 'Tercero no encontrado' });
      }

      // Verificar si ya está eliminado
      if (supplier.deleted) {
        return res.status(400).json({
          error: 'Este tercero ya fue eliminado',
          deletedAt: supplier.deletedAt,
          suggestion: 'Usa el endpoint de restauración si necesitas recuperarlo'
        });
      }

      // Build query for contract references - handle super_admin with ALL access
      const contractQuery = {
        $or: [
          { content: { $regex: supplier.legal_name, $options: 'i' } },
          { content: { $regex: supplier.identification_number, $options: 'i' } },
          { title: { $regex: supplier.legal_name, $options: 'i' } }
        ]
      };
      if (supplier.company && supplier.company.toString() !== 'ALL') {
        contractQuery.company = supplier.company;
      }

      // Verificar referencias antes de eliminar
      const contractsWithReference = await Contract.find(contractQuery).countDocuments();

      let templatesWithType = 0;
      if (supplier.third_party_type) {
        // Build query for template references - handle super_admin with ALL access
        const templateQuery = {
          third_party_type: supplier.third_party_type.code,
          active: true
        };
        if (supplier.company && supplier.company.toString() !== 'ALL') {
          templateQuery.company = supplier.company;
        }

        templatesWithType = await ContractTemplate.find(templateQuery).countDocuments();
      }

      // Si tiene referencias, advertir pero permitir soft delete
      if (contractsWithReference > 0 || templatesWithType > 0) {
        console.warn(`⚠️  Soft-deleting tercero con referencias: ${supplier.legal_name}`);
        console.warn(`   Contratos: ${contractsWithReference}, Plantillas: ${templatesWithType}`);
      }

      // SOFT DELETE en lugar de eliminación física
      const reason = req.body.reason || req.query.reason || 'No especificada';
      await supplier.softDelete(req.user.id, reason);

      console.log(`🗑️  Tercero marcado como eliminado (soft delete): ${supplier.legal_name}`);

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'DELETE',
        entity_type: 'supplier',
        entity_id: req.params.id,
        description: `Eliminó el tercero: ${supplier.legal_name} (soft delete)`,
        company: supplier.company
      });

      res.json({
        success: true,
        message: 'Tercero eliminado exitosamente',
        recoverable: true,
        info: 'El tercero puede ser restaurado desde la sección de terceros eliminados'
      });
    } catch (error) {
      console.error('Error al eliminar tercero:', error);
      res.status(500).json({ error: 'Error al eliminar tercero' });
    }
  }
);

// ===================================================================
// ENDPOINTS DE RECUPERACIÓN Y AUDITORÍA
// ===================================================================

/**
 * GET /api/suppliers/deleted
 * Obtener terceros eliminados (soft deleted)
 */
router.get('/deleted/list',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin'),
  async (req, res) => {
    try {
      const filter = { deleted: true };

      if (req.companyId && req.companyId !== 'ALL') {
        filter.company = req.companyId;
      }

      const deletedSuppliers = await Supplier.find(filter)
        .populate('deletedBy', 'name email')
        .populate('company', 'name')
        .populate('third_party_type', 'code label')
        .sort({ deletedAt: -1 })
        .limit(100);

      res.json({
        success: true,
        count: deletedSuppliers.length,
        suppliers: deletedSuppliers
      });
    } catch (error) {
      console.error('Error al obtener terceros eliminados:', error);
      res.status(500).json({ error: 'Error al obtener terceros eliminados' });
    }
  }
);

/**
 * POST /api/suppliers/:id/restore
 * Restaurar un tercero eliminado
 */
router.post('/:id/restore',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin'),
  auditSupplierOperation('RESTORE'),
  async (req, res) => {
    try {
      const query = { _id: req.params.id };
      if (req.companyId && req.companyId !== 'ALL') {
        query.company = req.companyId;
      }

      const supplier = await Supplier.findOne(query);

      if (!supplier) {
        return res.status(404).json({ error: 'Tercero no encontrado' });
      }

      if (!supplier.deleted) {
        return res.status(400).json({
          error: 'Este tercero no está eliminado',
          message: 'Solo se pueden restaurar terceros que han sido eliminados'
        });
      }

      // Restaurar
      await supplier.restore();

      console.log(`♻️  Tercero restaurado: ${supplier.legal_name}`);

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'RESTORE',
        entity_type: 'supplier',
        entity_id: supplier._id,
        description: `Restauró el tercero: ${supplier.legal_name}`,
        company: supplier.company
      });

      res.json({
        success: true,
        message: 'Tercero restaurado exitosamente',
        supplier
      });
    } catch (error) {
      console.error('Error al restaurar tercero:', error);
      res.status(500).json({ error: 'Error al restaurar tercero' });
    }
  }
);

/**
 * GET /api/suppliers/:id/audit-history
 * Obtener historial de auditoría de un tercero
 */
router.get('/:id/audit-history',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin'),
  async (req, res) => {
    try {
      const { limit = 50, skip = 0 } = req.query;

      const history = await SupplierAuditLog.getSupplierHistory(
        req.params.id,
        { limit: parseInt(limit), skip: parseInt(skip) }
      );

      res.json({
        success: true,
        count: history.length,
        history
      });
    } catch (error) {
      console.error('Error al obtener historial:', error);
      res.status(500).json({ error: 'Error al obtener historial de auditoría' });
    }
  }
);

/**
 * GET /api/suppliers/audit/suspicious
 * Obtener operaciones sospechosas
 */
router.get('/audit/suspicious',
  authenticate,
  verifyTenant,
  authorize('super_admin'),
  async (req, res) => {
    try {
      const { limit = 100, hours = 24 } = req.query;

      const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

      const suspicious = await SupplierAuditLog.getSuspiciousOperations({
        limit: parseInt(limit),
        since
      });

      res.json({
        success: true,
        count: suspicious.length,
        operations: suspicious
      });
    } catch (error) {
      console.error('Error al obtener operaciones sospechosas:', error);
      res.status(500).json({ error: 'Error al obtener operaciones sospechosas' });
    }
  }
);

/**
 * DELETE /api/suppliers/:id/permanent
 * Eliminación PERMANENTE (solo super_admin, requiere confirmación)
 */
router.delete('/:id/permanent',
  authenticate,
  verifyTenant,
  authorize('super_admin'),
  backupBeforeCriticalOperation,
  async (req, res) => {
    try {
      const { confirmation } = req.body;

      if (confirmation !== 'DELETE_PERMANENTLY') {
        return res.status(400).json({
          error: 'Se requiere confirmación explícita',
          message: 'Debes enviar { "confirmation": "DELETE_PERMANENTLY" } para confirmar la eliminación permanente',
          warning: 'Esta acción NO se puede deshacer'
        });
      }

      const query = { _id: req.params.id };
      if (req.companyId && req.companyId !== 'ALL') {
        query.company = req.companyId;
      }

      const supplier = await Supplier.findOne(query);

      if (!supplier) {
        return res.status(404).json({ error: 'Tercero no encontrado' });
      }

      // Crear log de auditoría antes de eliminar
      await SupplierAuditLog.logOperation({
        supplier: supplier._id,
        operation: 'PERMANENT_DELETE',
        performedBy: req.user._id || req.user.id,
        company: supplier.company,
        stateBefore: supplier,
        stateAfter: null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        reason: req.body.reason || 'Eliminación permanente solicitada',
        metadata: {
          backupFile: req.backupFile,
          warning: 'PERMANENT_DELETION'
        }
      });

      // Eliminación física
      await Supplier.deleteOne({ _id: req.params.id });

      console.error(`🚨 ELIMINACIÓN PERMANENTE: ${supplier.legal_name} por ${req.user.email}`);

      res.json({
        success: true,
        message: 'Tercero eliminado permanentemente',
        warning: 'Esta acción no se puede deshacer',
        backupFile: req.backupFile
      });
    } catch (error) {
      console.error('Error en eliminación permanente:', error);
      res.status(500).json({ error: 'Error en eliminación permanente' });
    }
  }
);

// ===================================================================
// CONSOLIDACIÓN DE CONTRATOS POR TERCERO
// ===================================================================

/**
 * GET /api/suppliers/contracts/consolidated
 * Obtener todos los terceros con sus contratos asociados
 * Respeta permisos de empresa según el rol del usuario
 */
router.get('/contracts/consolidated',
  authenticate,
  verifyTenant,
  async (req, res) => {
    try {
      const { search, includeInactive, sortBy = 'contract_count' } = req.query;

      // Construir filtro base para terceros
      const supplierFilter = {
        deleted: { $ne: true }
      };

      // Filtrar por empresa según permisos
      if (req.companyId && req.companyId !== 'ALL') {
        supplierFilter.company = req.companyId;
      }

      // Por defecto, solo terceros activos
      if (includeInactive !== 'true') {
        supplierFilter.active = true;
      }

      // Búsqueda por nombre o identificación
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        supplierFilter.$or = [
          { legal_name: searchRegex },
          { identification_number: searchRegex },
          { email: searchRegex }
        ];
      }

      // Obtener terceros
      const suppliers = await Supplier.find(supplierFilter)
        .populate('third_party_type', 'code label icon')
        .populate('company', 'name')
        .select('legal_name legal_name_short full_name identification_type identification_number email phone address city active third_party_type company')
        .lean();

      // Para cada tercero, buscar contratos asociados
      const consolidatedData = await Promise.all(
        suppliers.map(async (supplier) => {
          // Construir filtro de contratos
          const contractFilter = {
            $or: [
              { content: { $regex: supplier.legal_name, $options: 'i' } },
              { content: { $regex: supplier.identification_number, $options: 'i' } }
            ]
          };

          // Filtrar contratos por empresa si es necesario
          if (req.companyId && req.companyId !== 'ALL') {
            contractFilter.company = req.companyId;
          }

          // Buscar contratos
          const contracts = await Contract.find(contractFilter)
            .populate('template', 'name category')
            .populate('generated_by', 'name email')
            .select('contract_number title status createdAt template generated_by company company_name')
            .sort({ createdAt: -1 })
            .lean();

          // Buscar perfiles de tercero (ThirdPartyProfile)
          const ThirdPartyProfile = require('../models/ThirdPartyProfile');
          const profileFilter = { supplier: supplier._id, active: true };
          if (req.companyId && req.companyId !== 'ALL') {
            profileFilter.company = req.companyId;
          }

          const profiles = await ThirdPartyProfile.find(profileFilter)
            .populate('template', 'name category')
            .select('template role_in_template role_label usage_count last_used_at completeness is_complete')
            .lean();

          // Estadísticas de contratos por estado
          const contractStats = {
            total: contracts.length,
            by_status: {}
          };

          contracts.forEach(contract => {
            const status = contract.status || 'unknown';
            contractStats.by_status[status] = (contractStats.by_status[status] || 0) + 1;
          });

          return {
            supplier: {
              _id: supplier._id,
              legal_name: supplier.legal_name,
              legal_name_short: supplier.legal_name_short,
              full_name: supplier.full_name,
              identification_type: supplier.identification_type,
              identification_number: supplier.identification_number,
              email: supplier.email,
              phone: supplier.phone,
              address: supplier.address,
              city: supplier.city,
              active: supplier.active,
              third_party_type: supplier.third_party_type,
              company: supplier.company
            },
            contracts: contracts,
            profiles: profiles,
            stats: contractStats,
            profile_count: profiles.length
          };
        })
      );

      // Filtrar solo terceros con al menos un contrato (opcional)
      let filteredData = consolidatedData;
      if (req.query.withContractsOnly === 'true') {
        filteredData = consolidatedData.filter(item => item.stats.total > 0);
      }

      // Ordenar según el criterio solicitado
      if (sortBy === 'contract_count') {
        filteredData.sort((a, b) => b.stats.total - a.stats.total);
      } else if (sortBy === 'name') {
        filteredData.sort((a, b) => (a.supplier.legal_name || '').localeCompare(b.supplier.legal_name || ''));
      } else if (sortBy === 'recent') {
        filteredData.sort((a, b) => {
          const aDate = a.contracts[0]?.createdAt || new Date(0);
          const bDate = b.contracts[0]?.createdAt || new Date(0);
          return new Date(bDate) - new Date(aDate);
        });
      }

      // Calcular totales
      const totals = {
        suppliers_count: filteredData.length,
        total_contracts: filteredData.reduce((sum, item) => sum + item.stats.total, 0),
        suppliers_with_contracts: filteredData.filter(item => item.stats.total > 0).length,
        suppliers_without_contracts: filteredData.filter(item => item.stats.total === 0).length
      };

      res.json({
        success: true,
        totals,
        data: filteredData
      });
    } catch (error) {
      console.error('Error al obtener contratos consolidados por tercero:', error);
      res.status(500).json({ error: 'Error al obtener datos consolidados' });
    }
  }
);

/**
 * GET /api/suppliers/:id/contracts
 * Obtener todos los contratos de un tercero específico
 */
router.get('/:id/contracts',
  authenticate,
  verifyTenant,
  async (req, res) => {
    try {
      // Buscar el tercero
      const supplierQuery = { _id: req.params.id };
      if (req.companyId && req.companyId !== 'ALL') {
        supplierQuery.company = req.companyId;
      }

      const supplier = await Supplier.findOne(supplierQuery)
        .populate('third_party_type', 'code label icon')
        .lean();

      if (!supplier) {
        return res.status(404).json({ error: 'Tercero no encontrado' });
      }

      // Buscar contratos
      const contractFilter = {
        $or: [
          { content: { $regex: supplier.legal_name, $options: 'i' } },
          { content: { $regex: supplier.identification_number, $options: 'i' } }
        ]
      };

      if (req.companyId && req.companyId !== 'ALL') {
        contractFilter.company = req.companyId;
      }

      const contracts = await Contract.find(contractFilter)
        .populate('template', 'name category third_party_type')
        .populate('generated_by', 'name email')
        .select('contract_number title content description status createdAt template generated_by company company_name file_path')
        .sort({ createdAt: -1 })
        .lean();

      // Buscar perfiles
      const ThirdPartyProfile = require('../models/ThirdPartyProfile');
      const profileFilter = { supplier: supplier._id, active: true };
      if (req.companyId && req.companyId !== 'ALL') {
        profileFilter.company = req.companyId;
      }

      const profiles = await ThirdPartyProfile.find(profileFilter)
        .populate('template', 'name category')
        .lean();

      // Estadísticas
      const stats = {
        total_contracts: contracts.length,
        by_status: {},
        by_template: {},
        recent_activity: contracts.slice(0, 5)
      };

      contracts.forEach(contract => {
        // Por estado
        const status = contract.status || 'unknown';
        stats.by_status[status] = (stats.by_status[status] || 0) + 1;

        // Por plantilla
        const templateName = contract.template?.name || 'Sin plantilla';
        stats.by_template[templateName] = (stats.by_template[templateName] || 0) + 1;
      });

      res.json({
        success: true,
        supplier,
        contracts,
        profiles,
        stats
      });
    } catch (error) {
      console.error('Error al obtener contratos del tercero:', error);
      res.status(500).json({ error: 'Error al obtener contratos del tercero' });
    }
  }
);

module.exports = router;
