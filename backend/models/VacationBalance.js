const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VacationBalanceSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hireDate: {
    type: Date,
    required: true
  },
  accruedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  enjoyedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  approvedPendingDays: {
    type: Number,
    default: 0,
    min: 0
  },
  availableDays: {
    type: Number,
    default: 0,
    min: 0
  },
  lastAccrualDate: {
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

// Compound index for unique employee per company
VacationBalanceSchema.index({ employeeId: 1, companyId: 1 }, { unique: true });

// Index for efficient queries
VacationBalanceSchema.index({ companyId: 1, lastAccrualDate: 1 });

// Virtual for pending request days calculation
VacationBalanceSchema.virtual('pendingRequestDays').get(function() {
  return this.accruedDays - this.enjoyedDays - this.approvedPendingDays;
});

// Method to calculate total available days
VacationBalanceSchema.methods.getTotalAvailableDays = function() {
  return this.accruedDays - this.enjoyedDays - this.approvedPendingDays;
};

// Pre-save hook to update availableDays automatically
VacationBalanceSchema.pre('save', function(next) {
  this.availableDays = this.accruedDays - this.enjoyedDays - this.approvedPendingDays;
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('VacationBalance', VacationBalanceSchema);
