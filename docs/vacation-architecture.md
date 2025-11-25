# Vacation Module Architecture - Colombian Labor Law

## Executive Summary

This document defines the complete architecture for implementing a vacation management system compliant with Colombian labor law (Article 186-192 of the Labor Code). The system tracks vacation accrual, requests, approvals, scheduling, and enjoyment with full audit trails.

## 1. System Overview

### Key Requirements
- **Legal Basis**: 15 business days per year of service (Colombian Labor Code)
- **Accrual Rate**: 15 working days / 365 calendar days = 0.04109589 days per calendar day
- **State Management**: Request lifecycle from creation to enjoyment
- **Audit Compliance**: Complete traceability without PII exposure
- **Multi-tenant**: Company-level isolation with employee-level tracking

### Quality Attributes
1. **Accuracy**: Precise calculation to 8 decimal places for accrual
2. **Integrity**: Immutable audit trail with blockchain-like verification
3. **Compliance**: Full adherence to Colombian labor law
4. **Security**: Role-based access with data protection
5. **Scalability**: Support for 1000+ employees per company
6. **Auditability**: Complete traceability for labor inspections

## 2. Data Architecture

### 2.1 Core Entities

#### VacationBalance (Saldos de Vacaciones)
Tracks the current vacation balance for each employee.

**Fields:**
```javascript
{
  _id: ObjectId,
  employeeId: ObjectId (ref: 'User'),
  companyId: ObjectId (ref: 'Company'),

  // Employment dates
  hireDate: Date (required, indexed),

  // Balance tracking (all in working days)
  accruedDays: Number (required, min: 0, default: 0),
  requestedDays: Number (required, min: 0, default: 0),
  approvedDays: Number (required, min: 0, default: 0),
  scheduledDays: Number (required, min: 0, default: 0),
  enjoyedDays: Number (required, min: 0, default: 0),
  availableDays: Number (required, virtual computed field),

  // Suspension/License tracking
  suspensionDays: Number (default: 0),
  unpaidLeaveDays: Number (default: 0),

  // Calculation metadata
  lastAccrualDate: Date (required, default: hireDate),
  lastRecalculationDate: Date,
  accrualRate: Number (default: 0.04109589),

  // Audit
  version: Number (default: 1),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ employeeId: 1, companyId: 1 } // Unique compound
{ companyId: 1, hireDate: 1 }   // For reports
{ lastAccrualDate: 1 }          // For batch processing
```

**Virtual Fields:**
```javascript
availableDays = accruedDays - requestedDays
effectiveServiceDays = totalCalendarDays - suspensionDays - unpaidLeaveDays
```

**Business Rules:**
1. `availableDays >= 0` always (validated before save)
2. `accruedDays` updated daily via cron job
3. `requestedDays` = sum of all non-rejected requests
4. Cannot delete, only soft-delete via employee deactivation

#### VacationRequest (Solicitudes de Vacaciones)
Manages vacation requests through their lifecycle.

**Fields:**
```javascript
{
  _id: ObjectId,
  requestNumber: String (auto-generated, format: "VAC-{year}-{sequence}"),

  // References
  employeeId: ObjectId (ref: 'User', required),
  companyId: ObjectId (ref: 'Company', required),
  balanceId: ObjectId (ref: 'VacationBalance', required),

  // Request details
  requestedDays: Number (required, min: 1, max: 15),
  requestedStartDate: Date (required),
  requestedEndDate: Date (required),
  reason: String (optional, max: 500 chars),

  // Dates and periods (working days)
  workingDaysCount: Number (required),
  calendarDaysCount: Number (required),

  // State machine
  status: String (enum: [
    'draft',       // Being created
    'requested',   // Submitted for approval
    'approved',    // Approved by manager
    'scheduled',   // Confirmed with specific dates
    'enjoying',    // Currently on vacation
    'enjoyed',     // Completed
    'rejected',    // Denied
    'cancelled'    // Cancelled by employee
  ], default: 'draft'),

  // Approval workflow
  requestedBy: ObjectId (ref: 'User'),
  requestedAt: Date,
  approvedBy: ObjectId (ref: 'User'),
  approvedAt: Date,
  scheduledBy: ObjectId (ref: 'User'),
  scheduledAt: Date,
  rejectedBy: ObjectId (ref: 'User'),
  rejectedAt: Date,
  rejectionReason: String (max: 500 chars),

  // Actual enjoyment tracking
  actualStartDate: Date,
  actualEndDate: Date,
  actualDaysEnjoyed: Number,

  // Metadata
  notes: [{
    text: String,
    createdBy: ObjectId,
    createdAt: Date
  }],

  // Audit
  createdAt: Date,
  updatedAt: Date,
  version: Number (default: 1)
}
```

**Indexes:**
```javascript
{ requestNumber: 1 }                           // Unique
{ employeeId: 1, status: 1 }                   // Employee queries
{ companyId: 1, status: 1, requestedStartDate: 1 } // Company reports
{ balanceId: 1 }                               // Balance lookups
{ requestedStartDate: 1, requestedEndDate: 1 } // Calendar views
```

**State Machine Transitions:**
```
draft → requested → approved → scheduled → enjoying → enjoyed
  ↓         ↓          ↓
cancelled  rejected  cancelled
```

