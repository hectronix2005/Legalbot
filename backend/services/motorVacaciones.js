/**
 * MotorVacaciones - Motor de Cálculo de Vacaciones Colombia
 *
 * Implementación de funciones puras para causación de vacaciones
 * según legislación laboral colombiana (CST Art. 186).
 *
 * FÓRMULA PRINCIPAL:
 * - Tasa diaria base 365: t = 15 / 365 ≈ 0.04109589
 * - Acumulado: accrued = días transcurridos * t (redondeo a 4 decimales; mostrar con 2)
 * - Saldo disponible: available = accrued - enjoyed - approvedPend
 *
 * CASOS BORDE SOPORTADOS:
 * - Ingreso hoy (accrued ≈ 0)
 * - Años bisiestos (diferencia real de fechas; mantener tasa por base)
 * - Suspensiones: restar días del numerador antes de multiplicar por t
 * - Cambio de base 365↔360: recalcular y registrar ADR/ajuste único
 * - Días hábiles: convertir a calendario en cálculos y a hábiles en interfaz
 *
 * Soporta:
 * - Base 365 días (estándar legal) o 360 días (comercial)
 * - Periodos de suspensión (licencias no remuneradas, ausencias injustificadas)
 * - Cambio de jornada (tiempo completo/parcial)
 * - Validaciones de saldo y bloqueos
 * - Conversión días hábiles ↔ calendario
 *
 * @module motorVacaciones
 */

// ============================================================================
// CONSTANTES
// ============================================================================

const MOTOR_CONSTANTS = {
  DIAS_VACACIONES_ANUALES: 15,  // Días hábiles por año de servicio (CST Art. 186)
  BASE_365: 365,
  BASE_360: 360,
  PRECISION_DECIMALES: 4,       // Redondeo interno a 4 decimales
  PRECISION_DISPLAY: 2,         // Mostrar con 2 decimales

  // Tasa diaria precalculada
  TASA_DIARIA_365: 15 / 365,    // ≈ 0.04109589
  TASA_DIARIA_360: 15 / 360,    // ≈ 0.04166667

  // Factor promedio días hábiles por semana (5 de 7)
  FACTOR_HABILES_CALENDARIO: 7 / 5, // 1.4 - para convertir hábiles a calendario
  FACTOR_CALENDARIO_HABILES: 5 / 7, // ≈ 0.714 - para convertir calendario a hábiles

  // Estados válidos del flujo (con doble aprobación)
  ESTADOS: {
    REQUESTED: 'requested',
    LEADER_APPROVED: 'leader_approved',
    LEADER_REJECTED: 'leader_rejected',
    HR_APPROVED: 'hr_approved',
    HR_REJECTED: 'hr_rejected',
    APPROVED: 'approved',         // Legacy compatibility
    SCHEDULED: 'scheduled',
    ENJOYED: 'enjoyed',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled'
  },

  // Transiciones válidas del state machine (con doble aprobación)
  TRANSICIONES_VALIDAS: {
    'requested': ['leader_approved', 'leader_rejected', 'cancelled'],
    'leader_approved': ['hr_approved', 'hr_rejected', 'cancelled'],
    'leader_rejected': [],
    'hr_approved': ['scheduled', 'enjoyed', 'cancelled'],
    'hr_rejected': [],
    'approved': ['scheduled', 'cancelled'],  // Legacy
    'scheduled': ['enjoyed', 'cancelled'],
    'enjoyed': [],
    'rejected': [],
    'cancelled': []
  }
};

// ============================================================================
// FUNCIONES UTILITARIAS PURAS
// ============================================================================

/**
 * Trunca un número a N decimales (sin redondear hacia arriba)
 * @param {number} num - Número a truncar
 * @param {number} decimals - Cantidad de decimales
 * @returns {number} Número truncado
 */
function floorDecimals(num, decimals = MOTOR_CONSTANTS.PRECISION_DECIMALES) {
  const factor = Math.pow(10, decimals);
  return Math.floor(num * factor) / factor;
}

/**
 * Calcula días entre dos fechas (inclusivo: +1)
 * @param {Date} fechaInicio - Fecha de inicio
 * @param {Date} fechaFin - Fecha de fin
 * @returns {number} Días transcurridos (inclusivo)
 */
