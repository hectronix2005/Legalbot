const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { generateDocumentFromTemplate } = require('../utils/wordProcessor');
const Contract = require('../models/Contract');
const ContractRequest = require('../models/ContractRequest');
const ContractTemplate = require('../models/ContractTemplate');
const ActivityLog = require('../models/ActivityLog');

// Obtener todos los contratos
router.get('/', authenticate, async (req, res) => {
  try {
    const { company_id, status } = req.query;
    
    const filter = {};
    
    if (status) filter.status = status;

    const contracts = await Contract.find(filter)
      .populate({
        path: 'request',
        populate: [
          { path: 'company', select: 'name' },
          { path: 'requester', select: 'name' }
        ]
      })
      .populate('template', 'name category')
      .populate('generated_by', 'name')
      .sort({ createdAt: -1 });

    // Filtrar por empresa si no es admin
    let filteredContracts = contracts;
    if (req.user.role !== 'admin' && req.user.company_id) {
      filteredContracts = contracts.filter(c => 
        c.request?.company?._id.toString() === req.user.company_id
      );
    } else if (company_id) {
      filteredContracts = contracts.filter(c => 
        c.request?.company?._id.toString() === company_id
      );
    }

    res.json(filteredContracts);
  } catch (error) {
    console.error('Error al obtener contratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
});

// Obtener un contrato
router.get('/:id', authenticate, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate({
        path: 'request',
        populate: [
          { path: 'company', select: 'name' },
          { path: 'requester', select: 'name' }
        ]
      })
      .populate('template', 'name category')
      .populate('generated_by', 'name');

    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    res.json(contract);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({ error: 'Error al obtener contrato' });
  }
});

// Generar contrato
router.post('/generate/:requestId',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const request = await ContractRequest.findById(req.params.requestId)
        .populate('template');

      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ error: 'Solo se pueden generar contratos de solicitudes aprobadas' });
      }

      // Generar número de contrato
      const contractNumber = `CTR-${Date.now()}-${req.params.requestId}`;

      // Procesar plantilla
      let content = request.template.content;
      const fieldData = request.field_data;
      
      for (const [key, value] of fieldData.entries()) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value);
      }

      // Crear contrato
      const contract = await Contract.create({
        request: request._id,
        template: request.template._id,
        contract_number: contractNumber,
        content,
        generated_by: req.user.id,
        status: 'active'
      });

      // Actualizar solicitud
      await ContractRequest.findByIdAndUpdate(req.params.requestId, {
        status: 'completed'
      });

      // Log
      await ActivityLog.create({
        user: req.user.id,
        action: 'GENERATE',
        entity_type: 'contract',
        entity_id: contract._id,
        description: `Generó contrato ${contractNumber}`
      });

      res.status(201).json({ 
        message: 'Contrato generado exitosamente',
        id: contract._id,
        contract_number: contractNumber
      });
    } catch (error) {
      console.error('Error al generar contrato:', error);
      res.status(500).json({ error: 'Error al generar contrato' });
    }
  }
);

// Descargar contrato en Word
router.get('/:id/download-word',
  authenticate,
  async (req, res) => {
    try {
      const contract = await Contract.findById(req.params.id)
        .populate('template')
        .populate('request');

      if (!contract) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }

      if (!contract.template.word_file_path) {
        return res.status(400).json({ error: 'Esta plantilla no tiene un archivo Word asociado' });
      }

      if (!fs.existsSync(contract.template.word_file_path)) {
        return res.status(404).json({ error: 'Archivo Word no encontrado' });
      }

      const templateBuffer = fs.readFileSync(contract.template.word_file_path);
      
      // Convertir Map a objeto plano
      const fieldData = Object.fromEntries(contract.request.field_data);
      const generatedBuffer = generateDocumentFromTemplate(templateBuffer, fieldData);

      const downloadName = `${contract.contract_number}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.send(generatedBuffer);

    } catch (error) {
      console.error('Error al descargar contrato Word:', error);
      res.status(500).json({ error: 'Error al generar el documento Word' });
    }
  }
);

// Actualizar estado
router.patch('/:id/status',
  authenticate,
  authorize('admin', 'lawyer'),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!['active', 'terminated', 'expired'].includes(status)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }

      await Contract.findByIdAndUpdate(req.params.id, { status });

      await ActivityLog.create({
        user: req.user.id,
        action: 'UPDATE',
        entity_type: 'contract',
        entity_id: req.params.id,
        description: `Cambió estado a ${status}`
      });

      res.json({ message: 'Estado actualizado exitosamente' });
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      res.status(500).json({ error: 'Error al actualizar estado' });
    }
  }
);

module.exports = router;

