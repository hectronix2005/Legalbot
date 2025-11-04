const mongoose = require('mongoose');

const LOCAL_URI = 'mongodb://localhost:27017/legal-contracts';
const ATLAS_URI = 'mongodb+srv://LegalBot:Picap123@cluster0.o16ucum.mongodb.net/legalbot?retryWrites=true&w=majority&appName=Cluster0';

async function migrateData() {
  try {
    console.log('🚀 Iniciando migración de MongoDB LOCAL a ATLAS...\n');

    // Conectar a ambas bases de datos
    const localConn = mongoose.createConnection(LOCAL_URI);
    await localConn.asPromise();
    console.log('✅ Conectado a MongoDB LOCAL');

    const atlasConn = mongoose.createConnection(ATLAS_URI);
    await atlasConn.asPromise();
    console.log('✅ Conectado a MongoDB ATLAS\n');

    // Obtener todas las colecciones del local
    const collections = await localConn.db.listCollections().toArray();

    console.log(`📦 Encontradas ${collections.length} colecciones para analizar\n`);
    console.log('─'.repeat(80));

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const localCollection = localConn.db.collection(collectionName);
      const atlasCollection = atlasConn.db.collection(collectionName);

      // Obtener todos los documentos del local
      const localDocs = await localCollection.find({}).toArray();

      if (localDocs.length === 0) {
        console.log(`⊘  ${collectionName}: sin documentos (omitido)`);
        continue;
      }

      // Obtener IDs existentes en Atlas
      const atlasDocs = await atlasCollection.find({}).toArray();
      const atlasIds = new Set(atlasDocs.map(d => d._id.toString()));

      // Filtrar solo los documentos que NO existen en Atlas
      const newDocs = localDocs.filter(doc => !atlasIds.has(doc._id.toString()));

      if (newDocs.length > 0) {
        // Insertar solo los documentos nuevos
        try {
          await atlasCollection.insertMany(newDocs, { ordered: false });
          console.log(`✓  ${collectionName}: ${newDocs.length} documentos nuevos migrados (${localDocs.length} total en local)`);
          totalMigrated += newDocs.length;
        } catch (error) {
          if (error.code === 11000) {
            // Algunos documentos ya existían, insertar uno por uno
            let inserted = 0;
            for (const doc of newDocs) {
              try {
                await atlasCollection.insertOne(doc);
                inserted++;
              } catch (e) {
                // Documento duplicado, omitir
              }
            }
            console.log(`✓  ${collectionName}: ${inserted} documentos migrados (algunos ya existían)`);
            totalMigrated += inserted;
          } else {
            console.error(`✗  ${collectionName}: Error - ${error.message}`);
          }
        }
      } else {
        console.log(`✓  ${collectionName}: ${localDocs.length} documentos ya existen en Atlas (omitido)`);
        totalSkipped += localDocs.length;
      }
    }

    console.log('─'.repeat(80));
    console.log(`\n✅ Migración completada!`);
    console.log(`   📊 Documentos migrados: ${totalMigrated}`);
    console.log(`   ⊘  Documentos omitidos (ya existían): ${totalSkipped}`);

    // Verificación final
    console.log('\n🔍 Verificación final:\n');
    console.log('─'.repeat(80));
    console.log('Colección'.padEnd(30) + 'Local'.padEnd(15) + 'Atlas'.padEnd(15) + 'Estado');
    console.log('─'.repeat(80));

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const localCollection = localConn.db.collection(collectionName);
      const atlasCollection = atlasConn.db.collection(collectionName);

      const localCount = await localCollection.countDocuments();
      const atlasCount = await atlasCollection.countDocuments();

      const status = atlasCount >= localCount ? '✓' : '⚠️';

      console.log(
        collectionName.padEnd(30) +
        localCount.toString().padEnd(15) +
        atlasCount.toString().padEnd(15) +
        status
      );
    }

    console.log('─'.repeat(80));

    await localConn.close();
    await atlasConn.close();

    console.log('\n🔒 Conexiones cerradas');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrateData();
