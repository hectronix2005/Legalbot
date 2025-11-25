/**
 * Servicio de Causación de Vacaciones - Legislación Colombiana
 *
 * Base legal:
 * - Código Sustantivo del Trabajo, Art. 186: 15 días hábiles por año de servicio
 * - Causación diaria: 15 días / 365 días = 0.04109589041095890 días por día trabajado
 * - En años bisiestos: 15 días / 366 días = 0.04098360655737705 días por día trabajado
 *
 * @module vacationAccrualService
 */

/**
 * Constantes de causación
 */
const VACATION_CONSTANTS = {
  DAYS_PER_YEAR: 15, // Días hábiles de vacaciones por año
  DAYS_IN_REGULAR_YEAR: 365,
  DAYS_IN_LEAP_YEAR: 366,
  REGULAR_DAILY_ACCRUAL: 15 / 365, // 0.04109589041095890
  LEAP_DAILY_ACCRUAL: 15 / 366,    // 0.04098360655737705
  DECIMAL_PRECISION: 4 // Precisión para días acumulados
};

/**
 * Determina si un año es bisiesto
 * @param {number} year - Año a evaluar
 * @returns {boolean} True si es año bisiesto
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Valida que una fecha sea válida y no sea futura
 * @param {Date} date - Fecha a validar
 * @param {string} fieldName - Nombre del campo para mensajes de error
 * @param {Date} maxDate - Fecha máxima permitida (opcional)
 * @returns {Object} { isValid, error }
 */
function validateDate(date, fieldName, maxDate = null) {
  // Validar que sea una fecha
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return {
      isValid: false,
      error: `${fieldName} debe ser una fecha válida`
    };
  }

  // Validar que no sea futura
  const now = new Date();
  now.setHours(23, 59, 59, 999); // Fin del día actual

  if (date > now) {
    return {
      isValid: false,
      error: `${fieldName} no puede ser una fecha futura`
    };
  }

  // Validar fecha máxima si se proporciona
  if (maxDate && date > maxDate) {
    return {
      isValid: false,
      error: `${fieldName} no puede ser posterior a ${maxDate.toISOString().split('T')[0]}`
    };
  }

  return { isValid: true, error: null };
}

/**
 * Calcula el número de días transcurridos entre dos fechas
 * @param {Date} startDate - Fecha inicial
 * @param {Date} endDate - Fecha final
 * @returns {number} Número de días completos transcurridos
 */
function calculateDaysDifference(startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const diffInMs = end - start;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return diffInDays;
}

/**
 * Calcula días de vacaciones considerando años bisiestos
 * @param {Date} hireDate - Fecha de contratación
 * @param {Date} currentDate - Fecha hasta la cual calcular
 * @returns {number} Días acumulados considerando años bisiestos
 */
function calculateWithLeapYears(hireDate, currentDate) {
  let accruedDays = 0;
  let currentYear = hireDate.getFullYear();
  const endYear = currentDate.getFullYear();

  let periodStart = new Date(hireDate);

  while (currentYear <= endYear) {
    // Determinar el final del período (fin de año o currentDate)
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    const periodEnd = currentYear === endYear ? currentDate : yearEnd;

    // Si el período de inicio es posterior al final, salir
    if (periodStart > periodEnd) {
      break;
    }

    // Calcular días en este período
    const daysInPeriod = calculateDaysDifference(periodStart, periodEnd);

    // Aplicar la tasa de causación según si es año bisiesto
    const dailyRate = isLeapYear(currentYear)
      ? VACATION_CONSTANTS.LEAP_DAILY_ACCRUAL
      : VACATION_CONSTANTS.REGULAR_DAILY_ACCRUAL;

    accruedDays += daysInPeriod * dailyRate;

    // Preparar para el siguiente año
    currentYear++;
    periodStart = new Date(currentYear, 0, 1);
  }

  return accruedDays;
}

