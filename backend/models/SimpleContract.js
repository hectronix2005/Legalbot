const mongoose = require('mongoose');

const simpleContractSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['borrador', 'revision', 'aprobado', 'firmado', 'cancelado'],
    default: 'borrador'
  },
  description: {
    type: String,
    default: ''
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractTemplate',
    default: null
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SimpleContract', simpleContractSchema);
