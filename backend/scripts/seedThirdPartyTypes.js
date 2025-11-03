const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');

const defaultThirdPartyTypes = [
  {
    code: 'proveedor',
    label: 'Proveedor',
    description: 'Empresa o persona que suministra bienes o servicios',
    icon: '📦',
    is_system: true,
    company: null,
    default_identification_types: ['NIT', 'NIT (PH)', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
    fields: [
      {
        name: 'identification_type',
        label: 'Tipo de Identificación',
        field_type: 'select',
        options: ['NIT', 'NIT (PH)', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
        required: true,
        display_order: 0
      },
      {
        name: 'identification_number',
        label: 'Número de Identificación',
        field_type: 'text',
        required: true,
        display_order: 1
      },
      {
        name: 'legal_name',
        label: 'Razón Social',
        field_type: 'text',
        required: true,
        display_order: 2
      },
      {
        name: 'legal_name_short',
        label: 'Razón Social Abreviada',
        field_type: 'text',
        required: true,
        display_order: 3
      },
      {
        name: 'legal_representative_name',
        label: 'Nombre del Representante Legal',
        field_type: 'text',
        required: true,
        display_order: 4
      },
      {
        name: 'legal_representative_id_type',
        label: 'Tipo de ID del Rep. Legal',
        field_type: 'select',
        options: ['CC', 'CE', 'Pasaporte', 'Otro'],
        required: true,
        display_order: 5
      },
      {
        name: 'legal_representative_id_number',
        label: 'Número de ID del Rep. Legal',
        field_type: 'text',
        required: true,
        display_order: 6
      },
      {
        name: 'email',
        label: 'Email',
        field_type: 'email',
        required: false,
        display_order: 7
      },
      {
        name: 'phone',
        label: 'Teléfono',
        field_type: 'phone',
        required: false,
        display_order: 8
      },
      {
        name: 'address',
        label: 'Dirección',
        field_type: 'text',
        required: false,
        display_order: 9
      },
      {
        name: 'city',
        label: 'Ciudad',
        field_type: 'text',
        required: false,
        display_order: 10
      }
    ]
  },
  {
    code: 'cliente',
    label: 'Cliente',
    description: 'Empresa o persona que adquiere bienes o servicios',
    icon: '🏢',
    is_system: true,
    company: null,
    default_identification_types: ['NIT', 'NIT (PH)', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
    fields: [
      {
        name: 'identification_type',
        label: 'Tipo de Identificación',
        field_type: 'select',
        options: ['NIT', 'NIT (PH)', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
        required: true,
        display_order: 0
      },
      {
        name: 'identification_number',
        label: 'Número de Identificación',
        field_type: 'text',
        required: true,
        display_order: 1
      },
      {
        name: 'legal_name',
        label: 'Razón Social o Nombre Completo',
        field_type: 'text',
        required: true,
        display_order: 2
      },
      {
        name: 'email',
        label: 'Email',
        field_type: 'email',
        required: true,
        display_order: 3
      },
      {
        name: 'phone',
        label: 'Teléfono',
        field_type: 'phone',
        required: true,
        display_order: 4
      },
      {
        name: 'address',
        label: 'Dirección',
        field_type: 'text',
        required: false,
        display_order: 5
      }
    ]
  },
  {
    code: 'empleado',
    label: 'Empleado',
    description: 'Persona vinculada laboralmente',
    icon: '👤',
    is_system: true,
    company: null,
    default_identification_types: ['CC', 'CE', 'Pasaporte', 'Otro'],
    fields: [
      {
        name: 'identification_type',
        label: 'Tipo de Identificación',
        field_type: 'select',
        options: ['CC', 'CE', 'Pasaporte', 'Otro'],
        required: true,
        display_order: 0
      },
      {
        name: 'identification_number',
        label: 'Número de Identificación',
        field_type: 'text',
        required: true,
        display_order: 1
      },
      {
        name: 'full_name',
        label: 'Nombre Completo',
        field_type: 'text',
        required: true,
        display_order: 2
      },
      {
        name: 'email',
        label: 'Email Corporativo',
        field_type: 'email',
        required: true,
        display_order: 3
      },
      {
        name: 'phone',
        label: 'Teléfono',
        field_type: 'phone',
        required: true,
        display_order: 4
      },
      {
        name: 'position',
        label: 'Cargo',
        field_type: 'text',
        required: true,
        display_order: 5
      },
      {
        name: 'hire_date',
        label: 'Fecha de Contratación',
        field_type: 'date',
        required: false,
        display_order: 6
      },
      {
        name: 'salary',
        label: 'Salario',
        field_type: 'number',
        required: false,
        display_order: 7
      }
    ]
  },
  {
    code: 'arrendador',
    label: 'Arrendador',
    description: 'Propietario que otorga el uso de un bien en arrendamiento',
    icon: '🏠',
    is_system: true,
    company: null,
    default_identification_types: ['NIT', 'CC', 'CE', 'Pasaporte', 'Otro'],
    fields: [
      {
        name: 'identification_type',
        label: 'Tipo de Identificación',
        field_type: 'select',
        options: ['NIT', 'CC', 'CE', 'Pasaporte', 'Otro'],
        required: true,
        display_order: 0
      },
      {
        name: 'identification_number',
        label: 'Número de Identificación',
        field_type: 'text',
        required: true,
        display_order: 1
      },
      {
        name: 'full_name',
        label: 'Nombre Completo o Razón Social',
        field_type: 'text',
        required: true,
        display_order: 2
      },
      {
        name: 'email',
        label: 'Email',
        field_type: 'email',
        required: true,
        display_order: 3
      },
      {
        name: 'phone',
        label: 'Teléfono',
        field_type: 'phone',
        required: true,
        display_order: 4
      },
      {
        name: 'property_address',
        label: 'Dirección del Inmueble',
        field_type: 'text',
        required: true,
        display_order: 5
      }
    ]
  },
  {
    code: 'arrendatario',
    label: 'Arrendatario',
    description: 'Persona o empresa que toma en arrendamiento un bien',
    icon: '🔑',
    is_system: true,
    company: null,
    default_identification_types: ['NIT', 'CC', 'CE', 'Pasaporte', 'Otro'],
    fields: [
      {
        name: 'identification_type',
        label: 'Tipo de Identificación',
        field_type: 'select',
        options: ['NIT', 'CC', 'CE', 'Pasaporte', 'Otro'],
        required: true,
        display_order: 0
      },
      {
        name: 'identification_number',
        label: 'Número de Identificación',
        field_type: 'text',
        required: true,
        display_order: 1
      },
      {
        name: 'full_name',
        label: 'Nombre Completo o Razón Social',
        field_type: 'text',
        required: true,
        display_order: 2
      },
      {
        name: 'email',
        label: 'Email',
        field_type: 'email',
        required: true,
        display_order: 3
      },
      {
        name: 'phone',
        label: 'Teléfono',
        field_type: 'phone',
        required: true,
        display_order: 4
      },
      {
        name: 'current_address',
        label: 'Dirección Actual',
        field_type: 'text',
        required: false,
        display_order: 5
      }
    ]
  },
  {
    code: 'contratista',
    label: 'Contratista',
    description: 'Persona o empresa que presta servicios de forma independiente',
    icon: '🔧',
    is_system: true,
    company: null,
    default_identification_types: ['NIT', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
    fields: [
      {
        name: 'identification_type',
        label: 'Tipo de Identificación',
        field_type: 'select',
        options: ['NIT', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
        required: true,
        display_order: 0
      },
      {
        name: 'identification_number',
        label: 'Número de Identificación',
        field_type: 'text',
        required: true,
        display_order: 1
      },
      {
        name: 'full_name',
        label: 'Nombre Completo o Razón Social',
        field_type: 'text',
        required: true,
        display_order: 2
      },
      {
        name: 'email',
        label: 'Email',
        field_type: 'email',
        required: true,
        display_order: 3
      },
      {
        name: 'phone',
        label: 'Teléfono',
        field_type: 'phone',
        required: true,
        display_order: 4
      },
      {
        name: 'service_description',
        label: 'Descripción del Servicio',
        field_type: 'textarea',
        required: false,
        display_order: 5
      },
      {
        name: 'contract_value',
        label: 'Valor del Contrato',
        field_type: 'number',
        required: false,
        display_order: 6
      }
    ]
  },
  {
    code: 'otro',
    label: 'Otro',
    description: 'Tipo de tercero genérico',
    icon: '📄',
    is_system: true,
    company: null,
    default_identification_types: ['NIT', 'NIT (PH)', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
    fields: [
      {
        name: 'identification_type',
        label: 'Tipo de Identificación',
        field_type: 'select',
        options: ['NIT', 'NIT (PH)', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
        required: true,
        display_order: 0
      },
      {
        name: 'identification_number',
        label: 'Número de Identificación',
        field_type: 'text',
        required: true,
        display_order: 1
      },
      {
        name: 'full_name',
        label: 'Nombre Completo o Razón Social',
        field_type: 'text',
        required: true,
        display_order: 2
      },
      {
        name: 'email',
        label: 'Email',
        field_type: 'email',
        required: false,
        display_order: 3
      },
      {
        name: 'phone',
        label: 'Teléfono',
        field_type: 'phone',
        required: false,
        display_order: 4
      }
    ]
  }
];

async function seedThirdPartyTypes() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    console.log('\n📋 Precargando tipos de terceros...');

    for (const typeData of defaultThirdPartyTypes) {
      const existing = await ThirdPartyTypeConfig.findOne({
        code: typeData.code,
        is_system: true
      });

      if (existing) {
        console.log(`⏭️  Tipo "${typeData.label}" (${typeData.code}) ya existe, actualizando...`);

        // Actualizar el tipo existente con los campos más recientes
        existing.label = typeData.label;
        existing.description = typeData.description;
        existing.icon = typeData.icon;
        existing.fields = typeData.fields;
        existing.default_identification_types = typeData.default_identification_types;
        await existing.save();

        console.log(`✅ Tipo "${typeData.label}" actualizado`);
      } else {
        await ThirdPartyTypeConfig.create(typeData);
        console.log(`✅ Tipo "${typeData.label}" (${typeData.code}) creado`);
      }
    }

    console.log('\n🎉 Precarga completada exitosamente');
    console.log(`📊 Total de tipos de terceros: ${defaultThirdPartyTypes.length}`);

    // Mostrar resumen
    const allTypes = await ThirdPartyTypeConfig.find({ is_system: true }).sort({ code: 1 });
    console.log('\n📝 Tipos de terceros en el sistema:');
    allTypes.forEach(type => {
      console.log(`  - ${type.icon} ${type.label} (${type.code}) - ${type.fields.length} campos`);
    });

  } catch (error) {
    console.error('❌ Error al precargar tipos de terceros:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexión a MongoDB cerrada');
    process.exit(0);
  }
}

seedThirdPartyTypes();
