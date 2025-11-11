/**
 * Servicio para analizar variables de plantillas y sugerir configuración
 * de campos para tipos de terceros
 */

// Mapeo de nombres comunes de variables a configuraciones de campos
const fieldMappings = {
  // Identificación
  'identificacion': {
    field_type: 'text',
    label: 'Identificación',
    category: 'identification'
  },
  'nit': {
    field_type: 'text',
    label: 'NIT',
    category: 'identification'
  },
  'cedula': {
    field_type: 'text',
    label: 'Cédula',
    category: 'identification'
  },
  'ruc': {
    field_type: 'text',
    label: 'RUC',
    category: 'identification'
  },
  'documento': {
    field_type: 'text',
    label: 'Documento de Identidad',
    category: 'identification'
  },

  // Nombres y razones sociales
  'nombre': {
    field_type: 'text',
    label: 'Nombre Completo',
    category: 'personal'
  },
  'nombre_completo': {
    field_type: 'text',
    label: 'Nombre Completo',
    category: 'personal'
  },
  'razon_social': {
    field_type: 'text',
    label: 'Razón Social',
    category: 'business'
  },
  'empresa': {
    field_type: 'text',
    label: 'Nombre de Empresa',
    category: 'business'
  },
  'nombre_empresa': {
    field_type: 'text',
    label: 'Nombre de Empresa',
    category: 'business'
  },

  // Representante legal
  'representante_legal': {
    field_type: 'text',
    label: 'Representante Legal',
    category: 'legal'
  },
  'nombre_representante': {
    field_type: 'text',
    label: 'Nombre del Representante',
    category: 'legal'
  },
  'cedula_representante': {
    field_type: 'text',
    label: 'Cédula del Representante',
    category: 'legal'
  },

  // Contacto
  'email': {
    field_type: 'email',
    label: 'Correo Electrónico',
    category: 'contact'
  },
  'correo': {
    field_type: 'email',
    label: 'Correo Electrónico',
    category: 'contact'
  },
  'telefono': {
    field_type: 'phone',
    label: 'Teléfono',
    category: 'contact'
  },
  'celular': {
    field_type: 'phone',
    label: 'Celular',
    category: 'contact'
  },
  'direccion': {
    field_type: 'text',
    label: 'Dirección',
    category: 'address'
  },
  'ciudad': {
    field_type: 'text',
    label: 'Ciudad',
    category: 'address'
  },
  'pais': {
    field_type: 'text',
    label: 'País',
    category: 'address'
  },

  // Información laboral/contractual
  'cargo': {
    field_type: 'text',
    label: 'Cargo',
    category: 'employment'
  },
  'salario': {
    field_type: 'number',
    label: 'Salario',
    category: 'employment'
  },
  'fecha_inicio': {
    field_type: 'date',
    label: 'Fecha de Inicio',
    category: 'dates'
  },
  'fecha_fin': {
    field_type: 'date',
    label: 'Fecha de Fin',
    category: 'dates'
  },
  'fecha_contratacion': {
    field_type: 'date',
    label: 'Fecha de Contratación',
    category: 'dates'
  },

  // Bancarios/financieros
  'cuenta_bancaria': {
    field_type: 'text',
    label: 'Cuenta Bancaria',
    category: 'financial'
  },
  'banco': {
    field_type: 'text',
    label: 'Banco',
    category: 'financial'
  },

  // Otros
  'descripcion': {
    field_type: 'textarea',
    label: 'Descripción',
    category: 'other'
  },
  'observaciones': {
    field_type: 'textarea',
    label: 'Observaciones',
    category: 'other'
  }
};

/**
 * Normaliza el nombre de una variable para búsqueda
 */
function normalizeVariableName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Sugiere configuración de campo basándose en el nombre de la variable
 */
