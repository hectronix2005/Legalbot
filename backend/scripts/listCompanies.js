const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://LegalBot:Picap123@cluster0.o16ucum.mongodb.net/legalbot?retryWrites=true&w=majority&appName=Cluster0';

async function listCompanies() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB (legalbot)\n');

    const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
    const companies = await Company.find({}).lean();

    console.log(`📊 Total de empresas: ${companies.length}\n`);
    console.log('─'.repeat(80));

    companies.forEach((company, index) => {
      console.log(`\n${index + 1}. ${company.name || 'Sin nombre'}`);
      console.log(`   ID: ${company._id}`);
      console.log(`   NIT: ${company.nit || 'No especificado'}`);
      console.log(`   Creada: ${company.createdAt ? new Date(company.createdAt).toLocaleDateString() : 'No disponible'}`);
      if (company.updatedAt) {
        console.log(`   Actualizada: ${new Date(company.updatedAt).toLocaleDateString()}`);
      }
    });

    console.log('\n' + '─'.repeat(80));

    // Ahora verificar en la base de datos antigua
    console.log('\n\n🔍 Verificando empresas en base de datos anterior (legal_bot):\n');

    await mongoose.disconnect();
    await mongoose.connect(MONGODB_URI.replace('/legalbot', '/legal_bot'));

    const companiesOld = await Company.find({}).lean();
    console.log(`📊 Total de empresas en legal_bot: ${companiesOld.length}\n`);
    console.log('─'.repeat(80));

    companiesOld.forEach((company, index) => {
      console.log(`\n${index + 1}. ${company.name || 'Sin nombre'}`);
      console.log(`   ID: ${company._id}`);
      console.log(`   NIT: ${company.nit || 'No especificado'}`);
      console.log(`   Creada: ${company.createdAt ? new Date(company.createdAt).toLocaleDateString() : 'No disponible'}`);
    });

    console.log('\n' + '─'.repeat(80));

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listCompanies();
