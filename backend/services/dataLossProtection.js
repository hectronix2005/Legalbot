const mongoose = require('mongoose');
const { createFullBackup, restoreFromBackup, listBackups } = require('./robustBackup');

/**
 * Sistema avanzado de protección contra pérdida de datos
 *
 * Características:
 * - Detección de pérdida masiva de datos
 * - Alertas automáticas
 * - Restauración automática desde backup
 * - Monitoreo continuo
 */

// Umbral de pérdida para considerar una alerta (% de datos perdidos)
const LOSS_THRESHOLD_PERCENT = 20;

// Conteos mínimos esperados para cada colección
const MINIMUM_EXPECTED_COUNTS = {
  contracttemplates: 5,
  contracts: 10,
  companies: 2,
  users: 2,
  suppliers: 1,
  thirdpartytypeconfigs: 5,
  usercompanies: 2
};

// Almacenar último conteo conocido bueno
let lastKnownGoodCounts = {};
let monitoringInterval = null;

/**
 * Verifica si hay pérdida de datos significativa
 */
async function detectDataLoss() {
  try {
    const currentCounts = {};
    const alerts = [];
    let totalLoss = 0;
    let criticalLoss = false;

    // Obtener conteos actuales
    for (const [collectionName, minExpected] of Object.entries(MINIMUM_EXPECTED_COUNTS)) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();
        currentCounts[collectionName] = count;

        // Verificar contra mínimos esperados
        if (count < minExpected) {
          alerts.push({
            type: 'BELOW_MINIMUM',
            collection: collectionName,
            current: count,
            expected: minExpected,
            severity: 'HIGH'
          });
          criticalLoss = true;
        }

        // Verificar contra último conteo conocido
        if (lastKnownGoodCounts[collectionName]) {
          const previous = lastKnownGoodCounts[collectionName];
          const lossPercent = ((previous - count) / previous) * 100;

          if (lossPercent > LOSS_THRESHOLD_PERCENT) {
            alerts.push({
              type: 'SIGNIFICANT_LOSS',
              collection: collectionName,
              current: count,
              previous: previous,
              lossPercent: lossPercent.toFixed(2),
              severity: lossPercent > 50 ? 'CRITICAL' : 'HIGH'
            });
            totalLoss += lossPercent;
            if (lossPercent > 50) criticalLoss = true;
          }
        }
      } catch (error) {
        alerts.push({
          type: 'ERROR',
          collection: collectionName,
          error: error.message,
          severity: 'CRITICAL'
        });
        criticalLoss = true;
      }
    }

    return {
      hasLoss: alerts.length > 0,
      criticalLoss,
      currentCounts,
      alerts,
      totalLoss: totalLoss.toFixed(2),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error detectando pérdida de datos:', error);
    return {
      hasLoss: true,
      criticalLoss: true,
      error: error.message
    };
  }
}

/**
 * Actualiza los conteos conocidos buenos
 */
async function updateKnownGoodCounts() {
  try {
    for (const collectionName of Object.keys(MINIMUM_EXPECTED_COUNTS)) {
      const collection = mongoose.connection.db.collection(collectionName);
      const count = await collection.countDocuments();

      // Solo actualizar si el conteo es mayor que el mínimo esperado
      if (count >= MINIMUM_EXPECTED_COUNTS[collectionName]) {
        lastKnownGoodCounts[collectionName] = count;
      }
    }
    return lastKnownGoodCounts;
  } catch (error) {
    console.error('Error actualizando conteos conocidos:', error);
    return lastKnownGoodCounts;
  }
}

/**
 * Restaura automáticamente desde el backup más reciente
 */
