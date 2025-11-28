/**
 * Tests para QAVacaciones
 * Validación del servicio de QA continuo
 */

const {
  QAVacaciones,
  SEVERIDAD_BUG,
  TIPO_TEST,
  CONFIG_QA
} = require('../services/qaVacaciones');

// ============================================================================
// TESTS DE CONSTANTES
// ============================================================================

describe('Constantes de QA', () => {
  test('SEVERIDAD_BUG tiene todos los niveles', () => {
    expect(SEVERIDAD_BUG.CRITICO).toBe('CRITICO');
    expect(SEVERIDAD_BUG.MAYOR).toBe('MAYOR');
    expect(SEVERIDAD_BUG.MENOR).toBe('MENOR');
    expect(SEVERIDAD_BUG.TRIVIAL).toBe('TRIVIAL');
  });

  test('TIPO_TEST tiene todos los tipos', () => {
    expect(TIPO_TEST.UNIT).toBe('unit');
    expect(TIPO_TEST.INTEGRATION).toBe('integration');
    expect(TIPO_TEST.E2E_SMOKE).toBe('e2e_smoke');
    expect(TIPO_TEST.BUSINESS_RULE).toBe('business_rule');
    expect(TIPO_TEST.EDGE_CASE).toBe('edge_case');
  });

  test('CONFIG_QA tiene valores sensatos', () => {
    expect(CONFIG_QA.COBERTURA_MINIMA).toBe(80);
    expect(CONFIG_QA.INTERVALO_EJECUCION_MS).toBeGreaterThan(0);
    expect(CONFIG_QA.DIRECTORIO_REPORTES).toBe('qa');
    expect(CONFIG_QA.UMBRAL_ERRORES_4XX).toBeGreaterThan(0);
    expect(CONFIG_QA.UMBRAL_ERRORES_5XX).toBeGreaterThan(0);
  });
});

// ============================================================================
// TESTS DE LA CLASE QAVacaciones
// ============================================================================

