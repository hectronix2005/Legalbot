const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Middleware de protección de datos
const dataProtectionMiddleware = (req, res, next) => {
  // Interceptar operaciones críticas
  const criticalOperations = ['DELETE', 'PUT', 'PATCH'];
  
  if (criticalOperations.includes(req.method)) {
    // Log de operaciones críticas
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      user: req.user?.id || 'anonymous',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    // Guardar log de operaciones críticas
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'critical-operations.log');
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    
    console.log(`⚠️  Operación crítica detectada: ${req.method} ${req.url}`);
  }
  
  next();
};

// Función para verificar integridad de datos
const verifyDataIntegrity = async () => {
  try {
    // Esperar a que la conexión esté lista
    if (mongoose.connection.readyState !== 1) {
      console.log('⏳ Esperando conexión a MongoDB...');
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) {
          resolve();
        } else {
          mongoose.connection.once('open', resolve);
        }
      });
    }
    
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Base de datos no disponible');
    }
    
    // Verificar que existen usuarios
    const userCount = await db.collection('users').countDocuments();
    if (userCount === 0) {
      throw new Error('CRITICAL: No hay usuarios en la base de datos');
    }
    
    // Verificar que existen empresas
    const companyCount = await db.collection('companies').countDocuments();
    if (companyCount === 0) {
      throw new Error('CRITICAL: No hay empresas en la base de datos');
    }
    
    // Verificar relaciones usuario-empresa
    const userCompanyCount = await db.collection('usercompanies').countDocuments();
    if (userCompanyCount === 0) {
      console.warn('⚠️  No hay relaciones usuario-empresa');
    }
    
    console.log('✅ Verificación de integridad de datos exitosa');
    return true;
    
  } catch (error) {
    console.error('❌ Error en verificación de integridad:', error.message);
    
    // Crear respaldo de emergencia
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const emergencyBackup = {
      timestamp: new Date().toISOString(),
      error: error.message,
      status: 'EMERGENCY_BACKUP'
    };
    
    const emergencyFile = path.join(backupDir, `emergency-${Date.now()}.json`);
    fs.writeFileSync(emergencyFile, JSON.stringify(emergencyBackup, null, 2));
    
    return false;
  }
};

// Función para crear respaldo automático
const createAutomaticBackup = async () => {
  try {
    // Esperar a que la conexión esté lista
    if (mongoose.connection.readyState !== 1) {
      console.log('⏳ Esperando conexión a MongoDB para respaldo...');
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) {
          resolve();
        } else {
          mongoose.connection.once('open', resolve);
        }
      });
    }
    
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Base de datos no disponible para respaldo');
    }
    
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
      } catch (error) {
        console.warn(`⚠️  No se pudo respaldar ${collectionName}:`, error.message);
      }
    }
    
    // Guardar respaldo automático
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `auto-backup-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`💾 Respaldo automático creado: ${backupFile}`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Error creando respaldo automático:', error);
    return null;
  }
};

module.exports = {
  dataProtectionMiddleware,
  verifyDataIntegrity,
  createAutomaticBackup
};
