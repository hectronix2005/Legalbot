const express = require('express');
const router = express.Router();
const multer = require('multer');
const mammoth = require('mammoth');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize, verifyTenant } = require('../middleware/auth');
const ContractTemplate = require('../models/ContractTemplate');
const Contract = require('../models/Contract');
const ActivityLog = require('../models/ActivityLog');
const { suggestFieldType } = require('../config/thirdPartyTypes');

// Configurar multer para subir archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/word-templates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Aceptar archivos .docx con diferentes MIME types
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/octet-stream'
    ];
    
    const isDocx = file.originalname.toLowerCase().endsWith('.docx') || 
                   allowedMimeTypes.includes(file.mimetype);
    
    if (isDocx) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .docx'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// Procesar archivo Word, detectar variables y crear plantilla directamente
router.post('/detect-variables',
  authenticate,
  verifyTenant,
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    console.log('🚀 INICIANDO PROCESO SIMPLIFICADO: DETECTAR VARIABLES Y CREAR PLANTILLA');
    console.log('=====================================================================');
    
    try {
      if (!req.file) {
        console.log('❌ ERROR: No se proporcionó archivo');
        return res.status(400).json({ error: 'No se proporcionó archivo' });
      }

      const { name, description } = req.body;
      
      console.log('📝 DATOS RECIBIDOS:');
      console.log('  - Name:', name);
      console.log('  - Description:', description);
      console.log('  - File:', req.file.originalname);
      console.log('  - User ID:', req.user.id);
      console.log('  - User role:', req.user.role);

      if (!name) {
        console.log('❌ ERROR: Falta el nombre de la plantilla');
        return res.status(400).json({ error: 'El nombre de la plantilla es requerido' });
      }

      const filePath = req.file.path;
      console.log('📄 PROCESANDO ARCHIVO WORD:', req.file.originalname);
      console.log('📁 Ruta del archivo:', filePath);
      
      // Leer el archivo Word con opciones para preservar formato
      const result = await mammoth.convertToHtml({ 
        path: filePath,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em"
        ],
        convertImage: mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        })
      });
      
      const html = result.value;
      
      // Debug: Mostrar una muestra del HTML generado
      console.log('📄 HTML generado por mammoth:');
      console.log('  - Longitud:', html.length);
      console.log('  - Primeros 1000 caracteres:', html.substring(0, 1000));
      
      // Detectar variables con marcadores {{variable}}
      console.log('🔍 DETECTANDO VARIABLES...');
      const variables = detectVariablesFromHtml(html);
      
      console.log('✅ VARIABLES DETECTADAS:', variables.length);
      variables.forEach((variable, index) => {
        console.log(`    ${index + 1}. {{${variable.marker}}} → ${variable.name} (${variable.type})`);
      });

      if (variables.length === 0) {
        console.log('⚠️ ADVERTENCIA: No se detectaron variables');
        return res.status(400).json({ 
          error: 'No se detectaron variables en el documento. Asegúrate de usar marcadores {{variable}}' 
        });
      }

      // En lugar de crear la plantilla directamente, devolver las variables para que el usuario asigne nombres descriptivos
      console.log('📋 VARIABLES DETECTADAS - REQUIERE ASIGNACIÓN DE NOMBRES DESCRIPTIVOS');
      console.log('  - Variables count:', variables.length);
      console.log('  - Necesita nombres descriptivos: true');
      
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Archivo temporal eliminado');
      } catch (cleanupError) {
        console.log('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
      }

      res.json({
        message: 'Variables detectadas exitosamente. Asigna nombres descriptivos a los campos.',
        variables: variables.map(variable => ({
          field_name: variable.field_name, // Nombre del campo en BD
          field_label: variable.field_label, // Variable que se reemplaza (contenido entre {{}})
          original_marker: variable.original_marker, // Marcador original {{variable}}
          type: variable.type,
          required: variable.required,
          can_repeat: variable.can_repeat,
          repeat_count: variable.repeat_count,
          needsDescriptiveName: true // Indica que necesita nombre descriptivo
        })),
        previewHtml: html.substring(0, 2000) + '...',
        requiresFieldNames: true
      });
    } catch (error) {
      console.error('❌ ERROR EN PROCESO SIMPLIFICADO:');
      console.error('  - Error type:', error.name);
      console.error('  - Error message:', error.message);
      console.error('  - Error stack:', error.stack);
      
      // Limpiar archivo temporal en caso de error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('🗑️ Archivo temporal eliminado después del error:', req.file.path);
        } catch (cleanupError) {
          console.log('⚠️ No se pudo eliminar archivo temporal después del error:', cleanupError.message);
        }
      }
      
      res.status(500).json({ error: 'Error al procesar el archivo Word y crear la plantilla' });
    }
  }
);

// Endpoint de prueba simple para detectar variables
router.post('/test-detect-variables', 
  authenticate,
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    console.log('🧪 ENDPOINT DE PRUEBA: DETECTAR VARIABLES');
    console.log('==========================================');
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo' });
      }

      const { name, description } = req.body;
      
      console.log('📝 DATOS RECIBIDOS:');
      console.log('  - Name:', name);
      console.log('  - Description:', description);
      console.log('  - File:', req.file.originalname);

      const filePath = req.file.path;
      console.log('📄 PROCESANDO ARCHIVO WORD:', req.file.originalname);
      
      // Leer el archivo Word
      // Usar mammoth con configuración avanzada para preservar formato completo
      const result = await mammoth.convertToHtml({ 
        path: filePath,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh", 
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => h2:fresh",
          "p[style-name='Quote'] => blockquote:fresh",
          "p[style-name='Intense Quote'] => blockquote.intense:fresh",
          "p[style-name='List Paragraph'] => p.list:fresh",
          "p[style-name='Caption'] => p.caption:fresh",
          "p[style-name='Footnote Text'] => p.footnote:fresh",
          "p[style-name='Normal'] => p:fresh",
          "p[style-name='Body Text'] => p:fresh",
          "p[style-name='Default Paragraph Font'] => p:fresh"
        ],
        convertImage: mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        }),
        // Configuraciones adicionales para preservar todo el contenido
        includeEmbeddedStyleMap: true,
        includeDefaultStyleMap: true,
        transformDocument: function(document) {
          // Asegurar que se procese todo el contenido
          return document;
        }
      });
      
      const html = result.value;
      console.log('📄 HTML generado con formato preservado, longitud:', html.length);
      
      // Log detallado del contenido para debugging
      console.log('📄 Primeros 2000 caracteres del HTML:');
      console.log(html.substring(0, 2000));
      console.log('📄 Últimos 1000 caracteres del HTML:');
      console.log(html.substring(Math.max(0, html.length - 1000)));
      
      // Verificar si hay mensajes de advertencia
      if (result.messages && result.messages.length > 0) {
        console.log('⚠️ Mensajes de mammoth:');
        result.messages.forEach((message, index) => {
          console.log(`  ${index + 1}. ${message.message} (${message.type})`);
        });
      }
      
      // Detectar variables
      const variables = detectVariablesFromHtml(html);
      console.log('✅ VARIABLES DETECTADAS:', variables.length);
      
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(filePath);
        console.log('🗑️ Archivo temporal eliminado');
      } catch (cleanupError) {
        console.log('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
      }

      res.json({
        variables: variables,
        formattedHtml: html, // HTML completo con formato preservado
        previewHtml: html.substring(0, 2000) + '...', // Vista previa truncada para el modal
        message: `Se detectaron ${variables.length} variables con formato preservado`,
        requiresFieldNames: true,
        preserveFormat: true
      });
    } catch (error) {
      console.error('❌ ERROR EN ENDPOINT DE PRUEBA:');
      console.error('  - Error type:', error.name);
      console.error('  - Error message:', error.message);
      
      // Limpiar archivo temporal en caso de error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.log('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
        }
      }
      
      res.status(500).json({ error: 'Error al procesar el archivo Word' });
    }
  }
);

