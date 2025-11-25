/**
 * DB-Contracts-Optimizer — Query Benchmark Script
 *
 * Ejecuta benchmarks de las consultas más críticas y genera reporte CSV
 *
 * Uso:
 *   node benchmark.js --output=bench.csv
 *   node benchmark.js --iterations=100
 */

const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

// Modelos
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const VersionHistory = require('../models/VersionHistory');
const DocumentVersion = require('../models/DocumentVersion');
const Supplier = require('../models/Supplier');

// ===================================================================
// CONFIGURACIÓN
// ===================================================================

const ITERATIONS = parseInt(process.argv.find(arg => arg.startsWith('--iterations='))?.split('=')[1]) || 50;
const OUTPUT_FILE = process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'bench.csv';

// ===================================================================
// QUERIES A BENCHMARKAR
// ===================================================================

const benchmarkQueries = [
  {
    id: 'Q001',
    name: 'List Contracts by Company',
    description: 'Listar contratos filtrados por empresa y ordenados por fecha',
    category: 'Contracts',
    async execute(sampleData) {
      return await Contract.find({
        company: sampleData.companyId,
        status: 'active'
      })
        .populate('generated_by', 'name email')
        .populate('template', 'name category')
        .sort({ createdAt: -1 })
        .limit(20);
    }
  },

  {
    id: 'Q002',
    name: 'Get Contract by ID',
    description: 'Obtener contrato por ID con populates',
    category: 'Contracts',
    async execute(sampleData) {
      return await Contract.findById(sampleData.contractId)
        .populate('template', 'name category')
        .populate('generated_by', 'name');
    }
  },

  {
    id: 'Q003',
    name: 'List Active Templates by Company',
    description: 'Listar templates activas de una empresa',
    category: 'Templates',
    async execute(sampleData) {
      return await ContractTemplate.find({
        company: sampleData.companyId,
        active: true
      }).sort({ createdAt: -1 });
    }
  },

  {
    id: 'Q004',
    name: 'Get Template Version History',
    description: 'Obtener historial completo de versiones de template',
    category: 'Versions',
    async execute(sampleData) {
      return await VersionHistory.find({
        template: sampleData.templateId
      }).sort({ version: -1 });
    }
  },

  {
    id: 'Q005',
    name: 'Get Current Document Version',
    description: 'Obtener versión actual de un contrato',
    category: 'Versions',
    async execute(sampleData) {
      return await DocumentVersion.findOne({
        contract: sampleData.contractId,
        is_current: true
      });
    }
  },

  {
    id: 'Q006',
    name: 'List Document Version History',
    description: 'Obtener todas las versiones de un contrato',
    category: 'Versions',
    async execute(sampleData) {
      return await DocumentVersion.find({
        contract: sampleData.contractId
      }).sort({ version: -1 });
    }
  },

  {
    id: 'Q007',
    name: 'List Suppliers by Company',
    description: 'Listar proveedores activos de una empresa',
    category: 'Suppliers',
    async execute(sampleData) {
      return await Supplier.find({
        company: sampleData.companyId,
        active: true
      }).sort({ createdAt: -1 });
    }
  },

  {
    id: 'Q008',
    name: 'Search Supplier by ID Number',
    description: 'Buscar proveedor por número de identificación',
    category: 'Suppliers',
    async execute(sampleData) {
      return await Supplier.findOne({
        company: sampleData.companyId,
        identification_number: sampleData.supplierIdNumber
      });
    }
  },

  {
    id: 'Q009',
    name: 'Count Contracts by Status',
    description: 'Contar contratos agrupados por status',
    category: 'Aggregations',
    async execute(sampleData) {
      return await Contract.aggregate([
        { $match: { company: sampleData.companyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
    }
  },

  {
    id: 'Q010',
    name: 'Recent Contracts with Template',
    description: 'Obtener contratos recientes con lookup de template',
    category: 'Aggregations',
    async execute(sampleData) {
      return await Contract.aggregate([
        { $match: { company: sampleData.companyId } },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'contracttemplates',
            localField: 'template',
            foreignField: '_id',
            as: 'templateData'
          }
        }
      ]);
    }
  }
];

// ===================================================================
// FUNCIONES DE BENCHMARK
// ===================================================================

async function getSampleData() {
  const contract = await Contract.findOne().lean();
  const template = await ContractTemplate.findOne().lean();
  const supplier = await Supplier.findOne().lean();

  if (!contract || !template) {
    throw new Error('No hay datos suficientes para benchmarks. Crea al menos 1 contrato y 1 template.');
  }

  return {
    contractId: contract._id,
    companyId: contract.company || template.company,
    templateId: template._id,
    supplierIdNumber: supplier?.identification_number || '123456789'
  };
}

async function runBenchmark(query, sampleData) {
  const results = {
    id: query.id,
    name: query.name,
    category: query.category,
    iterations: ITERATIONS,
    latencies: [],
    errors: 0
  };

  console.log(`\n📊 Benchmarking: ${query.id} - ${query.name}`);
  console.log(`   Iteraciones: ${ITERATIONS}`);

  for (let i = 0; i < ITERATIONS; i++) {
    const start = Date.now();

    try {
      await query.execute(sampleData);
      const latency = Date.now() - start;
      results.latencies.push(latency);

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`   Progress: ${i + 1}/${ITERATIONS}\r`);
      }
    } catch (error) {
      results.errors++;
      console.error(`   ❌ Error en iteración ${i + 1}:`, error.message);
    }
  }

  // Calcular estadísticas
  results.latencies.sort((a, b) => a - b);
  results.min = results.latencies[0];
  results.max = results.latencies[results.latencies.length - 1];
  results.avg = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
  results.median = results.latencies[Math.floor(results.latencies.length / 2)];
  results.p95 = results.latencies[Math.floor(results.latencies.length * 0.95)];
  results.p99 = results.latencies[Math.floor(results.latencies.length * 0.99)];

  console.log(`   ✅ Completado - Avg: ${results.avg.toFixed(2)}ms, p95: ${results.p95}ms, p99: ${results.p99}ms`);

  return results;
}