#### VacationAuditLog (Registro de Auditoría)
Immutable audit trail for all vacation-related operations.

**Fields:**
```javascript
{
  _id: ObjectId,

  // What happened
  action: String (enum: [
    'BALANCE_CREATED',
    'BALANCE_UPDATED',
    'ACCRUAL_PROCESSED',
    'REQUEST_CREATED',
    'REQUEST_SUBMITTED',
    'REQUEST_APPROVED',
    'REQUEST_REJECTED',
    'REQUEST_SCHEDULED',
    'VACATION_STARTED',
    'VACATION_ENDED',
    'REQUEST_CANCELLED',
    'BALANCE_ADJUSTED',
    'SUSPENSION_RECORDED',
    'CALCULATION_CORRECTED'
  ], required),

  // Who did it (NO PII - only IDs)
  actorId: ObjectId (ref: 'User'),
  actorRole: String,

  // What was affected
  entityType: String (enum: ['VacationBalance', 'VacationRequest']),
  entityId: ObjectId (required),
  employeeId: ObjectId (ref: 'User', indexed),
  companyId: ObjectId (ref: 'Company', indexed),

  // Changes made
  changes: {
    before: Object (sanitized snapshot),
    after: Object (sanitized snapshot),
    delta: Object (calculated differences)
  },

  // Context
  reason: String (max: 500 chars),
  metadata: Object (additional context),

  // Request tracking
  requestId: ObjectId (ref: 'VacationRequest', optional),
  requestNumber: String,

  // Verification
  checksum: String (SHA-256 of previous log + current data),
  previousLogId: ObjectId (ref: 'VacationAuditLog'),

  // Timestamp
  timestamp: Date (required, indexed, default: Date.now),

  // IP and device (for security)
  ipAddress: String,
  userAgent: String
}
```

**Indexes:**
```javascript
{ employeeId: 1, timestamp: -1 }      // Employee history
{ companyId: 1, timestamp: -1 }       // Company reports
{ entityId: 1, entityType: 1 }        // Entity history
{ action: 1, timestamp: -1 }          // Action filtering
{ requestId: 1 }                      // Request timeline
{ checksum: 1 }                       // Integrity verification
```

**Security Rules:**
1. **Immutable**: No updates or deletes allowed
2. **No PII**: Only store user IDs, not names or personal data
3. **Integrity**: Each log has checksum linking to previous
4. **Retention**: Keep for 5 years minimum (Colombian law)

### 2.2 Supporting Entities

#### VacationCalendar (Calendario de días no laborales)
**Purpose**: Track non-working days (holidays, company closures).

```javascript
{
  _id: ObjectId,
  companyId: ObjectId (ref: 'Company'),
  date: Date (required, indexed),
  type: String (enum: ['PUBLIC_HOLIDAY', 'COMPANY_CLOSURE', 'CUSTOM']),
  name: String (required),
  isRecurring: Boolean (default: false),
  recurringPattern: String, // For recurring holidays
  year: Number,
  createdAt: Date,
  updatedAt: Date
}
```

**Index:**
```javascript
{ companyId: 1, date: 1 } // Unique compound
{ date: 1, type: 1 }
```

#### VacationConfiguration (Configuración del módulo)
**Purpose**: Company-specific vacation policies.

```javascript
{
  _id: ObjectId,
  companyId: ObjectId (ref: 'Company', unique),

  // Calculation settings
  accrualMethod: String (enum: ['DAILY', 'MONTHLY'], default: 'DAILY'),
  accrualRate: Number (default: 0.04109589),
  useCalendarDays: Boolean (default: false), // vs working days
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
```

## 3. API Architecture

### 3.1 REST Endpoints

#### Balance Management

**GET /api/vacations/balance/:employeeId**
- **Purpose**: Get current vacation balance for employee
- **Auth**: Employee (own), HR, Admin
- **Response**:
```javascript
{
  employeeId: "...",
  hireDate: "2023-01-15",
  totalServiceDays: 673,
  accruedDays: 27.66,
  requestedDays: 5,
  approvedDays: 5,
  scheduledDays: 5,
  enjoyedDays: 10,
  availableDays: 22.66,
  suspensionDays: 0,
  nextAccrualDate: "2025-11-21",
  estimatedNextAccrual: 0.04109589
}
```

**POST /api/vacations/balance/recalculate/:employeeId**
- **Purpose**: Force recalculation of balance (admin only)
- **Auth**: HR, Admin
- **Body**:
```javascript
{
  adjustmentReason: "Correcting suspension period",
  suspensionStartDate: "2024-06-01",
  suspensionEndDate: "2024-06-30"
}
```

**POST /api/vacations/balance/adjustment**
- **Purpose**: Manual balance adjustment (rare cases)
- **Auth**: Admin only
- **Body**:
```javascript
{
  employeeId: "...",
  adjustmentDays: -2.5,
  reason: "Correction for prior calculation error",
  auditReference: "AUDIT-2025-001"
}
```

#### Request Management

**POST /api/vacations/requests**
- **Purpose**: Create new vacation request
- **Auth**: Employee (own), HR
- **Body**:
```javascript
{
  employeeId: "...",
  requestedStartDate: "2025-12-20",
  requestedEndDate: "2025-12-31",
  reason: "End of year vacation" // optional
}
```
- **Validation**:
  - Available balance sufficient
  - Dates are valid working days
  - Meets minimum advance notice
  - No overlapping requests