function calcularDiasEntreFechas(fechaInicio, fechaFin) {
  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);

  const diffMs = fin - inicio;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDias + 1); // +1 para inclusivo
}

/**
 * Calcula días de suspensión dentro de un rango
 * @param {Array<{inicio: Date, fin: Date}>} periodosSinCausar - Periodos de suspensión
 * @param {Date} fechaInicio - Inicio del rango a evaluar
 * @param {Date} fechaFin - Fin del rango a evaluar
 * @returns {number} Total de días sin causar dentro del rango
 */
function calcularDiasSuspension(periodosSinCausar, fechaInicio, fechaFin) {
  if (!periodosSinCausar || !Array.isArray(periodosSinCausar) || periodosSinCausar.length === 0) {
    return 0;
  }

  let totalDiasSuspension = 0;
  const rangoInicio = new Date(fechaInicio);
  rangoInicio.setHours(0, 0, 0, 0);
  const rangoFin = new Date(fechaFin);
  rangoFin.setHours(0, 0, 0, 0);

  for (const periodo of periodosSinCausar) {
    const susInicio = new Date(periodo.inicio);
    susInicio.setHours(0, 0, 0, 0);
    const susFin = new Date(periodo.fin);
    susFin.setHours(0, 0, 0, 0);

    // Calcular intersección con el rango
    const interseccionInicio = susInicio < rangoInicio ? rangoInicio : susInicio;
    const interseccionFin = susFin > rangoFin ? rangoFin : susFin;

    if (interseccionInicio <= interseccionFin) {
      const diasPeriodo = calcularDiasEntreFechas(interseccionInicio, interseccionFin);
      totalDiasSuspension += diasPeriodo;
    }
  }

  return totalDiasSuspension;
}

// ============================================================================
// FUNCIÓN PRINCIPAL: calcularCausacion
// ============================================================================

/**
 * Calcula días de vacaciones causados (función PURA)
 *
 * Fórmula: diasCausados = max(0, floor_decimals((diasTrabajados) * tasaDiaria, 4))
 *
 * @param {Date|string} hireDate - Fecha de contratación
 * @param {Date|string} fechaCorte - Fecha hasta la cual calcular (inclusiva)
 * @param {Object} opciones - Opciones de cálculo
 * @param {number} [opciones.diasAnuales=15] - Días de vacaciones por año
 * @param {string} [opciones.base='365'] - Base de cálculo ('365' o '360')
 * @param {Array<{inicio: Date, fin: Date}>} [opciones.periodosSinCausar=[]] - Periodos de suspensión
 * @param {number} [opciones.factorJornada=1.0] - Factor de jornada (0.5 = medio tiempo)
 * @returns {Object} Resultado del cálculo
 *
 * @example
 * // Empleado con 1 año exacto, base 365
 * const resultado = calcularCausacion('2024-01-01', '2024-12-31');
 * // resultado.diasCausados ≈ 15.0000
 *
 * @example
 * // Con suspensión de 30 días
 * const resultado = calcularCausacion('2024-01-01', '2024-12-31', {
 *   periodosSinCausar: [{ inicio: '2024-06-01', fin: '2024-06-30' }]
 * });
 * // resultado.diasCausados ≈ 13.7671
 */