function suggestFieldConfig(variableName, marker) {
  const normalized = normalizeVariableName(variableName);

  // Buscar coincidencia exacta
  if (fieldMappings[normalized]) {
    return {
      name: normalized,
      label: normalized, // Usar el field_name como label
      field_type: fieldMappings[normalized].field_type,
      category: fieldMappings[normalized].category,
      required: false, // Por defecto no obligatorio, admin decide
      excluded: false, // Por defecto incluido
      original_marker: marker,
      display_order: 0
    };
  }

  // Buscar coincidencias parciales
  for (const [key, config] of Object.entries(fieldMappings)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        name: normalized,
        label: normalized, // Usar el field_name como label
        field_type: config.field_type,
        category: config.category,
        required: false,
        excluded: false,
        original_marker: marker,
        display_order: 0
      };
    }
  }

  // Si no hay coincidencia, usar configuración genérica
  return {
    name: normalized,
    label: normalized, // Usar el field_name como label
    field_type: 'text',
    category: 'other',
    required: false,
    excluded: false,
    original_marker: marker,
    display_order: 0
  };
}

/**
 * Analiza las variables de una plantilla y sugiere configuración de campos
 */
function analyzeTemplateVariables(fields) {
  if (!fields || !Array.isArray(fields)) {
    return {
      suggested: [],
      categories: {}
    };
  }

  const suggested = [];
  const categories = {};

  fields.forEach((field, index) => {
    const fieldName = field.field_name || field.original_marker || `field_${index}`;
    const marker = field.original_marker || fieldName;

    const config = suggestFieldConfig(fieldName, marker);
    config.display_order = index;

    suggested.push(config);

    // Agrupar por categoría
    if (!categories[config.category]) {
      categories[config.category] = [];
    }
    categories[config.category].push(config);
  });

  return {
    suggested,
    categories,
    stats: {
      total: suggested.length,
      by_category: Object.keys(categories).reduce((acc, cat) => {
        acc[cat] = categories[cat].length;
        return acc;
      }, {})
    }
  };
}

/**
 * Genera recomendaciones de campos obligatorios basándose en el tipo de tercero
 */
function getRecommendedRequired(thirdPartyType) {
  const recommendations = {
    'proveedor': ['nit', 'razon_social', 'representante_legal', 'direccion'],
    'cliente': ['nit', 'razon_social', 'email', 'telefono'],
    'empleado': ['cedula', 'nombre_completo', 'cargo', 'fecha_inicio'],
    'arrendador': ['identificacion', 'nombre', 'direccion'],
    'arrendatario': ['identificacion', 'nombre', 'direccion'],
    'contratista': ['nit', 'razon_social', 'email', 'telefono'],
    'otro': []
  };

  return recommendations[thirdPartyType] || [];
}

/**
 * Genera recomendaciones de campos a excluir basándose en el tipo de tercero
 */
function getRecommendedExcluded(thirdPartyType) {
  const recommendations = {
    'proveedor': [],
    'cliente': ['salario', 'fecha_contratacion'],
    'empleado': [],
    'arrendador': ['salario', 'cargo'],
    'arrendatario': ['salario', 'cargo'],
    'contratista': ['salario'],
    'otro': []
  };

  return recommendations[thirdPartyType] || [];
}

/**
 * Aplica recomendaciones a la configuración sugerida
 */
function applyRecommendations(suggestedFields, thirdPartyType) {
  const recommendedRequired = getRecommendedRequired(thirdPartyType);
  const recommendedExcluded = getRecommendedExcluded(thirdPartyType);

  return suggestedFields.map(field => {
    const shouldBeRequired = recommendedRequired.some(req =>
      field.name.includes(req) || req.includes(field.name)
    );

    const shouldBeExcluded = recommendedExcluded.some(exc =>
      field.name.includes(exc) || exc.includes(field.name)
    );

    return {
      ...field,
      required: shouldBeRequired,
      excluded: shouldBeExcluded,
      recommended: shouldBeRequired ? 'required' : (shouldBeExcluded ? 'excluded' : null)
    };
  });
}

module.exports = {
  analyzeTemplateVariables,
  suggestFieldConfig,
  applyRecommendations,
  normalizeVariableName
};
