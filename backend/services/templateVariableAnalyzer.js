/**
 * Servicio de Análisis de Variables de Plantilla
 *
 * Analiza el contenido de una plantilla para:
 * 1. Extraer todas las variables {{variable}}
 * 2. Detectar roles automáticamente basándose en prefijos (arrendador_, contratista_, etc.)
 * 3. Agrupar variables por rol
 * 4. Sugerir mapeos a campos estándar de terceros
 * 5. Identificar campos requeridos vs opcionales
 */

const ContractTemplate = require('../models/ContractTemplate');

class TemplateVariableAnalyzer {
  constructor() {
    // Mapeo de prefijos comunes a roles
    this.rolePatterns = {
      arrendador: ['arrendador', 'landlord', 'propietario', 'lessor'],
      arrendatario: ['arrendatario', 'tenant', 'inquilino', 'lessee'],
      contratista: ['contratista', 'contractor', 'proveedor_servicio'],
      cliente: ['cliente', 'client', 'comprador', 'buyer'],
      empleado: ['empleado', 'employee', 'trabajador', 'worker'],
      empleador: ['empleador', 'employer', 'empresa', 'company'],
      proveedor: ['proveedor', 'supplier', 'vendedor', 'seller'],
      comprador: ['comprador', 'buyer', 'adquirente'],
      vendedor: ['vendedor', 'seller', 'enajenante'],
      contratante: ['contratante', 'contracting_party'],
      contratado: ['contratado', 'contracted_party'],
      prestador: ['prestador', 'service_provider'],
      beneficiario: ['beneficiario', 'beneficiary'],
      garante: ['garante', 'guarantor', 'fiador'],
      testigo: ['testigo', 'witness']
    };

    // Mapeo de sufijos de variables a campos estándar
    this.fieldMappings = {
      nombre: 'legal_name',
      name: 'legal_name',
      razon_social: 'legal_name',
      cedula: 'identification_number',
      nit: 'identification_number',
      rut: 'identification_number',
      documento: 'identification_number',
      identification: 'identification_number',
      email: 'email',
      correo: 'email',
      telefono: 'phone',
      phone: 'phone',
      tel: 'phone',
      direccion: 'address',
      address: 'address',
      ciudad: 'city',
      city: 'city'
    };
  }

  /**
   * Extrae todas las variables de una plantilla
   * @param {string} content - Contenido de la plantilla
   * @returns {Array<string>} - Array de variables (con {{ }})
   */
  extractVariables(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    // Regex para capturar {{variable}} incluso con espacios
    const regex = /\{\{\s*([a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+)\s*\}\}/g;
    const matches = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const variable = `{{${match[1].trim()}}}`;
      if (!matches.includes(variable)) {
        matches.push(variable);
      }
    }

    return matches;
  }