async function generateCSV(allResults, outputFile) {
  const csvHeader = 'Query ID,Query Name,Category,Iterations,Min (ms),Max (ms),Avg (ms),Median (ms),p95 (ms),p99 (ms),Errors,Timestamp\n';

  const csvRows = allResults.map(r => {
    return [
      r.id,
      `"${r.name}"`,
      r.category,
      r.iterations,
      r.min.toFixed(2),
      r.max.toFixed(2),
      r.avg.toFixed(2),
      r.median.toFixed(2),
      r.p95.toFixed(2),
      r.p99.toFixed(2),
      r.errors,
      new Date().toISOString()
    ].join(',');
  }).join('\n');

  const csvContent = csvHeader + csvRows;
  fs.writeFileSync(outputFile, csvContent);

  console.log(`\n✅ Reporte CSV generado: ${outputFile}`);
}

function printSummary(allResults) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 RESUMEN DE BENCHMARKS');
  console.log(`${'='.repeat(80)}\n`);

  console.log('Query                                  Category      p95 (ms)  p99 (ms)  Errors');
  console.log('-'.repeat(80));

  allResults.forEach(r => {
    const queryName = r.name.padEnd(38);
    const category = r.category.padEnd(12);
    const p95 = r.p95.toFixed(0).padStart(8);
    const p99 = r.p99.toFixed(0).padStart(8);
    const errors = String(r.errors).padStart(6);

    console.log(`${queryName} ${category} ${p95} ${p99} ${errors}`);
  });

  console.log('-'.repeat(80));

  // Identificar queries más lentas
  const slowest = [...allResults].sort((a, b) => b.p95 - a.p95).slice(0, 3);
  console.log('\n⚠️  Top 3 Queries Más Lentas (p95):');
  slowest.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.id} - ${r.name}: ${r.p95.toFixed(0)}ms`);
  });

  // Alertas
  const criticalQueries = allResults.filter(r => r.p95 > 120);
  if (criticalQueries.length > 0) {
    console.log(`\n🔴 ALERTA: ${criticalQueries.length} queries exceden umbral de 120ms (p95)`);
    criticalQueries.forEach(r => {
      console.log(`   - ${r.id}: ${r.p95.toFixed(0)}ms`);
    });
  }

  const errorQueries = allResults.filter(r => r.errors > 0);
  if (errorQueries.length > 0) {
    console.log(`\n❌ ALERTA: ${errorQueries.length} queries con errores`);
    errorQueries.forEach(r => {
      console.log(`   - ${r.id}: ${r.errors} errores`);
    });
  }
}

// ===================================================================
// MAIN EXECUTION
// ===================================================================

async function main() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado');

    console.log(`\n🎯 Obteniendo datos de muestra...`);
    const sampleData = await getSampleData();
    console.log('✅ Datos obtenidos:', {
      contractId: sampleData.contractId.toString().substring(0, 8) + '...',
      companyId: sampleData.companyId.toString().substring(0, 8) + '...',
      templateId: sampleData.templateId.toString().substring(0, 8) + '...'
    });

    const allResults = [];

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 Iniciando Benchmarks (${ITERATIONS} iteraciones por query)`);
    console.log(`${'='.repeat(80)}`);

    for (const query of benchmarkQueries) {
      const result = await runBenchmark(query, sampleData);
      allResults.push(result);

      // Pausa breve para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    printSummary(allResults);
    await generateCSV(allResults, OUTPUT_FILE);

    console.log('\n✅ Benchmarks completados exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { benchmarkQueries, runBenchmark };