function calcularCausacion(hireDate, fechaCorte, opciones = {}) {
  // Valores por defecto
  const {
    diasAnuales = MOTOR_CONSTANTS.DIAS_VACACIONES_ANUALES,
    base = '365',
    periodosSinCausar = [],
    factorJornada = 1.0
  } = opciones;

  // Validar entradas
  const fechaContratacion = new Date(hireDate);
  const fechaCalculada = new Date(fechaCorte);

  // Validación de fechas
  if (isNaN(fechaContratacion.getTime())) {
    return {
      diasCausados: 0,
      diasTrabajados: 0,
      diasSuspension: 0,
      tasaDiaria: 0,
      error: 'Fecha de contratación inválida',
      valido: false
    };
  }

  if (isNaN(fechaCalculada.getTime())) {
    return {
      diasCausados: 0,
      diasTrabajados: 0,
      diasSuspension: 0,
      tasaDiaria: 0,
      error: 'Fecha de corte inválida',
      valido: false
    };
  }

  // Normalizar horas
  fechaContratacion.setHours(0, 0, 0, 0);
  fechaCalculada.setHours(0, 0, 0, 0);

  // Validar que fecha de corte no sea anterior a contratación
  if (fechaCalculada < fechaContratacion) {
    return {
      diasCausados: 0,
      diasTrabajados: 0,
      diasSuspension: 0,
      tasaDiaria: 0,
      error: 'Fecha de corte no puede ser anterior a fecha de contratación',
      valido: false
    };
  }

  // Validar base
  const baseNumerica = base === '360' ? MOTOR_CONSTANTS.BASE_360 : MOTOR_CONSTANTS.BASE_365;

  // Validar factor de jornada
  const factorJornadaValidado = Math.max(0, Math.min(1, factorJornada));

  // Calcular tasa diaria
  const tasaDiaria = diasAnuales / baseNumerica;

  // Calcular días calendario entre fechas (inclusivo)
  const diasCalendario = calcularDiasEntreFechas(fechaContratacion, fechaCalculada);

  // Calcular días de suspensión
  const diasSuspension = calcularDiasSuspension(periodosSinCausar, fechaContratacion, fechaCalculada);

  // Días efectivos trabajados
  const diasTrabajados = Math.max(0, diasCalendario - diasSuspension);

  // Calcular días causados con factor de jornada
  const diasCausadosBruto = diasTrabajados * tasaDiaria * factorJornadaValidado;
  const diasCausados = floorDecimals(Math.max(0, diasCausadosBruto), MOTOR_CONSTANTS.PRECISION_DECIMALES);

  // Calcular años de servicio
  const anosServicio = floorDecimals(diasTrabajados / baseNumerica, MOTOR_CONSTANTS.PRECISION_DECIMALES);

  return {
    diasCausados,
    diasTrabajados,
    diasCalendario,
    diasSuspension,
    tasaDiaria: floorDecimals(tasaDiaria, 8),
    anosServicio,
    factorJornada: factorJornadaValidado,
    base: base === '360' ? '360' : '365',
    diasAnuales,
    fechaContratacion: fechaContratacion.toISOString().split('T')[0],
    fechaCorte: fechaCalculada.toISOString().split('T')[0],
    valido: true,
    error: null
  };
}

// ============================================================================
// FUNCIÓN: saldoDisponible
// ============================================================================

/**
 * Calcula el saldo disponible de vacaciones
 *
 * Fórmula: disponible = accrued - enjoyed - approvedPending
 *
 * @param {number} accrued - Días causados/acumulados
 * @param {number} enjoyed - Días ya disfrutados
 * @param {number} approvedPend - Días aprobados pendientes de disfrutar
 * @returns {Object} Resultado del cálculo de saldo
 *
 * @example
 * const saldo = saldoDisponible(30.5, 15, 5);
 * // saldo.disponible = 10.5
 * // saldo.valido = true
 */
function saldoDisponible(accrued, enjoyed, approvedPend) {
  // Validar parámetros numéricos
  const params = { accrued, enjoyed, approvedPend };

  for (const [nombre, valor] of Object.entries(params)) {
    if (typeof valor !== 'number' || isNaN(valor)) {
      return {
        disponible: 0,
        accrued: 0,
        enjoyed: 0,
        approvedPending: 0,
        valido: false,
        error: `Parámetro ${nombre} debe ser un número válido`
      };
    }
  }

  // Detectar datos corruptos (valores negativos)
  if (accrued < 0 || enjoyed < 0 || approvedPend < 0) {
    return {
      disponible: 0,
      accrued,
      enjoyed,
      approvedPending: approvedPend,
      valido: false,
      error: 'Datos corruptos: valores negativos detectados',
      corrupcion: {
        accruedNegativo: accrued < 0,
        enjoyedNegativo: enjoyed < 0,
        approvedPendingNegativo: approvedPend < 0
      }
    };
  }

  // Calcular disponible
  const disponible = floorDecimals(accrued - enjoyed - approvedPend, MOTOR_CONSTANTS.PRECISION_DECIMALES);

  // Detectar saldo negativo (inconsistencia)
  if (disponible < 0) {
    return {
      disponible,
      accrued,
      enjoyed,
      approvedPending: approvedPend,
      valido: false,
      error: `Saldo negativo detectado (${disponible}). Verificar consistencia de datos.`,
      inconsistencia: true
    };
  }

  return {
    disponible,
    accrued,
    enjoyed,
    approvedPending: approvedPend,
    valido: true,
    error: null
  };
}

