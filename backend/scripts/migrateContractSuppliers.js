/**
 * Script de migración para vincular contratos existentes con sus terceros/suppliers
 *
 * Este script busca contratos que no tienen el campo 'supplier' y trata de
 * asociarlos con el tercero correcto basándose en:
 * 1. El campo company_name del contrato
 * 2. El contenido del contrato (búsqueda por número de identificación)
 *
 * Ejecutar con: node backend/scripts/migrateContractSuppliers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Conectar a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalbot';

async function migrateContractSuppliers() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const Contract = require('../models/Contract');
    const Supplier = require('../models/Supplier');

    // Obtener todos los contratos sin supplier asignado
    const contractsWithoutSupplier = await Contract.find({
      supplier: { $exists: false }
    }).lean();

    console.log(`📋 Encontrados ${contractsWithoutSupplier.length} contratos sin tercero asignado`);

    // Obtener todos los suppliers para matching
    const allSuppliers = await Supplier.find({ deleted: { $ne: true } }).lean();
    console.log(`👥 Total de terceros disponibles: ${allSuppliers.length}`);

    let updated = 0;
    let notFound = 0;

    for (const contract of contractsWithoutSupplier) {
      let matchedSupplier = null;

      // Estrategia 1: Buscar por company_name exacto
      if (contract.company_name) {
        matchedSupplier = allSuppliers.find(s =>
          s.legal_name === contract.company_name ||
          s.legal_name_short === contract.company_name ||
          s.full_name === contract.company_name
        );
      }

      // Estrategia 2: Buscar en el contenido del contrato
      if (!matchedSupplier && contract.content) {
        for (const supplier of allSuppliers) {
          // Buscar número de identificación en el contenido
          if (contract.content.includes(supplier.identification_number)) {
            matchedSupplier = supplier;
            break;
          }
        }
      }

      // Estrategia 3: Buscar match parcial del nombre
      if (!matchedSupplier && contract.company_name) {
        matchedSupplier = allSuppliers.find(s =>
          s.legal_name && contract.company_name &&
          (s.legal_name.toLowerCase().includes(contract.company_name.toLowerCase()) ||
           contract.company_name.toLowerCase().includes(s.legal_name.toLowerCase()))
        );
      }

      if (matchedSupplier) {
        // Actualizar el contrato
        await Contract.updateOne(
          { _id: contract._id },
          {
            $set: {
              supplier: matchedSupplier._id,
              supplier_name: matchedSupplier.legal_name || matchedSupplier.full_name,
              supplier_identification: matchedSupplier.identification_number
            }
          }
        );
        updated++;
        console.log(`✅ Contrato ${contract.contract_number} -> ${matchedSupplier.legal_name || matchedSupplier.full_name}`);
      } else {
        notFound++;
        console.log(`⚠️  Contrato ${contract.contract_number} - No se encontró tercero (company_name: "${contract.company_name || 'N/A'}")`);
      }
    }

    console.log('\n📊 RESUMEN DE MIGRACIÓN:');
    console.log(`   - Contratos actualizados: ${updated}`);
    console.log(`   - Contratos sin match: ${notFound}`);
    console.log(`   - Total procesados: ${contractsWithoutSupplier.length}`);

    await mongoose.disconnect();
    console.log('\n✅ Migración completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrateContractSuppliers();