- **Response**: Created request with status 'requested'

**GET /api/vacations/requests**
- **Purpose**: List vacation requests
- **Auth**: Employee (own), HR (all), Admin (all)
- **Query Params**:
  - `employeeId`: Filter by employee
  - `status`: Filter by status
  - `startDate`, `endDate`: Date range
  - `page`, `limit`: Pagination
- **Response**: Paginated list of requests

**GET /api/vacations/requests/:id**
- **Purpose**: Get specific request details
- **Auth**: Employee (own), HR, Admin
- **Response**: Full request object with timeline

**PUT /api/vacations/requests/:id/approve**
- **Purpose**: Approve a vacation request
- **Auth**: HR, Admin (based on approverRoles)
- **Body**:
```javascript
{
  approvalNotes: "Approved with adjusted dates",
  scheduledStartDate: "2025-12-20", // can adjust dates
  scheduledEndDate: "2025-12-29"
}
```
- **Validation**:
  - Request in 'requested' status
  - Approver has permission
  - Balance still sufficient
- **Side Effects**:
  - Update balance.approvedDays
  - Transition to 'approved' state
  - Create audit log

**PUT /api/vacations/requests/:id/reject**
- **Purpose**: Reject a vacation request
- **Auth**: HR, Admin
- **Body**:
```javascript
{
  rejectionReason: "Insufficient staffing during requested period"
}
```
- **Side Effects**:
  - Release requested days back to available
  - Transition to 'rejected' state
  - Notify employee
  - Create audit log

**PUT /api/vacations/requests/:id/schedule**
- **Purpose**: Finalize vacation schedule
- **Auth**: HR, Admin
- **Body**:
```javascript
{
  confirmedStartDate: "2025-12-20",
  confirmedEndDate: "2025-12-29",
  scheduleNotes: "Confirmed with team calendar"
}
```
- **Validation**:
  - Request in 'approved' status
  - Dates within approved range
- **Side Effects**:
  - Update balance.scheduledDays
  - Transition to 'scheduled' state
  - Send confirmation to employee

**POST /api/vacations/requests/:id/enjoy**
- **Purpose**: Mark vacation as started (auto or manual)
- **Auth**: System (auto), HR (manual)
- **Body**:
```javascript
{
  actualStartDate: "2025-12-20" // defaults to scheduledStartDate
}
```
- **Side Effects**:
  - Transition to 'enjoying' state
  - Record actual start
  - Create audit log

**POST /api/vacations/requests/:id/complete**
- **Purpose**: Mark vacation as completed and deduct from balance
- **Auth**: System (auto), HR (manual)
- **Body**:
```javascript
{
  actualEndDate: "2025-12-29",
  actualDaysEnjoyed: 7 // calculated from calendar
}
```
- **Validation**:
  - Request in 'enjoying' or 'scheduled' status
  - Actual days <= approved days
- **Side Effects**:
  - **Deduct from balance.accruedDays**
  - Add to balance.enjoyedDays
  - Reset requestedDays, approvedDays, scheduledDays
  - Transition to 'enjoyed' state
  - Create audit log

**PUT /api/vacations/requests/:id/cancel**
- **Purpose**: Cancel a request (employee or HR)
- **Auth**: Employee (own, if not started), HR, Admin
- **Body**:
```javascript
{
  cancellationReason: "Personal circumstances changed"
}
```
- **Validation**:
  - Request not in 'enjoying' or 'enjoyed' status
- **Side Effects**:
  - Release all reserved days
  - Transition to 'cancelled' state
  - Create audit log

#### Audit and Reporting

**GET /api/vacations/audit**
- **Purpose**: Query audit logs
- **Auth**: HR, Admin
- **Query Params**:
  - `employeeId`: Filter by employee
  - `companyId`: Filter by company (admin only)
  - `action`: Filter by action type
  - `startDate`, `endDate`: Date range
  - `requestId`: Filter by request
  - `page`, `limit`: Pagination
- **Response**:
```javascript
{
  logs: [{
    action: "REQUEST_APPROVED",
    timestamp: "2025-11-20T10:30:00Z",
    actorRole: "talento_humano",
    entityType: "VacationRequest",
    requestNumber: "VAC-2025-0042",
    changes: {
      before: { status: "requested" },
      after: { status: "approved" },
      delta: { approvedDays: 7 }
    },
    reason: "Approved by HR manager"
  }],
  total: 156,
  page: 1,
  pages: 16
}
```

**GET /api/vacations/audit/verify**
- **Purpose**: Verify audit log integrity
- **Auth**: Admin only
- **Response**:
```javascript
{
  verified: true,
  totalLogs: 5234,
  firstLog: "...",
  lastLog: "...",
  brokenChain: false,
  invalidChecksums: []
}
```

**GET /api/vacations/reports/summary**
- **Purpose**: Company-wide vacation summary
- **Auth**: HR, Admin
- **Query Params**:
  - `companyId`: Company filter
  - `department`: Department filter
  - `year`: Year filter
