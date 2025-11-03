#!/usr/bin/env node

/**
 * Script para migrar datos de MongoDB Local a MongoDB Atlas
 *
 * Este script:
 * 1. Se conecta a MongoDB local
 * 2. Exporta todas las colecciones
 * 3. Se conecta a MongoDB Atlas
 * 4. Importa los datos
 */

const mongoose = require('mongoose');

// Configuración
const LOCAL_MONGODB_URI = 'mongodb://localhost:27017/legal-contracts';
const ATLAS_MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://LegalBot:Picap123@cluster0.o16ucum.mongodb.net/legal_bot?retryWrites=true&w=majority&appName=Cluster0';

const COLLECTIONS = [
  'companies',
  'users',
  'usercompanies',
  'contracttemplates',
  'contracts',
  'suppliers',
  'thirdpartytypeconfigs',
  'contractrequests'
];

async function migrateData() {
  console.log('🚀 MIGRACIÓN DE DATOS: MongoDB Local → MongoDB Atlas\n');
  console.log('='.repeat(60));

  try {
    // PASO 1: Conectar a MongoDB local y exportar datos
    console.log('\n📦 PASO 1: Exportando datos de MongoDB local...');
    console.log(`   Conectando a: ${LOCAL_MONGODB_URI}`);

    const localConnection = await mongoose.createConnection(LOCAL_MONGODB_URI).asPromise();
    console.log('   ✅ Conectado a MongoDB local');

    const exportedData = {};

    for (const collectionName of COLLECTIONS) {
      try {
        const collection = localConnection.collection(collectionName);
        const documents = await collection.find({}).toArray();
        exportedData[collectionName] = documents;
        console.log(`   ✓ ${collectionName}: ${documents.length} documentos`);
      } catch (error) {
        console.log(`   ⚠️  ${collectionName}: No existe o está vacía`);
        exportedData[collectionName] = [];
      }
    }

    await localConnection.close();
    console.log('   ✅ Datos exportados exitosamente');

    // Contar total de documentos
    const totalDocs = Object.values(exportedData).reduce((sum, docs) => sum + docs.length, 0);
    console.log(`\n   📊 Total documentos a migrar: ${totalDocs}`);

    // PASO 2: Conectar a MongoDB Atlas e importar datos
    console.log('\n📦 PASO 2: Importando datos a MongoDB Atlas...');
    console.log(`   Conectando a: ${ATLAS_MONGODB_URI.replace(/:[^:@]+@/, ':****@')}`);

    const atlasConnection = await mongoose.createConnection(ATLAS_MONGODB_URI).asPromise();
    console.log('   ✅ Conectado a MongoDB Atlas');

    // Preguntar si se deben borrar los datos existentes
    console.log('\n   ⚠️  ADVERTENCIA: Esto borrará los datos actuales en Atlas');
    console.log('   Continuando en 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    for (const collectionName of COLLECTIONS) {
      const documents = exportedData[collectionName];

      if (documents.length === 0) {
        console.log(`   - ${collectionName}: Sin datos para importar`);
        continue;
      }

      try {
        const collection = atlasConnection.collection(collectionName);

        // Borrar datos existentes
        const deleteResult = await collection.deleteMany({});
        console.log(`   🗑️  ${collectionName}: ${deleteResult.deletedCount} documentos eliminados`);

        // Insertar nuevos datos
        const insertResult = await collection.insertMany(documents, { ordered: false });
        console.log(`   ✅ ${collectionName}: ${insertResult.insertedCount} documentos insertados`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`   ⚠️  ${collectionName}: Algunos documentos duplicados (ignorados)`);
        } else {
          console.error(`   ❌ ${collectionName}: Error - ${error.message}`);
        }
      }
    }

    await atlasConnection.close();
    console.log('\n   ✅ Datos importados exitosamente a Atlas');

    // PASO 3: Verificación
    console.log('\n📦 PASO 3: Verificando migración...');

    const verifyConnection = await mongoose.createConnection(ATLAS_MONGODB_URI).asPromise();

    console.log('\n   📊 Datos en MongoDB Atlas:');
    for (const collectionName of COLLECTIONS) {
      try {
        const collection = verifyConnection.collection(collectionName);
        const count = await collection.countDocuments();
        if (count > 0) {
          console.log(`   - ${collectionName}: ${count} documentos`);
        }
      } catch (error) {
        // Ignorar colecciones que no existen
      }
    }

    await verifyConnection.close();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE\n');
    console.log('📋 PRÓXIMOS PASOS:');
    console.log('   1. Verificar que Heroku esté usando MongoDB Atlas');
    console.log('   2. Reiniciar la aplicación en Heroku');
    console.log('   3. Probar login y verificar que los datos aparezcan');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR durante la migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar migración
console.log('\n⚡ Iniciando migración de datos...\n');
migrateData();
