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
const { initDailyAudit } = require('./jobs/vacationAuditJob');
const { initDailyAccrualJob } = require('./jobs/vacationAccrualJob');

const app = express();
const PORT = process.env.PORT || 3002;

// Variable para rastrear conexión
let mongoConnected = false;

// Conectar a MongoDB
connectDB().then(() => {
  mongoConnected = true;
  console.log('✅ MongoDB listo para backups');

  // ===================================================================
  // SISTEMA DE PROTECCIÓN DE DATOS AUTOMÁTICO
  // ===================================================================

  // 1. Backup automático cada 6 horas
  const BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas
  setInterval(async () => {
    try {
      console.log('\n⏰ Ejecutando backup automático programado...');
      const backup = await createFullBackup('HOURLY');
      if (backup) {
        console.log(`✅ Backup automático completado: ${backup.filename}`);
      }
    } catch (error) {
      console.error('❌ Error en backup automático:', error);
    }
  }, BACKUP_INTERVAL);

  // 2. Limpieza de backups antiguos cada 24 horas
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
  setInterval(async () => {
    try {
      console.log('\n🧹 Limpiando backups antiguos...');
      const result = await cleanOldBackups();
      console.log(`✅ Limpieza completada: ${result.deleted} backups eliminados, ${result.remaining} restantes`);
    } catch (error) {
      console.error('❌ Error en limpieza de backups:', error);
    }
  }, CLEANUP_INTERVAL);

  // 3. Backup semanal cada domingo a las 2am
  const scheduleWeeklyBackup = () => {
    const now = new Date();
    const nextSunday = new Date();
    nextSunday.setDate(now.getDate() + (7 - now.getDay()));
    nextSunday.setHours(2, 0, 0, 0);

    const timeUntilSunday = nextSunday.getTime() - now.getTime();

    setTimeout(async () => {
      try {
        console.log('\n📅 Creando backup semanal...');
        await promoteToWeekly();
        scheduleWeeklyBackup(); // Programar el próximo
      } catch (error) {
        console.error('❌ Error en backup semanal:', error);
      }
    }, timeUntilSunday);
  };
  scheduleWeeklyBackup();

  // 4. Monitoreo de integridad de datos cada 15 minutos
  startMonitoring(15);

  // 5. Verificación inicial de integridad
  setTimeout(async () => {
    try {
      console.log('\n🔍 Verificación inicial de integridad de datos...');
      const integrity = await verifyDataIntegrity();
      if (integrity.healthy) {
        console.log('✅ Integridad de datos verificada exitosamente');
      } else {
        console.error('❌ ADVERTENCIA: Problemas de integridad detectados');
        console.error('   Advertencias:', integrity.warnings);
      }
    } catch (error) {
      console.error('Error en verificación inicial:', error);
    }
  }, 5000); // Esperar 5 segundos después del inicio

  // 6. Backup inicial al arrancar
  setTimeout(async () => {
    try {
      console.log('\n💾 Creando backup inicial...');
      const backup = await createFullBackup('STARTUP');
      if (backup) {
        console.log(`✅ Backup inicial creado: ${backup.filename}`);
      }
    } catch (error) {
      console.error('Error creando backup inicial:', error);
    }
  }, 10000); // Esperar 10 segundos después del inicio

  // 7. Sistema de auditoría automática de vacaciones
  try {
    initDailyAudit();
    console.log('✅ Sistema de auditoría de vacaciones activado (2 AM diario)');
  } catch (error) {
    console.error('Error iniciando sistema de auditoría de vacaciones:', error);
  }

  // 8. Sistema de causación diaria automática de vacaciones
  try {
    initDailyAccrualJob();
    console.log('✅ Sistema de causación diaria de vacaciones activado (00:01 diario)');
  } catch (error) {
    console.error('Error iniciando sistema de causación de vacaciones:', error);
  }

  console.log('\n🛡️  SISTEMA DE PROTECCIÓN DE DATOS ACTIVADO');
  console.log('   ✓ Backups automáticos cada 6 horas');
  console.log('   ✓ Backups semanales los domingos');
  console.log('   ✓ Limpieza automática de backups antiguos');
  console.log('   ✓ Monitoreo de integridad cada 15 minutos');
  console.log('   ✓ Soft delete habilitado para terceros');
  console.log('   ✓ Auditoría completa de operaciones');
  console.log('   ✓ Auditoría automática de vacaciones (2 AM diario)');
  console.log('   ✓ Causación diaria de vacaciones (00:01 diario)\n');

}).catch(error => {
  console.error('Error conectando a MongoDB:', error);
});

