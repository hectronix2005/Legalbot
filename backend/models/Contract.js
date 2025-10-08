const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractRequest',
    required: true
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
  content: {
    type: String,
    required: true
  },
  file_path: String,
  status: {
    type: String,
    required: true,
    enum: ['active', 'terminated', 'expired'],
    default: 'active'
  },
  generated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contract', contractSchema);

