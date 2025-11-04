const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

// Conexión a MongoDB Atlas
const sourceDB = 'legal_bot';
const targetDB = 'legalbot';

const MONGODB_BASE = 'mongodb+srv://LegalBot:Picap123@cluster0.o16ucum.mongodb.net/';
const MONGODB_OPTIONS = '?retryWrites=true&w=majority&appName=Cluster0';

async function copyDatabase() {
  try {
    console.log('🔄 Iniciando copia de base de datos...');
    console.log(`   De: ${sourceDB}`);
    console.log(`   A: ${targetDB}`);

    // Conectar a la base de datos origen
    const sourceConn = mongoose.createConnection(
      `${MONGODB_BASE}${sourceDB}${MONGODB_OPTIONS}`
    );

    await sourceConn.asPromise();
    console.log('✅ Conectado a base de datos origen');

    // Conectar a la base de datos destino
    const targetConn = mongoose.createConnection(
      `${MONGODB_BASE}${targetDB}${MONGODB_OPTIONS}`
    );

    await targetConn.asPromise();
    console.log('✅ Conectado a base de datos destino');

    // Obtener todas las colecciones de la base de datos origen
    const collections = await sourceConn.db.listCollections().toArray();

    console.log(`\n📦 Encontradas ${collections.length} colecciones para copiar:\n`);

    // Copiar cada colección
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`   Copiando: ${collectionName}...`);

      const sourceCollection = sourceConn.db.collection(collectionName);
      const targetCollection = targetConn.db.collection(collectionName);

      // Obtener todos los documentos
      const documents = await sourceCollection.find({}).toArray();

      if (documents.length > 0) {
        // Insertar en la base de datos destino
        await targetCollection.insertMany(documents);
        console.log(`   ✓ ${collectionName}: ${documents.length} documentos copiados`);
      } else {
        console.log(`   ⊘ ${collectionName}: sin documentos`);
      }
    }

    console.log('\n✅ Copia de base de datos completada exitosamente!');
    console.log(`\n📊 Resumen:`);
    console.log(`   Base de datos origen: ${sourceDB}`);
    console.log(`   Base de datos destino: ${targetDB}`);
    console.log(`   Colecciones copiadas: ${collections.length}`);

    // Cerrar conexiones
    await sourceConn.close();
    await targetConn.close();

    console.log('\n🔒 Conexiones cerradas');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error copiando base de datos:', error);
    process.exit(1);
  }
}

// Ejecutar la copia
copyDatabase();
