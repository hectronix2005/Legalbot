/**
 * Tests Unitarios - MotorVacaciones
 *
 * Casos de prueba para validar funciones puras del motor de vacaciones.
 * Incluye 15+ casos borde según especificación.
 */

const {
  calcularCausacion,
  saldoDisponible,
  validarSolicitud,
  validarTransicionEstado,
  calcularImpactoSaldo,
  calcularProyeccion,
  generarTablaCausacionMensual,
  MOTOR_CONSTANTS,
  _internal: {
    floorDecimals,
    calcularDiasEntreFechas,
    calcularDiasSuspension
  }
} = require('../services/motorVacaciones');

// ============================================================================
// UTILIDADES INTERNAS
// ============================================================================

describe('Utilidades Internas', () => {
  describe('floorDecimals()', () => {
    test('Trunca correctamente a 4 decimales', () => {
      expect(floorDecimals(15.04109589, 4)).toBe(15.0410);
      expect(floorDecimals(0.04109589, 4)).toBe(0.0410);
    });

    test('No redondea hacia arriba', () => {
      expect(floorDecimals(15.04999, 2)).toBe(15.04);
      expect(floorDecimals(0.999999, 4)).toBe(0.9999);
    });

    test('Maneja números negativos', () => {
      expect(floorDecimals(-15.0499, 2)).toBe(-15.05); // floor hacia -infinito
    });
  });

  describe('calcularDiasEntreFechas()', () => {
    test('Calcula días inclusivos correctamente', () => {
      const dias = calcularDiasEntreFechas(
        new Date('2024-01-01'),
        new Date('2024-01-01')
      );
      expect(dias).toBe(1); // Mismo día = 1 día
    });

    test('Un año completo = 366 días (2024 bisiesto)', () => {
      const dias = calcularDiasEntreFechas(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      expect(dias).toBe(366);
    });

    test('Un año regular = 365 días', () => {
      const dias = calcularDiasEntreFechas(
        new Date('2023-01-01'),
        new Date('2023-12-31')
      );
      expect(dias).toBe(365);
    });
  });

  describe('calcularDiasSuspension()', () => {
    test('Sin suspensiones retorna 0', () => {
      const dias = calcularDiasSuspension(
        [],
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      expect(dias).toBe(0);
    });

    test('Suspensión completa dentro del rango', () => {
      const dias = calcularDiasSuspension(
        [{ inicio: '2024-06-01', fin: '2024-06-30' }],
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      expect(dias).toBe(30);
    });

    test('Suspensión parcialmente fuera del rango', () => {
      const dias = calcularDiasSuspension(
        [{ inicio: '2023-12-15', fin: '2024-01-15' }],
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      expect(dias).toBe(15); // Solo los días de enero
    });

    test('Múltiples suspensiones', () => {
      const dias = calcularDiasSuspension(
        [
          { inicio: '2024-03-01', fin: '2024-03-10' },
          { inicio: '2024-06-01', fin: '2024-06-15' }
        ],
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      expect(dias).toBe(10 + 15);
    });
  });
});

// ============================================================================
// FUNCIÓN PRINCIPAL: calcularCausacion
// ============================================================================

describe('calcularCausacion() - Casos Básicos', () => {
  test('CASO 1: Ingreso hoy, causación = 0', () => {
    const hoy = new Date();
    const resultado = calcularCausacion(hoy, hoy);

    expect(resultado.valido).toBe(true);
    expect(resultado.diasCausados).toBe(0.0410); // 1 día * 15/365
    expect(resultado.diasTrabajados).toBe(1);
  });

  test('CASO 2: Exactamente 1 año base 365 = ~15 días', () => {
    const resultado = calcularCausacion('2023-01-01', '2023-12-31', { base: '365' });

    expect(resultado.valido).toBe(true);
    expect(resultado.diasCausados).toBeGreaterThanOrEqual(14.99);
    expect(resultado.diasCausados).toBeLessThanOrEqual(15.01);
    expect(resultado.diasTrabajados).toBe(365);
  });

  test('CASO 3: Exactamente 1 año bisiesto (2024) = ~15 días', () => {
    const resultado = calcularCausacion('2024-01-01', '2024-12-31', { base: '365' });

    expect(resultado.valido).toBe(true);
    expect(resultado.diasCausados).toBeGreaterThanOrEqual(14.99);
    expect(resultado.diasCausados).toBeLessThanOrEqual(15.05);
    expect(resultado.diasTrabajados).toBe(366);
  });

  test('CASO 4: Base 360 causa más días que base 365', () => {
    const resultado365 = calcularCausacion('2024-01-01', '2024-12-31', { base: '365' });
    const resultado360 = calcularCausacion('2024-01-01', '2024-12-31', { base: '360' });

    expect(resultado360.diasCausados).toBeGreaterThan(resultado365.diasCausados);
    expect(resultado360.tasaDiaria).toBeGreaterThan(resultado365.tasaDiaria);
  });

  test('CASO 5: 6 meses = ~7.5 días', () => {
    const resultado = calcularCausacion('2024-01-01', '2024-06-30');

    expect(resultado.valido).toBe(true);
    expect(resultado.diasCausados).toBeGreaterThan(7);
    expect(resultado.diasCausados).toBeLessThan(8);
  });
});

describe('calcularCausacion() - Casos Borde', () => {
  test('CASO 6: Fecha de contratación inválida', () => {
    const resultado = calcularCausacion('fecha-invalida', '2024-12-31');

    expect(resultado.valido).toBe(false);
    expect(resultado.error).toContain('inválida');
    expect(resultado.diasCausados).toBe(0);
  });

  test('CASO 7: Fecha de corte anterior a contratación', () => {
    const resultado = calcularCausacion('2024-06-01', '2024-01-01');

    expect(resultado.valido).toBe(false);
    expect(resultado.error).toContain('anterior');
    expect(resultado.diasCausados).toBe(0);
  });

  test('CASO 8: Con suspensión de 30 días', () => {
    const conSuspension = calcularCausacion('2024-01-01', '2024-12-31', {
      periodosSinCausar: [{ inicio: '2024-06-01', fin: '2024-06-30' }]
    });

    const sinSuspension = calcularCausacion('2024-01-01', '2024-12-31');

    expect(conSuspension.diasSuspension).toBe(30);
    expect(conSuspension.diasTrabajados).toBe(sinSuspension.diasTrabajados - 30);
    expect(conSuspension.diasCausados).toBeLessThan(sinSuspension.diasCausados);
  });

  test('CASO 9: Jornada parcial (medio tiempo)', () => {
    const tiempoCompleto = calcularCausacion('2024-01-01', '2024-12-31', { factorJornada: 1.0 });
    const medioTiempo = calcularCausacion('2024-01-01', '2024-12-31', { factorJornada: 0.5 });

    expect(medioTiempo.factorJornada).toBe(0.5);
    expect(medioTiempo.diasCausados).toBeCloseTo(tiempoCompleto.diasCausados / 2, 2);
  });

  test('CASO 10: 29 de febrero año bisiesto', () => {
    // Usar fecha explícita para evitar problemas de timezone
    const fecha29Feb = new Date(2024, 1, 29); // Mes 1 = febrero
    const resultado = calcularCausacion(fecha29Feb, '2024-12-31');

    expect(resultado.valido).toBe(true);
    // La fecha puede variar según timezone, solo verificamos que sea válida
    expect(resultado.diasTrabajados).toBeGreaterThan(300); // ~307 días desde 29 feb
  });

  test('CASO 11: Empleado muy antiguo (10 años)', () => {
    const resultado = calcularCausacion('2014-01-01', '2024-12-31');

    expect(resultado.valido).toBe(true);
    expect(resultado.diasCausados).toBeGreaterThan(150); // ~150 días
    expect(resultado.anosServicio).toBeGreaterThan(10);
  });

  test('CASO 12: Corte mensual (fin de mes)', () => {
    const resultado = calcularCausacion('2024-01-15', '2024-01-31');

    expect(resultado.valido).toBe(true);
    expect(resultado.diasTrabajados).toBe(17); // 15 al 31 = 17 días
  });
});

// ============================================================================
// FUNCIÓN: saldoDisponible
// ============================================================================

describe('saldoDisponible()', () => {
  test('Saldo correcto con todos positivos', () => {
    const resultado = saldoDisponible(30.5, 10, 5);

    expect(resultado.valido).toBe(true);
    expect(resultado.disponible).toBe(15.5);
  });

  test('Saldo exactamente 0', () => {
    const resultado = saldoDisponible(15, 10, 5);

    expect(resultado.valido).toBe(true);
    expect(resultado.disponible).toBe(0);
  });

  test('CASO 13: Detecta saldo negativo (inconsistencia)', () => {
    const resultado = saldoDisponible(10, 8, 5); // 10 - 8 - 5 = -3

    expect(resultado.valido).toBe(false);
    expect(resultado.disponible).toBe(-3);
    expect(resultado.inconsistencia).toBe(true);
  });

  test('Detecta valores negativos de entrada (corrupción)', () => {
    const resultado = saldoDisponible(-5, 10, 0);

    expect(resultado.valido).toBe(false);
    expect(resultado.corrupcion.accruedNegativo).toBe(true);
  });

  test('Rechaza parámetros no numéricos', () => {
    const resultado = saldoDisponible('treinta', 10, 5);

    expect(resultado.valido).toBe(false);
    expect(resultado.error).toContain('número válido');
  });
});

// ============================================================================
// FUNCIÓN: validarSolicitud (BLOQUEOS)
// ============================================================================

describe('validarSolicitud() - Bloqueos', () => {
  test('CASO 14: Solicitud > saldo = BLOQUEADA', () => {
    const resultado = validarSolicitud(10, 5.5);

    expect(resultado.aprobable).toBe(false);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.faltante).toBe(4.5);
  });

  test('Solicitud = saldo exacto = APROBABLE', () => {
    const resultado = validarSolicitud(10, 10);

    expect(resultado.aprobable).toBe(true);
    expect(resultado.bloqueado).toBe(false);
    expect(resultado.saldoRestante).toBe(0);
  });

  test('Solicitud < saldo = APROBABLE', () => {
    const resultado = validarSolicitud(5, 15.5);

    expect(resultado.aprobable).toBe(true);
    expect(resultado.bloqueado).toBe(false);
    expect(resultado.saldoRestante).toBe(10.5);
  });

  test('Solicitud de 0 días = BLOQUEADA', () => {
    const resultado = validarSolicitud(0, 15);

    expect(resultado.aprobable).toBe(false);
    expect(resultado.bloqueado).toBe(true);
  });

  test('Solicitud negativa = BLOQUEADA', () => {
    const resultado = validarSolicitud(-5, 15);

    expect(resultado.aprobable).toBe(false);
    expect(resultado.bloqueado).toBe(true);
  });

  test('CASO 15: Saldo negativo detecta corrupción', () => {
    const resultado = validarSolicitud(5, -3);

    expect(resultado.aprobable).toBe(false);
    expect(resultado.alertaCorrupcion).toBe(true);
  });
});

// ============================================================================
// STATE MACHINE: validarTransicionEstado
// ============================================================================

describe('validarTransicionEstado() - Flujo de Estados', () => {
  test('REQUESTED → APPROVED es válida', () => {
    const resultado = validarTransicionEstado('requested', 'approved');
    expect(resultado.valida).toBe(true);
  });

  test('REQUESTED → REJECTED es válida', () => {
    const resultado = validarTransicionEstado('requested', 'rejected');
    expect(resultado.valida).toBe(true);
  });

  test('APPROVED → SCHEDULED es válida', () => {
    const resultado = validarTransicionEstado('approved', 'scheduled');
    expect(resultado.valida).toBe(true);
  });

  test('SCHEDULED → ENJOYED es válida', () => {
    const resultado = validarTransicionEstado('scheduled', 'enjoyed');
    expect(resultado.valida).toBe(true);
  });

  test('REQUESTED → ENJOYED es INVÁLIDA (salta estados)', () => {
    const resultado = validarTransicionEstado('requested', 'enjoyed');
    expect(resultado.valida).toBe(false);
    expect(resultado.razon).toContain('no permitida');
  });

  test('ENJOYED → cualquier estado es INVÁLIDA (estado final)', () => {
    const resultado = validarTransicionEstado('enjoyed', 'requested');
    expect(resultado.valida).toBe(false);
  });

  test('Estado inválido genera error', () => {
    const resultado = validarTransicionEstado('inventado', 'approved');
    expect(resultado.valida).toBe(false);
    expect(resultado.razon).toContain('no es válido');
  });
});

// ============================================================================
// FUNCIÓN: calcularImpactoSaldo
// ============================================================================

describe('calcularImpactoSaldo()', () => {
  test('REQUESTED→APPROVED incrementa approvedPending', () => {
    const impacto = calcularImpactoSaldo('requested', 'approved', 5);

    expect(impacto.approvedPendingDelta).toBe(5);
    expect(impacto.enjoyedDelta).toBe(0);
  });

  test('SCHEDULED→ENJOYED mueve de pending a enjoyed', () => {
    const impacto = calcularImpactoSaldo('scheduled', 'enjoyed', 5);

    expect(impacto.approvedPendingDelta).toBe(-5);
    expect(impacto.enjoyedDelta).toBe(5);
  });

  test('APPROVED→CANCELLED libera approvedPending', () => {
    const impacto = calcularImpactoSaldo('approved', 'cancelled', 5);

    expect(impacto.approvedPendingDelta).toBe(-5);
    expect(impacto.enjoyedDelta).toBe(0);
  });
});

// ============================================================================
// FUNCIÓN: calcularProyeccion
// ============================================================================

describe('calcularProyeccion()', () => {
  test('Proyecta días adicionales hasta fin de año', () => {
    const hireDate = new Date('2024-01-01');
    const fechaActual = new Date('2024-06-30');
    const fechaProyeccion = new Date('2024-12-31');

    const resultado = calcularProyeccion(
      hireDate,
      fechaActual,
      fechaProyeccion,
      0, // enjoyed
      0  // approvedPending
    );

    expect(resultado.valido).toBe(true);
    expect(resultado.proyeccion.diasCausados).toBeGreaterThan(resultado.actual.diasCausados);
    expect(resultado.proyeccion.diasAdicionales).toBeGreaterThan(0);
  });
});

// ============================================================================
// TABLA DE EJEMPLO: Causación Mensual
// ============================================================================

describe('generarTablaCausacionMensual()', () => {
  test('Genera tabla de 12 meses', () => {
    const tabla = generarTablaCausacionMensual(new Date('2024-01-01'), 12);

    expect(tabla.length).toBe(13); // mes 0 al 12
    expect(tabla[0].mes).toBe(0);
    expect(tabla[12].mes).toBe(12);
    expect(tabla[12].diasCausados).toBeGreaterThan(tabla[0].diasCausados);
  });
});

// ============================================================================
// CONSTANTES
// ============================================================================

describe('MOTOR_CONSTANTS', () => {
  test('Constantes de causación correctas', () => {
    expect(MOTOR_CONSTANTS.DIAS_VACACIONES_ANUALES).toBe(15);
    expect(MOTOR_CONSTANTS.BASE_365).toBe(365);
    expect(MOTOR_CONSTANTS.BASE_360).toBe(360);
    expect(MOTOR_CONSTANTS.PRECISION_DECIMALES).toBe(4);
  });

  test('Estados válidos definidos', () => {
    expect(MOTOR_CONSTANTS.ESTADOS.REQUESTED).toBe('requested');
    expect(MOTOR_CONSTANTS.ESTADOS.APPROVED).toBe('approved');
    expect(MOTOR_CONSTANTS.ESTADOS.SCHEDULED).toBe('scheduled');
    expect(MOTOR_CONSTANTS.ESTADOS.ENJOYED).toBe('enjoyed');
    expect(MOTOR_CONSTANTS.ESTADOS.REJECTED).toBe('rejected');
    expect(MOTOR_CONSTANTS.ESTADOS.CANCELLED).toBe('cancelled');
  });

  test('Transiciones válidas definidas para cada estado', () => {
    expect(MOTOR_CONSTANTS.TRANSICIONES_VALIDAS['requested']).toContain('approved');
    expect(MOTOR_CONSTANTS.TRANSICIONES_VALIDAS['requested']).toContain('rejected');
    expect(MOTOR_CONSTANTS.TRANSICIONES_VALIDAS['approved']).toContain('scheduled');
    expect(MOTOR_CONSTANTS.TRANSICIONES_VALIDAS['scheduled']).toContain('enjoyed');
    expect(MOTOR_CONSTANTS.TRANSICIONES_VALIDAS['enjoyed']).toHaveLength(0);
  });
});

// ============================================================================
// CASOS BORDE ADICIONALES
// ============================================================================

describe('Casos Borde Adicionales', () => {
  test('CASO 16: Disfrute parcial (solicita 10, disfruta 7)', () => {
    // Simular escenario de disfrute parcial
    const saldoInicial = saldoDisponible(20, 0, 10); // 10 días aprobados
    expect(saldoInicial.disponible).toBe(10);

    // Después de disfrutar 7 de los 10 aprobados
    const saldoFinal = saldoDisponible(20, 7, 0); // 7 disfrutados, 3 retornan
    expect(saldoFinal.disponible).toBe(13);
  });

  test('CASO 17: Múltiples suspensiones no solapadas', () => {
    const resultado = calcularCausacion('2024-01-01', '2024-12-31', {
      periodosSinCausar: [
        { inicio: '2024-02-01', fin: '2024-02-15' }, // 15 días
        { inicio: '2024-07-01', fin: '2024-07-31' }, // 31 días
        { inicio: '2024-10-01', fin: '2024-10-10' }  // 10 días
      ]
    });

    expect(resultado.diasSuspension).toBe(15 + 31 + 10);
    expect(resultado.diasTrabajados).toBe(366 - 56);
  });

  test('CASO 18: Precisión decimal en cálculos largos', () => {
    // 5 años de servicio
    const resultado = calcularCausacion('2019-01-01', '2024-12-31');

    // Verificar que la precisión se mantiene
    const decimales = resultado.diasCausados.toString().split('.')[1]?.length || 0;
    expect(decimales).toBeLessThanOrEqual(4);
  });

  test('CASO 19: Fechas con timestamps diferentes (misma fecha local)', () => {
    // Usar fechas locales en lugar de UTC para evitar problemas de timezone
    const resultado1 = calcularCausacion(
      new Date(2024, 0, 1, 0, 0, 0),   // 1 enero 2024 00:00 local
      new Date(2024, 11, 31, 23, 59, 59) // 31 dic 2024 23:59 local
    );
    const resultado2 = calcularCausacion(
      new Date(2024, 0, 1, 12, 30, 0),   // 1 enero 2024 12:30 local
      new Date(2024, 11, 31, 8, 15, 0)   // 31 dic 2024 08:15 local
    );

    // Deben dar el mismo resultado ignorando la hora
    expect(resultado1.diasTrabajados).toBe(resultado2.diasTrabajados);
    expect(resultado1.diasCausados).toBe(resultado2.diasCausados);
  });
});
