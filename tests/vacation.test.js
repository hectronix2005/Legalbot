/**
 * Comprehensive Test Suite for Vacation Module
 * Coverage: Accrual calculation, validation, API integration, audit, edge cases
 * Requirements: Jest, Supertest, 90%+ code coverage
 */

const request = require('supertest');
const mongoose = require('mongoose');

// Mock implementations - replace with actual paths when implementing
const { calculateAccruedVacationDays } = require('../services/vacationService');
const { validateVacationRequest } = require('../services/vacationValidation');
const { logVacationAction, sanitizeAuditLog } = require('../services/vacationAuditService');
const VacationRequest = require('../models/VacationRequest');
const Employee = require('../models/Employee');
const app = require('../server');

// Test database setup
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/legalbot_test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  // Clear collections before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ============================================================================
// 1. TESTS FUNCIÓN CAUSACIÓN (calculateAccruedVacationDays)
// ============================================================================

describe('Vacation Accrual Calculation - calculateAccruedVacationDays()', () => {

  test('Caso 1: Empleado con 0 días trabajados retorna 0 accrued', () => {
    const hireDate = new Date('2024-11-20');
    const currentDate = new Date('2024-11-20');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    expect(result).toBe(0);
  });

  test('Caso 2: Empleado con exactamente 1 año retorna 15 días', () => {
    const hireDate = new Date('2023-11-20');
    const currentDate = new Date('2024-11-20');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    expect(result).toBe(15);
  });

  test('Caso 3: Empleado con 6 meses retorna ~7.5 días', () => {
    const hireDate = new Date('2024-05-20');
    const currentDate = new Date('2024-11-20');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    // 184 días aprox * (15/365) ≈ 7.56 días
    expect(result).toBeGreaterThanOrEqual(7.4);
    expect(result).toBeLessThanOrEqual(7.6);
    expect(Number.isFinite(result)).toBe(true);
  });

  test('Caso 4: Empleado con 5 años y 7 meses', () => {
    const hireDate = new Date('2019-04-20');
    const currentDate = new Date('2024-11-20');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    // Aproximadamente 2040 días * (15/365) ≈ 83.84 días
    expect(result).toBeGreaterThanOrEqual(83);
    expect(result).toBeLessThanOrEqual(85);
  });

  test('Caso 5: Fecha contratación futura lanza error', () => {
    const hireDate = new Date('2025-12-31');
    const currentDate = new Date('2024-11-20');

    expect(() => {
      calculateAccruedVacationDays(hireDate, currentDate);
    }).toThrow('Hire date cannot be in the future');
  });

  test('Caso 6: currentDate anterior a hireDate lanza error', () => {
    const hireDate = new Date('2024-11-20');
    const currentDate = new Date('2024-01-01');

    expect(() => {
      calculateAccruedVacationDays(hireDate, currentDate);
    }).toThrow('Current date cannot be before hire date');
  });

  test('Caso 7: Año bisiesto (366 días) - 2024', () => {
    const hireDate = new Date('2023-01-01');
    const currentDate = new Date('2024-01-01');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    // 366 días en año bisiesto
    expect(result).toBeCloseTo(15, 1);
  });

  test('Caso 8: Decimales redondean a 2 posiciones', () => {
    const hireDate = new Date('2024-01-15');
    const currentDate = new Date('2024-08-23');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    // Verificar que tiene máximo 2 decimales
    const decimalPlaces = (result.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  test('Caso 9: hireDate inválida lanza error', () => {
    expect(() => {
      calculateAccruedVacationDays(null, new Date());
    }).toThrow('Invalid hire date');

    expect(() => {
      calculateAccruedVacationDays(undefined, new Date());
    }).toThrow('Invalid hire date');

    expect(() => {
      calculateAccruedVacationDays('invalid-date', new Date());
    }).toThrow('Invalid hire date');
  });

  test('Caso 10: Empleado con 10 años exactos retorna 150 días', () => {
    const hireDate = new Date('2014-11-20');
    const currentDate = new Date('2024-11-20');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    expect(result).toBe(150);
  });

  test('Caso 11 BORDE: Contratación 29 de febrero año bisiesto', () => {
    const hireDate = new Date('2024-02-29');
    const currentDate = new Date('2025-02-28');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    // ~365 días = 15 días
    expect(result).toBeCloseTo(15, 1);
  });

  test('Caso 12 BORDE: Empleado muy antiguo (30 años)', () => {
    const hireDate = new Date('1994-11-20');
    const currentDate = new Date('2024-11-20');

    const result = calculateAccruedVacationDays(hireDate, currentDate);

    // 30 años * 15 días = 450 días
    expect(result).toBeCloseTo(450, 0);
  });
});

// ============================================================================
// 2. TESTS VALIDACIÓN SOLICITUDES (validateVacationRequest)
// ============================================================================

describe('Vacation Request Validation - validateVacationRequest()', () => {

  test('Solicitud válida con saldo suficiente', () => {
    const params = {
      accruedDays: 10,
      enjoyedDays: 0,
      approvedPendingDays: 0,
      requestedDays: 5
    };

    const result = validateVacationRequest(params);

    expect(result.isValid).toBe(true);
    expect(result.availableDays).toBe(10);
    expect(result.message).toContain('valid');
  });

  test('Solicitud rechazada: excede saldo disponible', () => {
    const params = {
      accruedDays: 5,
      enjoyedDays: 2,
      approvedPendingDays: 0,
      requestedDays: 5
    };

    const result = validateVacationRequest(params);

    expect(result.isValid).toBe(false);
    expect(result.availableDays).toBe(3); // 5 - 2 = 3
    expect(result.message).toContain('exceeds available balance');
  });

  test('Solicitud con saldo exacto', () => {
    const params = {
      accruedDays: 10,
      enjoyedDays: 5,
      approvedPendingDays: 0,
      requestedDays: 5
    };

    const result = validateVacationRequest(params);

    expect(result.isValid).toBe(true);
    expect(result.availableDays).toBe(5);
  });

  test('Solicitud con días aprobados pendientes', () => {
    const params = {
      accruedDays: 15,
      enjoyedDays: 0,
      approvedPendingDays: 10,
      requestedDays: 6
    };

    const result = validateVacationRequest(params);

    expect(result.isValid).toBe(false);
    expect(result.availableDays).toBe(5); // 15 - 0 - 10 = 5
    expect(result.message).toContain('exceeds available balance');
  });

  test('Solicitud de 0 días lanza error', () => {
    const params = {
      accruedDays: 10,
      enjoyedDays: 0,
      approvedPendingDays: 0,
      requestedDays: 0
    };

    expect(() => {
      validateVacationRequest(params);
    }).toThrow('Requested days must be greater than 0');
  });

  test('Solicitud negativa lanza error', () => {
    const params = {
      accruedDays: 10,
      enjoyedDays: 0,
      approvedPendingDays: 0,
      requestedDays: -5
    };

    expect(() => {
      validateVacationRequest(params);
    }).toThrow('Requested days cannot be negative');
  });

  test('Caso BORDE: Saldo negativo existente (data corruption)', () => {
    const params = {
      accruedDays: 5,
      enjoyedDays: 10, // Ya disfrutó más de lo causado!
      approvedPendingDays: 0,
      requestedDays: 1
    };

    const result = validateVacationRequest(params);

    expect(result.isValid).toBe(false);
    expect(result.availableDays).toBeLessThan(0);
    expect(result.warning).toContain('negative balance detected');
  });

  test('Caso BORDE: Valores decimales en días', () => {
    const params = {
      accruedDays: 10.5,
      enjoyedDays: 2.25,
      approvedPendingDays: 1.75,
      requestedDays: 6.5
    };

    const result = validateVacationRequest(params);

    expect(result.availableDays).toBe(6.5); // 10.5 - 2.25 - 1.75
    expect(result.isValid).toBe(true);
  });
});

// ============================================================================
// 3. TESTS INTEGRACIÓN API
// ============================================================================

describe('Vacation API Integration', () => {
  let authToken;
  let testEmployee;

  beforeEach(async () => {
    // Crear usuario de prueba con autenticación
    const testUser = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        role: 'admin'
      });

    authToken = testUser.body.token;

    // Crear empleado de prueba
    testEmployee = await Employee.create({
      employeeId: 'EMP001',
      name: 'Test Employee',
      hireDate: new Date('2023-01-01'),
      companyId: 'COMPANY001',
      active: true
    });
  });

  test('POST /api/vacations/requests crea solicitud válida', async () => {
    const response = await request(app)
      .post('/api/vacations/requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: testEmployee.employeeId,
        requestedDays: 5,
        startDate: '2024-12-01',
        endDate: '2024-12-05',
        reason: 'Personal vacation'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('requestId');
    expect(response.body.status).toBe('requested');
    expect(response.body.requestedDays).toBe(5);
  });

  test('POST /api/vacations/requests rechaza si excede saldo', async () => {
    // Crear historial de vacaciones disfrutadas
    await VacationRequest.create({
      employeeId: testEmployee.employeeId,
      requestedDays: 10,
      status: 'approved',
      enjoyedDays: 10
    });

    const response = await request(app)
      .post('/api/vacations/requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: testEmployee.employeeId,
        requestedDays: 10, // Solo tiene ~15 causados, ya gastó 10
        startDate: '2024-12-01',
        endDate: '2024-12-10'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('exceeds available balance');
  });

  test('PUT /api/vacations/requests/:id/approve actualiza estado', async () => {
    const request1 = await VacationRequest.create({
      employeeId: testEmployee.employeeId,
      requestedDays: 5,
      status: 'requested',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-05')
    });

    const response = await request(app)
      .put(`/api/vacations/requests/${request1._id}/approve`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        approvedBy: 'MANAGER001',
        approvalNotes: 'Approved'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');
    expect(response.body.approvedAt).toBeDefined();
  });

  test('POST /api/vacations/enjoy descuenta correctamente', async () => {
    const approvedRequest = await VacationRequest.create({
      employeeId: testEmployee.employeeId,
      requestedDays: 5,
      status: 'approved',
      approvedPendingDays: 5,
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-05')
    });

    const response = await request(app)
      .post(`/api/vacations/requests/${approvedRequest._id}/enjoy`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        daysEnjoyed: 5
      });

    expect(response.status).toBe(200);

    // Verificar actualización
    const updated = await VacationRequest.findById(approvedRequest._id);
    expect(updated.enjoyedDays).toBe(5);
    expect(updated.approvedPendingDays).toBe(0);
  });

  test('GET /api/vacations/balance retorna saldo correcto', async () => {
    const response = await request(app)
      .get(`/api/vacations/balance/${testEmployee.employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accruedDays');
    expect(response.body).toHaveProperty('enjoyedDays');
    expect(response.body).toHaveProperty('availableDays');
    expect(response.body).toHaveProperty('approvedPendingDays');

    // Empleado contratado en 2023-01-01, ~23 meses = ~28 días
    expect(response.body.accruedDays).toBeGreaterThan(20);
  });

  test('State machine: no permitir enjoy sin approve', async () => {
    const request1 = await VacationRequest.create({
      employeeId: testEmployee.employeeId,
      requestedDays: 5,
      status: 'requested', // No aprobado aún
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-05')
    });

    const response = await request(app)
      .post(`/api/vacations/requests/${request1._id}/enjoy`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        daysEnjoyed: 5
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('must be approved before enjoying');
  });

  test('Auditoría registra todas las acciones sin PII', async () => {
    const response = await request(app)
      .post('/api/vacations/requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: testEmployee.employeeId,
        requestedDays: 3,
        startDate: '2024-12-01',
        endDate: '2024-12-03'
      });

    expect(response.status).toBe(201);

    // Verificar log de auditoría
    const auditLogs = await request(app)
      .get(`/api/vacations/audit/${testEmployee.employeeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(auditLogs.status).toBe(200);
    expect(auditLogs.body.logs).toHaveLength(1);

    const log = auditLogs.body.logs[0];
    expect(log).toHaveProperty('employeeId');
    expect(log).toHaveProperty('action');
    expect(log).toHaveProperty('requestedDays');
    expect(log).not.toHaveProperty('name'); // No PII
    expect(log).not.toHaveProperty('email');
  });

  test('Caso BORDE: Solicitud simultánea de múltiples vacaciones', async () => {
    const requests = await Promise.all([
      request(app)
        .post('/api/vacations/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployee.employeeId,
          requestedDays: 5,
          startDate: '2024-12-01',
          endDate: '2024-12-05'
        }),
      request(app)
        .post('/api/vacations/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployee.employeeId,
          requestedDays: 5,
          startDate: '2024-12-10',
          endDate: '2024-12-14'
        })
    ]);

    // Al menos una debe ser exitosa
    const successCount = requests.filter(r => r.status === 201).length;
    expect(successCount).toBeGreaterThanOrEqual(1);
  });

  test('Caso BORDE: Cancelación de solicitud aprobada', async () => {
    const approvedRequest = await VacationRequest.create({
      employeeId: testEmployee.employeeId,
      requestedDays: 5,
      status: 'approved',
      approvedPendingDays: 5
    });

    const response = await request(app)
      .put(`/api/vacations/requests/${approvedRequest._id}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        cancelReason: 'Employee request'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('cancelled');

    // Verificar que se liberan los días
    const updated = await VacationRequest.findById(approvedRequest._id);
    expect(updated.approvedPendingDays).toBe(0);
  });
});

// ============================================================================
// 4. TESTS AUDITORÍA
// ============================================================================

describe('Vacation Audit Service', () => {

  test('Log no contiene datos personales (PII)', () => {
    const logEntry = {
      employeeId: 'EMP001',
      name: 'John Doe',
      email: 'john@example.com',
      action: 'REQUEST_VACATION',
      requestedDays: 5,
      timestamp: new Date()
    };

    const sanitized = sanitizeAuditLog(logEntry);

    expect(sanitized).toHaveProperty('employeeId');
    expect(sanitized).toHaveProperty('action');
    expect(sanitized).toHaveProperty('requestedDays');
    expect(sanitized).not.toHaveProperty('name');
    expect(sanitized).not.toHaveProperty('email');
  });

  test('Auditoría cruza accrued vs enjoyed correctamente', async () => {
    const employee = await Employee.create({
      employeeId: 'EMP002',
      hireDate: new Date('2023-01-01'),
      companyId: 'COMPANY001'
    });

    // Crear historial
    await VacationRequest.create({
      employeeId: 'EMP002',
      requestedDays: 10,
      enjoyedDays: 10,
      status: 'completed'
    });

    const auditResult = await logVacationAction({
      employeeId: 'EMP002',
      action: 'BALANCE_CHECK',
      performAudit: true
    });

    expect(auditResult).toHaveProperty('accruedDays');
    expect(auditResult).toHaveProperty('enjoyedDays');
    expect(auditResult).toHaveProperty('availableDays');
    expect(auditResult.availableDays).toBe(
      auditResult.accruedDays - auditResult.enjoyedDays - auditResult.approvedPendingDays
    );
  });

  test('Alerta si saldo negativo detectado', async () => {
    const employee = await Employee.create({
      employeeId: 'EMP003',
      hireDate: new Date('2024-01-01'), // Solo ~11 meses
      companyId: 'COMPANY001'
    });

    // Forzar saldo negativo (corrupción de datos)
    await VacationRequest.create({
      employeeId: 'EMP003',
      requestedDays: 20,
      enjoyedDays: 20,
      status: 'completed'
    });

    const auditResult = await logVacationAction({
      employeeId: 'EMP003',
      action: 'BALANCE_CHECK',
      performAudit: true
    });

    expect(auditResult.alerts).toBeDefined();
    expect(auditResult.alerts).toContain('NEGATIVE_BALANCE_DETECTED');
    expect(auditResult.availableDays).toBeLessThan(0);
  });

  test('Caso BORDE: Auditoría con múltiples solicitudes concurrentes', async () => {
    const employee = await Employee.create({
      employeeId: 'EMP004',
      hireDate: new Date('2020-01-01'),
      companyId: 'COMPANY001'
    });

    // Crear múltiples solicitudes
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(
        VacationRequest.create({
          employeeId: 'EMP004',
          requestedDays: 3,
          status: i % 2 === 0 ? 'approved' : 'requested'
        })
      );
    }
    await Promise.all(requests);

    const auditResult = await logVacationAction({
      employeeId: 'EMP004',
      action: 'AUDIT_FULL',
      performAudit: true
    });

    expect(auditResult.totalRequests).toBe(5);
    expect(auditResult.approvedCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// 5. TESTS DE RENDIMIENTO Y CONCURRENCIA
// ============================================================================

describe('Performance and Concurrency Tests', () => {

  test('Cálculo de causación para 1000 empleados < 1000ms', async () => {
    const employees = [];
    for (let i = 0; i < 1000; i++) {
      employees.push({
        hireDate: new Date(2020 + (i % 5), (i % 12), 1),
        currentDate: new Date('2024-11-20')
      });
    }

    const startTime = Date.now();

    employees.forEach(emp => {
      calculateAccruedVacationDays(emp.hireDate, emp.currentDate);
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000);
  });

  test('Race condition: Múltiples aprobaciones simultáneas', async () => {
    const employee = await Employee.create({
      employeeId: 'EMP005',
      hireDate: new Date('2020-01-01'),
      companyId: 'COMPANY001'
    });

    const request1 = await VacationRequest.create({
      employeeId: 'EMP005',
      requestedDays: 10,
      status: 'requested'
    });

    // Intentar aprobar simultáneamente desde dos gerentes
    const approvals = await Promise.allSettled([
      request(app)
        .put(`/api/vacations/requests/${request1._id}/approve`)
        .send({ approvedBy: 'MANAGER001' }),
      request(app)
        .put(`/api/vacations/requests/${request1._id}/approve`)
        .send({ approvedBy: 'MANAGER002' })
    ]);

    // Solo una aprobación debe ser exitosa
    const successCount = approvals.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
    expect(successCount).toBe(1);
  });
});

// ============================================================================
// 6. TESTS DE CASOS BORDE ADICIONALES
// ============================================================================

describe('Additional Edge Cases', () => {

  test('Empleado con fecha de contratación en timestamp (milliseconds)', () => {
    const hireTimestamp = new Date('2023-01-01').getTime();
    const currentDate = new Date('2024-01-01');

    const result = calculateAccruedVacationDays(new Date(hireTimestamp), currentDate);

    expect(result).toBe(15);
  });

  test('Validación con valores flotantes muy pequeños', () => {
    const params = {
      accruedDays: 0.01,
      enjoyedDays: 0.005,
      approvedPendingDays: 0.003,
      requestedDays: 0.002
    };

    const result = validateVacationRequest(params);

    expect(result.isValid).toBe(true);
    expect(result.availableDays).toBeCloseTo(0.002, 3);
  });

  test('Manejo de timezone en fechas', () => {
    const hireDateUTC = new Date(Date.UTC(2023, 0, 1));
    const currentDateUTC = new Date(Date.UTC(2024, 0, 1));

    const result = calculateAccruedVacationDays(hireDateUTC, currentDateUTC);

    expect(result).toBe(15);
  });

  test('Solicitud con caracteres especiales en reason', async () => {
    const employee = await Employee.create({
      employeeId: 'EMP006',
      hireDate: new Date('2020-01-01'),
      companyId: 'COMPANY001'
    });

    const response = await request(app)
      .post('/api/vacations/requests')
      .send({
        employeeId: 'EMP006',
        requestedDays: 3,
        startDate: '2024-12-01',
        endDate: '2024-12-03',
        reason: '<script>alert("XSS")</script> Vacaciones familiares'
      });

    expect(response.status).toBe(201);

    // Verificar sanitización
    const request1 = await VacationRequest.findById(response.body.requestId);
    expect(request1.reason).not.toContain('<script>');
  });
});
