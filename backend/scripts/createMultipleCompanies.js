const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Company = require('../models/Company');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

async function createMultipleCompanies() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Limpiar datos existentes
    console.log('🗑️  Limpiando datos antiguos...');
    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({})
    ]);
    console.log('✅ Datos limpiados');

    console.log('🔄 Creando múltiples empresas y usuarios...');

    // Crear Empresa 1: TechCorp
    const company1 = await Company.create({
      name: 'TechCorp Solutions S.A.',
      tax_id: '20123456789',
      address: 'Av. Tecnología 123, Lima',
      phone: '+51 999 888 777',
      email: 'contacto@techcorp.com'
    });
    console.log('✅ Empresa 1 creada: TechCorp Solutions');

    // Crear Empresa 2: LegalFirm
    const company2 = await Company.create({
      name: 'LegalFirm & Asociados',
      tax_id: '20987654321',
      address: 'Jr. Abogados 456, Lima',
      phone: '+51 999 777 666',
      email: 'info@legalfirm.com'
    });
    console.log('✅ Empresa 2 creada: LegalFirm & Asociados');

    // Crear Empresa 3: BusinessCorp
    const company3 = await Company.create({
      name: 'BusinessCorp Internacional',
      tax_id: '20555666777',
      address: 'Av. Empresarial 789, Lima',
      phone: '+51 999 666 555',
      email: 'contact@businesscorp.com'
    });
    console.log('✅ Empresa 3 creada: BusinessCorp Internacional');

    // Crear usuarios para cada empresa
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Usuarios de TechCorp
    const admin1 = await User.create({
      email: 'admin@techcorp.com',
      password: hashedPassword,
      name: 'Carlos Admin TechCorp',
      role: 'admin',
      company: company1._id
    });

    const lawyer1 = await User.create({
      email: 'lawyer@techcorp.com',
      password: hashedPassword,
      name: 'Ana Lawyer TechCorp',
      role: 'lawyer',
      company: company1._id
    });

    const user1 = await User.create({
      email: 'user@techcorp.com',
      password: hashedPassword,
      name: 'Luis User TechCorp',
      role: 'requester',
      company: company1._id
    });

    // Usuarios de LegalFirm
    const admin2 = await User.create({
      email: 'admin@legalfirm.com',
      password: hashedPassword,
      name: 'María Admin LegalFirm',
      role: 'admin',
      company: company2._id
    });

    const lawyer2 = await User.create({
      email: 'lawyer@legalfirm.com',
      password: hashedPassword,
      name: 'Pedro Lawyer LegalFirm',
      role: 'lawyer',
      company: company2._id
    });

    const user2 = await User.create({
      email: 'user@legalfirm.com',
      password: hashedPassword,
      name: 'Sofia User LegalFirm',
      role: 'requester',
      company: company2._id
    });

    // Usuarios de BusinessCorp
    const admin3 = await User.create({
      email: 'admin@businesscorp.com',
      password: hashedPassword,
      name: 'Roberto Admin BusinessCorp',
      role: 'admin',
      company: company3._id
    });

    const lawyer3 = await User.create({
      email: 'lawyer@businesscorp.com',
      password: hashedPassword,
      name: 'Carmen Lawyer BusinessCorp',
      role: 'lawyer',
      company: company3._id
    });

    const user3 = await User.create({
      email: 'user@businesscorp.com',
      password: hashedPassword,
      name: 'Diego User BusinessCorp',
      role: 'requester',
      company: company3._id
    });

    console.log('✅ Usuarios creados para todas las empresas');

    console.log('\n✅ Base de datos inicializada con múltiples empresas!\n');
    console.log('📧 Credenciales de acceso por empresa:\n');
    
    console.log('🏢 TECHCORP SOLUTIONS:');
    console.log('   Admin:  admin@techcorp.com / 123456');
    console.log('   Lawyer: lawyer@techcorp.com / 123456');
    console.log('   User:   user@techcorp.com / 123456\n');
    
    console.log('⚖️ LEGALFIRM & ASOCIADOS:');
    console.log('   Admin:  admin@legalfirm.com / 123456');
    console.log('   Lawyer: lawyer@legalfirm.com / 123456');
    console.log('   User:   user@legalfirm.com / 123456\n');
    
    console.log('🏢 BUSINESSCORP INTERNACIONAL:');
    console.log('   Admin:  admin@businesscorp.com / 123456');
    console.log('   Lawyer: lawyer@businesscorp.com / 123456');
    console.log('   User:   user@businesscorp.com / 123456\n');

    console.log('🌐 Backend: http://localhost:5001');
    console.log('🌐 Frontend: http://localhost:3001\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error);
    process.exit(1);
  }
}

// Ejecutar
createMultipleCompanies();
