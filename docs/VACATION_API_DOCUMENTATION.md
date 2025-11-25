# Vacation Module API Documentation

## Overview

Complete REST API for managing employee vacation balances, requests, approvals, and audit trail based on Colombian Labor Law.

## Base URL

```
/api/vacations
```

## Authentication

All endpoints require:
- **Authentication**: Bearer token in `Authorization` header
- **Tenant Verification**: `X-Company-Id` header with company ID

## Models

### VacationBalance

```javascript
{
  employeeId: ObjectId,
  hireDate: Date,
  accruedDays: Number,      // Días causados
  enjoyedDays: Number,      // Días disfrutados
  approvedPendingDays: Number, // Aprobados pendientes
  availableDays: Number,    // Saldo disponible (calculado automáticamente)
  lastAccrualDate: Date,
  companyId: ObjectId
}
```

### VacationRequest

```javascript
{
  employeeId: ObjectId,
  requestedDays: Number,
  requestDate: Date,
  startDate: Date,
  endDate: Date,
  status: String, // 'requested', 'approved', 'scheduled', 'enjoyed', 'rejected'
  approverId: ObjectId,
  approvalDate: Date,
  rejectionReason: String,
  enjoyedDate: Date,
  companyId: ObjectId
}
```

### VacationAuditLog

```javascript
{
  employeeId: ObjectId,
  action: String, // 'request', 'approve', 'reject', 'schedule', 'enjoy', 'accrue'
  requestId: ObjectId,
  performedBy: ObjectId,
  previousState: Object,
  newState: Object,
  quantity: Number,
  description: String,
  timestamp: Date,
  companyId: ObjectId
}
```

## Endpoints

### 1. Create Vacation Request

**POST** `/api/vacations/requests`

Create a new vacation request.

**Request Body:**
```json
{
  "requestedDays": 5,
  "startDate": "2025-12-01T00:00:00.000Z",
  "endDate": "2025-12-05T23:59:59.999Z"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Solicitud de vacaciones creada exitosamente",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "employeeId": "507f1f77bcf86cd799439012",
    "requestedDays": 5,
    "startDate": "2025-12-01T00:00:00.000Z",
    "endDate": "2025-12-05T23:59:59.999Z",
    "status": "requested",
    "companyId": "507f1f77bcf86cd799439013"
  }
}
```

**Validations:**
- Available balance must be sufficient
- Start date must be at least 15 days in the future
- End date must be after start date
- No overlapping active requests

---

### 2. Get Vacation Requests

**GET** `/api/vacations/requests`

Get vacation requests with optional filters.

**Query Parameters:**
- `employeeId` (optional): Filter by employee
- `status` (optional): Filter by status
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date
- `limit` (optional, default: 50): Number of results
- `skip` (optional, default: 0): Results to skip

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "employeeId": {
          "_id": "507f1f77bcf86cd799439012",
          "name": "Juan Pérez",
          "email": "juan@example.com"
        },
        "requestedDays": 5,
        "status": "requested",
        "startDate": "2025-12-01T00:00:00.000Z",
        "endDate": "2025-12-05T23:59:59.999Z"
      }
    ],
    "total": 10,
    "limit": 50,
    "skip": 0,
    "hasMore": false
  }
}
```

**Permissions:**
- Regular employees see only their own requests
- Admin/Talento Humano see all company requests

---

### 3. Get Vacation Request Details

**GET** `/api/vacations/requests/:id`

Get details of a specific vacation request.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "employeeId": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "requestedDays": 5,
    "status": "approved",
    "approverId": {
      "_id": "507f1f77bcf86cd799439014",
      "name": "María García",
      "email": "maria@example.com"
    },
    "approvalDate": "2025-11-15T10:30:00.000Z"
  }
}
```

---

### 4. Approve Vacation Request

**PUT** `/api/vacations/requests/:id/approve`

Approve a vacation request.

**Permissions:** Admin, Talento Humano only

**Success Response (200):**
```json
{
  "success": true,
  "message": "Solicitud aprobada exitosamente",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "approved",
    "approverId": "507f1f77bcf86cd799439014",
    "approvalDate": "2025-11-20T15:45:00.000Z"
  }
}
```

**Business Rules:**
- Only 'requested' status can be approved
- Balance is moved to approvedPendingDays
- Creates audit log entry

---

### 5. Reject Vacation Request

**PUT** `/api/vacations/requests/:id/reject`

Reject a vacation request.

**Permissions:** Admin, Talento Humano only

