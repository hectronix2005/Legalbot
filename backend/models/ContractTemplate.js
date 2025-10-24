const mongoose = require('mongoose');

const templateFieldSchema = new mongoose.Schema({
  field_name: {
    type: String,
    required: true
  },
  field_label: {
    type: String,
    required: true
  },
  field_type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'date', 'email', 'textarea', 'select']
  },
  field_options: [String],
  required: {
    type: Boolean,
    default: true
  },
  display_order: {
    type: Number,
    default: 0
  },
  // Información de la variable original
  original_marker: {
    type: String,
    required: false,
    default: '',
    description: 'El marcador original {{variable}} detectado en el documento'
  },
  description: {
    type: String,
    default: '',
    description: 'Descripción de la variable para el usuario'
  },
  can_repeat: {
    type: Boolean,
    default: false,
    description: 'Indica si esta variable puede ser repetida/reutilizada'
  },
  repeat_source: {
    type: Number,
    default: null,
    description: 'Número de la variable de origen si esta es una repetición'
  },
  repeat_count: {
    type: Number,
    default: 1,
    description: 'Número de veces que aparece esta variable en el documento original'
  },
  is_repeated: {
    type: Boolean,
    default: false,
    description: 'Indica si esta variable está marcada como repetida por el usuario'
  }
});

const contractTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: ['Laboral', 'Comercial', 'Inmobiliario', 'Legal', 'Servicios', 'Confidencialidad', 'Compraventa', 'Arrendamiento', 'Otro']
  },
  content: {
    type: String,
    default: ''
  },
  fields: [templateFieldSchema],
  version: {
    type: Number,
    default: 1
  },
  is_current: {
    type: Boolean,
    default: true
  },
  is_shared: {
    type: Boolean,
    default: false,
    description: 'Indica si la plantilla es compartida entre todas las empresas (solo super_admin)'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: function() {
      // Company es requerido solo si la plantilla NO es compartida
      return !this.is_shared;
    },
    index: true // Índice para mejorar rendimiento de queries por empresa
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  word_file_path: String,
  word_file_original_name: String,
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ContractTemplate', contractTemplateSchema);

