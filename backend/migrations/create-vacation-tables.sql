-- =====================================================
-- VACATION MODULE - DATABASE MIGRATION
-- Colombian Labor Law Compliance
-- =====================================================
--
-- This migration creates the complete database schema for the
-- vacation management module compliant with Colombian Labor Code
-- Articles 186-192.
--
-- MongoDB Collections (Mongoose Schemas)
-- This file serves as documentation - actual creation happens via Mongoose
-- =====================================================

-- =====================================================
-- COLLECTION: vacation_balances
-- Purpose: Track vacation accrual and balance for each employee
-- =====================================================

/*
Schema: VacationBalance

{
  // Primary identifiers
  _id: ObjectId (auto-generated),
  employeeId: ObjectId (ref: 'User', required, indexed),
  companyId: ObjectId (ref: 'Company', required, indexed),

  // Employment tracking
  hireDate: Date (required, indexed),

  // Balance tracking (all in working days)
  accruedDays: Number (required, min: 0, default: 0, precision: 8 decimals),
  requestedDays: Number (required, min: 0, default: 0),
  approvedDays: Number (required, min: 0, default: 0),
  scheduledDays: Number (required, min: 0, default: 0),
  enjoyedDays: Number (required, min: 0, default: 0),

  // Virtual field (computed, not stored):
  // availableDays = accruedDays - requestedDays

  // Suspension/leave tracking (days to subtract from accrual)
  suspensionDays: Number (default: 0, min: 0),
  unpaidLeaveDays: Number (default: 0, min: 0),

  // Calculation metadata
  lastAccrualDate: Date (required, default: hireDate, indexed),
  lastRecalculationDate: Date,
  accrualRate: Number (default: 0.04109589, constant),

  // Audit fields
  version: Number (default: 1, auto-increment on changes),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Indexes:
  1. { employeeId: 1, companyId: 1 } - UNIQUE (one balance per employee)
  2. { companyId: 1, hireDate: 1 } - For company reports
  3. { lastAccrualDate: 1 } - For daily accrual batch job

Validations:
  - availableDays >= 0 (pre-save hook)
  - accruedDays >= enjoyedDays
  - requestedDays = sum of non-terminal request days
  - accrualRate is constant (15/365)

Business Rules:
  - Created automatically when employee is hired
  - Updated daily by accrual cron job
  - Cannot be deleted (soft delete via employee deactivation)
  - Recalculation triggered by suspension periods or corrections
*/

-- MongoDB Schema in JavaScript (actual implementation):

const vacationBalanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },

  hireDate: {
    type: Date,
    required: true,
    index: true
  },

  accruedDays: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    get: v => Math.round(v * 100000000) / 100000000 // 8 decimals
  },
  requestedDays: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  approvedDays: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  scheduledDays: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  enjoyedDays: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  suspensionDays: {
    type: Number,
    default: 0,
    min: 0
  },
  unpaidLeaveDays: {
    type: Number,
    default: 0,
    min: 0
  },

  lastAccrualDate: {
    type: Date,
    required: true,
    index: true
  },
  lastRecalculationDate: {
    type: Date
  },
  accrualRate: {
    type: Number,
    default: 0.04109589, // 15/365
    immutable: true
  },

  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

-- Virtual field for available days
vacationBalanceSchema.virtual('availableDays').get(function() {
  return this.accruedDays - this.requestedDays;
});

-- Compound unique index
vacationBalanceSchema.index({ employeeId: 1, companyId: 1 }, { unique: true });

-- Additional indexes for queries
vacationBalanceSchema.index({ companyId: 1, hireDate: 1 });
vacationBalanceSchema.index({ lastAccrualDate: 1 });

-- Pre-save validation
vacationBalanceSchema.pre('save', function(next) {
  if (this.accruedDays - this.requestedDays < 0) {
    return next(new Error('Available days cannot be negative'));
  }
  if (this.enjoyedDays > this.accruedDays) {
    return next(new Error('Enjoyed days cannot exceed accrued days'));
  }
  next();
});