// ============================================================================
// FUNCIÓN: validarSolicitud (bloqueos)
// ============================================================================

/**
 * Valida si una solicitud de vacaciones es válida contra el saldo disponible
 * Implementa bloqueo: NO aprobar ni disfrutar > saldo
 *
 * @param {number} diasSolicitados - Días que se desean solicitar
 * @param {number} saldoActual - Saldo disponible actual
 * @returns {Object} Resultado de validación con bloqueo si aplica
 *
 * @example
 * const validacion = validarSolicitud(10, 8.5);
 * // validacion.aprobable = false
 * // validacion.bloqueado = true
 * // validacion.razon = 'Días solicitados (10) exceden saldo disponible (8.5)'
 */
function validarSolicitud(diasSolicitados, saldoActual) {
  // Validar parámetros
  if (typeof diasSolicitados !== 'number' || isNaN(diasSolicitados)) {
    return {
      aprobable: false,
      bloqueado: true,
      razon: 'Días solicitados debe ser un número válido',
      diasSolicitados: 0,
      saldoActual: saldoActual || 0
    };
  }

  if (typeof saldoActual !== 'number' || isNaN(saldoActual)) {
    return {
      aprobable: false,
      bloqueado: true,
      razon: 'Saldo actual debe ser un número válido',
      diasSolicitados,
      saldoActual: 0
    };
  }

  // Validar días positivos
  if (diasSolicitados <= 0) {
    return {
      aprobable: false,
      bloqueado: true,
      razon: 'Debe solicitar al menos 1 día de vacaciones',
      diasSolicitados,
      saldoActual
    };
  }

  // Validar saldo no negativo
  if (saldoActual < 0) {
    return {
      aprobable: false,
      bloqueado: true,
      razon: `Saldo negativo detectado (${saldoActual}). Contactar a RRHH.`,
      diasSolicitados,
      saldoActual,
      alertaCorrupcion: true
    };
  }

  // Validar suficiencia de saldo (BLOQUEO PRINCIPAL)
  if (diasSolicitados > saldoActual) {
    const faltante = floorDecimals(diasSolicitados - saldoActual, MOTOR_CONSTANTS.PRECISION_DECIMALES);
    return {
      aprobable: false,
      bloqueado: true,
      razon: `Días solicitados (${diasSolicitados}) exceden saldo disponible (${saldoActual}). Faltan ${faltante} días.`,
      diasSolicitados,
      saldoActual,
      faltante
    };
  }

  // Solicitud válida
  const saldoRestante = floorDecimals(saldoActual - diasSolicitados, MOTOR_CONSTANTS.PRECISION_DECIMALES);
  return {
    aprobable: true,
    bloqueado: false,
    razon: null,
    diasSolicitados,
    saldoActual,
    saldoRestante
  };
}

// ============================================================================
// FUNCIONES DE STATE MACHINE
// ============================================================================

/**
 * Verifica si una transición de estado es válida
 *
 * @param {string} estadoActual - Estado actual de la solicitud
 * @param {string} estadoDestino - Estado al que se desea transicionar
 * @returns {Object} Resultado de validación de transición
 *
 * @example
 * const transicion = validarTransicionEstado('requested', 'approved');
 * // transicion.valida = true
 */
function validarTransicionEstado(estadoActual, estadoDestino) {
  const { ESTADOS, TRANSICIONES_VALIDAS } = MOTOR_CONSTANTS;

  // Validar que estados existan
  const estadosValidos = Object.values(ESTADOS);

  if (!estadosValidos.includes(estadoActual)) {
    return {
      valida: false,
      razon: `Estado actual '${estadoActual}' no es válido. Estados válidos: ${estadosValidos.join(', ')}`
    };
  }

  if (!estadosValidos.includes(estadoDestino)) {
    return {
      valida: false,
      razon: `Estado destino '${estadoDestino}' no es válido. Estados válidos: ${estadosValidos.join(', ')}`
    };
  }

  // Verificar si la transición es permitida
  const transicionesPermitidas = TRANSICIONES_VALIDAS[estadoActual] || [];

  if (!transicionesPermitidas.includes(estadoDestino)) {
    return {
      valida: false,
      razon: `Transición de '${estadoActual}' a '${estadoDestino}' no permitida. Transiciones válidas desde '${estadoActual}': ${transicionesPermitidas.join(', ') || 'ninguna'}`
    };
  }

  return {
    valida: true,
    razon: null,
    estadoActual,
    estadoDestino
  };
}