- **Response**:
```javascript
{
  totalEmployees: 250,
  totalAccruedDays: 3562.5,
  totalAvailableDays: 2810.3,
  totalEnjoyedDays: 1875.0,
  utilizationRate: 0.527, // enjoyedDays / accruedDays
  pendingRequests: 15,
  approvedNotScheduled: 8,
  upcomingVacations: 22,
  byDepartment: [...]
}
```

**GET /api/vacations/reports/employee/:employeeId**
- **Purpose**: Detailed employee vacation history
- **Auth**: Employee (own), HR, Admin
- **Response**:
```javascript
{
  employeeId: "...",
  hireDate: "2023-01-15",
  totalServiceYears: 1.85,
  lifetimeAccrued: 27.66,
  lifetimeEnjoyed: 10.0,
  lifetimeCarriedOver: 0,
  currentBalance: 17.66,
  history: [
    {
      year: 2024,
      accrued: 15.0,
      enjoyed: 10.0,
      carriedOver: 0,
      requests: [...]
    },
    {
      year: 2025,
      accrued: 12.66,
      enjoyed: 0,
      carriedOver: 0,
      requests: [...]
    }
  ]
}
```

**GET /api/vacations/calendar**
- **Purpose**: Calendar view of vacations
- **Auth**: HR, Admin
- **Query Params**:
  - `companyId`, `department`
  - `startDate`, `endDate`
- **Response**:
```javascript
{
  vacations: [
    {
      date: "2025-12-20",
      employeesOnVacation: [
        {
          employeeId: "...",
          name: "...",
          department: "...",
          days: 7
        }
      ],
      totalOut: 3
    }
  ]
}
```

### 3.2 Background Jobs

**Daily Accrual Job** (runs at 00:30 AM daily)
```javascript
// Calculate accrual for all active employees
FOR EACH active employee:
  serviceDate = employee.hireDate
  lastAccrual = balance.lastAccrualDate
  today = Date.now()

  daysToAccrue = daysBetween(lastAccrual, today)
  accrualAmount = daysToAccrue * ACCRUAL_RATE // 0.04109589

  balance.accruedDays += accrualAmount
  balance.lastAccrualDate = today
  balance.save()

  CREATE_AUDIT_LOG('ACCRUAL_PROCESSED', ...)
```

**Vacation Auto-Start Job** (runs every hour)
```javascript
// Auto-start scheduled vacations
today = Date.now().startOfDay()

scheduledRequests = VacationRequest.find({
  status: 'scheduled',
  scheduledStartDate: { $lte: today }
})

FOR EACH request:
  request.status = 'enjoying'
  request.actualStartDate = request.scheduledStartDate
  request.save()

  CREATE_AUDIT_LOG('VACATION_STARTED', ...)
  SEND_NOTIFICATION(employee, "Your vacation has started")
```

**Vacation Auto-Complete Job** (runs every hour)
```javascript
// Auto-complete finished vacations
today = Date.now().startOfDay()

enjoyingRequests = VacationRequest.find({
  status: 'enjoying',
  scheduledEndDate: { $lt: today }
})

FOR EACH request:
  actualDays = calculateWorkingDays(
    request.actualStartDate,
    request.scheduledEndDate
  )

  // Deduct from balance
  balance = VacationBalance.findOne({ employeeId: request.employeeId })
  balance.accruedDays -= actualDays
  balance.enjoyedDays += actualDays
  balance.requestedDays -= request.requestedDays
  balance.approvedDays -= request.approvedDays
  balance.scheduledDays -= request.scheduledDays
  balance.save()

  request.status = 'enjoyed'
  request.actualEndDate = request.scheduledEndDate
  request.actualDaysEnjoyed = actualDays
  request.save()

  CREATE_AUDIT_LOG('VACATION_ENDED', ...)
  SEND_NOTIFICATION(employee, "Welcome back!")
```

## 4. Business Logic Architecture

### 4.1 Core Calculations

**Working Days Calculator**
```javascript
function calculateWorkingDays(startDate, endDate, companyId) {
  let count = 0
  let current = new Date(startDate)

  // Get company non-working days
  const holidays = VacationCalendar.find({
    companyId: companyId,
    date: { $gte: startDate, $lte: endDate }
  })

  const holidaySet = new Set(holidays.map(h => h.date.toISOString()))

  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    const dateStr = current.toISOString()

    // Skip weekends (Saturday=6, Sunday=0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Skip holidays
      if (!holidaySet.has(dateStr)) {
        count++
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return count
}
```

**Accrual Calculator**
```javascript
function calculateAccrual(hireDate, suspensionDays = 0) {
  const today = new Date()
  const totalCalendarDays = daysBetween(hireDate, today)
  const effectiveServiceDays = totalCalendarDays - suspensionDays

  const ACCRUAL_RATE = 15 / 365 // 0.04109589...
  const accruedDays = effectiveServiceDays * ACCRUAL_RATE

  return {
    totalCalendarDays,
    effectiveServiceDays,
    suspensionDays,
    accruedDays: Math.round(accruedDays * 100000000) / 100000000 // 8 decimals
  }
}
```

