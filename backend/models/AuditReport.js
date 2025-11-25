const mongoose = require('mongoose');

const auditReportSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PASSED', 'FAILED', 'WARNING'],
    required: true
  },
  findings: {
    checks: [String],
    errors: [{
      type: String,
      count: Number,
      employeeId: mongoose.Schema.Types.ObjectId,
      employees: [mongoose.Schema.Types.ObjectId],
      requestId: mongoose.Schema.Types.ObjectId,
      message: String,
      severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
      },
      expected: mongoose.Schema.Types.Mixed,
      actual: mongoose.Schema.Types.Mixed
    }],
    warnings: [{
      type: String,
      count: Number,
      employeeId: mongoose.Schema.Types.ObjectId,
      employees: [mongoose.Schema.Types.ObjectId],
      requestId: mongoose.Schema.Types.ObjectId,
      message: String,
      severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
      },
      expected: mongoose.Schema.Types.Mixed,
      actual: mongoose.Schema.Types.Mixed
    }],
    summary: {
      totalChecks: Number,
      totalErrors: Number,
      totalWarnings: Number,
      criticalErrors: Number,
      highErrors: Number,
      employeesAudited: Number,
      requestsAudited: Number,
      executionTimeMs: Number
    }
  },
  notificationsSent: {
    type: Boolean,
    default: false
  },
  notificationDetails: [{
    type: {
      type: String,
      enum: ['email', 'slack', 'webhook']
    },
    recipient: String,
    sentAt: Date,
    success: Boolean,
    error: String
  }]
}, {
  timestamps: true
});

// Índices para consultas eficientes
auditReportSchema.index({ companyId: 1, timestamp: -1 });
auditReportSchema.index({ status: 1, timestamp: -1 });
auditReportSchema.index({ 'findings.summary.criticalErrors': 1 }, {
  partialFilterExpression: { 'findings.summary.criticalErrors': { $gt: 0 } }
});

// Método para obtener último reporte exitoso
auditReportSchema.statics.getLastSuccessful = function(companyId) {
  return this.findOne({
    companyId,
    status: 'PASSED'
  }).sort({ timestamp: -1 });
};

// Método para obtener reportes con errores críticos
auditReportSchema.statics.getCriticalReports = function(companyId, daysBack = 7) {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - daysBack);

  return this.find({
    companyId,
    timestamp: { $gte: dateLimit },
    'findings.summary.criticalErrors': { $gt: 0 }
  }).sort({ timestamp: -1 });
};

module.exports = mongoose.model('AuditReport', auditReportSchema);