// Subir plantilla Word completa
router.post('/upload-word',
  authenticate,
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    console.log('🚀 INICIANDO PROCESO DE CREACIÓN DE PLANTILLA DESDE WORD');
    console.log('========================================================');
    
    try {
      if (!req.file) {
        console.log('❌ ERROR: No se proporcionó archivo');
        return res.status(400).json({ error: 'No se proporcionó archivo' });
      }

      const { name, description, variables } = req.body;
      
      console.log('📝 DATOS RECIBIDOS:');
      console.log('  - Name:', name);
      console.log('  - Description:', description);
      console.log('  - Variables (raw):', variables);
      console.log('  - Variables type:', typeof variables);
      console.log('  - User ID:', req.user.id);
      console.log('  - User role:', req.user.role);
      
      if (!name || !variables) {
        console.log('❌ ERROR: Faltan datos requeridos');
        return res.status(400).json({ error: 'Faltan datos requeridos' });
      }

      const filePath = req.file.path;
      const fileName = req.file.filename;
      
      console.log('📁 ARCHIVO PROCESADO:');
      console.log('  - FilePath:', filePath);
      console.log('  - FileName:', fileName);
      console.log('  - OriginalName:', req.file.originalname);
      console.log('  - FileSize:', req.file.size);
      
      // Parsear variables
      let parsedVariables;
      try {
        parsedVariables = JSON.parse(variables);
        console.log('✅ VARIABLES PARSEADAS:');
        console.log('  - Total variables:', parsedVariables.length);
        parsedVariables.forEach((variable, index) => {
          console.log(`    ${index + 1}. ${variable.marker} → ${variable.name} (${variable.type})`);
        });
      } catch (parseError) {
        console.error('❌ ERROR PARSEANDO VARIABLES:', parseError);
        return res.status(400).json({ error: 'Error en el formato de las variables' });
      }
      
      // Validar que todas las variables tengan nombre
      const invalidVariables = parsedVariables.filter(v => !v.name || v.name.trim() === '');
      if (invalidVariables.length > 0) {
        console.log('❌ ERROR: Variables sin nombre:', invalidVariables.map(v => v.marker));
        return res.status(400).json({ 
          error: 'Todas las variables deben tener un nombre de campo',
          invalidVariables: invalidVariables.map(v => v.marker)
        });
      }
      
      // Crear plantilla en la base de datos
      console.log('🏗️ CREANDO PLANTILLA EN LA BASE DE DATOS...');
      console.log('  - Categoría: Confidencialidad');
      console.log('  - Company ID:', req.user.company_id);
      console.log('  - Created by:', req.user.id);
      
      const templateData = {
        name,
        description: description || '',
        category: 'Confidencialidad',
        content: '',
        fields: parsedVariables,
        company: req.companyId,
        created_by: req.user.id,
        word_file_path: fileName,
        word_file_original_name: req.file.originalname,
        version: 1,
        is_current: true,
        active: true
      };
      
      console.log('📊 DATOS DE LA PLANTILLA:');
      console.log('  - Name:', templateData.name);
      console.log('  - Category:', templateData.category);
      console.log('  - Fields count:', templateData.fields.length);
      console.log('  - Company:', templateData.company);
      console.log('  - Created by:', templateData.created_by);
      
      const template = await ContractTemplate.create(templateData);
      
      console.log('✅ PLANTILLA CREADA EXITOSAMENTE:');
      console.log('  - Template ID:', template._id);
      console.log('  - Created at:', template.createdAt);
      console.log('  - Fields saved:', template.fields.length);

      // Log de actividad
      console.log('📝 CREANDO LOG DE ACTIVIDAD...');
      await ActivityLog.create({
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Creó plantilla desde Word: ${name}`
      });
      console.log('✅ Log de actividad creado');

      // Verificar que la plantilla se guardó correctamente
      console.log('🔍 VERIFICANDO PLANTILLA GUARDADA...');
      const savedTemplate = await ContractTemplate.findById(template._id);
      if (savedTemplate) {
        console.log('✅ PLANTILLA VERIFICADA EN LA BASE DE DATOS:');
        console.log('  - ID:', savedTemplate._id);
        console.log('  - Name:', savedTemplate.name);
        console.log('  - Fields:', savedTemplate.fields.length);
        console.log('  - Active:', savedTemplate.active);
      } else {
        console.log('❌ ERROR: No se pudo verificar la plantilla guardada');
      }

      console.log('🎉 PROCESO COMPLETADO EXITOSAMENTE');
      console.log('==================================');

      res.json({
        message: 'Plantilla creada exitosamente',
        templateId: template._id,
        template: {
          id: template._id,
          name: template.name,
          fields: template.fields.length
        }
      });
    } catch (error) {
      console.error('❌ ERROR EN CREACIÓN DE PLANTILLA:');
      console.error('  - Error type:', error.name);
      console.error('  - Error message:', error.message);
      console.error('  - Error stack:', error.stack);
      res.status(500).json({ error: 'Error al crear la plantilla' });
    }
  }
);

// Función para detectar variables en HTML
function detectVariablesFromHtml(html) {
  console.log('🔍 Analizando HTML para detectar variables con marcadores {{variable}}...');
  console.log('HTML length:', html.length);
  
  const variables = [];
  const foundVariables = new Map(); // Cambiar a Map para contar repeticiones
  const variableCounts = new Map(); // Contar cuántas veces aparece cada variable
  const normalizedVariables = new Map(); // Para detectar duplicadas normalizadas
  
  // Buscar SOLO marcadores {{variable}} (método principal)
  const markerPattern = /\{\{([^}]+)\}\}/g;
  
  console.log('🔍 Buscando marcadores {{variable}}...');
  
  let match;
  while ((match = markerPattern.exec(html)) !== null) {
    const variableText = match[1].trim();
    console.log('✅ Variable encontrada con marcador {{}}:', variableText);
    
    if (variableText) {
      // Contar cuántas veces aparece esta variable
      const count = variableCounts.get(variableText) || 0;
      variableCounts.set(variableText, count + 1);
      
      // Solo agregar la variable si no se ha visto antes
      if (!foundVariables.has(variableText)) {
        foundVariables.set(variableText, true);
        
        // Generar nombre de campo automáticamente
        const autoName = generateAutoFieldName(variableText, variables.length + 1);
        
        variables.push({
          marker: variableText, // El marcador original (contenido entre {{}})
          original_marker: variableText, // El marcador original (alias)
          name: autoName, // Nombre del campo en BD (generado automáticamente)
          field_name: autoName, // Nombre del campo en BD
          field_label: variableText, // Etiqueta que se reemplaza en el contrato (contenido entre {{}})
          type: 'text', // Tipo por defecto
          required: true,
          description: `Variable detectada: ${variableText}`,
          needsFieldName: true, // Necesita que el usuario asigne un nombre descriptivo
          can_repeat: true, // Todas las variables pueden ser repetidas
          repeat_count: 0, // Se establecerá después
          is_repeated: false, // Se establecerá después
          repeat_source: null // Se establecerá después
        });
        console.log(`✅ Variable agregada: ${variableText} → ${autoName} (nombre automático)`);
      }
    }
  }
  
  // MEJORAR DETECCIÓN DE VARIABLES DUPLICADAS
  console.log('🔍 MEJORANDO DETECCIÓN DE VARIABLES DUPLICADAS...');
  
  // Normalizar variables para detectar duplicadas semánticamente
  variables.forEach((variable, index) => {
    const normalizedName = normalizeVariableName(variable.marker);
    const existingIndex = normalizedVariables.get(normalizedName);
    
    if (existingIndex !== undefined) {
      // Variable duplicada encontrada
      console.log(`🔄 Variable duplicada detectada: "${variable.marker}" es similar a "${variables[existingIndex].marker}"`);
      
      // Marcar como duplicada
      variable.is_repeated = true;
      variable.repeat_source = existingIndex + 1; // +1 porque los índices empiezan en 0
      variable.repeat_count = 1; // Solo cuenta como 1 porque es duplicada
      
      // Actualizar la variable original
      variables[existingIndex].repeat_count = Math.max(variables[existingIndex].repeat_count, 2);
    } else {
      // Variable única
      normalizedVariables.set(normalizedName, index);
      variable.is_repeated = false;
      variable.repeat_source = null;
      variable.repeat_count = variableCounts.get(variable.marker) || 1;
    }
  });
  
  // Actualizar el conteo de repeticiones para cada variable
  variables.forEach(variable => {
    const count = variableCounts.get(variable.marker) || 1;
    if (!variable.is_repeated) {
      variable.repeat_count = count;
    }
    console.log(`🔄 Variable "${variable.marker}" aparece ${count} veces`);
  });
  
  // Si no se detectaron marcadores, mostrar mensaje
  if (variables.length === 0) {
    console.log('⚠️ No se detectaron marcadores {{variable}} en el documento');
    console.log('💡 Sugerencia: Usa marcadores como {{ciudad}}, {{nombre_empresa}}, {{fecha_contrato}}');
  }
  
  console.log(`🎯 Total de variables detectadas: ${variables.length}`);
  console.log('Variables encontradas:', variables.map(v => `${v.marker} → ${v.name} (${v.repeat_count} veces)`));
  
  // Mostrar variables duplicadas
  const duplicatedVariables = variables.filter(v => v.is_repeated);
  if (duplicatedVariables.length > 0) {
    console.log('🔄 Variables duplicadas detectadas:');
    duplicatedVariables.forEach(variable => {
      console.log(`  - "${variable.marker}" es duplicada de variable #${variable.repeat_source}`);
    });
  }
  
  return variables;
}