/**
 * Calcula días de vacaciones acumulados desde contratación hasta fecha dada
 *
 * Función PURA sin efectos secundarios
 *
 * @param {Date} hireDate - Fecha de contratación del empleado
 * @param {Date} currentDate - Fecha hasta la cual calcular (default: hoy)
 * @returns {Object} Objeto con información de causación
 * @returns {number} return.accruedDays - Días de vacaciones acumulados (redondeado a 4 decimales)
 * @returns {number} return.daysWorked - Días completos trabajados
 * @returns {number} return.yearsOfService - Años de servicio (con decimales)
 * @returns {string|null} return.error - Mensaje de error si hay validación fallida
 *
 * @example
 * // Empleado contratado hace 1 año exacto
 * const result = calculateAccruedVacationDays(
 *   new Date('2024-01-01'),
 *   new Date('2025-01-01')
 * );
 * // result.accruedDays ≈ 15.0000
 * // result.daysWorked = 366 (año bisiesto 2024)
 * // result.yearsOfService = 1.0000
 */
function calculateAccruedVacationDays(hireDate, currentDate = new Date()) {
  // Normalizar fechas (crear nuevas instancias para no mutar)
  const hire = new Date(hireDate);
  const current = new Date(currentDate);

  // Validar hire_date
  const hireValidation = validateDate(hire, 'Fecha de contratación');
  if (!hireValidation.isValid) {
    return {
      accruedDays: 0,
      daysWorked: 0,
      yearsOfService: 0,
      error: hireValidation.error
    };
  }

  // Validar current_date
  const currentValidation = validateDate(current, 'Fecha actual');
  if (!currentValidation.isValid) {
    return {
      accruedDays: 0,
      daysWorked: 0,
      yearsOfService: 0,
      error: currentValidation.error
    };
  }

  // Validar que current_date no sea anterior a hire_date
  if (current < hire) {
    return {
      accruedDays: 0,
      daysWorked: 0,
      yearsOfService: 0,
      error: 'La fecha actual no puede ser anterior a la fecha de contratación'
    };
  }

  // Calcular días trabajados
  const daysWorked = calculateDaysDifference(hire, current);

  // Caso especial: 0 días trabajados
  if (daysWorked === 0) {
    return {
      accruedDays: 0,
      daysWorked: 0,
      yearsOfService: 0,
      error: null
    };
  }

  // Calcular años de servicio
  const yearsOfService = daysWorked / VACATION_CONSTANTS.DAYS_IN_REGULAR_YEAR;

  // Calcular días acumulados considerando años bisiestos
  const accruedDays = calculateWithLeapYears(hire, current);

  // Redondear a precisión especificada
  const roundedAccruedDays = Math.round(
    accruedDays * Math.pow(10, VACATION_CONSTANTS.DECIMAL_PRECISION)
  ) / Math.pow(10, VACATION_CONSTANTS.DECIMAL_PRECISION);

  const roundedYearsOfService = Math.round(
    yearsOfService * Math.pow(10, VACATION_CONSTANTS.DECIMAL_PRECISION)
  ) / Math.pow(10, VACATION_CONSTANTS.DECIMAL_PRECISION);

  return {
    accruedDays: roundedAccruedDays,
    daysWorked,
    yearsOfService: roundedYearsOfService,
    error: null
  };
}

/**
 * Valida si hay saldo disponible para una solicitud de vacaciones
 *
 * @param {number} accruedDays - Días acumulados totales
 * @param {number} enjoyedDays - Días ya disfrutados
 * @param {number} approvedPendingDays - Días aprobados pendientes de disfrutar
 * @param {number} requestedDays - Días solicitados en esta petición
 * @returns {Object} Resultado de validación
 * @returns {boolean} return.isValid - True si la solicitud es válida
 * @returns {number} return.availableDays - Días disponibles para solicitar
 * @returns {string} return.message - Mensaje descriptivo del resultado
 *
 * @example
 * // Validar solicitud con saldo suficiente
 * const result = validateVacationRequest(15.5, 5, 2, 7);
 * // result.isValid = true
 * // result.availableDays = 8.5
 * // result.message = "Solicitud válida. Días disponibles: 8.5000"
 */
