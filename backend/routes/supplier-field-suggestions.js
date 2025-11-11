/**
 * Rutas para sugerencias inteligentes de campos de terceros
 * Analiza plantillas y sugiere campos faltantes
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const Supplier = require('../models/Supplier');
const ContractTemplate = require('../models/ContractTemplate');

/**
 * Normaliza un nombre de campo para comparación
 */
function normalizeFieldName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .toLowerCase()
    .replace(/[_\s\/\-]+/g, '') // Remover separadores
    .replace(/de/g, '') // Remover palabras comunes
    .replace(/del/g, '')
    .replace(/la/g, '')
    .replace(/el/g, '');
}

/**
 * Verifica si un campo del tercero coincide con un campo de plantilla
 */
function fieldsMatch(supplierFieldName, templateFieldName) {
  const normalized1 = normalizeFieldName(supplierFieldName);
  const normalized2 = normalizeFieldName(templateFieldName);

  // Coincidencia exacta
  if (normalized1 === normalized2) return true;

  // Coincidencia parcial (uno contiene al otro)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }

  return false;
}

/**
 * GET /api/supplier-field-suggestions/:supplierId/missing-fields
 * Analiza qué campos le faltan a un tercero para usar ciertas plantillas
 */
router.get('/:supplierId/missing-fields', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { templateId } = req.query; // Opcional: analizar solo una plantilla

    // Obtener el tercero
    const supplier = await Supplier.findOne({
      _id: supplierId,
      company: req.companyId
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    // Construir lista de campos actuales del tercero
    const supplierFields = new Set();

    // Campos estándar del modelo
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

    // Obtener plantillas a analizar
    let templates;
    if (templateId) {
      templates = await ContractTemplate.find({
        _id: templateId,
        company: req.companyId,
        active: true
      });
    } else {
      // Todas las plantillas de la empresa
      templates = await ContractTemplate.find({
        company: req.companyId,
        active: true
      }).select('name category fields');
    }

    // Analizar cada plantilla
    const analysis = [];

    for (const template of templates) {
      const missingFields = [];
      const matchedFields = [];

      // Analizar cada campo de la plantilla
      if (template.fields && Array.isArray(template.fields)) {
        for (const templateField of template.fields) {
          const fieldName = templateField.field_name || templateField.name;
          const fieldLabel = templateField.field_label || templateField.label || fieldName;

          // Verificar si el tercero tiene este campo
          let found = false;

          for (const supplierField of supplierFields) {
            if (fieldsMatch(supplierField, fieldName)) {
              found = true;
              matchedFields.push({
                template_field: fieldName,
                template_label: fieldLabel,
                supplier_field: supplierField,
                value: supplier.custom_fields?.[supplierField] ||
                       supplier[supplierField] ||
                       supplier[fieldName]
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
              description: templateField.description || `Campo requerido por la plantilla ${template.name}`
            });
          }
        }
      }

      // Solo incluir plantillas donde faltan campos
      if (missingFields.length > 0) {
        analysis.push({
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

    // Ordenar por porcentaje de completitud (más completas primero)
    analysis.sort((a, b) => b.completion_percentage - a.completion_percentage);

    res.json({
      supplier: {
        id: supplier._id,
        name: supplier.legal_name || supplier.full_name,
        type: supplier.supplier_type
      },
      current_fields: Array.from(supplierFields),
      templates_analyzed: templates.length,
      templates_needing_fields: analysis.length,
      suggestions: analysis
    });

  } catch (error) {
    console.error('Error al analizar campos faltantes:', error);
    res.status(500).json({ error: 'Error al analizar campos faltantes' });
  }
});

/**
 * GET /api/supplier-field-suggestions/:supplierId/field-suggestions
 * Sugiere campos comunes que el tercero podría agregar
 */
router.get('/:supplierId/field-suggestions', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { supplierId } = req.params;

    const supplier = await Supplier.findOne({
      _id: supplierId,
      company: req.companyId
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    // Campos comunes por tipo de tercero
    const commonFieldsByType = {
      proveedor: [
        { name: 'licenciatario', label: 'Licenciatario', type: 'text' },
        { name: 'banco', label: 'Banco', type: 'text' },
        { name: 'cuenta_bancaria', label: 'Cuenta Bancaria', type: 'text' },
        { name: 'tipo_cuenta', label: 'Tipo de Cuenta', type: 'select', options: ['Ahorros', 'Corriente'] },
        { name: 'actividad_economica', label: 'Actividad Económica', type: 'text' }
      ],
      cliente: [
        { name: 'sector', label: 'Sector', type: 'text' },
        { name: 'contacto_principal', label: 'Contacto Principal', type: 'text' },
        { name: 'telefono_alternativo', label: 'Teléfono Alternativo', type: 'text' }
      ],
      empleado: [
        { name: 'fecha_ingreso', label: 'Fecha de Ingreso', type: 'date' },
        { name: 'tipo_contrato', label: 'Tipo de Contrato', type: 'select', options: ['Indefinido', 'Fijo', 'Obra o Labor'] },
        { name: 'area', label: 'Área', type: 'text' }
      ],
      arrendador: [
        { name: 'matricula_inmobiliaria', label: 'Matrícula Inmobiliaria', type: 'text' },
        { name: 'cedula_catastral', label: 'Cédula Catastral', type: 'text' }
      ],
      arrendatario: [
        { name: 'ingresos_mensuales', label: 'Ingresos Mensuales', type: 'number' },
        { name: 'numero_personas_hogar', label: 'Número de Personas en el Hogar', type: 'number' }
      ],
      contratista: [
        { name: 'especialidad', label: 'Especialidad', type: 'text' },
        { name: 'tarifa_hora', label: 'Tarifa por Hora', type: 'number' }
      ]
    };

    const suggestions = commonFieldsByType[supplier.supplier_type] || [];

    // Filtrar campos que ya tiene
    const currentFields = new Set([
      ...Object.keys(supplier.custom_fields || {}),
      'razon_social',
      'numero_identificacion',
      'email',
      'telefono'
    ]);

    const missing = suggestions.filter(field => !currentFields.has(field.name));

    res.json({
      supplier: {
        id: supplier._id,
        name: supplier.legal_name || supplier.full_name,
        type: supplier.supplier_type
      },
      suggested_fields: missing
    });

  } catch (error) {
    console.error('Error al obtener sugerencias:', error);
    res.status(500).json({ error: 'Error al obtener sugerencias' });
  }
});

/**
 * PATCH /api/supplier-field-suggestions/:supplierId/add-fields
 * Agrega campos sugeridos a un tercero
 */
router.patch('/:supplierId/add-fields', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { fields } = req.body; // Array de { name, value }

    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ error: 'Se requiere un array de campos' });
    }

    const supplier = await Supplier.findOne({
      _id: supplierId,
      company: req.companyId
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    // Actualizar campos personalizados
    if (!supplier.custom_fields) {
      supplier.custom_fields = {};
    }

    let fieldsAdded = 0;
    let fieldsUpdated = 0;

    fields.forEach(({ name, value }) => {
      if (name && value !== undefined && value !== null && value !== '') {
        if (supplier.custom_fields[name]) {
          fieldsUpdated++;
        } else {
          fieldsAdded++;
        }
        supplier.custom_fields[name] = value;
      }
    });

    await supplier.save();

    res.json({
      message: 'Campos actualizados exitosamente',
      fields_added: fieldsAdded,
      fields_updated: fieldsUpdated,
      supplier: {
        id: supplier._id,
        name: supplier.legal_name || supplier.full_name
      }
    });

  } catch (error) {
    console.error('Error al agregar campos:', error);
    res.status(500).json({ error: 'Error al agregar campos' });
  }
});

module.exports = router;
