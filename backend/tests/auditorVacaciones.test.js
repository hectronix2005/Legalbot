/**
 * Tests para AuditorVacaciones
 * Validación de detección de inconsistencias y generación de reportes
 */

const {
  AuditorVacaciones,
  SEVERIDAD,
  TIPO_ALERTA,
  CONFIG_AUDITOR,
  validarSaldoVacaciones,
  detectarSuperposicion
} = require('../services/auditorVacaciones');

// ============================================================================
// TESTS DE SEVERIDAD Y TIPOS
// ============================================================================

describe('Constantes del Auditor', () => {
  test('SEVERIDAD tiene todos los niveles requeridos', () => {
    expect(SEVERIDAD.CRITICA).toBe('CRITICA');
    expect(SEVERIDAD.ALTA).toBe('ALTA');
    expect(SEVERIDAD.MEDIA).toBe('MEDIA');
    expect(SEVERIDAD.BAJA).toBe('BAJA');
  });

  test('TIPO_ALERTA tiene todos los tipos requeridos', () => {
    expect(TIPO_ALERTA.SALDO_NEGATIVO).toBeDefined();
    expect(TIPO_ALERTA.REQUESTED_EXCEDE_SALDO).toBeDefined();
    expect(TIPO_ALERTA.APPROVED_EXCEDE_SALDO).toBeDefined();
    expect(TIPO_ALERTA.ENJOYED_EXCEDE_ACCRUED).toBeDefined();
    expect(TIPO_ALERTA.FECHA_FIN_ANTERIOR_INICIO).toBeDefined();
    expect(TIPO_ALERTA.PERIODOS_SUPERPUESTOS).toBeDefined();
    expect(TIPO_ALERTA.DATOS_SUSPENSION_FALTANTES).toBeDefined();
    expect(TIPO_ALERTA.DATOS_CONTRATO_FALTANTES).toBeDefined();
    expect(TIPO_ALERTA.PRECISION_REDONDEO).toBeDefined();
    expect(TIPO_ALERTA.CAUSACION_INCONSISTENTE).toBeDefined();
  });

  test('CONFIG_AUDITOR tiene valores por defecto sensatos', () => {
    expect(CONFIG_AUDITOR.TOLERANCIA_REDONDEO).toBeLessThan(0.01);
    expect(CONFIG_AUDITOR.MAX_ALERTAS_POR_EMPLEADO).toBeGreaterThan(0);
    expect(CONFIG_AUDITOR.INTERVALO_EJECUCION_MS).toBeGreaterThan(0);
    expect(CONFIG_AUDITOR.DIRECTORIO_REPORTES).toBe('auditoria');
  });
});

// ============================================================================
// TESTS DE validarSaldoVacaciones
// ============================================================================

