# Architecture Decision Records - Vacation Module

## ADR-001: Calendar Days Basis (365 vs 360)

**Status**: Accepted

**Context**:
Colombian labor law states that employees accrue 15 working days of vacation per year of service. The calculation must determine whether to use 365 or 360 calendar days as the basis for daily accrual.

**Decision**:
Use **365 calendar days** as the basis for accrual calculation.

**Accrual Rate**: 15 working days / 365 calendar days = **0.04109589** days per calendar day

**Rationale**:

1. **Legal Alignment**: Colombian labor law uses calendar years (365 days) for service calculation, not commercial years (360 days).

2. **Precision**: Using 365 days provides more accurate accrual that matches actual time worked:
   - 1 year = 365 days → 15.00 vacation days (exact)
   - Using 360 days would give: (365/360) * 15 = 15.21 days (over-accrual)

3. **Industry Standard**: Most Colombian HRIS systems use 365-day basis for vacation calculations.

4. **Leap Years**: We handle leap years by calculating actual days between hire date and current date, not assuming 365 days per year.

5. **Simplicity**: Employees understand "1 day worked = 0.041 days vacation" better than commercial year calculations.

**Consequences**:

**Positive**:
- Legally compliant with Colombian labor law
- More accurate accrual matching actual service time
- Easier to explain to employees
- No need for complex leap year adjustments in accrual rate

**Negative**:
- Slightly more complex than 360-day commercial year (minimal impact)
- Need to handle leap years in date calculations (already standard practice)

**Alternatives Considered**:

1. **360-day commercial year**: Common in financial calculations but not appropriate for labor law
2. **Monthly accrual (15/12)**: Less accurate for daily tracking
3. **Yearly lump sum**: Not compliant with Colombian law requiring proportional accrual

**Implementation**:
```javascript
const ACCRUAL_RATE = 15 / 365; // 0.04109589041095890...
const PRECISION = 8; // Store 8 decimal places

function calculateDailyAccrual(days) {
  return Math.round(days * ACCRUAL_RATE * Math.pow(10, PRECISION)) / Math.pow(10, PRECISION);
}
```

**Verification**:
- 365 days * 0.04109589 = 15.00 days ✓
- 730 days * 0.04109589 = 30.00 days ✓
- 182 days * 0.04109589 = 7.48 days ✓

---

## ADR-002: Working Days vs Calendar Days

**Status**: Accepted

**Context**:
Colombian law grants 15 **working days** (días hábiles) of vacation, not calendar days. The system must handle conversion between working days and calendar days for:
- Balance tracking (working days)
- Request periods (calendar days span)
- Actual enjoyment (calendar days but counted as working days)

**Decision**:
1. **Store all balances in working days**
2. **Calculate working days for requests** by excluding weekends and holidays
3. **Allow users to select calendar date ranges** (start/end dates)
4. **Display both working and calendar days** in UI

**Rationale**:

1. **Legal Compliance**: Colombian Labor Code Article 186 specifies "working days"

2. **Accuracy**: Working days vary by:
   - Weekends (Saturday, Sunday)
   - National holidays (18+ per year in Colombia)
   - Company-specific non-working days

3. **Flexibility**: Employees think in calendar date ranges ("Dec 20 - Dec 31") but legal entitlement is working days

4. **Transparency**: Showing both helps employees understand "10 working days = 14 calendar days (with weekend)"

**Working Days Calculation**:
```javascript
function calculateWorkingDays(startDate, endDate, companyId) {
  // Count only Monday-Friday, excluding holidays
  let workingDays = 0;
  let current = new Date(startDate);

  // Get company holidays
  const holidays = await VacationCalendar.find({
    companyId: companyId,
    date: { $gte: startDate, $lte: endDate }
  });

  const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    // Count if: Monday-Friday AND not a holiday
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidaySet.has(dateStr)) {
      workingDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}
```

**Example Scenarios**:

**Scenario 1**: Request Dec 23-27, 2025 (Tuesday-Saturday)
- Calendar days: 5 days
- Working days: 3 days (Tue, Wed, Thu)
- Friday/Saturday are weekend

