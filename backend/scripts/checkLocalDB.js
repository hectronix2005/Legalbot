const mongoose = require('mongoose');

const LOCAL_URI = 'mongodb://localhost:27017/legal-contracts';

async function checkLocalDB() {
  try {
    await mongoose.connect(LOCAL_URI);
    console.log('✅ Conectado a MongoDB LOCAL (legal-contracts)\n');

    const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
    const companies = await Company.find({}).lean();

    console.log(`📊 Total de empresas en MongoDB LOCAL: ${companies.length}\n`);
    console.log('─'.repeat(80));

    if (companies.length > 0) {
      companies.forEach((company, index) => {
        console.log(`\n${index + 1}. ${company.name || 'Sin nombre'}`);
        console.log(`   ID: ${company._id}`);
        console.log(`   NIT: ${company.nit || 'No especificado'}`);
        console.log(`   Creada: ${company.createdAt ? new Date(company.createdAt).toLocaleDateString() : 'No disponible'}`);
      });
      console.log('\n' + '─'.repeat(80));
      console.log('\n⚠️  ENCONTRADAS EMPRESAS EN BASE DE DATOS LOCAL!');
      console.log('   Estas empresas NO están en MongoDB Atlas (producción)');
      console.log('   Necesitas migrar estos datos a MongoDB Atlas\n');
    } else {
      console.log('\n✓ No hay empresas en la base de datos local');
    }

    // Verificar otras colecciones
    console.log('\n📊 Verificando otras colecciones en MongoDB LOCAL:\n');

    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const collInfo of collections) {
      const collection = mongoose.connection.db.collection(collInfo.name);
      const count = await collection.countDocuments();
      if (count > 0) {
        console.log(`   ${collInfo.name}: ${count} documentos`);
      }
    }

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 MongoDB local no está corriendo o no tiene la base de datos "legal-contracts"');
    process.exit(1);
  }
}

checkLocalDB();
