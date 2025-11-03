/**
 * Script para actualizar contratos existentes con información del tercero
 * Lee los archivos Word de los contratos y extrae la información para campos buscables
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');

// Conectar a MongoDB
mongoose.connect('mongodb://localhost:27017/legal-contracts', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Palabras clave para identificar terceros
const TERCERO_KEYWORDS = [
  'tercero', 'razon social', 'razon_social', 'nombre tercero', 'empresa tercero',
  'nombre empresa', 'compania', 'compañia', 'proveedor', 'cliente',
  'contratista', 'arrendatario', 'arrendador', 'parte contratante',
  'lucitania', 'sociedad', 's.a.', 's.a.s', 'ltda'
];

/**
 * Extrae texto plano de un archivo Word
 */
async function extractTextFromWord(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Archivo no encontrado: ${filePath}`);
      return '';
    }

    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } catch (error) {
    console.error(`❌ Error extrayendo texto de ${filePath}:`, error.message);
    return '';
  }
}

/**
 * Busca el nombre del tercero en el texto
 */
function findTerceroInText(text) {
  const lines = text.split('\n');
  let tercero = '';
  let bestMatch = '';
  let bestScore = 0;

  // Buscar línea por línea
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineLower = line.toLowerCase();

    // Buscar palabras clave
    for (const keyword of TERCERO_KEYWORDS) {
      if (lineLower.includes(keyword)) {
        // Extraer valor después de dos puntos o igual
        let value = line.split(/[:=]/)[1]?.trim();

        if (!value && i + 1 < lines.length) {
          // Si no hay valor en la misma línea, buscar en la siguiente
          value = lines[i + 1].trim();
        }

        if (value && value.length > 3 && value.length < 100) {
          // Limpiar valor
          value = value.replace(/[_\-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^[:\-=\s]+/, '')
            .trim();

          // Calcular score (palabras clave más específicas tienen mayor score)
          let score = 1;
          if (keyword.includes('razon') || keyword.includes('nombre')) score = 3;
          if (keyword === 'tercero') score = 2;

          if (score > bestScore && value.length > bestMatch.length) {
            bestMatch = value;
            bestScore = score;
          }
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Actualiza un contrato con información del tercero
 */
async function updateContract(contract) {
  try {
    console.log(`\n📄 Procesando contrato: ${contract.contract_number}`);

    if (!contract.file_path) {
      console.log('  ⚠️  No tiene archivo Word asociado');
      return false;
    }

    // Extraer texto del archivo Word
    const text = await extractTextFromWord(contract.file_path);

    if (!text || text.length < 100) {
      console.log('  ⚠️  No se pudo extraer texto o es muy corto');
      return false;
    }

    console.log(`  📝 Texto extraído: ${text.length} caracteres`);

    // Buscar tercero en el texto
    const tercero = findTerceroInText(text);

    if (!tercero) {
      console.log('  ⚠️  No se encontró información del tercero');
      // Aún así, guardar el texto completo en description para búsqueda
      contract.content = text.substring(0, 5000); // Primeros 5000 caracteres
      contract.description = text.substring(0, 1000); // Primeros 1000 caracteres
      await contract.save();
      console.log('  ✅ Actualizado con contenido para búsqueda general');
      return true;
    }

    console.log(`  ✅ Tercero encontrado: "${tercero}"`);

    // Actualizar campos
    contract.title = `Contrato con ${tercero}`;
    contract.company_name = tercero;
    contract.content = text.substring(0, 5000); // Primeros 5000 caracteres
    contract.description = `Tercero: ${tercero}`;

    await contract.save();

    console.log('  ✅ Contrato actualizado exitosamente');
    console.log(`     - Title: ${contract.title}`);
    console.log(`     - Company name: ${contract.company_name}`);

    return true;
  } catch (error) {
    console.error(`  ❌ Error actualizando contrato ${contract.contract_number}:`, error.message);
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 INICIANDO ACTUALIZACIÓN DE CONTRATOS EXISTENTES');
    console.log('================================================\n');

    // Obtener todos los contratos sin title o company_name
    const contracts = await Contract.find({
      $or: [
        { title: { $exists: false } },
        { title: '' },
        { company_name: { $exists: false } },
        { company_name: '' }
      ]
    });

    console.log(`📊 Contratos a actualizar: ${contracts.length}\n`);

    if (contracts.length === 0) {
      console.log('✅ No hay contratos para actualizar');
      process.exit(0);
    }

    let updated = 0;
    let failed = 0;

    for (const contract of contracts) {
      const success = await updateContract(contract);
      if (success) {
        updated++;
      } else {
        failed++;
      }
    }

    console.log('\n================================================');
    console.log('📊 RESUMEN:');
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ❌ Fallidos: ${failed}`);
    console.log(`   📊 Total: ${contracts.length}`);
    console.log('================================================\n');

    console.log('🎉 Proceso completado');

    // Cerrar conexión
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Ejecutar
main();