// Función optimizada para detectar variables desde texto plano (sin HTML)
function detectVariablesFromText(plainText, thirdPartyType = 'otro') {
  console.log('🔍 Analizando texto plano para detectar variables con marcadores {{variable}}...');
  console.log('Texto length:', plainText.length);
  console.log('🏷️  Tipo de tercero:', thirdPartyType);

  const variables = [];
  const foundVariables = new Map();
  const variableCounts = new Map();
  const normalizedVariables = new Map();

  // Buscar SOLO marcadores {{variable}}
  const markerPattern = /\{\{([^}]+)\}\}/g;

  console.log('🔍 Buscando marcadores {{variable}} en texto plano...');

  let match;
  while ((match = markerPattern.exec(plainText)) !== null) {
    const variableText = match[1].trim();
    console.log('✅ Variable encontrada:', variableText);

    if (variableText) {
      // Contar cuántas veces aparece
      const count = variableCounts.get(variableText) || 0;
      variableCounts.set(variableText, count + 1);

      // Solo agregar si no se ha visto antes
      if (!foundVariables.has(variableText)) {
        foundVariables.set(variableText, true);

        // Generar nombre de campo automáticamente
        const autoName = generateAutoFieldName(variableText, variables.length + 1);

        // Sugerir tipo de campo basado en el tipo de tercero
        const suggestion = suggestFieldType(variableText, thirdPartyType);
        const fieldType = suggestion.type || detectFieldType(variableText);

        variables.push({
          marker: variableText, // MANTENER EXACTO CON ESPACIOS: "RAZON SOCIAL"
          original_marker: variableText, // MANTENER EXACTO CON ESPACIOS
          name: autoName, // field_name normalizado: "razon_social"
          field_name: autoName, // field_name normalizado: "razon_social"
          field_label: suggestion.label || variableText, // Usar etiqueta sugerida o variable original
          field_type: fieldType,
          required: suggestion.required !== undefined ? suggestion.required : true,
          description: `Variable detectada: ${variableText}`,
          needsFieldName: true,
          can_repeat: true,
          repeat_count: 0,
          is_repeated: false,
          repeat_source: null,
          field_options: suggestion.options || []
        });
        console.log(`✅ Variable agregada: marker="${variableText}" field_name="${autoName}" type="${fieldType}"`);
      }
    }
  }

  // Detectar variables duplicadas
  console.log('🔍 DETECTANDO VARIABLES DUPLICADAS...');
  variables.forEach((variable, index) => {
    const normalizedName = normalizeVariableName(variable.marker);
    const existingIndex = normalizedVariables.get(normalizedName);

    if (existingIndex !== undefined) {
      variable.is_repeated = true;
      variable.repeat_source = existingIndex + 1;
      variable.repeat_count = 1;
      variables[existingIndex].repeat_count = Math.max(variables[existingIndex].repeat_count, 2);
    } else {
      normalizedVariables.set(normalizedName, index);
      variable.is_repeated = false;
      variable.repeat_source = null;
      variable.repeat_count = variableCounts.get(variable.marker) || 1;
    }
  });

  // Actualizar conteo de repeticiones
  variables.forEach(variable => {
    const count = variableCounts.get(variable.marker) || 1;
    if (!variable.is_repeated) {
      variable.repeat_count = count;
    }
    console.log(`🔄 Variable "${variable.marker}" aparece ${count} veces`);
  });

  if (variables.length === 0) {
    console.log('⚠️ No se detectaron marcadores {{variable}} en el documento');
    console.log('💡 Sugerencia: Usa marcadores como {{ciudad}}, {{nombre_empresa}}, {{fecha_contrato}}');
  }

  console.log(`🎯 Total de variables detectadas: ${variables.length}`);

  return variables;
}

