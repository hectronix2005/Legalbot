const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Company = require('../models/Company');
const UserCompany = require('../models/UserCompany');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

async function createTestUsers() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Hash de la contraseña (misma para todos: 123456)
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Buscar una empresa para asignar a los usuarios
    const company = await Company.findOne();

    if (!company) {
      console.log('⚠️  No hay empresas en la base de datos. Los usuarios se crearán sin empresa asignada.');
    }

    console.log('🔄 Creando usuarios de prueba...\n');

    // 1. Usuario Talento Humano
    let talentoHumanoUser = await User.findOne({ email: 'talento.humano@test.com' });
    if (!talentoHumanoUser) {
      talentoHumanoUser = await User.create({
        email: 'talento.humano@test.com',
        password: hashedPassword,
        name: 'María González - Talento Humano',
        role: 'talento_humano',
        active: true
      });
      console.log('✅ Usuario Talento Humano creado');
    } else {
      console.log('⚠️  Usuario Talento Humano ya existe');
    }

    // 2. Usuario Colaboradores
    let colaboradorUser = await User.findOne({ email: 'colaborador@test.com' });
    if (!colaboradorUser) {
      colaboradorUser = await User.create({
        email: 'colaborador@test.com',
        password: hashedPassword,
        name: 'Juan Pérez - Colaborador',
        role: 'colaboradores',
        active: true
      });
      console.log('✅ Usuario Colaborador creado');
    } else {
      console.log('⚠️  Usuario Colaborador ya existe');
    }

    // Si hay empresa, asignar los usuarios a la empresa
    if (company) {
      console.log(`\n🔄 Asignando usuarios a la empresa: ${company.name}...\n`);

      // Asignar Talento Humano
      const existingTH = await UserCompany.findOne({
        user: talentoHumanoUser._id,
        company: company._id
      });

      if (!existingTH) {
        await UserCompany.create({
          user: talentoHumanoUser._id,
          company: company._id,
          role: 'talento_humano',
          permissions: {
            canView: true,
            canEdit: true,
            canDelete: false,
            canManageUsers: true,
            canManageContracts: true,
            canManageTemplates: false
          },
          isActive: true
        });
        console.log('✅ Talento Humano asignado a empresa');
      }

      // Asignar Colaborador
      const existingCol = await UserCompany.findOne({
        user: colaboradorUser._id,
        company: company._id
      });

      if (!existingCol) {
        await UserCompany.create({
          user: colaboradorUser._id,
          company: company._id,
          role: 'colaboradores',
          permissions: {
            canView: true,
            canEdit: false,
            canDelete: false,
            canManageUsers: false,
            canManageContracts: false,
            canManageTemplates: false
          },
          isActive: true
        });
        console.log('✅ Colaborador asignado a empresa');
      }
    }

    console.log('\n✅ Proceso completado exitosamente!\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('📧 CREDENCIALES DE USUARIOS DE PRUEBA');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('👤 TALENTO HUMANO:');
    console.log('   Email: talento.humano@test.com');
    console.log('   Contraseña: 123456');
    console.log('   Permisos: Ver, Editar, Gestionar Usuarios y Contratos\n');

    console.log('👤 COLABORADOR:');
    console.log('   Email: colaborador@test.com');
    console.log('   Contraseña: 123456');
    console.log('   Permisos: Solo visualización\n');

    if (company) {
      console.log(`🏢 Empresa asignada: ${company.name}\n`);
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('🌐 Accede en: http://localhost:3002/login');
    console.log('═══════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear usuarios de prueba:', error);
    process.exit(1);
  }
}

// Ejecutar
createTestUsers();
