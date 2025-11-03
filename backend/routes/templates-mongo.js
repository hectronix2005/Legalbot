const express = require('express');
const router = express.Router();
const { authenticate, authorize, verifyTenant } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractYellowHighlightedFields } = require('../utils/wordProcessor');
const ContractTemplate = require('../models/ContractTemplate');
const VersionHistory = require('../models/VersionHistory');
const ActivityLog = require('../models/ActivityLog');
const { getAllThirdPartyTypes, getThirdPartyConfig } = require('../config/thirdPartyTypes');

// Configurar multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/templates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'template-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.docx' && ext !== '.doc') {
      return cb(new Error('Solo se permiten archivos Word (.doc, .docx)'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Obtener tipos de terceros disponibles
router.get('/third-party-types', authenticate, (req, res) => {
  try {
    const types = getAllThirdPartyTypes();
    res.json(types);
  } catch (error) {
    console.error('Error al obtener tipos de terceros:', error);
    res.status(500).json({ error: 'Error al obtener tipos de terceros' });
  }
});

// Obtener configuración de un tipo de tercero específico
router.get('/third-party-types/:type', authenticate, (req, res) => {
  try {
    const config = getThirdPartyConfig(req.params.type);
    res.json(config);
  } catch (error) {
    console.error('Error al obtener configuración de tipo de tercero:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// Obtener todas las plantillas de la empresa + plantillas compartidas
router.get('/', authenticate, verifyTenant, async (req, res) => {
  try {
    const { category, is_current } = req.query;

    // Filtrar por plantillas de la empresa O plantillas compartidas
    const filter = {
      active: true,
      $or: [
        { company: req.companyId },      // Plantillas de la empresa
        { is_shared: true }              // Plantillas compartidas (super_admin)
      ]
    };

    if (category) {
      filter.category = category;
    }

    if (is_current) {
      filter.is_current = true;
    }

    const templates = await ContractTemplate.find(filter)
      .populate('created_by', 'name')
      .populate('company', 'name')
      .sort({ createdAt: -1 });

    res.json(templates);
  } catch (error) {
    console.error('Error al obtener plantillas:', error);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// Procesar archivo Word
router.post('/upload-word',
  authenticate,
  verifyTenant,
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const result = await extractYellowHighlightedFields(fileBuffer);

      res.json({
        success: true,
        filePath: req.file.path,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        content: result.content,
        fields: result.fields,
        messages: result.messages
      });
    } catch (error) {
      console.error('Error al procesar archivo Word:', error);
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message || 'Error al procesar el archivo Word' });
    }
  }
);

// Obtener una plantilla específica (de la empresa o compartida)
router.get('/:id', authenticate, verifyTenant, async (req, res) => {
  try {
    // Buscar plantilla si pertenece a la empresa o es compartida
    const template = await ContractTemplate.findOne({
      _id: req.params.id,
      $or: [
        { company: req.companyId },      // Plantilla de la empresa
        { is_shared: true }              // Plantilla compartida
      ]
    })
      .populate('created_by', 'name')
      .populate('company', 'name');

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada o no tiene acceso a ella' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error al obtener plantilla:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

// Descargar archivo Word original de la plantilla
router.get('/:id/download-word', authenticate, verifyTenant, async (req, res) => {
  try {
    const template = await ContractTemplate.findOne({
      _id: req.params.id,
      $or: [
        { company: req.companyId },
        { is_shared: true }
      ]
    });

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    if (!template.word_file_path) {
      return res.status(404).json({ error: 'Esta plantilla no tiene un archivo Word asociado' });
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(template.word_file_path)) {
      return res.status(404).json({ error: 'El archivo Word no se encuentra en el servidor' });
    }

    console.log('📥 Descargando archivo Word de plantilla:', template.name);
    console.log('📁 Ruta:', template.word_file_path);

    // Enviar el archivo
    res.download(template.word_file_path, template.word_file_original_name || `${template.name}.docx`, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error al descargar el archivo' });
        }
      }
    });
  } catch (error) {
    console.error('Error al descargar Word de plantilla:', error);
    res.status(500).json({ error: 'Error al descargar archivo Word' });
  }
});

// Reemplazar archivo Word de la plantilla
router.post('/:id/replace-word',
  authenticate,
  verifyTenant,
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo Word' });
      }

      // Buscar plantilla
      const template = await ContractTemplate.findOne({
        _id: req.params.id,
        company: req.companyId // Solo puede reemplazar plantillas de su empresa
      });

      if (!template) {
        // Limpiar archivo subido
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Plantilla no encontrada o no tienes permiso para editarla' });
      }

      console.log('🔄 Reemplazando archivo Word de plantilla:', template.name);
      console.log('📁 Archivo anterior:', template.word_file_path);
      console.log('📁 Archivo nuevo:', req.file.path);

      // Eliminar archivo anterior si existe
      if (template.word_file_path && fs.existsSync(template.word_file_path)) {
        try {
          fs.unlinkSync(template.word_file_path);
          console.log('✅ Archivo anterior eliminado');
        } catch (error) {
          console.log('⚠️  No se pudo eliminar el archivo anterior:', error);
        }
      }

      // Actualizar plantilla con nuevo archivo
      template.word_file_path = req.file.path;
      template.word_file_original_name = req.file.originalname;
      await template.save();

      console.log('✅ Archivo Word reemplazado exitosamente');

      // Registrar actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'UPDATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Reemplazó el archivo Word de la plantilla "${template.name}"`
      });

      res.json({
        message: 'Archivo Word reemplazado exitosamente',
        template: template
      });
    } catch (error) {
      console.error('Error al reemplazar archivo Word:', error);

      // Limpiar archivo subido en caso de error
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.log('⚠️  No se pudo eliminar archivo temporal:', cleanupError);
        }
      }

      res.status(500).json({ error: 'Error al reemplazar archivo Word' });
    }
  }
);

