const express = require('express');
const router = express.Router();
const multer = require('multer');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const ContractTemplate = require('../models/ContractTemplate');
const Contract = require('../models/Contract');
const ActivityLog = require('../models/ActivityLog');

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
        company: req.user.company_id || null,
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
  // Limpiar el marker de caracteres especiales
  const cleanMarker = marker
    .replace(/<[^>]*>/g, '') // Remover HTML tags
    .replace(/[^\w\s]/g, '') // Remover caracteres especiales
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_'); // Reemplazar espacios con guiones bajos
  
  // Si el marker está muy limpio, usarlo directamente
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
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo' });
      }

      const filePath = req.file.path;
      console.log('📄 PROCESANDO WORD CON FORMATO COMPLETO:', req.file.originalname);
      
      // Leer el documento Word preservando formato
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
          "p[style-name='Footnote Text'] => p.footnote:fresh"
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
      console.log('📄 HTML con formato preservado, longitud:', html.length);
      
      // Detectar variables manteniendo el HTML original
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
        previewHtml: html.substring(0, 2000) + '...',
        message: `Se detectaron ${variables.length} variables con formato preservado`,
        requiresFieldNames: true,
        preserveFormat: true
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
        company: req.user.company_id || null,
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
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    console.log('🚀 INICIANDO PROCESO UNIFICADO: PLANTILLA + CONTRATO');
    console.log('==================================================');
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo Word' });
      }

      const { name, description, contractData } = req.body;
      
      if (!name || !contractData) {
        return res.status(400).json({ 
          error: 'Se requieren: nombre de plantilla y datos del contrato' 
        });
      }

      console.log('📝 DATOS RECIBIDOS:');
      console.log('  - Plantilla:', name);
      console.log('  - Descripción:', description);
      console.log('  - Archivo:', req.file.originalname);
      console.log('  - Datos contrato:', Object.keys(JSON.parse(contractData)).length, 'campos');

      // 1. PROCESAR ARCHIVO WORD Y DETECTAR VARIABLES
      console.log('🔍 PASO 1: PROCESANDO ARCHIVO WORD...');
      
      const result = await mammoth.convertToHtml({ 
        path: req.file.path,
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
      console.log('✅ HTML generado, longitud:', html.length);

      // 2. DETECTAR VARIABLES CON LÓGICA MEJORADA
      console.log('🔍 PASO 2: DETECTANDO VARIABLES...');
      const variables = detectVariablesFromHtml(html);
      console.log('✅ Variables detectadas:', variables.length);

      // 3. CREAR PLANTILLA EN LA BASE DE DATOS
      console.log('🏗️ PASO 3: CREANDO PLANTILLA...');
      
      const templateData = {
        name,
        description: description || '',
        category: 'Confidencialidad',
        content: html,
        fields: variables.map((variable, index) => ({
          field_name: variable.field_name,
          field_label: variable.original_marker || variable.field_name,
          field_type: variable.type,
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
        company: req.user.company_id || null,
        created_by: req.user.id,
        word_file_path: req.file.filename,
        word_file_original_name: req.file.originalname,
        version: 1,
        is_current: true,
        active: true
      };
      
      const template = await ContractTemplate.create(templateData);
      console.log('✅ Plantilla creada:', template._id);

      // 4. GENERAR CONTRATO INMEDIATAMENTE
      console.log('📄 PASO 4: GENERANDO CONTRATO...');
      
      const contractDataParsed = JSON.parse(contractData);
      const contractNumber = `CON-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Procesar contenido con datos del contrato
      let contractContent = html;
      for (const [key, value] of Object.entries(contractDataParsed)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        contractContent = contractContent.replace(regex, value);
      }

      // Crear contrato
      const contract = await Contract.create({
        template: template._id,
        contract_number: contractNumber,
        content: contractContent,
        generated_by: req.user.id,
        status: 'active'
      });
      
      console.log('✅ Contrato generado:', contract._id);

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

      // 6. LIMPIAR ARCHIVO TEMPORAL
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Archivo temporal eliminado');
      } catch (cleanupError) {
        console.log('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
      }

      console.log('🎉 PROCESO UNIFICADO COMPLETADO EXITOSAMENTE');
      console.log('===========================================');

      res.status(201).json({
        message: 'Plantilla creada y contrato generado exitosamente',
        template: {
          id: template._id,
          name: template.name,
          fields_count: template.fields.length
        },
        contract: {
          id: contract._id,
          contract_number: contractNumber,
          status: contract.status
        },
        variables_detected: variables.length,
        unified_process: true
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

module.exports = router;
