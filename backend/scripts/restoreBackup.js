#!/usr/bin/env node

/**
 * Script para restaurar backups
 * Uso: node scripts/restoreBackup.js [filename] [--dry-run]
 */

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { listBackups, restoreFromBackup } = require('../services/robustBackup');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    const filename = process.argv[2];
    const dryRun = process.argv.includes('--dry-run');

    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Listar backups disponibles
    console.log('📋 Backups disponibles:\n');
    const backups = await listBackups();

    if (backups.length === 0) {
      console.log('❌ No hay backups disponibles');
      process.exit(1);
    }

    backups.slice(0, 20).forEach((backup, index) => {
      const date = new Date(backup.created).toLocaleString('es-CO');
      const size = (backup.size / 1024).toFixed(2);
      const docs = Object.values(backup.stats || {}).reduce((a, b) => a + b, 0);

      console.log(`${index + 1}. ${backup.filename}`);
      console.log(`   📅 ${date}`);
      console.log(`   💾 ${size} KB - ${docs} documentos`);
      console.log(`   📊 ${JSON.stringify(backup.stats || {})}\n`);
    });

    // Si no se especificó archivo, preguntar
    let selectedFilename = filename;
    if (!selectedFilename) {
      const answer = await question('Número de backup a restaurar (o nombre completo): ');

      if (answer.match(/^\d+$/)) {
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < backups.length) {
          selectedFilename = backups[index].filename;
        } else {
          console.error('❌ Número inválido');
          rl.close();
          process.exit(1);
        }
      } else {
        selectedFilename = answer;
      }
    }

    console.log(`\n📦 Restaurando: ${selectedFilename}`);

    if (!dryRun) {
      const confirm = await question('\n⚠️  ADVERTENCIA: Esto eliminará todos los datos actuales.\n¿Continuar? (escribir SI para confirmar): ');

      if (confirm !== 'SI') {
        console.log('❌ Operación cancelada');
        rl.close();
        process.exit(0);
      }
    }

    // Restaurar
    const result = await restoreFromBackup(selectedFilename, { dryRun });

    if (result.success) {
      console.log('\n✅ Restauración exitosa');

      if (!dryRun) {
        console.log('\n📊 Resumen:');
        Object.entries(result.results).forEach(([coll, stats]) => {
          if (stats.error) {
            console.log(`   ❌ ${coll}: ${stats.error}`);
          } else {
            console.log(`   ✅ ${coll}: ${stats.inserted} documentos restaurados`);
          }
        });
      }
    }

    rl.close();
  } catch (error) {
    console.error('\n❌ Error:', error);
    rl.close();
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