**Balance Validator**
```javascript
function validateBalance(balance) {
  const errors = []

  // Available days must be non-negative
  const available = balance.accruedDays - balance.requestedDays
  if (available < 0) {
    errors.push(`Available days cannot be negative: ${available}`)
  }

  // Enjoyed days cannot exceed accrued
  if (balance.enjoyedDays > balance.accruedDays) {
    errors.push(`Enjoyed days (${balance.enjoyedDays}) exceeds accrued (${balance.accruedDays})`)
  }

  // Requested should match sum of active requests
  const sumRequested = VacationRequest.aggregate([
    {
      $match: {
        employeeId: balance.employeeId,
        status: { $in: ['requested', 'approved', 'scheduled', 'enjoying'] }
      }
    },
    { $group: { _id: null, total: { $sum: '$requestedDays' } } }
  ])

  if (Math.abs(sumRequested - balance.requestedDays) > 0.001) {
    errors.push(`Requested days mismatch: balance=${balance.requestedDays}, calculated=${sumRequested}`)
  }

  return { valid: errors.length === 0, errors }
}
```

### 4.2 State Machine Logic

**VacationRequest State Transitions**
```javascript
const STATE_TRANSITIONS = {
  draft: ['requested', 'cancelled'],
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['enjoying', 'cancelled'],
  enjoying: ['enjoyed'],
  enjoyed: [], // terminal state
  rejected: [], // terminal state
  cancelled: [] // terminal state
}

function canTransition(fromState, toState) {
  return STATE_TRANSITIONS[fromState]?.includes(toState) || false
}

function transitionState(request, newState, actor, reason) {
  if (!canTransition(request.status, newState)) {
    throw new Error(
      `Invalid transition from ${request.status} to ${newState}`
    )
  }

  const oldState = request.status
  request.status = newState

  // Update state-specific fields
  switch (newState) {
    case 'requested':
      request.requestedBy = actor._id
      request.requestedAt = new Date()
      break
    case 'approved':
      request.approvedBy = actor._id
      request.approvedAt = new Date()
      break
    case 'rejected':
      request.rejectedBy = actor._id
      request.rejectedAt = new Date()
      request.rejectionReason = reason
      break
    case 'scheduled':
      request.scheduledBy = actor._id
      request.scheduledAt = new Date()
      break
    case 'enjoying':
      request.actualStartDate = request.actualStartDate || request.scheduledStartDate
      break
    case 'enjoyed':
      request.actualEndDate = request.actualEndDate || request.scheduledEndDate
      request.actualDaysEnjoyed = calculateWorkingDays(
        request.actualStartDate,
        request.actualEndDate,
        request.companyId
      )
      break
  }

  request.version++
  request.save()

  // Create audit log
  createAuditLog({
    action: `REQUEST_${newState.toUpperCase()}`,
    actorId: actor._id,
    entityType: 'VacationRequest',
    entityId: request._id,
    employeeId: request.employeeId,
    companyId: request.companyId,
    changes: {
      before: { status: oldState },
      after: { status: newState }
    },
    reason: reason
  })

  return request
}
```

### 4.3 Validation Rules

**Request Validation**
```javascript
async function validateVacationRequest(requestData, employeeId) {
  const errors = []

  // 1. Check balance
  const balance = await VacationBalance.findOne({ employeeId })
  if (!balance) {
    errors.push('Employee has no vacation balance record')
    return { valid: false, errors }
  }

  const available = balance.accruedDays - balance.requestedDays
  if (requestData.requestedDays > available) {
    errors.push(
      `Insufficient balance: requested ${requestData.requestedDays}, ` +
      `available ${available.toFixed(2)}`
    )
  }

  // 2. Check date validity
  const startDate = new Date(requestData.requestedStartDate)
  const endDate = new Date(requestData.requestedEndDate)

  if (endDate < startDate) {
    errors.push('End date must be after start date')
  }

  // 3. Check working days match
  const workingDays = calculateWorkingDays(startDate, endDate, balance.companyId)
  if (workingDays !== requestData.requestedDays) {
    errors.push(
      `Working days mismatch: requested ${requestData.requestedDays}, ` +
      `calculated ${workingDays}`
    )
  }

  // 4. Check advance notice
  const config = await VacationConfiguration.findOne({
    companyId: balance.companyId
  })
  const daysUntilStart = daysBetween(new Date(), startDate)
  if (daysUntilStart < (config?.minAdvanceNoticeDays || 15)) {
    errors.push(
      `Minimum advance notice is ${config?.minAdvanceNoticeDays || 15} days`
    )
  }

  // 5. Check for overlaps
  const overlapping = await VacationRequest.findOne({
    employeeId: employeeId,
    status: { $in: ['requested', 'approved', 'scheduled', 'enjoying'] },
    $or: [
      {
        requestedStartDate: { $lte: endDate },
        requestedEndDate: { $gte: startDate }
      }
    ]
  })

  if (overlapping) {
    errors.push(
      `Overlaps with existing request ${overlapping.requestNumber}`
    )
  }

  // 6. Check policy limits
  if (requestData.requestedDays < (config?.minRequestDays || 1)) {
    errors.push(`Minimum request is ${config?.minRequestDays || 1} days`)
  }

  if (requestData.requestedDays > (config?.maxRequestDays || 15)) {
    errors.push(`Maximum request is ${config?.maxRequestDays || 15} days`)
  }

  return { valid: errors.length === 0, errors, warnings: [] }
}
```

