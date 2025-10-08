const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractYellowHighlightedFields } = require('../utils/wordProcessor');

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/contract-types');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'contract-type-' + uniqueSuffix + path.extname(file.originalname));
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

// Obtener todos los tipos de contrato
router.get('/', authenticate, async (req, res) => {
  try {
    const types = await db.all('SELECT * FROM contract_types WHERE active = 1 ORDER BY name');
    res.json(types);
  } catch (error) {
    console.error('Error al obtener tipos de contrato:', error);
    res.status(500).json({ error: 'Error al obtener tipos de contrato' });
  }
});

// Procesar archivo Word para tipo de contrato
router.post('/upload-word',
  authenticate,
  authorize('admin'),
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
        fields: result.fields,
        content: result.content,
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

// Crear tipo de contrato (solo admin)
router.post('/',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, category, wordFilePath, wordFileOriginalName, detectedFields } = req.body;

      const result = await db.run(
        `INSERT INTO contract_types 
        (name, description, category, word_file_path, word_file_original_name, detected_fields) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name, 
          description, 
          category, 
          wordFilePath || null, 
          wordFileOriginalName || null,
          detectedFields ? JSON.stringify(detectedFields) : null
        ]
      );

      res.status(201).json({ 
        message: 'Tipo de contrato creado exitosamente',
        id: result.id 
      });
    } catch (error) {
      console.error('Error al crear tipo de contrato:', error);
      res.status(500).json({ error: 'Error al crear tipo de contrato' });
    }
  }
);

// Actualizar tipo de contrato (solo admin)
router.put('/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { name, description, category, wordFilePath, wordFileOriginalName, detectedFields } = req.body;

      await db.run(
        `UPDATE contract_types 
        SET name = ?, description = ?, category = ?, word_file_path = ?, word_file_original_name = ?, detected_fields = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [
          name, 
          description, 
          category, 
          wordFilePath || null, 
          wordFileOriginalName || null,
          detectedFields ? JSON.stringify(detectedFields) : null,
          req.params.id
        ]
      );

      res.json({ message: 'Tipo de contrato actualizado exitosamente' });
    } catch (error) {
      console.error('Error al actualizar tipo de contrato:', error);
      res.status(500).json({ error: 'Error al actualizar tipo de contrato' });
    }
  }
);

// Desactivar tipo de contrato (solo admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.run('UPDATE contract_types SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tipo de contrato desactivado exitosamente' });
  } catch (error) {
    console.error('Error al desactivar tipo de contrato:', error);
    res.status(500).json({ error: 'Error al desactivar tipo de contrato' });
  }
});

module.exports = router;

