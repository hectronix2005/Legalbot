const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VacationAuditLogSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['request', 'approve', 'reject', 'schedule', 'enjoy', 'accrue', 'cancel', 'update'],
    index: true
  },
  requestId: {
    type: Schema.Types.ObjectId,
    ref: 'VacationRequest',
    default: null,
    index: true
  },
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  previousState: {
    type: Schema.Types.Mixed,
    default: null
  },
  newState: {
    type: Schema.Types.Mixed,
    default: null
  },
  quantity: {
    type: Number,
    default: null
  },
  description: {
    type: String,
    default: null
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: false // Using custom timestamp field
});

// Compound indexes for audit queries
VacationAuditLogSchema.index({ companyId: 1, timestamp: -1 });
VacationAuditLogSchema.index({ employeeId: 1, timestamp: -1 });
VacationAuditLogSchema.index({ requestId: 1, timestamp: -1 });
VacationAuditLogSchema.index({ action: 1, companyId: 1, timestamp: -1 });

// Static method to create audit log entry
VacationAuditLogSchema.statics.createLog = async function(data) {
  const log = new this({
    employeeId: data.employeeId,
    action: data.action,
    requestId: data.requestId || null,
    performedBy: data.performedBy,
    previousState: data.previousState || null,
    newState: data.newState || null,
    quantity: data.quantity || null,
    description: data.description || null,
    metadata: data.metadata || null,
    companyId: data.companyId
  });

  await log.save();
  return log;
};

// Static method to get audit trail for an employee
VacationAuditLogSchema.statics.getEmployeeAudit = async function(employeeId, companyId, limit = 50) {
  return this.find({ employeeId, companyId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('performedBy', 'name email')
    .lean();
};

// Static method to get audit trail for a request
VacationAuditLogSchema.statics.getRequestAudit = async function(requestId, companyId) {
  return this.find({ requestId, companyId })
    .sort({ timestamp: -1 })
    .populate('performedBy', 'name email')
    .populate('employeeId', 'name email')
    .lean();
};

// Static method to get company-wide audit
VacationAuditLogSchema.statics.getCompanyAudit = async function(companyId, filters = {}, limit = 100) {
  const query = { companyId };

  if (filters.action) {
    query.action = filters.action;
  }

  if (filters.employeeId) {
    query.employeeId = filters.employeeId;
  }

  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) {
      query.timestamp.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.timestamp.$lte = new Date(filters.endDate);
    }
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('performedBy', 'name email')
    .populate('employeeId', 'name email')
    .lean();
};

module.exports = mongoose.model('VacationAuditLog', VacationAuditLogSchema);