## 5. Security Architecture

### 5.1 Role-Based Access Control

**Roles and Permissions:**
```javascript
const VACATION_PERMISSIONS = {
  colaboradores: [
    'vacation:view-own-balance',
    'vacation:create-own-request',
    'vacation:view-own-requests',
    'vacation:cancel-own-request'
  ],

  talento_humano: [
    'vacation:view-all-balances',
    'vacation:view-all-requests',
    'vacation:approve-requests',
    'vacation:reject-requests',
    'vacation:schedule-vacations',
    'vacation:complete-vacations',
    'vacation:view-reports',
    'vacation:view-audit-logs',
    'vacation:adjust-balances'
  ],

  admin: [
    'vacation:*' // All permissions
  ],

  super_admin: [
    'vacation:*',
    'vacation:manage-configuration',
    'vacation:verify-audit-integrity'
  ]
}

function checkPermission(user, permission) {
  const userPermissions = VACATION_PERMISSIONS[user.role] || []
  return userPermissions.includes(permission) ||
         userPermissions.includes('vacation:*')
}
```

### 5.2 Data Protection

**PII Handling:**
1. **Never store PII in audit logs** - Only store user IDs
2. **Encrypt sensitive fields** - Reason, notes (optional)
3. **Sanitize responses** - Remove internal fields for non-admin
4. **Audit access** - Log all data access attempts

**Audit Log Sanitization:**
```javascript
function sanitizeForAudit(object, entityType) {
  const sanitized = { ...object }

  // Remove PII fields
  const piiFields = ['name', 'email', 'phone', 'address', 'ssn']
  piiFields.forEach(field => delete sanitized[field])

  // Keep only relevant fields
  const relevantFields = {
    VacationBalance: [
      'accruedDays', 'requestedDays', 'approvedDays',
      'enjoyedDays', 'suspensionDays', 'lastAccrualDate'
    ],
    VacationRequest: [
      'requestedDays', 'status', 'requestedStartDate',
      'requestedEndDate', 'actualDaysEnjoyed'
    ]
  }

  const keep = relevantFields[entityType] || []
  Object.keys(sanitized).forEach(key => {
    if (!keep.includes(key) && key !== '_id' && key !== 'version') {
      delete sanitized[key]
    }
  })

  return sanitized
}
```

### 5.3 Audit Integrity

**Blockchain-like Verification:**
```javascript
function createAuditLog(logData) {
  // Get previous log
  const previousLog = VacationAuditLog.findOne()
    .sort({ timestamp: -1 })
    .limit(1)

  const sanitizedData = {
    action: logData.action,
    actorId: logData.actorId,
    entityType: logData.entityType,
    entityId: logData.entityId,
    changes: sanitizeForAudit(logData.changes, logData.entityType),
    timestamp: new Date()
  }

  // Calculate checksum
  const dataString = JSON.stringify(sanitizedData)
  const previousChecksum = previousLog?.checksum || 'GENESIS'
  const checksum = crypto
    .createHash('sha256')
    .update(previousChecksum + dataString)
    .digest('hex')

  const auditLog = new VacationAuditLog({
    ...sanitizedData,
    checksum: checksum,
    previousLogId: previousLog?._id || null
  })

  return auditLog.save()
}

function verifyAuditIntegrity() {
  const logs = VacationAuditLog.find().sort({ timestamp: 1 })
  let previousChecksum = 'GENESIS'
  const broken = []

  logs.forEach(log => {
    const dataString = JSON.stringify({
      action: log.action,
      actorId: log.actorId,
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes,
      timestamp: log.timestamp
    })

    const expectedChecksum = crypto
      .createHash('sha256')
      .update(previousChecksum + dataString)
      .digest('hex')

    if (log.checksum !== expectedChecksum) {
      broken.push({
        logId: log._id,
        expected: expectedChecksum,
        actual: log.checksum
      })
    }

    previousChecksum = log.checksum
  })

  return {
    verified: broken.length === 0,
    brokenChain: broken.length > 0,
    invalidChecksums: broken
  }
}
```

## 6. Integration Architecture

### 6.1 Notifications

**Email Templates:**
- `VACATION_REQUESTED` - To HR when employee submits request
- `VACATION_APPROVED` - To employee when approved
- `VACATION_REJECTED` - To employee when rejected
- `VACATION_SCHEDULED` - To employee when dates confirmed
- `VACATION_STARTING_SOON` - Reminder 3 days before
- `VACATION_COMPLETED` - Welcome back message

**Notification Service Integration:**
```javascript
async function sendVacationNotification(type, request, recipient) {
  const templates = {
    VACATION_REQUESTED: {
      subject: 'Nueva solicitud de vacaciones - {requestNumber}',
      template: 'vacation-requested',
      recipients: ['talento_humano']
    },
    VACATION_APPROVED: {
      subject: 'Vacaciones aprobadas - {requestNumber}',
      template: 'vacation-approved',
      recipients: ['employee']
    },
    // ... other templates
  }

  const config = templates[type]
  const data = {
    requestNumber: request.requestNumber,
    employeeName: recipient.name,
    startDate: request.requestedStartDate,
    endDate: request.requestedEndDate,
    days: request.requestedDays
  }

  await emailService.send({
    to: recipient.email,
    subject: interpolate(config.subject, data),
    template: config.template,
    data: data
  })
}
```

