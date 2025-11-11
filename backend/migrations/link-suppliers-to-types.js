/**
 * Migración: Vincular terceros existentes a sus tipos correspondientes
 *
 * Este script analiza terceros sin tipo asignado y los vincula
 * basándose en su nombre o campos personalizados
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');

async function linkSuppliers(dryRun = true) {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts');
    console.log('✅ Conectado a MongoDB\n');

    // 1. Obtener tipos disponibles
    console.log('🔍 Obteniendo tipos de terceros...');
    const types = await ThirdPartyTypeConfig.find({ active: true });
    console.log(`✅ Encontrados ${types.length} tipos activos:\n`);
    types.forEach(type => {
      console.log(`   - ${type.label} (${type.code})`);
    });

    // 2. Buscar terceros sin tipo asignado
    console.log('\n🔍 Buscando terceros sin tipo asignado...');
    const suppliersWithoutType = await Supplier.find({
      third_party_type: { $exists: false }
    });

    console.log(`📋 Encontrados ${suppliersWithoutType.length} terceros sin tipo\n`);

    if (suppliersWithoutType.length === 0) {
      console.log('✅ Todos los terceros ya tienen tipo asignado');
      await mongoose.connection.close();
      return;
    }

    // 3. Analizar y vincular cada tercero
    const updates = [];
    const phType = types.find(t => t.code === 'propiedad_horizontal' || t.code === 'ph');
    const proveedorType = types.find(t => t.code === 'proveedor');

    for (const supplier of suppliersWithoutType) {
      const name = (supplier.legal_name || supplier.full_name || '').toLowerCase();
      const customFields = supplier.custom_fields || {};
      const customFieldKeys = Object.keys(customFields).map(k => k.toLowerCase());

      let suggestedType = null;
      let reason = '';

      // Detectar Propiedad Horizontal
      if (
        name.includes('ph') ||
        name.includes('propiedad horizontal') ||
        name.includes('copropiedad') ||
        name.includes('copropietarios') ||
        customFieldKeys.some(k => k.includes('licenciatario')) ||
        customFieldKeys.some(k => k.includes('nombre_del_licenciatario'))
      ) {
        suggestedType = phType;
        reason = 'Detectado por nombre o campos relacionados a PH';
      }
      // Detectar Proveedor (por defecto si no es PH)
      else if (proveedorType) {
        suggestedType = proveedorType;
        reason = 'Asignado como proveedor por defecto';
      }

      if (suggestedType) {
        console.log(`\n📝 ${supplier.legal_name || supplier.full_name}`);
        console.log(`   ID: ${supplier._id}`);
        console.log(`   Tipo sugerido: ${suggestedType.label} (${suggestedType.code})`);
        console.log(`   Razón: ${reason}`);

        updates.push({
          supplierId: supplier._id,
          supplierName: supplier.legal_name || supplier.full_name,
          typeId: suggestedType._id,
          typeCode: suggestedType.code,
          typeLabel: suggestedType.label,
          reason
        });

        if (!dryRun) {
          supplier.third_party_type = suggestedType._id;
          await supplier.save({ validateBeforeSave: false });
          console.log('   ✅ Tipo actualizado');
        } else {
          console.log('   [DRY-RUN] No se aplicaron cambios');
        }
      }
    }

    // 4. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE VINCULACIÓN');
    console.log('='.repeat(60));
    console.log(`Modo: ${dryRun ? 'DRY-RUN (sin cambios)' : 'EJECUCIÓN REAL'}`);
    console.log(`Terceros sin tipo: ${suppliersWithoutType.length}`);
    console.log(`Terceros vinculados: ${updates.length}`);

    // Agrupar por tipo
    const byType = {};
    updates.forEach(u => {
      if (!byType[u.typeLabel]) {
        byType[u.typeLabel] = 0;
      }
      byType[u.typeLabel]++;
    });

    console.log('\nDistribución por tipo:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} terceros`);
    });

    if (dryRun) {
      console.log('\n💡 Para aplicar los cambios, ejecuta:');
      console.log('   node migrations/link-suppliers-to-types.js --apply');
    } else {
      console.log('\n✅ Vinculación completada exitosamente');
    }

    await mongoose.connection.close();
    console.log('\n🔌 Desconectado de MongoDB');

  } catch (error) {
    console.error('❌ Error en la vinculación:', error);
    process.exit(1);
  }
}

// Ejecutar
const isDryRun = !process.argv.includes('--apply');
console.log('🚀 Iniciando vinculación de terceros a tipos...');
console.log(`Modo: ${isDryRun ? 'DRY-RUN (solo lectura)' : 'APLICAR CAMBIOS'}\n`);

linkSuppliers(isDryRun);