describe('validarSaldoVacaciones()', () => {
  test('Saldo válido sin alertas', () => {
    const resultado = validarSaldoVacaciones({
      accrued: 15,
      enjoyed: 5,
      approvedPend: 3,
      requestedPend: 2
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.saldoDisponible).toBe(7); // 15 - 5 - 3
    expect(resultado.alertas).toHaveLength(0);
  });

  test('CRÍTICA: requestedPend excede saldo', () => {
    const resultado = validarSaldoVacaciones({
      accrued: 10,
      enjoyed: 5,
      approvedPend: 3,
      requestedPend: 5 // disponible es 2, solicitado es 5
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.alertas.some(a => a.tipo === TIPO_ALERTA.REQUESTED_EXCEDE_SALDO)).toBe(true);
    expect(resultado.alertas.some(a => a.severidad === SEVERIDAD.CRITICA)).toBe(true);
  });

  test('CRÍTICA: enjoyed excede accrued', () => {
    const resultado = validarSaldoVacaciones({
      accrued: 10,
      enjoyed: 15, // Más de lo causado
      approvedPend: 0,
      requestedPend: 0
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.alertas.some(a => a.tipo === TIPO_ALERTA.ENJOYED_EXCEDE_ACCRUED)).toBe(true);
  });

  test('CRÍTICA: saldo negativo (corrupción)', () => {
    const resultado = validarSaldoVacaciones({
      accrued: -5, // Valor inválido
      enjoyed: 0,
      approvedPend: 0,
      requestedPend: 0
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.alertas.some(a => a.tipo === TIPO_ALERTA.SALDO_NEGATIVO)).toBe(true);
  });

  test('Saldo exactamente 0 es válido', () => {
    const resultado = validarSaldoVacaciones({
      accrued: 10,
      enjoyed: 5,
      approvedPend: 5,
      requestedPend: 0
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.saldoDisponible).toBe(0);
  });

  test('Sin requestedPend no genera alerta de excedente', () => {
    const resultado = validarSaldoVacaciones({
      accrued: 10,
      enjoyed: 5,
      approvedPend: 3
      // requestedPend no definido
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.alertas).toHaveLength(0);
  });
});

// ============================================================================
// TESTS DE detectarSuperposicion
// ============================================================================

describe('detectarSuperposicion()', () => {
  test('Sin superposición retorna array vacío', () => {
    const periodos = [
      { id: '1', inicio: '2024-01-01', fin: '2024-01-10' },
      { id: '2', inicio: '2024-01-15', fin: '2024-01-20' },
      { id: '3', inicio: '2024-02-01', fin: '2024-02-10' }
    ];

    const resultado = detectarSuperposicion(periodos);
    expect(resultado).toHaveLength(0);
  });

  test('Detecta superposición parcial', () => {
    const periodos = [
      { id: '1', inicio: '2024-01-01', fin: '2024-01-15' },
      { id: '2', inicio: '2024-01-10', fin: '2024-01-20' } // Se superpone del 10 al 15
    ];

    const resultado = detectarSuperposicion(periodos);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].periodo1.id).toBe('1');
    expect(resultado[0].periodo2.id).toBe('2');
  });

  test('Detecta superposición completa (uno dentro de otro)', () => {
    const periodos = [
      { id: '1', inicio: '2024-01-01', fin: '2024-01-31' },
      { id: '2', inicio: '2024-01-10', fin: '2024-01-15' } // Completamente dentro
    ];

    const resultado = detectarSuperposicion(periodos);
    expect(resultado).toHaveLength(1);
  });

  test('Detecta múltiples superposiciones', () => {
    const periodos = [
      { id: '1', inicio: '2024-01-01', fin: '2024-01-15' },
      { id: '2', inicio: '2024-01-10', fin: '2024-01-20' },
      { id: '3', inicio: '2024-01-18', fin: '2024-01-25' }
    ];

    const resultado = detectarSuperposicion(periodos);
    expect(resultado).toHaveLength(2); // 1-2 y 2-3
  });

  test('Periodos adyacentes no son superposición', () => {
    const periodos = [
      { id: '1', inicio: '2024-01-01', fin: '2024-01-10' },
      { id: '2', inicio: '2024-01-11', fin: '2024-01-20' }
    ];

    const resultado = detectarSuperposicion(periodos);
    expect(resultado).toHaveLength(0);
  });

  test('Mismo día inicio/fin es superposición', () => {
    const periodos = [
      { id: '1', inicio: '2024-01-01', fin: '2024-01-10' },
      { id: '2', inicio: '2024-01-10', fin: '2024-01-20' } // Coinciden en el día 10
    ];

    const resultado = detectarSuperposicion(periodos);
    expect(resultado).toHaveLength(1);
  });

  test('Maneja campos con nombres alternativos (fechaInicio/fechaFin)', () => {
    const periodos = [
      { id: '1', fechaInicio: '2024-01-01', fechaFin: '2024-01-15' },
      { id: '2', fechaInicio: '2024-01-10', fechaFin: '2024-01-20' }
    ];

    const resultado = detectarSuperposicion(periodos);
    expect(resultado).toHaveLength(1);
  });
});

// ============================================================================
// TESTS DE LA CLASE AuditorVacaciones
// ============================================================================

describe('AuditorVacaciones - Clase', () => {
  let auditor;

  beforeEach(() => {
    auditor = new AuditorVacaciones(null, {
      INTERVALO_EJECUCION_MS: 1000,
      DIRECTORIO_REPORTES: 'auditoria-test'
    });
  });

  afterEach(() => {
    auditor.detener();
  });

  describe('Constructor y configuración', () => {
    test('Inicializa con configuración por defecto', () => {
      const auditorDefault = new AuditorVacaciones(null);
      expect(auditorDefault.config.TOLERANCIA_REDONDEO).toBe(CONFIG_AUDITOR.TOLERANCIA_REDONDEO);
    });

    test('Acepta configuración personalizada', () => {
      expect(auditor.config.INTERVALO_EJECUCION_MS).toBe(1000);
      expect(auditor.config.DIRECTORIO_REPORTES).toBe('auditoria-test');
    });

    test('Estado inicial es inactivo', () => {
      const estado = auditor.obtenerEstado();
      expect(estado.activo).toBe(false);
      expect(estado.ejecucionEnProgreso).toBe(false);
    });
  });

  describe('crearAlerta()', () => {
    test('Crea alerta con estructura correcta', () => {
      const alerta = auditor.crearAlerta({
        tipo: TIPO_ALERTA.SALDO_NEGATIVO,
        severidad: SEVERIDAD.CRITICA,
        empleadoId: 'EMP001',
        mensaje: 'Test mensaje',
        datos: { test: true },
        accionSugerida: 'Test acción'
      });

      expect(alerta.id).toMatch(/^ALT-/);
      expect(alerta.timestamp).toBeDefined();
      expect(alerta.tipo).toBe(TIPO_ALERTA.SALDO_NEGATIVO);
      expect(alerta.severidad).toBe(SEVERIDAD.CRITICA);
      expect(alerta.empleadoId).toBe('EMP001');
      expect(alerta.mensaje).toBe('Test mensaje');
      expect(alerta.accionSugerida).toBe('Test acción');
    });

    test('Actualiza estadísticas al crear alerta', () => {
      auditor.crearAlerta({
        tipo: TIPO_ALERTA.SALDO_NEGATIVO,
        severidad: SEVERIDAD.CRITICA,
        empleadoId: 'EMP001',
        mensaje: 'Test',
        datos: {},
        accionSugerida: 'Test'
      });

      expect(auditor.estadisticas.alertasPorSeveridad.CRITICA).toBe(1);
      expect(auditor.estadisticas.alertasPorTipo[TIPO_ALERTA.SALDO_NEGATIVO]).toBe(1);
    });
  });

  describe('periodosSuperpuestos()', () => {
    test('Detecta superposición', () => {
      const s1 = { fechaInicio: '2024-01-01', fechaFin: '2024-01-15' };
      const s2 = { fechaInicio: '2024-01-10', fechaFin: '2024-01-20' };

      expect(auditor.periodosSuperpuestos(s1, s2)).toBe(true);
    });

    test('No detecta falsa superposición', () => {
      const s1 = { fechaInicio: '2024-01-01', fechaFin: '2024-01-10' };
      const s2 = { fechaInicio: '2024-01-15', fechaFin: '2024-01-20' };

      expect(auditor.periodosSuperpuestos(s1, s2)).toBe(false);
    });

    test('Retorna false si faltan fechas', () => {
      const s1 = { fechaInicio: '2024-01-01' }; // Falta fechaFin
      const s2 = { fechaInicio: '2024-01-10', fechaFin: '2024-01-20' };

      expect(auditor.periodosSuperpuestos(s1, s2)).toBe(false);
    });
  });

  describe('auditarSolicitudes()', () => {
    test('Detecta fecha fin anterior a inicio', () => {
      const solicitudes = [{
        _id: { toString: () => 'SOL001' },
        fechaInicio: '2024-01-20',
        fechaFin: '2024-01-10' // Fin antes de inicio
      }];

      const alertas = auditor.auditarSolicitudes('EMP001', solicitudes);

      expect(alertas).toHaveLength(1);
      expect(alertas[0].tipo).toBe(TIPO_ALERTA.FECHA_FIN_ANTERIOR_INICIO);
      expect(alertas[0].severidad).toBe(SEVERIDAD.ALTA);
    });

    test('Detecta periodos superpuestos', () => {
      const solicitudes = [
        { _id: { toString: () => 'SOL001' }, fechaInicio: '2024-01-01', fechaFin: '2024-01-15' },
        { _id: { toString: () => 'SOL002' }, fechaInicio: '2024-01-10', fechaFin: '2024-01-20' }
      ];

      const alertas = auditor.auditarSolicitudes('EMP001', solicitudes);

      expect(alertas.some(a => a.tipo === TIPO_ALERTA.PERIODOS_SUPERPUESTOS)).toBe(true);
    });

    test('Sin alertas para solicitudes válidas', () => {
      const solicitudes = [
        { _id: { toString: () => 'SOL001' }, fechaInicio: '2024-01-01', fechaFin: '2024-01-10' },
        { _id: { toString: () => 'SOL002' }, fechaInicio: '2024-02-01', fechaFin: '2024-02-10' }
      ];

      const alertas = auditor.auditarSolicitudes('EMP001', solicitudes);
      expect(alertas).toHaveLength(0);
    });
  });

  describe('obtenerAlertas() con filtros', () => {
    beforeEach(() => {
      // Crear alertas de prueba
      auditor.alertas = [
        { id: '1', severidad: SEVERIDAD.CRITICA, tipo: TIPO_ALERTA.SALDO_NEGATIVO, empleadoId: 'EMP001' },
        { id: '2', severidad: SEVERIDAD.ALTA, tipo: TIPO_ALERTA.FECHA_FIN_ANTERIOR_INICIO, empleadoId: 'EMP001' },
        { id: '3', severidad: SEVERIDAD.CRITICA, tipo: TIPO_ALERTA.ENJOYED_EXCEDE_ACCRUED, empleadoId: 'EMP002' },
        { id: '4', severidad: SEVERIDAD.BAJA, tipo: TIPO_ALERTA.PRECISION_REDONDEO, empleadoId: 'EMP003' }
      ];
    });

    test('Sin filtros retorna todas', () => {
      const resultado = auditor.obtenerAlertas();
      expect(resultado).toHaveLength(4);
    });

    test('Filtro por severidad', () => {
      const resultado = auditor.obtenerAlertas({ severidad: SEVERIDAD.CRITICA });
      expect(resultado).toHaveLength(2);
    });

    test('Filtro por tipo', () => {
      const resultado = auditor.obtenerAlertas({ tipo: TIPO_ALERTA.SALDO_NEGATIVO });
      expect(resultado).toHaveLength(1);
    });

    test('Filtro por empleadoId', () => {
      const resultado = auditor.obtenerAlertas({ empleadoId: 'EMP001' });
      expect(resultado).toHaveLength(2);
    });

    test('Múltiples filtros combinados', () => {
      const resultado = auditor.obtenerAlertas({
        severidad: SEVERIDAD.CRITICA,
        empleadoId: 'EMP001'
      });
      expect(resultado).toHaveLength(1);
      expect(resultado[0].id).toBe('1');
    });
  });

  describe('obtenerEstado()', () => {
    test('Retorna estado completo', () => {
      const estado = auditor.obtenerEstado();

      expect(estado).toHaveProperty('activo');
      expect(estado).toHaveProperty('ejecucionEnProgreso');
      expect(estado).toHaveProperty('ultimaEjecucion');
      expect(estado).toHaveProperty('config');
    });
  });

  describe('generarCuerpoIssue()', () => {
    test('Genera markdown válido', () => {
      const alerta = {
        id: 'ALT-123',
        timestamp: '2024-01-15T10:00:00Z',
        tipo: TIPO_ALERTA.SALDO_NEGATIVO,
        severidad: SEVERIDAD.CRITICA,
        empleadoId: 'EMP001',
        mensaje: 'Test mensaje',
        datos: { accrued: -5 },
        accionSugerida: 'Revisar datos'
      };

      const cuerpo = auditor.generarCuerpoIssue(alerta);

      expect(cuerpo).toContain('## Descripción');
      expect(cuerpo).toContain('Test mensaje');
      expect(cuerpo).toContain('## Datos');
      expect(cuerpo).toContain('"accrued": -5');
      expect(cuerpo).toContain('## Pasos para Reproducir');
      expect(cuerpo).toContain('EMP001');
      expect(cuerpo).toContain('## Acción Sugerida');
      expect(cuerpo).toContain('Revisar datos');
      expect(cuerpo).toContain('ALT-123');
    });
  });
});

// ============================================================================
// TESTS DE AUDITORÍA DE EMPLEADOS (SIN DB)
// ============================================================================

describe('AuditorVacaciones - auditarEmpleado()', () => {
  let auditor;

  beforeEach(() => {
    auditor = new AuditorVacaciones(null);
    // Mock para obtenerSolicitudesEmpleado
    auditor.obtenerSolicitudesEmpleado = jest.fn().mockResolvedValue([]);
  });

  test('Empleado con datos válidos no genera alertas críticas', async () => {
    const empleado = {
      empleadoId: 'EMP001',
      companyId: 'COMP001',
      fechaContratacion: new Date(2023, 0, 1),
      accrued: 15,
      approvedPend: 3,
      enjoyed: 5,
      requestedPend: 2,
      suspensiones: [],
      factorJornada: 1.0
    };

    const alertas = await auditor.auditarEmpleado(empleado);
    const criticas = alertas.filter(a => a.severidad === SEVERIDAD.CRITICA);

    expect(criticas).toHaveLength(0);
  });

  test('Detecta requestedPend > saldo disponible', async () => {
    const empleado = {
      empleadoId: 'EMP001',
      companyId: 'COMP001',
      fechaContratacion: new Date(2023, 0, 1),
      accrued: 10,
      approvedPend: 3,
      enjoyed: 5,
      requestedPend: 5, // Disponible = 10 - 5 - 3 = 2, pero solicita 5
      suspensiones: [],
      factorJornada: 1.0
    };

    const alertas = await auditor.auditarEmpleado(empleado);

    expect(alertas.some(a => a.tipo === TIPO_ALERTA.REQUESTED_EXCEDE_SALDO)).toBe(true);
  });

  test('Detecta enjoyed > accrued', async () => {
    const empleado = {
      empleadoId: 'EMP001',
      companyId: 'COMP001',
      fechaContratacion: new Date(2023, 0, 1),
      accrued: 10,
      approvedPend: 0,
      enjoyed: 15, // Más de lo causado
      requestedPend: 0,
      suspensiones: [],
      factorJornada: 1.0
    };

    const alertas = await auditor.auditarEmpleado(empleado);

    expect(alertas.some(a => a.tipo === TIPO_ALERTA.ENJOYED_EXCEDE_ACCRUED)).toBe(true);
    expect(alertas.some(a => a.severidad === SEVERIDAD.CRITICA)).toBe(true);
  });

  test('Detecta suspensión con datos faltantes', async () => {
    const empleado = {
      empleadoId: 'EMP001',
      companyId: 'COMP001',
      fechaContratacion: new Date(2023, 0, 1),
      accrued: 15,
      approvedPend: 0,
      enjoyed: 0,
      requestedPend: 0,
      suspensiones: [{ motivo: 'Licencia', inicio: '2024-01-01' }], // Falta fin
      factorJornada: 1.0
    };

    const alertas = await auditor.auditarEmpleado(empleado);

    expect(alertas.some(a => a.tipo === TIPO_ALERTA.DATOS_SUSPENSION_FALTANTES)).toBe(true);
    expect(auditor.todos.some(t => t.tipo === 'DATOS_SUSPENSION_INCOMPLETOS')).toBe(true);
  });

  test('Detecta fecha de contratación faltante', async () => {
    const empleado = {
      empleadoId: 'EMP001',
      companyId: 'COMP001',
      // Sin fechaContratacion
      accrued: 15,
      approvedPend: 0,
      enjoyed: 0,
      requestedPend: 0,
      suspensiones: [],
      factorJornada: 1.0
    };

    const alertas = await auditor.auditarEmpleado(empleado);

    expect(alertas.some(a => a.tipo === TIPO_ALERTA.DATOS_CONTRATO_FALTANTES)).toBe(true);
    expect(auditor.todos.some(t => t.tipo === 'FECHA_CONTRATACION_FALTANTE')).toBe(true);
  });

  test('Calcula saldoCalculado correctamente', async () => {
    const empleado = {
      empleadoId: 'EMP001',
      companyId: 'COMP001',
      fechaContratacion: new Date(2023, 0, 1),
      accrued: 20,
      approvedPend: 5,
      enjoyed: 8,
      requestedPend: 0,
      suspensiones: [],
      factorJornada: 1.0
    };

    await auditor.auditarEmpleado(empleado);

    expect(empleado.saldoCalculado).toBe(7); // 20 - 8 - 5
  });
});

// ============================================================================
// TESTS DE RENDIMIENTO
// ============================================================================

describe('Tests de Rendimiento', () => {
  test('Validar 1000 empleados < 100ms', () => {
    const inicio = Date.now();

    for (let i = 0; i < 1000; i++) {
      validarSaldoVacaciones({
        accrued: Math.random() * 30,
        enjoyed: Math.random() * 15,
        approvedPend: Math.random() * 10,
        requestedPend: Math.random() * 5
      });
    }

    const tiempo = Date.now() - inicio;
    expect(tiempo).toBeLessThan(100);
  });

  test('Detectar superposiciones en 100 periodos < 50ms', () => {
    const periodos = [];
    for (let i = 0; i < 100; i++) {
      const inicio = new Date(2024, 0, i * 3 + 1);
      const fin = new Date(2024, 0, i * 3 + 5); // Algunos se superponen
      periodos.push({ id: `P${i}`, inicio: inicio.toISOString(), fin: fin.toISOString() });
    }

    const inicioTiempo = Date.now();
    detectarSuperposicion(periodos);
    const tiempo = Date.now() - inicioTiempo;

    expect(tiempo).toBeLessThan(50);
  });

  test('Crear 1000 alertas < 50ms', () => {
    const auditor = new AuditorVacaciones(null);
    const inicio = Date.now();

    for (let i = 0; i < 1000; i++) {
      auditor.crearAlerta({
        tipo: TIPO_ALERTA.SALDO_NEGATIVO,
        severidad: SEVERIDAD.CRITICA,
        empleadoId: `EMP${i}`,
        mensaje: 'Test',
        datos: {},
        accionSugerida: 'Test'
      });
    }

    const tiempo = Date.now() - inicio;
    expect(tiempo).toBeLessThan(50);
  });
});

// ============================================================================
// TESTS DE INTEGRACIÓN (SIN DB REAL)
// ============================================================================

describe('Integración - Flujo Completo', () => {
  test('Auditoría completa sin DB retorna resultados vacíos pero estructurados', async () => {
    const auditor = new AuditorVacaciones(null);
    const resultado = await auditor.ejecutarAuditoria();

    expect(resultado).toHaveProperty('estadisticas');
    expect(resultado).toHaveProperty('alertas');
    expect(resultado).toHaveProperty('todos');
    expect(resultado.estadisticas.empleadosAuditados).toBe(0);
  });

  test('Estado después de ejecución se actualiza', async () => {
    const auditor = new AuditorVacaciones(null);
    await auditor.ejecutarAuditoria();

    const estado = auditor.obtenerEstado();
    expect(estado.ultimaEjecucion).not.toBeNull();
    expect(estado.ultimaEjecucion.tiempoEjecucion).toBeGreaterThan(0);
  });
});
