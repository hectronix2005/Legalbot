const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractRequest',
    required: false // Hacer opcional para generación directa
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractTemplate',
    required: true
  },
  contract_number: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: false
  },
  content: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  file_path: String,
  pdf_path: String,
  status: {
    type: String,
    required: true,
    enum: ['active', 'terminated', 'expired', 'borrador', 'revision', 'aprobado', 'firmado', 'cancelado'],
    default: 'active'
  },
  generated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false
  },
  company_name: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contract', contractSchema);

