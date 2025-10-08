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
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
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

