const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

// Crear directorio de respaldos si no existe
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const backupDatabase = async () => {
  try {
    console.log('🔄 Iniciando respaldo de la base de datos...');
    
    // Conectar a MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Conectado a MongoDB');
    
    const db = mongoose.connection.db;
    const collections = [
      'users', 'companies', 'contracttemplates', 'contractrequests', 
      'contracts', 'versionhistories', 'activitylogs', 'usercompanies',
      'companyusers', 'simplecontracts', 'documentversions', 'contractcounters'
    ];
    
    const backupData = {
      timestamp: new Date().toISOString(),
      collections: {}
    };
    
    // Exportar cada colección
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        backupData.collections[collectionName] = documents;
        console.log(`📦 Respaldada colección: ${collectionName} (${documents.length} documentos)`);
      } catch (error) {
        console.warn(`⚠️  No se pudo respaldar ${collectionName}:`, error.message);
      }
    }
    
    // Guardar respaldo en archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`💾 Respaldo guardado en: ${backupFile}`);
    
    // Mantener solo los últimos 10 respaldos
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backupFiles.length > 10) {
      const filesToDelete = backupFiles.slice(10);
      filesToDelete.forEach(file => {
        fs.unlinkSync(path.join(backupDir, file));
        console.log(`🗑️  Eliminado respaldo antiguo: ${file}`);
      });
    }
    
    console.log('✅ Respaldo completado exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error durante el respaldo:', error);
    process.exit(1);
  }
};

// Ejecutar respaldo
backupDatabase();
