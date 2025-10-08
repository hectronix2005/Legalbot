const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractYellowHighlightedFields, generateDocumentFromTemplate } = require('../utils/wordProcessor');

// Configurar multer para subida de archivos
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

// Obtener todas las plantillas
router.get('/', authenticate, async (req, res) => {
  try {
    const { company_id, contract_type_id, is_current } = req.query;
    
    let query = `
      SELECT t.*, 
             COALESCE(ct.name, t.category) as contract_type_name,
             t.category,
             u.name as created_by_name, 
             c.name as company_name
      FROM contract_templates t
      LEFT JOIN contract_types ct ON t.contract_type_id = ct.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN companies c ON t.company_id = c.id
      WHERE t.active = 1
    `;
    const params = [];

    if (company_id) {
      query += ' AND (t.company_id = ? OR t.company_id IS NULL)';
      params.push(company_id);
    }

    if (contract_type_id) {
      query += ' AND (t.contract_type_id = ? OR t.category = (SELECT name FROM contract_types WHERE id = ?))';
      params.push(contract_type_id, contract_type_id);
    }

    if (is_current) {
      query += ' AND t.is_current = 1';
    }

    query += ' ORDER BY t.created_at DESC';

    const templates = await db.all(query, params);
    res.json(templates);
  } catch (error) {
    console.error('Error al obtener plantillas:', error);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// Procesar archivo Word y extraer campos
router.post('/upload-word',
  authenticate,
  authorize('admin', 'lawyer'),
  upload.single('wordFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
      }

      // Leer el archivo
      const fileBuffer = fs.readFileSync(req.file.path);

      // Extraer campos del documento
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
      // Eliminar archivo si hubo error
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message || 'Error al procesar el archivo Word' });
    }
  }
);

// Obtener una plantilla con sus campos
router.get('/:id', authenticate, async (req, res) => {
  try {
    const template = await db.get(`
      SELECT t.*, ct.name as contract_type_name, u.name as created_by_name
      FROM contract_templates t
      LEFT JOIN contract_types ct ON t.contract_type_id = ct.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Obtener campos de la plantilla
    const fields = await db.all(
      'SELECT * FROM template_fields WHERE template_id = ? ORDER BY display_order',
      [req.params.id]
    );

    template.fields = fields;
    res.json(template);
  } catch (error) {
    console.error('Error al obtener plantilla:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

// Crear plantilla (admin y lawyer) - Soporta Word
router.post('/',
  authenticate,
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

      const { name, description, contract_type_id, category, content, company_id, fields, wordFilePath, wordFileOriginalName } = req.body;

      // Validar que haya contenido o archivo Word
      if (!content && !wordFilePath) {
        return res.status(400).json({ error: 'Debe proporcionar contenido o un archivo Word' });
      }

      // Crear plantilla
      const result = await db.run(
        `INSERT INTO contract_templates 
        (name, description, contract_type_id, category, content, company_id, created_by, version, word_file_path, word_file_original_name) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [name, description, contract_type_id || null, category || null, content || '', company_id || null, req.user.id, wordFilePath || null, wordFileOriginalName || null]
      );

      const templateId = result.id;

      // Guardar campos si existen
      if (fields && Array.isArray(fields)) {
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          await db.run(
            `INSERT INTO template_fields 
            (template_id, field_name, field_label, field_type, field_options, required, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              templateId,
              field.field_name,
              field.field_label,
              field.field_type,
              field.field_options ? JSON.stringify(field.field_options) : null,
              field.required ? 1 : 0,
              i
            ]
          );
        }
      }

      // Registrar en historial de versiones
      await db.run(
        'INSERT INTO version_history (template_id, version, content, changes_description, created_by) VALUES (?, ?, ?, ?, ?)',
        [templateId, 1, content, 'Versión inicial', req.user.id]
      );

      // Log de actividad
      await db.run(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'CREATE', 'template', templateId, `Creó la plantilla: ${name}`]
      );

      res.status(201).json({ 
        message: 'Plantilla creada exitosamente',
        id: templateId 
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
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { content, changes_description, fields } = req.body;
      const templateId = req.params.id;

      // Obtener plantilla actual
      const currentTemplate = await db.get('SELECT * FROM contract_templates WHERE id = ?', [templateId]);
      
      if (!currentTemplate) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      const newVersion = currentTemplate.version + 1;

      // Actualizar plantilla
      await db.run(
        'UPDATE contract_templates SET content = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [content, newVersion, templateId]
      );

      // Actualizar campos si se proporcionan
      if (fields && Array.isArray(fields)) {
        // Eliminar campos anteriores
        await db.run('DELETE FROM template_fields WHERE template_id = ?', [templateId]);
        
        // Insertar nuevos campos
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          await db.run(
            `INSERT INTO template_fields 
            (template_id, field_name, field_label, field_type, field_options, required, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              templateId,
              field.field_name,
              field.field_label,
              field.field_type,
              field.field_options ? JSON.stringify(field.field_options) : null,
              field.required ? 1 : 0,
              i
            ]
          );
        }
      }

      // Guardar en historial
      await db.run(
        'INSERT INTO version_history (template_id, version, content, changes_description, created_by) VALUES (?, ?, ?, ?, ?)',
        [templateId, newVersion, content, changes_description || 'Actualización de plantilla', req.user.id]
      );

      // Log de actividad
      await db.run(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'UPDATE', 'template', templateId, `Actualizó plantilla a versión ${newVersion}`]
      );

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
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const versions = await db.all(`
      SELECT v.*, u.name as created_by_name
      FROM version_history v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE v.template_id = ?
      ORDER BY v.version DESC
    `, [req.params.id]);

    res.json(versions);
  } catch (error) {
    console.error('Error al obtener versiones:', error);
    res.status(500).json({ error: 'Error al obtener versiones' });
  }
});

// Desactivar plantilla
router.delete('/:id', authenticate, authorize('admin', 'lawyer'), async (req, res) => {
  try {
    await db.run('UPDATE contract_templates SET active = 0 WHERE id = ?', [req.params.id]);
    
    await db.run(
      'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'DELETE', 'template', req.params.id, 'Desactivó plantilla']
    );

    res.json({ message: 'Plantilla desactivada exitosamente' });
  } catch (error) {
    console.error('Error al desactivar plantilla:', error);
    res.status(500).json({ error: 'Error al desactivar plantilla' });
  }
});

module.exports = router;