// Generar contrato desde plantilla existente
router.post('/:id/generate-contract',
  authenticate,
  verifyTenant,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { contractData } = req.body;

      if (!contractData || typeof contractData !== 'object') {
        return res.status(400).json({ error: 'Se requieren los datos del contrato' });
      }

      // Buscar plantilla
      const template = await ContractTemplate.findOne({
        _id: req.params.id,
        $or: [
          { company: req.companyId },
          { is_shared: true }
        ]
      });

      if (!template) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      if (!template.word_file_path || !fs.existsSync(template.word_file_path)) {
        return res.status(404).json({ error: 'El archivo Word de la plantilla no existe' });
      }

      console.log('🚀 GENERANDO CONTRATO DESDE PLANTILLA:', template.name);
      console.log('📝 Datos recibidos:', Object.keys(contractData).length, 'campos');

      // Preparar datos para Docxtemplater
      const PizZip = require('pizzip');
      const Docxtemplater = require('docxtemplater');

      const templateBuffer = fs.readFileSync(template.word_file_path);
      const zip = new PizZip(templateBuffer);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '{{',
          end: '}}'
        },
        nullGetter: function(part) {
          console.log(`⚠️  Variable sin valor: {{${part.value}}}`);
          return '';
        }
      });

      // Mapear datos del contrato a los marcadores de la plantilla
      const mappedData = {};

      // Intentar mapear field_name directamente a markers
      template.fields.forEach(field => {
        const fieldName = field.field_name;
        const marker = field.original_marker || fieldName;

        if (contractData[fieldName]) {
          mappedData[marker] = contractData[fieldName];
          console.log(`  ✅ ${fieldName} -> {{${marker}}} = "${contractData[fieldName]}"`);
        }
      });

      console.log('🔧 Total de variables mapeadas:', Object.keys(mappedData).length);

      // Generar contrato
      try {
        doc.render(mappedData);
      } catch (error) {
        console.error('❌ Error en Docxtemplater:', error);
        throw error;
      }

      const contractBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      // Guardar contrato
      const contractsDir = path.join(__dirname, '../uploads/contracts');
      if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
      }

      const contractNumber = `CON-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const contractFileName = `contrato_${contractNumber}_${Date.now()}.docx`;
      const contractFilePath = path.join(contractsDir, contractFileName);
      fs.writeFileSync(contractFilePath, contractBuffer);

      console.log('✅ Contrato generado:', contractFileName);

      // Extraer información del tercero para búsqueda
      const terceroInfo = extractTerceroInfo(contractData, template);

      // Crear registro de contrato en BD
      const Contract = require('../models/Contract');
      const contract = await Contract.create({
        template: template._id,
        contract_number: contractNumber,
        title: terceroInfo.title || `Contrato ${contractNumber}`,
        content: '', // Podríamos generar HTML preview si es necesario
        description: terceroInfo.description || '',
        company_name: terceroInfo.tercero || '',
        file_path: contractFilePath,
        generated_by: req.user.id,
        company: req.companyId,
        status: 'active'
      });

      console.log('✅ Contrato guardado en BD:', contract._id);

      // Registrar actividad
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user: req.user.id,
        action: 'GENERATE',
        entity_type: 'contract',
        entity_id: contract._id,
        description: `Generó contrato ${contractNumber} desde plantilla "${template.name}"`
      });

      res.json({
        message: 'Contrato generado exitosamente',
        contract: contract,
        contractNumber: contractNumber
      });
    } catch (error) {
      console.error('Error al generar contrato:', error);
      res.status(500).json({ error: 'Error al generar contrato' });
    }
  }
);

// Copiar plantilla (duplicar)
router.post('/:id/copy', authenticate, verifyTenant, authorize('admin', 'lawyer'), async (req, res) => {
  try {
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'El nombre de la nueva plantilla es requerido' });
    }

    // Buscar plantilla original
    const originalTemplate = await ContractTemplate.findOne({
      _id: req.params.id,
      $or: [
        { company: req.companyId },
        { is_shared: true }
      ]
    });

    if (!originalTemplate) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    console.log('📋 Copiando plantilla:', originalTemplate.name);
    console.log('➡️  Nuevo nombre:', newName);

    // Copiar archivo Word si existe
    let newWordFilePath = null;
    let newWordFileOriginalName = null;

    if (originalTemplate.word_file_path && fs.existsSync(originalTemplate.word_file_path)) {
      const templatesDir = path.join(__dirname, '../uploads/templates');
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }

      // Generar nuevo nombre de archivo
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(originalTemplate.word_file_path);
      const newFileName = `template-${uniqueSuffix}${ext}`;
      newWordFilePath = path.join(templatesDir, newFileName);

      // Copiar el archivo
      fs.copyFileSync(originalTemplate.word_file_path, newWordFilePath);
      newWordFileOriginalName = `${newName}${ext}`;

      console.log('📁 Archivo Word copiado:');
      console.log('  Original:', originalTemplate.word_file_path);
      console.log('  Nuevo:', newWordFilePath);
    }

    // Crear nueva plantilla con los mismos datos
    const newTemplateData = {
      name: newName.trim(),
      description: originalTemplate.description || `Copia de ${originalTemplate.name}`,
      category: originalTemplate.category,
      content: originalTemplate.content,
      fields: originalTemplate.fields,
      company: req.companyId,
      created_by: req.user.id,
      word_file_path: newWordFilePath,
      word_file_original_name: newWordFileOriginalName,
      version: 1,
      is_current: true,
      active: true,
      is_shared: false // La copia nunca es compartida por defecto
    };

    const newTemplate = await ContractTemplate.create(newTemplateData);

    console.log('✅ Plantilla copiada exitosamente:', newTemplate._id);

    // Registrar actividad
    await ActivityLog.create({
      user: req.user.id,
      action: 'COPY',
      entity_type: 'template',
      entity_id: newTemplate._id,
      description: `Copió plantilla "${originalTemplate.name}" como "${newName}"`
    });

    res.json({
      message: 'Plantilla copiada exitosamente',
      template: newTemplate
    });
  } catch (error) {
    console.error('Error al copiar plantilla:', error);
    res.status(500).json({ error: 'Error al copiar plantilla' });
  }
});

// Crear plantilla para la empresa o plantilla compartida (solo super_admin)
router.post('/',
  authenticate,
  verifyTenant,
  authorize('admin', 'lawyer'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, category, content, fields, wordFilePath, wordFileOriginalName, is_shared, third_party_type } = req.body;

      if (!content && !wordFilePath) {
        return res.status(400).json({ error: 'Debe proporcionar contenido o un archivo Word' });
      }

      // Verificar permisos para plantillas compartidas
      if (is_shared && req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Solo el super administrador puede crear plantillas compartidas'
        });
      }

      // Crear plantilla
      const templateData = {
        name,
        description,
        category,
        third_party_type: third_party_type || 'otro',
        content: content || '',
        fields: fields || [],
        created_by: req.user.id,
        word_file_path: wordFilePath || null,
        word_file_original_name: wordFileOriginalName || null,
        version: 1,
        is_shared: is_shared || false
      };

      // Si es plantilla compartida, no asignar empresa
      // Si no es compartida, asignar la empresa del usuario
      if (!is_shared) {
        templateData.company = req.companyId;
      }

      const template = await ContractTemplate.create(templateData);

      // Guardar en historial
      await VersionHistory.create({
        template: template._id,
        version: 1,
        content: content || '',
        changes_description: 'Versión inicial',
        created_by: req.user.id
      });

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Creó la plantilla: ${name}`
      });

      res.status(201).json({ 
        message: 'Plantilla creada exitosamente',
        id: template._id 
      });
    } catch (error) {
      console.error('Error al crear plantilla:', error);
      res.status(500).json({ error: 'Error al crear plantilla' });
    }
  }
);

