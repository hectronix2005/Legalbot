const mongoose = require('mongoose');
const ContractTemplate = require('../models/ContractTemplate');
const ActivityLog = require('../models/ActivityLog');
const VersionHistory = require('../models/VersionHistory');

// Conectar a MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts');
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

// Crear plantillas desde Word
async function createWordTemplates() {
  console.log('🧪 CREANDO PLANTILLAS DESDE WORD - SCRIPT SIMPLIFICADO');
  console.log('======================================================\n');

  try {
    await connectDB();

    // Obtener el usuario admin
    const User = require('../models/User');
    const adminUser = await User.findOne({ email: 'admin@demo.com' });
    
    if (!adminUser) {
      console.log('❌ Usuario admin no encontrado');
      return;
    }

    console.log(`✅ Usuario admin encontrado: ${adminUser.name}`);

    // Plantillas desde Word
    const wordTemplates = [
      {
        name: 'Acuerdo de Confidencialidad',
        description: 'Plantilla para acuerdos de confidencialidad entre empresas',
        category: 'Confidencialidad',
        content: 'ACUERDO DE CONFIDENCIALIDAD\n\nEntre {{nombre_empresa}}, identificada con NIT {{nit_empresa}}, con domicilio en {{ciudad}}, representada por {{representante_legal}}, identificado con cédula {{cedula_representante}}, y la otra parte, se celebra el presente acuerdo de confidencialidad el {{fecha_contrato}}.\n\nPRIMERA: INFORMACIÓN CONFIDENCIAL\nSe considerará información confidencial todos los datos proporcionados por las partes.\n\nSEGUNDA: OBLIGACIONES\nLas partes se comprometen a mantener la confidencialidad de la información.\n\nFirmado en {{ciudad}} el {{fecha_contrato}}.\n\n{{representante_legal}}\n{{cedula_representante}}',
        fields: [
          { field_name: 'nombre_empresa', field_label: 'Nombre de la Empresa', field_type: 'text', field_options: [], required: true, display_order: 0 },
          { field_name: 'nit_empresa', field_label: 'NIT de la Empresa', field_type: 'text', field_options: [], required: true, display_order: 1 },
          { field_name: 'ciudad', field_label: 'Ciudad', field_type: 'text', field_options: [], required: true, display_order: 2 },
          { field_name: 'representante_legal', field_label: 'Representante Legal', field_type: 'text', field_options: [], required: true, display_order: 3 },
          { field_name: 'cedula_representante', field_label: 'Cédula del Representante', field_type: 'text', field_options: [], required: true, display_order: 4 },
          { field_name: 'fecha_contrato', field_label: 'Fecha del Contrato', field_type: 'date', field_options: [], required: true, display_order: 5 }
        ]
      },
      {
        name: 'Contrato de Servicios Profesionales',
        description: 'Plantilla para contratos de servicios profesionales',
        category: 'Servicios',
        content: 'CONTRATO DE SERVICIOS PROFESIONALES\n\nEn {{ciudad}}, a los {{dia}} días del mes de {{mes}} del año {{anio}}, entre:\n\nCONTRATANTE: {{nombre_contratante}}, identificado con {{tipo_documento_contratante}} N° {{numero_documento_contratante}}, con domicilio en {{domicilio_contratante}}.\n\nCONTRATISTA: {{nombre_contratista}}, identificado con {{tipo_documento_contratista}} N° {{numero_documento_contratista}}, con domicilio en {{domicilio_contratista}}.\n\nPRIMERA: OBJETO DEL CONTRATO\nEl CONTRATISTA se compromete a prestar los siguientes servicios: {{descripcion_servicios}}\n\nSEGUNDA: PLAZO\nEl presente contrato tendrá una duración de {{plazo_ejecucion}} meses.\n\nTERCERA: CONTRAPRESTACIÓN\nEl CONTRATANTE se compromete a pagar la suma de ${{monto_total}} ({{monto_letras}}) más IVA.\n\nCUARTA: FORMA DE PAGO\nEl pago se realizará de la siguiente manera: {{forma_pago}}\n\nFirmado en conformidad,\n\n_____________________          _____________________\n{{nombre_contratante}}          {{nombre_contratista}}\nCONTRATANTE                    CONTRATISTA',
        fields: [
          { field_name: 'ciudad', field_label: 'Ciudad', field_type: 'text', field_options: [], required: true, display_order: 0 },
          { field_name: 'dia', field_label: 'Día', field_type: 'number', field_options: [], required: true, display_order: 1 },
          { field_name: 'mes', field_label: 'Mes', field_type: 'text', field_options: [], required: true, display_order: 2 },
          { field_name: 'anio', field_label: 'Año', field_type: 'number', field_options: [], required: true, display_order: 3 },
          { field_name: 'nombre_contratante', field_label: 'Nombre del Contratante', field_type: 'text', field_options: [], required: true, display_order: 4 },
          { field_name: 'tipo_documento_contratante', field_label: 'Tipo de Documento Contratante', field_type: 'select', field_options: ['DNI', 'RUC', 'CE'], required: true, display_order: 5 },
          { field_name: 'numero_documento_contratante', field_label: 'Número de Documento Contratante', field_type: 'text', field_options: [], required: true, display_order: 6 },
          { field_name: 'domicilio_contratante', field_label: 'Domicilio del Contratante', field_type: 'textarea', field_options: [], required: true, display_order: 7 },
          { field_name: 'nombre_contratista', field_label: 'Nombre del Contratista', field_type: 'text', field_options: [], required: true, display_order: 8 },
          { field_name: 'tipo_documento_contratista', field_label: 'Tipo de Documento Contratista', field_type: 'select', field_options: ['DNI', 'RUC', 'CE'], required: true, display_order: 9 },
          { field_name: 'numero_documento_contratista', field_label: 'Número de Documento Contratista', field_type: 'text', field_options: [], required: true, display_order: 10 },
          { field_name: 'domicilio_contratista', field_label: 'Domicilio del Contratista', field_type: 'textarea', field_options: [], required: true, display_order: 11 },
          { field_name: 'descripcion_servicios', field_label: 'Descripción de Servicios', field_type: 'textarea', field_options: [], required: true, display_order: 12 },
          { field_name: 'plazo_ejecucion', field_label: 'Plazo de Ejecución (meses)', field_type: 'number', field_options: [], required: true, display_order: 13 },
          { field_name: 'monto_total', field_label: 'Monto Total', field_type: 'number', field_options: [], required: true, display_order: 14 },
          { field_name: 'monto_letras', field_label: 'Monto en Letras', field_type: 'text', field_options: [], required: true, display_order: 15 },
          { field_name: 'forma_pago', field_label: 'Forma de Pago', field_type: 'textarea', field_options: [], required: true, display_order: 16 }
        ]
      },
      {
        name: 'Contrato de Prestación de Servicios',
        description: 'Plantilla para contratos de prestación de servicios',
        category: 'Comercial',
        content: 'CONTRATO DE PRESTACIÓN DE SERVICIOS\n\nEntre {{razon_social}}, sociedad legalmente constituida, con domicilio en {{direccion_empresa}}, representada por {{representante_legal}}, identificado con {{tipo_documento}} N° {{numero_documento}}, y {{nombre_contratista}}, identificado con {{tipo_documento_contratista}} N° {{numero_documento_contratista}}, se celebra el presente contrato de prestación de servicios.\n\nPRIMERA: OBJETO\nEl objeto del presente contrato es {{objeto_contrato}}\n\nSEGUNDA: OBLIGACIONES DEL CONTRATISTA\nEl contratista se compromete a:\n- Prestar los servicios de manera profesional\n- Cumplir con los plazos establecidos\n- Mantener la confidencialidad de la información\n\nTERCERA: OBLIGACIONES DEL CONTRATANTE\nEl contratante se compromete a:\n- Proporcionar la información necesaria\n- Realizar los pagos en los términos acordados\n- Facilitar el desarrollo de las actividades\n\nCUARTA: CONTRAPRESTACIÓN\nEl valor del contrato es de ${{valor_contrato}} ({{valor_letras}}) más IVA.\n\nQUINTA: FORMA DE PAGO\nLos pagos se realizarán {{forma_pago}}\n\nSEXTA: PLAZO\nEl contrato tendrá una duración de {{plazo_contrato}} meses.\n\nFirmado en {{ciudad}} el {{fecha_contrato}}.\n\n{{representante_legal}}                    {{nombre_contratista}}\n{{tipo_documento}} {{numero_documento}}    {{tipo_documento_contratista}} {{numero_documento_contratista}}',
        fields: [
          { field_name: 'razon_social', field_label: 'Razón Social', field_type: 'text', field_options: [], required: true, display_order: 0 },
          { field_name: 'direccion_empresa', field_label: 'Dirección de la Empresa', field_type: 'textarea', field_options: [], required: true, display_order: 1 },
          { field_name: 'representante_legal', field_label: 'Representante Legal', field_type: 'text', field_options: [], required: true, display_order: 2 },
          { field_name: 'tipo_documento', field_label: 'Tipo de Documento', field_type: 'select', field_options: ['DNI', 'RUC', 'CE'], required: true, display_order: 3 },
          { field_name: 'numero_documento', field_label: 'Número de Documento', field_type: 'text', field_options: [], required: true, display_order: 4 },
          { field_name: 'nombre_contratista', field_label: 'Nombre del Contratista', field_type: 'text', field_options: [], required: true, display_order: 5 },
          { field_name: 'tipo_documento_contratista', field_label: 'Tipo de Documento Contratista', field_type: 'select', field_options: ['DNI', 'RUC', 'CE'], required: true, display_order: 6 },
          { field_name: 'numero_documento_contratista', field_label: 'Número de Documento Contratista', field_type: 'text', field_options: [], required: true, display_order: 7 },
          { field_name: 'objeto_contrato', field_label: 'Objeto del Contrato', field_type: 'textarea', field_options: [], required: true, display_order: 8 },
          { field_name: 'valor_contrato', field_label: 'Valor del Contrato', field_type: 'number', field_options: [], required: true, display_order: 9 },
          { field_name: 'valor_letras', field_label: 'Valor en Letras', field_type: 'text', field_options: [], required: true, display_order: 10 },
          { field_name: 'forma_pago', field_label: 'Forma de Pago', field_type: 'textarea', field_options: [], required: true, display_order: 11 },
          { field_name: 'plazo_contrato', field_label: 'Plazo del Contrato (meses)', field_type: 'number', field_options: [], required: true, display_order: 12 },
          { field_name: 'ciudad', field_label: 'Ciudad', field_type: 'text', field_options: [], required: true, display_order: 13 },
          { field_name: 'fecha_contrato', field_label: 'Fecha del Contrato', field_type: 'date', field_options: [], required: true, display_order: 14 }
        ]
      }
    ];

    console.log(`\n📝 Creando ${wordTemplates.length} plantillas desde Word...`);
    
    for (let i = 0; i < wordTemplates.length; i++) {
      const templateData = wordTemplates[i];
      console.log(`\n${i + 1}. 📄 Creando: "${templateData.name}"`);
      console.log(`   📊 Variables detectadas: ${templateData.fields.length}`);
      
      // Mostrar variables detectadas
      templateData.fields.forEach((field, index) => {
        console.log(`      ${index + 1}. {{${field.field_name}}} → ${field.field_label} (${field.field_type})`);
      });
      
      // Crear plantilla
      const template = await ContractTemplate.create({
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        content: templateData.content,
        fields: templateData.fields,
        company: null,
        created_by: adminUser._id,
        version: 1,
        is_current: true,
        active: true
      });
      
      console.log(`   ✅ Plantilla creada: ${template._id}`);
      
      // Guardar en historial
      await VersionHistory.create({
        template: template._id,
        version: 1,
        content: templateData.content,
        changes_description: 'Versión inicial desde Word',
        created_by: adminUser._id
      });
      
      // Log de actividad
      await ActivityLog.create({
        user: adminUser._id,
        action: 'CREATE',
        entity_type: 'template',
        entity_id: template._id,
        description: `Creó plantilla desde Word: ${templateData.name}`
      });
      
      console.log(`   ✅ Historial y log creados`);
    }

    // Verificar plantillas creadas
    console.log('\n🔍 Verificando plantillas creadas...');
    const allTemplates = await ContractTemplate.find({}).populate('created_by', 'name');
    
    console.log(`✅ Total de plantillas en la base de datos: ${allTemplates.length}`);
    
    console.log('\n📋 LISTADO COMPLETO DE PLANTILLAS:');
    console.log('=====================================');
    allTemplates.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name}`);
      console.log(`   ID: ${template._id}`);
      console.log(`   Descripción: ${template.description}`);
      console.log(`   Categoría: ${template.category}`);
      console.log(`   Campos: ${template.fields ? template.fields.length : 0} variables`);
      console.log(`   Creado por: ${template.created_by ? template.created_by.name : 'N/A'}`);
      console.log(`   Fecha: ${template.createdAt}`);
      console.log('   ---');
    });

    console.log('\n🎉 PLANTILLAS CREADAS EXITOSAMENTE');
    console.log('==================================');
    console.log(`✅ ${allTemplates.length} plantillas en la base de datos`);
    console.log(`✅ Plantillas desde Word creadas correctamente`);
    
    if (allTemplates.length >= 4) { // 1 existente + 3 nuevas
      console.log(`🎯 OBJETIVO CUMPLIDO: Se crearon ${allTemplates.length - 1} plantillas nuevas desde Word`);
    } else {
      console.log(`⚠️  OBJETIVO PARCIAL: Solo se crearon ${allTemplates.length - 1} plantillas nuevas de las 3 esperadas`);
    }

  } catch (error) {
    console.error('❌ Error creando plantillas:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Conexión a MongoDB cerrada');
  }
}

// Ejecutar el script
createWordTemplates();