-- =====================================================
-- COLLECTION: vacation_requests
-- Purpose: Manage vacation requests through their lifecycle
-- =====================================================

/*
Schema: VacationRequest

{
  // Primary identifier
  _id: ObjectId (auto-generated),
  requestNumber: String (unique, format: "VAC-YYYY-NNNN"),

  // References
  employeeId: ObjectId (ref: 'User', required, indexed),
  companyId: ObjectId (ref: 'Company', required, indexed),
  balanceId: ObjectId (ref: 'VacationBalance', required),

  // Request details
  requestedDays: Number (required, min: 1, max: 15),
  requestedStartDate: Date (required, indexed),
  requestedEndDate: Date (required, indexed),
  reason: String (max: 500 chars, optional),

  // Calculated fields
  workingDaysCount: Number (required),
  calendarDaysCount: Number (required),

  // State machine
  status: String (enum: [
    'draft', 'requested', 'approved', 'scheduled',
    'enjoying', 'enjoyed', 'rejected', 'cancelled'
  ], default: 'draft', indexed),

  // Workflow tracking
  requestedBy: ObjectId (ref: 'User'),
  requestedAt: Date,

  approvedBy: ObjectId (ref: 'User'),
  approvedAt: Date,

  scheduledBy: ObjectId (ref: 'User'),
  scheduledAt: Date,
  scheduledStartDate: Date,
  scheduledEndDate: Date,

  rejectedBy: ObjectId (ref: 'User'),
  rejectedAt: Date,
  rejectionReason: String (max: 500 chars),

  // Actual enjoyment
  actualStartDate: Date,
  actualEndDate: Date,
  actualDaysEnjoyed: Number,

  // Additional notes
  notes: [{
    text: String,
    createdBy: ObjectId (ref: 'User'),
    createdAt: Date
  }],

  // Audit
  version: Number (default: 1),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Indexes:
  1. { requestNumber: 1 } - UNIQUE
  2. { employeeId: 1, status: 1 } - Employee queries
  3. { companyId: 1, status: 1, requestedStartDate: 1 } - Company reports
  4. { balanceId: 1 } - Balance lookups
  5. { status: 1, scheduledStartDate: 1 } - Auto-start job
  6. { requestedStartDate: 1, requestedEndDate: 1 } - Calendar views

State Transitions:
  draft → requested → approved → scheduled → enjoying → enjoyed
    ↓         ↓          ↓          ↓
  cancelled  rejected  cancelled  cancelled

Business Rules:
  - requestNumber auto-generated on creation
  - workingDaysCount calculated excluding weekends/holidays
  - State transitions enforced via state machine
  - Balance updated on each state change
  - Immutable after 'enjoyed' status
*/