// Actualizar plantilla (crea nueva versión)
router.put('/:id',
  authenticate,
  verifyTenant,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { content, changes_description, fields, name, description, category } = req.body;

      // Buscar plantilla
      const template = await ContractTemplate.findById(req.params.id);

      if (!template) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      // Verificar permisos
      if (template.is_shared) {
        // Solo super_admin puede editar plantillas compartidas
        if (req.user.role !== 'super_admin') {
          return res.status(403).json({
            error: 'Solo el super administrador puede editar plantillas compartidas'
          });
        }
      } else {
        // Para plantillas normales, verificar que pertenece a la empresa
        if (!template.company || template.company.toString() !== req.companyId.toString()) {
          return res.status(403).json({
            error: 'No tiene acceso a esta plantilla'
          });
        }
      }

      // Actualizar plantilla
      if (name !== undefined) template.name = name;
      if (description !== undefined) template.description = description;
      if (category !== undefined) template.category = category;
      if (fields) template.fields = fields;

      // Solo incrementar versión y crear historial si se modificó el contenido
      if (content !== undefined) {
        const newVersion = template.version + 1;
        template.content = content;
        template.version = newVersion;

        // Guardar en historial
        await VersionHistory.create({
          template: template._id,
          version: newVersion,
          content,
          changes_description: changes_description || 'Actualización de contenido de plantilla',
          created_by: req.user.id
        });
      }

      await template.save();

      // Log de actividad
      const updatedFields = [];
      if (name !== undefined) updatedFields.push('nombre');
      if (description !== undefined) updatedFields.push('descripción');
      if (category !== undefined) updatedFields.push('categoría');
      if (content !== undefined) updatedFields.push('contenido');

      await ActivityLog.create({
        user: req.user.id,
        action: 'UPDATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Actualizó plantilla: ${updatedFields.join(', ')}`
      });

      res.json({
        message: 'Plantilla actualizada exitosamente',
        version: template.version,
        template
      });
    } catch (error) {
      console.error('Error al actualizar plantilla:', error);
      res.status(500).json({ error: 'Error al actualizar plantilla' });
    }
  }
);

