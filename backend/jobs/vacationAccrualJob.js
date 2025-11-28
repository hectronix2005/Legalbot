/**
 * Job de Causación Automática de Vacaciones
 *
 * Ejecuta la causación diaria de días de vacaciones para todos los empleados
 * con balance activo en el sistema.
 *
 * Frecuencia recomendada: Diario a las 00:01 (inicio de cada día)
 *
 * @module vacationAccrualJob
 */

const cron = require('node-cron');
const VacationBalance = require('../models/VacationBalance');
const VacationAuditLog = require('../models/VacationAuditLog');
const Company = require('../models/Company');
const { calculateAccruedVacationDays } = require('../services/vacationAccrualService');

let scheduledTask = null;

/**
 * Ejecuta la causación diaria para una compañía específica
 * @param {String} companyId - ID de la compañía
 * @returns {Object} Resultado de la causación
 */
async function runCompanyAccrual(companyId) {
  const results = {
    companyId,
    timestamp: new Date(),
    processed: 0,
    updated: 0,
    errors: 0,
    details: []
  };

  try {
    const balances = await VacationBalance.find({ companyId });
    results.processed = balances.length;

    for (const balance of balances) {
      try {
        // Calcular días acumulados actualizados
        const accrual = calculateAccruedVacationDays(balance.hireDate, new Date());

        if (accrual.error) {
          results.errors++;
          results.details.push({
            employeeId: balance.employeeId,
            error: accrual.error
          });
          continue;
        }

        const previousAccrued = balance.accruedDays;
        const newAccrued = accrual.accruedDays;
        const dailyIncrease = newAccrued - previousAccrued;

        // Solo actualizar si hay incremento
        if (dailyIncrease > 0.0001) { // Tolerancia para evitar actualizaciones innecesarias
          balance.accruedDays = newAccrued;
          balance.lastAccrualDate = new Date();
          await balance.save();

          // Registrar en auditoría
          await VacationAuditLog.createLog({
            employeeId: balance.employeeId,
            action: 'accrue',
            performedBy: balance.employeeId, // Sistema
            quantity: dailyIncrease,
            description: 'Causación diaria automática',
            previousState: { accruedDays: previousAccrued },
            newState: { accruedDays: newAccrued },
            metadata: {
              yearsOfService: accrual.yearsOfService,
              daysWorked: accrual.daysWorked,
              jobType: 'DAILY_ACCRUAL'
            },
            companyId
          });

          results.updated++;
          results.details.push({
            employeeId: balance.employeeId,
            previousAccrued: parseFloat(previousAccrued.toFixed(4)),
            newAccrued: parseFloat(newAccrued.toFixed(4)),
            increase: parseFloat(dailyIncrease.toFixed(4))
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          employeeId: balance.employeeId,
          error: error.message
        });
        console.error(`[ACCRUAL] Error procesando empleado ${balance.employeeId}:`, error.message);
      }
    }

    return results;

  } catch (error) {
    results.errors++;
    results.details.push({ error: error.message });
    throw error;
  }
}

/**
 * Ejecuta la causación diaria para todas las compañías activas
 * @returns {Object} Resultado consolidado
 */
async function runDailyAccrual() {
  console.log('[ACCRUAL] Iniciando causación diaria de vacaciones...');
  const startTime = Date.now();

  const consolidatedResults = {
    timestamp: new Date(),
    totalCompanies: 0,
    successfulCompanies: 0,
    failedCompanies: 0,
    totalEmployeesProcessed: 0,
    totalEmployeesUpdated: 0,
    totalErrors: 0,
    executionTimeMs: 0,
    companyResults: []
  };

  try {
    // Obtener todas las compañías activas
    const companies = await Company.find({ isActive: { $ne: false } });
    consolidatedResults.totalCompanies = companies.length;

    console.log(`[ACCRUAL] Procesando ${companies.length} compañía(s)...`);

    for (const company of companies) {
      try {
        const companyResult = await runCompanyAccrual(company._id);

        consolidatedResults.successfulCompanies++;
        consolidatedResults.totalEmployeesProcessed += companyResult.processed;
        consolidatedResults.totalEmployeesUpdated += companyResult.updated;
        consolidatedResults.totalErrors += companyResult.errors;

        consolidatedResults.companyResults.push({
          companyId: company._id,
          companyName: company.name,
          processed: companyResult.processed,
          updated: companyResult.updated,
          errors: companyResult.errors
        });

        console.log(`[ACCRUAL] Compañía ${company.name || company._id}: ${companyResult.updated}/${companyResult.processed} actualizados`);

      } catch (error) {
        consolidatedResults.failedCompanies++;
        consolidatedResults.companyResults.push({
          companyId: company._id,
          companyName: company.name,
          error: error.message
        });
        console.error(`[ACCRUAL] Error en compañía ${company._id}:`, error.message);
      }
    }

    consolidatedResults.executionTimeMs = Date.now() - startTime;

    console.log('[ACCRUAL] Causación diaria completada:', {
      companies: `${consolidatedResults.successfulCompanies}/${consolidatedResults.totalCompanies}`,
      employees: `${consolidatedResults.totalEmployeesUpdated}/${consolidatedResults.totalEmployeesProcessed}`,
      errors: consolidatedResults.totalErrors,
      timeMs: consolidatedResults.executionTimeMs
    });

    return consolidatedResults;

  } catch (error) {
    console.error('[ACCRUAL] Error crítico en causación diaria:', error.message);
    consolidatedResults.executionTimeMs = Date.now() - startTime;
    throw error;
  }
}

/**
 * Inicializa el job de causación diaria
 * Ejecuta a las 00:01 todos los días (inicio del día)
 */
function initDailyAccrualJob() {
  // Ejecutar a las 00:01 todos los días
  scheduledTask = cron.schedule('1 0 * * *', async () => {
    console.log('[CRON] Ejecutando job de causación diaria...');

    try {
      await runDailyAccrual();
    } catch (error) {
      console.error('[CRON] Error en job de causación diaria:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "America/Bogota"
  });

  console.log('[CRON] Job de causación diaria iniciado (00:01 diario, TZ: America/Bogota)');
  return scheduledTask;
}

/**
 * Detiene el job de causación
 */
function stopAccrualJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    console.log('[CRON] Job de causación diaria detenido');
  }
}

/**
 * Ejecuta la causación manualmente (para testing o corrección)
 * @param {String} companyId - Opcional, ID de compañía específica
 */
async function runManualAccrual(companyId = null) {
  console.log('[MANUAL] Ejecutando causación manual...');

  if (companyId) {
    return await runCompanyAccrual(companyId);
  } else {
    return await runDailyAccrual();
  }
}

module.exports = {
  initDailyAccrualJob,
  stopAccrualJob,
  runManualAccrual,
  runDailyAccrual,
  runCompanyAccrual
};