**Request Body:**
```json
{
  "rejectionReason": "Conflicto con proyecto crítico"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Solicitud rechazada",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "rejected",
    "rejectionReason": "Conflicto con proyecto crítico"
  }
}
```

---

### 6. Schedule Vacation

**PUT** `/api/vacations/requests/:id/schedule`

Schedule vacation dates (can modify dates after approval).

**Permissions:** Admin, Talento Humano only

**Request Body:**
```json
{
  "startDate": "2025-12-15T00:00:00.000Z",
  "endDate": "2025-12-19T23:59:59.999Z"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Vacaciones programadas exitosamente",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "scheduled",
    "startDate": "2025-12-15T00:00:00.000Z",
    "endDate": "2025-12-19T23:59:59.999Z"
  }
}
```

---

### 7. Mark Vacation as Enjoyed

**POST** `/api/vacations/enjoy/:id`

Register vacation as enjoyed and deduct from balance.

**Permissions:** Admin, Talento Humano only

**Success Response (200):**
```json
{
  "success": true,
  "message": "Vacaciones registradas como disfrutadas y descontadas del saldo",
  "data": {
    "request": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "enjoyed",
      "enjoyedDate": "2025-12-15T00:00:00.000Z"
    },
    "balance": {
      "accruedDays": 15,
      "enjoyedDays": 5,
      "approvedPendingDays": 0,
      "availableDays": 10
    }
  }
}
```

**Business Rules:**
- Status must be 'scheduled'
- Current date must be >= startDate
- Automatically updates balance:
  - Adds to enjoyedDays
  - Subtracts from approvedPendingDays
  - Recalculates availableDays

---

### 8. Get Employee Balance

**GET** `/api/vacations/balance/:employeeId`

Get vacation balance for an employee.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "balance": {
      "employeeId": "507f1f77bcf86cd799439012",
      "hireDate": "2020-01-15T00:00:00.000Z",
      "accruedDays": 30.5,
      "enjoyedDays": 15,
      "approvedPendingDays": 5,
      "availableDays": 10.5,
      "lastAccrualDate": "2025-11-20T00:00:00.000Z"
    },
    "pendingRequests": [
      {
        "_id": "507f1f77bcf86cd799439015",
        "requestedDays": 5,
        "status": "approved"
      }
    ],
    "summary": {
      "accruedDays": 30.5,
      "enjoyedDays": 15,
      "approvedPendingDays": 5,
      "availableDays": 10.5,
      "pendingRequestsCount": 1
    }
  }
}
```

**Permissions:**
- Employees can see only their own balance
- Admin/Talento Humano can see any employee balance

---

### 9. Run Daily Accrual

**POST** `/api/vacations/accrue`

Execute daily accrual job to update all employee balances.

**Permissions:** Admin, Talento Humano only

**Success Response (200):**
```json
{
  "success": true,
  "message": "Causación diaria ejecutada exitosamente",
  "data": {
    "success": true,
    "totalProcessed": 50,
    "totalUpdated": 45,
    "updates": [
      {
        "employeeId": "507f1f77bcf86cd799439012",
        "previousAccrued": 30.45,
        "newAccrued": 30.5,
        "increase": 0.05
      }
    ]
  }
}
```

**Notes:**
- Should be run as a scheduled job (cron)
- Updates accruedDays based on hire date
- Creates audit log for each update

---

### 10. Get Audit Trail

**GET** `/api/vacations/audit`

Get audit trail with filters.

**Permissions:** Admin, Talento Humano only

**Query Parameters:**
- `employeeId` (optional): Filter by employee
- `action` (optional): Filter by action type
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date
- `limit` (optional, default: 100): Number of results

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "_id": "507f1f77bcf86cd799439020",
        "employeeId": {
          "_id": "507f1f77bcf86cd799439012",
          "name": "Juan Pérez",
          "email": "juan@example.com"
        },
        "action": "approve",
        "requestId": "507f1f77bcf86cd799439011",
        "performedBy": {
          "_id": "507f1f77bcf86cd799439014",
          "name": "María García",
          "email": "maria@example.com"
        },
        "quantity": 5,
        "description": "Solicitud aprobada",
        "timestamp": "2025-11-20T15:45:00.000Z",
        "previousState": { "status": "requested" },
        "newState": { "status": "approved" }
      }
    ],
    "total": 150,
    "filters": {
      "employeeId": "507f1f77bcf86cd799439012"
    }
  }
}
```

---

### 11. Initialize Employee Balance

**POST** `/api/vacations/initialize/:employeeId`

Initialize vacation balance for a new employee.

**Permissions:** Admin, Talento Humano only