**Scenario 2**: Request Dec 23-31, 2025 (with Dec 25 holiday)
- Calendar days: 9 days
- Working days: 5 days (Dec 23, 24, 26, 29, 30)
- Excluding: weekends (27-28, Jan 4-5) and Dec 25 (Christmas)

**Consequences**:

**Positive**:
- Legally compliant with Colombian labor law
- Accurate tracking of actual working days
- Handles company-specific calendars
- Transparent to employees

**Negative**:
- More complex than calendar days
- Requires holiday calendar maintenance
- Date range selection can be confusing (10 working days ≠ 10 calendar days)

**Mitigations**:
1. **UI Helper**: Show real-time working days count as user selects dates
2. **Holiday Calendar**: Pre-populate Colombian national holidays
3. **Validation**: Warn if selected range has more weekends than expected

**UI Example**:
```
Select vacation dates:
Start: [Dec 20, 2025] (Monday)
End:   [Dec 31, 2025] (Wednesday)

Calculated:
- Calendar days: 12 days
- Working days: 8 days
- Weekends: 4 days (Dec 20-21, 27-28)
- Holidays: 0 days

This will deduct 8.0 days from your balance.
Available: 15.5 days → 7.5 days after approval
```

---

## ADR-003: Suspension and Unpaid Leave Handling

**Status**: Accepted

**Context**:
Colombian labor law Article 187 states that vacation accrual is suspended during:
- Unpaid leaves (licencias no remuneradas)
- Suspensions of employment contract
- Strikes and lockouts

The system must track these periods and adjust accrual accordingly.

**Decision**:
1. **Track suspension days separately** in `VacationBalance.suspensionDays`
2. **Do NOT accrue vacation during suspension periods**
3. **Adjust effective service days** for accrual calculation
4. **Require manual recording** of suspension periods by HR

**Calculation**:
```javascript
function calculateAccrualWithSuspensions(hireDate, suspensionDays) {
  const totalCalendarDays = daysBetween(hireDate, today);
  const effectiveServiceDays = totalCalendarDays - suspensionDays;
  const accruedDays = effectiveServiceDays * ACCRUAL_RATE;

  return {
    totalCalendarDays,
    suspensionDays,
    effectiveServiceDays,
    accruedDays
  };
}
```

**Example**:
- Hire date: Jan 1, 2024
- Today: Jan 1, 2025
- Total calendar days: 365 days
- Suspension period: 30 days (unpaid leave)
- **Effective service days: 335 days**
- **Accrued vacation: 335 * 0.04109589 = 13.77 days** (not 15.0)

**Suspension Recording API**:
```javascript
POST /api/vacations/balance/suspension
{
  employeeId: "...",
  suspensionStartDate: "2024-06-01",
  suspensionEndDate: "2024-06-30",
  suspensionType: "UNPAID_LEAVE",
  reason: "Personal leave without pay",
  documentReference: "HR-LEAVE-2024-042"
}
```

**Rationale**:

1. **Legal Compliance**: Article 187 explicitly excludes these periods
2. **Fairness**: Employees only accrue for time actually worked
3. **Accuracy**: Prevents over-accrual during absences
4. **Audit Trail**: Full documentation of suspension periods

**Suspension Types**:
```javascript
const SUSPENSION_TYPES = {
  UNPAID_LEAVE: 'Licencia no remunerada',
  DISCIPLINARY_SUSPENSION: 'Suspensión disciplinaria',
  STRIKE: 'Huelga',
  LOCKOUT: 'Cierre patronal',
  CONTRACT_SUSPENSION: 'Suspensión de contrato',
  OTHER: 'Otro (especificar)'
};
```

**Consequences**:

**Positive**:
- Legally compliant accrual calculation
- Fair treatment of actual service time
- Complete audit trail for labor inspections
- Prevents disputes over accrual amounts

**Negative**:
- Requires HR to manually record suspensions
- More complex calculations
- Need to educate HR on suspension types

**Mitigations**:
1. **Validation**: Prevent overlapping suspension periods
2. **Notifications**: Alert HR when suspension period ends to resume accrual
3. **Reports**: Monthly suspension summary for review
4. **Integration**: Future integration with payroll system to auto-detect unpaid periods

**Alternative Considered**:
- **Automatic detection from payroll**: Better long-term but requires payroll integration (future enhancement)

