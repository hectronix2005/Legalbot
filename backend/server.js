const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/mongodb');
const { dataProtectionMiddleware } = require('./middleware/dataProtection');
const { configureLocalSecurity } = require('./middleware/localDevSecurity');
const {
  createFullBackup,
  cleanOldBackups,
  verifyDataIntegrity,
  promoteToWeekly
} = require('./services/robustBackup');
const {
  startMonitoring,
  stopMonitoring,
  fullSystemCheck,
  updateKnownGoodCounts
} = require('./services/dataLossProtection');

const app = express();
const PORT = process.env.PORT || 3002;

// Variable para rastrear conexión
let mongoConnected = false;

// Conectar a MongoDB
connectDB().then(() => {
  mongoConnected = true;
  console.log('✅ MongoDB listo para backups');
}).catch(error => {
  console.error('Error conectando a MongoDB:', error);
});

// Configurar seguridad para entorno local
configureLocalSecurity(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de protección de datos
app.use(dataProtectionMiddleware);

// Crear directorio de uploads si no existe
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Crear directorio de base de datos si no existe
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Importar rutas (MongoDB)
const authRoutes = require('./routes/auth-mongo');
const companyRoutes = require('./routes/companies-mongo');
const templateRoutes = require('./routes/templates-mongo');
const requestRoutes = require('./routes/requests-mongo');
const contractRoutes = require('./routes/contracts-mongo');
const userRoutes = require('./routes/users-mongo');
const dashboardRoutes = require('./routes/dashboard-mongo');
const userCompanyRoutes = require('./routes/user-company-mongo');
const userMultipleCompaniesRoutes = require('./routes/user-multiple-companies');
const companyUsersRoutes = require('./routes/company-users');
const wordProcessorRoutes = require('./routes/word-processor');
const contractGeneratorRoutes = require('./routes/contract-generator');
const documentManagementRoutes = require('./routes/document-management');
const supplierRoutes = require('./routes/suppliers');
const thirdPartyTypesConfigRoutes = require('./routes/third-party-types-config');
const diagnosticsRoutes = require('./routes/diagnostics');

// Nuevas rutas para el sistema de categorías y aprobaciones
const contractCategoriesRoutes = require('./routes/contract-categories');
const supplierApprovalsRoutes = require('./routes/supplier-approvals');
const contractRequestsImprovedRoutes = require('./routes/contract-requests-improved');

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/super-admin', userCompanyRoutes);
app.use('/api/multi-companies', userMultipleCompaniesRoutes);
app.use('/api/company-users', companyUsersRoutes);
app.use('/api/templates', wordProcessorRoutes);
app.use('/api/contract-generator', contractGeneratorRoutes);
app.use('/api/documents', documentManagementRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/third-party-types', thirdPartyTypesConfigRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);

// Nuevas rutas
app.use('/api/contract-categories', contractCategoriesRoutes);
app.use('/api/supplier-approvals', supplierApprovalsRoutes);
app.use('/api/contract-requests-v2', contractRequestsImprovedRoutes);

// Ruta raíz - Comentada para permitir que el frontend se sirva en /
// La información de la API está disponible en /api/health
// app.get('/', (req, res) => {
//   res.json({
//     name: 'Legal Bot API',
//     version: '1.0.0',
//     status: 'running',
//     environment: process.env.NODE_ENV || 'development',
//     endpoints: {
//       health: '/api/health',
//       auth: '/api/auth',
//       contracts: '/api/contracts',
//       templates: '/api/templates',
//       dashboard: '/api/dashboard',
//       users: '/api/users',
//       companies: '/api/companies'
//     },
//     documentation: 'Para más información, contacta al administrador'
//   });
// });

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API de contratos funcionando correctamente' });
});

// Servir archivos estáticos del frontend
// Primero intentar con public (para producción/Heroku), luego con ../frontend/build (desarrollo)
const possibleFrontendPaths = [
  path.join(__dirname, 'public'),
  path.join(__dirname, '../frontend/build'),
  path.join(__dirname, '../frontend/dist')
];

