const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

// Configuración de respaldo automático
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
const MAX_BACKUPS = 7; // Mantener 7 respaldos automáticos

const createBackup = async () => {
  try {
    console.log('🔄 Iniciando respaldo automático...');
    
    // Conectar a MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    const db = mongoose.connection.db;
    const collections = [
      'users', 'companies', 'contracttemplates', 'contractrequests', 
      'contracts', 'versionhistories', 'activitylogs', 'usercompanies',
      'companyusers', 'simplecontracts', 'documentversions', 'contractcounters'
    ];
    
    const backupData = {
      timestamp: new Date().toISOString(),
      type: 'AUTOMATIC_BACKUP',
      collections: {}
    };
    
    // Exportar cada colección
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        backupData.collections[collectionName] = documents;
        console.log(`📦 Respaldada: ${collectionName} (${documents.length} docs)`);
      } catch (error) {
        console.warn(`⚠️  Error respaldando ${collectionName}:`, error.message);
      }
    }
    
    // Guardar respaldo
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `auto-backup-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`💾 Respaldo automático guardado: ${backupFile}`);
    
    // Limpiar respaldos antiguos
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('auto-backup-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backupFiles.length > MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      filesToDelete.forEach(file => {
        fs.unlinkSync(path.join(backupDir, file));
        console.log(`🗑️  Eliminado respaldo antiguo: ${file}`);
      });
    }
    
    console.log('✅ Respaldo automático completado');
    
  } catch (error) {
    console.error('❌ Error en respaldo automático:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Función para verificar salud de la base de datos
const healthCheck = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    const db = mongoose.connection.db;
    
    // Verificar colecciones críticas
    const criticalCollections = ['users', 'companies', 'contracts'];
    let isHealthy = true;
    
    for (const collectionName of criticalCollections) {
      const count = await db.collection(collectionName).countDocuments();
      if (count === 0) {
        console.error(`❌ Colección ${collectionName} está vacía`);
        isHealthy = false;
      } else {
        console.log(`✅ ${collectionName}: ${count} documentos`);
      }
    }
    
    if (!isHealthy) {
      console.error('❌ Base de datos no saludable - creando respaldo de emergencia');
      await createBackup();
    }
    
    await mongoose.disconnect();
    return isHealthy;
    
  } catch (error) {
    console.error('❌ Error en verificación de salud:', error);
    return false;
  }
};

// Ejecutar respaldo inmediato
if (require.main === module) {
  createBackup().then(() => {
    console.log('🎯 Respaldo automático ejecutado');
    process.exit(0);
  });
}

module.exports = { createBackup, healthCheck };

