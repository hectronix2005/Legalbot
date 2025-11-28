/**
 * Tests de Integración - GestorSolicitudesVacaciones
 *
 * Pruebas para validar:
 * - Validación de formularios
 * - Sugerencias de rangos alternativos
 * - Sistema de eventos
 * - Idempotencia y bloqueos
 * - Plantillas de notificación
 */

const {
  validarFormularioSolicitud,
  sugerirRangosAlternativos,
  publicarEvento,
  suscribirEvento,
  EVENTOS,
  verificarIdempotencia,
  generarIdempotencyKey,
  renderizarPlantilla,
  PLANTILLAS,
  CONFIG,
  _colaEventos
} = require('../services/gestorSolicitudesVacaciones');

// ============================================================================
// VALIDACIÓN DE FORMULARIOS
// ============================================================================

describe('validarFormularioSolicitud()', () => {
  // Fecha válida en el futuro
  const fechaFutura = new Date();
  fechaFutura.setDate(fechaFutura.getDate() + 10);
  const fechaFuturaStr = fechaFutura.toISOString().split('T')[0];

  const fechaFinFutura = new Date(fechaFutura);
  fechaFinFutura.setDate(fechaFinFutura.getDate() + 5);
  const fechaFinFuturaStr = fechaFinFutura.toISOString().split('T')[0];

  test('Formulario válido completo', () => {
    const resultado = validarFormularioSolicitud({
      empleadoId: '507f1f77bcf86cd799439011',
      fechaInicio: fechaFuturaStr,
      fechaFin: fechaFinFuturaStr,
      diasSolicitados: 5,
      observaciones: 'Vacaciones familiares'
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toHaveLength(0);
  });

  test('Campos requeridos faltantes', () => {
    const resultado = validarFormularioSolicitud({});

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.length).toBeGreaterThanOrEqual(4);
    expect(resultado.errores.some(e => e.campo === 'empleadoId')).toBe(true);
    expect(resultado.errores.some(e => e.campo === 'fechaInicio')).toBe(true);
    expect(resultado.errores.some(e => e.campo === 'fechaFin')).toBe(true);
    expect(resultado.errores.some(e => e.campo === 'diasSolicitados')).toBe(true);
  });

  test('Días solicitados = 0 es inválido', () => {
    const resultado = validarFormularioSolicitud({
      empleadoId: '507f1f77bcf86cd799439011',
      fechaInicio: fechaFuturaStr,
      fechaFin: fechaFinFuturaStr,
      diasSolicitados: 0
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some(e => e.campo === 'diasSolicitados')).toBe(true);
  });

  test('Días solicitados excede máximo', () => {
    const resultado = validarFormularioSolicitud({
      empleadoId: '507f1f77bcf86cd799439011',
      fechaInicio: fechaFuturaStr,
      fechaFin: fechaFinFuturaStr,
      diasSolicitados: CONFIG.DIAS_MAXIMO_POR_SOLICITUD + 5
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some(e =>
      e.mensaje.includes('Máximo') && e.mensaje.includes(CONFIG.DIAS_MAXIMO_POR_SOLICITUD.toString())
    )).toBe(true);
  });

  test('Fecha de inicio en el pasado', () => {
    const fechaPasada = new Date();
    fechaPasada.setDate(fechaPasada.getDate() - 5);

    const resultado = validarFormularioSolicitud({
      empleadoId: '507f1f77bcf86cd799439011',
      fechaInicio: fechaPasada.toISOString().split('T')[0],
      fechaFin: fechaFinFuturaStr,
      diasSolicitados: 5
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some(e => e.mensaje.includes('futura'))).toBe(true);
  });

  test('Fecha fin anterior a fecha inicio', () => {
    const resultado = validarFormularioSolicitud({
      empleadoId: '507f1f77bcf86cd799439011',
      fechaInicio: fechaFinFuturaStr,
      fechaFin: fechaFuturaStr,
      diasSolicitados: 5
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some(e => e.mensaje.includes('posterior'))).toBe(true);
  });

  test('Anticipación mínima no cumplida', () => {
    const fechaMuyProxima = new Date();
    fechaMuyProxima.setDate(fechaMuyProxima.getDate() + 2); // Solo 2 días

    const resultado = validarFormularioSolicitud({
      empleadoId: '507f1f77bcf86cd799439011',
      fechaInicio: fechaMuyProxima.toISOString().split('T')[0],
      fechaFin: fechaFinFuturaStr,
      diasSolicitados: 5
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some(e => e.mensaje.includes('anticipación'))).toBe(true);
  });

  test('Observaciones excede longitud máxima', () => {
    const resultado = validarFormularioSolicitud({
      empleadoId: '507f1f77bcf86cd799439011',
      fechaInicio: fechaFuturaStr,
      fechaFin: fechaFinFuturaStr,
      diasSolicitados: 5,
      observaciones: 'x'.repeat(600) // 600 caracteres
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some(e => e.mensaje.includes('500'))).toBe(true);
  });
});

// ============================================================================
// SUGERENCIAS DE RANGOS ALTERNATIVOS
// ============================================================================

describe('sugerirRangosAlternativos()', () => {
  const fechaInicio = '2025-02-01';

  test('Sin saldo disponible = sin sugerencias', () => {
    const resultado = sugerirRangosAlternativos(0, 10, fechaInicio);

    expect(resultado.sugerencias).toHaveLength(0);
    expect(resultado.mensaje).toContain('No tiene saldo');
  });

  test('Saldo parcial genera sugerencia de saldo completo', () => {
    const resultado = sugerirRangosAlternativos(8.5, 15, fechaInicio);

    expect(resultado.sugerencias.length).toBeGreaterThan(0);
    expect(resultado.sugerencias.some(s => s.tipo === 'saldo_completo')).toBe(true);

    const sugerenciaCompleta = resultado.sugerencias.find(s => s.tipo === 'saldo_completo');
    expect(sugerenciaCompleta.diasSugeridos).toBeLessThanOrEqual(8.5);
  });

  test('Saldo suficiente para mitad genera sugerencia de mitad', () => {
    const resultado = sugerirRangosAlternativos(10, 15, fechaInicio);

    expect(resultado.sugerencias.some(s => s.tipo === 'mitad_saldo')).toBe(true);

    const sugerenciaMitad = resultado.sugerencias.find(s => s.tipo === 'mitad_saldo');
    expect(sugerenciaMitad.diasSugeridos).toBe(5);
  });

  test('Saldo suficiente para semana genera sugerencia de semana', () => {
    const resultado = sugerirRangosAlternativos(7, 15, fechaInicio);

    expect(resultado.sugerencias.some(s => s.tipo === 'una_semana')).toBe(true);

    const sugerenciaSemana = resultado.sugerencias.find(s => s.tipo === 'una_semana');
    expect(sugerenciaSemana.diasSugeridos).toBe(5);
  });

  test('Todas las sugerencias tienen fechas válidas', () => {
    const resultado = sugerirRangosAlternativos(12, 20, fechaInicio);

    for (const sugerencia of resultado.sugerencias) {
      expect(sugerencia.fechaInicio).toBe(fechaInicio);
      expect(sugerencia.fechaFin).toBeDefined();
      expect(new Date(sugerencia.fechaFin) >= new Date(sugerencia.fechaInicio)).toBe(true);
    }
  });
});

// ============================================================================
// SISTEMA DE EVENTOS
// ============================================================================

describe('Sistema de Eventos', () => {
  beforeEach(() => {
    // Limpiar cola de eventos antes de cada test
    _colaEventos.length = 0;
  });

  test('publicarEvento agrega evento a la cola', () => {
    const evento = publicarEvento(EVENTOS.SOLICITUD_CREADA, {
      solicitudId: 'test-123',
      empleadoId: 'emp-456'
    });

    expect(evento.id).toBeDefined();
    expect(evento.tipo).toBe(EVENTOS.SOLICITUD_CREADA);
    expect(evento.datos.solicitudId).toBe('test-123');
    expect(evento.metadata.timestamp).toBeDefined();
    expect(_colaEventos.length).toBe(1);
  });

  test('suscribirEvento notifica a handlers', () => {
    let eventoRecibido = null;

    suscribirEvento(EVENTOS.SOLICITUD_APROBADA, (evento) => {
      eventoRecibido = evento;
    });

    publicarEvento(EVENTOS.SOLICITUD_APROBADA, { test: true });

    expect(eventoRecibido).not.toBeNull();
    expect(eventoRecibido.datos.test).toBe(true);
  });

  test('Múltiples suscriptores reciben evento', () => {
    const recibidos = [];

    suscribirEvento(EVENTOS.SALDO_ACTUALIZADO, (e) => recibidos.push('handler1'));
    suscribirEvento(EVENTOS.SALDO_ACTUALIZADO, (e) => recibidos.push('handler2'));

    publicarEvento(EVENTOS.SALDO_ACTUALIZADO, {});

    expect(recibidos).toContain('handler1');
    expect(recibidos).toContain('handler2');
  });

  test('Eventos incluyen metadata', () => {
    const evento = publicarEvento(EVENTOS.NOTIFICACION_ENVIADA, {}, {
      companyId: 'comp-123',
      userId: 'user-456'
    });

    expect(evento.metadata.companyId).toBe('comp-123');
    expect(evento.metadata.userId).toBe('user-456');
    expect(evento.metadata.version).toBe('1.0');
  });

  test('EVENTOS contiene todos los tipos esperados', () => {
    expect(EVENTOS.SOLICITUD_CREADA).toBeDefined();
    expect(EVENTOS.SOLICITUD_APROBADA).toBeDefined();
    expect(EVENTOS.SOLICITUD_RECHAZADA).toBeDefined();
    expect(EVENTOS.SOLICITUD_PROGRAMADA).toBeDefined();
    expect(EVENTOS.SOLICITUD_CANCELADA).toBeDefined();
    expect(EVENTOS.DISFRUTE_REGISTRADO).toBeDefined();
    expect(EVENTOS.SALDO_ACTUALIZADO).toBeDefined();
    expect(EVENTOS.NOTIFICACION_ENVIADA).toBeDefined();
    expect(EVENTOS.SLA_VENCIDO).toBeDefined();
    expect(EVENTOS.ERROR_PROCESAMIENTO).toBeDefined();
  });
});

// ============================================================================
// IDEMPOTENCIA
// ============================================================================

describe('Sistema de Idempotencia', () => {
  test('generarIdempotencyKey genera claves únicas', () => {
    const key1 = generarIdempotencyKey('crear', { id: '123' });
    const key2 = generarIdempotencyKey('crear', { id: '456' });
    const key3 = generarIdempotencyKey('aprobar', { id: '123' });

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1.startsWith('idem_crear_')).toBe(true);
  });

  test('generarIdempotencyKey es determinista', () => {
    const key1 = generarIdempotencyKey('crear', { id: '123', fecha: '2025-01-01' });
    const key2 = generarIdempotencyKey('crear', { id: '123', fecha: '2025-01-01' });

    expect(key1).toBe(key2);
  });

  test('verificarIdempotencia retorna no duplicada para clave nueva', async () => {
    const key = generarIdempotencyKey('test', { random: Math.random() });
    const resultado = await verificarIdempotencia(key);

    expect(resultado.duplicada).toBe(false);
  });
});

// ============================================================================
// PLANTILLAS DE NOTIFICACIÓN
// ============================================================================

describe('Plantillas de Notificación', () => {
  describe('renderizarPlantilla()', () => {
    test('Renderiza plantilla de email con variables', () => {
      const resultado = renderizarPlantilla('solicitud_creada_empleado', 'email', {
        empleadoNombre: 'Juan Pérez',
        diasSolicitados: 10,
        fechaInicio: '2025-02-01',
        fechaFin: '2025-02-12',
        saldoRestante: 5.5,
        slaHoras: 48,
        slaVencimiento: '2025-01-27T18:00:00Z'
      });

      expect(resultado).not.toBeNull();
      expect(resultado.asunto).toContain('Solicitud de vacaciones');
      expect(resultado.cuerpo).toContain('Juan Pérez');
      expect(resultado.cuerpo).toContain('10');
      expect(resultado.cuerpo).toContain('2025-02-01');
    });

    test('Renderiza plantilla de WhatsApp', () => {
      const resultado = renderizarPlantilla('solicitud_creada', 'whatsapp', {
        empleadoNombre: 'María García',
        diasSolicitados: 5,
        fechaInicio: '2025-03-01',
        fechaFin: '2025-03-05'
      });

      expect(resultado).toContain('María García');
      expect(resultado).toContain('5');
      expect(resultado).toContain('Pendiente');
    });

    test('Retorna null para plantilla inexistente', () => {
      const resultado = renderizarPlantilla('plantilla_inexistente', 'email', {});
      expect(resultado).toBeNull();
    });

    test('Retorna null para canal inexistente', () => {
      const resultado = renderizarPlantilla('solicitud_creada', 'telegram', {});
      expect(resultado).toBeNull();
    });

    test('Variables no encontradas se mantienen', () => {
      const resultado = renderizarPlantilla('solicitud_aprobada', 'whatsapp', {
        empleadoNombre: 'Test'
        // Falta diasAprobados, fechaInicio, fechaFin
      });

      expect(resultado).toContain('Test');
      expect(resultado).toContain('{diasAprobados}'); // Variable no reemplazada
    });
  });

  describe('Estructura de PLANTILLAS', () => {
    test('Plantillas de email tienen asunto y cuerpo', () => {
      for (const [nombre, plantilla] of Object.entries(PLANTILLAS.email)) {
        if (typeof plantilla === 'object') {
          expect(plantilla.asunto).toBeDefined();
          expect(plantilla.cuerpo).toBeDefined();
        }
      }
    });

    test('Plantillas de WhatsApp son strings', () => {
      for (const [nombre, plantilla] of Object.entries(PLANTILLAS.whatsapp)) {
        expect(typeof plantilla).toBe('string');
      }
    });

    test('Existen plantillas para todos los flujos principales', () => {
      // Email
      expect(PLANTILLAS.email.solicitud_creada_empleado).toBeDefined();
      expect(PLANTILLAS.email.solicitud_pendiente_jefe).toBeDefined();
      expect(PLANTILLAS.email.solicitud_aprobada).toBeDefined();
      expect(PLANTILLAS.email.solicitud_rechazada).toBeDefined();
      expect(PLANTILLAS.email.disfrute_registrado).toBeDefined();
      expect(PLANTILLAS.email.sla_proximo_vencer).toBeDefined();

      // WhatsApp
      expect(PLANTILLAS.whatsapp.solicitud_creada).toBeDefined();
      expect(PLANTILLAS.whatsapp.solicitud_pendiente_jefe).toBeDefined();
      expect(PLANTILLAS.whatsapp.solicitud_aprobada).toBeDefined();
      expect(PLANTILLAS.whatsapp.solicitud_rechazada).toBeDefined();
    });
  });
});

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

describe('Configuración (CONFIG)', () => {
  test('SLA de aprobación está configurado', () => {
    expect(CONFIG.SLA_APROBACION_HORAS).toBeGreaterThan(0);
    expect(typeof CONFIG.SLA_APROBACION_HORAS).toBe('number');
  });

  test('Días de anticipación mínimo está configurado', () => {
    expect(CONFIG.DIAS_ANTICIPACION_MINIMO).toBeGreaterThanOrEqual(0);
  });

  test('Días máximo por solicitud está configurado', () => {
    expect(CONFIG.DIAS_MAXIMO_POR_SOLICITUD).toBeGreaterThan(0);
    expect(CONFIG.DIAS_MAXIMO_POR_SOLICITUD).toBeLessThanOrEqual(30);
  });

  test('Configuración de reintentos está definida', () => {
    expect(CONFIG.MAX_REINTENTOS).toBeGreaterThan(0);
    expect(CONFIG.TIEMPO_ENTRE_REINTENTOS).toBeGreaterThan(0);
  });

  test('TTL de locks está definido', () => {
    expect(CONFIG.LOCK_TTL_SECONDS).toBeGreaterThan(0);
  });
});

// ============================================================================
// CASOS DE INTEGRACIÓN SIMULADOS
// ============================================================================

describe('Casos de Integración (simulados)', () => {
  test('Flujo completo de validación + sugerencia', () => {
    // 1. Validar formulario
    const fechaFutura = new Date();
    fechaFutura.setDate(fechaFutura.getDate() + 10);

    const validacion = validarFormularioSolicitud({
      empleadoId: 'emp-123',
      fechaInicio: fechaFutura.toISOString().split('T')[0],
      fechaFin: new Date(fechaFutura.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      diasSolicitados: 15
    });

    expect(validacion.valido).toBe(true);

    // 2. Simular saldo insuficiente
    const saldoDisponible = 8;
    const necesitaSugerencia = 15 > saldoDisponible;

    expect(necesitaSugerencia).toBe(true);

    // 3. Obtener sugerencias
    const sugerencias = sugerirRangosAlternativos(
      saldoDisponible,
      15,
      fechaFutura.toISOString().split('T')[0]
    );

    expect(sugerencias.sugerencias.length).toBeGreaterThan(0);
    expect(sugerencias.mensaje).toContain('insuficiente');
  });

  test('Generación de evento y notificación', () => {
    // Limpiar cola
    _colaEventos.length = 0;

    // 1. Publicar evento de solicitud creada
    const evento = publicarEvento(EVENTOS.SOLICITUD_CREADA, {
      solicitudId: 'sol-789',
      empleadoId: 'emp-123',
      diasSolicitados: 5,
      fechaInicio: '2025-02-15',
      fechaFin: '2025-02-21'
    }, {
      companyId: 'comp-456'
    });

    // 2. Generar notificación basada en evento
    const notificacion = renderizarPlantilla('solicitud_creada_empleado', 'email', {
      empleadoNombre: 'Carlos López',
      diasSolicitados: evento.datos.diasSolicitados,
      fechaInicio: evento.datos.fechaInicio,
      fechaFin: evento.datos.fechaFin,
      saldoRestante: 10.5,
      slaHoras: CONFIG.SLA_APROBACION_HORAS,
      slaVencimiento: new Date(Date.now() + CONFIG.SLA_APROBACION_HORAS * 60 * 60 * 1000).toISOString()
    });

    expect(notificacion.cuerpo).toContain('Carlos López');
    expect(notificacion.cuerpo).toContain('5');
    expect(_colaEventos.length).toBe(1);
  });

  test('Idempotencia previene duplicados', async () => {
    const operacionDatos = {
      empleadoId: 'emp-123',
      fechaInicio: '2025-03-01',
      companyId: 'comp-456'
    };

    // Primera verificación - no duplicada
    const key = generarIdempotencyKey('crear_solicitud', operacionDatos);
    const check1 = await verificarIdempotencia(key);

    expect(check1.duplicada).toBe(false);

    // La misma clave genera el mismo hash
    const key2 = generarIdempotencyKey('crear_solicitud', operacionDatos);
    expect(key).toBe(key2);
  });
});

// ============================================================================
// RENDIMIENTO
// ============================================================================

describe('Tests de Rendimiento', () => {
  test('Validar 100 formularios < 50ms', () => {
    const fechaFutura = new Date();
    fechaFutura.setDate(fechaFutura.getDate() + 10);

    const inicio = Date.now();

    for (let i = 0; i < 100; i++) {
      validarFormularioSolicitud({
        empleadoId: `emp-${i}`,
        fechaInicio: fechaFutura.toISOString().split('T')[0],
        fechaFin: new Date(fechaFutura.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        diasSolicitados: 5
      });
    }

    const duracion = Date.now() - inicio;
    expect(duracion).toBeLessThan(50);
  });

  test('Generar 100 claves de idempotencia < 20ms', () => {
    const inicio = Date.now();

    for (let i = 0; i < 100; i++) {
      generarIdempotencyKey('operacion', { id: i, random: Math.random() });
    }

    const duracion = Date.now() - inicio;
    expect(duracion).toBeLessThan(20);
  });

  test('Publicar 100 eventos < 30ms', () => {
    _colaEventos.length = 0;
    const inicio = Date.now();

    for (let i = 0; i < 100; i++) {
      publicarEvento(EVENTOS.SALDO_ACTUALIZADO, { iteration: i });
    }

    const duracion = Date.now() - inicio;
    expect(duracion).toBeLessThan(30);
    expect(_colaEventos.length).toBe(100);
  });

  test('Renderizar 100 plantillas < 30ms', () => {
    const datos = {
      empleadoNombre: 'Test User',
      diasSolicitados: 5,
      fechaInicio: '2025-01-01',
      fechaFin: '2025-01-05',
      saldoRestante: 10,
      slaHoras: 48,
      slaVencimiento: '2025-01-03'
    };

    const inicio = Date.now();

    for (let i = 0; i < 100; i++) {
      renderizarPlantilla('solicitud_creada_empleado', 'email', datos);
    }

    const duracion = Date.now() - inicio;
    expect(duracion).toBeLessThan(30);
  });
});
