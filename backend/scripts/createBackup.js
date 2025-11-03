#!/usr/bin/env node

/**
 * Script para crear backups manuales
 * Uso: node scripts/createBackup.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createFullBackup, cleanOldBackups } = require('../services/robustBackup');

async function main() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Crear backup manual
    await createFullBackup('MANUAL');

    // Limpiar backups antiguos
    console.log('\n🧹 Limpiando backups antiguos...');
    await cleanOldBackups();

    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