function validateVacationRequest(accruedDays, enjoyedDays, approvedPendingDays, requestedDays) {
  // Validar que los parámetros sean números válidos
  const params = {
    accruedDays,
    enjoyedDays,
    approvedPendingDays,
    requestedDays
  };

  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        availableDays: 0,
        message: `El parámetro ${key} debe ser un número válido`
      };
    }

    if (value < 0) {
      return {
        isValid: false,
        availableDays: 0,
        message: `El parámetro ${key} no puede ser negativo`
      };
    }
  }

  // Validar que requestedDays sea mayor a 0
  if (requestedDays === 0) {
    return {
      isValid: false,
      availableDays: 0,
      message: 'Debe solicitar al menos 1 día de vacaciones'
    };
  }

  // Calcular días disponibles
  const availableDays = accruedDays - enjoyedDays - approvedPendingDays;

  // Redondear a 4 decimales
  const roundedAvailable = Math.round(
    availableDays * Math.pow(10, VACATION_CONSTANTS.DECIMAL_PRECISION)
  ) / Math.pow(10, VACATION_CONSTANTS.DECIMAL_PRECISION);

  // Detectar saldo negativo (error de datos)
  if (roundedAvailable < 0) {
    return {
      isValid: false,
      availableDays: roundedAvailable,
      message: `Error en los datos: saldo negativo detectado (${roundedAvailable.toFixed(4)} días). ` +
               `Verificar: acumulados=${accruedDays.toFixed(4)}, ` +
               `disfrutados=${enjoyedDays.toFixed(4)}, ` +
               `aprobados pendientes=${approvedPendingDays.toFixed(4)}`
    };
  }

  // Validar que haya saldo suficiente
  if (requestedDays > roundedAvailable) {
    return {
      isValid: false,
      availableDays: roundedAvailable,
      message: `Saldo insuficiente. Solicitados: ${requestedDays.toFixed(4)} días. ` +
               `Disponibles: ${roundedAvailable.toFixed(4)} días. ` +
               `Faltante: ${(requestedDays - roundedAvailable).toFixed(4)} días`
    };
  }

  // Solicitud válida
  return {
    isValid: true,
    availableDays: roundedAvailable,
    message: `Solicitud válida. Días disponibles: ${roundedAvailable.toFixed(4)}. ` +
             `Días restantes después de aprobación: ${(roundedAvailable - requestedDays).toFixed(4)}`
  };
}

/**
 * Calcula el detalle completo de causación de vacaciones
 * Incluye proyección de días que se acumularán hasta fin de año
 *
 * @param {Date} hireDate - Fecha de contratación
 * @param {number} enjoyedDays - Días ya disfrutados
 * @param {number} approvedPendingDays - Días aprobados pendientes
 * @param {Date} currentDate - Fecha de cálculo (default: hoy)
 * @returns {Object} Detalle completo de causación
 */
function getVacationAccrualDetail(hireDate, enjoyedDays = 0, approvedPendingDays = 0, currentDate = new Date()) {
  const accrualResult = calculateAccruedVacationDays(hireDate, currentDate);

  if (accrualResult.error) {
    return {
      error: accrualResult.error,
      detail: null
    };
  }

  // Calcular proyección hasta fin de año
  const endOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  const projectionResult = calculateAccruedVacationDays(hireDate, endOfYear);

  const availableDays = accrualResult.accruedDays - enjoyedDays - approvedPendingDays;

  return {
    error: null,
    detail: {
      hireDate: hireDate.toISOString().split('T')[0],
      currentDate: currentDate.toISOString().split('T')[0],
      daysWorked: accrualResult.daysWorked,
      yearsOfService: accrualResult.yearsOfService,
      accruedDays: accrualResult.accruedDays,
      enjoyedDays,
      approvedPendingDays,
      availableDays: Math.round(availableDays * 10000) / 10000,
      projection: {
        endOfYear: endOfYear.toISOString().split('T')[0],
        projectedAccruedDays: projectionResult.accruedDays,
        additionalDaysUntilEOY: Math.round(
          (projectionResult.accruedDays - accrualResult.accruedDays) * 10000
        ) / 10000
      }
    }
  };
}

module.exports = {
  calculateAccruedVacationDays,
  validateVacationRequest,
  getVacationAccrualDetail,
  // Exportar utilidades para testing
  _internal: {
    isLeapYear,
    validateDate,
    calculateDaysDifference,
    VACATION_CONSTANTS
  }
};