/**
 * Obtiene el impacto en el saldo de una transición de estado
 *
 * @param {string} estadoActual - Estado actual
 * @param {string} estadoDestino - Estado destino
 * @param {number} diasSolicitados - Días de la solicitud
 * @returns {Object} Impacto en saldo
 */
function calcularImpactoSaldo(estadoActual, estadoDestino, diasSolicitados) {
  const { ESTADOS } = MOTOR_CONSTANTS;

  // Definir impactos por transición
  const impactos = {
    // Al aprobar: incrementar approvedPending
    [`${ESTADOS.REQUESTED}->${ESTADOS.APPROVED}`]: {
      approvedPendingDelta: diasSolicitados,
      enjoyedDelta: 0,
      descripcion: 'Días reservados para aprobación'
    },
    // Al disfrutar: mover de approvedPending a enjoyed
    [`${ESTADOS.SCHEDULED}->${ESTADOS.ENJOYED}`]: {
      approvedPendingDelta: -diasSolicitados,
      enjoyedDelta: diasSolicitados,
      descripcion: 'Días descontados del saldo disponible'
    },
    // Al cancelar desde aprobado: liberar approvedPending
    [`${ESTADOS.APPROVED}->${ESTADOS.CANCELLED}`]: {
      approvedPendingDelta: -diasSolicitados,
      enjoyedDelta: 0,
      descripcion: 'Días liberados por cancelación'
    },
    [`${ESTADOS.SCHEDULED}->${ESTADOS.CANCELLED}`]: {
      approvedPendingDelta: -diasSolicitados,
      enjoyedDelta: 0,
      descripcion: 'Días liberados por cancelación'
    }
  };

  const clave = `${estadoActual}->${estadoDestino}`;
  const impacto = impactos[clave] || {
    approvedPendingDelta: 0,
    enjoyedDelta: 0,
    descripcion: 'Sin impacto en saldo'
  };

  return {
    ...impacto,
    transicion: clave
  };
}

// ============================================================================
// FUNCIÓN: calcularProyeccion
// ============================================================================

/**
 * Proyecta el saldo de vacaciones a una fecha futura
 *
 * @param {Date} hireDate - Fecha de contratación
 * @param {Date} fechaActual - Fecha actual
 * @param {Date} fechaProyeccion - Fecha hasta la cual proyectar
 * @param {number} enjoyedDays - Días disfrutados actuales
 * @param {number} approvedPendingDays - Días aprobados pendientes actuales
 * @param {Object} opciones - Opciones de cálculo
 * @returns {Object} Proyección de saldo
 */
function calcularProyeccion(hireDate, fechaActual, fechaProyeccion, enjoyedDays, approvedPendingDays, opciones = {}) {
  // Calcular causación actual
  const causacionActual = calcularCausacion(hireDate, fechaActual, opciones);

  if (!causacionActual.valido) {
    return {
      valido: false,
      error: causacionActual.error
    };
  }

  // Calcular causación proyectada
  const causacionProyectada = calcularCausacion(hireDate, fechaProyeccion, opciones);

  if (!causacionProyectada.valido) {
    return {
      valido: false,
      error: causacionProyectada.error
    };
  }

  // Calcular saldos
  const saldoActual = saldoDisponible(causacionActual.diasCausados, enjoyedDays, approvedPendingDays);

  // Asumiendo que días aprobados se disfrutarán antes de la fecha de proyección
  const saldoProyectado = saldoDisponible(
    causacionProyectada.diasCausados,
    enjoyedDays + approvedPendingDays, // Asumir que se disfrutaron
    0
  );

  return {
    valido: true,
    actual: {
      fecha: fechaActual.toISOString().split('T')[0],
      diasCausados: causacionActual.diasCausados,
      disponible: saldoActual.disponible
    },
    proyeccion: {
      fecha: fechaProyeccion.toISOString().split('T')[0],
      diasCausados: causacionProyectada.diasCausados,
      disponibleProyectado: saldoProyectado.disponible,
      diasAdicionales: floorDecimals(
        causacionProyectada.diasCausados - causacionActual.diasCausados,
        MOTOR_CONSTANTS.PRECISION_DECIMALES
      )
    }
  };
}

