/**
 * Script de migración para actualizar nombres de campos de terceros
 * Este script mapea los nombres antiguos de campos a los nuevos nombres normalizados
 *
 * USO:
 * node migrations/migrate-supplier-field-names.js [--dry-run] [--type=proveedor]
 *
 * Opciones:
 * --dry-run: Muestra qué cambios se harían sin aplicarlos
 * --type=TIPO: Solo migrar terceros de un tipo específico (proveedor, cliente, etc.)
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Mapeo de nombres antiguos a nombres nuevos
const FIELD_MAPPINGS = {
  // Nombres/Razón Social
  'Nombre / Razón Social': 'razon_social',
  'Razón Social': 'razon_social',
  'Nombre': 'nombre_completo',
  'Nombre Completo': 'nombre_completo',

  // Representante Legal
  'Representante Legal': 'representante_legal',
  'Nombre Representante Legal': 'representante_legal',
  'Nombre Reprentante Legal': 'representante_legal', // Typo común

  // Identificación
  'Tipo de Identificación': 'tipo_identificacion',
  'Tipo ID': 'tipo_identificacion',
  'Número de Identificación': 'numero_identificacion',
  'NIT': 'numero_identificacion',
  'Cédula': 'numero_identificacion',

  // Representante Legal ID
  'Tipo ID Representante': 'tipo_id_representante',
  'Número ID Representante': 'numero_id_representante',
  'Cédula Representante': 'numero_id_representante',

  // Contacto
  'Email': 'email',
  'Correo': 'email',
  'Teléfono': 'telefono',
  'Celular': 'telefono',

  // Dirección
  'Dirección': 'direccion',
  'Ciudad': 'ciudad',
  'País': 'pais',

  // Específicos de Propiedad Horizontal
  'Nombre de la Propiedad Horizontal': 'razon_social',
  'NOMBRE DE LA PROPIEDAD HORIZONTAL': 'razon_social',
  'Nombre del Licenciatario': 'licenciatario',
  'NOMBRE DEL LICENCIATARIO': 'licenciatario',
  'Licenciatario': 'licenciatario',

  // Razón Social Corta
  'Razón Social Corta': 'razon_social_corta',
  'Nombre Corto': 'razon_social_corta',

  // Bancarios
  'Banco': 'banco',
  'Cuenta Bancaria': 'cuenta_bancaria',
  'Tipo de Cuenta': 'tipo_cuenta',

  // Laborales
  'Cargo': 'cargo',
  'Salario': 'salario',
  'EPS': 'eps',
  'AFP': 'afp',
  'ARL': 'arl',

  // Otros
  'Descripción': 'descripcion',
  'Observaciones': 'observaciones'
};

/**
 * Normaliza un nombre de campo para comparación
 */
function normalizeForComparison(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .toLowerCase()
    .trim();
}

/**
 * Encuentra el nombre nuevo para un campo antiguo
 */
function findNewFieldName(oldName) {
  // Buscar coincidencia exacta (case insensitive)
  for (const [oldKey, newKey] of Object.entries(FIELD_MAPPINGS)) {
    if (normalizeForComparison(oldKey) === normalizeForComparison(oldName)) {
      return newKey;
    }
  }

  // Si no hay coincidencia, convertir a snake_case
  return oldName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\/\-]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Migra los campos de un tercero
 */
function migrateSupplierFields(supplier) {
  const changes = [];
  const newCustomFields = {};

  if (supplier.custom_fields) {
    for (const [oldKey, value] of Object.entries(supplier.custom_fields)) {
      const newKey = findNewFieldName(oldKey);

      if (oldKey !== newKey) {
        changes.push({
          field: oldKey,
          oldName: oldKey,
          newName: newKey,
          value: value
        });
      }

      newCustomFields[newKey] = value;
    }
  }

  return {
    changes,
    newCustomFields
  };
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const typeFilter = args.find(arg => arg.startsWith('--type='))?.split('=')[1];

  console.log('🔄 INICIANDO MIGRACIÓN DE NOMBRES DE CAMPOS');
  console.log('============================================');
  console.log(`Modo: ${isDryRun ? '🔍 DRY RUN (solo lectura)' : '✍️  ESCRITURA'}`);
  if (typeFilter) {
    console.log(`Filtro de tipo: ${typeFilter}`);
  }
  console.log('');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-contracts');
    console.log('✅ Conectado a MongoDB\n');

    const Supplier = require('../models/Supplier');

    // Construir query
    const query = {};
    if (typeFilter) {
      query.supplier_type = typeFilter;
    }

    const suppliers = await Supplier.find(query);
    console.log(`📊 Encontrados ${suppliers.length} terceros para revisar\n`);

    let totalChanges = 0;
    let suppliersAffected = 0;

    for (const supplier of suppliers) {
      const { changes, newCustomFields } = migrateSupplierFields(supplier);

      if (changes.length > 0) {
        suppliersAffected++;
        totalChanges += changes.length;

        console.log(`\n📝 Tercero: ${supplier.legal_name || supplier.full_name || 'Sin nombre'}`);
        console.log(`   ID: ${supplier._id}`);
        console.log(`   Tipo: ${supplier.supplier_type}`);
        console.log(`   Cambios a realizar:`);

        changes.forEach(change => {
          console.log(`   - "${change.oldName}" → "${change.newName}"`);
          console.log(`     Valor: ${JSON.stringify(change.value)}`);
        });

        if (!isDryRun) {
          supplier.custom_fields = newCustomFields;
          await supplier.save();
          console.log(`   ✅ Guardado`);
        } else {
          console.log(`   ⏭️  No guardado (dry run)`);
        }
      }
    }

    console.log('\n');
    console.log('============================================');
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('============================================');
    console.log(`Total terceros revisados: ${suppliers.length}`);
    console.log(`Terceros afectados: ${suppliersAffected}`);
    console.log(`Total de campos migrados: ${totalChanges}`);

    if (isDryRun) {
      console.log('\n⚠️  MODO DRY RUN - No se realizaron cambios');
      console.log('   Para aplicar los cambios, ejecuta sin --dry-run');
    } else {
      console.log('\n✅ Migración completada exitosamente');
    }

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Ejecutar migración
runMigration();
