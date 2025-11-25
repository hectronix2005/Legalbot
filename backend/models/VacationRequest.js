const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VacationRequestSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  requestedDays: {
    type: Number,
    required: true,
    min: 0.5
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['requested', 'approved', 'scheduled', 'enjoyed', 'rejected'],
    default: 'requested',
    index: true
  },
  approverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvalDate: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  enjoyedDate: {
    type: Date,
    default: null
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
VacationRequestSchema.index({ employeeId: 1, status: 1, companyId: 1 });
VacationRequestSchema.index({ companyId: 1, status: 1, requestDate: -1 });
VacationRequestSchema.index({ startDate: 1, endDate: 1, status: 1 });

// Validation: endDate must be after startDate
VacationRequestSchema.pre('validate', function(next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    const error = new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    error.name = 'ValidationError';
    return next(error);
  }
  next();
});

// Virtual to check if request is pending approval
VacationRequestSchema.virtual('isPending').get(function() {
  return this.status === 'requested';
});

// Virtual to check if request is active
VacationRequestSchema.virtual('isActive').get(function() {
  return ['requested', 'approved', 'scheduled'].includes(this.status);
});

// Method to check if request can be cancelled
VacationRequestSchema.methods.canBeCancelled = function() {
  return ['requested', 'approved', 'scheduled'].includes(this.status);
};

// Method to check if request can be approved
VacationRequestSchema.methods.canBeApproved = function() {
  return this.status === 'requested';
};

// Method to check if request can be enjoyed
VacationRequestSchema.methods.canBeEnjoyed = function() {
  const now = new Date();
  return this.status === 'scheduled' && now >= this.startDate;
};

// Pre-save hook
VacationRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('VacationRequest', VacationRequestSchema);
