const cron = require('node-cron');
const vacationAuditService = require('../services/vacationAuditService');

/**
 * Job de auditoría automática del módulo de vacaciones
 *
 * Horarios configurables:
 * - Diario: '0 2 * * *' (2 AM todos los días)
 * - Semanal: '0 2 * * 0' (2 AM todos los domingos)
 * - Mensual: '0 2 1 * *' (2 AM el día 1 de cada mes)
 */

let scheduledTask = null;

/**
 * Inicializar job de auditoría diaria
 */
function initDailyAudit() {
  // Ejecutar auditoría diaria a las 2 AM
  scheduledTask = cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Ejecutando auditoría diaria de vacaciones...');

    try {
      const results = await vacationAuditService.scheduledAudit();

      console.log('[CRON] Auditoría diaria completada:', {
        timestamp: new Date().toISOString(),
        results
      });

    } catch (error) {
      console.error('[CRON] Error en auditoría diaria:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "America/Bogota" // Ajustar según zona horaria del proyecto
  });

  console.log('[CRON] Job de auditoría diaria iniciado (2 AM diario)');
  return scheduledTask;
}

/**
 * Inicializar job de auditoría semanal
 */
function initWeeklyAudit() {
  // Ejecutar auditoría semanal los domingos a las 3 AM
  scheduledTask = cron.schedule('0 3 * * 0', async () => {
    console.log('[CRON] Ejecutando auditoría semanal de vacaciones...');

    try {
      const results = await vacationAuditService.scheduledAudit();

      console.log('[CRON] Auditoría semanal completada:', {
        timestamp: new Date().toISOString(),
        results
      });

    } catch (error) {
      console.error('[CRON] Error en auditoría semanal:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "America/Bogota"
  });

  console.log('[CRON] Job de auditoría semanal iniciado (3 AM domingos)');
  return scheduledTask;
}

/**
 * Detener job programado
 */
function stopAuditJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    console.log('[CRON] Job de auditoría detenido');
  }
}

/**
 * Ejecutar auditoría manualmente (para testing o ejecución inmediata)
 */
async function runManualAudit() {
  console.log('[MANUAL] Ejecutando auditoría manual de vacaciones...');

  try {
    const results = await vacationAuditService.scheduledAudit();

    console.log('[MANUAL] Auditoría manual completada:', {
      timestamp: new Date().toISOString(),
      results
    });

    return results;

  } catch (error) {
    console.error('[MANUAL] Error en auditoría manual:', error.message);
    throw error;
  }
}

module.exports = {
  initDailyAudit,
  initWeeklyAudit,
  stopAuditJob,
  runManualAudit
};