### 6.2 Payroll Integration

**Export for Payroll:**
```javascript
// GET /api/vacations/payroll/export
async function exportForPayroll(companyId, startDate, endDate) {
  const enjoyed = await VacationRequest.find({
    companyId: companyId,
    status: 'enjoyed',
    actualStartDate: { $gte: startDate },
    actualEndDate: { $lte: endDate }
  }).populate('employeeId', 'email name employeeCode')

  return enjoyed.map(req => ({
    employeeCode: req.employeeId.employeeCode,
    employeeName: req.employeeId.name,
    vacationStartDate: req.actualStartDate,
    vacationEndDate: req.actualEndDate,
    workingDaysEnjoyed: req.actualDaysEnjoyed,
    calendarDaysEnjoyed: daysBetween(req.actualStartDate, req.actualEndDate),
    requestNumber: req.requestNumber
  }))
}
```

### 6.3 Calendar Integration

**iCalendar Export:**
```javascript
// GET /api/vacations/calendar/export.ics
function exportToICalendar(employeeId) {
  const requests = VacationRequest.find({
    employeeId: employeeId,
    status: { $in: ['scheduled', 'enjoying'] }
  })

  const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Legal Bot//Vacation Calendar//EN
${requests.map(req => `
BEGIN:VEVENT
UID:vacation-${req._id}@legalbot.com
DTSTAMP:${formatICalDate(new Date())}
DTSTART:${formatICalDate(req.scheduledStartDate)}
DTEND:${formatICalDate(req.scheduledEndDate)}
SUMMARY:Vacaciones
DESCRIPTION:Solicitud ${req.requestNumber} - ${req.requestedDays} días
STATUS:CONFIRMED
END:VEVENT
`).join('')}
END:VCALENDAR`

  return ical
}
```

## 7. Performance Architecture

### 7.1 Optimization Strategies

**Indexing Strategy:**
```javascript
// Most critical indexes
VacationBalance:
  { employeeId: 1, companyId: 1 } // Unique, primary lookup
  { lastAccrualDate: 1 } // For batch processing

VacationRequest:
  { requestNumber: 1 } // Unique, lookup
  { employeeId: 1, status: 1 } // Employee queries
  { companyId: 1, requestedStartDate: 1 } // Reports
  { status: 1, scheduledStartDate: 1 } // Auto-start job

VacationAuditLog:
  { employeeId: 1, timestamp: -1 } // Employee history
  { companyId: 1, timestamp: -1 } // Company reports
  { entityId: 1, timestamp: -1 } // Entity timeline
```

**Caching Strategy:**
```javascript
// Cache balance for 5 minutes
const balanceCache = new NodeCache({ stdTTL: 300 })

async function getBalanceWithCache(employeeId) {
  const cacheKey = `balance:${employeeId}`
  let balance = balanceCache.get(cacheKey)

  if (!balance) {
    balance = await VacationBalance.findOne({ employeeId })
    balanceCache.set(cacheKey, balance)
  }

  return balance
}