// Detectar tipo de campo basado en el nombre de la variable
function detectFieldType(variableName) {
  const lowerName = variableName.toLowerCase();

  if (lowerName.includes('fecha') || lowerName.includes('date')) {
    return 'date';
  }
  if (lowerName.includes('email') || lowerName.includes('correo')) {
    return 'email';
  }
  if (lowerName.includes('monto') || lowerName.includes('precio') ||
      lowerName.includes('cantidad') || lowerName.includes('numero') ||
      lowerName.includes('valor')) {
    return 'number';
  }
  if (lowerName.includes('descripcion') || lowerName.includes('observacion') ||
      lowerName.includes('notas') || lowerName.includes('comentario')) {
    return 'textarea';
  }

  return 'text';
}

// Función para normalizar nombres de variables y detectar duplicadas
function normalizeVariableName(marker) {
  return marker
    .replace(/<[^>]*>/g, '') // Remover HTML tags
    .replace(/[^\w\s]/g, '') // Remover caracteres especiales
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
    .replace(/_+/g, '_') // Remover guiones bajos múltiples
    .replace(/^_|_$/g, ''); // Remover guiones bajos al inicio y final
}

// Función para generar nombres de campo automáticamente
function generateAutoFieldName(marker, index) {
  // IMPORTANTE: Limpiar el marker pero PRESERVAR ESPACIOS para el field_name
  const cleanMarker = marker
    .replace(/<[^>]*>/g, '') // Remover HTML tags
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_'); // Reemplazar espacios con guiones bajos SOLO para field_name

  // Si el marker está limpio, usarlo
  if (cleanMarker && cleanMarker.length > 2) {
    return cleanMarker;
  }

  // Si no, generar un nombre genérico
  return `campo_${index}`;
}

// Función para generar vista previa
function generatePreview(html, variables) {
  try {
    // Limitar el tamaño del HTML para evitar errores de memoria
    let preview = html;
    if (preview.length > 100000) { // 100KB limit más conservador
      preview = preview.substring(0, 100000) + '... [HTML truncado]';
    }
    
    // Solo hacer reemplazos simples para marcadores {{variable}}
    let replacementCount = 0;
    const maxReplacements = 50; // Límite de reemplazos para evitar bucles infinitos
    
    variables.forEach(variable => {
      if (replacementCount >= maxReplacements) return;
      
      const marker = variable.marker;
      
      // Validar que el marker no esté vacío
      if (!marker || marker.trim() === '') {
        return;
      }
      
      // Crear placeholder simple
      const placeholder = `[${marker}]`;
      
      // Reemplazo simple y seguro
      try {
        // Solo reemplazar si el marker está en el HTML y no hemos excedido el límite
        if (preview.includes(marker) && replacementCount < maxReplacements) {
          preview = preview.replace(marker, placeholder);
          replacementCount++;
        }
      } catch (error) {
        console.error('Error en reemplazo para marker:', marker, error);
        // Continuar con el siguiente marker
      }
    });
    
    return preview;
  } catch (error) {
    console.error('Error en generatePreview:', error);
    // Retornar HTML original si hay error
    return html;
  }
}

// Asignar nombres de campos a variables detectadas
router.post('/assign-field-names',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { variables } = req.body;
      
      if (!variables || !Array.isArray(variables)) {
        return res.status(400).json({ error: 'Se requieren las variables con nombres de campos' });
      }
      
      // Validar que todas las variables tengan nombre de campo
      const invalidVariables = variables.filter(v => !v.name || v.name.trim() === '');
      if (invalidVariables.length > 0) {
        return res.status(400).json({ 
          error: 'Todas las variables deben tener un nombre de campo asignado',
          invalidVariables: invalidVariables.map(v => v.marker)
        });
      }
      
      res.json({
        message: 'Nombres de campos asignados exitosamente',
        variables: variables.map(v => ({
          marker: v.marker,
          name: v.name,
          type: v.type || 'text',
          required: v.required !== false,
          description: v.description || `Campo: ${v.name}`
        }))
      });
      
    } catch (error) {
      console.error('Error assigning field names:', error);
      res.status(500).json({ error: 'Error al asignar nombres de campos' });
    }
  }
);