// Obtener historial de versiones
router.get('/:id/versions', authenticate, verifyTenant, async (req, res) => {
  try {
    // Buscar plantilla (de la empresa o compartida)
    const template = await ContractTemplate.findOne({
      _id: req.params.id,
      $or: [
        { company: req.companyId },      // Plantilla de la empresa
        { is_shared: true }              // Plantilla compartida
      ]
    });

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada o no tiene acceso a ella' });
    }

    const versions = await VersionHistory.find({ template: req.params.id })
      .populate('created_by', 'name')
      .sort({ version: -1 });

    res.json(versions);
  } catch (error) {
    console.error('Error al obtener versiones:', error);
    res.status(500).json({ error: 'Error al obtener versiones' });
  }
});

// Desactivar plantilla
router.delete('/:id', authenticate, verifyTenant, authorize('admin', 'lawyer'), async (req, res) => {
  try {
    // Buscar plantilla primero
    const template = await ContractTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Verificar permisos
    if (template.is_shared) {
      // Solo super_admin puede eliminar plantillas compartidas
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Solo el super administrador puede eliminar plantillas compartidas'
        });
      }
    } else {
      // Para plantillas normales, verificar que pertenece a la empresa
      if (!template.company || template.company.toString() !== req.companyId.toString()) {
        return res.status(403).json({
          error: 'No tiene acceso a esta plantilla'
        });
      }
    }

    // Desactivar plantilla
    template.active = false;
    await template.save();

    await ActivityLog.create({
      user: req.user.id,
      action: 'DELETE',
      entity_type: 'template',
      entity_id: req.params.id,
      description: `Desactivó plantilla${template.is_shared ? ' compartida' : ''}`,
      company: template.is_shared ? null : req.companyId
    });

    res.json({ message: 'Plantilla desactivada exitosamente' });
  } catch (error) {
    console.error('Error al desactivar plantilla:', error);
    res.status(500).json({ error: 'Error al desactivar plantilla' });
  }
});

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

