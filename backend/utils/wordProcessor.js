const mammoth = require('mammoth');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');

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
    const fieldNames = new Set();
    
    let match;
    while ((match = templateVarRegex.exec(html)) !== null) {
      const fieldName = match[1].trim();
      if (!fieldNames.has(fieldName)) {
        fieldNames.add(fieldName);
        
        // Generar etiqueta legible desde el nombre del campo
        const fieldLabel = fieldName
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        fields.push({
          field_name: fieldName,
          field_label: fieldLabel,
          field_type: detectFieldType(fieldName),
          required: true,
          display_order: fields.length
        });
      }
    }

    // Buscar también campos en formato Word (MERGEFIELD)
    const mergeFieldRegex = /MERGEFIELD\s+([^\s\\]+)/gi;
    while ((match = mergeFieldRegex.exec(html)) !== null) {
      const fieldName = match[1].trim();
      if (!fieldNames.has(fieldName)) {
        fieldNames.add(fieldName);
        
        const fieldLabel = fieldName
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        fields.push({
          field_name: fieldName,
          field_label: fieldLabel,
          field_type: detectFieldType(fieldName),
          required: true,
          display_order: fields.length
        });
      }
    }

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
  detectFieldType
};

