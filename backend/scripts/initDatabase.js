const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function initDatabase() {
  try {
    console.log('🔄 Inicializando base de datos con datos de prueba...');

    // Esperar a que la base de datos se inicialice
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Crear empresa de prueba
    const company = await db.run(
      'INSERT INTO companies (name, tax_id, address, phone) VALUES (?, ?, ?, ?)',
      ['Empresa Demo S.A.', '20123456789', 'Av. Principal 123, Lima', '+51 999 888 777']
    );
    console.log('✅ Empresa demo creada');

    // Crear tipos de contrato
    const contractTypes = [
      ['Contrato Laboral', 'Contratos de trabajo y empleo', 'Laboral'],
      ['Contrato de Servicios', 'Contratos de prestación de servicios profesionales', 'Comercial'],
      ['Contrato de Arrendamiento', 'Contratos de alquiler de bienes inmuebles', 'Inmobiliario'],
      ['Acuerdo de Confidencialidad (NDA)', 'Acuerdos de no divulgación', 'Legal'],
      ['Contrato de Compraventa', 'Contratos de compra y venta', 'Comercial']
    ];

    for (const type of contractTypes) {
      await db.run(
        'INSERT INTO contract_types (name, description, category) VALUES (?, ?, ?)',
        type
      );
    }
    console.log('✅ Tipos de contrato creados');

    // Crear usuarios de prueba
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Admin
    const admin = await db.run(
      'INSERT INTO users (email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?)',
      ['admin@demo.com', hashedPassword, 'Administrador Sistema', 'admin', company.id]
    );

    // Abogado
    const lawyer = await db.run(
      'INSERT INTO users (email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?)',
      ['abogado@demo.com', hashedPassword, 'Dr. Juan Pérez', 'lawyer', company.id]
    );

    // Solicitante
    const requester = await db.run(
      'INSERT INTO users (email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?)',
      ['solicitante@demo.com', hashedPassword, 'María García', 'requester', company.id]
    );

    console.log('✅ Usuarios demo creados');

    // Crear plantilla de ejemplo
    const templateContent = `
CONTRATO DE SERVICIOS PROFESIONALES

En la ciudad de {{ciudad}}, a los {{fecha}} días del mes de {{mes}} del año {{anio}}, entre:

CONTRATANTE: {{nombre_contratante}}, identificado con {{tipo_documento}} N° {{numero_documento}}, 
con domicilio en {{domicilio_contratante}}.

CONTRATISTA: {{nombre_contratista}}, identificado con {{tipo_documento_contratista}} N° {{numero_documento_contratista}},
con domicilio en {{domicilio_contratista}}.

PRIMERA.- OBJETO DEL CONTRATO
El CONTRATISTA se compromete a prestar los siguientes servicios: {{descripcion_servicios}}

SEGUNDA.- PLAZO
El presente contrato tendrá una duración de {{plazo}} meses, iniciando el {{fecha_inicio}} y finalizando el {{fecha_fin}}.

TERCERA.- CONTRAPRESTACIÓN
El CONTRATANTE se compromete a pagar la suma de {{monto}} ({{monto_letras}}) más IGV.

CUARTA.- FORMA DE PAGO
El pago se realizará de la siguiente manera: {{forma_pago}}

Firmado en conformidad,

_____________________          _____________________
CONTRATANTE                    CONTRATISTA
`;

    const template = await db.run(
      `INSERT INTO contract_templates 
      (contract_type_id, name, description, content, company_id, created_by, version, is_current) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        2, // Contrato de Servicios
        'Plantilla Estándar de Servicios Profesionales',
        'Plantilla base para contratos de servicios profesionales',
        templateContent,
        company.id,
        admin.id,
        1,
        1
      ]
    );

    // Crear campos para la plantilla
    const fields = [
      ['ciudad', 'Ciudad', 'text', null, 1, 0],
      ['fecha', 'Día', 'number', null, 1, 1],
      ['mes', 'Mes', 'text', null, 1, 2],
      ['anio', 'Año', 'number', null, 1, 3],
      ['nombre_contratante', 'Nombre del Contratante', 'text', null, 1, 4],
      ['tipo_documento', 'Tipo de Documento', 'select', JSON.stringify(['DNI', 'RUC', 'CE']), 1, 5],
      ['numero_documento', 'Número de Documento', 'text', null, 1, 6],
      ['domicilio_contratante', 'Domicilio del Contratante', 'textarea', null, 1, 7],
      ['nombre_contratista', 'Nombre del Contratista', 'text', null, 1, 8],
      ['tipo_documento_contratista', 'Tipo de Documento del Contratista', 'select', JSON.stringify(['DNI', 'RUC', 'CE']), 1, 9],
      ['numero_documento_contratista', 'Número de Documento del Contratista', 'text', null, 1, 10],
      ['domicilio_contratista', 'Domicilio del Contratista', 'textarea', null, 1, 11],
      ['descripcion_servicios', 'Descripción de Servicios', 'textarea', null, 1, 12],
      ['plazo', 'Plazo en meses', 'number', null, 1, 13],
      ['fecha_inicio', 'Fecha de Inicio', 'date', null, 1, 14],
      ['fecha_fin', 'Fecha de Fin', 'date', null, 1, 15],
      ['monto', 'Monto (S/.)', 'number', null, 1, 16],
      ['monto_letras', 'Monto en Letras', 'text', null, 1, 17],
      ['forma_pago', 'Forma de Pago', 'textarea', null, 1, 18]
    ];

    for (const field of fields) {
      await db.run(
        `INSERT INTO template_fields 
        (template_id, field_name, field_label, field_type, field_options, required, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [template.id, ...field]
      );
    }

    console.log('✅ Plantilla de ejemplo creada con campos');

    // Crear versión inicial en historial
    await db.run(
      'INSERT INTO version_history (template_id, version, content, changes_description, created_by) VALUES (?, ?, ?, ?, ?)',
      [template.id, 1, templateContent, 'Versión inicial de la plantilla', admin.id]
    );

    console.log('\n✅ Base de datos inicializada exitosamente!\n');
    console.log('📧 Credenciales de acceso:');
    console.log('   Admin:       admin@demo.com / 123456');
    console.log('   Abogado:     abogado@demo.com / 123456');
    console.log('   Solicitante: solicitante@demo.com / 123456\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error);
    process.exit(1);
  }
}

// Ejecutar la inicialización
setTimeout(() => {
  initDatabase();
}, 2000);

