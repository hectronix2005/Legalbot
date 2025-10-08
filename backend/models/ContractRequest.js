const mongoose = require('mongoose');

const contractRequestSchema = new mongoose.Schema({
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractTemplate',
    required: true
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in_review', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  field_data: {
    type: Map,
    of: String,
    required: true
  },
  assigned_lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  legal_notes: String,
  rejection_reason: String,
  reviewed_at: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('ContractRequest', contractRequestSchema);

