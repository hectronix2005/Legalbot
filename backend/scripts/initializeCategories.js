const mongoose = require('mongoose');
require('dotenv').config();

const ContractCategory = require('../models/ContractCategory');
const Company = require('../models/Company');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/legal-contracts';

const sampleCategories = [
  {
    name: 'Contrato Laboral',
    description: 'Contrato de trabajo para empleados a término indefinido o fijo',
    icon: '👔',
    color: '#3b82f6',
    questionnaire: [
      {
        field_name: 'employee_name',
        question: 'Nombre completo del empleado',
        type: 'text',
        required: true,
        order: 1
      },
      {
        field_name: 'employee_id',
        question: 'Número de identificación',
        type: 'text',
        required: true,
        order: 2
      },
      {
        field_name: 'position',
        question: 'Cargo o posición',
        type: 'text',
        required: true,
        order: 3
      },
      {
        field_name: 'salary',
        question: 'Salario mensual',
        type: 'number',
        required: true,
        validation: { min: 0 },
        order: 4
      },
      {
        field_name: 'start_date',
        question: 'Fecha de inicio',
        type: 'date',
        required: true,
        order: 5
      },
      {
        field_name: 'contract_type',
        question: 'Tipo de contrato',
        type: 'select',
        options: ['Término indefinido', 'Término fijo', 'Obra o labor'],
        required: true,
        order: 6
      },
      {
        field_name: 'work_hours',
        question: 'Jornada laboral (horas semanales)',
        type: 'number',
        required: true,
        validation: { min: 1, max: 48 },
        order: 7
      }
    ]
  },
  {
    name: 'Acuerdo de Confidencialidad (NDA)',
    description: 'Acuerdo de no divulgación de información confidencial',
    icon: '🔒',
    color: '#10b981',
    questionnaire: [
      {
        field_name: 'party_name',
        question: 'Nombre de la parte receptora',
        type: 'text',
        required: true,
        order: 1
      },
      {
        field_name: 'party_id',
        question: 'NIT o identificación',
        type: 'text',
        required: true,
        order: 2
      },
      {
        field_name: 'purpose',
        question: 'Propósito del acuerdo',
        type: 'textarea',
        required: true,
        order: 3
      },
      {
        field_name: 'duration_months',
        question: 'Duración del acuerdo (meses)',
        type: 'number',
        required: true,
        validation: { min: 1 },
        order: 4
      },
      {
        field_name: 'confidential_info',
        question: 'Descripción de la información confidencial',
        type: 'textarea',
        required: true,
        order: 5
      },
      {
        field_name: 'mutual',
        question: '¿Es un acuerdo mutuo?',
        type: 'radio',
        options: ['Sí', 'No'],
        required: true,
        order: 6
      }
    ]
  },
  {
    name: 'Contrato Comercial',
    description: 'Contrato de compraventa o prestación de servicios comerciales',
    icon: '🤝',
    color: '#f59e0b',
    questionnaire: [
      {
        field_name: 'client_name',
        question: 'Nombre del cliente/proveedor',
        type: 'text',
        required: true,
        order: 1
      },
      {
        field_name: 'client_id',
        question: 'NIT o identificación',
        type: 'text',
        required: true,
        order: 2
      },
      {
        field_name: 'service_description',
        question: 'Descripción del servicio o producto',
        type: 'textarea',
        required: true,
        order: 3
      },
      {
        field_name: 'contract_value',
        question: 'Valor del contrato',
        type: 'number',
        required: true,
        validation: { min: 0 },
        order: 4
      },
      {
        field_name: 'payment_terms',
        question: 'Términos de pago',
        type: 'select',
        options: ['Contado', '30 días', '60 días', '90 días', 'Otro'],
        required: true,
        order: 5
      },
      {
        field_name: 'delivery_date',
        question: 'Fecha de entrega/inicio',
        type: 'date',
        required: true,
        order: 6
      },
      {
        field_name: 'warranty',
        question: '¿Incluye garantía?',
        type: 'checkbox',
        required: false,
        order: 7
      },
      {
        field_name: 'warranty_months',
        question: 'Meses de garantía (si aplica)',
        type: 'number',
        required: false,
        validation: { min: 0 },
        order: 8
      }
    ]
  },
  {
    name: 'Contrato de Arrendamiento',
    description: 'Contrato de arrendamiento de bienes inmuebles',
    icon: '🏢',
    color: '#8b5cf6',
    questionnaire: [
      {
        field_name: 'tenant_name',
        question: 'Nombre del arrendatario',
        type: 'text',
        required: true,
        order: 1
      },
      {
        field_name: 'tenant_id',
        question: 'Identificación del arrendatario',
        type: 'text',
        required: true,
        order: 2
      },
      {
        field_name: 'property_address',
        question: 'Dirección del inmueble',
        type: 'textarea',
        required: true,
        order: 3
      },
      {
        field_name: 'monthly_rent',
        question: 'Valor mensual del arriendo',
        type: 'number',
        required: true,
        validation: { min: 0 },
        order: 4
      },
      {
        field_name: 'lease_duration',
        question: 'Duración del contrato (meses)',
        type: 'number',
        required: true,
        validation: { min: 1 },
        order: 5
      },
      {
        field_name: 'start_date',
        question: 'Fecha de inicio',
        type: 'date',
        required: true,
        order: 6
      },
      {
        field_name: 'deposit',
        question: 'Valor del depósito',
        type: 'number',
        required: true,
        validation: { min: 0 },
        order: 7
      },
      {
        field_name: 'utilities_included',
        question: 'Servicios incluidos',
        type: 'multiselect',
        options: ['Agua', 'Luz', 'Gas', 'Internet', 'Administración'],
        required: false,
        order: 8
      }
    ]
  }
];

async function initializeCategories() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Obtener la primera empresa
    const company = await Company.findOne();
    if (!company) {
      console.error('❌ No se encontró ninguna empresa. Por favor, cree una empresa primero.');
      process.exit(1);
    }

    console.log(`📊 Usando empresa: ${company.legal_name}`);

    // Obtener un usuario admin de la empresa
    const admin = await User.findOne({ role: 'super_admin' });
    if (!admin) {
      console.error('❌ No se encontró ningún super admin. Por favor, cree un usuario primero.');
      process.exit(1);
    }

    console.log(`👤 Usando usuario: ${admin.name || admin.email}`);

    // Verificar si ya existen categorías
    const existingCount = await ContractCategory.countDocuments({ company: company._id });
    if (existingCount > 0) {
      console.log(`⚠️  Ya existen ${existingCount} categorías para esta empresa.`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('¿Deseas agregar las categorías de ejemplo de todos modos? (s/n): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 's') {
        console.log('❌ Operación cancelada');
        process.exit(0);
      }
    }

    // Crear las categorías
    console.log('\n📝 Creando categorías de ejemplo...\n');

    for (const categoryData of sampleCategories) {
      const category = new ContractCategory({
        ...categoryData,
        company: company._id,
        created_by: admin._id
      });

      await category.save();
      console.log(`✅ Creada: ${categoryData.name} (${categoryData.questionnaire.length} preguntas)`);
    }

    console.log(`\n✨ ¡${sampleCategories.length} categorías creadas exitosamente!`);
    console.log('\n📋 Categorías disponibles:');
    sampleCategories.forEach(cat => {
      console.log(`   ${cat.icon} ${cat.name} - ${cat.description}`);
    });

    console.log('\n✅ Los usuarios ya pueden comenzar a solicitar contratos');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

initializeCategories();