**Request Body:**
```json
{
  "hireDate": "2020-01-15T00:00:00.000Z"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Balance de vacaciones inicializado exitosamente",
  "data": {
    "employeeId": "507f1f77bcf86cd799439012",
    "hireDate": "2020-01-15T00:00:00.000Z",
    "accruedDays": 82.5,
    "enjoyedDays": 0,
    "approvedPendingDays": 0,
    "availableDays": 82.5
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Saldo insuficiente. Faltan 2.5 días"
}
```

### 401 Unauthorized
```json
{
  "error": "Token no proporcionado"
}
```

### 403 Forbidden
```json
{
  "error": "No tienes permisos para esta acción en esta empresa"
}
```

### 404 Not Found
```json
{
  "error": "Solicitud no encontrada"
}
```

### 500 Internal Server Error
```json
{
  "error": "Error interno del servidor",
  "details": "Stack trace in development mode"
}
```

## Business Rules

### Colombian Labor Law Compliance

1. **Accrual Rate**: 15 business days per year of service
2. **Daily Accrual**: 0.041 days per day worked (15/365)
3. **Minimum Notice**: 15 days in advance
4. **Minimum Request**: 0.5 days (medio día)

### Vacation States

1. **requested**: Initial state when employee creates request
2. **approved**: Admin approved, balance moved to approvedPendingDays
3. **scheduled**: Dates confirmed for enjoyment
4. **enjoyed**: Vacation taken, deducted from balance
5. **rejected**: Request denied with reason

### Balance Calculation

```
availableDays = accruedDays - enjoyedDays - approvedPendingDays
```

- **accruedDays**: Total days earned based on hire date
- **enjoyedDays**: Days already taken
- **approvedPendingDays**: Approved but not yet taken
- **availableDays**: Calculated automatically on each save

## Usage Examples

### Example 1: Employee Requests Vacation

```bash
# 1. Employee creates request
POST /api/vacations/requests
Headers:
  Authorization: Bearer <employee_token>
  X-Company-Id: 507f1f77bcf86cd799439013
Body:
{
  "requestedDays": 5,
  "startDate": "2025-12-01",
  "endDate": "2025-12-05"
}

# 2. Check balance
GET /api/vacations/balance/507f1f77bcf86cd799439012
Headers:
  Authorization: Bearer <employee_token>
  X-Company-Id: 507f1f77bcf86cd799439013
```

### Example 2: Admin Approves and Schedules

```bash
# 1. Approve request
PUT /api/vacations/requests/507f1f77bcf86cd799439011/approve
Headers:
  Authorization: Bearer <admin_token>
  X-Company-Id: 507f1f77bcf86cd799439013

# 2. Schedule vacation
PUT /api/vacations/requests/507f1f77bcf86cd799439011/schedule
Headers:
  Authorization: Bearer <admin_token>
  X-Company-Id: 507f1f77bcf86cd799439013
Body:
{
  "startDate": "2025-12-15",
  "endDate": "2025-12-19"
}

# 3. Mark as enjoyed (after vacation period)
POST /api/vacations/enjoy/507f1f77bcf86cd799439011
Headers:
  Authorization: Bearer <admin_token>
  X-Company-Id: 507f1f77bcf86cd799439013
```

### Example 3: Daily Accrual Job (Cron)

```bash
# Run daily at 00:00
POST /api/vacations/accrue
Headers:
  Authorization: Bearer <admin_token>
  X-Company-Id: 507f1f77bcf86cd799439013
```

## Testing Checklist

- [ ] Create vacation request with sufficient balance
- [ ] Create vacation request with insufficient balance (should fail)
- [ ] Approve vacation request
- [ ] Reject vacation request with reason
- [ ] Schedule approved vacation
- [ ] Mark scheduled vacation as enjoyed
- [ ] Check balance updates correctly
- [ ] Verify audit logs are created
- [ ] Test permissions (employee vs admin)
- [ ] Test overlapping requests (should fail)
- [ ] Test minimum notice validation (15 days)
- [ ] Run daily accrual and verify calculations

## Integration Notes

1. **Employee Profile**: Add `hireDate` field to User model or create Employee profile
2. **Cron Jobs**: Set up daily accrual job using node-cron or similar
3. **Notifications**: Integrate email/SMS notifications for approvals
4. **Calendar Integration**: Export vacation schedules to calendar
5. **Reports**: Generate vacation usage reports for HR

## Future Enhancements

- Vacation carry-over rules
- Vacation payment calculations
- Integration with payroll
- Automatic vacation reminders
- Bulk approval workflows
- Mobile app integration
