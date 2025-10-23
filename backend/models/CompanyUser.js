const mongoose = require('mongoose');

const companyUserSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'lawyer', 'requester'],
    default: 'requester'
  },
  permissions: {
    canView: {
      type: Boolean,
      default: true
    },
    canEdit: {
      type: Boolean,
      default: false
    },
    canDelete: {
      type: Boolean,
      default: false
    },
    canManageUsers: {
      type: Boolean,
      default: false
    },
    canManageContracts: {
      type: Boolean,
      default: false
    },
    canManageTemplates: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índice compuesto para evitar duplicados
companyUserSchema.index({ company: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('CompanyUser', companyUserSchema);
