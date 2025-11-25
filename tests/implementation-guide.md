# Implementation Guide for Vacation Module

Quick reference for implementing the functions required by the test suite.

## 1. vacationService.js

```javascript
/**
 * Calculate accrued vacation days based on hire date
 * Colombian Labor Code: 15 days per year
 *
 * @param {Date} hireDate - Employee hire date
 * @param {Date} currentDate - Current date for calculation
 * @returns {number} Accrued vacation days (rounded to 2 decimals)
 */
function calculateAccruedVacationDays(hireDate, currentDate = new Date()) {
  // Validation
  if (!hireDate || !(hireDate instanceof Date) || isNaN(hireDate)) {
    throw new Error('Invalid hire date');
  }

  if (hireDate > new Date()) {
    throw new Error('Hire date cannot be in the future');
  }

  if (currentDate < hireDate) {
    throw new Error('Current date cannot be before hire date');
  }

  // Calculate days worked
  const oneDay = 24 * 60 * 60 * 1000;
  const daysWorked = Math.floor((currentDate - hireDate) / oneDay);

  // Colombian law: 15 vacation days per 365 days worked
  const accruedDays = (daysWorked * 15) / 365;

  // Round to 2 decimal places
  return Math.round(accruedDays * 100) / 100;
}

module.exports = {
  calculateAccruedVacationDays
};
```

## 2. vacationValidation.js

```javascript
/**
 * Validate vacation request against available balance
 *
 * @param {Object} params - Validation parameters
 * @param {number} params.accruedDays - Total accrued vacation days
 * @param {number} params.enjoyedDays - Days already enjoyed
 * @param {number} params.approvedPendingDays - Days approved but not yet enjoyed
 * @param {number} params.requestedDays - Days being requested
 * @returns {Object} Validation result
 */
function validateVacationRequest(params) {
  const { accruedDays, enjoyedDays, approvedPendingDays, requestedDays } = params;

  // Validation
  if (requestedDays <= 0) {
    throw new Error('Requested days must be greater than 0');
  }

  if (requestedDays < 0) {
    throw new Error('Requested days cannot be negative');
  }

  // Calculate available days
  const availableDays = accruedDays - enjoyedDays - (approvedPendingDays || 0);

  // Check for negative balance (data corruption)
  const warnings = [];
  if (availableDays < 0) {
    warnings.push('NEGATIVE_BALANCE_DETECTED: Employee has used more vacation days than accrued');
  }

  // Validate request
  const isValid = requestedDays <= availableDays;

  return {
    isValid,
    availableDays,
    message: isValid
      ? 'Request is valid'
      : `Request of ${requestedDays} days exceeds available balance of ${availableDays} days`,
    warning: warnings.length > 0 ? warnings.join('; ') : undefined
  };
}

module.exports = {
  validateVacationRequest
};
```

## 3. vacationAuditService.js

```javascript
/**
 * Sanitize audit log to remove PII (Personally Identifiable Information)
 *
 * @param {Object} logEntry - Raw log entry
 * @returns {Object} Sanitized log entry
 */
function sanitizeAuditLog(logEntry) {
  const { name, email, personalData, ...sanitized } = logEntry;

  return {
    ...sanitized,
    sanitized: true,
    timestamp: logEntry.timestamp || new Date()
  };
}

/**
 * Log vacation action with audit trail
 *
 * @param {Object} params - Action parameters
 * @returns {Object} Audit result
 */
async function logVacationAction(params) {
  const { employeeId, action, performAudit } = params;

  if (!performAudit) {
    return { logged: true };
  }

  // Fetch employee and vacation history
  const employee = await Employee.findOne({ employeeId });
  const requests = await VacationRequest.find({ employeeId });

  const accruedDays = calculateAccruedVacationDays(
    employee.hireDate,
    new Date()
  );

  const enjoyedDays = requests.reduce((sum, req) =>
    sum + (req.enjoyedDays || 0), 0
  );

  const approvedPendingDays = requests.reduce((sum, req) =>
    req.status === 'approved' ? sum + (req.approvedPendingDays || 0) : sum, 0
  );

  const availableDays = accruedDays - enjoyedDays - approvedPendingDays;

  const alerts = [];
  if (availableDays < 0) {
    alerts.push('NEGATIVE_BALANCE_DETECTED');
  }

  return {
    employeeId,
    action,
    accruedDays,
    enjoyedDays,
    approvedPendingDays,
    availableDays,
    totalRequests: requests.length,
    approvedCount: requests.filter(r => r.status === 'approved').length,
    alerts: alerts.length > 0 ? alerts : undefined,
    timestamp: new Date()
  };
}

module.exports = {
  sanitizeAuditLog,
  logVacationAction
};
```

## 4. VacationRequest Model (Mongoose)

