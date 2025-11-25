const VacationBalance = require('../models/VacationBalance');
const VacationRequest = require('../models/VacationRequest');
const VacationAuditLog = require('../models/VacationAuditLog');
const AuditReport = require('../models/AuditReport');
const Company = require('../models/Company');

class VacationAuditService {
  /**
   * Ejecuta auditoría completa cruzando datos
   * @param {String} companyId - ID de la compañía
   * @returns {Object} Reporte de auditoría con hallazgos
   */
  async runFullAudit(companyId) {
    const startTime = Date.now();

    const findings = {
      timestamp: new Date(),
      companyId,
      checks: [],
      errors: [],
      warnings: [],
      summary: {
        totalChecks: 0,
        totalErrors: 0,
        totalWarnings: 0,
        criticalErrors: 0,
        highErrors: 0,
        employeesAudited: 0,
        requestsAudited: 0,
        executionTimeMs: 0
      }
    };

    try {
      // 1. Validar integridad: accrued >= enjoyed + approvedPending
      findings.checks.push('balance_integrity');
      await this.validateBalanceIntegrity(companyId, findings);

      // 2. Detectar saldos negativos (error de datos)
      findings.checks.push('negative_balances');
      await this.detectNegativeBalances(companyId, findings);

      // 3. Validar state machine: requests en estados válidos
      findings.checks.push('request_states');
      await this.validateRequestStates(companyId, findings);

      // 4. Verificar consistencia: approvedPendingDays = sum(approved requests)
      findings.checks.push('approved_pending_consistency');
      await this.validateApprovedPending(companyId, findings);

      // 5. Detectar solicitudes disfrutadas sin descuento de saldo
      findings.checks.push('unaccounted_enjoyments');
      await this.detectUnaccountedEnjoyments(companyId, findings);

      // 6. Validar logs de auditoría sin PII
      findings.checks.push('audit_logs_privacy');
      await this.validateAuditLogsPrivacy(findings);

      // 7. Verificar causación diaria actualizada
      findings.checks.push('accrual_up_to_date');
      await this.validateAccrualUpToDate(companyId, findings);

      // Calcular métricas finales
      findings.summary.totalChecks = findings.checks.length;
      findings.summary.totalErrors = findings.errors.length;
      findings.summary.totalWarnings = findings.warnings.length;
      findings.summary.criticalErrors = findings.errors.filter(e => e.severity === 'CRITICAL').length;
      findings.summary.highErrors = findings.errors.filter(e => e.severity === 'HIGH').length;

      // Contar empleados y solicitudes auditadas
      const balances = await VacationBalance.find({ companyId });
      const requests = await VacationRequest.find({ companyId });
      findings.summary.employeesAudited = balances.length;
      findings.summary.requestsAudited = requests.length;

      findings.summary.executionTimeMs = Date.now() - startTime;

    } catch (error) {
      findings.errors.push({
        type: 'AUDIT_EXECUTION_ERROR',
        message: `Error durante ejecución de auditoría: ${error.message}`,
        severity: 'CRITICAL'
      });
    }

    return findings;
  }

  async validateBalanceIntegrity(companyId, findings) {
    try {
      const balances = await VacationBalance.find({ companyId });

      for (const balance of balances) {
        // Formula: availableDays = accruedDays - enjoyedDays - approvedPendingDays
        const expected = balance.accruedDays - balance.enjoyedDays - balance.approvedPendingDays;
        const actual = balance.availableDays;

        // Tolerancia de 0.01 días por redondeo
        if (Math.abs(expected - actual) > 0.01) {
          findings.errors.push({
            type: 'BALANCE_INTEGRITY',
            employeeId: balance.employeeId,
            message: `Saldo inconsistente para empleado ${balance.employeeId}: expected ${expected.toFixed(2)}, actual ${actual.toFixed(2)}`,
            severity: 'HIGH',
            expected: parseFloat(expected.toFixed(2)),
            actual: parseFloat(actual.toFixed(2))
          });
        }
      }
    } catch (error) {
      findings.errors.push({
        type: 'BALANCE_INTEGRITY_CHECK_ERROR',
        message: `Error validando integridad de saldos: ${error.message}`,
        severity: 'CRITICAL'
      });
    }
  }