describe('QAVacaciones - Clase', () => {
  let qa;

  beforeEach(() => {
    qa = new QAVacaciones(null, {
      INTERVALO_EJECUCION_MS: 1000,
      DIRECTORIO_REPORTES: 'qa-test'
    });
  });

  afterEach(() => {
    qa.detener();
  });

  describe('Constructor y configuración', () => {
    test('Inicializa con configuración por defecto', () => {
      const qaDefault = new QAVacaciones(null);
      expect(qaDefault.config.COBERTURA_MINIMA).toBe(CONFIG_QA.COBERTURA_MINIMA);
    });

    test('Acepta configuración personalizada', () => {
      expect(qa.config.INTERVALO_EJECUCION_MS).toBe(1000);
      expect(qa.config.DIRECTORIO_REPORTES).toBe('qa-test');
    });

    test('Estado inicial es inactivo', () => {
      const estado = qa.obtenerEstado();
      expect(estado.activo).toBe(false);
      expect(estado.ejecucionEnProgreso).toBe(false);
    });
  });

  describe('crearBug()', () => {
    test('Crea bug con estructura correcta', () => {
      const bug = qa.crearBug({
        titulo: 'Test bug',
        descripcion: 'Descripción del bug',
        severidad: SEVERIDAD_BUG.CRITICO,
        tipo: 'TEST'
      });

      expect(bug.id).toMatch(/^BUG-/);
      expect(bug.titulo).toBe('Test bug');
      expect(bug.descripcion).toBe('Descripción del bug');
      expect(bug.severidad).toBe(SEVERIDAD_BUG.CRITICO);
      expect(bug.tipo).toBe('TEST');
      expect(bug.timestamp).toBeDefined();
    });

    test('Incluye evidencia cuando se proporciona', () => {
      const bug = qa.crearBug({
        titulo: 'Test',
        descripcion: 'Test',
        severidad: SEVERIDAD_BUG.MENOR,
        tipo: 'TEST',
        evidencia: 'Error stack trace'
      });

      expect(bug.evidencia).toBeDefined();
    });

    test('Incluye sugerencia de fix cuando se proporciona', () => {
      const bug = qa.crearBug({
        titulo: 'Test',
        descripcion: 'Test',
        severidad: SEVERIDAD_BUG.MENOR,
        tipo: 'TEST',
        sugerenciaFix: 'Revisar validación de entrada'
      });

      expect(bug.sugerenciaFix).toBe('Revisar validación de entrada');
    });
  });

  describe('redactarEvidencia()', () => {
    test('Redacta emails', () => {
      const texto = 'Error para usuario test@example.com';
      const redactado = qa.redactarEvidencia(texto);
      expect(redactado).not.toContain('test@example.com');
      expect(redactado).toContain('[REDACTED]');
    });

    test('Redacta tokens Bearer', () => {
      const texto = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123';
      const redactado = qa.redactarEvidencia(texto);
      expect(redactado).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(redactado).toContain('[REDACTED]');
    });

    test('Redacta passwords', () => {
      const texto = 'password: "secreto123"';
      const redactado = qa.redactarEvidencia(texto);
      expect(redactado).not.toContain('secreto123');
    });

    test('Redacta API keys', () => {
      const texto = 'api_key: sk-1234567890abcdef';
      const redactado = qa.redactarEvidencia(texto);
      expect(redactado).not.toContain('sk-1234567890abcdef');
    });

    test('Trunca texto muy largo', () => {
      const textoLargo = 'a'.repeat(1000);
      const redactado = qa.redactarEvidencia(textoLargo);
      expect(redactado.length).toBeLessThanOrEqual(520); // 500 + "... [TRUNCATED]"
      expect(redactado).toContain('[TRUNCATED]');
    });

    test('Retorna null para entrada null', () => {
      expect(qa.redactarEvidencia(null)).toBeNull();
    });

    test('Redacta números de teléfono largos', () => {
      const texto = 'Contacto: 3001234567';
      const redactado = qa.redactarEvidencia(texto);
      expect(redactado).toContain('[REDACTED]');
    });
  });

  describe('obtenerEstado()', () => {
    test('Retorna estado completo', () => {
      const estado = qa.obtenerEstado();

      expect(estado).toHaveProperty('activo');
      expect(estado).toHaveProperty('ejecucionEnProgreso');
      expect(estado).toHaveProperty('ultimaEjecucion');
      expect(estado).toHaveProperty('config');
    });
  });

  describe('obtenerBugs() con filtros', () => {
    beforeEach(() => {
      qa.resultados.bugs = [
        { id: '1', severidad: SEVERIDAD_BUG.CRITICO, tipo: 'TEST_FAILURE' },
        { id: '2', severidad: SEVERIDAD_BUG.MAYOR, tipo: 'ENDPOINT_FAILURE' },
        { id: '3', severidad: SEVERIDAD_BUG.CRITICO, tipo: 'DATA_INTEGRITY' },
        { id: '4', severidad: SEVERIDAD_BUG.MENOR, tipo: 'TEST_FAILURE' }
      ];
    });

    test('Sin filtros retorna todos', () => {
      const bugs = qa.obtenerBugs();
      expect(bugs).toHaveLength(4);
    });

    test('Filtro por severidad', () => {
      const bugs = qa.obtenerBugs({ severidad: SEVERIDAD_BUG.CRITICO });
      expect(bugs).toHaveLength(2);
    });

    test('Filtro por tipo', () => {
      const bugs = qa.obtenerBugs({ tipo: 'TEST_FAILURE' });
      expect(bugs).toHaveLength(2);
    });

    test('Filtros combinados', () => {
      const bugs = qa.obtenerBugs({
        severidad: SEVERIDAD_BUG.CRITICO,
        tipo: 'DATA_INTEGRITY'
      });
      expect(bugs).toHaveLength(1);
      expect(bugs[0].id).toBe('3');
    });
  });

  describe('obtenerHistorial()', () => {
    test('Retorna historial vacío inicialmente', () => {
      const historial = qa.obtenerHistorial();
      expect(historial).toHaveLength(0);
    });

    test('Limita resultados según parámetro', () => {
      // Simular historial
      qa.historialEjecuciones = [
        { fecha: '2024-01-01' },
        { fecha: '2024-01-02' },
        { fecha: '2024-01-03' }
      ];

      const historial = qa.obtenerHistorial(2);
      expect(historial).toHaveLength(2);
    });
  });
});

// ============================================================================
// TESTS DE SMOKE TESTS
// ============================================================================

describe('QAVacaciones - E2E Smoke Tests', () => {
  let qa;

  beforeEach(() => {
    qa = new QAVacaciones(null);
  });

  test('ejecutarE2ESmoke completa sin errores', async () => {
    const resultado = await qa.ejecutarE2ESmoke();

    expect(resultado.tipo).toBe(TIPO_TEST.E2E_SMOKE);
    expect(resultado.total).toBeGreaterThan(0);
    expect(resultado.duracion).toBeGreaterThan(0);
  });

  test('Smoke tests validan funcionalidad core', async () => {
    const resultado = await qa.ejecutarE2ESmoke();

    // Todos los smoke tests deberían pasar
    expect(resultado.exitoso).toBe(true);
    expect(resultado.fallidos).toBe(0);
  });

  test('Smoke tests incluyen casos críticos', async () => {
    const resultado = await qa.ejecutarE2ESmoke();

    const nombresTests = resultado.tests.map(t => t.nombre);

    expect(nombresTests).toContain('Cálculo de causación básico');
    expect(nombresTests).toContain('Saldo disponible correcto');
    expect(nombresTests).toContain('Detección de superposición');
  });
});

