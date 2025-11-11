const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');
const ActivityLog = require('../models/ActivityLog');
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');

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
    const { active } = req.query;

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

    const suppliers = await Supplier.find(filter)
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email')
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

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.companyId
    })
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

        // Buscar plantillas que usan este tipo de tercero
        const templates = await ContractTemplate.find({
          company: req.companyId,
          active: true,
          third_party_type: supplier.third_party_type.code
        }).select('name category fields');

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
        console.log('❌ Errores de validación:', errors.array());
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

      // Verificar si ya existe un proveedor con ese número de identificación en esta empresa
      const existingSupplier = await Supplier.findOne({
        company: req.companyId,
        identification_number
      });

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
        company: req.companyId,
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
        company: req.companyId
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
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        company: req.companyId
      });

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
        const existingSupplier = await Supplier.findOne({
          company: req.companyId,
          identification_number,
          _id: { $ne: req.params.id }
        });

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
        company: req.companyId
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
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        company: req.companyId
      });

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
        company: req.companyId
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

// Eliminar proveedor (solo si no tiene referencias)
router.delete('/:id',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin', 'lawyer'),
  async (req, res) => {
    try {
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        company: req.companyId
      }).populate('third_party_type', 'code');

      if (!supplier) {
        return res.status(404).json({ error: 'Tercero no encontrado' });
      }

      // Verificar referencias antes de eliminar
      const contractsWithReference = await Contract.find({
        company: req.companyId,
        $or: [
          { content: { $regex: supplier.legal_name, $options: 'i' } },
          { content: { $regex: supplier.identification_number, $options: 'i' } },
          { title: { $regex: supplier.legal_name, $options: 'i' } }
        ]
      }).countDocuments();

      let templatesWithType = 0;
      if (supplier.third_party_type) {
        templatesWithType = await ContractTemplate.find({
          company: req.companyId,
          third_party_type: supplier.third_party_type.code,
          active: true
        }).countDocuments();
      }

      // Si tiene referencias, no permitir eliminación
      if (contractsWithReference > 0 || templatesWithType > 0) {
        return res.status(400).json({
          error: 'No se puede eliminar este tercero porque tiene referencias en contratos o plantillas',
          details: {
            contracts: contractsWithReference,
            templates: templatesWithType
          },
          suggestion: 'Desactiva el tercero en lugar de eliminarlo'
        });
      }

      // Si no tiene referencias, permitir eliminación
      await Supplier.deleteOne({ _id: req.params.id });

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'DELETE',
        entity_type: 'supplier',
        entity_id: req.params.id,
        description: `Eliminó el tercero: ${supplier.legal_name}`,
        company: req.companyId
      });

      res.json({
        success: true,
        message: 'Tercero eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar tercero:', error);
      res.status(500).json({ error: 'Error al eliminar tercero' });
    }
  }
);

module.exports = router;