// ============================================================================
// TABLAS DE EJEMPLO (para documentación)
// ============================================================================

/**
 * Genera tabla de ejemplo de causación mensual
 *
 * @param {Date} hireDate - Fecha de contratación
 * @param {number} meses - Cantidad de meses a simular
 * @param {Object} opciones - Opciones de cálculo
 * @returns {Array} Tabla de causación mensual
 */
function generarTablaCausacionMensual(hireDate, meses = 12, opciones = {}) {
  const tabla = [];
  const fechaInicio = new Date(hireDate);

  for (let i = 0; i <= meses; i++) {
    const fechaCorte = new Date(fechaInicio);
    fechaCorte.setMonth(fechaCorte.getMonth() + i);

    // Ajustar al último día del mes si estamos al final
    if (i > 0) {
      fechaCorte.setDate(0); // Último día del mes anterior al incremento
      fechaCorte.setMonth(fechaCorte.getMonth() + 1);
    }

    const resultado = calcularCausacion(hireDate, fechaCorte, opciones);

    tabla.push({
      mes: i,
      fecha: fechaCorte.toISOString().split('T')[0],
      diasCausados: resultado.diasCausados,
      diasTrabajados: resultado.diasTrabajados
    });
  }

  return tabla;
}

// ============================================================================
// CONVERSIÓN DÍAS HÁBILES ↔ CALENDARIO
// ============================================================================

/**
 * Convierte días hábiles a días calendario
 * Usa factor promedio: 1 día hábil ≈ 1.4 días calendario (7/5)
 *
 * Documentación: Los 15 días de vacaciones legales son HÁBILES.
 * Para cálculos de fechas se convierten a calendario.
 *
 * @param {number} diasHabiles - Días hábiles a convertir
 * @returns {Object} Resultado con días calendario
 *
 * @example
 * const resultado = convertirHabilesACalendario(15);
 * // resultado.diasCalendario = 21 (aproximadamente 3 semanas)
 */
function convertirHabilesACalendario(diasHabiles) {
  if (typeof diasHabiles !== 'number' || isNaN(diasHabiles) || diasHabiles < 0) {
    return {
      diasCalendario: 0,
      diasHabiles: 0,
      factor: MOTOR_CONSTANTS.FACTOR_HABILES_CALENDARIO,
      valido: false,
      error: 'Días hábiles debe ser un número positivo'
    };
  }

  const diasCalendario = Math.ceil(diasHabiles * MOTOR_CONSTANTS.FACTOR_HABILES_CALENDARIO);

  return {
    diasCalendario,
    diasHabiles,
    factor: MOTOR_CONSTANTS.FACTOR_HABILES_CALENDARIO,
    valido: true,
    nota: 'Factor promedio 7/5 (lun-vie laborables). Para precisión exacta usar función con fechas específicas.'
  };
}

/**
 * Convierte días calendario a días hábiles
 * Usa factor promedio: 1 día calendario ≈ 0.714 días hábiles (5/7)
 *
 * @param {number} diasCalendario - Días calendario a convertir
 * @returns {Object} Resultado con días hábiles
 */
function convertirCalendarioAHabiles(diasCalendario) {
  if (typeof diasCalendario !== 'number' || isNaN(diasCalendario) || diasCalendario < 0) {
    return {
      diasHabiles: 0,
      diasCalendario: 0,
      factor: MOTOR_CONSTANTS.FACTOR_CALENDARIO_HABILES,
      valido: false,
      error: 'Días calendario debe ser un número positivo'
    };
  }

  const diasHabiles = floorDecimals(
    diasCalendario * MOTOR_CONSTANTS.FACTOR_CALENDARIO_HABILES,
    MOTOR_CONSTANTS.PRECISION_DECIMALES
  );

  return {
    diasHabiles,
    diasCalendario,
    factor: MOTOR_CONSTANTS.FACTOR_CALENDARIO_HABILES,
    valido: true,
    nota: 'Factor promedio 5/7 (excluye sáb-dom). Para precisión exacta usar función con fechas específicas.'
  };
}

