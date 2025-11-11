/**
 * Configuración centralizada de tipos de terceros
 * Esta configuración se usa en todo el sistema para mantener consistencia
 * Tipos de terceros disponibles en el sistema
 */

// Lista oficial de tipos de identificación (misma que en Supplier model)
const IDENTIFICATION_TYPES = ['NIT', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'];
const IDENTIFICATION_TYPES_PERSON = ['CC', 'CE', 'Pasaporte', 'Otro']; // Para personas naturales
const IDENTIFICATION_TYPES_REP_LEGAL = ['CC', 'CE', 'Pasaporte']; // Para representantes legales

const THIRD_PARTY_TYPES = {
  proveedor: {
    label: 'Proveedor',
    description: 'Persona o empresa que provee bienes o servicios',
    icon: '📦',
    expectedFields: [
      { name: 'razon_social', label: 'razon_social', type: 'text', required: true },
      { name: 'razon_social_corta', label: 'razon_social_corta', type: 'text', required: false },
      { name: 'tipo_identificacion', label: 'tipo_identificacion', type: 'select', options: IDENTIFICATION_TYPES, required: true },
      { name: 'numero_identificacion', label: 'numero_identificacion', type: 'text', required: true },
      { name: 'representante_legal', label: 'representante_legal', type: 'text', required: true },
      { name: 'tipo_id_representante', label: 'tipo_id_representante', type: 'select', options: IDENTIFICATION_TYPES_REP_LEGAL, required: true },
      { name: 'numero_id_representante', label: 'numero_id_representante', type: 'text', required: true },
      { name: 'direccion', label: 'direccion', type: 'text', required: false },
      { name: 'ciudad', label: 'ciudad', type: 'text', required: false },
      { name: 'pais', label: 'pais', type: 'text', required: false },
      { name: 'email', label: 'email', type: 'email', required: false },
      { name: 'telefono', label: 'telefono', type: 'text', required: false },
      { name: 'licenciatario', label: 'licenciatario', type: 'text', required: false } // Para PH
    ]
  },

  cliente: {
    label: 'Cliente',
    description: 'Persona o empresa que compra bienes o servicios',
    icon: '👤',
    expectedFields: [
      { name: 'razon_social', label: 'razon_social', type: 'text', required: true },
      { name: 'tipo_identificacion', label: 'tipo_identificacion', type: 'select', options: IDENTIFICATION_TYPES, required: true },
      { name: 'numero_identificacion', label: 'numero_identificacion', type: 'text', required: true },
      { name: 'representante_legal', label: 'representante_legal', type: 'text', required: false },
      { name: 'direccion', label: 'direccion', type: 'text', required: false },
      { name: 'ciudad', label: 'ciudad', type: 'text', required: false },
      { name: 'pais', label: 'pais', type: 'text', required: false },
      { name: 'email', label: 'email', type: 'email', required: true },
      { name: 'telefono', label: 'telefono', type: 'text', required: false }
    ]
  },

  empleado: {
    label: 'Empleado',
    description: 'Persona con relación laboral directa',
    icon: '👔',
    expectedFields: [
      { name: 'nombre_completo', label: 'nombre_completo', type: 'text', required: true },
      { name: 'tipo_identificacion', label: 'tipo_identificacion', type: 'select', options: IDENTIFICATION_TYPES_PERSON, required: true },
      { name: 'numero_identificacion', label: 'numero_identificacion', type: 'text', required: true },
      { name: 'fecha_nacimiento', label: 'fecha_nacimiento', type: 'date', required: false },
      { name: 'cargo', label: 'cargo', type: 'text', required: true },
      { name: 'direccion', label: 'direccion', type: 'text', required: true },
      { name: 'ciudad', label: 'ciudad', type: 'text', required: true },
      { name: 'email', label: 'email', type: 'email', required: true },
      { name: 'telefono', label: 'telefono', type: 'text', required: true },
      { name: 'eps', label: 'eps', type: 'text', required: false },
      { name: 'afp', label: 'afp', type: 'text', required: false },
      { name: 'salario', label: 'salario', type: 'number', required: false }
    ]
  },

  arrendador: {
    label: 'Arrendador',
    description: 'Propietario del inmueble o bien en arrendamiento',
    icon: '🏠',
    expectedFields: [
      { name: 'nombre_completo', label: 'nombre_completo', type: 'text', required: true },
      { name: 'tipo_identificacion', label: 'tipo_identificacion', type: 'select', options: IDENTIFICATION_TYPES, required: true },
      { name: 'numero_identificacion', label: 'numero_identificacion', type: 'text', required: true },
      { name: 'direccion', label: 'direccion', type: 'text', required: true },
      { name: 'ciudad', label: 'ciudad', type: 'text', required: true },
      { name: 'email', label: 'email', type: 'email', required: true },
      { name: 'telefono', label: 'telefono', type: 'text', required: true },
      { name: 'banco', label: 'banco', type: 'text', required: false },
      { name: 'cuenta_bancaria', label: 'cuenta_bancaria', type: 'text', required: false },
      { name: 'tipo_cuenta', label: 'tipo_cuenta', type: 'select', options: ['Ahorros', 'Corriente'], required: false }
    ]
  },

  arrendatario: {
    label: 'Arrendatario',
    description: 'Persona que toma en arriendo un inmueble o bien',
    icon: '🔑',
    expectedFields: [
      { name: 'nombre_completo', label: 'nombre_completo', type: 'text', required: true },
      { name: 'tipo_identificacion', label: 'tipo_identificacion', type: 'select', options: IDENTIFICATION_TYPES, required: true },
      { name: 'numero_identificacion', label: 'numero_identificacion', type: 'text', required: true },
      { name: 'direccion_actual', label: 'direccion_actual', type: 'text', required: true },
      { name: 'ciudad', label: 'ciudad', type: 'text', required: true },
      { name: 'email', label: 'email', type: 'email', required: true },
      { name: 'telefono', label: 'telefono', type: 'text', required: true },
      { name: 'ocupacion', label: 'ocupacion', type: 'text', required: false },
      { name: 'empresa_trabajo', label: 'empresa_trabajo', type: 'text', required: false },
      { name: 'referencias', label: 'referencias', type: 'textarea', required: false }
    ]
  },

  contratista: {
    label: 'Contratista',
    description: 'Persona natural que presta servicios profesionales de forma independiente',
    icon: '💼',
    expectedFields: [
      { name: 'nombre_completo', label: 'nombre_completo', type: 'text', required: true },
      { name: 'tipo_identificacion', label: 'tipo_identificacion', type: 'select', options: IDENTIFICATION_TYPES_PERSON, required: true },
      { name: 'numero_identificacion', label: 'numero_identificacion', type: 'text', required: true },
      { name: 'profesion', label: 'profesion', type: 'text', required: true },
      { name: 'direccion', label: 'direccion', type: 'text', required: true },
      { name: 'ciudad', label: 'ciudad', type: 'text', required: true },
      { name: 'email', label: 'email', type: 'email', required: true },
      { name: 'telefono', label: 'telefono', type: 'text', required: true },
      { name: 'rut', label: 'rut', type: 'text', required: false },
      { name: 'eps', label: 'eps', type: 'text', required: false },
      { name: 'arl', label: 'arl', type: 'text', required: false }
    ]
  },

  otro: {
    label: 'Otro',
    description: 'Tipo de tercero genérico o no especificado',
    icon: '📄',
    expectedFields: [
      { name: 'nombre', label: 'nombre', type: 'text', required: true },
      { name: 'tipo_identificacion', label: 'tipo_identificacion', type: 'select', options: IDENTIFICATION_TYPES, required: true },
      { name: 'identificacion', label: 'identificacion', type: 'text', required: true },
      { name: 'direccion', label: 'direccion', type: 'text', required: false },
      { name: 'email', label: 'email', type: 'email', required: false },
      { name: 'telefono', label: 'telefono', type: 'text', required: false }
    ]
  }
};

/**
 * Obtiene la configuración de un tipo de tercero
 */
function getThirdPartyConfig(type) {
  return THIRD_PARTY_TYPES[type] || THIRD_PARTY_TYPES.otro;
}

/**
 * Obtiene todos los tipos de terceros disponibles
 */
function getAllThirdPartyTypes() {
  return Object.keys(THIRD_PARTY_TYPES).map(key => ({
    value: key,
    label: THIRD_PARTY_TYPES[key].label,
    description: THIRD_PARTY_TYPES[key].description,
    icon: THIRD_PARTY_TYPES[key].icon
  }));
}

/**
 * Sugiere un tipo de campo basado en el nombre de la variable detectada
 */
function suggestFieldType(fieldName, thirdPartyType) {
  const config = getThirdPartyConfig(thirdPartyType);
  const normalizedFieldName = fieldName.toLowerCase().replace(/[_\s]/g, '');

  // Buscar coincidencia en los campos esperados
  for (const expectedField of config.expectedFields) {
    const normalizedExpectedName = expectedField.name.toLowerCase().replace(/[_\s]/g, '');
    if (normalizedFieldName.includes(normalizedExpectedName) || normalizedExpectedName.includes(normalizedFieldName)) {
      return expectedField;
    }
  }

  // Sugerencias genéricas basadas en patrones comunes
  if (/(fecha|date|inicio|fin|termino)/i.test(fieldName)) return { type: 'date' };
  if (/(email|correo|mail)/i.test(fieldName)) return { type: 'email' };
  if (/(telefono|phone|celular|movil)/i.test(fieldName)) return { type: 'text' };
  if (/(numero|cantidad|valor|precio|salario|monto)/i.test(fieldName)) return { type: 'number' };
  if (/(descripcion|observaciones|notas|comentarios)/i.test(fieldName)) return { type: 'textarea' };

  return { type: 'text' }; // Por defecto
}

module.exports = {
  THIRD_PARTY_TYPES,
  IDENTIFICATION_TYPES,
  IDENTIFICATION_TYPES_PERSON,
  IDENTIFICATION_TYPES_REP_LEGAL,
  getThirdPartyConfig,
  getAllThirdPartyTypes,
  suggestFieldType
};