let frontendPath = null;
for (const possiblePath of possibleFrontendPaths) {
  if (fs.existsSync(possiblePath)) {
    frontendPath = possiblePath;
    break;
  }
}

if (frontendPath) {
  console.log(`📁 Sirviendo frontend desde: ${frontendPath}`);
  app.use(express.static(frontendPath));

  // Todas las rutas que no sean API deben servir el index.html (SPA)
  app.get('*', (req, res, next) => {
    // Ignorar rutas de API
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.log('⚠️  Frontend build no encontrado en ninguna ubicación esperada');
  console.log('   Ubicaciones buscadas:', possibleFrontendPaths);
}

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Variables para control de backups
let backupInterval = null;
let weeklyBackupInterval = null;

// Sistema robusto de protección de datos
const initializeDataProtection = async () => {
  try {
    // Esperar a que MongoDB esté conectado
    let attempts = 0;
    while (!mongoConnected && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!mongoConnected) {
      console.error('❌ MongoDB no conectado después de 30 segundos, omitiendo protección de datos');
      return;
    }

    console.log('🔍 Verificando integridad de datos...');
    const integrity = await verifyDataIntegrity();

    if (!integrity.healthy) {
      console.warn('⚠️  Advertencias de integridad:');
      integrity.warnings.forEach(w => console.warn(`   ${w}`));
    } else {
      console.log('✅ Integridad de datos verificada');
    }

    console.log('📊 Estado actual:');
    Object.entries(integrity.stats || {}).forEach(([coll, count]) => {
      console.log(`   - ${coll}: ${count} documentos`);
    });

    // Crear backup inicial
    console.log('\n📦 Creando backup inicial...');
    await createFullBackup('STARTUP');

    // Limpiar backups antiguos
    console.log('\n🧹 Limpiando backups antiguos...');
    await cleanOldBackups();

    // Programar backups cada hora
    console.log('\n⏰ Programando backups automáticos cada hora...');
    backupInterval = setInterval(async () => {
      try {
        console.log('\n⏰ Ejecutando backup automático horario...');
        await createFullBackup('HOURLY');
        await cleanOldBackups();
      } catch (error) {
        console.error('❌ Error en backup automático:', error);
      }
    }, 60 * 60 * 1000); // Cada hora

    // Programar backup semanal (domingos a las 3 AM)
    console.log('⏰ Programando backups semanales...');
    weeklyBackupInterval = setInterval(async () => {
      const now = new Date();
      // Si es domingo (0) a las 3 AM
      if (now.getDay() === 0 && now.getHours() === 3) {
        try {
          console.log('\n📅 Creando backup semanal...');
          await promoteToWeekly();
          await cleanOldBackups();
        } catch (error) {
          console.error('❌ Error en backup semanal:', error);
        }
      }
    }, 60 * 60 * 1000); // Revisar cada hora

    console.log('✅ Sistema de protección de datos inicializado');

    // Inicializar conteos conocidos buenos
    await updateKnownGoodCounts();

    // Iniciar monitoreo continuo (cada 15 minutos)
    startMonitoring(15);
  } catch (error) {
    console.error('❌ Error inicializando protección de datos:', error);
  }
};

// Limpieza al cerrar el servidor
process.on('SIGTERM', async () => {
  console.log('\n⚠️  Señal SIGTERM recibida, cerrando servidor...');
  if (backupInterval) clearInterval(backupInterval);
  if (weeklyBackupInterval) clearInterval(weeklyBackupInterval);
  stopMonitoring();
  console.log('📦 Creando backup final...');
  try {
    await createFullBackup('SHUTDOWN');
  } catch (error) {
    console.error('Error creando backup final:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  Señal SIGINT recibida, cerrando servidor...');
  if (backupInterval) clearInterval(backupInterval);
  if (weeklyBackupInterval) clearInterval(weeklyBackupInterval);
  stopMonitoring();
  console.log('📦 Creando backup final...');
  try {
    await createFullBackup('SHUTDOWN');
  } catch (error) {
    console.error('Error creando backup final:', error);
  }
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  
  // Inicializar protección de datos
  await initializeDataProtection();
});