// ============================================================================
// TESTS DE CASOS BORDE
// ============================================================================

describe('QAVacaciones - Casos Borde', () => {
  let qa;

  beforeEach(() => {
    qa = new QAVacaciones(null);
  });

  test('ejecutarCasosBorde completa sin errores', async () => {
    const resultado = await qa.ejecutarCasosBorde();

    expect(resultado.tipo).toBe(TIPO_TEST.EDGE_CASE);
    expect(resultado.total).toBeGreaterThan(0);
  });

  test('Casos borde incluyen escenarios requeridos', async () => {
    const resultado = await qa.ejecutarCasosBorde();

    const nombresTests = resultado.tests.map(t => t.nombre);

    expect(nombresTests).toContain('hireDate = fechaCorte (0 días)');
    expect(nombresTests).toContain('Año bisiesto completo (2024)');
    expect(nombresTests).toContain('Base 360 vs 365 produce diferencia');
    expect(nombresTests).toContain('Suspensión reduce días causados');
    expect(nombresTests).toContain('Periodos solapados detectados correctamente');
  });

  test('Todos los casos borde pasan', async () => {
    const resultado = await qa.ejecutarCasosBorde();

    expect(resultado.exitoso).toBe(true);
    expect(resultado.fallidos).toBe(0);
  });
});

// ============================================================================
// TESTS DE GENERACIÓN DE REPORTES
// ============================================================================

describe('QAVacaciones - Generación de Reportes', () => {
  let qa;

  beforeEach(() => {
    qa = new QAVacaciones(null, { DIRECTORIO_REPORTES: 'qa-test' });
    qa.resultados = {
      tests: [
        { tipo: TIPO_TEST.UNIT, nombre: 'Unit Tests', exitoso: true, pasados: 10, total: 10, duracion: 100, tests: [] },
        { tipo: TIPO_TEST.E2E_SMOKE, nombre: 'Smoke', exitoso: true, pasados: 5, total: 5, duracion: 50, tests: [] }
      ],
      bugs: [
        {
          id: 'BUG-123',
          titulo: 'Test bug',
          descripcion: 'Descripción',
          severidad: SEVERIDAD_BUG.MAYOR,
          tipo: 'TEST',
          timestamp: '2024-01-15T10:00:00Z'
        }
      ],
      cobertura: { total: 85, lineas: 85, ramas: 80, funciones: 90, dominio: 88 },
      logs: { errores: [], warnings: [], patrones: [] },
      metricas: { tiempoTotal: 500, testsEjecutados: 15, testsFallidos: 0 }
    };
  });

  test('generarContenidoReporte produce markdown válido', () => {
    const contenido = qa.generarContenidoReporte();

    expect(contenido).toContain('# Reporte de QA');
    expect(contenido).toContain('## Resumen Ejecutivo');
    expect(contenido).toContain('## Cobertura de Código');
    expect(contenido).toContain('## Detalle de Suites');
    expect(contenido).toContain('## Bugs Encontrados');
  });

  test('Reporte incluye métricas correctas', () => {
    const contenido = qa.generarContenidoReporte();

    expect(contenido).toContain('15'); // Tests ejecutados
    expect(contenido).toContain('88%'); // Cobertura dominio
    expect(contenido).toContain('500ms'); // Tiempo
  });

  test('Reporte incluye bugs', () => {
    const contenido = qa.generarContenidoReporte();

    expect(contenido).toContain('Test bug');
    expect(contenido).toContain('MAYOR');
  });

  test('iconoSeveridad retorna icono correcto', () => {
    expect(qa.iconoSeveridad(SEVERIDAD_BUG.CRITICO)).toBe('🔴');
    expect(qa.iconoSeveridad(SEVERIDAD_BUG.MAYOR)).toBe('🟠');
    expect(qa.iconoSeveridad(SEVERIDAD_BUG.MENOR)).toBe('🟡');
    expect(qa.iconoSeveridad(SEVERIDAD_BUG.TRIVIAL)).toBe('⚪');
  });

  test('generarRecomendaciones genera lista', () => {
    qa.resultados.bugs = [{ severidad: SEVERIDAD_BUG.CRITICO }];
    qa.resultados.cobertura.dominio = 70;

    const recomendaciones = qa.generarRecomendaciones();

    expect(recomendaciones).toContain('URGENTE');
    expect(recomendaciones).toContain('cobertura');
  });
});

