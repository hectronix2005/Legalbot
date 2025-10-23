const mongoose = require('mongoose');

const userCompanySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
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
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índice compuesto para evitar duplicados
userCompanySchema.index({ user: 1, company: 1 }, { unique: true });

module.exports = mongoose.model('UserCompany', userCompanySchema);