// Configurar seguridad para entorno local
configureLocalSecurity(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging global - CAPTURA TODAS LAS PETICIONES
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📨 [${timestamp}] ${req.method} ${req.path}`);
  console.log(`   IP: ${req.ip}`);
  console.log(`   Origin: ${req.headers.origin || 'no-origin'}`);

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    console.log(`   Body keys: ${Object.keys(req.body).join(', ')}`);
  }

  // Capturar el response
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`   ✅ Response: ${res.statusCode}`);
    originalSend.call(this, data);
  };

  next();
});

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
const dataMigrationRoutes = require('./routes/data-migration');
const supplierFieldSuggestionsRoutes = require('./routes/supplier-field-suggestions');
const fieldManagementRoutes = require('./routes/field-management');
const thirdPartyProfilesRoutes = require('./routes/third-party-profiles');
const vacationRoutes = require('./routes/vacations');
const vacationRoutesV2 = require('./routes/vacationsV2');
const motorVacacionesRoutes = require('./routes/motorVacaciones');
const gestorSolicitudesRoutes = require('./routes/gestorSolicitudes');
const auditorVacacionesRoutes = require('./routes/auditorVacaciones');
const qaVacacionesRoutes = require('./routes/qaVacaciones');
const rolesRoutes = require('./routes/roles');

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
app.use('/api/data-migration', dataMigrationRoutes);
app.use('/api/supplier-field-suggestions', supplierFieldSuggestionsRoutes);
app.use('/api/field-management', fieldManagementRoutes);
app.use('/api/third-party-profiles', thirdPartyProfilesRoutes);
app.use('/api/vacations', vacationRoutes);
app.use('/api/vacations-v2', vacationRoutesV2);
app.use('/api/motor-vacaciones', motorVacacionesRoutes);
app.use('/api/gestor-solicitudes', gestorSolicitudesRoutes);
app.use('/api/auditor-vacaciones', auditorVacacionesRoutes);
app.use('/api/qa-vacaciones', qaVacacionesRoutes);
app.use('/api/roles', rolesRoutes);

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

  // Servir archivos estáticos con cache control
  app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
      // No cachear HTML files para evitar problemas con actualizaciones
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // TEMPORALMENTE: No cachear JS y CSS para forzar actualización
      // TODO: Volver a max-age=300 después de que usuarios actualicen
      else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  // Todas las rutas que no sean API deben servir el index.html (SPA)
  app.get('*', (req, res, next) => {
    // Ignorar rutas de API
    if (req.path.startsWith('/api')) {
      return next();
    }
    // Enviar index.html con headers no-cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.log('⚠️  Frontend build no encontrado en ninguna ubicación esperada');
  console.log('   Ubicaciones buscadas:', possibleFrontendPaths);
}

// Manejo de errores global - CAPTURA TODOS LOS ERRORES
app.use((err, req, res, next) => {
  console.error('\n❌❌❌ ERROR CAPTURADO ❌❌❌');
  console.error(`   Ruta: ${req.method} ${req.path}`);
  console.error(`   Error name: ${err.name}`);
  console.error(`   Error message: ${err.message}`);
  console.error(`   Error stack:`, err.stack);

  if (req.body && Object.keys(req.body).length > 0) {
    console.error(`   Request body keys: ${Object.keys(req.body).join(', ')}`);
  }

  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
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

    // Crear backup inicial - DISABLED to prevent nodemon restart loop
    // console.log('\n📦 Creando backup inicial...');
    // await createFullBackup('STARTUP');

    // Limpiar backups antiguos - DISABLED to prevent nodemon restart loop
    // console.log('\n🧹 Limpiando backups antiguos...');
    // await cleanOldBackups();

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

