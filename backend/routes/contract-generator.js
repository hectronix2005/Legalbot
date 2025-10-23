const express = require('express');
const router = express.Router();
const ContractTemplate = require('../models/ContractTemplate');
const Contract = require('../models/Contract');
const ActivityLog = require('../models/ActivityLog');
const ContractCounter = require('../models/ContractCounter');
const DocumentVersion = require('../models/DocumentVersion');
const DocumentGenerator = require('../utils/documentGenerator');
const { authenticate } = require('../middleware/auth');

// Generar contrato basado en plantilla
router.post('/generate', authenticate, async (req, res) => {
  try {
    console.log('🚀 GENERANDO CONTRATO DESDE PLANTILLA');
    console.log('=====================================');
    console.log('📝 Datos recibidos:');
    console.log('  - Template ID:', req.body.templateId);
    console.log('  - User ID:', req.user.id);
    console.log('  - Data fields:', Object.keys(req.body.data || {}).length);

    const { templateId, data } = req.body;
    const userId = req.user.id;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID es requerido' });
    }

    // Buscar la plantilla
    const template = await ContractTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    console.log('📋 Plantilla encontrada:');
    console.log('  - Name:', template.name);
    console.log('  - Fields:', template.fields.length);
    console.log('  - Category:', template.category);

    // Validar que todos los campos requeridos estén presentes
    console.log('🔍 VALIDANDO CAMPOS REQUERIDOS...');
    console.log('  - Total fields in template:', template.fields.length);
    console.log('  - Data fields received:', Object.keys(data).length);
    console.log('  - Data received:', Object.keys(data));
    
    const requiredFields = template.fields.filter(field => field.required);
    console.log('  - Required fields count:', requiredFields.length);
    console.log('  - Required fields:', requiredFields.map(f => f.field_name));
    
    const missingFields = requiredFields.filter(field => 
      !data[field.field_name] || data[field.field_name].trim() === ''
    );
    
    console.log('  - Missing fields count:', missingFields.length);
    if (missingFields.length > 0) {
      console.log('  - Missing fields:', missingFields.map(f => f.field_label));
      console.log('  - Missing field names:', missingFields.map(f => f.field_name));
      console.log('  - Data values for missing fields:');
      missingFields.forEach(field => {
        console.log(`    ${field.field_name}: "${data[field.field_name]}"`);
      });
    }

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos',
        missingFields: missingFields.map(f => f.field_label)
      });
    }

    // Procesar variables reutilizadas
    console.log('🔄 Procesando variables reutilizadas...');
    const processedData = { ...data };
    
    template.fields.forEach(field => {
      if (field.can_repeat && field.repeat_source) {
        const sourceField = template.fields.find(f => f.field_name === field.repeat_source);
        if (sourceField && data[sourceField.field_name]) {
          processedData[field.field_name] = data[sourceField.field_name];
          console.log(`  ✅ ${field.field_label} ← ${sourceField.field_label}: "${data[sourceField.field_name]}"`);
        }
      }
    });

    // Generar el contenido del contrato
    console.log('📄 Generando contenido del contrato...');
    let contractContent = template.content || '';

    // Si no hay contenido en la plantilla, generar un contenido básico
    if (!contractContent || contractContent.trim() === '') {
      console.log('⚠️ No hay contenido en la plantilla, generando contenido básico...');
      contractContent = `Contrato generado desde plantilla: ${template.name}\n\n`;
      
      // Agregar información de los campos
      template.fields.forEach(field => {
        const value = processedData[field.field_name] || '';
        contractContent += `${field.field_label}: ${value}\n`;
      });
    }

    // Reemplazar variables en el contenido
    template.fields.forEach(field => {
      // Extraer el nombre de la variable del marcador original
      const marker = field.original_marker || `{{${field.field_name}}}`;
      const variableName = marker.match(/\{\{([^}]+)\}\}/)?.[1]?.trim() || field.field_name;
      const value = processedData[field.field_name] || '';
      
      // Escapar caracteres especiales para regex
      const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedMarker, 'g');
      
      contractContent = contractContent.replace(regex, value);
      console.log(`  🔄 ${marker} → "${value}"`);
    });

    // Crear el contrato en la base de datos
    console.log('💾 Guardando contrato en la base de datos...');
    
    // Generar número de contrato consecutivo
    const currentYear = new Date().getFullYear();
    const companyId = req.user.company_id || null;
    
    // Obtener o crear el contador para la empresa y año actual
    const counter = await ContractCounter.findOneAndUpdate(
      { company: companyId, year: currentYear },
      { $inc: { counter: 1 } },
      { upsert: true, new: true }
    );
    
    // Generar número de contrato con consecutivo
    const contractNumber = `CON-${currentYear}-${String(counter.counter).padStart(4, '0')}`;
    
    console.log(`📋 Número de contrato generado: ${contractNumber}`);
    
    const contract = new Contract({
      request: null, // No requerido para generación directa
      template: templateId,
      contract_number: contractNumber,
      content: contractContent,
      file_path: null, // Se puede agregar después si se guarda como archivo
      status: 'active', // Usar valor válido del enum
      generated_by: userId,
      company: req.user.company_id || null
    });

    await contract.save();
    console.log('✅ Contrato guardado con ID:', contract._id);

    // Generar documentos Word y PDF
    console.log('📄 Generando documentos Word y PDF...');
    const documentGenerator = new DocumentGenerator();
    
    try {
      const documents = await documentGenerator.generateDocuments({
        contract_number: contractNumber,
        content: contractContent,
        template_name: template.name,
        template_word_path: template.word_file_path, // Ruta del archivo Word original
        field_data: processedData // Datos procesados para reemplazo
      });

      // Crear versión del documento
      const documentVersion = new DocumentVersion({
        contract: contract._id,
        version: 1,
        content: contractContent,
        word_file_path: documents.word.filePath,
        pdf_file_path: documents.pdf.filePath,
        editable_content: contractContent,
        created_by: userId,
        change_description: 'Versión inicial generada automáticamente',
        is_current: true
      });

      await documentVersion.save();
      console.log('✅ Versión de documento guardada');

      // Actualizar contrato con rutas de archivos
      contract.file_path = documents.word.filePath;
      contract.pdf_path = documents.pdf.filePath;
      await contract.save();

      console.log('📄 Documentos generados:');
      console.log(`  - Word: ${documents.word.fileName}`);
      console.log(`  - PDF: ${documents.pdf.fileName}`);

    } catch (docError) {
      console.error('⚠️ Error generando documentos:', docError);
      // Continuar sin fallar la generación del contrato
    }

    // Crear log de actividad
    await ActivityLog.create({
      user: userId,
      action: 'contract_generated',
      entity_id: contract._id,
      entity_type: 'contract',
      details: {
        contract_id: contract._id,
        template_id: templateId,
        template_name: template.name,
        fields_count: Object.keys(processedData).length,
        documents_generated: true
      },
      timestamp: new Date()
    });

    console.log('📝 Log de actividad creado');
    console.log('🎉 CONTRATO GENERADO EXITOSAMENTE');
    console.log('================================');

    res.json({
      success: true,
      contract: contractContent,
      contractId: contract._id,
      contract_number: contractNumber,
      word_file: contract.file_path,
      pdf_file: contract.pdf_path,
      message: 'Contrato generado exitosamente con documentos'
    });

  } catch (error) {
    console.error('❌ Error generando contrato:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Obtener plantillas disponibles para generación
router.get('/templates', authenticate, async (req, res) => {
  try {
    console.log('📋 Obteniendo plantillas disponibles para generación');
    
    const templates = await ContractTemplate.find({ active: true })
      .select('name description category fields')
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });

    console.log(`✅ Encontradas ${templates.length} plantillas activas`);

    res.json(templates);
  } catch (error) {
    console.error('❌ Error obteniendo plantillas:', error);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// Obtener detalles de una plantilla específica
router.get('/templates/:id', authenticate, async (req, res) => {
  try {
    const template = await ContractTemplate.findById(req.params.id)
      .select('name description category fields')
      .populate('created_by', 'name email');

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    res.json(template);
  } catch (error) {
    console.error('❌ Error obteniendo plantilla:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

module.exports = router;
