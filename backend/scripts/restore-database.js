const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

const restoreDatabase = async (backupFile) => {
  try {
    console.log('🔄 Iniciando restauración de la base de datos...');
    
    if (!backupFile) {
      console.error('❌ Debe especificar un archivo de respaldo');
      console.log('Uso: node restore-database.js <archivo-respaldo>');
      process.exit(1);
    }
    
    const backupPath = path.join(__dirname, '../backups', backupFile);
    
    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Archivo de respaldo no encontrado: ${backupPath}`);
      process.exit(1);
    }
    
    // Leer archivo de respaldo
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`📅 Respaldo creado: ${backupData.timestamp}`);
    
    // Conectar a MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Conectado a MongoDB');
    
    const db = mongoose.connection.db;
    
    // Restaurar cada colección
    for (const [collectionName, documents] of Object.entries(backupData.collections)) {
      try {
        const collection = db.collection(collectionName);
        
        // Limpiar colección existente
        await collection.deleteMany({});
        console.log(`🧹 Limpiada colección: ${collectionName}`);
        
        // Insertar documentos
        if (documents.length > 0) {
          await collection.insertMany(documents);
          console.log(`📦 Restaurada colección: ${collectionName} (${documents.length} documentos)`);
        } else {
          console.log(`📦 Colección vacía: ${collectionName}`);
        }
        
      } catch (error) {
        console.error(`❌ Error restaurando ${collectionName}:`, error.message);
      }
    }
    
    console.log('✅ Restauración completada exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
    process.exit(1);
  }
};

// Obtener archivo de respaldo del argumento
const backupFile = process.argv[2];
restoreDatabase(backupFile);

