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

// Obtener todas las plantillas de la empresa
router.get('/', authenticate, verifyTenant, async (req, res) => {
  try {
    const { category, is_current } = req.query;

    // SIEMPRE filtrar por la empresa del usuario actual
    const filter = {
      active: true,
      company: req.companyId // Solo plantillas de la empresa del usuario
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

// Obtener una plantilla específica de la empresa
router.get('/:id', authenticate, verifyTenant, async (req, res) => {
  try {
    // Buscar plantilla solo si pertenece a la empresa del usuario
    const template = await ContractTemplate.findOne({
      _id: req.params.id,
      company: req.companyId // Verificar que pertenece a la empresa
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

// Crear plantilla para la empresa
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

      const { name, description, category, content, fields, wordFilePath, wordFileOriginalName } = req.body;

      if (!content && !wordFilePath) {
        return res.status(400).json({ error: 'Debe proporcionar contenido o un archivo Word' });
      }

      // Crear plantilla SIEMPRE para la empresa del usuario actual
      const template = await ContractTemplate.create({
        name,
        description,
        category,
        content: content || '',
        fields: fields || [],
        company: req.companyId, // SIEMPRE usar la empresa del usuario autenticado
        created_by: req.user.id,
        word_file_path: wordFilePath || null,
        word_file_original_name: wordFileOriginalName || null,
        version: 1
      });

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
      const { content, changes_description, fields } = req.body;

      // Buscar plantilla solo si pertenece a la empresa del usuario
      const template = await ContractTemplate.findOne({
        _id: req.params.id,
        company: req.companyId // Verificar que pertenece a la empresa
      });

      if (!template) {
        return res.status(404).json({ error: 'Plantilla no encontrada o no tiene acceso a ella' });
      }

      const newVersion = template.version + 1;

      // Actualizar plantilla
      template.content = content;
      template.version = newVersion;
      if (fields) template.fields = fields;
      await template.save();

      // Guardar en historial
      await VersionHistory.create({
        template: template._id,
        version: newVersion,
        content,
        changes_description: changes_description || 'Actualización de plantilla',
        created_by: req.user.id
      });

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'UPDATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Actualizó plantilla a versión ${newVersion}`
      });

      res.json({ 
        message: 'Plantilla actualizada exitosamente',
        version: newVersion 
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
    // Verificar que la plantilla pertenece a la empresa del usuario
    const template = await ContractTemplate.findOne({
      _id: req.params.id,
      company: req.companyId
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
    // Verificar que la plantilla pertenece a la empresa del usuario antes de desactivar
    const template = await ContractTemplate.findOneAndUpdate(
      {
        _id: req.params.id,
        company: req.companyId // Solo desactivar si pertenece a la empresa
      },
      { active: false },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada o no tiene acceso a ella' });
    }

    await ActivityLog.create({
      user: req.user.id,
      action: 'DELETE',
      entity_type: 'template',
      entity_id: req.params.id,
      description: 'Desactivó plantilla',
      company: req.companyId
    });

    res.json({ message: 'Plantilla desactivada exitosamente' });
  } catch (error) {
    console.error('Error al desactivar plantilla:', error);
    res.status(500).json({ error: 'Error al desactivar plantilla' });
  }
});

module.exports = router;