// Generar contrato desde plantilla Word
router.post('/generate-word-contract',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { templateId, formData } = req.body;
      
      if (!templateId || !formData) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
      }

      // Buscar la plantilla
      const template = await ContractTemplate.findById(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      // Verificar que existe el archivo Word
      if (!template.word_file_path) {
        return res.status(400).json({ error: 'La plantilla no tiene archivo Word asociado' });
      }

      const filePath = path.join(__dirname, '../uploads/word-templates', template.word_file_path);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo Word no encontrado' });
      }

      // Leer el archivo Word
      const result = await mammoth.convertToHtml({ path: filePath });
      let html = result.value;
      
      // Reemplazar variables con datos del formulario
      template.fields.forEach(field => {
        const value = formData[field.name] || '';
        const regex = new RegExp(`\\{\\{${field.name}\\}\\}`, 'gi');
        html = html.replace(regex, value);
        
        // También reemplazar si está resaltado en amarillo
        const yellowRegex = new RegExp(`<span[^>]*style="[^"]*background-color:\\s*yellow[^"]*"[^>]*>${field.name}</span>`, 'gi');
        html = html.replace(yellowRegex, value);
      });
      
      // Convertir HTML a Word usando mammoth
      const docxBuffer = await mammoth.convertToHtml({ path: filePath });
      
      // Por ahora, devolver el HTML procesado
      // En una implementación completa, se usaría una librería como docx para generar el Word
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${template.name}_generado.docx"`);
      
      // Enviar el archivo original por ahora (en producción se procesaría)
      res.sendFile(filePath);
      
    } catch (error) {
      console.error('Error generating contract:', error);
      res.status(500).json({ error: 'Error al generar el contrato' });
    }
  }
);

// Obtener información detallada de una plantilla con variables
router.get('/template-details/:id',
  authenticate,
  authorize('admin', 'lawyer', 'requester'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const template = await ContractTemplate.findById(id)
        .populate('created_by', 'name email')
        .populate('company', 'name tax_id');
      
      if (!template) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      // Formatear información detallada de las variables
      const variablesInfo = template.fields.map((field, index) => ({
        number: index + 1,
        original_marker: field.original_marker || `{{${field.field_name}}}`,
        field_name: field.field_name,
        field_label: field.field_label,
        field_type: field.field_type,
        description: field.description,
        required: field.required,
        can_repeat: field.can_repeat,
        repeat_source: field.repeat_source,
        repeat_count: field.repeat_count || 1,
        display_order: field.display_order
      }));

      res.json({
        template: {
          id: template._id,
          name: template.name,
          description: template.description,
          category: template.category,
          content: template.content,
          created_by: template.created_by,
          company: template.company,
          created_at: template.createdAt,
          updated_at: template.updatedAt
        },
        variables: variablesInfo,
        total_variables: variablesInfo.length
      });
    } catch (error) {
      console.error('Error getting template details:', error);
      res.status(500).json({ error: 'Error al obtener detalles de la plantilla' });
    }
  }
);

// Actualizar información de variables de una plantilla
router.put('/template-variables/:id',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { variables } = req.body;
      
      if (!variables || !Array.isArray(variables)) {
        return res.status(400).json({ error: 'Variables requeridas' });
      }

      const template = await ContractTemplate.findById(id);
      if (!template) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      // Actualizar campos con nueva información de variables
      template.fields = variables.map((variable, index) => ({
        field_name: variable.field_name,
        field_label: variable.field_label,
        field_type: variable.field_type,
        field_options: variable.field_options || [],
        required: variable.required,
        display_order: index,
        original_marker: variable.original_marker || `{{${variable.field_name}}}`,
        description: variable.description,
        can_repeat: variable.can_repeat,
        repeat_source: variable.repeat_source,
        repeat_count: variable.repeat_count || 1
      }));

      await template.save();

      res.json({
        message: 'Variables de plantilla actualizadas correctamente',
        template: {
          id: template._id,
          name: template.name,
          variables_count: template.fields.length
        }
      });
    } catch (error) {
      console.error('Error updating template variables:', error);
      res.status(500).json({ error: 'Error al actualizar variables de la plantilla' });
    }
  }
);

// Endpoint para procesar Word preservando formato completo
router.post('/process-word-with-format',
  authenticate,
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo' });
      }

      const filePath = req.file.path;
      const thirdPartyType = req.body.thirdPartyType || 'otro';

      console.log('📄 PROCESANDO WORD CON FORMATO COMPLETO:', req.file.originalname);
      console.log('📁 Ruta del archivo:', filePath);
      console.log('🏷️  Tipo de tercero:', thirdPartyType);

      // IMPORTANTE: Extraer texto plano primero para detectar variables
      console.log('🔍 EXTRAYENDO TEXTO PLANO PARA DETECTAR VARIABLES...');
      const plainTextResult = await mammoth.extractRawText({ path: filePath });
      const plainText = plainTextResult.value;

      console.log('📄 Texto plano extraído, longitud:', plainText.length);
      console.log('📄 Primeros 500 caracteres del texto plano:');
      console.log(plainText.substring(0, 500));

      // Verificar si hay marcadores {{}} en el texto plano
      const markerTest = /\{\{([^}]+)\}\}/g;
      const testMatches = plainText.match(markerTest);
      console.log('🔍 Marcadores {{}} encontrados en texto plano:', testMatches ? testMatches.length : 0);
      if (testMatches && testMatches.length > 0) {
        console.log('🔍 Ejemplos de marcadores:', testMatches.slice(0, 10));
      }

      // Detectar variables desde el texto plano (sin HTML)
      const variables = detectVariablesFromText(plainText, thirdPartyType);
      console.log('✅ VARIABLES DETECTADAS:', variables.length);

      if (variables.length > 0) {
        console.log('📋 Variables detectadas:');
        variables.forEach((v, i) => console.log(`  ${i+1}. {{${v.marker}}}`));
      }

      // OPCIONAL: También generar HTML preview para mostrar al usuario
      const htmlResult = await mammoth.convertToHtml({
        path: filePath,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => h2:fresh"
        ]
      });
      const html = htmlResult.value;

      // IMPORTANTE: NO eliminar el archivo temporal todavía
      // Lo necesitamos para crear la plantilla preservando formato
      console.log('✅ Archivo Word preservado para crear plantilla:', filePath);
      console.log('📁 Nombre del archivo:', req.file.filename);
      console.log('📋 Variables que se enviarán al frontend:');
      variables.forEach((v, i) => {
        console.log(`  ${i+1}. marker="${v.marker}", field_name="${v.field_name}", field_label="${v.field_label}"`);
      });

      res.json({
        variables: variables,
        formattedHtml: html, // HTML completo con formato preservado
        previewHtml: html.substring(0, 2000) + '...',
        message: `Se detectaron ${variables.length} variables con formato preservado`,
        requiresFieldNames: true,
        preserveFormat: true,
        // Información del archivo Word original para usar en creación de plantilla
        wordFile: {
          path: filePath,
          filename: req.file.filename,
          originalName: req.file.originalname
        },
        debug: {
          htmlLength: html.length,
          markerCount: testMatches ? testMatches.length : 0,
          exampleMarkers: testMatches ? testMatches.slice(0, 10) : [],
          plainTextPreview: plainText.substring(0, 500)
        }
      });
    } catch (error) {
      console.error('❌ ERROR PROCESANDO WORD CON FORMATO:');
      console.error('  - Error type:', error.name);
      console.error('  - Error message:', error.message);
      
      // Limpiar archivo temporal en caso de error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.log('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
        }
      }
      
      res.status(500).json({ error: 'Error al procesar el archivo Word con formato' });
    }
  }
);

