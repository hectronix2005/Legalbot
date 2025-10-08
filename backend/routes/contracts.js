const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { generateDocumentFromTemplate } = require('../utils/wordProcessor');

// Obtener todos los contratos
router.get('/', authenticate, async (req, res) => {
  try {
    const { company_id, status } = req.query;
    
    let query = `
      SELECT c.*, 
             cr.title as request_title,
             ct.name as template_name,
             u.name as generated_by_name,
             comp.name as company_name
      FROM contracts c
      LEFT JOIN contract_requests cr ON c.request_id = cr.id
      LEFT JOIN contract_templates ct ON c.template_id = ct.id
      LEFT JOIN users u ON c.generated_by = u.id
      LEFT JOIN companies comp ON cr.company_id = comp.id
      WHERE 1=1
    `;
    const params = [];

    // Filtrar por empresa si el usuario no es admin
    if (req.user.role !== 'admin' && req.user.company_id) {
      query += ' AND cr.company_id = ?';
      params.push(req.user.company_id);
    } else if (company_id) {
      query += ' AND cr.company_id = ?';
      params.push(company_id);
    }

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ' ORDER BY c.created_at DESC';

    const contracts = await db.all(query, params);
    res.json(contracts);
  } catch (error) {
    console.error('Error al obtener contratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
});

// Obtener un contrato específico
router.get('/:id', authenticate, async (req, res) => {
  try {
    const contract = await db.get(`
      SELECT c.*, 
             cr.title as request_title,
             cr.field_data,
             ct.name as template_name,
             u.name as generated_by_name,
             comp.name as company_name
      FROM contracts c
      LEFT JOIN contract_requests cr ON c.request_id = cr.id
      LEFT JOIN contract_templates ct ON c.template_id = ct.id
      LEFT JOIN users u ON c.generated_by = u.id
      LEFT JOIN companies comp ON cr.company_id = comp.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    contract.field_data = JSON.parse(contract.field_data);
    res.json(contract);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({ error: 'Error al obtener contrato' });
  }
});

// Generar contrato desde una solicitud aprobada
router.post('/generate/:requestId',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const requestId = req.params.requestId;

      // Obtener la solicitud
      const request = await db.get(`
        SELECT cr.*, ct.content as template_content
        FROM contract_requests cr
        LEFT JOIN contract_templates ct ON cr.template_id = ct.id
        WHERE cr.id = ?
      `, [requestId]);

      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ error: 'Solo se pueden generar contratos de solicitudes aprobadas' });
      }

      // Generar número de contrato único
      const contractNumber = `CTR-${Date.now()}-${requestId}`;

      // Procesar plantilla con los datos
      let content = request.template_content;
      const fieldData = JSON.parse(request.field_data);
      
      // Reemplazar variables en el contenido
      Object.keys(fieldData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, fieldData[key]);
      });

      // Crear el contrato
      const result = await db.run(
        `INSERT INTO contracts 
        (request_id, template_id, contract_number, content, generated_by, status) 
        VALUES (?, ?, ?, ?, ?, 'active')`,
        [requestId, request.template_id, contractNumber, content, req.user.id]
      );

      // Actualizar estado de la solicitud
      await db.run(
        'UPDATE contract_requests SET status = ? WHERE id = ?',
        ['completed', requestId]
      );

      // Log de actividad
      await db.run(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'GENERATE', 'contract', result.id, `Generó contrato ${contractNumber}`]
      );

      res.status(201).json({ 
        message: 'Contrato generado exitosamente',
        id: result.id,
        contract_number: contractNumber
      });
    } catch (error) {
      console.error('Error al generar contrato:', error);
      res.status(500).json({ error: 'Error al generar contrato' });
    }
  }
);

// Descargar contrato en formato Word
router.get('/:id/download-word',
  authenticate,
  async (req, res) => {
    try {
      // Obtener el contrato con la plantilla
      const contract = await db.get(`
        SELECT c.*, ct.word_file_path, ct.word_file_original_name, cr.field_data
        FROM contracts c
        LEFT JOIN contract_templates ct ON c.template_id = ct.id
        LEFT JOIN contract_requests cr ON c.request_id = cr.id
        WHERE c.id = ?
      `, [req.params.id]);

      if (!contract) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }

      // Verificar que haya un archivo Word asociado
      if (!contract.word_file_path) {
        return res.status(400).json({ error: 'Esta plantilla no tiene un archivo Word asociado' });
      }

      // Verificar que el archivo exista
      if (!fs.existsSync(contract.word_file_path)) {
        return res.status(404).json({ error: 'Archivo Word no encontrado' });
      }

      // Leer el archivo de plantilla
      const templateBuffer = fs.readFileSync(contract.word_file_path);

      // Parsear los datos del campo
      const fieldData = JSON.parse(contract.field_data);

      // Generar el documento con los datos
      const generatedBuffer = generateDocumentFromTemplate(templateBuffer, fieldData);

      // Generar nombre de archivo para descarga
      const downloadName = `${contract.contract_number}.docx`;

      // Enviar el archivo
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.send(generatedBuffer);

    } catch (error) {
      console.error('Error al descargar contrato Word:', error);
      res.status(500).json({ error: 'Error al generar el documento Word' });
    }
  }
);

// Actualizar estado de contrato
router.patch('/:id/status',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!['active', 'terminated', 'expired'].includes(status)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }

      await db.run(
        'UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, req.params.id]
      );

      await db.run(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'UPDATE', 'contract', req.params.id, `Cambió estado a ${status}`]
      );

      res.json({ message: 'Estado actualizado exitosamente' });
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      res.status(500).json({ error: 'Error al actualizar estado' });
    }
  }
);

module.exports = router;