```javascript
const mongoose = require('mongoose');

const vacationRequestSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  requestedDays: {
    type: Number,
    required: true,
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
  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'requested',
    index: true
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  reason: {
    type: String,
    maxlength: 500
  },
  approvedBy: {
    type: String
  },
  approvedAt: {
    type: Date
  },
  approvalNotes: {
    type: String
  },
  cancelReason: {
    type: String
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

// Indexes for performance
vacationRequestSchema.index({ employeeId: 1, status: 1 });
vacationRequestSchema.index({ createdAt: -1 });

// Middleware to sanitize input
vacationRequestSchema.pre('save', function(next) {
  if (this.reason) {
    // XSS protection
    this.reason = this.reason
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '');
  }
  next();
});

module.exports = mongoose.model('VacationRequest', vacationRequestSchema);
```

## 5. Employee Model (Mongoose)

```javascript
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String
  },
  email: {
    type: String
  },
  hireDate: {
    type: Date,
    required: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Employee', employeeSchema);
```

## 6. API Routes (Express)

```javascript
const express = require('express');
const router = express.Router();
const { calculateAccruedVacationDays } = require('../services/vacationService');
const { validateVacationRequest } = require('../services/vacationValidation');
const { logVacationAction } = require('../services/vacationAuditService');
const VacationRequest = require('../models/VacationRequest');
const Employee = require('../models/Employee');

// POST /api/vacations/requests - Create vacation request
router.post('/requests', async (req, res) => {
  try {
    const { employeeId, requestedDays, startDate, endDate, reason } = req.body;

    // Get employee and calculate balance
    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const accruedDays = calculateAccruedVacationDays(employee.hireDate);

    // Get existing requests
    const requests = await VacationRequest.find({ employeeId });
    const enjoyedDays = requests.reduce((sum, r) => sum + (r.enjoyedDays || 0), 0);
    const approvedPendingDays = requests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.approvedPendingDays || 0), 0);

    // Validate request
    const validation = validateVacationRequest({
      accruedDays,
      enjoyedDays,
      approvedPendingDays,
      requestedDays
    });

    if (!validation.isValid) {
      return res.status(400).json({ error: validation.message });
    }

    // Create request
    const vacationRequest = await VacationRequest.create({
      employeeId,
      requestedDays,
      startDate,
      endDate,
      reason,
      status: 'requested'
    });

    res.status(201).json({
      requestId: vacationRequest._id,
      status: vacationRequest.status,
      requestedDays: vacationRequest.requestedDays
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/vacations/requests/:id/approve - Approve request
router.put('/requests/:id/approve', async (req, res) => {
  try {
    const { approvedBy, approvalNotes } = req.body;

    const request = await VacationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();
    request.approvalNotes = approvalNotes;
    request.approvedPendingDays = request.requestedDays;

    await request.save();

    res.json({
      status: request.status,
      approvedAt: request.approvedAt
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vacations/requests/:id/enjoy - Mark days as enjoyed
router.post('/requests/:id/enjoy', async (req, res) => {
  try {
    const { daysEnjoyed } = req.body;

    const request = await VacationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({
        error: 'Request must be approved before enjoying vacation days'
      });
    }

    request.enjoyedDays = (request.enjoyedDays || 0) + daysEnjoyed;
    request.approvedPendingDays = Math.max(0,
      (request.approvedPendingDays || 0) - daysEnjoyed
    );

    await request.save();

    res.json({
      enjoyedDays: request.enjoyedDays,
      approvedPendingDays: request.approvedPendingDays
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vacations/balance/:employeeId - Get vacation balance
router.get('/balance/:employeeId', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      employeeId: req.params.employeeId
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const accruedDays = calculateAccruedVacationDays(employee.hireDate);

    const requests = await VacationRequest.find({
      employeeId: req.params.employeeId
    });

    const enjoyedDays = requests.reduce((sum, r) =>
      sum + (r.enjoyedDays || 0), 0
    );

    const approvedPendingDays = requests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.approvedPendingDays || 0), 0);

    const availableDays = accruedDays - enjoyedDays - approvedPendingDays;

    res.json({
      accruedDays,
      enjoyedDays,
      approvedPendingDays,
      availableDays
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/vacations/requests/:id/cancel - Cancel request
router.put('/requests/:id/cancel', async (req, res) => {
  try {
    const { cancelReason } = req.body;

    const request = await VacationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    request.status = 'cancelled';
    request.cancelReason = cancelReason;
    request.approvedPendingDays = 0;

    await request.save();

    res.json({
      status: request.status
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vacations/audit/:employeeId - Get audit trail
router.get('/audit/:employeeId', async (req, res) => {
  try {
    const requests = await VacationRequest.find({
      employeeId: req.params.employeeId
    }).select('-__v').lean();

    // Sanitize PII
    const sanitized = requests.map(r => ({
      employeeId: r.employeeId,
      action: 'REQUEST_VACATION',
      requestedDays: r.requestedDays,
      status: r.status,
      timestamp: r.createdAt
    }));

    res.json({ logs: sanitized });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

## Testing Commands

```bash
# Install dependencies
npm install --save-dev jest supertest mongodb-memory-server

# Run tests
npm test -- tests/vacation.test.js

# Run with coverage
npm test -- --coverage tests/vacation.test.js

# Run specific test
npm test -- --testNamePattern="Caso 1"
```

## Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:vacation": "jest tests/vacation.test.js"
  }
}
```
