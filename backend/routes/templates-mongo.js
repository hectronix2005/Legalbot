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
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');
const cloudStorage = require('../services/cloudStorageService');

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

// Obtener tipos de terceros disponibles (ahora desde la base de datos, no solo los hardcodeados)
router.get('/third-party-types', authenticate, async (req, res) => {
  try {
    const filter = { active: true };

    // Super admin ve todos, otros usuarios ven solo los de su empresa o globales
    if (req.user.role !== 'super_admin' && req.companyId) {
      filter.$or = [
        { company: req.companyId },
        { company: null } // Tipos globales
      ];
    }

    console.log('🔍 [DEBUG /templates/third-party-types] Fetching types with filter:', JSON.stringify(filter));
    console.log('🔍 [DEBUG /templates/third-party-types] User role:', req.user.role, 'CompanyId:', req.companyId);

    const types = await ThirdPartyTypeConfig.find(filter)
      .select('code label icon description fields')
      .sort({ label: 1 })
      .lean();

    console.log('✅ [DEBUG /templates/third-party-types] Types found:', types.length);
    console.log('📋 [DEBUG /templates/third-party-types] Type codes:', types.map(t => t.code).join(', '));

    // Formatear para coincidir con el formato esperado por el frontend
    const formattedTypes = types.map(t => ({
      value: t.code,
      label: t.label,
      description: t.description || '',
      icon: t.icon || '📄'
    }));

    res.json(formattedTypes);
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

    // Si companyId es "ALL", mostrar todas las plantillas activas
    // Si no, filtrar por plantillas de la empresa O plantillas compartidas
    const filter = { active: true };

    if (req.companyId && req.companyId !== 'ALL') {
      filter.$or = [
        { company: req.companyId },      // Plantillas de la empresa
        { is_shared: true }              // Plantillas compartidas (super_admin)
      ];
    }

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
  authorize('super_admin', 'admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const result = await extractYellowHighlightedFields(fileBuffer);

      // Upload to Cloudinary for persistent storage
      let cloudinaryData = null;
      try {
        cloudinaryData = await cloudStorage.uploadFile(req.file.path, req.file.originalname);
        console.log('☁️  Archivo subido a Cloudinary:', cloudinaryData?.url);
      } catch (cloudError) {
        console.warn('⚠️  No se pudo subir a Cloudinary (continuando con almacenamiento local):', cloudError.message);
      }

      res.json({
        success: true,
        filePath: req.file.path,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        content: result.content,
        fields: result.fields,
        messages: result.messages,
        // Cloud storage info
        cloudinaryUrl: cloudinaryData?.url || null,
        cloudinaryPublicId: cloudinaryData?.publicId || null
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

    // Check if template has a file (local or cloud)
    if (!template.word_file_path && !template.cloudinary_url) {
      return res.status(404).json({ error: 'Esta plantilla no tiene un archivo Word asociado' });
    }

    console.log('📥 Descargando archivo Word de plantilla:', template.name);

    // If cloudinary URL exists, redirect to it
    if (template.cloudinary_url) {
      console.log('☁️  Redirigiendo a Cloudinary:', template.cloudinary_url);
      return res.redirect(template.cloudinary_url);
    }

    // Check if local file exists
    if (!fs.existsSync(template.word_file_path)) {
      return res.status(404).json({
        error: 'El archivo Word no se encuentra en el servidor. Puede que se haya perdido tras un reinicio.',
        suggestion: 'Por favor, vuelva a subir el archivo usando "Reemplazar Word"'
      });
    }

    console.log('📁 Ruta local:', template.word_file_path);

    // Enviar el archivo local
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
  authorize('super_admin', 'admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo Word' });
      }

      // Buscar plantilla - permitir super_admin acceder a todas
      let templateQuery = { _id: req.params.id };
      if (req.user.role !== 'super_admin') {
        templateQuery.$or = [
          { company: req.companyId },
          { is_shared: true }
        ];
      }

      const template = await ContractTemplate.findOne(templateQuery);

      if (!template) {
        // Limpiar archivo subido
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Plantilla no encontrada o no tienes permiso para editarla' });
      }

      console.log('🔄 Reemplazando archivo Word de plantilla:', template.name);
      console.log('📁 Archivo anterior (local):', template.word_file_path);
      console.log('☁️  Archivo anterior (cloud):', template.cloudinary_url);
      console.log('📁 Archivo nuevo:', req.file.path);

      // Delete old file from Cloudinary if exists
      if (template.cloudinary_public_id) {
        try {
          await cloudStorage.deleteFile(template.cloudinary_public_id);
          console.log('☁️  Archivo anterior eliminado de Cloudinary');
        } catch (cloudError) {
          console.warn('⚠️  No se pudo eliminar archivo anterior de Cloudinary:', cloudError.message);
        }
      }

      // Eliminar archivo local anterior si existe
      if (template.word_file_path && fs.existsSync(template.word_file_path)) {
        try {
          fs.unlinkSync(template.word_file_path);
          console.log('✅ Archivo local anterior eliminado');
        } catch (error) {
          console.log('⚠️  No se pudo eliminar el archivo local anterior:', error);
        }
      }

      // Upload new file to Cloudinary
      let cloudinaryData = null;
      try {
        cloudinaryData = await cloudStorage.uploadFile(req.file.path, req.file.originalname);
        console.log('☁️  Nuevo archivo subido a Cloudinary:', cloudinaryData?.url);
      } catch (cloudError) {
        console.warn('⚠️  No se pudo subir a Cloudinary (continuando con almacenamiento local):', cloudError.message);
      }

      // Actualizar plantilla con nuevo archivo
      template.word_file_path = req.file.path;
      template.word_file_original_name = req.file.originalname;
      template.cloudinary_url = cloudinaryData?.url || null;
      template.cloudinary_public_id = cloudinaryData?.publicId || null;
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
        template: template,
        cloudStorage: cloudinaryData ? 'uploaded' : 'local_only'
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
  authorize('super_admin', 'admin', 'lawyer'),
  async (req, res) => {
    try {
      const { contractData } = req.body;

      if (!contractData || typeof contractData !== 'object') {
        return res.status(400).json({ error: 'Se requieren los datos del contrato' });
      }

      // Buscar plantilla
      const filter = { _id: req.params.id };

      console.log('🔍 [generate-contract] Buscando plantilla con ID:', req.params.id);
      console.log('🔍 [generate-contract] User role:', req.user.role, 'CompanyId:', req.companyId);

      // Si es super_admin, puede acceder a cualquier plantilla
      // Si no, filtrar por company o plantillas compartidas
      if (req.user.role !== 'super_admin') {
        if (req.companyId && req.companyId !== 'ALL') {
          filter.$or = [
            { company: req.companyId },
            { is_shared: true }
          ];
        } else {
          filter.is_shared = true;
        }
      }

      console.log('🔍 [generate-contract] Filter:', JSON.stringify(filter));

      const template = await ContractTemplate.findOne(filter);

      console.log('🔍 [generate-contract] Template found:', template ? 'YES' : 'NO');
      if (template) {
        console.log('🔍 [generate-contract] Template name:', template.name);
        console.log('🔍 [generate-contract] Template active:', template.active);
        console.log('🔍 [generate-contract] Template has word_file_path:', !!template.word_file_path);
      }

      if (!template) {
        // Intentar buscar sin filtro para debug
        const anyTemplate = await ContractTemplate.findById(req.params.id);
        if (anyTemplate) {
          console.log('⚠️ [generate-contract] Plantilla existe pero no pasa filtros:');
          console.log('  - active:', anyTemplate.active);
          console.log('  - company:', anyTemplate.company);
          console.log('  - is_shared:', anyTemplate.is_shared);
        } else {
          console.log('❌ [generate-contract] Plantilla NO existe en la base de datos');
        }
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      // Check if template file is available (local or cloud)
      if (!template.word_file_path && !template.cloudinary_url) {
        console.log('❌ [generate-contract] La plantilla no tiene archivo Word (local ni cloud)');
        return res.status(404).json({ error: 'Esta plantilla no tiene un archivo Word asociado. Por favor, suba un archivo Word a la plantilla.' });
      }

      console.log('🚀 GENERANDO CONTRATO DESDE PLANTILLA:', template.name);
      console.log('📝 Datos recibidos:', Object.keys(contractData).length, 'campos');
      console.log('📁 word_file_path:', template.word_file_path);
      console.log('☁️  cloudinary_url:', template.cloudinary_url);

      // Get template file buffer (from local or cloud)
      let templateBuffer;
      try {
        templateBuffer = await cloudStorage.getTemplateFileBuffer(template);
        console.log('✅ Template buffer obtenido, tamaño:', templateBuffer.length, 'bytes');
      } catch (bufferError) {
        console.error('❌ Error obteniendo archivo de plantilla:', bufferError.message);
        return res.status(404).json({
          error: 'No se pudo obtener el archivo Word de la plantilla. Por favor, vuelva a subir el archivo usando "Reemplazar Word".',
          details: bufferError.message
        });
      }

      // Preparar datos para Docxtemplater
      const PizZip = require('pizzip');
      const Docxtemplater = require('docxtemplater');
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
      console.log('📋 Información del tercero extraída:', terceroInfo);

      // Crear registro de contrato en BD
      const Contract = require('../models/Contract');

      // Preparar datos del nuevo contrato para BD
      const newContractRecord = {
        template: template._id,
        contract_number: contractNumber,
        title: terceroInfo.title || `Contrato ${contractNumber}`,
        content: '', // Podríamos generar HTML preview si es necesario
        description: terceroInfo.description || '',
        company_name: terceroInfo.tercero || '',
        file_path: contractFilePath,
        generated_by: req.user.id,
        status: 'active'
      };

      // Solo agregar company si es un ObjectId válido (no 'ALL')
      if (req.companyId && req.companyId !== 'ALL') {
        newContractRecord.company = req.companyId;
        console.log('🏢 Asignando companyId:', req.companyId);
      } else {
        console.log('⚠️  CompanyId es ALL o undefined, no se asigna company al contrato');
      }

      console.log('💾 Guardando contrato en BD...');
      const contract = await Contract.create(newContractRecord);

      console.log('✅ Contrato guardado en BD:', contract._id);

      // Registrar actividad
      const ActivityLog = require('../models/ActivityLog');
      const activityData = {
        user: req.user.id,
        action: 'GENERATE',
        entity_type: 'contract',
        entity_id: contract._id,
        description: `Generó contrato ${contractNumber} desde plantilla "${template.name}"`
      };

      // Solo agregar company al log si existe
      if (req.companyId && req.companyId !== 'ALL') {
        activityData.company = req.companyId;
      }

      await ActivityLog.create(activityData);
      console.log('📝 Actividad registrada');

      res.json({
        success: true,
        message: 'Contrato generado exitosamente',
        contract: {
          _id: contract._id,
          contract_number: contract.contract_number,
          title: contract.title,
          file_path: contract.file_path,
          status: contract.status,
          created_at: contract.createdAt
        },
        contractNumber: contractNumber
      });
    } catch (error) {
      console.error('❌ Error al generar contrato:', error);

      // Determinar el tipo de error y responder apropiadamente
      let errorMessage = 'Error al generar contrato';
      let statusCode = 500;

      if (error.name === 'ValidationError') {
        errorMessage = 'Error de validación: ' + Object.values(error.errors).map(e => e.message).join(', ');
        statusCode = 400;
      } else if (error.name === 'CastError') {
        errorMessage = 'Error de tipo de datos: ' + error.message;
        statusCode = 400;
      } else if (error.message && error.message.includes('ENOENT')) {
        errorMessage = 'No se pudo encontrar el archivo de la plantilla';
        statusCode = 404;
      } else if (error.message && error.message.includes('Docxtemplater')) {
        errorMessage = 'Error al procesar la plantilla Word: ' + error.message;
        statusCode = 500;
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error('📊 Detalles del error:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Copiar plantilla (duplicar)
router.post('/:id/copy', authenticate, verifyTenant, authorize('super_admin', 'admin', 'lawyer'), async (req, res) => {
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
  authorize('super_admin', 'admin', 'lawyer'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido')
  ],
  async (req, res) => {
    try {
      console.log('🔵 [POST /templates] Iniciando creación de plantilla');
      // DO NOT LOG PII - Use user ID instead of email (GDPR/CCPA compliance)
      console.log('🔵 User ID:', req.user?.id, 'Role:', req.user?.role, 'CompanyId:', req.companyId);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, category, content, fields, wordFilePath, wordFileOriginalName, is_shared, shared_with_companies, third_party_type, cloudinaryUrl, cloudinaryPublicId } = req.body;

      console.log('🔵 Template data:', {
        name,
        category,
        third_party_type,
        is_shared,
        shared_with_companies: shared_with_companies?.length || 0,
        hasWordFile: !!wordFilePath
      });

      if (!content && !wordFilePath) {
        return res.status(400).json({ error: 'Debe proporcionar contenido o un archivo Word' });
      }

      // Verificar permisos para plantillas compartidas
      if (is_shared && req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Solo el super administrador puede crear plantillas compartidas globalmente'
        });
      }

      // Verificar permisos para shared_with_companies
      if (shared_with_companies && shared_with_companies.length > 0) {
        if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
          return res.status(403).json({
            error: 'Solo administradores pueden compartir plantillas con empresas específicas'
          });
        }
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
        // Cloud storage fields
        cloudinary_url: cloudinaryUrl || null,
        cloudinary_public_id: cloudinaryPublicId || null,
        version: 1,
        is_shared: is_shared || false
      };

      // Manejar compartición de plantillas
      if (is_shared) {
        // Plantilla compartida con todas las empresas (solo super_admin)
        console.log('🌐 Creando plantilla compartida con todas las empresas');
      } else if (shared_with_companies && Array.isArray(shared_with_companies) && shared_with_companies.length > 0) {
        // Plantilla compartida con empresas específicas
        templateData.shared_with_companies = shared_with_companies;
        templateData.is_shared = false;
        // Asignar la primera empresa como company principal (requerido por el modelo)
        templateData.company = shared_with_companies[0];
        console.log('🏢 Compartiendo plantilla con empresas:', shared_with_companies.length);
      } else {
        // Plantilla solo para una empresa específica
        // Verificar que companyId existe y no es "ALL"
        if (req.companyId && req.companyId !== 'ALL') {
          templateData.company = req.companyId;
          console.log('🏢 Plantilla para empresa específica:', req.companyId);
        } else {
          console.warn('⚠️  Usuario sin companyId válido intentando crear plantilla no compartida');
          console.warn('⚠️  CompanyId:', req.companyId, 'Role:', req.user.role);

          // Si es super_admin sin company específica, convertir a plantilla compartida
          if (req.user.role === 'super_admin') {
            console.log('🔄 Convirtiendo plantilla a compartida (super_admin)');
            templateData.is_shared = true;
          } else {
            return res.status(400).json({
              error: 'Debe especificar una empresa válida o seleccionar empresas para compartir'
            });
          }
        }
      }

      console.log('🔵 Creating template with data:', JSON.stringify(templateData, null, 2));

      const template = await ContractTemplate.create(templateData);

      console.log('✅ Template created with ID:', template._id);

      // Guardar en historial
      await VersionHistory.create({
        template: template._id,
        version: 1,
        content: content || '',
        changes_description: 'Versión inicial',
        created_by: req.user.id
      });

      // Log de actividad
      const activityLogData = {
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Creó la plantilla: ${name}`
      };

      // Solo agregar company si existe
      if (req.companyId) {
        activityLogData.company = req.companyId;
      }

      await ActivityLog.create(activityLogData);

      console.log('✅ Template creation completed successfully');

      res.status(201).json({
        message: 'Plantilla creada exitosamente',
        id: template._id
      });
    } catch (error) {
      console.error('❌ Error al crear plantilla:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      res.status(500).json({ error: 'Error al crear plantilla: ' + error.message });
    }
  }
);

// Actualizar plantilla (crea nueva versión)
router.put('/:id',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin', 'lawyer'),
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
router.delete('/:id', authenticate, verifyTenant, authorize('super_admin', 'admin', 'lawyer'), async (req, res) => {
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

// ========================================
// ENDPOINTS PARA GESTIÓN DE PERMISOS Y COMPARTICIÓN
// ========================================

// Copiar una plantilla (super_admin puede convertir plantilla de empresa en general)
router.post('/:id/copy', authenticate, verifyTenant, authorize('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { makeShared, targetCompanyIds, newName } = req.body;

    // Buscar la plantilla original
    const originalTemplate = await ContractTemplate.findById(id)
      .populate('company', 'name')
      .populate('created_by', 'name email');

    if (!originalTemplate) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Crear copia de la plantilla
    const templateCopy = {
      name: newName || `${originalTemplate.name} (Copia)`,
      description: originalTemplate.description,
      category: originalTemplate.category,
      third_party_type: originalTemplate.third_party_type,
      content: originalTemplate.content,
      fields: originalTemplate.fields,
      version: 1,
      is_current: true,
      is_shared: makeShared || false,
      shared_with_companies: (!makeShared && targetCompanyIds) ? targetCompanyIds : [],
      company: makeShared ? null : req.companyId,
      created_by: req.user.id,
      can_edit_roles: makeShared ? ['super_admin'] : ['super_admin', 'admin', 'lawyer'],
      is_copy: true,
      copied_from: originalTemplate._id,
      active: true
    };

    const newTemplate = await ContractTemplate.create(templateCopy);

    await ActivityLog.create({
      user: req.user.id,
      action: 'COPY_TEMPLATE',
      entity_type: 'template',
      entity_id: newTemplate._id,
      description: `Copió la plantilla "${originalTemplate.name}" como "${newTemplate.name}"${makeShared ? ' (compartida con todas las empresas)' : ''}`,
      company: req.companyId
    });

    res.status(201).json({
      success: true,
      message: 'Plantilla copiada exitosamente',
      template: newTemplate
    });
  } catch (error) {
    console.error('Error al copiar plantilla:', error);
    res.status(500).json({ error: 'Error al copiar plantilla' });
  }
});

// Actualizar configuración de compartición de una plantilla
router.put('/:id/sharing', authenticate, verifyTenant, authorize('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_shared, shared_with_companies } = req.body;

    const template = await ContractTemplate.findById(id);

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Solo super_admin puede modificar configuración de compartición
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Solo super_admin puede modificar la configuración de compartición'
      });
    }

    // Actualizar configuración
    if (typeof is_shared !== 'undefined') {
      template.is_shared = is_shared;
      template.can_edit_roles = is_shared ? ['super_admin'] : ['super_admin', 'admin', 'lawyer'];

      if (is_shared) {
        template.shared_with_companies = [];
        template.company = null;
      }
    }

    if (shared_with_companies && !is_shared) {
      template.shared_with_companies = shared_with_companies;
    }

    await template.save();

    await ActivityLog.create({
      user: req.user.id,
      action: 'UPDATE_SHARING',
      entity_type: 'template',
      entity_id: template._id,
      description: `Actualizó configuración de compartición de plantilla "${template.name}"`,
      company: req.companyId
    });

    res.json({
      success: true,
      message: 'Configuración de compartición actualizada',
      template
    });
  } catch (error) {
    console.error('Error al actualizar compartición:', error);
    res.status(500).json({ error: 'Error al actualizar configuración de compartición' });
  }
});

// Verificar permisos de edición de una plantilla
router.get('/:id/can-edit', authenticate, verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const template = await ContractTemplate.findById(id)
      .populate('created_by', 'name email')
      .populate('company', 'name');

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    let canEdit = false;
    let reason = '';

    // Super admin puede editar plantillas compartidas que él creó
    if (req.user.role === 'super_admin') {
      if (template.is_shared && template.created_by._id.toString() === req.user.id) {
        canEdit = true;
        reason = 'Creador de plantilla compartida';
      } else if (!template.is_shared) {
        canEdit = true;
        reason = 'Super admin con acceso a todas las plantillas';
      } else {
        canEdit = false;
        reason = 'Super admin solo puede editar plantillas compartidas que él creó';
      }
    }
    // Admin y lawyer pueden editar plantillas de su empresa
    else if (template.can_edit_roles.includes(req.user.role)) {
      if (template.company && template.company._id.toString() === req.companyId) {
        canEdit = true;
        reason = 'Plantilla de su empresa';
      } else {
        canEdit = false;
        reason = 'Plantilla no pertenece a su empresa';
      }
    } else {
      canEdit = false;
      reason = 'Rol sin permisos de edición';
    }

    res.json({
      success: true,
      canEdit,
      reason,
      template: {
        id: template._id,
        name: template.name,
        is_shared: template.is_shared,
        company: template.company,
        created_by: template.created_by
      }
    });
  } catch (error) {
    console.error('Error al verificar permisos:', error);
    res.status(500).json({ error: 'Error al verificar permisos de edición' });
  }
});

module.exports = router;