// Endpoint para crear plantilla con nombres descriptivos asignados
router.post('/create-template-with-names',
  authenticate,
  verifyTenant,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { name, description, variables, html, formattedHtml } = req.body;

      console.log('🏗️ CREANDO PLANTILLA CON NOMBRES DESCRIPTIVOS:');
      console.log('  - Name:', name);
      console.log('  - Variables count:', variables.length);
      console.log('  - Formato preservado:', !!formattedHtml);
      console.log('  - Variables con repetición:', variables.filter(v => v.is_repeated).length);
      variables.forEach((variable, index) => {
        if (variable.is_repeated) {
          console.log(`    Variable ${index + 1}: is_repeated=${variable.is_repeated}, repeat_source=${variable.repeat_source}`);
        }
      });

      // Crear plantilla con nombres descriptivos asignados
      const templateData = {
        name,
        description: description || '',
        category: 'Confidencialidad',
        content: formattedHtml || html, // Usar HTML con formato preservado si está disponible
        fields: variables.map((variable, index) => ({
          field_name: variable.field_name, // Nombre del campo en BD
          field_label: variable.original_marker || variable.descriptive_name || `Variable ${index + 1}`, // Nombre descriptivo que ve el usuario
          field_type: variable.type,
          field_options: [],
          required: variable.required,
          display_order: index,
          // Información detallada de la variable
          original_marker: variable.original_marker || variable.field_name || `{{${variable.field_name}}}`,
          description: `Variable detectada: ${variable.original_marker || variable.field_name} (aparece ${variable.repeat_count || 1} veces)`,
          can_repeat: variable.can_repeat || true,
          repeat_source: variable.repeat_source ? parseInt(variable.repeat_source) : null,
          repeat_count: variable.repeat_count || 1,
          is_repeated: variable.is_repeated === true || variable.is_repeated === 'true' || false
        })),
        company: req.companyId,
        created_by: req.user.id,
        version: 1,
        is_current: true,
        active: true
      };

      const template = await ContractTemplate.create(templateData);

      console.log('✅ PLANTILLA CREADA EXITOSAMENTE:');
      console.log('  - Template ID:', template._id);
      console.log('  - Fields saved:', template.fields.length);

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Creó plantilla desde Word: ${name}`
      });

      res.json({
        message: 'Plantilla creada exitosamente con nombres descriptivos',
        templateId: template._id,
        template: {
          id: template._id,
          name: template.name,
          fields: template.fields.length
        }
      });
    } catch (error) {
      console.error('❌ ERROR AL CREAR PLANTILLA CON NOMBRES:');
      console.error('  - Error type:', error.name);
      console.error('  - Error message:', error.message);
      res.status(500).json({ error: 'Error al crear plantilla con nombres descriptivos' });
    }
  }
);

// Endpoint para asignar nombres descriptivos a las variables
router.put('/assign-field-names/:id', 
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { fieldNames } = req.body; // Array de { field_name, descriptive_name }

      console.log('🔄 ASIGNANDO NOMBRES DESCRIPTIVOS:');
      console.log('  - Template ID:', id);
      console.log('  - Field names count:', fieldNames.length);

      const template = await ContractTemplate.findById(id);
      if (!template) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      // Actualizar los nombres descriptivos de los campos
      template.fields.forEach(field => {
        const fieldNameData = fieldNames.find(fn => fn.field_name === field.field_name);
        if (fieldNameData) {
          // El field_label se convierte en el nombre descriptivo que ve el usuario
          // El original_marker sigue siendo la variable que se reemplaza
          field.field_label = fieldNameData.descriptive_name || field.original_marker || field.field_name;
        }
      });

      await template.save();

      console.log('✅ NOMBRES DESCRIPTIVOS ASIGNADOS:');
      console.log('  - Fields updated:', template.fields.length);

      res.json({
        message: 'Nombres descriptivos asignados exitosamente',
        template: {
          id: template._id,
          name: template.name,
          fields: template.fields.map(field => ({
            field_name: field.field_name,
            field_label: field.field_label, // Nombre descriptivo
            original_marker: field.original_marker // Variable que se reemplaza
          }))
        }
      });
    } catch (error) {
      console.error('❌ ERROR AL ASIGNAR NOMBRES DESCRIPTIVOS:');
      console.error('  - Error type:', error.name);
      console.error('  - Error message:', error.message);
      res.status(500).json({ error: 'Error al asignar nombres descriptivos' });
    }
  }
);

// Endpoint unificado: Crear plantilla y generar contrato en un solo paso
router.post('/create-template-and-contract',
  authenticate,
  verifyTenant,
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    console.log('🚀 INICIANDO PROCESO UNIFICADO: PLANTILLA + CONTRATO');
    console.log('==================================================');
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo Word' });
      }

      const { name, description, contractData, variables: variablesFromFrontend } = req.body;

      if (!name || !contractData) {
        return res.status(400).json({
          error: 'Se requieren: nombre de plantilla y datos del contrato'
        });
      }

      console.log('📝 DATOS RECIBIDOS:');
      console.log('  - Plantilla:', name);
      console.log('  - Descripción:', description);
      console.log('  - Archivo:', req.file.originalname);
      console.log('  - Ruta archivo:', req.file.path);
      console.log('  - Datos contrato:', Object.keys(JSON.parse(contractData)).length, 'campos');
      console.log('  - Variables recibidas del frontend:', variablesFromFrontend ? 'SÍ' : 'NO');

      // 1. USAR VARIABLES DEL FRONTEND (si están disponibles) o DETECTARLAS
      let variables;

      if (variablesFromFrontend) {
        console.log('✅ PASO 1: USANDO VARIABLES ENVIADAS POR EL FRONTEND');
        variables = JSON.parse(variablesFromFrontend);
        console.log('📋 Variables recibidas:', variables.length);
        variables.forEach((v, i) => {
          console.log(`  ${i+1}. marker="${v.marker}", field_name="${v.field_name}"`);
        });
      } else {
        console.log('🔍 PASO 1: DETECTANDO VARIABLES DESDE TEXTO PLANO...');
        const plainTextResult = await mammoth.extractRawText({ path: req.file.path });
        const plainText = plainTextResult.value;
        console.log('📄 Texto plano extraído, longitud:', plainText.length);

        variables = detectVariablesFromText(plainText);
        console.log('✅ Variables detectadas:', variables.length);
      }

      // 2. GENERAR HTML PREVIEW (SOLO PARA VISUALIZACIÓN)
      console.log('📄 PASO 2: GENERANDO PREVIEW HTML...');

      const htmlResult = await mammoth.convertToHtml({
        path: req.file.path,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh"
        ]
      });

      const html = htmlResult.value;
      console.log('✅ HTML preview generado, longitud:', html.length);

      // 3. CREAR PLANTILLA EN LA BASE DE DATOS
      console.log('🏗️ PASO 3: CREANDO PLANTILLA...');

      const templateData = {
        name,
        description: description || '',
        category: 'Confidencialidad',
        content: html, // HTML solo para preview
        fields: variables.map((variable, index) => ({
          field_name: variable.field_name,
          field_label: variable.original_marker || variable.field_name,
          field_type: variable.field_type,
          field_options: [],
          required: variable.required,
          display_order: index,
          original_marker: variable.original_marker || variable.field_name,
          description: `Variable detectada: ${variable.original_marker || variable.field_name} (aparece ${variable.repeat_count || 1} veces)`,
          can_repeat: variable.can_repeat || true,
          repeat_source: variable.repeat_source ? parseInt(variable.repeat_source) : null,
          repeat_count: variable.repeat_count || 1,
          is_repeated: variable.is_repeated === true || variable.is_repeated === 'true' || false
        })),
        company: req.companyId,
        created_by: req.user.id,
        word_file_path: req.file.path, // 🔥 RUTA COMPLETA del archivo Word original
        word_file_original_name: req.file.originalname,
        version: 1,
        is_current: true,
        active: true
      };

      const template = await ContractTemplate.create(templateData);
      console.log('✅ Plantilla creada:', template._id);
      console.log('📁 Archivo Word guardado en:', req.file.path);

      // 4. GENERAR CONTRATO USANDO DOCXTEMPLATER (PRESERVA FORMATO)
      console.log('📄 PASO 4: GENERANDO CONTRATO CON FORMATO PRESERVADO...');

      const contractDataParsed = JSON.parse(contractData);
      const contractNumber = `CON-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      console.log('🔧 Usando Docxtemplater para generar contrato...');
      console.log('📁 Plantilla Word:', req.file.path);
      console.log('📝 Datos recibidos del frontend:', contractDataParsed);

      // IMPORTANTE: Mapear field_name a marker original
      // El frontend envía datos con field_name como key, pero Docxtemplater necesita el marker original
      console.log('\n🔍 ========== DIAGNÓSTICO DE MAPEO DE VARIABLES ==========');
      console.log('📋 Variables detectadas del documento Word:');
      variables.forEach((v, i) => {
        console.log(`  ${i+1}. marker: "{{${v.marker}}}" (documento)`);
        console.log(`      field_name: "${v.field_name}" (formulario)`);
        console.log(`      field_label: "${v.field_label}" (etiqueta)`);
      });

      console.log('\n📋 Datos recibidos del frontend (del formulario):');
      Object.entries(contractDataParsed).forEach(([key, value]) => {
        console.log(`  "${key}" = "${value}"`);
      });

      // ESTRATEGIA DE MAPEO MÚLTIPLE (para máxima compatibilidad)
      const mappedData = {};

      // MÉTODO 1: Mapeo directo por field_name
      variables.forEach(variable => {
        const fieldName = variable.field_name;
        const marker = variable.marker;

        if (contractDataParsed[fieldName] !== undefined && contractDataParsed[fieldName] !== '') {
          mappedData[marker] = contractDataParsed[fieldName];
          console.log(`  ✅ MATCH (field_name): "${fieldName}" -> {{${marker}}} = "${contractDataParsed[fieldName]}"`);
        }
      });

      // MÉTODO 2: Mapeo case-insensitive (por si hay diferencias de mayúsculas)
      const unmappedData = Object.keys(contractDataParsed).filter(key =>
        !variables.some(v => v.field_name === key)
      );

      if (unmappedData.length > 0) {
        console.log('\n🔍 Buscando coincidencias case-insensitive para:', unmappedData);

        unmappedData.forEach(dataKey => {
          const matchingVar = variables.find(v =>
            v.field_name.toLowerCase() === dataKey.toLowerCase() ||
            v.marker.toLowerCase() === dataKey.toLowerCase()
          );

          if (matchingVar && contractDataParsed[dataKey]) {
            mappedData[matchingVar.marker] = contractDataParsed[dataKey];
            console.log(`  ✅ MATCH (case-insensitive): "${dataKey}" -> {{${matchingVar.marker}}} = "${contractDataParsed[dataKey]}"`);
          }
        });
      }

      // MÉTODO 3: Mapeo directo si los keys del frontend coinciden con los markers
      Object.entries(contractDataParsed).forEach(([key, value]) => {
        const exactMatch = variables.find(v => v.marker === key);
        if (exactMatch && value && !mappedData[key]) {
          mappedData[key] = value;
          console.log(`  ✅ MATCH (marker directo): {{${key}}} = "${value}"`);
        }
      });

      console.log('\n📝 ========== DATOS MAPEADOS FINALES ==========');
      if (Object.keys(mappedData).length === 0) {
        console.log('  ⚠️ ¡ADVERTENCIA! No se mapeó ninguna variable');
        console.log('  ⚠️ El documento generado tendrá "undefined" en todas las variables');
      } else {
        Object.entries(mappedData).forEach(([marker, value]) => {
          console.log(`  {{${marker}}} = "${value}"`);
        });
      }
      console.log(`📊 Total: ${Object.keys(mappedData).length} variables mapeadas de ${variables.length} detectadas\n`);

      // Leer la plantilla Word original
      const templateBuffer = fs.readFileSync(req.file.path);
      const zip = new PizZip(templateBuffer);

      // Crear instancia de Docxtemplater con manejo de errores
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '{{',
          end: '}}'
        },
        nullGetter: function(part, scopeManager) {
          // Esto se llama cuando una variable no tiene valor
          console.log(`⚠️  Variable sin valor encontrada: {{${part.value}}}`);
          return ''; // Retornar string vacío en lugar de undefined
        }
      });

      // Reemplazar variables en la plantilla preservando formato
      console.log('\n🔄 ========== REEMPLAZANDO VARIABLES EN WORD ==========');
      try {
        doc.render(mappedData);
        console.log('✅ Reemplazo completado exitosamente');
      } catch (error) {
        console.error('❌ ERROR EN DOCXTEMPLATER:');
        console.error('  Tipo:', error.name);
        console.error('  Mensaje:', error.message);
        if (error.properties) {
          console.error('  Propiedades:', JSON.stringify(error.properties, null, 2));
        }
        throw error;
      }

      // Generar el documento final
      const contractBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      // Guardar el contrato generado
      const contractsDir = path.join(__dirname, '../uploads/contracts');
      if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
      }

      const contractFileName = `contrato_${contractNumber}_${Date.now()}.docx`;
      const contractFilePath = path.join(contractsDir, contractFileName);
      fs.writeFileSync(contractFilePath, contractBuffer);

      console.log('\n✅ ========== CONTRATO GENERADO ==========');
      console.log('📄 Archivo:', contractFileName);
      console.log('📁 Ruta:', contractFilePath);
      console.log('📊 Tamaño:', (contractBuffer.length / 1024).toFixed(2), 'KB');
      console.log('✅ Formato preservado: SÍ');
      console.log('✅ Variables reemplazadas:', Object.keys(mappedData).length);
      console.log('==========================================\n');

      // Procesar HTML para preview (reemplazando variables con markers correctos)
      let contractContentHtml = html;
      for (const [marker, value] of Object.entries(mappedData)) {
        // Escapar caracteres especiales de regex en el marker
        const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{\\{${escapedMarker}\\}\\}`, 'g');
        contractContentHtml = contractContentHtml.replace(regex, value);
        console.log(`  🔄 HTML: Reemplazando {{${marker}}} con "${value}"`);
      }

      // Extraer información del tercero para búsqueda
      const terceroInfo = extractTerceroInfo(contractDataParsed, template);

      // Crear contrato en BD
      const contract = await Contract.create({
        template: template._id,
        contract_number: contractNumber,
        title: terceroInfo.title || `Contrato ${contractNumber}`,
        content: contractContentHtml, // HTML para preview
        description: terceroInfo.description || '',
        company_name: terceroInfo.tercero || '',
        file_path: contractFilePath, // Ruta del contrato Word generado
        generated_by: req.user.id,
        company: req.companyId, // 🔥 Campo empresa para multi-tenant
        status: 'active'
      });

      console.log('✅ Contrato creado en BD:', contract._id);

      // 5. LOG DE ACTIVIDAD
      console.log('📝 PASO 5: REGISTRANDO ACTIVIDAD...');
      
      await ActivityLog.create({
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Creó plantilla y generó contrato: ${name}`
      });

      await ActivityLog.create({
        user: req.user.id,
        action: 'GENERATE',
        entity_type: 'contract',
        entity_id: contract._id,
        description: `Generó contrato ${contractNumber} desde plantilla ${name}`
      });

      // 6. NO ELIMINAR ARCHIVO WORD - SE USA COMO PLANTILLA
      console.log('📁 Archivo Word de plantilla conservado:', req.file.path);
      console.log('📁 Contrato Word generado:', contractFilePath);

      console.log('🎉 PROCESO UNIFICADO COMPLETADO EXITOSAMENTE');
      console.log('===========================================');

      res.status(201).json({
        message: 'Plantilla creada y contrato generado exitosamente con formato preservado',
        template: {
          id: template._id,
          name: template.name,
          fields_count: template.fields.length,
          word_file_path: req.file.path
        },
        contract: {
          id: contract._id,
          contract_number: contractNumber,
          status: contract.status,
          file_path: contractFilePath
        },
        variables_detected: variables.length,
        unified_process: true,
        format_preserved: true,
        note: 'El contrato ha sido generado preservando todo el formato del documento Word original'
      });

    } catch (error) {
      console.error('❌ ERROR EN PROCESO UNIFICADO:');
      console.error('  - Error type:', error.name);
      console.error('  - Error message:', error.message);
      console.error('  - Error stack:', error.stack);
      
      // Limpiar archivo temporal en caso de error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.log('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
        }
      }
      
      res.status(500).json({ 
        error: 'Error en el proceso unificado',
        details: error.message 
      });
    }
  }
);

