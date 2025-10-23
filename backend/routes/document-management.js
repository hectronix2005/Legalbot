const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Contract = require('../models/Contract');
const DocumentVersion = require('../models/DocumentVersion');
const DocumentGenerator = require('../utils/documentGenerator');
const { authenticate } = require('../middleware/auth');

// Descargar documento Word
router.get('/download/word/:contractId', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (!contract.file_path || !fs.existsSync(contract.file_path)) {
      return res.status(404).json({ error: 'Archivo Word no encontrado' });
    }

    const fileName = `contrato_${contract.contract_number}.docx`;
    res.download(contract.file_path, fileName);
    
  } catch (error) {
    console.error('Error descargando Word:', error);
    res.status(500).json({ error: 'Error descargando documento' });
  }
});

// Descargar documento PDF
router.get('/download/pdf/:contractId', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (!contract.pdf_path || !fs.existsSync(contract.pdf_path)) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado' });
    }

    const fileName = `contrato_${contract.contract_number}.pdf`;
    res.download(contract.pdf_path, fileName);
    
  } catch (error) {
    console.error('Error descargando PDF:', error);
    res.status(500).json({ error: 'Error descargando documento' });
  }
});

// Obtener versiones de un contrato
router.get('/versions/:contractId', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    
    const versions = await DocumentVersion.find({ contract: contractId })
      .populate('created_by', 'name email')
      .sort({ version: -1 });

    res.json(versions);
    
  } catch (error) {
    console.error('Error obteniendo versiones:', error);
    res.status(500).json({ error: 'Error obteniendo versiones' });
  }
});

// Obtener contenido editable de una versión
router.get('/editable/:versionId', authenticate, async (req, res) => {
  try {
    const { versionId } = req.params;
    
    const version = await DocumentVersion.findById(versionId);
    if (!version) {
      return res.status(404).json({ error: 'Versión no encontrada' });
    }

    res.json({
      content: version.editable_content,
      version: version.version,
      change_description: version.change_description
    });
    
  } catch (error) {
    console.error('Error obteniendo contenido editable:', error);
    res.status(500).json({ error: 'Error obteniendo contenido' });
  }
});

// Guardar cambios en documento editable
router.put('/save/:contractId', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { content, change_description } = req.body;
    const userId = req.user.id;

    console.log('💾 Guardando cambios en documento editable...');

    // Obtener contrato
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Obtener la versión actual
    const currentVersion = await DocumentVersion.findOne({ 
      contract: contractId, 
      is_current: true 
    });

    if (!currentVersion) {
      return res.status(404).json({ error: 'Versión actual no encontrada' });
    }

    // Marcar versión actual como no actual
    currentVersion.is_current = false;
    await currentVersion.save();

    // Crear nueva versión
    const newVersion = new DocumentVersion({
      contract: contractId,
      version: currentVersion.version + 1,
      content: content,
      editable_content: content,
      created_by: userId,
      change_description: change_description || `Versión ${currentVersion.version + 1}`,
      is_current: true
    });

    // Generar nuevos documentos
    console.log('📄 Regenerando documentos Word y PDF...');
    const documentGenerator = new DocumentGenerator();
    
    const documents = await documentGenerator.generateDocuments({
      contract_number: contract.contract_number,
      content: content,
      template_name: 'Contrato editado'
    });

    // Actualizar rutas de archivos
    newVersion.word_file_path = documents.word.filePath;
    newVersion.pdf_file_path = documents.pdf.filePath;

    await newVersion.save();

    // Actualizar contrato
    contract.content = content;
    contract.file_path = documents.word.filePath;
    contract.pdf_path = documents.pdf.filePath;
    await contract.save();

    console.log('✅ Documento actualizado y regenerado');
    console.log(`📄 Nueva versión: ${newVersion.version}`);

    res.json({
      success: true,
      version: newVersion.version,
      word_file: documents.word.filePath,
      pdf_file: documents.pdf.filePath,
      message: 'Documento guardado y regenerado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error guardando documento:', error);
    res.status(500).json({ 
      error: 'Error guardando documento',
      details: error.message 
    });
  }
});

// Obtener historial de cambios
router.get('/history/:contractId', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    
    const history = await DocumentVersion.find({ contract: contractId })
      .populate('created_by', 'name email')
      .sort({ version: -1 })
      .select('version change_description created_by createdAt is_current');

    res.json(history);
    
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

// Restaurar a una versión anterior
router.post('/restore/:versionId', authenticate, async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.user.id;

    // Obtener versión a restaurar
    const versionToRestore = await DocumentVersion.findById(versionId);
    if (!versionToRestore) {
      return res.status(404).json({ error: 'Versión no encontrada' });
    }

    // Marcar todas las versiones como no actuales
    await DocumentVersion.updateMany(
      { contract: versionToRestore.contract },
      { is_current: false }
    );

    // Crear nueva versión basada en la versión a restaurar
    const newVersion = new DocumentVersion({
      contract: versionToRestore.contract,
      version: versionToRestore.version + 1,
      content: versionToRestore.content,
      editable_content: versionToRestore.editable_content,
      created_by: userId,
      change_description: `Restaurado desde versión ${versionToRestore.version}`,
      is_current: true
    });

    // Regenerar documentos
    const documentGenerator = new DocumentGenerator();
    const contract = await Contract.findById(versionToRestore.contract);
    
    const documents = await documentGenerator.generateDocuments({
      contract_number: contract.contract_number,
      content: versionToRestore.content,
      template_name: 'Contrato restaurado'
    });

    newVersion.word_file_path = documents.word.filePath;
    newVersion.pdf_file_path = documents.pdf.filePath;
    await newVersion.save();

    // Actualizar contrato
    contract.content = versionToRestore.content;
    contract.file_path = documents.word.filePath;
    contract.pdf_path = documents.pdf.filePath;
    await contract.save();

    console.log(`✅ Documento restaurado a versión ${versionToRestore.version}`);

    res.json({
      success: true,
      message: 'Documento restaurado exitosamente',
      version: newVersion.version
    });

  } catch (error) {
    console.error('❌ Error restaurando documento:', error);
    res.status(500).json({ 
      error: 'Error restaurando documento',
      details: error.message 
    });
  }
});

module.exports = router;