  /**
   * Normaliza el nombre de una variable
   * @param {string} variable - Variable con o sin {{ }}
   * @returns {string} - Variable normalizada (sin {{ }}, lowercase, trim)
   */
  normalizeVariable(variable) {
    return variable
      .replace(/[{}]/g, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Detecta el rol de una variable basándose en su prefijo
   * @param {string} variable - Variable normalizada
   * @returns {string|null} - Rol detectado o null
   */
  detectRole(variable) {
    const varLower = variable.toLowerCase();

    for (const [role, patterns] of Object.entries(this.rolePatterns)) {
      for (const pattern of patterns) {
        if (varLower.startsWith(pattern + '_') || varLower === pattern) {
          return role;
        }
      }
    }

    return null;
  }

  /**
   * Extrae el sufijo de campo de una variable
   * Ejemplo: "arrendador_nombre" → "nombre"
   * @param {string} variable - Variable normalizada
   * @param {string} role - Rol detectado
   * @returns {string} - Sufijo del campo
   */
  extractFieldSuffix(variable, role) {
    const varLower = variable.toLowerCase();

    // Buscar patrón que coincida con el rol
    const patterns = this.rolePatterns[role] || [];

    for (const pattern of patterns) {
      if (varLower.startsWith(pattern + '_')) {
        return varLower.substring(pattern.length + 1);
      }
    }

    // Si no encontramos patrón, retornar la variable completa
    return varLower;
  }

  /**
   * Sugiere un mapeo a campo estándar
   * @param {string} fieldSuffix - Sufijo del campo
   * @returns {string|null} - Campo estándar sugerido o null
   */
  suggestStandardField(fieldSuffix) {
    return this.fieldMappings[fieldSuffix] || null;
  }

  /**
   * Analiza una plantilla completa
   * @param {Object} template - Objeto de plantilla de MongoDB
   * @returns {Object} - Análisis completo
   */
  async analyzeTemplate(templateId) {
    try {
      const template = await ContractTemplate.findById(templateId);

      if (!template) {
        throw new Error('Plantilla no encontrada');
      }

      return this.analyzeContent(template.content, template);
    } catch (error) {
      console.error('❌ [TemplateVariableAnalyzer] Error analyzing template:', error);
      throw error;
    }
  }

  /**
   * Analiza el contenido de una plantilla
   * @param {string} content - Contenido de la plantilla
   * @param {Object} templateMeta - Metadata de la plantilla (opcional)
   * @returns {Object} - Análisis completo
   */
  analyzeContent(content, templateMeta = {}) {
    // Extraer todas las variables
    const allVariables = this.extractVariables(content);

    // Agrupar variables por rol
    const roleGroups = {};
    const unclassifiedVariables = [];
    const variableDetails = [];

    allVariables.forEach(variable => {
      const normalized = this.normalizeVariable(variable);
      const role = this.detectRole(normalized);

      const details = {
        original: variable,
        normalized: normalized,
        role: role
      };

      if (role) {
        if (!roleGroups[role]) {
          roleGroups[role] = {
            role: role,
            role_label: this.formatRoleLabel(role),
            variables: [],
            suggested_mappings: []
          };
        }

        const fieldSuffix = this.extractFieldSuffix(normalized, role);
        const standardField = this.suggestStandardField(fieldSuffix);

        details.field_suffix = fieldSuffix;
        details.standard_field = standardField;

        roleGroups[role].variables.push(variable);

        if (standardField) {
          roleGroups[role].suggested_mappings.push({
            template_variable: variable,
            field_suffix: fieldSuffix,
            suggested_source_field: standardField,
            confidence: this.calculateMappingConfidence(fieldSuffix, standardField)
          });
        }
      } else {
        unclassifiedVariables.push(variable);
      }

      variableDetails.push(details);
    });

    // Análisis de completitud
    const rolesDetected = Object.keys(roleGroups);
    const totalVariables = allVariables.length;
    const classifiedVariables = totalVariables - unclassifiedVariables.length;
    const classificationRate = totalVariables > 0
      ? Math.round((classifiedVariables / totalVariables) * 100)
      : 0;

    return {
      template_id: templateMeta._id,
      template_name: templateMeta.name,
      template_category: templateMeta.category,
      analysis_date: new Date(),
      total_variables: totalVariables,
      all_variables: allVariables,
      variable_details: variableDetails,
      roles_detected: rolesDetected,
      roles_count: rolesDetected.length,
      role_groups: Object.values(roleGroups),
      unclassified_variables: unclassifiedVariables,
      classification_rate: classificationRate,
      suggested_third_party_count: rolesDetected.length,
      recommendations: this.generateRecommendations(roleGroups, unclassifiedVariables)
    };
  }

  /**
   * Formatea el label de un rol para mostrar
   * @param {string} role - Código del rol
   * @returns {string} - Label formateado
   */
  formatRoleLabel(role) {
    const labels = {
      arrendador: 'Arrendador (Propietario)',
      arrendatario: 'Arrendatario (Inquilino)',
      contratista: 'Contratista',
      cliente: 'Cliente',
      empleado: 'Empleado',
      empleador: 'Empleador',
      proveedor: 'Proveedor',
      comprador: 'Comprador',
      vendedor: 'Vendedor',
      contratante: 'Contratante',
      contratado: 'Contratado',
      prestador: 'Prestador de Servicio',
      beneficiario: 'Beneficiario',
      garante: 'Garante/Fiador',
      testigo: 'Testigo'
    };

    return labels[role] || role.charAt(0).toUpperCase() + role.slice(1);
  }

  /**
   * Calcula la confianza de un mapeo sugerido
   * @param {string} fieldSuffix - Sufijo del campo
   * @param {string} standardField - Campo estándar sugerido
   * @returns {number} - Confianza (0-1)
   */
  calculateMappingConfidence(fieldSuffix, standardField) {
    // Mapeos exactos tienen confianza 1.0
    const exactMatches = {
      nombre: 'legal_name',
      cedula: 'identification_number',
      email: 'email',
      telefono: 'phone',
      direccion: 'address'
    };

    if (exactMatches[fieldSuffix] === standardField) {
      return 1.0;
    }

    // Mapeos similares tienen confianza 0.8
    const similarMatches = {
      name: 'legal_name',
      nit: 'identification_number',
      tel: 'phone',
      correo: 'email'
    };

    if (similarMatches[fieldSuffix] === standardField) {
      return 0.8;
    }

    // Otros mapeos tienen confianza 0.6
    return 0.6;
  }

  /**
   * Genera recomendaciones basadas en el análisis
   * @param {Object} roleGroups - Grupos de roles
   * @param {Array} unclassifiedVariables - Variables sin clasificar
   * @returns {Array} - Array de recomendaciones
   */
  generateRecommendations(roleGroups, unclassifiedVariables) {
    const recommendations = [];

    // Recomendación para crear perfiles
    const rolesCount = Object.keys(roleGroups).length;
    if (rolesCount > 0) {
      recommendations.push({
        type: 'profile_creation',
        priority: 'high',
        message: `Se recomienda crear perfiles de tercero para ${rolesCount} rol(es) detectado(s)`,
        details: Object.keys(roleGroups).map(role => ({
          role: role,
          role_label: this.formatRoleLabel(role),
          variables_count: roleGroups[role].variables.length
        }))
      });
    }

    // Recomendación para variables sin clasificar
    if (unclassifiedVariables.length > 0) {
      recommendations.push({
        type: 'unclassified_variables',
        priority: 'medium',
        message: `Hay ${unclassifiedVariables.length} variable(s) sin rol identificado`,
        details: unclassifiedVariables,
        suggestion: 'Considere usar prefijos estándar (ej: arrendador_, cliente_, empleado_) para mejor clasificación'
      });
    }

    // Recomendación para mapeos automáticos
    Object.values(roleGroups).forEach(group => {
      const autoMappableCount = group.suggested_mappings.filter(m => m.confidence >= 0.8).length;
      if (autoMappableCount > 0) {
        recommendations.push({
          type: 'auto_fill_available',
          priority: 'info',
          message: `${autoMappableCount} campo(s) de '${group.role_label}' pueden auto-llenarse desde datos base`,
          role: group.role
        });
      }
    });

    return recommendations;
  }

  /**
   * Genera estructura de perfil inicial para un rol detectado
   * @param {Object} roleGroup - Grupo de rol del análisis
   * @param {Object} supplierData - Datos del tercero base
   * @returns {Object} - Estructura de perfil inicial
   */
  generateProfileStructure(roleGroup, supplierData = {}) {
    const fieldMappings = [];
    const templateSpecificFields = {};

    roleGroup.suggested_mappings.forEach(mapping => {
      const sourceValue = this.extractValueFromSupplier(
        supplierData,
        mapping.suggested_source_field
      );

      fieldMappings.push({
        template_variable: mapping.template_variable,
        source_field: mapping.suggested_source_field,
        value: sourceValue || '',
        is_auto_filled: sourceValue !== null && sourceValue !== undefined
      });

      const fieldName = mapping.template_variable.replace(/[{}]/g, '');
      templateSpecificFields[fieldName] = sourceValue || '';
    });

    // Agregar variables sin mapeo sugerido
    roleGroup.variables.forEach(variable => {
      const hasMapping = fieldMappings.some(m => m.template_variable === variable);
      if (!hasMapping) {
        fieldMappings.push({
          template_variable: variable,
          source_field: null,
          value: '',
          is_auto_filled: false
        });

        const fieldName = variable.replace(/[{}]/g, '');
        templateSpecificFields[fieldName] = '';
      }
    });

    return {
      role_in_template: roleGroup.role,
      role_label: roleGroup.role_label,
      field_mappings: fieldMappings,
      template_specific_fields: templateSpecificFields
    };
  }

  /**
   * Extrae el valor de un campo del supplier
   * @param {Object} supplierData - Datos del tercero
   * @param {string} fieldName - Nombre del campo
   * @returns {*} - Valor del campo o null
   */
  extractValueFromSupplier(supplierData, fieldName) {
    if (!supplierData) return null;

    // Intentar extraer del objeto directo
    if (supplierData[fieldName]) {
      return supplierData[fieldName];
    }

    // Intentar de custom_fields
    if (supplierData.custom_fields && supplierData.custom_fields[fieldName]) {
      return supplierData.custom_fields[fieldName];
    }

    return null;
  }
}

// Singleton
const analyzer = new TemplateVariableAnalyzer();

module.exports = analyzer;
