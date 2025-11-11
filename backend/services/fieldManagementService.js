/**
 * Servicio robusto de gestión de campos dinámicos para terceros
 * Este servicio centraliza toda la lógica de campos personalizados
 */

const Supplier = require('../models/Supplier');
const ContractTemplate = require('../models/ContractTemplate');
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');

class FieldManagementService {
  /**
   * Normaliza un nombre de campo para comparación
   */
  static normalizeFieldName(name) {
    if (!name) return '';
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .toLowerCase()
      .trim()
      .replace(/[_\s\/\-]+/g, '_') // Unificar separadores
      .replace(/_+/g, '_') // Remover duplicados
      .replace(/^_|_$/g, ''); // Remover extremos
  }

  /**
   * Convierte un label legible a nombre de campo normalizado
   */
  static labelToFieldName(label) {
    return this.normalizeFieldName(label);
  }

  /**
   * Extrae todos los campos del tercero (estándar + custom)
   */
  static extractSupplierFields(supplier) {
    const fields = new Map();

    // Mapeo de campos estándar del modelo
    const standardFieldMap = {
      legal_name: 'razon_social',
      legal_name_short: 'razon_social_corta',
      full_name: 'nombre_completo',
      identification_type: 'tipo_identificacion',
      identification_number: 'numero_identificacion',
      id_issue_city: 'ciudad_expedicion',
      legal_representative_name: 'representante_legal',
      legal_representative_id_type: 'tipo_id_representante',
      legal_representative_id_number: 'numero_id_representante',
      licensee_name: 'licenciatario',
      email: 'email',
      phone: 'telefono',
      address: 'direccion',
      city: 'ciudad',
      country: 'pais'
    };

    // Agregar campos estándar
    Object.entries(standardFieldMap).forEach(([modelField, normalizedName]) => {
      if (supplier[modelField]) {
        fields.set(normalizedName, {
          name: normalizedName,
          value: supplier[modelField],
          source: 'standard',
          originalField: modelField
        });
      }
    });

    // Agregar campos personalizados
    if (supplier.custom_fields && supplier.custom_fields instanceof Map) {
      supplier.custom_fields.forEach((value, key) => {
        if (value !== null && value !== undefined && value !== '') {
          const normalized = this.normalizeFieldName(key);
          fields.set(normalized, {
            name: normalized,
            value: value,
            source: 'custom',
            originalKey: key
          });
        }
      });
    } else if (supplier.custom_fields && typeof supplier.custom_fields === 'object') {
      Object.entries(supplier.custom_fields).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          const normalized = this.normalizeFieldName(key);
          fields.set(normalized, {
            name: normalized,
            value: value,
            source: 'custom',
            originalKey: key
          });
        }
      });
    }

    return fields;
  }

  /**
   * Compara dos nombres de campos y determina si coinciden
   */
  static fieldsMatch(fieldName1, fieldName2) {
    const norm1 = this.normalizeFieldName(fieldName1);
    const norm2 = this.normalizeFieldName(fieldName2);

    // Coincidencia exacta
    if (norm1 === norm2) return true;

    // Coincidencia parcial (uno contiene al otro)
    if (norm1.length > 3 && norm2.length > 3) {
      if (norm1.includes(norm2) || norm2.includes(norm1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Obtiene todos los campos requeridos por plantillas de un tipo de tercero
   */
  static async getRequiredFieldsForType(thirdPartyTypeCode, companyId) {
    const templates = await ContractTemplate.find({
      company: companyId,
      third_party_type: thirdPartyTypeCode,
      active: true
    }).select('name category fields');

    const requiredFieldsMap = new Map();

    templates.forEach(template => {
      if (template.fields && Array.isArray(template.fields)) {
        template.fields.forEach(field => {
          const fieldName = field.field_name || field.name;
          const fieldLabel = field.field_label || field.label || fieldName;
          const normalized = this.normalizeFieldName(fieldName);

          if (!requiredFieldsMap.has(normalized)) {
            requiredFieldsMap.set(normalized, {
              name: normalized,
              label: fieldLabel,
              type: field.field_type || field.type || 'text',
              required: field.required || false,
              usedInTemplates: [template.name],
              templateIds: [template._id]
            });
          } else {
            const existing = requiredFieldsMap.get(normalized);
            existing.usedInTemplates.push(template.name);
            existing.templateIds.push(template._id);
            if (field.required) {
              existing.required = true;
            }
          }
        });
      }
    });

    return requiredFieldsMap;
  }

  /**
   * Analiza qué campos le faltan a un tercero
   */
  static async analyzeMissingFields(supplier, companyId) {
    if (!supplier.third_party_type) {
      return {
        hasType: false,
        currentFields: [],
        missingFields: [],
        matchedFields: [],
        completionPercentage: 0
      };
    }

    // Obtener código del tipo de tercero
    let typeCode;
    if (typeof supplier.third_party_type === 'object') {
      typeCode = supplier.third_party_type.code;
    } else {
      const typeConfig = await ThirdPartyTypeConfig.findById(supplier.third_party_type);
      typeCode = typeConfig?.code;
    }

    if (!typeCode) {
      return {
        hasType: false,
        currentFields: [],
        missingFields: [],
        matchedFields: [],
        completionPercentage: 0
      };
    }

    // Extraer campos actuales del tercero
    const currentFields = this.extractSupplierFields(supplier);

    // Obtener campos requeridos por plantillas
    const requiredFields = await this.getRequiredFieldsForType(typeCode, companyId);

    const missingFields = [];
    const matchedFields = [];

    // Comparar campos requeridos vs actuales
    requiredFields.forEach((requiredField, requiredName) => {
      let found = false;

      for (const [currentName, currentField] of currentFields) {
        if (this.fieldsMatch(currentName, requiredName)) {
          found = true;
          matchedFields.push({
            ...requiredField,
            currentValue: currentField.value,
            currentName: currentName
          });
          break;
        }
      }

      if (!found) {
        missingFields.push(requiredField);
      }
    });

    const totalFields = matchedFields.length + missingFields.length;
    const completionPercentage = totalFields > 0
      ? Math.round((matchedFields.length / totalFields) * 100)
      : 100;

    return {
      hasType: true,
      typeCode,
      currentFields: Array.from(currentFields.keys()),
      currentFieldsDetail: Array.from(currentFields.values()),
      missingFields,
      matchedFields,
      totalRequired: requiredFields.size,
      totalMatched: matchedFields.length,
      totalMissing: missingFields.length,
      completionPercentage
    };
  }

  /**
   * Agrega o actualiza campos en un tercero
   */
  static async updateSupplierFields(supplierId, fieldsToUpdate, userId) {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw new Error('Tercero no encontrado');
    }

    if (!supplier.custom_fields) {
      supplier.custom_fields = new Map();
    }

    const updates = {
      fieldsAdded: [],
      fieldsUpdated: [],
      errors: []
    };

    fieldsToUpdate.forEach(({ name, value, label }) => {
      const normalizedName = this.normalizeFieldName(name);

      if (!normalizedName) {
        updates.errors.push({ name, error: 'Nombre de campo inválido' });
        return;
      }

      if (value === null || value === undefined) {
        updates.errors.push({ name, error: 'Valor no puede ser nulo' });
        return;
      }

      const fieldKey = label || normalizedName;
      const existingValue = supplier.custom_fields.get(normalizedName) ||
                           supplier.custom_fields.get(fieldKey);

      if (existingValue) {
        supplier.custom_fields.set(normalizedName, value);
        updates.fieldsUpdated.push({
          name: normalizedName,
          oldValue: existingValue,
          newValue: value
        });
      } else {
        supplier.custom_fields.set(normalizedName, value);
        updates.fieldsAdded.push({
          name: normalizedName,
          value: value
        });
      }
    });

    supplier.updated_by = userId;
    await supplier.save();

    return {
      success: true,
      supplier,
      updates
    };
  }

  /**
   * Migra campos antiguos a nombres normalizados
   */
  static async migrateSupplierFieldNames(supplierId, userId) {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier || !supplier.custom_fields) {
      return { migrated: false, reason: 'Sin campos personalizados' };
    }

    const oldFields = new Map(supplier.custom_fields);
    const newFields = new Map();
    const migrations = [];

    oldFields.forEach((value, key) => {
      const normalized = this.normalizeFieldName(key);

      if (normalized !== key) {
        migrations.push({
          oldKey: key,
          newKey: normalized,
          value: value
        });
      }

      newFields.set(normalized, value);
    });

    if (migrations.length > 0) {
      supplier.custom_fields = newFields;
      supplier.updated_by = userId;
      await supplier.save();

      return {
        migrated: true,
        migrationsCount: migrations.length,
        migrations
      };
    }

    return {
      migrated: false,
      reason: 'Todos los campos ya están normalizados'
    };
  }

  /**
   * Genera sugerencias inteligentes basadas en otros terceros similares
   */
  static async getSuggestionsFromSimilarSuppliers(supplier, companyId) {
    if (!supplier.third_party_type) {
      return [];
    }

    // Buscar terceros similares del mismo tipo
    const similarSuppliers = await Supplier.find({
      company: companyId,
      third_party_type: supplier.third_party_type,
      _id: { $ne: supplier._id },
      active: true
    }).limit(10);

    const fieldFrequency = new Map();

    similarSuppliers.forEach(similar => {
      const fields = this.extractSupplierFields(similar);
      fields.forEach((field, fieldName) => {
        if (!fieldFrequency.has(fieldName)) {
          fieldFrequency.set(fieldName, {
            count: 0,
            sampleValues: [],
            field: field
          });
        }
        const freq = fieldFrequency.get(fieldName);
        freq.count++;
        if (freq.sampleValues.length < 3) {
          freq.sampleValues.push(field.value);
        }
      });
    });

    // Filtrar campos que el tercero actual ya tiene
    const currentFields = this.extractSupplierFields(supplier);
    const suggestions = [];

    fieldFrequency.forEach((freq, fieldName) => {
      let hasField = false;
      for (const currentName of currentFields.keys()) {
        if (this.fieldsMatch(currentName, fieldName)) {
          hasField = true;
          break;
        }
      }

      if (!hasField && freq.count >= 2) { // Presente en al menos 2 terceros
        suggestions.push({
          fieldName,
          frequency: freq.count,
          totalSimilar: similarSuppliers.length,
          percentage: Math.round((freq.count / similarSuppliers.length) * 100),
          sampleValues: freq.sampleValues,
          recommended: freq.count >= similarSuppliers.length * 0.5 // 50%+ lo tienen
        });
      }
    });

    return suggestions.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Valida que un tercero tenga los campos mínimos para usar una plantilla
   */
  static async validateSupplierForTemplate(supplierId, templateId) {
    const supplier = await Supplier.findById(supplierId);
    const template = await ContractTemplate.findById(templateId);

    if (!supplier || !template) {
      throw new Error('Tercero o plantilla no encontrado');
    }

    const supplierFields = this.extractSupplierFields(supplier);
    const requiredFields = template.fields || [];

    const validation = {
      valid: true,
      missingRequired: [],
      missingOptional: [],
      matchedFields: []
    };

    requiredFields.forEach(templateField => {
      const fieldName = templateField.field_name || templateField.name;
      const normalized = this.normalizeFieldName(fieldName);

      let found = false;
      for (const [supplierFieldName, supplierField] of supplierFields) {
        if (this.fieldsMatch(supplierFieldName, normalized)) {
          found = true;
          validation.matchedFields.push({
            templateField: fieldName,
            supplierField: supplierFieldName,
            value: supplierField.value
          });
          break;
        }
      }

      if (!found) {
        const missingField = {
          name: fieldName,
          label: templateField.field_label || templateField.label || fieldName,
          type: templateField.field_type || templateField.type || 'text'
        };

        if (templateField.required) {
          validation.valid = false;
          validation.missingRequired.push(missingField);
        } else {
          validation.missingOptional.push(missingField);
        }
      }
    });

    return validation;
  }
}

module.exports = FieldManagementService;
