const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Company = require('../models/Company');
const ContractTemplate = require('../models/ContractTemplate');
const VersionHistory = require('../models/VersionHistory');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

async function initMongoDB() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Limpiar datos existentes (opcional - comentar si quieres mantener datos)
    console.log('🗑️  Limpiando datos antiguos...');
    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({}),
      ContractTemplate.deleteMany({}),
      VersionHistory.deleteMany({})
    ]);
    console.log('✅ Datos limpiados');

    console.log('🔄 Inicializando base de datos con datos de prueba...');

    // Crear empresa demo
    const company = await Company.create({
      name: 'Empresa Demo S.A.',
      tax_id: '20123456789',
      address: 'Av. Principal 123, Lima',
      phone: '+51 999 888 777'
    });
    console.log('✅ Empresa demo creada');

    // Crear usuarios de prueba
    const hashedPassword = await bcrypt.hash('123456', 10);

    const admin = await User.create({
      email: 'admin@demo.com',
      password: hashedPassword,
      name: 'Administrador Sistema',
      role: 'admin',
      company: company._id
    });

    const lawyer = await User.create({
      email: 'abogado@demo.com',
      password: hashedPassword,
      name: 'Dr. Juan Pérez',
      role: 'lawyer',
      company: company._id
    });

    const requester = await User.create({
      email: 'solicitante@demo.com',
      password: hashedPassword,
      name: 'María García',
      role: 'requester',
      company: company._id
    });

    // Crear usuario super admin
    const superAdmin = await User.create({
      email: 'superadmin@legalbot.com',
      password: hashedPassword,
      name: 'Super Administrador',
      role: 'super_admin',
      company: null // Super admin no está asociado a una empresa específica
    });

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

    const fields = [
      { field_name: 'ciudad', field_label: 'Ciudad', field_type: 'text', required: true, display_order: 0 },
      { field_name: 'fecha', field_label: 'Día', field_type: 'number', required: true, display_order: 1 },
      { field_name: 'mes', field_label: 'Mes', field_type: 'text', required: true, display_order: 2 },
      { field_name: 'anio', field_label: 'Año', field_type: 'number', required: true, display_order: 3 },
      { field_name: 'nombre_contratante', field_label: 'Nombre del Contratante', field_type: 'text', required: true, display_order: 4 },
      { field_name: 'tipo_documento', field_label: 'Tipo de Documento', field_type: 'select', field_options: ['DNI', 'RUC', 'CE'], required: true, display_order: 5 },
      { field_name: 'numero_documento', field_label: 'Número de Documento', field_type: 'text', required: true, display_order: 6 },
      { field_name: 'domicilio_contratante', field_label: 'Domicilio del Contratante', field_type: 'textarea', required: true, display_order: 7 },
      { field_name: 'nombre_contratista', field_label: 'Nombre del Contratista', field_type: 'text', required: true, display_order: 8 },
      { field_name: 'tipo_documento_contratista', field_label: 'Tipo de Documento del Contratista', field_type: 'select', field_options: ['DNI', 'RUC', 'CE'], required: true, display_order: 9 },
      { field_name: 'numero_documento_contratista', field_label: 'Número de Documento del Contratista', field_type: 'text', required: true, display_order: 10 },
      { field_name: 'domicilio_contratista', field_label: 'Domicilio del Contratista', field_type: 'textarea', required: true, display_order: 11 },
      { field_name: 'descripcion_servicios', field_label: 'Descripción de Servicios', field_type: 'textarea', required: true, display_order: 12 },
      { field_name: 'plazo', field_label: 'Plazo en meses', field_type: 'number', required: true, display_order: 13 },
      { field_name: 'fecha_inicio', field_label: 'Fecha de Inicio', field_type: 'date', required: true, display_order: 14 },
      { field_name: 'fecha_fin', field_label: 'Fecha de Fin', field_type: 'date', required: true, display_order: 15 },
      { field_name: 'monto', field_label: 'Monto (S/.)', field_type: 'number', required: true, display_order: 16 },
      { field_name: 'monto_letras', field_label: 'Monto en Letras', field_type: 'text', required: true, display_order: 17 },
      { field_name: 'forma_pago', field_label: 'Forma de Pago', field_type: 'textarea', required: true, display_order: 18 }
    ];

    const template = await ContractTemplate.create({
      name: 'Plantilla Estándar de Servicios Profesionales',
      description: 'Plantilla base para contratos de servicios profesionales',
      category: 'Servicios',
      content: templateContent,
      fields,
      company: company._id,
      created_by: admin._id,
      version: 1,
      is_current: true
    });

    console.log('✅ Plantilla de ejemplo creada');

    // Crear versión inicial
    await VersionHistory.create({
      template: template._id,
      version: 1,
      content: templateContent,
      changes_description: 'Versión inicial de la plantilla',
      created_by: admin._id
    });

    console.log('\n✅ Base de datos MongoDB inicializada exitosamente!\n');
    console.log('📧 Credenciales de acceso:');
    console.log('   Super Admin: superadmin@legalbot.com / 123456');
    console.log('   Admin:       admin@demo.com / 123456');
    console.log('   Abogado:     abogado@demo.com / 123456');
    console.log('   Solicitante: solicitante@demo.com / 123456\n');
    console.log('🌐 Backend: http://localhost:5000');
    console.log('🌐 Frontend: http://localhost:3000\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error);
    process.exit(1);
  }
}

// Ejecutar
initMongoDB();