// Función helper para extraer información del tercero desde los datos del contrato
function extractTerceroInfo(contractData, template) {
  const info = {
    tercero: '',
    title: '',
    description: ''
  };

  // Palabras clave comunes para identificar el tercero
  const terceroKeywords = [
    'tercero', 'razon_social', 'nombre_tercero', 'empresa_tercero',
    'nombre_empresa', 'compania', 'proveedor', 'cliente',
    'contratista', 'arrendatario', 'arrendador', 'parte_contratante'
  ];

  // Buscar en contractData por campos que contengan información del tercero
  for (const [key, value] of Object.entries(contractData)) {
    const keyLower = key.toLowerCase();

    // Si la clave contiene alguna palabra clave de tercero
    if (terceroKeywords.some(keyword => keyLower.includes(keyword))) {
      if (value && typeof value === 'string' && value.trim()) {
        info.tercero = value.trim();
        info.title = `Contrato con ${value.trim()}`;
        break;
      }
    }
  }

  // Si no encontró tercero por keywords, buscar en los campos de la plantilla
  if (!info.tercero && template && template.fields) {
    for (const field of template.fields) {
      const fieldName = field.field_name?.toLowerCase() || '';
      const fieldLabel = field.field_label?.toLowerCase() || '';

      if (terceroKeywords.some(keyword =>
        fieldName.includes(keyword) || fieldLabel.includes(keyword)
      )) {
        const value = contractData[field.field_name];
        if (value && typeof value === 'string' && value.trim()) {
          info.tercero = value.trim();
          info.title = `Contrato con ${value.trim()}`;
          break;
        }
      }
    }
  }

  // Crear descripción con todos los datos relevantes
  const descriptionParts = [];
  for (const [key, value] of Object.entries(contractData)) {
    if (value && typeof value === 'string' && value.trim()) {
      descriptionParts.push(`${key}: ${value.trim()}`);
    }
  }
  info.description = descriptionParts.join('; ');

  console.log('📋 Información del tercero extraída:', info);
  return info;
}

module.exports = router;
