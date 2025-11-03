const express = require('express');
const router = express.Router();
const { authenticate, authorize, verifyTenant, authorizeCompanyRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const { generateDocumentFromTemplate } = require('../utils/wordProcessor');
const Contract = require('../models/Contract');
const SimpleContract = require('../models/SimpleContract');
const ContractRequest = require('../models/ContractRequest');
const ContractTemplate = require('../models/ContractTemplate');
const ActivityLog = require('../models/ActivityLog');

// Obtener todos los contratos
router.get('/', authenticate, verifyTenant, async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};

    // Super admin puede ver todas las empresas o filtrar por la seleccionada
    if (req.user.role === 'super_admin' && !req.companyId) {
      // Ver todos los contratos
    } else if (req.companyId) {
      // Filtrar por empresa seleccionada
      filter.company = req.companyId;
    }

    if (status) filter.status = status;

    const contracts = await Contract.find(filter)
      .populate('generated_by', 'name email')
      .populate('template', 'name category')
      .select('contract_number title content description file_path pdf_path status createdAt generated_by template company company_name')
      .sort({ createdAt: -1 });

    res.json(contracts);
  } catch (error) {
    console.error('Error al obtener contratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
});

// Obtener un contrato
router.get('/:id', authenticate, verifyTenant, async (req, res) => {
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

    // Verificar que el contrato pertenece a la empresa (excepto super_admin)
    if (req.user.role !== 'super_admin') {
      if (contract.company && contract.company.toString() !== req.companyId) {
        return res.status(403).json({ error: 'No tienes acceso a este contrato' });
      }
    }

    res.json(contract);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({ error: 'Error al obtener contrato' });
  }
});

// Crear contrato
router.post('/',
  authenticate,
  verifyTenant,
  authorizeCompanyRole('admin', 'lawyer'),
  [
    body('title').notEmpty().withMessage('El título es requerido'),
    body('company').optional(),
    body('status').optional().isIn(['borrador', 'revision', 'aprobado', 'firmado', 'cancelado'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, status, description, template_id } = req.body;

      // Usar companyId del tenant verification
      const contract = await SimpleContract.create({
        title,
        company: req.companyId,
        status: status || 'borrador',
        description: description || '',
        template: template_id || null,
        created_by: req.user.id
      });

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'contract',
        entity_id: contract._id,
        description: `Creó el contrato: ${title}`,
        company: req.companyId
      });

      res.status(201).json({
        message: 'Contrato creado exitosamente',
        id: contract._id
      });
    } catch (error) {
      console.error('Error al crear contrato:', error);
      res.status(500).json({ error: 'Error al crear contrato' });
    }
  }
);

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

// Descargar contrato en Word (con formato preservado)
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

      // NUEVO: Si el contrato ya tiene un archivo Word generado, devolverlo directamente
      if (contract.file_path && fs.existsSync(contract.file_path)) {
        console.log('📄 Descargando contrato Word pre-generado:', contract.file_path);

        const contractBuffer = fs.readFileSync(contract.file_path);
        const downloadName = `${contract.contract_number}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.send(contractBuffer);
        return;
      }

      // FALLBACK: Si no hay archivo pre-generado, generar desde plantilla (contratos antiguos)
      console.log('📄 Generando contrato Word desde plantilla...');

      if (!contract.template.word_file_path) {
        return res.status(400).json({ error: 'Esta plantilla no tiene un archivo Word asociado' });
      }

      if (!fs.existsSync(contract.template.word_file_path)) {
        return res.status(404).json({ error: 'Archivo Word de plantilla no encontrado' });
      }

      const templateBuffer = fs.readFileSync(contract.template.word_file_path);

      // Convertir Map a objeto plano
      const fieldData = contract.request ? Object.fromEntries(contract.request.field_data) : {};
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

// Actualizar un contrato
router.put('/:id', authenticate, verifyTenant, authorizeCompanyRole('admin', 'lawyer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, company, status, description } = req.body;

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Verificar que el contrato pertenece a la empresa (excepto super_admin)
    if (req.user.role !== 'super_admin') {
      if (contract.company && contract.company.toString() !== req.companyId) {
        return res.status(403).json({ error: 'No tienes acceso a este contrato' });
      }
    }

    // Actualizar campos
    if (title) contract.title = title;
    if (company) contract.company_name = company;
    if (status) contract.status = status;
    if (description) contract.description = description;

    await contract.save();

    // Crear log de actividad
    await ActivityLog.create({
      user: req.user.id,
      action: 'contract_updated',
      entity_id: contract._id,
      entity_type: 'contract',
      details: {
        contract_id: contract._id,
        changes: { title, company, status, description }
      },
      company: req.companyId,
      timestamp: new Date()
    });

    res.json({
      message: 'Contrato actualizado exitosamente',
      contract
    });
  } catch (error) {
    console.error('Error al actualizar contrato:', error);
    res.status(500).json({ error: 'Error al actualizar el contrato' });
  }
});

// Eliminar un contrato
router.delete('/:id', authenticate, verifyTenant, authorizeCompanyRole('admin', 'lawyer'), async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Verificar que el contrato pertenece a la empresa (excepto super_admin)
    if (req.user.role !== 'super_admin') {
      if (contract.company && contract.company.toString() !== req.companyId) {
        return res.status(403).json({ error: 'No tienes acceso a este contrato' });
      }
    }

    await Contract.findByIdAndDelete(id);

    // Crear log de actividad
    await ActivityLog.create({
      user: req.user.id,
      action: 'contract_deleted',
      entity_id: contract._id,
      entity_type: 'contract',
      details: {
        contract_id: contract._id,
        contract_number: contract.contract_number
      },
      company: req.companyId,
      timestamp: new Date()
    });

    res.json({ message: 'Contrato eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar contrato:', error);
    res.status(500).json({ error: 'Error al eliminar el contrato' });
  }
});

// Endpoint para descargar archivos por ruta
router.get('/download/:filePath(*)', authenticate, async (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const fullPath = path.resolve(filePath);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    // Verificar que el archivo está dentro del directorio de uploads
    const uploadsDir = path.resolve(__dirname, '../uploads');
    if (!fullPath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    // Determinar el tipo de contenido
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === '.doc') {
      contentType = 'application/msword';
    }
    
    // Enviar el archivo
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
    res.sendFile(fullPath);
    
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
});

module.exports = router;