/**
 * Calcula días hábiles exactos entre dos fechas (excluyendo sábados y domingos)
 * Para cálculos precisos cuando se conocen las fechas exactas
 *
 * @param {Date} fechaInicio - Fecha de inicio
 * @param {Date} fechaFin - Fecha de fin
 * @param {Array<Date>} festivos - Días festivos a excluir (opcional)
 * @returns {Object} Resultado con días hábiles exactos
 */
function calcularDiasHabilesExactos(fechaInicio, fechaFin, festivos = []) {
  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);

  if (fin < inicio) {
    return {
      diasHabiles: 0,
      diasCalendario: 0,
      valido: false,
      error: 'Fecha fin debe ser posterior a fecha inicio'
    };
  }

  // Convertir festivos a timestamps para comparación rápida
  const festivosSet = new Set(
    festivos.map(f => {
      const d = new Date(f);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  let diasHabiles = 0;
  let diasCalendario = 0;
  const current = new Date(inicio);

  while (current <= fin) {
    diasCalendario++;
    const diaSemana = current.getDay(); // 0 = domingo, 6 = sábado

    // Es día hábil si no es sábado ni domingo ni festivo
    if (diaSemana !== 0 && diaSemana !== 6 && !festivosSet.has(current.getTime())) {
      diasHabiles++;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    diasHabiles,
    diasCalendario,
    festivosExcluidos: festivos.length,
    valido: true
  };
}

// ============================================================================
// CAMBIO DE BASE DE CÁLCULO (ADR)
// ============================================================================

/**
 * Calcula el ajuste necesario al cambiar de base de cálculo
 * Registra un ADR (Architectural Decision Record) para el cambio
 *
 * Ejemplo:
 * - Empleado con 365 días trabajados en base 365: 15 días causados
 * - Si cambia a base 360: 365 * (15/360) = 15.2083 días
 * - Ajuste: +0.2083 días (registrar como ajuste único)
 *
 * @param {Date} hireDate - Fecha de contratación
 * @param {Date} fechaCambio - Fecha del cambio de base
 * @param {string} baseActual - Base actual ('365' o '360')
 * @param {string} baseNueva - Nueva base ('365' o '360')
 * @param {Object} opciones - Opciones adicionales
 * @returns {Object} Ajuste calculado con registro ADR
 */
function calcularAjusteCambioBase(hireDate, fechaCambio, baseActual, baseNueva, opciones = {}) {
  const { periodosSinCausar = [], factorJornada = 1.0 } = opciones;

  // Validar que el cambio sea diferente
  if (baseActual === baseNueva) {
    return {
      ajusteNecesario: false,
      ajusteDias: 0,
      mensaje: 'No hay cambio de base',
      valido: true
    };
  }

  // Calcular causación con base actual
  const causacionActual = calcularCausacion(hireDate, fechaCambio, {
    base: baseActual,
    periodosSinCausar,
    factorJornada
  });

  // Calcular causación con nueva base
  const causacionNueva = calcularCausacion(hireDate, fechaCambio, {
    base: baseNueva,
    periodosSinCausar,
    factorJornada
  });

  if (!causacionActual.valido || !causacionNueva.valido) {
    return {
      ajusteNecesario: false,
      ajusteDias: 0,
      valido: false,
      error: causacionActual.error || causacionNueva.error
    };
  }

  // Calcular diferencia (ajuste)
  const ajusteDias = floorDecimals(
    causacionNueva.diasCausados - causacionActual.diasCausados,
    MOTOR_CONSTANTS.PRECISION_DECIMALES
  );

  // Generar ADR
  const adr = {
    id: `ADR-BASE-${Date.now()}`,
    tipo: 'cambio_base_calculo',
    fecha: new Date().toISOString(),
    contexto: `Cambio de base de cálculo de vacaciones de ${baseActual} a ${baseNueva}`,
    decision: ajusteDias !== 0
      ? `Aplicar ajuste único de ${ajusteDias} días al saldo del empleado`
      : 'No se requiere ajuste (diferencia es 0)',
    consecuencias: {
      diasBaseAnterior: causacionActual.diasCausados,
      diasBaseNueva: causacionNueva.diasCausados,
      ajuste: ajusteDias,
      tasaAnterior: causacionActual.tasaDiaria,
      tasaNueva: causacionNueva.tasaDiaria
    },
    estado: 'pendiente_aplicacion'
  };

  return {
    ajusteNecesario: ajusteDias !== 0,
    ajusteDias,
    baseAnterior: baseActual,
    baseNueva,
    causacionBaseAnterior: causacionActual.diasCausados,
    causacionBaseNueva: causacionNueva.diasCausados,
    adr,
    valido: true,
    instrucciones: ajusteDias > 0
      ? `Sumar ${ajusteDias} días al saldo del empleado como ajuste único por cambio de base`
      : ajusteDias < 0
        ? `Restar ${Math.abs(ajusteDias)} días del saldo del empleado como ajuste único por cambio de base`
        : 'No se requiere ajuste'
  };
}

// ============================================================================
// FORMATEO PARA DISPLAY
// ============================================================================

/**
 * Formatea días para mostrar en interfaz (2 decimales)
 *
 * @param {number} dias - Días con precisión interna (4 decimales)
 * @returns {string} Días formateados para display
 */
function formatearDiasParaDisplay(dias) {
  if (typeof dias !== 'number' || isNaN(dias)) {
    return '0.00';
  }
  return dias.toFixed(MOTOR_CONSTANTS.PRECISION_DISPLAY);
}

/**
 * Obtiene resumen completo formateado para UI
 *
 * @param {Object} balance - Objeto balance del empleado
 * @returns {Object} Resumen formateado para interfaz
 */
function obtenerResumenFormateado(balance) {
  const accrued = balance.accruedDays || 0;
  const enjoyed = (balance.enjoyedDays || 0) + (balance.historicalEnjoyedDays || 0);
  const approvedPend = balance.approvedPendingDays || 0;
  const available = accrued - enjoyed - approvedPend;

  return {
    // Valores internos (4 decimales)
    interno: {
      acumulado: floorDecimals(accrued, MOTOR_CONSTANTS.PRECISION_DECIMALES),
      disfrutado: floorDecimals(enjoyed, MOTOR_CONSTANTS.PRECISION_DECIMALES),
      aprobadoPendiente: floorDecimals(approvedPend, MOTOR_CONSTANTS.PRECISION_DECIMALES),
      disponible: floorDecimals(available, MOTOR_CONSTANTS.PRECISION_DECIMALES)
    },
    // Valores formateados para display (2 decimales)
    display: {
      acumulado: formatearDiasParaDisplay(accrued),
      disfrutado: formatearDiasParaDisplay(enjoyed),
      aprobadoPendiente: formatearDiasParaDisplay(approvedPend),
      disponible: formatearDiasParaDisplay(available)
    },
    // Conversión a días hábiles para referencia
    diasHabiles: {
      disponibleHabiles: formatearDiasParaDisplay(available),
      disponibleCalendario: formatearDiasParaDisplay(available * MOTOR_CONSTANTS.FACTOR_HABILES_CALENDARIO)
    },
    // Metadata
    base: balance.calculationBase || '365',
    tasaDiaria: balance.calculationBase === '360'
      ? formatearDiasParaDisplay(MOTOR_CONSTANTS.TASA_DIARIA_360)
      : formatearDiasParaDisplay(MOTOR_CONSTANTS.TASA_DIARIA_365)
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Función principal de causación
  calcularCausacion,

  // Función de saldo disponible
  saldoDisponible,

  // Validación de solicitudes (bloqueos)
  validarSolicitud,

  // State machine
  validarTransicionEstado,
  calcularImpactoSaldo,

  // Proyecciones
  calcularProyeccion,

  // Utilidades
  generarTablaCausacionMensual,

  // NUEVAS: Conversión días hábiles/calendario
  convertirHabilesACalendario,
  convertirCalendarioAHabiles,
  calcularDiasHabilesExactos,

  // NUEVA: Cambio de base con ADR
  calcularAjusteCambioBase,

  // NUEVAS: Formateo para display
  formatearDiasParaDisplay,
  obtenerResumenFormateado,

  // Constantes exportadas
  MOTOR_CONSTANTS,

  // Funciones internas para testing
  _internal: {
    floorDecimals,
    calcularDiasEntreFechas,
    calcularDiasSuspension
  }
};
