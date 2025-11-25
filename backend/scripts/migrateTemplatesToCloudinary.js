/**
 * Script de migración para subir plantillas existentes a Cloudinary
 * Ejecutar con: node backend/scripts/migrateTemplatesToCloudinary.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Configurar Cloudinary
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Importar modelo
const ContractTemplate = require('../models/ContractTemplate');

async function migrateTemplates() {
  console.log('🚀 Iniciando migración de plantillas a Cloudinary...\n');

  // Verificar configuración de Cloudinary
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Error: Variables de Cloudinary no configuradas');
    console.log('   Necesitas configurar:');
    console.log('   - CLOUDINARY_CLOUD_NAME');
    console.log('   - CLOUDINARY_API_KEY');
    console.log('   - CLOUDINARY_API_SECRET');
    process.exit(1);
  }

  console.log('✅ Cloudinary configurado:', process.env.CLOUDINARY_CLOUD_NAME);

  // Conectar a MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalbot';
  console.log('🔗 Conectando a MongoDB...');

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB\n');
  } catch (err) {
    console.error('❌ Error conectando a MongoDB:', err.message);
    process.exit(1);
  }

  // Buscar plantillas sin URL de Cloudinary pero con archivo local
  const templates = await ContractTemplate.find({
    word_file_path: { $exists: true, $ne: null, $ne: '' },
    cloudinary_url: { $in: [null, '', undefined] }
  });

  console.log(`📋 Encontradas ${templates.length} plantillas para migrar\n`);

  if (templates.length === 0) {
    console.log('✨ No hay plantillas pendientes de migrar');
    await mongoose.disconnect();
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const template of templates) {
    console.log(`\n📄 Procesando: ${template.name}`);
    console.log(`   ID: ${template._id}`);
    console.log(`   Archivo: ${template.word_file_path}`);

    // Verificar si el archivo existe localmente
    if (!fs.existsSync(template.word_file_path)) {
      console.log('   ⚠️  Archivo local no existe - saltando');
      skipped++;
      continue;
    }

    try {
      // Subir a Cloudinary
      const fileName = template.word_file_original_name || path.basename(template.word_file_path);
      console.log(`   ☁️  Subiendo a Cloudinary...`);

      const result = await cloudinary.uploader.upload(template.word_file_path, {
        resource_type: 'raw',
        folder: 'legalbot/templates',
        public_id: `template_${template._id}_${path.parse(fileName).name}`,
        use_filename: true,
        unique_filename: false,
        overwrite: true,
        tags: ['template', 'word', 'docx', 'migrated']
      });

      // Actualizar plantilla con URL de Cloudinary
      await ContractTemplate.findByIdAndUpdate(template._id, {
        cloudinary_url: result.secure_url,
        cloudinary_public_id: result.public_id
      });

      console.log(`   ✅ Migrada exitosamente`);
      console.log(`   📎 URL: ${result.secure_url}`);
      success++;

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(50));
  console.log(`   ✅ Exitosas: ${success}`);
  console.log(`   ❌ Fallidas: ${failed}`);
  console.log(`   ⚠️  Saltadas: ${skipped}`);
  console.log(`   📋 Total: ${templates.length}`);
  console.log('='.repeat(50));

  await mongoose.disconnect();
  console.log('\n🔌 Desconectado de MongoDB');
}

// Ejecutar
migrateTemplates().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
