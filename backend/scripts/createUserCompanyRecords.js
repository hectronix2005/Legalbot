const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const UserCompany = require('../models/UserCompany');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts';

async function createUserCompanyRecords() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Obtener la empresa y usuarios
    const company = await Company.findOne({});
    const admin = await User.findOne({ email: 'admin@demo.com' });
    const lawyer = await User.findOne({ email: 'abogado@demo.com' });
    const requester = await User.findOne({ email: 'solicitante@demo.com' });

    console.log('Company:', company ? company._id : 'NO ENCONTRADA');
    console.log('Admin:', admin ? admin._id : 'NO ENCONTRADO');
    console.log('Lawyer:', lawyer ? lawyer._id : 'NO ENCONTRADO');
    console.log('Requester:', requester ? requester._id : 'NO ENCONTRADO');

    if (!company || !admin) {
      console.error('❌ Falta company o admin');
      process.exit(1);
    }

    // Verificar UserCompany existentes
    const existingCount = await UserCompany.countDocuments();
    console.log('UserCompany records existentes:', existingCount);

    // Crear UserCompany records
    const userCompanyRecords = [];

    // Admin
    if (admin) {
      userCompanyRecords.push({
        user: admin._id,
        company: company._id,
        role: 'admin',
        permissions: {
          canView: true,
          canEdit: true,
          canDelete: true,
          canManageUsers: true
        },
        isActive: true,
        assignedBy: admin._id
      });
    }

    // Lawyer
    if (lawyer) {
      userCompanyRecords.push({
        user: lawyer._id,
        company: company._id,
        role: 'lawyer',
        permissions: {
          canView: true,
          canEdit: true,
          canDelete: false,
          canManageUsers: false
        },
        isActive: true,
        assignedBy: admin._id
      });
    }

    // Requester
    if (requester) {
      userCompanyRecords.push({
        user: requester._id,
        company: company._id,
        role: 'requester',
        permissions: {
          canView: true,
          canEdit: false,
          canDelete: false,
          canManageUsers: false
        },
        isActive: true,
        assignedBy: admin._id
      });
    }

    console.log('\n🔄 Insertando', userCompanyRecords.length, 'registros...');

    // Insertar records (usar insertMany con opción ordered:false para continuar si hay duplicados)
    try {
      const result = await UserCompany.insertMany(userCompanyRecords, { ordered: false });
      console.log('✅ UserCompany records creados:', result.length);
    } catch (error) {
      if (error.code === 11000) {
        console.log('⚠️  Algunos registros ya existían (duplicados ignorados)');
        console.log('Registros insertados:', error.insertedDocs?.length || 0);
      } else {
        throw error;
      }
    }

    // Verificar records creados
    const finalCount = await UserCompany.countDocuments();
    console.log('\n📊 Total UserCompany records:', finalCount);

    const allRecords = await UserCompany.find().populate('user', 'email').populate('company', 'name');
    console.log('\n📋 UserCompany records en la base de datos:');
    allRecords.forEach(uc => {
      const userEmail = uc.user?.email || 'N/A';
      const companyName = uc.company?.name || 'N/A';
      console.log(`  - ${userEmail} → ${companyName} (${uc.role})`);
    });

    console.log('\n✅ Proceso completado exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar
createUserCompanyRecords();