---

## ADR-004: Audit Log Strategy - No PII

**Status**: Accepted

**Context**:
The system must maintain a complete audit trail for:
- Labor inspections (Ministerio del Trabajo)
- Internal audits
- Dispute resolution
- Compliance verification

However, storing Personally Identifiable Information (PII) in logs creates:
- GDPR/data protection compliance risks
- Increased attack surface for data breaches
- Complications with data retention policies
- Privacy concerns

**Decision**:
**Store NO PII in audit logs - only user IDs and sanitized data.**

**What is logged**:
- User IDs (ObjectId references)
- User roles (not names)
- Numerical values (days, dates)
- Status changes
- Timestamps
- Action types

**What is NOT logged**:
- Names
- Email addresses
- Phone numbers
- Personal reasons/notes (optional: encrypted if needed)
- IP addresses (optional: for security logs only)

**Example Audit Log**:
```javascript
{
  _id: "...",
  action: "REQUEST_APPROVED",
  timestamp: "2025-11-20T10:30:00Z",

  // NO PII - only IDs
  actorId: ObjectId("507f1f77bcf86cd799439011"),
  actorRole: "talento_humano",
  employeeId: ObjectId("507f1f77bcf86cd799439012"),
  companyId: ObjectId("507f1f77bcf86cd799439013"),

  entityType: "VacationRequest",
  entityId: ObjectId("507f1f77bcf86cd799439014"),
  requestNumber: "VAC-2025-0042",

  changes: {
    before: {
      status: "requested",
      requestedDays: 7,
      approvedDays: 0
    },
    after: {
      status: "approved",
      requestedDays: 7,
      approvedDays: 7
    },
    delta: {
      status: "requested → approved",
      approvedDays: "+7"
    }
  },

  reason: "Approved for end of year period",

  // Blockchain-like integrity
  checksum: "a1b2c3d4...",
  previousLogId: ObjectId("...")
}
```

**Retrieving User Information**:
When displaying audit logs, join with User collection:
```javascript
const auditLogs = await VacationAuditLog.find({ employeeId })
  .populate('actorId', 'name role')
  .populate('employeeId', 'name email');

// Display includes names, but logs themselves don't store them
```

**Rationale**:

1. **Privacy by Design**: Minimize PII exposure
2. **GDPR Compliance**: Right to be forgotten doesn't break audit trail
3. **Security**: Breach of audit logs doesn't expose personal data
4. **Retention**: Can keep logs for 5+ years without PII concerns
5. **Performance**: Smaller log documents, faster queries

**Data Sanitization**:
```javascript
function sanitizeForAudit(object, entityType) {
  // Remove all PII fields
  const piiFields = [
    'name', 'email', 'phone', 'address', 'ssn',
    'personalNotes', 'medicalInfo'
  ];

  const sanitized = { ...object };
  piiFields.forEach(field => delete sanitized[field]);

  // Keep only relevant fields for entity type
  const allowedFields = {
    VacationBalance: [
      'accruedDays', 'requestedDays', 'approvedDays',
      'enjoyedDays', 'suspensionDays', 'lastAccrualDate'
    ],
    VacationRequest: [
      'requestedDays', 'status', 'requestedStartDate',
      'requestedEndDate', 'actualDaysEnjoyed'
    ]
  };

  const keep = allowedFields[entityType] || [];
  Object.keys(sanitized).forEach(key => {
    if (!keep.includes(key) && key !== '_id' && key !== 'version') {
      delete sanitized[key];
    }
  });

  return sanitized;
}
```

**Consequences**:

**Positive**:
- Enhanced privacy protection
- GDPR/CCPA compliance
- Reduced data breach risk
- Simplified data retention
- Smaller log size
- Faster queries

**Negative**:
- Need to join with User collection for display
- Cannot reconstruct exact names from logs alone (intentional)
- Slightly more complex retrieval

**Mitigations**:
1. **Caching**: Cache user lookups for report generation
2. **Indexing**: Optimize joins with proper indexes
3. **Documentation**: Clear documentation that logs are PII-free by design

**Alternatives Considered**:
1. **Encrypt PII**: More complex, still stores PII
2. **Separate PII logs**: Duplicate data, synchronization issues
3. **Hash PII**: Cannot reverse, defeats purpose of audit

