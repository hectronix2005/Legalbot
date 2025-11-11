const mammoth = require('mammoth');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');

/**
 * Normaliza el nombre de un campo para evitar duplicados
 * Elimina acentos, convierte a minúsculas y remueve separadores
 * @param {string} fieldName - Nombre del campo a normalizar
 * @returns {string} - Nombre normalizado (sin separadores, para comparación)
 */
function normalizeFieldName(fieldName) {
  return fieldName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .toLowerCase()
    .replace(/[_\s\/\-]+/g, '') // Remover espacios, guiones bajos, barras y guiones
    .replace(/de/g, '') // Remover "de"
    .replace(/del/g, '') // Remover "del"
    .replace(/la/g, '') // Remover "la"
    .replace(/el/g, ''); // Remover "el"
}

/**
 * Convierte el nombre de un campo al formato snake_case para usar como field_name
 * Mantiene la estructura legible con guiones bajos entre palabras
 * @param {string} fieldName - Nombre del campo original
 * @returns {string} - Nombre en formato snake_case
 */
function toSnakeCase(fieldName) {
  return fieldName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .toLowerCase()
    .replace(/[\/\-]+/g, '_') // Convertir barras y guiones a underscores
    .replace(/\s+/g, '_') // Convertir espacios a underscores
    .replace(/_+/g, '_') // Reemplazar múltiples underscores por uno solo
    .replace(/^_|_$/g, ''); // Remover underscores al inicio y final
}

/**
 * Procesa un archivo Word y extrae campos resaltados en amarillo
 * @param {Buffer} fileBuffer - Buffer del archivo Word
 * @returns {Promise<Object>} - Objeto con contenido y campos detectados
 */
async function extractYellowHighlightedFields(fileBuffer) {
  try {
    // Usar mammoth para extraer el contenido con información de formato
    const result = await mammoth.convertToHtml(
      { buffer: fileBuffer },
      {
        styleMap: [
          "p[style-name='Highlight'] => span.highlight",
        ]
      }
    );

    const html = result.value;
    const messages = result.messages;

    // Buscar texto entre {{ }} que es común en plantillas
    const templateVarRegex = /\{\{([^}]+)\}\}/g;
    const fields = [];
    const normalizedFieldNames = new Map(); // Mapeo de nombre normalizado -> nombre original

    let match;
    while ((match = templateVarRegex.exec(html)) !== null) {
      const marker = match[1].trim(); // Texto original del marcador
      const normalized = normalizeFieldName(marker);

      // Solo agregar si no existe un campo con el mismo nombre normalizado
      if (!normalizedFieldNames.has(normalized)) {
        normalizedFieldNames.set(normalized, marker);

        // Generar field_name en formato snake_case
        const fieldName = toSnakeCase(marker);

        // Usar el marker original como field_label sin transformaciones
        const fieldLabel = marker;

        fields.push({
          marker: marker,
          field_name: fieldName,
          field_label: fieldLabel,
          field_type: detectFieldType(marker),
          required: true,
          display_order: fields.length
        });

        console.log(`✅ Campo agregado: marker="${marker}", field_name="${fieldName}", field_label="${fieldLabel}"`);
      } else {
        console.log(`⚠️  Campo duplicado omitido: "${marker}" (ya existe como "${normalizedFieldNames.get(normalized)}")`);
      }
    }

    // Buscar también campos en formato Word (MERGEFIELD)
    const mergeFieldRegex = /MERGEFIELD\s+([^\s\\]+)/gi;
    while ((match = mergeFieldRegex.exec(html)) !== null) {
      const marker = match[1].trim(); // Texto original del MERGEFIELD
      const normalized = normalizeFieldName(marker);

      if (!normalizedFieldNames.has(normalized)) {
        normalizedFieldNames.set(normalized, marker);

        // Generar field_name en formato snake_case
        const fieldName = toSnakeCase(marker);

        // Usar el marker original como field_label sin transformaciones
        const fieldLabel = marker;

        fields.push({
          marker: marker,
          field_name: fieldName,
          field_label: fieldLabel,
          field_type: detectFieldType(marker),
          required: true,
          display_order: fields.length
        });

        console.log(`✅ MERGEFIELD agregado: marker="${marker}", field_name="${fieldName}", field_label="${fieldLabel}"`);
      } else {
        console.log(`⚠️  MERGEFIELD duplicado omitido: "${marker}" (ya existe como "${normalizedFieldNames.get(normalized)}")`);
      }
    }

    console.log(`📊 Total de campos únicos extraídos: ${fields.length}`);

    return {
      content: html,
      fields: fields,
      messages: messages
    };
  } catch (error) {
    console.error('Error al procesar archivo Word:', error);
    throw new Error('Error al procesar el archivo Word');
  }
}

/**
 * Detecta el tipo de campo basado en el nombre
 * @param {string} fieldName - Nombre del campo
 * @returns {string} - Tipo de campo
 */
function detectFieldType(fieldName) {
  const lowerName = fieldName.toLowerCase();
  
  if (lowerName.includes('email') || lowerName.includes('correo')) {
    return 'email';
  }
  if (lowerName.includes('fecha') || lowerName.includes('date')) {
    return 'date';
  }
  if (lowerName.includes('monto') || lowerName.includes('precio') || 
      lowerName.includes('cantidad') || lowerName.includes('numero') ||
      lowerName.includes('amount') || lowerName.includes('price')) {
    return 'number';
  }
  if (lowerName.includes('descripcion') || lowerName.includes('observacion') ||
      lowerName.includes('notas') || lowerName.includes('comentario') ||
      lowerName.includes('description') || lowerName.includes('notes')) {
    return 'textarea';
  }
  if (lowerName.includes('tipo') || lowerName.includes('categoria') ||
      lowerName.includes('tipo_documento')) {
    return 'select';
  }
  
  return 'text'; // Por defecto
}

/**
 * Genera un documento Word a partir de una plantilla y datos
 * @param {Buffer} templateBuffer - Buffer de la plantilla Word
 * @param {Object} data - Datos para rellenar
 * @returns {Buffer} - Buffer del documento generado
 */
function generateDocumentFromTemplate(templateBuffer, data) {
  try {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Reemplazar los campos con los datos
    doc.render(data);

    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return buffer;
  } catch (error) {
    console.error('Error al generar documento:', error);
    throw new Error('Error al generar el documento Word');
  }
}

/**
 * Extrae texto plano de un archivo Word
 * @param {Buffer} fileBuffer - Buffer del archivo Word
 * @returns {Promise<string>} - Texto extraído
 */
async function extractPlainText(fileBuffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  } catch (error) {
    console.error('Error al extraer texto:', error);
    throw new Error('Error al extraer texto del archivo');
  }
}

module.exports = {
  extractYellowHighlightedFields,
  generateDocumentFromTemplate,
  extractPlainText,
  detectFieldType,
  normalizeFieldName
};