// ============================================================================
// TESTS DE VALIDACIÓN DE REGLAS DE NEGOCIO (SIN DB)
// ============================================================================

describe('QAVacaciones - Validación Reglas de Negocio', () => {
  let qa;

  beforeEach(() => {
    qa = new QAVacaciones(null);
  });

  test('validarReglasNegocio salta sin DB', async () => {
    const resultado = await qa.validarReglasNegocio();

    expect(resultado.tests).toHaveLength(1);
    expect(resultado.tests[0].saltado).toBe(true);
    expect(resultado.exitoso).toBe(true);
  });
});

// ============================================================================
// TESTS DE ANÁLISIS DE LOGS
// ============================================================================

describe('QAVacaciones - Análisis de Logs', () => {
  let qa;

  beforeEach(() => {
    qa = new QAVacaciones(null);
  });

  test('analizarLogs completa sin errores', async () => {
    const analisis = await qa.analizarLogs();

    expect(analisis).toHaveProperty('errores4xx');
    expect(analisis).toHaveProperty('errores5xx');
    expect(analisis).toHaveProperty('timeouts');
  });

  test('Registra errores en resultados', async () => {
    await qa.analizarLogs();

    expect(qa.resultados.logs.errores).toBeDefined();
    expect(Array.isArray(qa.resultados.logs.errores)).toBe(true);
  });
});

// ============================================================================
// TESTS DE INTEGRACIÓN
// ============================================================================

describe('QAVacaciones - Ciclo Completo', () => {
  let qa;

  beforeEach(() => {
    qa = new QAVacaciones(null, {
      DIRECTORIO_REPORTES: 'qa-test-integration'
    });
  });

  afterEach(() => {
    qa.detener();
  });

  test('ejecutarCicloQA completa sin DB', async () => {
    const resultado = await qa.ejecutarCicloQA();

    expect(resultado).toHaveProperty('resultados');
    expect(resultado.resultados.metricas.tiempoTotal).toBeGreaterThan(0);
    expect(resultado.resultados.metricas.testsEjecutados).toBeGreaterThan(0);
  }, 30000);

  test('Ciclo actualiza historial', async () => {
    await qa.ejecutarCicloQA();

    const historial = qa.obtenerHistorial();
    expect(historial.length).toBeGreaterThan(0);
  }, 30000);

  test('Estado se actualiza después de ejecución', async () => {
    await qa.ejecutarCicloQA();

    const estado = qa.obtenerEstado();
    expect(estado.ultimaEjecucion).not.toBeNull();
  }, 30000);
});

// ============================================================================
// TESTS DE RENDIMIENTO
// ============================================================================

describe('Tests de Rendimiento QA', () => {
  test('Crear 100 bugs < 50ms', () => {
    const qa = new QAVacaciones(null);
    const inicio = Date.now();

    for (let i = 0; i < 100; i++) {
      qa.crearBug({
        titulo: `Bug ${i}`,
        descripcion: 'Test',
        severidad: SEVERIDAD_BUG.MENOR,
        tipo: 'TEST'
      });
    }

    const tiempo = Date.now() - inicio;
    expect(tiempo).toBeLessThan(50);
  });

  test('Redactar 100 textos < 30ms', () => {
    const qa = new QAVacaciones(null);
    const texto = 'Error con email test@test.com y token Bearer abc123';
    const inicio = Date.now();

    for (let i = 0; i < 100; i++) {
      qa.redactarEvidencia(texto);
    }

    const tiempo = Date.now() - inicio;
    expect(tiempo).toBeLessThan(30);
  });

  test('Filtrar 1000 bugs < 20ms', () => {
    const qa = new QAVacaciones(null);
    qa.resultados.bugs = Array.from({ length: 1000 }, (_, i) => ({
      id: `BUG-${i}`,
      severidad: i % 2 === 0 ? SEVERIDAD_BUG.CRITICO : SEVERIDAD_BUG.MENOR,
      tipo: i % 3 === 0 ? 'TEST' : 'OTHER'
    }));

    const inicio = Date.now();
    qa.obtenerBugs({ severidad: SEVERIDAD_BUG.CRITICO });
    const tiempo = Date.now() - inicio;

    expect(tiempo).toBeLessThan(20);
  });
});
