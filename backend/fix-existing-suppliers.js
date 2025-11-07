const mongoose = require('mongoose');
const Supplier = require('./models/Supplier');

async function fixExistingSuppliers() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts');
    
    console.log('✅ Conectado a MongoDB');
    
    // Actualizar todos los terceros que están pendientes para que sean inactivos
    const result = await Supplier.updateMany(
      { approval_status: 'pending' },
      { $set: { active: false } }
    );
    
    console.log(`✅ Actualizado ${result.modifiedCount} terceros pendientes a inactivos`);
    
    // Actualizar todos los terceros aprobados para que sean activos
    const result2 = await Supplier.updateMany(
      { approval_status: 'approved' },
      { $set: { active: true } }
    );
    
    console.log(`✅ Actualizado ${result2.modifiedCount} terceros aprobados a activos`);
    
    // Actualizar todos los terceros rechazados para que sean inactivos
    const result3 = await Supplier.updateMany(
      { approval_status: 'rejected' },
      { $set: { active: false } }
    );
    
    console.log(`✅ Actualizado ${result3.modifiedCount} terceros rechazados a inactivos`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixExistingSuppliers();