const vacationRequestSchema = new mongoose.Schema({
  requestNumber: {
    type: String,
    unique: true,
    index: true
  },

  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  balanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VacationBalance',
    required: true,
    index: true
  },

  requestedDays: {
    type: Number,
    required: true,
    min: 1,
    max: 15
  },
  requestedStartDate: {
    type: Date,
    required: true,
    index: true
  },
  requestedEndDate: {
    type: Date,
    required: true,
    index: true
  },
  reason: {
    type: String,
    maxlength: 500
  },

  workingDaysCount: {
    type: Number,
    required: true,
    min: 1
  },
  calendarDaysCount: {
    type: Number,
    required: true,
    min: 1
  },

  status: {
    type: String,
    enum: ['draft', 'requested', 'approved', 'scheduled', 'enjoying', 'enjoyed', 'rejected', 'cancelled'],
    default: 'draft',
    index: true
  },

  // Workflow fields
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedAt: Date,

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,

  scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scheduledAt: Date,
  scheduledStartDate: Date,
  scheduledEndDate: Date,

  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: Date,
  rejectionReason: { type: String, maxlength: 500 },

  actualStartDate: Date,
  actualEndDate: Date,
  actualDaysEnjoyed: Number,

  notes: [{
    text: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],

  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

-- Indexes
vacationRequestSchema.index({ requestNumber: 1 }, { unique: true });
vacationRequestSchema.index({ employeeId: 1, status: 1 });
vacationRequestSchema.index({ companyId: 1, status: 1, requestedStartDate: 1 });
vacationRequestSchema.index({ balanceId: 1 });
vacationRequestSchema.index({ status: 1, scheduledStartDate: 1 });
vacationRequestSchema.index({ requestedStartDate: 1, requestedEndDate: 1 });


-- =====================================================
-- COLLECTION: vacation_audit_logs
-- Purpose: Immutable audit trail for all vacation operations
-- =====================================================

/*
Schema: VacationAuditLog

{
  _id: ObjectId (auto-generated),

  // Action details
  action: String (enum: [
    'BALANCE_CREATED', 'BALANCE_UPDATED', 'ACCRUAL_PROCESSED',
    'REQUEST_CREATED', 'REQUEST_SUBMITTED', 'REQUEST_APPROVED',
    'REQUEST_REJECTED', 'REQUEST_SCHEDULED', 'VACATION_STARTED',
    'VACATION_ENDED', 'REQUEST_CANCELLED', 'BALANCE_ADJUSTED',
    'SUSPENSION_RECORDED', 'CALCULATION_CORRECTED'
  ], required, indexed),

  // Actor (NO PII - only IDs)
  actorId: ObjectId (ref: 'User', indexed),
  actorRole: String (enum: ['colaboradores', 'talento_humano', 'admin', 'super_admin', 'system']),

  // Affected entity
  entityType: String (enum: ['VacationBalance', 'VacationRequest'], required),
  entityId: ObjectId (required, indexed),
  employeeId: ObjectId (ref: 'User', required, indexed),
  companyId: ObjectId (ref: 'Company', required, indexed),

  // Changes (sanitized - NO PII)
  changes: {
    before: Object,
    after: Object,
    delta: Object
  },

  // Context
  reason: String (max: 500 chars),
  metadata: Object,

  // Request tracking
  requestId: ObjectId (ref: 'VacationRequest', indexed),
  requestNumber: String,

  // Blockchain-like integrity
  checksum: String (SHA-256 hash, indexed),
  previousLogId: ObjectId (ref: 'VacationAuditLog'),

  // Timestamp
  timestamp: Date (required, indexed, default: Date.now),

  // Security context (optional)
  ipAddress: String,
  userAgent: String
}

Indexes:
  1. { employeeId: 1, timestamp: -1 } - Employee history
  2. { companyId: 1, timestamp: -1 } - Company reports
  3. { entityId: 1, entityType: 1, timestamp: -1 } - Entity timeline
  4. { action: 1, timestamp: -1 } - Action filtering
  5. { requestId: 1 } - Request audit trail
  6. { checksum: 1 } - Integrity verification
  7. { timestamp: -1 } - Chronological queries

Security Rules:
  - Immutable: NO updates or deletes allowed
  - No PII: Only user IDs, not names or emails
  - Integrity: Checksum links to previous log
  - Retention: 5+ years minimum

Checksum Calculation:
  checksum = SHA256(previousChecksum + JSON.stringify(sanitizedLogData))

  First log: checksum = SHA256('GENESIS' + logData)

  Verification:
  FOR EACH log in chronological order:
    expectedChecksum = SHA256(previousChecksum + currentLogData)
    IF log.checksum !== expectedChecksum:
      ALERT: Chain broken, possible tampering
*/

const vacationAuditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      'BALANCE_CREATED', 'BALANCE_UPDATED', 'ACCRUAL_PROCESSED',
      'REQUEST_CREATED', 'REQUEST_SUBMITTED', 'REQUEST_APPROVED',
      'REQUEST_REJECTED', 'REQUEST_SCHEDULED', 'VACATION_STARTED',
      'VACATION_ENDED', 'REQUEST_CANCELLED', 'BALANCE_ADJUSTED',
      'SUSPENSION_RECORDED', 'CALCULATION_CORRECTED'
    ],
    required: true,
    index: true
  },

  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  actorRole: {
    type: String,
    enum: ['colaboradores', 'talento_humano', 'admin', 'super_admin', 'system']
  },

  entityType: {
    type: String,
    enum: ['VacationBalance', 'VacationRequest'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },

  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    delta: mongoose.Schema.Types.Mixed
  },

  reason: {
    type: String,
    maxlength: 500
  },
  metadata: mongoose.Schema.Types.Mixed,

  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VacationRequest',
    index: true
  },
  requestNumber: String,

  checksum: {
    type: String,
    required: true,
    index: true
  },
  previousLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VacationAuditLog'
  },

  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },

  ipAddress: String,
  userAgent: String
}, {
  timestamps: false, // Use custom timestamp field
  collection: 'vacation_audit_logs'
});

