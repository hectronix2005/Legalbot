const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

const healthCheck = async () => {
  try {
    console.log('🔍 Verificando salud de la base de datos...');
    
    // Conectar a MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB conectado');
    
    const db = mongoose.connection.db;
    
    // Verificar colecciones críticas
    const criticalCollections = [
      'users', 'companies', 'contracttemplates', 'contractrequests', 'contracts'
    ];
    
    const stats = {};
    
    for (const collectionName of criticalCollections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        stats[collectionName] = count;
        console.log(`📊 ${collectionName}: ${count} documentos`);
      } catch (error) {
        console.error(`❌ Error verificando ${collectionName}:`, error.message);
        stats[collectionName] = 'ERROR';
      }
    }
    
    // Verificar integridad de datos
    const users = await db.collection('users').find({}).toArray();
    const companies = await db.collection('companies').find({}).toArray();
    
    console.log('\n📋 Resumen de salud:');
    console.log(`👥 Usuarios activos: ${users.filter(u => u.active !== false).length}`);
    console.log(`🏢 Empresas activas: ${companies.filter(c => c.active !== false).length}`);
    
    // Verificar conexiones de usuarios-empresas
    const userCompanies = await db.collection('usercompanies').countDocuments();
    console.log(`🔗 Relaciones usuario-empresa: ${userCompanies}`);
    
    // Verificar contratos recientes
    const recentContracts = await db.collection('contracts').countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    console.log(`📄 Contratos últimos 7 días: ${recentContracts}`);
    
    console.log('\n✅ Verificación de salud completada');
    
    // Generar reporte de salud
    const healthReport = {
      timestamp: new Date().toISOString(),
      status: 'HEALTHY',
      collections: stats,
      summary: {
        activeUsers: users.filter(u => u.active !== false).length,
        activeCompanies: companies.filter(c => c.active !== false).length,
        userCompanyRelations: userCompanies,
        recentContracts: recentContracts
      }
    };
    
    console.log('\n📊 Reporte de salud:');
    console.log(JSON.stringify(healthReport, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error en verificación de salud:', error);
    
    const errorReport = {
      timestamp: new Date().toISOString(),
      status: 'UNHEALTHY',
      error: error.message
    };
    
    console.log('\n❌ Reporte de error:');
    console.log(JSON.stringify(errorReport, null, 2));
    
    process.exit(1);
  }
};

// Ejecutar verificación de salud
healthCheck();

