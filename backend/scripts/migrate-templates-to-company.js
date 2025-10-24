const mongoose = require('mongoose');
require('dotenv').config();

// Conectar a MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
}

async function migrateTemplates() {
  try {
    console.log('\n🔍 Iniciando migración de plantillas...\n');

    // Obtener todas las empresas
    const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }));
    const companies = await Company.find({ active: true });

    if (companies.length === 0) {
      console.error('❌ No se encontraron empresas activas en la base de datos');
      process.exit(1);
    }

    console.log(`📊 Empresas disponibles: ${companies.length}`);
    companies.forEach((company, index) => {
      console.log(`   ${index + 1}. ${company.name} (ID: ${company._id})`);
    });

    // Usar la primera empresa (Empresa Demo) como empresa por defecto
    const defaultCompany = companies[0];
    console.log(`\n✅ Usando "${defaultCompany.name}" como empresa por defecto\n`);

    // Obtener plantillas sin empresa
    const ContractTemplate = mongoose.model('ContractTemplate', new mongoose.Schema({}, { strict: false }));
    const templatesWithoutCompany = await ContractTemplate.find({
      $or: [
        { company: null },
        { company: { $exists: false } }
      ]
    });

    console.log(`📋 Plantillas sin empresa encontradas: ${templatesWithoutCompany.length}\n`);

    if (templatesWithoutCompany.length === 0) {
      console.log('✅ No hay plantillas para migrar');
      return;
    }

    // Mostrar plantillas a migrar
    console.log('Plantillas que serán migradas:');
    templatesWithoutCompany.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.name} (${template.category || 'Sin categoría'})`);
    });

    console.log(`\n🔄 Asignando plantillas a "${defaultCompany.name}"...\n`);

    // Migrar plantillas
    const result = await ContractTemplate.updateMany(
      {
        $or: [
          { company: null },
          { company: { $exists: false } }
        ]
      },
      {
        $set: { company: defaultCompany._id }
      }
    );

    console.log(`✅ Migración completada:`);
    console.log(`   - Plantillas actualizadas: ${result.modifiedCount}`);
    console.log(`   - Empresa asignada: ${defaultCompany.name}`);
    console.log(`   - ID de empresa: ${defaultCompany._id}`);

    // Verificar migración
    const remainingTemplatesWithoutCompany = await ContractTemplate.countDocuments({
      $or: [
        { company: null },
        { company: { $exists: false } }
      ]
    });

    if (remainingTemplatesWithoutCompany === 0) {
      console.log('\n✅ Todas las plantillas han sido migradas correctamente');
    } else {
      console.log(`\n⚠️  Aún quedan ${remainingTemplatesWithoutCompany} plantillas sin empresa`);
    }

    // Mostrar resumen por empresa
    console.log('\n📊 Resumen de plantillas por empresa:');
    for (const company of companies) {
      const count = await ContractTemplate.countDocuments({ company: company._id });
      console.log(`   - ${company.name}: ${count} plantillas`);
    }

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    await migrateTemplates();
    console.log('\n✅ Proceso completado exitosamente\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  }
}

// Ejecutar script
main();
