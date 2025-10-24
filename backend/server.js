const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/mongodb');
const { dataProtectionMiddleware, verifyDataIntegrity, createAutomaticBackup } = require('./middleware/dataProtection');

const app = express();
const PORT = process.env.PORT || 5000;

// Conectar a MongoDB
connectDB();

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

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API de contratos funcionando correctamente' });
});

// Servir archivos estáticos del frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Verificar integridad de datos al iniciar
const initializeDataProtection = async () => {
  try {
    console.log('🔍 Verificando integridad de datos...');
    const isHealthy = await verifyDataIntegrity();
    
    if (!isHealthy) {
      console.log('⚠️  Creando respaldo de emergencia...');
      await createAutomaticBackup();
    }
    
    console.log('✅ Protección de datos inicializada');
  } catch (error) {
    console.error('❌ Error inicializando protección de datos:', error);
  }
};

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  
  // Inicializar protección de datos
  await initializeDataProtection();
});