**Compliance Check**:
- ✅ Colombian Labor Law: Audit trail intact
- ✅ GDPR Article 17: Right to be forgotten doesn't break logs
- ✅ Data Minimization: Only essential data stored
- ✅ Security: Minimal exposure in breach

---

## ADR-005: Audit Log Integrity Verification

**Status**: Accepted

**Context**:
Audit logs must be tamper-proof for legal compliance. If logs are modified, the system must detect it. Traditional database logs can be altered by database administrators or attackers.

**Decision**:
Implement **blockchain-like chaining with SHA-256 checksums** to verify audit log integrity.

**Mechanism**:
Each audit log entry contains:
1. **checksum**: SHA-256 hash of (previous log's checksum + current log data)
2. **previousLogId**: Reference to previous log entry

**Implementation**:
```javascript
function createAuditLog(logData) {
  // Get most recent log
  const previousLog = await VacationAuditLog
    .findOne()
    .sort({ timestamp: -1 })
    .limit(1);

  const sanitizedData = sanitizeForAudit(logData);

  // Calculate checksum
  const dataString = JSON.stringify({
    action: sanitizedData.action,
    actorId: sanitizedData.actorId,
    entityId: sanitizedData.entityId,
    changes: sanitizedData.changes,
    timestamp: sanitizedData.timestamp
  });

  const previousChecksum = previousLog?.checksum || 'GENESIS';
  const checksum = crypto
    .createHash('sha256')
    .update(previousChecksum + dataString)
    .digest('hex');

  const auditLog = new VacationAuditLog({
    ...sanitizedData,
    checksum: checksum,
    previousLogId: previousLog?._id || null
  });

  return auditLog.save();
}
```

**Verification**:
```javascript
async function verifyAuditIntegrity() {
  const logs = await VacationAuditLog.find().sort({ timestamp: 1 });

  let previousChecksum = 'GENESIS';
  const broken = [];

  for (const log of logs) {
    const dataString = JSON.stringify({
      action: log.action,
      actorId: log.actorId,
      entityId: log.entityId,
      changes: log.changes,
      timestamp: log.timestamp
    });

    const expectedChecksum = crypto
      .createHash('sha256')
      .update(previousChecksum + dataString)
      .digest('hex');

    if (log.checksum !== expectedChecksum) {
      broken.push({
        logId: log._id,
        timestamp: log.timestamp,
        expected: expectedChecksum,
        actual: log.checksum
      });
    }

    previousChecksum = log.checksum;
  }

  return {
    verified: broken.length === 0,
    totalLogs: logs.length,
    brokenChain: broken.length > 0,
    invalidChecksums: broken
  };
}
```

**Example Chain**:
```
Log 1:
  previousLogId: null
  checksum: SHA256('GENESIS' + log1Data) = 'a1b2c3...'

Log 2:
  previousLogId: log1._id
  checksum: SHA256('a1b2c3...' + log2Data) = 'd4e5f6...'

Log 3:
  previousLogId: log2._id
  checksum: SHA256('d4e5f6...' + log3Data) = 'g7h8i9...'
```

**Tamper Detection**:
If someone modifies Log 2:
- Log 2's checksum will be invalid (doesn't match recalculated)
- Log 3's checksum will also be invalid (used wrong previous checksum)
- **Cascade effect**: All subsequent logs are invalidated

**Rationale**:

1. **Immutability Proof**: Any modification breaks the chain
2. **Tamper Evidence**: Cannot silently alter logs
3. **Legal Validity**: Demonstrates logs haven't been tampered with
4. **No External Dependencies**: No need for third-party blockchain
5. **Performance**: SHA-256 is fast, minimal overhead

**Verification Schedule**:
- **Daily**: Automated integrity check (alerting)
- **Weekly**: Full chain verification report
- **On-Demand**: Before labor inspections or audits

**Consequences**:

**Positive**:
- Cryptographically provable integrity
- Tamper detection within seconds
- Legal defensibility
- No external dependencies
- Minimal performance impact

**Negative**:
- Logs are truly immutable (cannot correct typos)
- Chain break requires investigation and explanation
- Slightly increased storage (checksum field)

