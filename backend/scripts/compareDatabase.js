const mongoose = require('mongoose');

const sourceDB = 'legal_bot';
const targetDB = 'legalbot';

const MONGODB_BASE = 'mongodb+srv://LegalBot:Picap123@cluster0.o16ucum.mongodb.net/';
const MONGODB_OPTIONS = '?retryWrites=true&w=majority&appName=Cluster0';

async function compareDatabase() {
  try {
    console.log('🔍 Comparando bases de datos...\n');

    // Conectar a ambas bases de datos
    const sourceConn = mongoose.createConnection(`${MONGODB_BASE}${sourceDB}${MONGODB_OPTIONS}`);
    await sourceConn.asPromise();
    console.log(`✅ Conectado a ${sourceDB}`);

    const targetConn = mongoose.createConnection(`${MONGODB_BASE}${targetDB}${MONGODB_OPTIONS}`);
    await targetConn.asPromise();
    console.log(`✅ Conectado a ${targetDB}\n`);

    // Obtener colecciones de ambas bases de datos
    const sourceCollections = await sourceConn.db.listCollections().toArray();
    const targetCollections = await targetConn.db.listCollections().toArray();

    console.log('📊 Comparación de colecciones:\n');
    console.log('─'.repeat(80));
    console.log('Colección'.padEnd(30) + 'Original'.padEnd(15) + 'Nueva'.padEnd(15) + 'Diferencia');
    console.log('─'.repeat(80));

    const collectionNames = [...new Set([
      ...sourceCollections.map(c => c.name),
      ...targetCollections.map(c => c.name)
    ])];

    let hasDifferences = false;
    const differences = [];

    for (const collectionName of collectionNames.sort()) {
      const sourceCollection = sourceConn.db.collection(collectionName);
      const targetCollection = targetConn.db.collection(collectionName);

      const sourceCount = await sourceCollection.countDocuments();
      const targetCount = await targetCollection.countDocuments();

      const diff = targetCount - sourceCount;
      const diffStr = diff === 0 ? '✓' : `${diff > 0 ? '+' : ''}${diff} ⚠️`;

      if (diff !== 0) {
        hasDifferences = true;
        differences.push({
          collection: collectionName,
          source: sourceCount,
          target: targetCount,
          diff: diff
        });
      }

      console.log(
        collectionName.padEnd(30) +
        sourceCount.toString().padEnd(15) +
        targetCount.toString().padEnd(15) +
        diffStr
      );
    }

    console.log('─'.repeat(80));

    if (hasDifferences) {
      console.log('\n⚠️  ALERTA: Se encontraron diferencias entre las bases de datos!\n');
      console.log('📋 Detalles de las diferencias:\n');

      for (const diff of differences) {
        console.log(`❌ ${diff.collection}:`);
        console.log(`   Original (${sourceDB}): ${diff.source} documentos`);
        console.log(`   Nueva (${targetDB}): ${diff.target} documentos`);
        console.log(`   Diferencia: ${diff.diff} documentos\n`);
      }

      // Mostrar documentos faltantes en collections críticas
      const criticalCollections = ['companies', 'users', 'contracttemplates', 'contracts'];

      for (const collName of criticalCollections) {
        const diffItem = differences.find(d => d.collection === collName);
        if (diffItem && diffItem.diff < 0) {
          console.log(`\n🔍 Analizando documentos faltantes en ${collName}:\n`);

          const sourceCollection = sourceConn.db.collection(collName);
          const targetCollection = targetConn.db.collection(collName);

          const sourceDocs = await sourceCollection.find({}).toArray();
          const targetDocs = await targetCollection.find({}).toArray();

          const sourceIds = new Set(sourceDocs.map(d => d._id.toString()));
          const targetIds = new Set(targetDocs.map(d => d._id.toString()));

          const missingIds = [...sourceIds].filter(id => !targetIds.has(id));

          console.log(`   Documentos faltantes: ${missingIds.length}`);

          for (const missingId of missingIds.slice(0, 5)) {
            const doc = sourceDocs.find(d => d._id.toString() === missingId);
            console.log(`   - ID: ${missingId}`);
            if (doc.name) console.log(`     Nombre: ${doc.name}`);
            if (doc.title) console.log(`     Título: ${doc.title}`);
            if (doc.email) console.log(`     Email: ${doc.email}`);
          }

          if (missingIds.length > 5) {
            console.log(`   ... y ${missingIds.length - 5} más`);
          }
        }
      }
    } else {
      console.log('\n✅ Las bases de datos están sincronizadas correctamente');
    }

    await sourceConn.close();
    await targetConn.close();

    process.exit(hasDifferences ? 1 : 0);

  } catch (error) {
    console.error('❌ Error comparando bases de datos:', error);
    process.exit(1);
  }
}

compareDatabase();
