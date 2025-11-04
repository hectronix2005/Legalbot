const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const UserCompany = require('./models/UserCompany');
const ContractCategory = require('./models/ContractCategory');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/legal-contracts';

async function fixCategories() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Buscar usuario Hector
    const hector = await User.findOne({ email: 'hector.neira@pfdsas.com' });
    if (!hector) {
      console.log('❌ Usuario no encontrado');
      process.exit(1);
    }

    // Obtener la empresa del usuario
    const userCompany = await UserCompany.findOne({ user: hector._id });
    if (!userCompany) {
      console.log('❌ Usuario no tiene empresa asignada');
      process.exit(1);
    }

    const targetCompanyId = userCompany.company;
    console.log(`🎯 Empresa objetivo: ${targetCompanyId}\n`);

    // Actualizar todas las categorías
    const categories = await ContractCategory.find();
    console.log(`📋 Actualizando ${categories.length} categorías...\n`);

    for (const category of categories) {
      category.company = targetCompanyId;
      await category.save();
      console.log(`✅ ${category.name} -> Ahora asociada a empresa ${targetCompanyId}`);
    }

    console.log(`\n✨ ¡${categories.length} categorías actualizadas exitosamente!`);
    console.log('\n🎉 Ahora el usuario debería ver todas las categorías');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCategories();