-- Indexes
vacationAuditLogSchema.index({ employeeId: 1, timestamp: -1 });
vacationAuditLogSchema.index({ companyId: 1, timestamp: -1 });
vacationAuditLogSchema.index({ entityId: 1, entityType: 1, timestamp: -1 });
vacationAuditLogSchema.index({ action: 1, timestamp: -1 });
vacationAuditLogSchema.index({ requestId: 1 });
vacationAuditLogSchema.index({ checksum: 1 });
vacationAuditLogSchema.index({ timestamp: -1 });

-- Prevent updates and deletes
vacationAuditLogSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next(new Error('Audit logs are immutable'));
  }
  next();
});

vacationAuditLogSchema.pre('remove', function(next) {
  next(new Error('Audit logs cannot be deleted'));
});


-- =====================================================
-- COLLECTION: vacation_calendars
-- Purpose: Track non-working days (holidays, closures)
-- =====================================================

/*
Schema: VacationCalendar

{
  _id: ObjectId,
  companyId: ObjectId (ref: 'Company', indexed),

  date: Date (required, indexed),
  type: String (enum: ['PUBLIC_HOLIDAY', 'COMPANY_CLOSURE', 'CUSTOM']),
  name: String (required),
  description: String,

  isRecurring: Boolean (default: false),
  recurringPattern: String, // e.g., "every year" for annual holidays

  year: Number,

  createdAt: Date,
  updatedAt: Date
}

Indexes:
  1. { companyId: 1, date: 1 } - UNIQUE (one holiday per day per company)
  2. { date: 1, type: 1 } - Date range queries
  3. { year: 1, companyId: 1 } - Yearly views

Pre-populated Data:
  Colombian Public Holidays 2025:
  - Jan 1: New Year's Day
  - Jan 6: Epiphany
  - Mar 24: Saint Joseph's Day
  - Apr 17: Maundy Thursday
  - Apr 18: Good Friday
  - May 1: Labor Day
  - Jun 2: Ascension Day
  - Jun 23: Corpus Christi
  - Jun 30: Sacred Heart
  - Jul 7: Feast of Saint Peter and Saint Paul
  - Jul 20: Independence Day
  - Aug 7: Battle of Boyacá
  - Aug 18: Assumption of Mary
  - Oct 13: Columbus Day
  - Nov 3: All Saints' Day
  - Nov 17: Independence of Cartagena
  - Dec 8: Immaculate Conception
  - Dec 25: Christmas Day
*/

const vacationCalendarSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },

  date: {
    type: Date,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['PUBLIC_HOLIDAY', 'COMPANY_CLOSURE', 'CUSTOM'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,

  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: String,

  year: Number
}, {
  timestamps: true
});

vacationCalendarSchema.index({ companyId: 1, date: 1 }, { unique: true });
vacationCalendarSchema.index({ date: 1, type: 1 });
vacationCalendarSchema.index({ year: 1, companyId: 1 });


-- =====================================================
-- COLLECTION: vacation_configurations
-- Purpose: Company-specific vacation policies
-- =====================================================

