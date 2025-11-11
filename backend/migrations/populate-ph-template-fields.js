/**
 * Migración: Poblar campos correctos en plantillas de Propiedad Horizontal
 *
 * Este script:
 * 1. Encuentra todas las plantillas de tipo "Propiedad Horizontal"
 * 2. Las actualiza con los campos requeridos que el sistema debe sugerir
 * 3. Asegura que tengan el third_party_type correcto
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ContractTemplate = require('../models/ContractTemplate');
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');

// Campos que DEBEN tener las plantillas de Propiedad Horizontal
const REQUIRED_PH_FIELDS = [
  {
    field_name: 'cedula_rep_legal',
    field_label: 'Cédula Rep Legal',
    field_type: 'text',
    required: true,
    description: 'Número de cédula del representante legal'
  },
  {
    field_name: 'ciudad_expedicion_cedula_rep_legal',
    field_label: 'Ciudad de Expedición Cédula Rep Legal',
    field_type: 'text',
    required: true,
    description: 'Ciudad donde fue expedida la cédula del representante legal'
  },
  {
    field_name: 'email_licenciatario',
    field_label: 'E-mail Licenciatario',
    field_type: 'email',
    required: true,
    description: 'Correo electrónico del licenciatario'
  },
  {
    field_name: 'nombre_del_licenciatario',
    field_label: 'NOMBRE DEL LICENCIATARIO',
    field_type: 'text',
    required: true,
    description: 'Nombre completo del licenciatario de la propiedad horizontal'
  },
  // Campos adicionales comunes en PH
  {
    field_name: 'razon_social',
    field_label: 'Razón Social',
    field_type: 'text',
    required: true,
    description: 'Nombre legal de la propiedad horizontal'
  },
  {
    field_name: 'nit',
    field_label: 'NIT',
    field_type: 'text',
    required: true,
    description: 'Número de identificación tributaria'
  },
  {
    field_name: 'direccion',
    field_label: 'Dirección',
    field_type: 'text',
    required: true,
    description: 'Dirección de la propiedad horizontal'
  },
  {
    field_name: 'ciudad',
    field_label: 'Ciudad',
    field_type: 'text',
    required: true,
    description: 'Ciudad donde está ubicada la PH'
  },
  {
    field_name: 'telefono',
    field_label: 'Teléfono',
    field_type: 'text',
    required: false,
    description: 'Teléfono de contacto'
  },
  {
    field_name: 'email',
    field_label: 'Email',
    field_type: 'email',
    required: true,
    description: 'Email principal de la PH'
  }
];

async function migrateTemplates(dryRun = true) {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts');
    console.log('✅ Conectado a MongoDB\n');

    // 1. Buscar el tipo de tercero "Propiedad Horizontal"
    console.log('🔍 Buscando tipo de tercero "Propiedad Horizontal"...');
    const phType = await ThirdPartyTypeConfig.findOne({
      $or: [
        { code: 'propiedad_horizontal' },
        { code: 'ph' },
        { label: /propiedad.*horizontal/i }
      ]
    });

    if (!phType) {
      console.log('❌ No se encontró el tipo "Propiedad Horizontal"');
      console.log('   Creando tipo de tercero...');

      if (!dryRun) {
        const newType = new ThirdPartyTypeConfig({
          code: 'propiedad_horizontal',
          label: 'Propiedad Horizontal',
          description: 'Copropiedades y propiedades horizontales',
          active: true
        });
        await newType.save();
        console.log('✅ Tipo creado:', newType._id);
      }
    } else {
      console.log('✅ Tipo encontrado:', phType.code, '-', phType.label);
      console.log('   ID:', phType._id);
    }

    // 2. Buscar todas las plantillas que mencionen "propiedad horizontal"
    console.log('\n🔍 Buscando plantillas de Propiedad Horizontal...');
    const templates = await ContractTemplate.find({
      $or: [
        { name: /propiedad.*horizontal/i },
        { category: /propiedad.*horizontal/i },
        { third_party_type: phType?.code },
        { third_party_type: phType?._id }
      ]
    });

    console.log(`📋 Encontradas ${templates.length} plantillas\n`);

    if (templates.length === 0) {
      console.log('⚠️  No se encontraron plantillas para actualizar');
      console.log('   Tip: Asegúrate de que existan plantillas con "Propiedad Horizontal" en el nombre o categoría');
      await mongoose.connection.close();
      return;
    }

    // 3. Actualizar cada plantilla
    const updates = [];
    for (const template of templates) {
      console.log(`\n📄 Plantilla: ${template.name}`);
      console.log(`   ID: ${template._id}`);
      console.log(`   Tipo actual: ${template.third_party_type || 'NO DEFINIDO'}`);
      console.log(`   Campos actuales: ${template.fields?.length || 0}`);

      // Verificar qué campos faltan
      const existingFieldNames = (template.fields || []).map(f =>
        f.field_name || f.name
      );

      const missingFields = REQUIRED_PH_FIELDS.filter(reqField =>
        !existingFieldNames.some(existing =>
          existing === reqField.field_name ||
          existing.toLowerCase().replace(/[_\s]/g, '') === reqField.field_name.toLowerCase().replace(/[_\s]/g, '')
        )
      );

      console.log(`   Campos faltantes: ${missingFields.length}`);

      if (missingFields.length > 0) {
        console.log('   Campos que se agregarán:');
        missingFields.forEach(f => {
          console.log(`     - ${f.field_label} (${f.field_name})`);
        });
      }

      // Preparar actualización
      const updateData = {
        third_party_type: phType?.code || 'propiedad_horizontal',
        fields: [
          ...(template.fields || []),
          ...missingFields
        ]
      };

      updates.push({
        templateId: template._id,
        templateName: template.name,
        updateData,
        fieldsAdded: missingFields.length
      });

      // Aplicar si no es dry-run
      if (!dryRun) {
        template.third_party_type = updateData.third_party_type;
        template.fields = updateData.fields;
        await template.save();
        console.log('   ✅ Plantilla actualizada');
      } else {
        console.log('   [DRY-RUN] No se aplicaron cambios');
      }
    }

    // 4. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`Modo: ${dryRun ? 'DRY-RUN (sin cambios)' : 'EJECUCIÓN REAL'}`);
    console.log(`Plantillas encontradas: ${templates.length}`);
    console.log(`Plantillas que necesitan actualización: ${updates.filter(u => u.fieldsAdded > 0).length}`);
    console.log(`Total de campos agregados: ${updates.reduce((sum, u) => sum + u.fieldsAdded, 0)}`);

    console.log('\nDetalle por plantilla:');
    updates.forEach(u => {
      console.log(`  - ${u.templateName}: ${u.fieldsAdded} campos agregados`);
    });

    if (dryRun) {
      console.log('\n💡 Para aplicar los cambios, ejecuta:');
      console.log('   node migrations/populate-ph-template-fields.js --apply');
    } else {
      console.log('\n✅ Migración completada exitosamente');
    }

    await mongoose.connection.close();
    console.log('\n🔌 Desconectado de MongoDB');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

// Ejecutar
const isDryRun = !process.argv.includes('--apply');
console.log('🚀 Iniciando migración de campos de Propiedad Horizontal...');
console.log(`Modo: ${isDryRun ? 'DRY-RUN (solo lectura)' : 'APLICAR CAMBIOS'}\n`);

migrateTemplates(isDryRun);
