const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

async function createSuperAdmin() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Verificar si ya existe un super admin
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      console.log('⚠️  Ya existe un Super Admin:', existingSuperAdmin.email);
      console.log('📧 Email:', existingSuperAdmin.email);
      console.log('🔑 Contraseña: 123456');
      process.exit(0);
    }

    console.log('🔄 Creando Super Admin...');

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Crear Super Admin
    const superAdmin = await User.create({
      email: 'superadmin@legalbot.com',
      password: hashedPassword,
      name: 'Super Administrador del Sistema',
      role: 'super_admin',
      company: null // Super admin no pertenece a ninguna empresa
    });

    console.log('✅ Super Admin creado exitosamente!');
    console.log('\n📧 Credenciales del Super Admin:');
    console.log('   Email: superadmin@legalbot.com');
    console.log('   Contraseña: 123456');
    console.log('\n🔑 Permisos del Super Admin:');
    console.log('   - Gestionar relación usuarios-empresas');
    console.log('   - Crear nuevos usuarios');
    console.log('   - Asignar usuarios a empresas');
    console.log('   - Acceso completo a todas las funcionalidades');
    console.log('\n🌐 Backend: http://localhost:5001');
    console.log('🌐 Frontend: http://localhost:3001\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear Super Admin:', error);
    process.exit(1);
  }
}

// Ejecutar
createSuperAdmin();
