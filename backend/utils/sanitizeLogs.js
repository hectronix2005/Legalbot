/**
 * Utilidades para sanitización de PII en logs
 * Cumplimiento GDPR/CCPA - No loguear datos personales
 */

/**
 * Lista de campos que contienen PII y deben ser redactados
 */
const PII_FIELDS = [
  'password',
  'email',
  'full_name',
  'legal_name',
  'legal_representative_name',
  'licensee_name',
  'identification_number',
  'legal_representative_id_number',
  'cedula',
  'documento',
  'phone',
  'address',
  'nombre',
  'nombre_completo',
  'nombre_del_trabajador',
  'nombre_del_empleado',
  'numero_de_cedula',
  'numero_cedula',
  'numero_documento',
  'direccion',
  'telefono',
  'correo'
];

/**
 * Sanitiza un objeto redactando campos PII
 * @param {Object} data - Objeto a sanitizar
 * @param {Array<string>} additionalFields - Campos adicionales a redactar
 * @returns {Object} Objeto sanitizado (copia)
 */
function sanitizeForLogging(data, additionalFields = []) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Crear copia profunda para no modificar original
  const sanitized = JSON.parse(JSON.stringify(data));
  const fieldsToRedact = [...PII_FIELDS, ...additionalFields];

  // Función recursiva para sanitizar objetos anidados
  function redactFields(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Recorrer todas las propiedades
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();

        // Si la clave está en la lista de PII, redactar
        if (fieldsToRedact.some(field => lowerKey.includes(field.toLowerCase()))) {
          const value = obj[key];
          if (typeof value === 'string') {
            // Redactar manteniendo longitud aproximada
            obj[key] = value.length > 0 ? `[REDACTED-${value.length}chars]` : '[REDACTED]';
          } else if (typeof value === 'number') {
            obj[key] = '[REDACTED-NUMBER]';
          } else {
            obj[key] = '[REDACTED]';
          }
        } else if (typeof obj[key] === 'object') {
          // Recursión para objetos anidados
          redactFields(obj[key]);
        }
      }
    }

    return obj;
  }

  return redactFields(sanitized);
}

/**
 * Sanitiza información de usuario para logs
 * Solo mantiene: id, role, companyId
 * @param {Object} user - Objeto de usuario
 * @returns {Object} Usuario sanitizado
 */
function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id || user._id?.toString(),
    role: user.role,
    companyId: user.companyId?.toString() || user.company?.toString()
  };
}

/**
 * Sanitiza request body para logs
 * Redacta PII pero mantiene estructura
 * @param {Object} body - Request body
 * @returns {Object} Body sanitizado
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = sanitizeForLogging(body);

  // Agregar metadata útil sin PII
  return {
    ...sanitized,
    _meta: {
      fieldCount: Object.keys(body).length,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Genera mensaje de log seguro con contexto
 * @param {string} message - Mensaje base
 * @param {Object} context - Contexto adicional
 * @returns {string} Mensaje formateado
 */
function safeLogMessage(message, context = {}) {
  const sanitizedContext = sanitizeForLogging(context);
  return `${message} | Context: ${JSON.stringify(sanitizedContext)}`;
}

module.exports = {
  sanitizeForLogging,
  sanitizeUser,
  sanitizeRequestBody,
  safeLogMessage,
  PII_FIELDS
};
