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
  third_party_type: {
    type: String,
    enum: ['proveedor', 'cliente', 'empleado', 'arrendador', 'arrendatario', 'contratista', 'otro'],
    description: 'Tipo de tercero involucrado en el contrato',
    default: 'otro'
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
  shared_with_companies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    description: 'Lista de empresas específicas con las que se comparte la plantilla (solo si is_shared es false)'
  }],
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
  can_edit_roles: {
    type: [String],
    enum: ['super_admin', 'admin', 'lawyer'],
    default: function() {
      // Si es compartida, solo super_admin puede editar
      // Si no, admin y lawyer de la empresa pueden editar
      return this.is_shared ? ['super_admin'] : ['super_admin', 'admin', 'lawyer'];
    },
    description: 'Roles que pueden editar esta plantilla'
  },
  is_copy: {
    type: Boolean,
    default: false,
    description: 'Indica si esta plantilla es una copia de otra plantilla'
  },
  copied_from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractTemplate',
    default: null,
    description: 'ID de la plantilla original de la que se hizo copia'
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