// Invalidate on changes
function invalidateBalanceCache(employeeId) {
  balanceCache.del(`balance:${employeeId}`)
}
```

**Batch Processing:**
```javascript
// Process accruals in batches of 100
async function processDailyAccruals() {
  const batchSize = 100
  let processed = 0

  const cursor = VacationBalance.find({ active: true })
    .cursor()
    .batchSize(batchSize)

  for await (const balance of cursor) {
    try {
      await processAccrualForEmployee(balance)
      processed++

      if (processed % batchSize === 0) {
        console.log(`Processed ${processed} accruals...`)
      }
    } catch (error) {
      console.error(`Error processing ${balance.employeeId}:`, error)
    }
  }

  console.log(`Total processed: ${processed}`)
}
```

### 7.2 Scalability Considerations

**Database Sharding:**
- Shard by `companyId` for multi-tenant isolation
- Each company's data on separate shard
- Supports 10,000+ companies

**Read Replicas:**
- Reports and analytics use read replicas
- Writes go to primary
- Reduces load on primary database

**Archival Strategy:**
```javascript
// Archive old audit logs after 5 years
async function archiveOldAuditLogs() {
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

  const oldLogs = await VacationAuditLog.find({
    timestamp: { $lt: fiveYearsAgo }
  })

  // Export to cold storage (S3, etc.)
  await exportToArchive(oldLogs, 'audit-logs-archive')

  // Delete from primary database
  await VacationAuditLog.deleteMany({
    timestamp: { $lt: fiveYearsAgo }
  })
}
```

## 8. Testing Architecture

### 8.1 Unit Tests

**Balance Calculation Tests:**
```javascript
describe('Vacation Balance Calculations', () => {
  it('should calculate correct accrual for 1 year', () => {
    const hireDate = new Date('2024-01-01')
    const result = calculateAccrual(hireDate, 0)

    expect(result.totalCalendarDays).toBe(365)
    expect(result.accruedDays).toBeCloseTo(15.0, 2)
  })

  it('should account for suspension days', () => {
    const hireDate = new Date('2024-01-01')
    const suspensionDays = 30
    const result = calculateAccrual(hireDate, suspensionDays)

    const expectedDays = (365 - 30) * (15/365)
    expect(result.accruedDays).toBeCloseTo(expectedDays, 2)
  })
})
```

**State Machine Tests:**
```javascript
describe('Vacation Request State Machine', () => {
  it('should allow transition from requested to approved', () => {
    expect(canTransition('requested', 'approved')).toBe(true)
  })

  it('should not allow transition from enjoyed to approved', () => {
    expect(canTransition('enjoyed', 'approved')).toBe(false)
  })

  it('should throw error on invalid transition', () => {
    const request = { status: 'enjoyed' }
    expect(() => {
      transitionState(request, 'approved', {}, '')
    }).toThrow('Invalid transition')
  })
})
```

### 8.2 Integration Tests

**Request Approval Flow:**
```javascript
describe('Vacation Request Approval Flow', () => {
  it('should complete full approval flow', async () => {
    // Create request
    const request = await POST('/api/vacations/requests', {
      employeeId: employee._id,
      requestedStartDate: '2025-12-20',
      requestedEndDate: '2025-12-27',
      reason: 'End of year'
    })

    expect(request.status).toBe('requested')

    // Approve
    const approved = await PUT(`/api/vacations/requests/${request._id}/approve`, {
      approvalNotes: 'Approved'
    })

    expect(approved.status).toBe('approved')

    // Check balance updated
    const balance = await GET(`/api/vacations/balance/${employee._id}`)
    expect(balance.approvedDays).toBe(5)

    // Check audit log created
    const logs = await GET(`/api/vacations/audit?requestId=${request._id}`)
    expect(logs.logs).toHaveLength(2) // Created + Approved
  })
})
```

### 8.3 Load Tests

**Concurrent Request Creation:**
```javascript
describe('Load Tests', () => {
  it('should handle 100 concurrent requests', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      POST('/api/vacations/requests', {
        employeeId: employees[i]._id,
        requestedStartDate: '2025-12-20',
        requestedEndDate: '2025-12-27'
      })
    )

    const results = await Promise.all(promises)
    expect(results.filter(r => r.status === 'requested')).toHaveLength(100)
  })
})
```

## 9. Deployment Architecture

### 9.1 Environment Configuration

**Environment Variables:**
```bash
# Vacation Module Configuration
VACATION_ACCRUAL_RATE=0.04109589
VACATION_DAY_BASIS=365
VACATION_MIN_ADVANCE_DAYS=15
VACATION_AUTO_START_ENABLED=true
VACATION_AUTO_COMPLETE_ENABLED=true
VACATION_AUDIT_RETENTION_YEARS=5

# Cron Jobs
VACATION_ACCRUAL_CRON="0 0 * * *"  # Daily at midnight
VACATION_AUTO_START_CRON="0 * * * *"  # Hourly
VACATION_AUTO_COMPLETE_CRON="0 * * * *"  # Hourly

# Notifications
VACATION_NOTIFICATIONS_ENABLED=true
VACATION_EMAIL_FROM=noreply@legalbot.com
```

### 9.2 Migration Strategy

**Phase 1: Database Setup**
1. Run migration to create tables
2. Create indexes
3. Seed vacation calendar with Colombian holidays

**Phase 2: Data Migration**
1. Import existing employee hire dates
2. Calculate initial balances
3. Import historical vacation records (if any)

**Phase 3: Rollout**
1. Enable for pilot department (HR)
2. Monitor for 2 weeks
3. Gradual rollout to other departments
4. Full production deployment

### 9.3 Monitoring

**Key Metrics:**
```javascript
// Prometheus metrics
vacation_requests_total{status, company}
vacation_balance_total{company}
vacation_accrual_processing_duration_seconds
vacation_audit_logs_total
vacation_api_request_duration_seconds{endpoint, method}
vacation_validation_errors_total{type}
```

**Alerts:**
- Balance goes negative
- Audit log checksum fails
- Accrual job fails
- API response time > 2s
- High validation error rate

## 10. Documentation Requirements

### 10.1 User Documentation

**For Employees:**
1. How to request vacations
2. How to check balance
3. How to cancel requests
4. FAQs about Colombian labor law

**For HR:**
1. Approval workflow guide
2. Report generation guide
3. Balance adjustment procedures
4. Audit log interpretation

**For Admins:**
1. Configuration guide
2. Troubleshooting guide
3. Data migration procedures
4. Backup and recovery

### 10.2 Developer Documentation

1. API Reference (OpenAPI/Swagger)
2. Database Schema Reference
3. State Machine Diagrams
4. Integration Guide
5. Testing Guide

## Conclusion

This architecture provides a robust, scalable, and legally compliant vacation management system for Colombian labor law. The design emphasizes:

1. **Accuracy**: Precise calculations with 8-decimal precision
2. **Compliance**: Full adherence to Colombian labor regulations
3. **Auditability**: Immutable audit trails with integrity verification
4. **Security**: Role-based access with PII protection
5. **Scalability**: Optimized for large organizations
6. **Maintainability**: Clear separation of concerns and comprehensive testing

The system is ready for implementation following the SPARC methodology, with all architectural decisions documented and justified.