/*
Schema: VacationConfiguration

{
  _id: ObjectId,
  companyId: ObjectId (ref: 'Company', UNIQUE),

  // Calculation settings
  accrualMethod: String (enum: ['DAILY', 'MONTHLY'], default: 'DAILY'),
  accrualRate: Number (default: 0.04109589),
  useCalendarDays: Boolean (default: false),
  dayBasis: Number (enum: [360, 365], default: 365),

  // Request policies
  minRequestDays: Number (default: 1),
  maxRequestDays: Number (default: 15),
  minAdvanceNoticeDays: Number (default: 15),
  allowSplitVacations: Boolean (default: true),
  maxSplits: Number (default: 3),

  // Approval workflow
  requiresApproval: Boolean (default: true),
  approverRoles: [String] (default: ['talento_humano', 'admin']),
  autoApproveAfterDays: Number (default: null),

  // Carryover policies
  allowCarryover: Boolean (default: true),
  carryoverMaxDays: Number (default: 15),
  carryoverExpiryMonths: Number (default: 12),

  // Monetization (Colombian law allows selling up to half)
  allowMonetization: Boolean (default: true),
  maxMonetizationDays: Number (default: 7.5),

  createdAt: Date,
  updatedAt: Date
}

Indexes:
  1. { companyId: 1 } - UNIQUE

Defaults (Colombian Law):
  - Accrual: Daily, 15/365 rate
  - Minimum request: 1 day
  - Maximum request: 15 days (full year)
  - Advance notice: 15 days
  - Split vacations: Allowed
  - Carryover: Allowed for 1 year
  - Monetization: Max 7.5 days (50%)
*/

const vacationConfigurationSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true
  },

  accrualMethod: {
    type: String,
    enum: ['DAILY', 'MONTHLY'],
    default: 'DAILY'
  },
  accrualRate: {
    type: Number,
    default: 0.04109589
  },
  useCalendarDays: {
    type: Boolean,
    default: false
  },
  dayBasis: {
    type: Number,
    enum: [360, 365],
    default: 365
  },

  minRequestDays: {
    type: Number,
    default: 1,
    min: 1
  },
  maxRequestDays: {
    type: Number,
    default: 15,
    max: 30
  },
  minAdvanceNoticeDays: {
    type: Number,
    default: 15,
    min: 0
  },
  allowSplitVacations: {
    type: Boolean,
    default: true
  },
  maxSplits: {
    type: Number,
    default: 3,
    min: 1
  },

  requiresApproval: {
    type: Boolean,
    default: true
  },
  approverRoles: {
    type: [String],
    default: ['talento_humano', 'admin']
  },
  autoApproveAfterDays: Number,

  allowCarryover: {
    type: Boolean,
    default: true
  },
  carryoverMaxDays: {
    type: Number,
    default: 15
  },
  carryoverExpiryMonths: {
    type: Number,
    default: 12
  },

  allowMonetization: {
    type: Boolean,
    default: true
  },
  maxMonetizationDays: {
    type: Number,
    default: 7.5,
    max: 15
  }
}, {
  timestamps: true
});

vacationConfigurationSchema.index({ companyId: 1 }, { unique: true });


-- =====================================================
-- COLLECTION: request_counters
-- Purpose: Auto-increment request numbers per year
-- =====================================================

/*
Schema: RequestCounter

{
  _id: ObjectId,
  year: Number (UNIQUE),
  sequence: Number (default: 0)
}

Purpose:
  Generate unique request numbers: VAC-{year}-{sequence}

Usage:
  const counter = await RequestCounter.findOneAndUpdate(
    { year: 2025 },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true }
  );

  const requestNumber = `VAC-2025-${counter.sequence.toString().padStart(4, '0')}`;
  // Result: "VAC-2025-0001"
*/

const requestCounterSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    unique: true
  },
  sequence: {
    type: Number,
    default: 0,
    min: 0
  }
});

requestCounterSchema.index({ year: 1 }, { unique: true });


