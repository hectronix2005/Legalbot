# Vacation Module Test Suite

Comprehensive test suite for the vacation accrual and management system with 30+ test cases covering all edge scenarios.

## Test Coverage

### 1. Accrual Calculation Tests (12 cases)
- ✅ Zero days worked
- ✅ Exactly 1 year (15 days)
- ✅ 6 months (~7.5 days)
- ✅ Multi-year calculations
- ✅ Future hire date validation
- ✅ Invalid date ranges
- ✅ Leap year handling
- ✅ Decimal precision (2 places)
- ✅ Null/undefined validation
- ✅ 10 years exact (150 days)
- ✅ February 29 edge case
- ✅ Very old employees (30 years)

### 2. Validation Tests (8 cases)
- ✅ Valid request with sufficient balance
- ✅ Exceeds available balance
- ✅ Exact balance match
- ✅ Approved pending days consideration
- ✅ Zero days request error
- ✅ Negative days request error
- ✅ Negative balance detection
- ✅ Decimal day values

### 3. API Integration Tests (10 cases)
- ✅ POST create valid request
- ✅ POST reject insufficient balance
- ✅ PUT approve request
- ✅ POST enjoy vacation
- ✅ GET balance calculation
- ✅ State machine validation
- ✅ Audit log without PII
- ✅ Simultaneous requests
- ✅ Cancel approved request
- ✅ XSS sanitization

### 4. Audit Tests (3 cases)
- ✅ PII sanitization
- ✅ Balance cross-validation
- ✅ Negative balance alerts

### 5. Performance Tests (2 cases)
- ✅ 1000 employees < 1000ms
- ✅ Race condition handling

### 6. Additional Edge Cases (4 cases)
- ✅ Timestamp milliseconds
- ✅ Small float values
- ✅ Timezone handling
- ✅ Special characters sanitization

## Running Tests

```bash
# Run all vacation tests
npm test -- tests/vacation.test.js

# Run with coverage
npm test -- --coverage tests/vacation.test.js

# Run specific test suite
npm test -- --testNamePattern="Vacation Accrual"

# Watch mode
npm test -- --watch tests/vacation.test.js

# Silent mode (no console logs)
SILENT_TESTS=true npm test -- tests/vacation.test.js
```

## Coverage Requirements

Minimum 90% coverage across:
- Statements: 90%
- Branches: 90%
- Functions: 90%
- Lines: 90%

## Test Data

### Sample Employee
```javascript
{
  employeeId: 'EMP001',
  hireDate: new Date('2023-01-01'),
  companyId: 'COMPANY001',
  active: true
}
```

### Sample Vacation Request
```javascript
{
  employeeId: 'EMP001',
  requestedDays: 5,
  status: 'requested',
  startDate: new Date('2024-12-01'),
  endDate: new Date('2024-12-05')
}
```

## Dependencies

```json
{
  "jest": "^29.0.0",
  "supertest": "^6.3.0",
  "mongodb-memory-server": "^9.0.0"
}
```

## Implementation Guide

The tests expect these files to exist:

1. **Services**
   - `services/vacationService.js` - Core accrual logic
   - `services/vacationValidation.js` - Request validation
   - `services/vacationAuditService.js` - Audit logging

2. **Models**
   - `models/VacationRequest.js` - Mongoose schema
   - `models/Employee.js` - Employee schema

3. **Routes**
   - `routes/vacations.js` - API endpoints

## Test Execution Order

1. Unit tests (functions in isolation)
2. Integration tests (API with database)
3. Performance tests (load testing)
4. Edge case tests (boundary conditions)

## Debugging Failed Tests

```bash
# Run single test with verbose output
npm test -- --verbose --testNamePattern="Caso 1"

# Check test database
mongo mongodb://localhost:27017/legalbot_test

# Enable debug logs
DEBUG=* npm test
```

## Continuous Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Run Vacation Tests
  run: |
    npm test -- tests/vacation.test.js --coverage
    npm run test:coverage
```

## Known Edge Cases Covered

1. ⚠️ **Leap years**: February 29 handling
2. ⚠️ **Negative balances**: Data corruption detection
3. ⚠️ **Concurrent requests**: Race condition prevention
4. ⚠️ **Timezone issues**: UTC normalization
5. ⚠️ **Float precision**: Decimal rounding
6. ⚠️ **State transitions**: Invalid state changes
7. ⚠️ **PII leakage**: Audit log sanitization
8. ⚠️ **XSS attacks**: Input sanitization
9. ⚠️ **Very old employees**: 30+ years
10. ⚠️ **Same-day calculations**: Zero elapsed time

## Test Helpers

Available in all tests via `global.testHelpers`:

```javascript
// Create date offset
const futureDate = testHelpers.createDateOffset(30);

// Calculate days between dates
const days = testHelpers.daysBetween(date1, date2);

// Mock factories
const employee = testHelpers.createMockEmployee({ hireDate: new Date() });
const request = testHelpers.createMockVacationRequest({ requestedDays: 10 });
```

## Custom Matchers

```javascript
// Range validation
expect(7.5).toBeWithinRange(7.4, 7.6);

// Decimal precision
expect(7.48).toHaveDecimalPlaces(2);
```

## Next Steps

1. Implement `services/vacationService.js` with `calculateAccruedVacationDays()`
2. Implement `services/vacationValidation.js` with `validateVacationRequest()`
3. Implement `services/vacationAuditService.js` with `sanitizeAuditLog()`
4. Create Mongoose models for `VacationRequest` and `Employee`
5. Create API routes in `routes/vacations.js`
6. Run tests and achieve 90%+ coverage

## Support

For implementation questions, refer to:
- `/docs/vacation-module-spec.md` - Detailed specification
- `/docs/vacation-api.md` - API documentation
- `/docs/vacation-examples.md` - Usage examples
