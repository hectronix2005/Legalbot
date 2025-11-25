/**
 * Script para verificar el estado de almacenamiento de plantillas
 *
 * Ejecutar con: node backend/scripts/checkTemplatesStorage.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalbot';

async function checkTemplates() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const ContractTemplate = require('../models/ContractTemplate');

    const templates = await ContractTemplate.find({})
      .select('name gridfs_file_id word_file_path cloudinary_url active')
      .lean();

    console.log('=== ESTADO DE PLANTILLAS ===\n');

    let withGridFS = 0;
    let withLocalOnly = 0;
    let withCloudinary = 0;
    let noStorage = 0;

    templates.forEach(t => {
      const hasGridFS = !!t.gridfs_file_id;
      const hasLocal = !!t.word_file_path;
      const hasCloud = !!t.cloudinary_url;

      let status = '';
      if (hasGridFS) {
        status = '✅ GridFS';
        withGridFS++;
      } else if (hasCloud) {
        status = '☁️  Cloudinary';
        withCloudinary++;
      } else if (hasLocal) {
        status = '⚠️  LOCAL ONLY';
        withLocalOnly++;
      } else {
        status = '❌ SIN ARCHIVO';
        noStorage++;
      }

      console.log(`${status} - ${t.name} (${t.active ? 'activo' : 'inactivo'})`);
      if (hasLocal && !hasGridFS) {
        console.log(`         Local path: ${t.word_file_path}`);
      }
    });

    console.log('\n=== RESUMEN ===');
    console.log(`Total plantillas: ${templates.length}`);
    console.log(`  ✅ Con GridFS: ${withGridFS}`);
    console.log(`  ☁️  Con Cloudinary: ${withCloudinary}`);
    console.log(`  ⚠️  Solo Local: ${withLocalOnly} (SE PERDERÁN EN DEPLOY)`);
    console.log(`  ❌ Sin archivo: ${noStorage}`);

    if (withLocalOnly > 0) {
      console.log('\n⚠️  ATENCIÓN: Hay plantillas con solo almacenamiento local.');
      console.log('   Estas plantillas perderán su archivo Word después del próximo deploy.');
      console.log('   Use "Reemplazar Word" en cada plantilla para subirla a GridFS.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTemplates();