**Mitigations**:
1. **Correction Logs**: If error found, create correction log (don't modify)
2. **Monitoring**: Immediate alerts on chain breaks
3. **Documentation**: Clear procedures for handling breaks

**Alternatives Considered**:
1. **External Blockchain**: Overkill, expensive, unnecessary
2. **Digital Signatures**: More complex, requires key management
3. **Database Triggers**: Can be bypassed by DB admin
4. **Write-Once Storage**: Expensive, inflexible

**Compliance**:
- ✅ Cryptographic proof of integrity
- ✅ Detects unauthorized modifications
- ✅ Suitable for legal proceedings
- ✅ Industry best practice for audit logs

---

## ADR-006: Request Number Generation Strategy

**Status**: Accepted

**Context**:
Each vacation request needs a unique, human-readable identifier for:
- User communication ("Your request VAC-2025-0042 was approved")
- Support tickets
- Audit references
- Legal documentation

**Decision**:
Use **format: `VAC-{YEAR}-{SEQUENCE}`**

Examples:
- `VAC-2025-0001`
- `VAC-2025-0042`
- `VAC-2026-0001` (resets each year)

**Generation Logic**:
```javascript
async function generateRequestNumber() {
  const year = new Date().getFullYear();
  const prefix = `VAC-${year}-`;

  // Find highest sequence number for this year
  const lastRequest = await VacationRequest
    .findOne({
      requestNumber: { $regex: `^${prefix}` }
    })
    .sort({ requestNumber: -1 })
    .limit(1);

  let sequence = 1;
  if (lastRequest) {
    const lastSequence = parseInt(lastRequest.requestNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  // Pad to 4 digits
  const paddedSequence = sequence.toString().padStart(4, '0');

  return `${prefix}${paddedSequence}`;
}
```

**Concurrency Handling**:
Use MongoDB atomic increment:
```javascript
const RequestCounter = new Schema({
  year: { type: Number, unique: true },
  sequence: { type: Number, default: 0 }
});

async function generateRequestNumber() {
  const year = new Date().getFullYear();

  const counter = await RequestCounter.findOneAndUpdate(
    { year: year },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true }
  );

  const paddedSequence = counter.sequence.toString().padStart(4, '0');
  return `VAC-${year}-${paddedSequence}`;
}
```

**Rationale**:

1. **Human-Readable**: Easy to communicate verbally or in writing
2. **Sortable**: Chronological sorting works naturally
3. **Unique**: Year + sequence guarantees uniqueness
4. **Predictable Length**: Always 13 characters
5. **Yearly Reset**: Clean separation by year for reporting
6. **Scalable**: 9999 requests per year sufficient (upgradable to 5+ digits)

**Format Breakdown**:
```
VAC   - 2025  - 0042
│       │       └─ Sequence (4 digits, zero-padded)
│       └───────── Year (4 digits)
└───────────────── Prefix (constant)
```

**Index**:
```javascript
{ requestNumber: 1 } // Unique index
```

**Display Examples**:
- Email: "Your vacation request VAC-2025-0042 has been approved"
- UI: "Request #VAC-2025-0042"
- Audit: "Approved request VAC-2025-0042"

**Consequences**:

**Positive**:
- Easy to reference in conversations
- Works well in support systems
- Natural sorting and filtering
- Future-proof (10,000 requests/year capacity)
- No external service needed

**Negative**:
- Reveals approximate request volume (minimal concern)
- Requires counter table/document (simple implementation)

**Alternatives Considered**:

1. **UUID**: Not human-friendly
   ```
   VAC-550e8400-e29b-41d4-a716-446655440000
   ```

2. **No prefix, just numbers**: Ambiguous
   ```
   Request 42 (which year? which module?)
   ```

3. **Month-based sequence**: Too granular
   ```
   VAC-2025-11-042
   ```

4. **Company prefix**: Unnecessary complexity
   ```
   COMPANY1-VAC-2025-0042
   ```

**Error Handling**:
```javascript
// Retry on duplicate (race condition)
async function createRequestWithNumber(requestData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const requestNumber = await generateRequestNumber();
      requestData.requestNumber = requestNumber;
      return await VacationRequest.create(requestData);
    } catch (error) {
      if (error.code === 11000 && i < maxRetries - 1) {
        // Duplicate key, retry
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to generate unique request number');
}
```

---

## ADR-007: State Machine Design

**Status**: Accepted

**Context**:
Vacation requests go through multiple states from creation to completion. The system must enforce valid transitions and prevent invalid states.

**Decision**:
Implement **explicit state machine** with defined transitions and guards.

**States**:
```javascript
const VACATION_STATES = {
  DRAFT: 'draft',              // Being created (not submitted)
  REQUESTED: 'requested',      // Submitted, awaiting approval
  APPROVED: 'approved',        // Approved by manager
  SCHEDULED: 'scheduled',      // Dates confirmed
  ENJOYING: 'enjoying',        // Currently on vacation
  ENJOYED: 'enjoyed',          // Completed (terminal)
  REJECTED: 'rejected',        // Denied (terminal)
  CANCELLED: 'cancelled'       // Cancelled by employee (terminal)
};
```

**State Diagram**:
```
                    ┌──────────┐
                    │  DRAFT   │
                    └────┬─────┘
                         │ submit
                         ↓
                    ┌──────────┐
             ┌──────┤REQUESTED │
             │      └────┬─────┘
             │           │ approve
        reject│          ↓
             │      ┌──────────┐
             │      │APPROVED  │
             │      └────┬─────┘
             │           │ schedule
             │           ↓
             │      ┌──────────┐
             │      │SCHEDULED │
             │      └────┬─────┘
             │           │ start
             │           ↓
             │      ┌──────────┐
             │      │ENJOYING  │
             │      └────┬─────┘
             │           │ complete
             │           ↓
             ↓      ┌──────────┐
        ┌────────┐  │ ENJOYED  │ (terminal)
        │REJECTED│  └──────────┘
        └────────┘
         (terminal)

    cancel from any non-terminal state → CANCELLED (terminal)
```

**Transitions**:
```javascript
const STATE_TRANSITIONS = {
  draft: ['requested', 'cancelled'],
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['enjoying', 'cancelled'],
  enjoying: ['enjoyed'],

  // Terminal states (no transitions out)
  enjoyed: [],
  rejected: [],
  cancelled: []
};
```

**Guard Conditions**:
```javascript
function canTransition(request, newState, actor) {
  const currentState = request.status;

  // Check if transition is allowed
  if (!STATE_TRANSITIONS[currentState]?.includes(newState)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentState} to ${newState}`
    };
  }

  // Additional guards by transition
  switch (newState) {
    case 'approved':
      // Must have HR/admin role
      if (!['talento_humano', 'admin'].includes(actor.role)) {
        return {
          allowed: false,
          reason: 'Only HR can approve requests'
        };
      }
      // Must have sufficient balance
      const balance = getBalance(request.employeeId);
      if (balance.availableDays < request.requestedDays) {
        return {
          allowed: false,
          reason: 'Insufficient vacation balance'
        };
      }
      break;

    case 'cancelled':
      // Employee can cancel own requests before they start
      if (actor._id.equals(request.employeeId)) {
        if (['enjoying', 'enjoyed'].includes(currentState)) {
          return {
            allowed: false,
            reason: 'Cannot cancel vacation in progress or completed'
          };
        }
      }
      // HR can cancel anytime before enjoyed
      else if (!['talento_humano', 'admin'].includes(actor.role)) {
        return {
          allowed: false,
          reason: 'Only employee or HR can cancel'
        };
      }
      break;

    case 'enjoyed':
      // Must have actual end date
      if (!request.actualEndDate) {
        return {
          allowed: false,
          reason: 'Actual end date required'
        };
      }
      break;
  }

  return { allowed: true };
}
```

**State Transition Handler**:
```javascript
async function transitionState(request, newState, actor, data = {}) {
  // Validate transition
  const validation = canTransition(request, newState, actor);
  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const oldState = request.status;

  // Update state
  request.status = newState;

  // State-specific actions
  switch (newState) {
    case 'requested':
      request.requestedBy = actor._id;
      request.requestedAt = new Date();
      // Reserve days in balance
      await updateBalance(request.employeeId, {
        $inc: { requestedDays: request.requestedDays }
      });
      break;

    case 'approved':
      request.approvedBy = actor._id;
      request.approvedAt = new Date();
      // Move to approved
      await updateBalance(request.employeeId, {
        $inc: {
          approvedDays: request.requestedDays
        }
      });
      break;

    case 'rejected':
      request.rejectedBy = actor._id;
      request.rejectedAt = new Date();
      request.rejectionReason = data.reason;
      // Release days back to available
      await updateBalance(request.employeeId, {
        $inc: { requestedDays: -request.requestedDays }
      });
      break;

    case 'scheduled':
      request.scheduledBy = actor._id;
      request.scheduledAt = new Date();
      request.scheduledStartDate = data.startDate || request.requestedStartDate;
      request.scheduledEndDate = data.endDate || request.requestedEndDate;
      await updateBalance(request.employeeId, {
        $inc: { scheduledDays: request.requestedDays }
      });
      break;

    case 'enjoying':
      request.actualStartDate = data.actualStartDate || request.scheduledStartDate;
      break;

    case 'enjoyed':
      request.actualEndDate = data.actualEndDate || request.scheduledEndDate;
      request.actualDaysEnjoyed = calculateWorkingDays(
        request.actualStartDate,
        request.actualEndDate
      );
      // DEDUCT FROM BALANCE
      await updateBalance(request.employeeId, {
        $inc: {
          accruedDays: -request.actualDaysEnjoyed,
          enjoyedDays: request.actualDaysEnjoyed,
          requestedDays: -request.requestedDays,
          approvedDays: -request.approvedDays,
          scheduledDays: -request.scheduledDays
        }
      });
      break;

    case 'cancelled':
      // Release all reserved days
      const decrements = {};
      if (request.requestedDays > 0) decrements.requestedDays = -request.requestedDays;
      if (request.approvedDays > 0) decrements.approvedDays = -request.approvedDays;
      if (request.scheduledDays > 0) decrements.scheduledDays = -request.scheduledDays;

      await updateBalance(request.employeeId, { $inc: decrements });
      break;
  }

  // Increment version
  request.version += 1;
  await request.save();

  // Create audit log
  await createAuditLog({
    action: `REQUEST_${newState.toUpperCase()}`,
    actorId: actor._id,
    actorRole: actor.role,
    entityType: 'VacationRequest',
    entityId: request._id,
    employeeId: request.employeeId,
    companyId: request.companyId,
    requestId: request._id,
    requestNumber: request.requestNumber,
    changes: {
      before: { status: oldState },
      after: { status: newState }
    },
    reason: data.reason || `Transitioned to ${newState}`
  });

  // Send notification
  await sendVacationNotification(newState, request, actor);

  return request;
}
```

**Rationale**:

1. **Explicit States**: Clear understanding of request lifecycle
2. **Type Safety**: Prevents invalid states
3. **Business Logic Encapsulation**: All transition logic in one place
4. **Audit Trail**: Every transition is logged
5. **Rollback Safety**: Can reverse certain transitions (approved → cancelled)

**Consequences**:

**Positive**:
- Clear, predictable behavior
- Easy to test (each transition is isolated)
- Self-documenting code
- Prevents invalid states
- Easy to add new states/transitions

**Negative**:
- More complex than simple status field
- Requires careful design of transitions
- Cannot have arbitrary state changes

**Alternatives Considered**:
1. **Simple status field**: No enforcement, error-prone
2. **Workflow engine**: Overkill for this use case
3. **Event sourcing**: Too complex, not needed

---

## Summary of Key Decisions

| ADR | Decision | Impact |
|-----|----------|--------|
| 001 | Use 365 days for accrual | More accurate, legally compliant |
| 002 | Track working days, not calendar | Handles weekends/holidays correctly |
| 003 | Adjust for suspensions | Fair accrual during leaves |
| 004 | No PII in audit logs | Enhanced privacy, GDPR compliance |
| 005 | Blockchain-like checksums | Tamper-proof audit trail |
| 006 | VAC-YYYY-NNNN format | Human-readable identifiers |
| 007 | Explicit state machine | Predictable, testable workflow |

These decisions form the foundation of a robust, compliant, and maintainable vacation management system.