  async detectNegativeBalances(companyId, findings) {
    try {
      const negatives = await VacationBalance.find({
        companyId,
        $or: [
          { availableDays: { $lt: 0 } },
          { accruedDays: { $lt: 0 } },
          { enjoyedDays: { $lt: 0 } },
          { approvedPendingDays: { $lt: 0 } }
        ]
      });

      if (negatives.length > 0) {
        findings.errors.push({
          type: 'NEGATIVE_BALANCE',
          count: negatives.length,
          employees: negatives.map(b => b.employeeId),
          message: `${negatives.length} empleado(s) con saldos negativos detectados (datos corruptos)`,
          severity: 'CRITICAL'
        });

        // Agregar detalle por cada empleado afectado
        negatives.forEach(balance => {
          const negativeFields = [];
          if (balance.availableDays < 0) negativeFields.push(`available: ${balance.availableDays}`);
          if (balance.accruedDays < 0) negativeFields.push(`accrued: ${balance.accruedDays}`);
          if (balance.enjoyedDays < 0) negativeFields.push(`enjoyed: ${balance.enjoyedDays}`);
          if (balance.approvedPendingDays < 0) negativeFields.push(`approvedPending: ${balance.approvedPendingDays}`);

          findings.warnings.push({
            type: 'NEGATIVE_BALANCE_DETAIL',
            employeeId: balance.employeeId,
            message: `Campos negativos: ${negativeFields.join(', ')}`,
            severity: 'HIGH'
          });
        });
      }
    } catch (error) {
      findings.errors.push({
        type: 'NEGATIVE_BALANCE_CHECK_ERROR',
        message: `Error detectando saldos negativos: ${error.message}`,
        severity: 'CRITICAL'
      });
    }
  }

  async validateRequestStates(companyId, findings) {
    try {
      const validStates = ['requested', 'approved', 'scheduled', 'enjoyed', 'rejected', 'cancelled'];
      const invalidRequests = await VacationRequest.find({
        companyId,
        status: { $nin: validStates }
      });

      if (invalidRequests.length > 0) {
        findings.errors.push({
          type: 'INVALID_STATE',
          count: invalidRequests.length,
          message: `${invalidRequests.length} solicitud(es) con estados inválidos encontradas`,
          severity: 'HIGH'
        });

        // Detallar cada solicitud con estado inválido
        invalidRequests.forEach(req => {
          findings.warnings.push({
            type: 'INVALID_STATE_DETAIL',
            requestId: req._id,
            employeeId: req.employeeId,
            message: `Solicitud ${req._id} tiene estado inválido: "${req.status}"`,
            severity: 'MEDIUM'
          });
        });
      }
    } catch (error) {
      findings.errors.push({
        type: 'REQUEST_STATE_CHECK_ERROR',
        message: `Error validando estados de solicitudes: ${error.message}`,
        severity: 'CRITICAL'
      });
    }
  }

  async validateApprovedPending(companyId, findings) {
    try {
      const balances = await VacationBalance.find({ companyId });

      for (const balance of balances) {
        const approvedRequests = await VacationRequest.find({
          employeeId: balance.employeeId,
          companyId,
          status: { $in: ['approved', 'scheduled'] }
        });

        const sumApproved = approvedRequests.reduce((sum, req) => sum + (req.requestedDays || 0), 0);

        // Tolerancia de 0.01 días por redondeo
        if (Math.abs(sumApproved - balance.approvedPendingDays) > 0.01) {
          findings.warnings.push({
            type: 'APPROVED_PENDING_MISMATCH',
            employeeId: balance.employeeId,
            expected: parseFloat(sumApproved.toFixed(2)),
            actual: parseFloat(balance.approvedPendingDays.toFixed(2)),
            message: `Inconsistencia en días aprobados pendientes: esperado ${sumApproved.toFixed(2)}, actual ${balance.approvedPendingDays.toFixed(2)}`,
            severity: 'MEDIUM'
          });
        }
      }
    } catch (error) {
      findings.errors.push({
        type: 'APPROVED_PENDING_CHECK_ERROR',
        message: `Error validando días aprobados pendientes: ${error.message}`,
        severity: 'CRITICAL'
      });
    }
  }

