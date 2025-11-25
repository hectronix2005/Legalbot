/**
 * Modelo de Perfil de Tercero por Plantilla
 *
 * Permite que un mismo tercero tenga diferentes perfiles según cada plantilla,
 * con campos específicos mapeados a las variables de la plantilla.
 *
 * Ejemplo:
 * - Juan Pérez puede ser "arrendador" en Contrato de Arrendamiento
 * - Juan Pérez puede ser "contratista" en Contrato de Servicios
 *
 * Cada perfil guarda los campos específicos para ese rol en esa plantilla.
 */

const mongoose = require('mongoose');

const fieldMappingSchema = new mongoose.Schema({
  template_variable: {
    type: String,
    required: true,
    description: 'Variable de la plantilla, ej: {{arrendador_nombre}}'
  },
  source_field: {
    type: String,
    description: 'Campo fuente: "legal_name", "identification_number" o nombre de custom_field'
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Valor actual del campo'
  },
  is_auto_filled: {
    type: Boolean,
    default: false,
    description: 'Si fue llenado automáticamente desde el tercero base'
  },
  last_updated: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Esquema para variantes de un perfil
 * Permite múltiples configuraciones del mismo tercero para la misma plantilla/rol
 */
const profileVariantSchema = new mongoose.Schema({
  variant_name: {
    type: String,
    required: true,
    trim: true,
    description: 'Nombre descriptivo de la variante (ej: "Contrato Residencial", "Contrato Comercial")'
  },
  variant_description: {
    type: String,
    default: '',
    trim: true,
    description: 'Descripción del contexto o escenario de uso de esta variante'
  },
  context_tags: {
    type: [String],
    default: [],
    description: 'Etiquetas para clasificar contexto: "residencial", "comercial", "corto_plazo", etc.'
  },
  field_mappings: {
    type: [fieldMappingSchema],
    default: [],
    description: 'Mapeo de campos específico para esta variante'
  },
  template_specific_fields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Campos específicos con valores para esta variante'
  },
  is_default: {
    type: Boolean,
    default: false,
    description: 'Si es la variante por defecto para este perfil'
  },
  active: {
    type: Boolean,
    default: true,
    description: 'Si la variante está activa'
  },
  usage_count: {
    type: Number,
    default: 0,
    description: 'Veces que se ha usado esta variante'
  },
  last_used_in_contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    description: 'Último contrato donde se usó esta variante'
  },
  last_used_at: {
    type: Date,
    description: 'Fecha del último uso de esta variante'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Usuario que creó la variante'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Usuario que actualizó la variante'
  }
}, {
  timestamps: true,
  _id: true
});

const completenessSchema = new mongoose.Schema({
  required_fields_count: {
    type: Number,
    default: 0,
    description: 'Total de campos requeridos por la plantilla'
  },
  filled_fields_count: {
    type: Number,
    default: 0,
    description: 'Campos que tienen valor'
  },
  percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    description: 'Porcentaje de completitud'
  },
  missing_fields: {
    type: [String],
    default: [],
    description: 'Lista de campos faltantes'
  }
}, { _id: false });

const thirdPartyProfileSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
    description: 'Tercero base asociado a este perfil'
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractTemplate',
    required: true,
    description: 'Plantilla para la cual se creó este perfil'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
    description: 'Empresa propietaria (multi-tenant)'
  },
  role_in_template: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    description: 'Rol del tercero en esta plantilla: arrendador, arrendatario, contratista, cliente, empleado, etc.'
  },
  role_label: {
    type: String,
    description: 'Etiqueta legible del rol, ej: "Arrendador (Propietario)"'
  },
  template_specific_fields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Campos específicos de esta plantilla con sus valores (DEPRECATED: usar variants)'
  },
  field_mappings: {
    type: [fieldMappingSchema],
    default: [],
    description: 'Mapeo detallado entre variables de plantilla y campos (DEPRECATED: usar variants)'
  },
  variants: {
    type: [profileVariantSchema],
    default: [],
    description: 'Variantes del perfil para diferentes contextos/escenarios'
  },
  completeness: {
    type: completenessSchema,
    default: () => ({
      required_fields_count: 0,
      filled_fields_count: 0,
      percentage: 0,
      missing_fields: []
    }),
    description: 'Métricas de completitud del perfil'
  },
  is_complete: {
    type: Boolean,
    default: false,
    description: 'Si el perfil tiene todos los campos requeridos'
  },
  last_used_in_contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    description: 'Último contrato donde se usó este perfil'
  },
  last_used_at: {
    type: Date,
    description: 'Fecha del último uso'
  },
  usage_count: {
    type: Number,
    default: 0,
    description: 'Número de veces que se ha usado este perfil'
  },
  notes: {
    type: String,
    default: '',
    description: 'Notas adicionales sobre este perfil'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Usuario que creó el perfil'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Usuario que actualizó el perfil por última vez'
  },
  active: {
    type: Boolean,
    default: true,
    description: 'Si el perfil está activo'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ===================================================================
// ÍNDICES
// ===================================================================

// Índice único: Un tercero puede tener solo un perfil por plantilla y rol
thirdPartyProfileSchema.index(
  { supplier: 1, template: 1, role_in_template: 1 },
  { unique: true }
);

// Índices para queries comunes
thirdPartyProfileSchema.index({ company: 1, template: 1 });
thirdPartyProfileSchema.index({ supplier: 1, company: 1 });
thirdPartyProfileSchema.index({ template: 1, active: 1 });
thirdPartyProfileSchema.index({ company: 1, active: 1, last_used_at: -1 });
thirdPartyProfileSchema.index({ usage_count: -1 }); // Para perfiles más usados

// ===================================================================
// VIRTUALS
// ===================================================================

// Virtual para obtener nombre del tercero
thirdPartyProfileSchema.virtual('supplier_name').get(function() {
  return this.populated('supplier')
    ? (this.supplier.legal_name || this.supplier.full_name)
    : undefined;
});

// Virtual para obtener nombre de plantilla
thirdPartyProfileSchema.virtual('template_name').get(function() {
  return this.populated('template')
    ? this.template.name
    : undefined;
});

// ===================================================================
// MÉTODOS DE INSTANCIA
// ===================================================================

/**
 * Calcula la completitud del perfil basado en los campos mapeados
 * Si hay variantes, calcula la completitud promedio de todas las variantes activas
 */
thirdPartyProfileSchema.methods.calculateCompleteness = function() {
  // Si hay variantes, calcular completitud promedio de variantes activas
  if (this.variants && this.variants.length > 0) {
    const activeVariants = this.variants.filter(v => v.active);

    if (activeVariants.length === 0) {
      this.completeness = {
        required_fields_count: 0,
        filled_fields_count: 0,
        percentage: 0,
        missing_fields: []
      };
      this.is_complete = false;
      return this.completeness;
    }

    let totalPercentage = 0;
    let totalRequired = 0;
    let totalFilled = 0;
    const allMissingFields = new Set();

    activeVariants.forEach(variant => {
      const requiredFields = variant.field_mappings.filter(m => m.template_variable);
      const filledFields = requiredFields.filter(m => {
        const value = m.value;
        return value !== null && value !== undefined && value !== '';
      });

      const percentage = requiredFields.length > 0
        ? Math.round((filledFields.length / requiredFields.length) * 100)
        : 0;

      totalPercentage += percentage;
      totalRequired += requiredFields.length;
      totalFilled += filledFields.length;

      requiredFields
        .filter(m => {
          const value = m.value;
          return value === null || value === undefined || value === '';
        })
        .forEach(m => allMissingFields.add(m.template_variable));
    });

    this.completeness = {
      required_fields_count: totalRequired,
      filled_fields_count: totalFilled,
      percentage: Math.round(totalPercentage / activeVariants.length),
      missing_fields: Array.from(allMissingFields)
    };

    this.is_complete = this.completeness.percentage === 100;
    return this.completeness;
  }

  // Fallback a la lógica original si no hay variantes
  const requiredFields = this.field_mappings.filter(m => m.template_variable);
  const filledFields = requiredFields.filter(m => {
    const value = m.value;
    return value !== null && value !== undefined && value !== '';
  });

  const missingFields = requiredFields
    .filter(m => {
      const value = m.value;
      return value === null || value === undefined || value === '';
    })
    .map(m => m.template_variable);

  this.completeness = {
    required_fields_count: requiredFields.length,
    filled_fields_count: filledFields.length,
    percentage: requiredFields.length > 0
      ? Math.round((filledFields.length / requiredFields.length) * 100)
      : 0,
    missing_fields: missingFields
  };

  this.is_complete = this.completeness.percentage === 100;

  return this.completeness;
};

/**
 * Marca el perfil como usado en un contrato
 */
thirdPartyProfileSchema.methods.recordUsage = function(contractId) {
  this.usage_count = (this.usage_count || 0) + 1;
  this.last_used_in_contract = contractId;
  this.last_used_at = new Date();
  return this.save();
};

/**
 * Actualiza un campo específico del perfil
 */
thirdPartyProfileSchema.methods.updateField = function(templateVariable, value, sourceField = null) {
  // Actualizar en field_mappings
  const mapping = this.field_mappings.find(m => m.template_variable === templateVariable);

  if (mapping) {
    mapping.value = value;
    mapping.last_updated = new Date();
    if (sourceField) {
      mapping.source_field = sourceField;
    }
  } else {
    this.field_mappings.push({
      template_variable: templateVariable,
      value: value,
      source_field: sourceField,
      is_auto_filled: false,
      last_updated: new Date()
    });
  }

  // Actualizar en template_specific_fields (quitar {{ }})
  const fieldName = templateVariable.replace(/[{}]/g, '');
  this.template_specific_fields.set(fieldName, value);

  // Recalcular completitud
  this.calculateCompleteness();

  return this;
};

/**
 * Obtiene el valor de un campo por variable de plantilla
 */
thirdPartyProfileSchema.methods.getFieldValue = function(templateVariable) {
  const mapping = this.field_mappings.find(m => m.template_variable === templateVariable);
  return mapping ? mapping.value : undefined;
};

/**
 * Crea una nueva variante del perfil
 */
thirdPartyProfileSchema.methods.createVariant = function(variantData, userId) {
  const newVariant = {
    variant_name: variantData.variant_name,
    variant_description: variantData.variant_description || '',
    context_tags: variantData.context_tags || [],
    field_mappings: variantData.field_mappings || [],
    template_specific_fields: variantData.template_specific_fields || new Map(),
    is_default: variantData.is_default || false,
    active: true,
    usage_count: 0,
    created_by: userId,
    updated_by: userId
  };

  // Si es la primera variante o está marcada como default, hacerla default
  if (this.variants.length === 0 || newVariant.is_default) {
    // Remover default de otras variantes
    this.variants.forEach(v => { v.is_default = false; });
    newVariant.is_default = true;
  }

  this.variants.push(newVariant);
  return this.variants[this.variants.length - 1];
};

/**
 * Actualiza una variante existente
 */
thirdPartyProfileSchema.methods.updateVariant = function(variantId, variantData, userId) {
  const variant = this.variants.id(variantId);

  if (!variant) {
    throw new Error('Variante no encontrada');
  }

  if (variantData.variant_name !== undefined) variant.variant_name = variantData.variant_name;
  if (variantData.variant_description !== undefined) variant.variant_description = variantData.variant_description;
  if (variantData.context_tags !== undefined) variant.context_tags = variantData.context_tags;
  if (variantData.field_mappings !== undefined) variant.field_mappings = variantData.field_mappings;
  if (variantData.template_specific_fields !== undefined) {
    variant.template_specific_fields = new Map(Object.entries(variantData.template_specific_fields));
  }

  // Si se marca como default, remover default de otras
  if (variantData.is_default === true) {
    this.variants.forEach(v => {
      if (v._id.toString() !== variantId) {
        v.is_default = false;
      }
    });
    variant.is_default = true;
  }

  variant.updated_by = userId;

  return variant;
};

/**
 * Elimina (desactiva) una variante
 */
thirdPartyProfileSchema.methods.deleteVariant = function(variantId) {
  const variant = this.variants.id(variantId);

  if (!variant) {
    throw new Error('Variante no encontrada');
  }

  // No permitir eliminar si es la única variante activa
  const activeVariants = this.variants.filter(v => v.active);
  if (activeVariants.length === 1 && variant.active) {
    throw new Error('No se puede eliminar la única variante activa');
  }

  variant.active = false;

  // Si era default, asignar default a otra variante activa
  if (variant.is_default) {
    const nextDefault = this.variants.find(v => v.active && v._id.toString() !== variantId);
    if (nextDefault) {
      nextDefault.is_default = true;
    }
  }

  return variant;
};

/**
 * Registra el uso de una variante específica
 */
thirdPartyProfileSchema.methods.recordVariantUsage = function(variantId, contractId) {
  const variant = this.variants.id(variantId);

  if (!variant) {
    throw new Error('Variante no encontrada');
  }

  variant.usage_count = (variant.usage_count || 0) + 1;
  variant.last_used_in_contract = contractId;
  variant.last_used_at = new Date();

  // También actualizar el perfil general
  this.usage_count = (this.usage_count || 0) + 1;
  this.last_used_in_contract = contractId;
  this.last_used_at = new Date();

  return this.save();
};

/**
 * Obtiene la variante por defecto o la primera activa
 */
thirdPartyProfileSchema.methods.getDefaultVariant = function() {
  if (!this.variants || this.variants.length === 0) {
    return null;
  }

  return this.variants.find(v => v.is_default && v.active)
      || this.variants.find(v => v.active)
      || null;
};

/**
 * Exporta los datos del perfil como objeto plano para generación de contratos
 * @param {String} variantId - ID de la variante a exportar (opcional)
 */
thirdPartyProfileSchema.methods.toContractData = function(variantId = null) {
  const data = {};

  // Si se especifica una variante, usar esa
  if (variantId && this.variants && this.variants.length > 0) {
    const variant = this.variants.id(variantId);

    if (variant && variant.active) {
      variant.field_mappings.forEach(mapping => {
        const fieldName = mapping.template_variable.replace(/[{}]/g, '');
        data[fieldName] = mapping.value;
      });

      if (variant.template_specific_fields) {
        variant.template_specific_fields.forEach((value, key) => {
          if (!data[key]) {
            data[key] = value;
          }
        });
      }

      return data;
    }
  }

  // Si hay variantes pero no se especificó ID, usar la variante por defecto
  if (this.variants && this.variants.length > 0) {
    const defaultVariant = this.variants.find(v => v.is_default && v.active)
                         || this.variants.find(v => v.active);

    if (defaultVariant) {
      defaultVariant.field_mappings.forEach(mapping => {
        const fieldName = mapping.template_variable.replace(/[{}]/g, '');
        data[fieldName] = mapping.value;
      });

      if (defaultVariant.template_specific_fields) {
        defaultVariant.template_specific_fields.forEach((value, key) => {
          if (!data[key]) {
            data[key] = value;
          }
        });
      }

      return data;
    }
  }

  // Fallback a la lógica original
  this.field_mappings.forEach(mapping => {
    const fieldName = mapping.template_variable.replace(/[{}]/g, '');
    data[fieldName] = mapping.value;
  });

  if (this.template_specific_fields) {
    this.template_specific_fields.forEach((value, key) => {
      if (!data[key]) {
        data[key] = value;
      }
    });
  }

  return data;
};

// ===================================================================
// MÉTODOS ESTÁTICOS
// ===================================================================

/**
 * Busca o crea un perfil para un tercero y plantilla
 */
thirdPartyProfileSchema.statics.findOrCreateProfile = async function(
  supplierId,
  templateId,
  roleInTemplate,
  companyId,
  userId
) {
  let profile = await this.findOne({
    supplier: supplierId,
    template: templateId,
    role_in_template: roleInTemplate.toLowerCase()
  });

  if (!profile) {
    profile = await this.create({
      supplier: supplierId,
      template: templateId,
      role_in_template: roleInTemplate.toLowerCase(),
      role_label: roleInTemplate,
      company: companyId,
      created_by: userId,
      updated_by: userId
    });
  }

  return profile;
};

/**
 * Obtiene perfiles de un tercero con información de uso
 */
thirdPartyProfileSchema.statics.getSupplierProfiles = async function(supplierId, companyId) {
  return await this.find({
    supplier: supplierId,
    company: companyId,
    active: true
  })
  .populate('template', 'name category')
  .sort({ last_used_at: -1, usage_count: -1 });
};

/**
 * Obtiene perfiles disponibles para una plantilla
 */
thirdPartyProfileSchema.statics.getTemplateProfiles = async function(templateId, companyId) {
  return await this.find({
    template: templateId,
    company: companyId,
    active: true
  })
  .populate('supplier', 'legal_name full_name identification_number')
  .sort({ usage_count: -1, last_used_at: -1 });
};

/**
 * Obtiene estadísticas de uso de perfiles
 */
thirdPartyProfileSchema.statics.getUsageStats = async function(companyId) {
  return await this.aggregate([
    { $match: { company: companyId, active: true } },
    {
      $group: {
        _id: '$template',
        total_profiles: { $sum: 1 },
        complete_profiles: {
          $sum: { $cond: ['$is_complete', 1, 0] }
        },
        avg_usage: { $avg: '$usage_count' },
        total_usage: { $sum: '$usage_count' }
      }
    }
  ]);
};

// ===================================================================
// HOOKS
// ===================================================================

// Antes de guardar, calcular completitud si hay cambios en field_mappings
thirdPartyProfileSchema.pre('save', function(next) {
  if (this.isModified('field_mappings') || this.isModified('template_specific_fields')) {
    this.calculateCompleteness();
  }
  next();
});

// Logging de cambios importantes
thirdPartyProfileSchema.post('save', function(doc) {
  console.log(`📊 [ThirdPartyProfile] Saved: ${doc._id}, Completeness: ${doc.completeness.percentage}%`);
});

const ThirdPartyProfile = mongoose.model('ThirdPartyProfile', thirdPartyProfileSchema);

module.exports = ThirdPartyProfile;