async function autoRestore() {
  try {
    console.log('\n🚨 INICIANDO RESTAURACIÓN AUTOMÁTICA...\n');

    const backups = await listBackups();

    if (backups.length === 0) {
      console.error('❌ No hay backups disponibles para restaurar');
      return { success: false, error: 'No backups available' };
    }

    // Encontrar el backup más reciente que tenga datos válidos
    const validBackup = backups.find(b => {
      if (b.error) return false;

      // Verificar que el backup tenga datos suficientes
      const stats = b.stats || {};
      return (stats.contracttemplates || 0) >= MINIMUM_EXPECTED_COUNTS.contracttemplates &&
             (stats.contracts || 0) >= MINIMUM_EXPECTED_COUNTS.contracts &&
             (stats.companies || 0) >= MINIMUM_EXPECTED_COUNTS.companies &&
             (stats.users || 0) >= MINIMUM_EXPECTED_COUNTS.users;
    });

    if (!validBackup) {
      console.error('❌ No se encontró un backup válido para restaurar');
      return { success: false, error: 'No valid backup found' };
    }

    console.log(`📦 Restaurando desde: ${validBackup.filename}`);
    console.log(`📅 Fecha del backup: ${validBackup.timestamp}`);
    console.log(`📊 Datos en el backup:`, validBackup.stats);

    const result = await restoreFromBackup(validBackup.filename);

    if (result.success) {
      console.log('\n✅ RESTAURACIÓN COMPLETADA EXITOSAMENTE');
      console.log('📊 Datos restaurados:', result.results);

      // Actualizar conteos conocidos
      await updateKnownGoodCounts();

      return { success: true, backup: validBackup, results: result.results };
    } else {
      console.error('❌ Error en la restauración');
      return { success: false, error: 'Restore failed' };
    }
  } catch (error) {
    console.error('❌ Error en auto-restauración:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Función de monitoreo continuo
 */
async function monitorDataHealth() {
  try {
    const lossDetection = await detectDataLoss();

    if (lossDetection.hasLoss) {
      console.log('\n⚠️  ALERTA: POSIBLE PÉRDIDA DE DATOS DETECTADA\n');
      console.log('📊 Alertas:', JSON.stringify(lossDetection.alerts, null, 2));

      if (lossDetection.criticalLoss) {
        console.log('\n🚨 PÉRDIDA CRÍTICA DETECTADA - REQUIERE INTERVENCIÓN INMEDIATA');
        console.log('💡 Considere ejecutar restauración automática');

        // Crear backup de emergencia del estado actual
        await createFullBackup('EMERGENCY');
      }
    }

    // Actualizar conteos conocidos si todo está bien
    if (!lossDetection.hasLoss) {
      await updateKnownGoodCounts();
    }
  } catch (error) {
    console.error('Error en monitoreo:', error);
  }
}

/**
 * Inicia el monitoreo continuo
 */
function startMonitoring(intervalMinutes = 15) {
  if (monitoringInterval) {
    console.log('⚠️  Monitoreo ya está activo');
    return;
  }

  console.log(`🔍 Iniciando monitoreo de datos cada ${intervalMinutes} minutos...`);

  // Ejecutar una vez al inicio
  updateKnownGoodCounts();

  // Programar ejecución periódica
  monitoringInterval = setInterval(monitorDataHealth, intervalMinutes * 60 * 1000);

  console.log('✅ Monitoreo de protección de datos iniciado');
}

/**
 * Detiene el monitoreo
 */
function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Monitoreo de protección de datos detenido');
  }
}

/**
 * Realiza una verificación completa del sistema
 */
async function fullSystemCheck() {
  console.log('\n🔍 VERIFICACIÓN COMPLETA DEL SISTEMA\n');

  // 1. Detectar pérdida de datos
  const lossDetection = await detectDataLoss();
  console.log('📊 Detección de pérdida:', lossDetection.hasLoss ? '⚠️  DETECTADA' : '✅ OK');

  if (lossDetection.alerts && lossDetection.alerts.length > 0) {
    console.log('\n⚠️  Alertas encontradas:');
    lossDetection.alerts.forEach(alert => {
      console.log(`   - [${alert.severity}] ${alert.collection}: ${alert.type}`);
    });
  }

  // 2. Verificar backups disponibles
  const backups = await listBackups();
  console.log(`\n📦 Backups disponibles: ${backups.length}`);
  if (backups.length > 0) {
    const latestBackup = backups[0];
    console.log(`   Más reciente: ${latestBackup.filename}`);
    console.log(`   Fecha: ${latestBackup.timestamp || latestBackup.created}`);
  }

  // 3. Estado de MongoDB
  const mongoState = mongoose.connection.readyState;
  const mongoStateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  console.log(`\n💾 MongoDB: ${mongoStateNames[mongoState] || 'unknown'}`);

  // 4. Conteos actuales vs conocidos
  console.log('\n📊 Comparación de datos:');
  for (const [collection, count] of Object.entries(lossDetection.currentCounts || {})) {
    const known = lastKnownGoodCounts[collection] || 'N/A';
    const min = MINIMUM_EXPECTED_COUNTS[collection] || 0;
    const status = count >= min ? '✅' : '❌';
    console.log(`   ${status} ${collection}: ${count} (último conocido: ${known}, mínimo: ${min})`);
  }

  return {
    lossDetection,
    backupsCount: backups.length,
    mongoConnected: mongoState === 1,
    currentCounts: lossDetection.currentCounts,
    knownGoodCounts: lastKnownGoodCounts
  };
}

module.exports = {
  detectDataLoss,
  updateKnownGoodCounts,
  autoRestore,
  startMonitoring,
  stopMonitoring,
  fullSystemCheck,
  MINIMUM_EXPECTED_COUNTS,
  lastKnownGoodCounts
};