  async detectUnaccountedEnjoyments(companyId, findings) {
    try {
      const enjoyedRequests = await VacationRequest.find({
        companyId,
        status: 'enjoyed',
        enjoyedDate: { $ne: null }
      });

      // Verificar que cada solicitud disfrutada tiene descuento correspondiente
      // (comparar con logs de auditoría)
      for (const request of enjoyedRequests) {
        const log = await VacationAuditLog.findOne({
          requestId: request._id,
          action: 'enjoy'
        });

        if (!log) {
          findings.warnings.push({
            type: 'MISSING_ENJOYMENT_LOG',
            requestId: request._id,
            employeeId: request.employeeId,
            message: `Solicitud ${request._id} disfrutada sin log de auditoría correspondiente`,
            severity: 'MEDIUM'
          });
        }
      }

      if (findings.warnings.filter(w => w.type === 'MISSING_ENJOYMENT_LOG').length > 0) {
        const count = findings.warnings.filter(w => w.type === 'MISSING_ENJOYMENT_LOG').length;
        findings.warnings.push({
          type: 'MISSING_ENJOYMENT_LOG_SUMMARY',
          count,
          message: `${count} solicitud(es) disfrutadas sin log de auditoría`,
          severity: 'LOW'
        });
      }
    } catch (error) {
      findings.errors.push({
        type: 'UNACCOUNTED_ENJOYMENT_CHECK_ERROR',
        message: `Error detectando disfrutes sin contabilizar: ${error.message}`,
        severity: 'CRITICAL'
      });
    }
  }

  async validateAuditLogsPrivacy(findings) {
    try {
      // Verificar que logs NO contienen PII (información personal identificable)
      const logsWithPII = await VacationAuditLog.find({
        $or: [
          { 'previousState.name': { $exists: true } },
          { 'newState.name': { $exists: true } },
          { 'previousState.email': { $exists: true } },
          { 'newState.email': { $exists: true } },
          { 'previousState.firstName': { $exists: true } },
          { 'newState.firstName': { $exists: true } },
          { 'previousState.lastName': { $exists: true } },
          { 'newState.lastName': { $exists: true } }
        ]
      });

      if (logsWithPII.length > 0) {
        findings.errors.push({
          type: 'PII_IN_LOGS',
          count: logsWithPII.length,
          message: `${logsWithPII.length} log(s) de auditoría contienen datos personales (PII) - VIOLACIÓN DE PRIVACIDAD`,
          severity: 'CRITICAL'
        });

        // Agregar detalles de los primeros 5 logs con PII
        logsWithPII.slice(0, 5).forEach(log => {
          findings.warnings.push({
            type: 'PII_IN_LOGS_DETAIL',
            message: `Log ${log._id} contiene PII en campos de estado`,
            severity: 'HIGH'
          });
        });
      }
    } catch (error) {
      findings.errors.push({
        type: 'AUDIT_LOGS_PRIVACY_CHECK_ERROR',
        message: `Error validando privacidad de logs: ${error.message}`,
        severity: 'CRITICAL'
      });
    }
  }

  async validateAccrualUpToDate(companyId, findings) {
    try {
      const balances = await VacationBalance.find({ companyId });
      const today = new Date();
      const outdatedThreshold = 2; // días

      const outdated = balances.filter(b => {
        if (!b.lastAccrualDate) return true; // Sin fecha de causación
        const daysSinceAccrual = (today - new Date(b.lastAccrualDate)) / (1000 * 60 * 60 * 24);
        return daysSinceAccrual > outdatedThreshold;
      });

      if (outdated.length > 0) {
        findings.warnings.push({
          type: 'OUTDATED_ACCRUAL',
          count: outdated.length,
          employees: outdated.map(b => b.employeeId),
          message: `${outdated.length} empleado(s) sin causación actualizada en ${outdatedThreshold}+ días`,
          severity: 'LOW'
        });

        // Identificar casos más severos (más de 7 días sin causación)
        const severelOutdated = outdated.filter(b => {
          if (!b.lastAccrualDate) return true;
          const daysSinceAccrual = (today - new Date(b.lastAccrualDate)) / (1000 * 60 * 60 * 24);
          return daysSinceAccrual > 7;
        });

        if (severelOutdated.length > 0) {
          findings.warnings.push({
            type: 'SEVERELY_OUTDATED_ACCRUAL',
            count: severelOutdated.length,
            employees: severelOutdated.map(b => b.employeeId),
            message: `${severelOutdated.length} empleado(s) sin causación actualizada en 7+ días`,
            severity: 'MEDIUM'
          });
        }
      }
    } catch (error) {
      findings.errors.push({
        type: 'ACCRUAL_UP_TO_DATE_CHECK_ERROR',
        message: `Error validando causación actualizada: ${error.message}`,
        severity: 'CRITICAL'
      });
    }
  }