-- =====================================================
-- DATA SEEDING
-- =====================================================

-- Seed Colombian public holidays for 2025-2026
-- This should be run after company creation

const colombianHolidays2025 = [
  { date: '2025-01-01', name: 'Año Nuevo', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-01-06', name: 'Día de los Reyes Magos', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-03-24', name: 'Día de San José', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-04-17', name: 'Jueves Santo', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-04-18', name: 'Viernes Santo', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-05-01', name: 'Día del Trabajo', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-06-02', name: 'Ascensión del Señor', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-06-23', name: 'Corpus Christi', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-06-30', name: 'Sagrado Corazón', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-07-07', name: 'San Pedro y San Pablo', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-07-20', name: 'Día de la Independencia', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-08-07', name: 'Batalla de Boyacá', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-08-18', name: 'Asunción de la Virgen', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-10-13', name: 'Día de la Raza', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-11-03', name: 'Todos los Santos', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-11-17', name: 'Independencia de Cartagena', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-12-08', name: 'Inmaculada Concepción', type: 'PUBLIC_HOLIDAY' },
  { date: '2025-12-25', name: 'Navidad', type: 'PUBLIC_HOLIDAY' }
];

-- Migration function to seed holidays
async function seedColombianHolidays(companyId) {
  for (const holiday of colombianHolidays2025) {
    await VacationCalendar.create({
      companyId: companyId,
      date: new Date(holiday.date),
      type: holiday.type,
      name: holiday.name,
      isRecurring: true,
      year: 2025
    });
  }
}


-- =====================================================
-- MIGRATION CHECKLIST
-- =====================================================

/*
1. ✓ Create VacationBalance collection (Mongoose model)
2. ✓ Create VacationRequest collection (Mongoose model)
3. ✓ Create VacationAuditLog collection (Mongoose model)
4. ✓ Create VacationCalendar collection (Mongoose model)
5. ✓ Create VacationConfiguration collection (Mongoose model)
6. ✓ Create RequestCounter collection (Mongoose model)

7. Create indexes on all collections
8. Seed Colombian public holidays for current + next year
9. Create default VacationConfiguration for existing companies
10. Create VacationBalance for all existing employees
11. Run initial accrual calculation for all employees

12. Schedule cron jobs:
    - Daily accrual (00:30 AM)
    - Hourly auto-start/complete (every hour)
    - Weekly integrity verification (Sundays)

13. Enable audit logging
14. Test state transitions
15. Verify calculations with sample data
16. Train HR staff on new module
*/


-- =====================================================
-- ROLLBACK PLAN
-- =====================================================

/*
If rollback is needed:

1. Stop all cron jobs
2. Backup all vacation_* collections
3. Drop collections in reverse order:
   - request_counters
   - vacation_configurations
   - vacation_calendars
   - vacation_audit_logs
   - vacation_requests
   - vacation_balances
4. Remove vacation module code
5. Restore previous state
*/


-- =====================================================
-- PERFORMANCE NOTES
-- =====================================================

/*
Expected collection sizes (for 1000 employees):
  - vacation_balances: ~1,000 documents (~100 KB)
  - vacation_requests: ~15,000/year (~5 MB/year)
  - vacation_audit_logs: ~100,000/year (~50 MB/year)
  - vacation_calendars: ~20 documents per company
  - vacation_configurations: 1 document per company
  - request_counters: 1 document per year

Total storage (1000 employees, 1 year): ~60 MB
Indexes: ~10 MB

Query performance:
  - Balance lookup: <10ms (indexed)
  - Request listing: <50ms (indexed, paginated)
  - Audit log query: <100ms (indexed, with date range)
  - Working days calculation: <5ms (cached holidays)

Cron job performance:
  - Daily accrual (1000 employees): ~30 seconds
  - Hourly auto-start/complete: <5 seconds
  - Weekly integrity check: ~2 minutes
*/


-- =====================================================
-- END OF MIGRATION
-- =====================================================
