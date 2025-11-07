const mongoose = require('mongoose');

/**
 * Esquema para definir un campo dentro de un tipo de tercero
 */
const fieldConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    description: 'Nombre interno del campo (snake_case)'
  },
  label: {
    type: String,
    required: true,
    description: 'Etiqueta visible para el usuario'
  },
  field_type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'date', 'email', 'phone', 'textarea', 'select', 'checkbox'],
    description: 'Tipo de campo HTML'
  },
  options: {
    type: [String],
    default: [],
    description: 'Opciones para campos tipo select'
  },
  required: {
    type: Boolean,
    default: false,
    description: 'Si el campo es obligatorio'
  },
  display_order: {
    type: Number,
    default: 0,
    description: 'Orden de visualización del campo'
  },
  placeholder: {
    type: String,
    default: '',
    description: 'Texto de ayuda en el campo'
  },
  validation_rules: {
    min_length: Number,
    max_length: Number,
    pattern: String,
    min_value: Number,
    max_value: Number
  }
}, { _id: false });

/**
 * Modelo para configurar tipos de terceros
 * Permite definir dinámicamente qué campos se solicitan para cada tipo
 */
const thirdPartyTypeConfigSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    description: 'Código único del tipo (ej: proveedor, cliente, empleado)'
  },
  label: {
    type: String,
    required: true,
    description: 'Nombre visible del tipo de tercero'
  },
  description: {
    type: String,
    default: '',
    description: 'Descripción del tipo de tercero'
  },
  icon: {
    type: String,
    default: '📄',
    description: 'Emoji o ícono para identificar el tipo'
  },
  fields: {
    type: [fieldConfigSchema],
    default: [],
    description: 'Campos que se solicitarán para este tipo de tercero'
  },
  default_identification_types: {
    type: [String],
    default: [],
    description: 'Tipos de identificación permitidos/sugeridos para este tipo de tercero'
  },
  is_system: {
    type: Boolean,
    default: false,
    description: 'Si es un tipo del sistema (no se puede eliminar)'
  },
  active: {
    type: Boolean,
    default: true,
    description: 'Si el tipo está activo'
  },
  isGeneric: {
    type: Boolean,
    default: false,
    description: 'Si el tipo aplica para todas las empresas (genérico)'
  },
  companies: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Company',
    default: [],
    description: 'Empresas que pueden usar este tipo (vacío si isGeneric=true)'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    description: 'DEPRECATED: Usar isGeneric y companies en su lugar. Se mantiene por compatibilidad'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    description: 'Usuario que creó el tipo (null para tipos del sistema)'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices
thirdPartyTypeConfigSchema.index({ code: 1 });
thirdPartyTypeConfigSchema.index({ active: 1 });
thirdPartyTypeConfigSchema.index({ isGeneric: 1 });
thirdPartyTypeConfigSchema.index({ companies: 1 });

module.exports = mongoose.model('ThirdPartyTypeConfig', thirdPartyTypeConfigSchema);