  /**
   * Job automático de auditoría (ejecutar diario/semanal)
   */
  async scheduledAudit() {
    console.log('[AUDIT] Iniciando auditoría programada de vacaciones...');
    const startTime = Date.now();

    try {
      const companies = await Company.find({ isActive: true });
      console.log(`[AUDIT] Auditando ${companies.length} compañía(s) activa(s)...`);

      const results = {
        totalCompanies: companies.length,
        successful: 0,
        failed: 0,
        criticalAlerts: 0
      };

      for (const company of companies) {
        try {
          const findings = await this.runFullAudit(company._id);

          // Enviar alertas si hay errores críticos
          if (findings.errors.some(e => e.severity === 'CRITICAL')) {
            await this.sendCriticalAlerts(company, findings);
            results.criticalAlerts++;
          }

          // Guardar reporte
          await this.saveAuditReport(company._id, findings);
          results.successful++;

          console.log(`[AUDIT] Compañía ${company._id}: ${findings.errors.length} error(es), ${findings.warnings.length} advertencia(s)`);

        } catch (error) {
          console.error(`[AUDIT] Error auditando compañía ${company._id}:`, error.message);
          results.failed++;
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(`[AUDIT] Auditoría completada en ${executionTime}ms:`, results);

      return results;

    } catch (error) {
      console.error('[AUDIT] Error en auditoría programada:', error.message);
      throw error;
    }
  }

  async sendCriticalAlerts(company, findings) {
    try {
      const criticalErrors = findings.errors.filter(e => e.severity === 'CRITICAL');

      console.error(`[CRITICAL AUDIT] Compañía ${company._id}:`, {
        companyName: company.name || company._id,
        timestamp: findings.timestamp,
        totalErrors: findings.errors.length,
        criticalErrors: criticalErrors.length,
        errors: criticalErrors.map(e => ({
          type: e.type,
          message: e.message,
          count: e.count
        }))
      });

      // TODO: Implementar envío de emails/notificaciones
      // Ejemplo: await emailService.sendCriticalAuditAlert(company, criticalErrors);
      // Ejemplo: await slackService.sendAlert(company, criticalErrors);

      return {
        type: 'console',
        success: true,
        sentAt: new Date()
      };

    } catch (error) {
      console.error(`[AUDIT] Error enviando alertas críticas para ${company._id}:`, error.message);
      return {
        type: 'console',
        success: false,
        error: error.message,
        sentAt: new Date()
      };
    }
  }

  async saveAuditReport(companyId, findings) {
    try {
      const status = findings.errors.length > 0
        ? 'FAILED'
        : (findings.warnings.length > 0 ? 'WARNING' : 'PASSED');

      const report = new AuditReport({
        companyId,
        timestamp: findings.timestamp,
        status,
        findings: findings,
        notificationsSent: findings.errors.some(e => e.severity === 'CRITICAL')
      });

      await report.save();
      return report;

    } catch (error) {
      console.error(`[AUDIT] Error guardando reporte para ${companyId}:`, error.message);
      throw error;
    }
  }

  /**
   * Obtener historial de auditorías para una compañía
   */
  async getAuditHistory(companyId, options = {}) {
    const {
      limit = 10,
      status = null,
      daysBack = 30
    } = options;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - daysBack);

    const query = {
      companyId,
      timestamp: { $gte: dateLimit }
    };

    if (status) {
      query.status = status;
    }

    return AuditReport.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Obtener última auditoría para una compañía
   */
  async getLastAudit(companyId) {
    return AuditReport.findOne({ companyId })
      .sort({ timestamp: -1 });
  }

  /**
   * Obtener métricas de auditoría
   */
  async getAuditMetrics(companyId, daysBack = 30) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - daysBack);

    const reports = await AuditReport.find({
      companyId,
      timestamp: { $gte: dateLimit }
    }).sort({ timestamp: -1 });

    const metrics = {
      totalAudits: reports.length,
      passed: reports.filter(r => r.status === 'PASSED').length,
      failed: reports.filter(r => r.status === 'FAILED').length,
      warnings: reports.filter(r => r.status === 'WARNING').length,
      lastAudit: reports[0] ? {
        timestamp: reports[0].timestamp,
        status: reports[0].status,
        errors: reports[0].findings.summary.totalErrors,
        warnings: reports[0].findings.summary.totalWarnings
      } : null,
      criticalIssues: reports.reduce((sum, r) =>
        sum + (r.findings.summary.criticalErrors || 0), 0),
      averageExecutionTime: reports.length > 0
        ? reports.reduce((sum, r) => sum + r.findings.summary.executionTimeMs, 0) / reports.length
        : 0
    };

    return metrics;
  }
}

module.exports = new VacationAuditService();
