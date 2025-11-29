/**
 * VacationServiceV2 - Servicio de Vacaciones con Doble Aprobación
 *
 * Implementa el flujo de vacaciones según legislación colombiana (CST Art. 186):
 * - 15 días hábiles de vacaciones por año de servicio
 * - Flujo de doble aprobación: Líder + Talento Humano
 * - Registro de vacaciones históricas
 * - Cálculo diario de causación
 *
 * @module vacationServiceV2
 */

const VacationBalance = require('../models/VacationBalance');
const VacationRequest = require('../models/VacationRequest');
const VacationAuditLog = require('../models/VacationAuditLog');
const HistoricalVacation = require('../models/HistoricalVacation');
const User = require('../models/User');
const {
  calcularCausacion,
  saldoDisponible,
  validarSolicitud,
  calcularAjusteCambioBase,
  convertirHabilesACalendario,
  calcularDiasHabilesExactos,
  formatearDiasParaDisplay,
  obtenerResumenFormateado,
  MOTOR_CONSTANTS
} = require('./motorVacaciones');

class VacationServiceV2 {

  // ============================================================================
  // GESTIÓN DE BALANCE Y EMPLEADOS
  // ============================================================================

  /**
   * Inicializa el balance de vacaciones de un empleado
   */
  async initializeEmployeeBalance(employeeId, data, companyId, performedBy) {
    try {
      const existingBalance = await VacationBalance.findOne({ employeeId, companyId });

      if (existingBalance) {
        throw new Error('El balance de vacaciones ya existe para este empleado');
      }

      const {
        hireDate,
        leaderId = null,
        position = null,
        department = null,
        historicalEnjoyedDays = 0,
        workTimeFactor = 1.0,
        calculationBase = '365',
        notes = null
      } = data;

      // Calcular días causados desde fecha de contratación
      const causacion = calcularCausacion(new Date(hireDate), new Date(), {
        base: calculationBase,
        factorJornada: workTimeFactor
      });

      if (!causacion.valido) {
        throw new Error(`Error en cálculo de causación: ${causacion.error}`);
      }

      const balance = new VacationBalance({
        employeeId,
        hireDate: new Date(hireDate),
        leaderId,
        position,
        department,
        accruedDays: causacion.diasCausados,
        enjoyedDays: 0,
        historicalEnjoyedDays,
        approvedPendingDays: 0,
        lastAccrualDate: new Date(),
        workTimeFactor,
        calculationBase,
        notes,
        companyId
      });

      await balance.save();

      // Audit log
      await VacationAuditLog.createLog({
        employeeId,
        action: 'accrue',
        performedBy,
        quantity: causacion.diasCausados,
        description: `Balance inicial creado. Días causados: ${causacion.diasCausados}, Histórico disfrutado: ${historicalEnjoyedDays}`,
        newState: {
          accruedDays: causacion.diasCausados,
          historicalEnjoyedDays,
          availableDays: balance.availableDays
        },
        metadata: {
          hireDate,
          yearsOfService: causacion.anosServicio,
          calculationBase,
          workTimeFactor
        },
        companyId
      });

      return balance;
    } catch (error) {
      throw new Error(`Error inicializando balance: ${error.message}`);
    }
  }

  /**
   * Actualiza información del empleado (líder, cargo, departamento)
   */
  async updateEmployeeInfo(employeeId, data, companyId, performedBy) {
    try {
      const balance = await VacationBalance.findOne({ employeeId, companyId });

      if (!balance) {
        throw new Error('Balance de vacaciones no encontrado');
      }

      const previousState = {
        leaderId: balance.leaderId,
        position: balance.position,
        department: balance.department
      };

      const updates = {};
      if (data.leaderId !== undefined) updates.leaderId = data.leaderId;
      if (data.position !== undefined) updates.position = data.position;
      if (data.department !== undefined) updates.department = data.department;
      if (data.workTimeFactor !== undefined) updates.workTimeFactor = data.workTimeFactor;
      if (data.notes !== undefined) updates.notes = data.notes;

      Object.assign(balance, updates);
      await balance.save();

      await VacationAuditLog.createLog({
        employeeId,
        action: 'update',
        performedBy,
        description: 'Información del empleado actualizada',
        previousState,
        newState: updates,
        companyId
      });

      return balance;
    } catch (error) {
      throw new Error(`Error actualizando info empleado: ${error.message}`);
    }
  }

  /**
   * Actualiza la fecha de contratación de un empleado
   * Recalcula días causados y propaga el cambio al tercero (Supplier)
   *
   * @param {string} employeeId - ID del empleado
   * @param {Date|string} newHireDate - Nueva fecha de contratación
   * @param {string} reason - Razón del cambio (obligatoria)
   * @param {string} companyId - ID de la empresa
   * @param {string} performedBy - ID del usuario que realiza el cambio
   * @param {Object} options - Opciones adicionales
   * @param {boolean} options.syncToSupplier - Si debe sincronizar al tercero (default: true)
   * @returns {Object} Balance actualizado con detalles del cambio
   */
  async updateHireDate(employeeId, newHireDate, reason, companyId, performedBy, options = {}) {
    try {
      const { syncToSupplier = true } = options;

      if (!reason || reason.trim().length === 0) {
        throw new Error('Debe proporcionar una razón para el cambio de fecha de contratación');
      }

      const balance = await VacationBalance.findOne({ employeeId, companyId });
      if (!balance) {
        throw new Error('Balance de vacaciones no encontrado para este empleado');
      }

      const newDate = new Date(newHireDate);
      if (isNaN(newDate.getTime())) {
        throw new Error('Fecha de contratación inválida');
      }

      if (newDate > new Date()) {
        throw new Error('La fecha de contratación no puede ser futura');
      }

      const previousHireDate = balance.hireDate;
      const previousAccruedDays = balance.accruedDays;

      // Preparar períodos de suspensión para cálculo
      const periodosSinCausar = (balance.suspensionPeriods || []).map(p => ({
        inicio: p.startDate,
        fin: p.endDate
      }));

      // Recalcular días causados con nueva fecha
      const causacion = calcularCausacion(newDate, new Date(), {
        base: balance.calculationBase,
        factorJornada: balance.workTimeFactor,
        periodosSinCausar
      });

      if (!causacion.valido) {
        throw new Error(`Error en cálculo de causación: ${causacion.error}`);
      }

      // Registrar en historial de cambios de fecha
      if (!balance.hireDateChangeHistory) {
        balance.hireDateChangeHistory = [];
      }

      balance.hireDateChangeHistory.push({
        previousDate: previousHireDate,
        newDate: newDate,
        changeDate: new Date(),
        previousAccruedDays: previousAccruedDays,
        newAccruedDays: causacion.diasCausados,
        adjustmentDays: causacion.diasCausados - previousAccruedDays,
        reason,
        performedBy
      });

      // Actualizar balance
      balance.hireDate = newDate;
      balance.accruedDays = causacion.diasCausados;
      balance.lastAccrualDate = new Date();

      await balance.save();

      // Sincronizar al tercero (Supplier) si está habilitado
      let supplierUpdated = false;
      if (syncToSupplier) {
        try {
          const Supplier = require('../models/Supplier');
          const mongoose = require('mongoose');

          // Buscar el tercero por ID o por relación
          let supplier = null;
          if (mongoose.Types.ObjectId.isValid(employeeId)) {
            supplier = await Supplier.findById(employeeId);
          }

          if (!supplier) {
            // Intentar buscar por email o nombre
            const userData = await User.findById(employeeId).select('email name');
            if (userData) {
              supplier = await Supplier.findOne({
                $or: [
                  { email: userData.email },
                  { legal_name: userData.name },
                  { full_name: userData.name }
                ],
                active: true,
                deleted: { $ne: true }
              });
            }
          }

          if (supplier) {
            // Actualizar custom_fields con la nueva fecha
            const hireDateFields = ['fecha_contratacion', 'fecha_de_iniciacion_de_labores', 'fecha_ingreso', 'hire_date'];
            const customFields = supplier.custom_fields instanceof Map
              ? supplier.custom_fields
              : new Map(Object.entries(supplier.custom_fields || {}));

            // Actualizar todos los campos de fecha de contratación encontrados
            let fieldUpdated = false;
            for (const field of hireDateFields) {
              if (customFields.has(field)) {
                customFields.set(field, newDate.toISOString().split('T')[0]);
                fieldUpdated = true;
              }
            }

            // Si no había ningún campo, crear el principal
            if (!fieldUpdated) {
              customFields.set('fecha_contratacion', newDate.toISOString().split('T')[0]);
            }

            supplier.custom_fields = customFields;
            await supplier.save();
            supplierUpdated = true;
          }
        } catch (supplierError) {
          console.warn('Advertencia: No se pudo sincronizar fecha al tercero:', supplierError.message);
          // No fallar la operación principal si falla la sincronización
        }
      }

      // Audit log detallado
      await VacationAuditLog.createLog({
        employeeId,
        action: 'update',
        performedBy,
        description: `Fecha de contratación actualizada: ${previousHireDate.toISOString().split('T')[0]} → ${newDate.toISOString().split('T')[0]}. Razón: ${reason}`,
        previousState: {
          hireDate: previousHireDate,
          accruedDays: previousAccruedDays
        },
        newState: {
          hireDate: newDate,
          accruedDays: causacion.diasCausados,
          adjustmentDays: causacion.diasCausados - previousAccruedDays
        },
        metadata: {
          reason,
          supplierSynced: supplierUpdated,
          yearsOfService: causacion.anosServicio,
          diasTrabajados: causacion.diasTrabajados
        },
        companyId
      });

      return {
        balance,
        change: {
          previousHireDate: previousHireDate.toISOString().split('T')[0],
          newHireDate: newDate.toISOString().split('T')[0],
          previousAccruedDays: Math.round(previousAccruedDays * 10000) / 10000,
          newAccruedDays: Math.round(causacion.diasCausados * 10000) / 10000,
          adjustmentDays: Math.round((causacion.diasCausados - previousAccruedDays) * 10000) / 10000,
          yearsOfService: causacion.anosServicio,
          supplierSynced: supplierUpdated
        },
        causacion
      };
    } catch (error) {
      throw new Error(`Error actualizando fecha de contratación: ${error.message}`);
    }
  }

  // ============================================================================
  // REGISTRO DE VACACIONES HISTÓRICAS
  // ============================================================================

  /**
   * Registra vacaciones históricas disfrutadas antes del sistema
   */
  async registerHistoricalVacation(employeeId, data, companyId, registeredBy) {
    try {
      const {
        servicePeriodStart,
        servicePeriodEnd,
        daysEnjoyed,
        enjoyedStartDate,
        enjoyedEndDate,
        type = 'historical',
        supportDocument = null,
        notes = null
      } = data;

      // Verificar que existe el balance del empleado
      const balance = await VacationBalance.findOne({ employeeId, companyId });
      if (!balance) {
        throw new Error('Empleado no tiene balance de vacaciones. Inicialice primero.');
      }

      // Crear registro histórico
      const historical = new HistoricalVacation({
        employeeId,
        servicePeriod: {
          startDate: new Date(servicePeriodStart),
          endDate: new Date(servicePeriodEnd)
        },
        daysEnjoyed,
        enjoyedStartDate: new Date(enjoyedStartDate),
        enjoyedEndDate: new Date(enjoyedEndDate),
        type,
        supportDocument,
        notes,
        registeredBy,
        companyId
      });

      await historical.save();

      // Actualizar balance con días históricos
      balance.historicalEnjoyedDays = (balance.historicalEnjoyedDays || 0) + daysEnjoyed;
      await balance.save();

      // Audit log
      await VacationAuditLog.createLog({
        employeeId,
        action: 'update',
        performedBy: registeredBy,
        quantity: daysEnjoyed,
        description: `Vacaciones históricas registradas: ${daysEnjoyed} días (${enjoyedStartDate} - ${enjoyedEndDate})`,
        newState: {
          historicalEnjoyedDays: balance.historicalEnjoyedDays,
          availableDays: balance.availableDays
        },
        metadata: {
          historicalRecordId: historical._id,
          type,
          supportDocument
        },
        companyId
      });

      return { historical, balance };
    } catch (error) {
      throw new Error(`Error registrando vacaciones históricas: ${error.message}`);
    }
  }

  /**
   * Obtiene el historial de vacaciones de un empleado
   */
  async getHistoricalVacations(employeeId, companyId) {
    try {
      const result = await HistoricalVacation.getEmployeeSummary(employeeId, companyId);
      return result;
    } catch (error) {
      throw new Error(`Error obteniendo historial: ${error.message}`);
    }
  }

  /**
   * Verifica un registro histórico (solo Talento Humano)
   */
  async verifyHistoricalRecord(historicalId, verifiedBy, companyId) {
    try {
      const record = await HistoricalVacation.findOne({ _id: historicalId, companyId });

      if (!record) {
        throw new Error('Registro histórico no encontrado');
      }

      if (record.isVerified) {
        throw new Error('El registro ya fue verificado');
      }

      record.isVerified = true;
      record.verifiedBy = verifiedBy;
      record.verifiedAt = new Date();
      await record.save();

      await VacationAuditLog.createLog({
        employeeId: record.employeeId,
        action: 'update',
        performedBy: verifiedBy,
        description: `Registro histórico verificado (${record.daysEnjoyed} días)`,
        metadata: { historicalRecordId: record._id },
        companyId
      });

      return record;
    } catch (error) {
      throw new Error(`Error verificando registro: ${error.message}`);
    }
  }

  // ============================================================================
  // SOLICITUDES DE VACACIONES - FLUJO DE DOBLE APROBACIÓN
  // ============================================================================

  /**
   * Crea una solicitud de vacaciones (empleado)
   */
  async createRequest(employeeId, data, companyId, performedBy) {
    try {
      const { requestedDays, startDate, endDate, employeeNotes = null } = data;

      // 1. Obtener balance
      const balance = await VacationBalance.findOne({ employeeId, companyId });
      if (!balance) {
        throw new Error('Empleado no tiene balance de vacaciones. Contacte a Talento Humano.');
      }

      // 2. Validar saldo disponible
      const validation = validarSolicitud(requestedDays, balance.availableDays);
      if (validation.bloqueado) {
        throw new Error(validation.razon);
      }

      // 3. Verificar solapamiento
      const overlapping = await VacationRequest.findOne({
        employeeId,
        companyId,
        status: { $in: ['requested', 'leader_approved', 'hr_approved', 'scheduled'] },
        $or: [
          { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
        ]
      });

      if (overlapping) {
        throw new Error('Ya existe una solicitud activa que se solapa con estas fechas');
      }

      // 4. Crear solicitud
      const request = new VacationRequest({
        employeeId,
        requestedDays,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'requested',
        employeeNotes,
        companyId
      });

      await request.save();

      // 5. Audit log
      await VacationAuditLog.createLog({
        employeeId,
        action: 'request',
        requestId: request._id,
        performedBy,
        quantity: requestedDays,
        description: `Solicitud creada: ${requestedDays} días (${startDate} - ${endDate})`,
        newState: { status: 'requested', startDate, endDate },
        companyId
      });

      return {
        request,
        approvalFlow: {
          nextStep: 'leader',
          description: 'Pendiente aprobación del líder',
          leaderId: balance.leaderId
        }
      };
    } catch (error) {
      throw new Error(`Error creando solicitud: ${error.message}`);
    }
  }

  /**
   * Aprobación por el Líder (Paso 1)
   */
  async approveByLeader(requestId, leaderId, companyId, comments = null) {
    try {
      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!request.canBeApprovedByLeader()) {
        throw new Error(`No se puede aprobar. Estado actual: ${request.status}`);
      }

      // Verificar que el aprobador es el líder del empleado
      const balance = await VacationBalance.findOne({
        employeeId: request.employeeId,
        companyId
      });

      if (balance.leaderId && balance.leaderId.toString() !== leaderId.toString()) {
        // Permitir si es admin o talento_humano
        const approver = await User.findById(leaderId);
        if (!['admin', 'talento_humano', 'super_admin'].includes(approver?.role)) {
          throw new Error('Solo el líder asignado puede aprobar esta solicitud');
        }
      }

      const previousState = { status: request.status };

      request.status = 'leader_approved';
      request.leaderId = leaderId;
      request.leaderApprovalDate = new Date();
      request.leaderComments = comments;
      await request.save();

      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'approve',
        requestId: request._id,
        performedBy: leaderId,
        quantity: request.requestedDays,
        description: 'Aprobada por líder. Pendiente aprobación de Talento Humano.',
        previousState,
        newState: { status: 'leader_approved', leaderId },
        companyId
      });

      return {
        request,
        approvalFlow: {
          currentStep: 'leader_approved',
          nextStep: 'hr',
          description: 'Pendiente aprobación de Talento Humano'
        }
      };
    } catch (error) {
      throw new Error(`Error en aprobación del líder: ${error.message}`);
    }
  }

  /**
   * Rechazo por el Líder
   */
  async rejectByLeader(requestId, leaderId, companyId, reason) {
    try {
      if (!reason || reason.trim().length === 0) {
        throw new Error('Debe proporcionar una razón de rechazo');
      }

      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!request.canBeApprovedByLeader()) {
        throw new Error(`No se puede rechazar. Estado actual: ${request.status}`);
      }

      const previousState = { status: request.status };

      request.status = 'leader_rejected';
      request.leaderId = leaderId;
      request.leaderApprovalDate = new Date();
      request.rejectionReason = reason;
      request.rejectedBy = 'leader';
      await request.save();

      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'reject',
        requestId: request._id,
        performedBy: leaderId,
        quantity: request.requestedDays,
        description: `Rechazada por líder: ${reason}`,
        previousState,
        newState: { status: 'leader_rejected', rejectionReason: reason },
        companyId
      });

      return request;
    } catch (error) {
      throw new Error(`Error en rechazo del líder: ${error.message}`);
    }
  }

  /**
   * Aprobación por Talento Humano (Paso 2 - Final)
   */
  async approveByHR(requestId, hrUserId, companyId, comments = null) {
    try {
      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!request.canBeApprovedByHR()) {
        throw new Error(`No se puede aprobar por TH. Estado actual: ${request.status}. Debe estar aprobada por el líder primero.`);
      }

      // Verificar saldo disponible nuevamente
      const balance = await VacationBalance.findOne({
        employeeId: request.employeeId,
        companyId
      });

      const validation = validarSolicitud(request.requestedDays, balance.availableDays);
      if (validation.bloqueado) {
        throw new Error(`Saldo insuficiente: ${validation.razon}`);
      }

      const previousState = { status: request.status };

      // Actualizar solicitud
      request.status = 'hr_approved';
      request.hrApproverId = hrUserId;
      request.hrApprovalDate = new Date();
      request.hrComments = comments;
      request.approverId = hrUserId; // Legacy compatibility
      request.approvalDate = new Date();
      await request.save();

      // Actualizar balance - reservar días
      balance.approvedPendingDays += request.requestedDays;
      await balance.save();

      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'approve',
        requestId: request._id,
        performedBy: hrUserId,
        quantity: request.requestedDays,
        description: 'Aprobación final por Talento Humano. Días reservados.',
        previousState,
        newState: {
          status: 'hr_approved',
          hrApproverId: hrUserId,
          approvedPendingDays: balance.approvedPendingDays
        },
        companyId
      });

      return {
        request,
        balance: {
          approvedPendingDays: balance.approvedPendingDays,
          availableDays: balance.availableDays
        },
        approvalFlow: {
          currentStep: 'hr_approved',
          nextStep: 'schedule_or_enjoy',
          description: 'Completamente aprobada. Lista para programar o disfrutar.'
        }
      };
    } catch (error) {
      throw new Error(`Error en aprobación de TH: ${error.message}`);
    }
  }

  /**
   * Rechazo por Talento Humano
   */
  async rejectByHR(requestId, hrUserId, companyId, reason) {
    try {
      if (!reason || reason.trim().length === 0) {
        throw new Error('Debe proporcionar una razón de rechazo');
      }

      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!request.canBeApprovedByHR()) {
        throw new Error(`No se puede rechazar por TH. Estado actual: ${request.status}`);
      }

      const previousState = { status: request.status };

      request.status = 'hr_rejected';
      request.hrApproverId = hrUserId;
      request.hrApprovalDate = new Date();
      request.rejectionReason = reason;
      request.rejectedBy = 'hr';
      await request.save();

      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'reject',
        requestId: request._id,
        performedBy: hrUserId,
        quantity: request.requestedDays,
        description: `Rechazada por Talento Humano: ${reason}`,
        previousState,
        newState: { status: 'hr_rejected', rejectionReason: reason },
        companyId
      });

      return request;
    } catch (error) {
      throw new Error(`Error en rechazo de TH: ${error.message}`);
    }
  }

  /**
   * Registrar disfrute de vacaciones
   */
  async markAsEnjoyed(requestId, performedBy, companyId) {
    try {
      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!request.canBeEnjoyed()) {
        throw new Error(`No se puede marcar como disfrutada. Estado: ${request.status}`);
      }

      const balance = await VacationBalance.findOne({
        employeeId: request.employeeId,
        companyId
      });

      const previousState = {
        status: request.status,
        enjoyedDays: balance.enjoyedDays,
        approvedPendingDays: balance.approvedPendingDays
      };

      // Actualizar solicitud
      request.status = 'enjoyed';
      request.enjoyedDate = new Date();
      await request.save();

      // Actualizar balance
      balance.enjoyedDays += request.requestedDays;
      balance.approvedPendingDays -= request.requestedDays;
      await balance.save();

      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'enjoy',
        requestId: request._id,
        performedBy,
        quantity: request.requestedDays,
        description: `Vacaciones disfrutadas: ${request.requestedDays} días`,
        previousState,
        newState: {
          status: 'enjoyed',
          enjoyedDays: balance.enjoyedDays,
          approvedPendingDays: balance.approvedPendingDays,
          availableDays: balance.availableDays
        },
        companyId
      });

      return { request, balance };
    } catch (error) {
      throw new Error(`Error marcando como disfrutada: ${error.message}`);
    }
  }

  // ============================================================================
  // CONSULTAS
  // ============================================================================

  /**
   * Obtiene el balance de un empleado con resumen completo
   */
  async getEmployeeBalance(employeeId, companyId) {
    try {
      const balance = await VacationBalance.findOne({ employeeId, companyId })
        .populate('leaderId', 'name email')
        .populate('employeeId', 'name email');

      if (!balance) {
        return null;
      }

      // Recalcular causación actual
      const causacion = calcularCausacion(balance.hireDate, new Date(), {
        base: balance.calculationBase,
        factorJornada: balance.workTimeFactor
      });

      // Obtener solicitudes activas
      const activeRequests = await VacationRequest.find({
        employeeId,
        companyId,
        status: { $in: ['requested', 'leader_approved', 'hr_approved', 'scheduled'] }
      }).sort({ requestDate: -1 });

      return {
        balance,
        causacion: causacion.valido ? causacion : null,
        summary: balance.getSummary(),
        activeRequests: activeRequests.length,
        requests: activeRequests
      };
    } catch (error) {
      throw new Error(`Error obteniendo balance: ${error.message}`);
    }
  }

  /**
   * Obtiene solicitudes pendientes de aprobación para un líder
   */
  async getPendingForLeader(leaderId, companyId) {
    try {
      // Obtener empleados bajo este líder
      const subordinates = await VacationBalance.find({
        leaderId,
        companyId
      }).select('employeeId');

      const employeeIds = subordinates.map(s => s.employeeId);

      // Obtener solicitudes pendientes
      const requests = await VacationRequest.find({
        employeeId: { $in: employeeIds },
        companyId,
        status: 'requested'
      })
        .populate('employeeId', 'name email')
        .sort({ requestDate: 1 });

      return requests;
    } catch (error) {
      throw new Error(`Error obteniendo pendientes para líder: ${error.message}`);
    }
  }

  /**
   * Obtiene solicitudes pendientes de aprobación para Talento Humano
   */
  async getPendingForHR(companyId) {
    try {
      const requests = await VacationRequest.find({
        companyId,
        status: 'leader_approved'
      })
        .populate('employeeId', 'name email')
        .populate('leaderId', 'name email')
        .sort({ requestDate: 1 });

      return requests;
    } catch (error) {
      throw new Error(`Error obteniendo pendientes para TH: ${error.message}`);
    }
  }

  /**
   * Obtiene todas las solicitudes con filtros
   */
  async getRequests(filters, companyId, limit = 50, skip = 0) {
    try {
      const query = { companyId };

      if (filters.employeeId) query.employeeId = filters.employeeId;
      if (filters.status) query.status = filters.status;
      if (filters.leaderId) query.leaderId = filters.leaderId;

      if (filters.startDate || filters.endDate) {
        query.startDate = {};
        if (filters.startDate) query.startDate.$gte = new Date(filters.startDate);
        if (filters.endDate) query.startDate.$lte = new Date(filters.endDate);
      }

      const requests = await VacationRequest.find(query)
        .populate('employeeId', 'name email')
        .populate('leaderId', 'name email')
        .populate('hrApproverId', 'name email')
        .sort({ requestDate: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await VacationRequest.countDocuments(query);

      // Agregar información de etapa de aprobación a cada solicitud
      const requestsWithStage = requests.map(r => ({
        ...r,
        approvalStage: this._getApprovalStage(r.status)
      }));

      return {
        requests: requestsWithStage,
        total,
        limit,
        skip,
        hasMore: skip + requests.length < total
      };
    } catch (error) {
      throw new Error(`Error obteniendo solicitudes: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los empleados con balance (para vista de TH)
   */
  async getAllEmployeeBalances(companyId, filters = {}) {
    try {
      const query = { companyId };

      if (filters.department) query.department = filters.department;
      if (filters.leaderId) query.leaderId = filters.leaderId;

      const balances = await VacationBalance.find(query)
        .populate('employeeId', 'name email role')
        .populate('leaderId', 'name email')
        .sort({ department: 1, 'employeeId.name': 1 });

      // Importar Supplier para buscar nombres de terceros empleados
      const Supplier = require('../models/Supplier');

      // Agregar resumen a cada balance y resolver nombre desde Supplier si es necesario
      const balancesWithSummary = await Promise.all(balances.map(async (b) => {
        const balanceObj = b.toObject();

        // Si employeeId no tiene name (no es User, es Supplier/Tercero), buscar en Supplier
        if (!balanceObj.employeeId?.name && balanceObj.employeeId) {
          const employeeIdVal = balanceObj.employeeId._id || balanceObj.employeeId;
          try {
            const supplier = await Supplier.findById(employeeIdVal)
              .select('legal_name full_name identification_number email')
              .lean();
            if (supplier) {
              balanceObj.employeeId = {
                _id: employeeIdVal,
                name: supplier.legal_name || supplier.full_name || 'Sin nombre',
                email: supplier.email || '',
                identification_number: supplier.identification_number
              };
            }
          } catch (err) {
            console.log('Error buscando Supplier para employeeId:', employeeIdVal, err.message);
          }
        }

        return {
          ...balanceObj,
          summary: b.getSummary(),
          yearsOfService: b.getYearsOfService()
        };
      }));

      return balancesWithSummary;
    } catch (error) {
      throw new Error(`Error obteniendo balances: ${error.message}`);
    }
  }

  // ============================================================================
  // GESTIÓN DE SUSPENSIONES
  // ============================================================================

  /**
   * Registra un período de suspensión (licencia no remunerada, ausencia, etc.)
   * Los días de suspensión NO causan vacaciones según CST
   */
  async registerSuspensionPeriod(employeeId, data, companyId, performedBy) {
    try {
      const { startDate, endDate, reason, description = null } = data;

      const balance = await VacationBalance.findOne({ employeeId, companyId });
      if (!balance) {
        throw new Error('Empleado no tiene balance de vacaciones');
      }

      // Calcular días del período
      const inicio = new Date(startDate);
      const fin = new Date(endDate);
      if (fin < inicio) {
        throw new Error('Fecha fin debe ser posterior a fecha inicio');
      }

      const daysCount = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;

      // Agregar período de suspensión
      balance.suspensionPeriods.push({
        startDate: inicio,
        endDate: fin,
        reason,
        description,
        daysCount,
        registeredBy: performedBy,
        registeredAt: new Date()
      });

      // Actualizar total de días de suspensión
      balance.totalSuspensionDays = balance.suspensionPeriods.reduce(
        (sum, p) => sum + (p.daysCount || 0), 0
      );

      // Recalcular días causados con suspensiones
      const periodosSinCausar = balance.suspensionPeriods.map(p => ({
        inicio: p.startDate,
        fin: p.endDate
      }));

      const causacion = calcularCausacion(balance.hireDate, new Date(), {
        base: balance.calculationBase,
        factorJornada: balance.workTimeFactor,
        periodosSinCausar
      });

      if (causacion.valido) {
        balance.accruedDays = causacion.diasCausados;
      }

      await balance.save();

      await VacationAuditLog.createLog({
        employeeId,
        action: 'update',
        performedBy,
        quantity: -daysCount,
        description: `Período de suspensión registrado: ${reason} (${daysCount} días). Del ${startDate} al ${endDate}`,
        newState: {
          totalSuspensionDays: balance.totalSuspensionDays,
          accruedDays: balance.accruedDays,
          availableDays: balance.availableDays
        },
        companyId
      });

      return { balance, suspensionAdded: balance.suspensionPeriods[balance.suspensionPeriods.length - 1] };
    } catch (error) {
      throw new Error(`Error registrando suspensión: ${error.message}`);
    }
  }

  /**
   * Elimina un período de suspensión
   */
  async removeSuspensionPeriod(employeeId, suspensionIndex, companyId, performedBy) {
    try {
      const balance = await VacationBalance.findOne({ employeeId, companyId });
      if (!balance) {
        throw new Error('Empleado no tiene balance de vacaciones');
      }

      if (suspensionIndex < 0 || suspensionIndex >= balance.suspensionPeriods.length) {
        throw new Error('Índice de suspensión inválido');
      }

      const removed = balance.suspensionPeriods.splice(suspensionIndex, 1)[0];

      // Recalcular total
      balance.totalSuspensionDays = balance.suspensionPeriods.reduce(
        (sum, p) => sum + (p.daysCount || 0), 0
      );

      // Recalcular días causados
      const periodosSinCausar = balance.suspensionPeriods.map(p => ({
        inicio: p.startDate,
        fin: p.endDate
      }));

      const causacion = calcularCausacion(balance.hireDate, new Date(), {
        base: balance.calculationBase,
        factorJornada: balance.workTimeFactor,
        periodosSinCausar
      });

      if (causacion.valido) {
        balance.accruedDays = causacion.diasCausados;
      }

      await balance.save();

      await VacationAuditLog.createLog({
        employeeId,
        action: 'update',
        performedBy,
        quantity: removed.daysCount,
        description: `Período de suspensión eliminado: ${removed.reason} (${removed.daysCount} días)`,
        newState: {
          totalSuspensionDays: balance.totalSuspensionDays,
          accruedDays: balance.accruedDays
        },
        companyId
      });

      return { balance, suspensionRemoved: removed };
    } catch (error) {
      throw new Error(`Error eliminando suspensión: ${error.message}`);
    }
  }

  // ============================================================================
  // CAMBIO DE BASE DE CÁLCULO
  // ============================================================================

  /**
   * Cambia la base de cálculo (365 ↔ 360) con registro ADR y ajuste
   */
  async changeCalculationBase(employeeId, newBase, reason, companyId, performedBy) {
    try {
      const balance = await VacationBalance.findOne({ employeeId, companyId });
      if (!balance) {
        throw new Error('Empleado no tiene balance de vacaciones');
      }

      const currentBase = balance.calculationBase || '365';
      if (currentBase === newBase) {
        throw new Error('La base de cálculo ya es la seleccionada');
      }

      // Preparar períodos de suspensión para cálculo
      const periodosSinCausar = (balance.suspensionPeriods || []).map(p => ({
        inicio: p.startDate,
        fin: p.endDate
      }));

      // Calcular ajuste necesario
      const ajuste = calcularAjusteCambioBase(
        balance.hireDate,
        new Date(),
        currentBase,
        newBase,
        {
          periodosSinCausar,
          factorJornada: balance.workTimeFactor
        }
      );

      if (!ajuste.valido) {
        throw new Error(`Error calculando ajuste: ${ajuste.error}`);
      }

      // Registrar en historial de cambios de base
      balance.baseChangeHistory.push({
        fromBase: currentBase,
        toBase: newBase,
        changeDate: new Date(),
        accruedAtChange: balance.accruedDays,
        adjustmentApplied: ajuste.ajusteDias,
        reason,
        performedBy
      });

      // Actualizar base y días causados
      balance.calculationBase = newBase;
      balance.accruedDays = ajuste.causacionBaseNueva;

      await balance.save();

      await VacationAuditLog.createLog({
        employeeId,
        action: 'update',
        performedBy,
        quantity: ajuste.ajusteDias,
        description: `Cambio de base de cálculo: ${currentBase} → ${newBase}. Ajuste aplicado: ${ajuste.ajusteDias} días. Razón: ${reason}`,
        previousState: {
          calculationBase: currentBase,
          accruedDays: ajuste.causacionBaseAnterior
        },
        newState: {
          calculationBase: newBase,
          accruedDays: ajuste.causacionBaseNueva,
          adjustmentApplied: ajuste.ajusteDias
        },
        metadata: {
          adr: ajuste.adr
        },
        companyId
      });

      return {
        balance,
        ajuste,
        message: ajuste.instrucciones
      };
    } catch (error) {
      throw new Error(`Error cambiando base: ${error.message}`);
    }
  }

  // ============================================================================
  // CÁLCULOS CON DÍAS HÁBILES
  // ============================================================================

  /**
   * Calcula días hábiles para una solicitud de vacaciones
   * Útil para mostrar al usuario cuántos días hábiles realmente tomará
   */
  async calculateBusinessDays(startDate, endDate, companyId) {
    try {
      // TODO: Obtener festivos de la compañía si están configurados
      const festivos = []; // Placeholder para festivos configurados

      const resultado = calcularDiasHabilesExactos(
        new Date(startDate),
        new Date(endDate),
        festivos
      );

      return {
        ...resultado,
        startDate,
        endDate,
        nota: 'Los 15 días legales son HÁBILES. Esta función calcula días hábiles exactos excluyendo sábados y domingos.'
      };
    } catch (error) {
      throw new Error(`Error calculando días hábiles: ${error.message}`);
    }
  }

  /**
   * Convierte días hábiles solicitados a días calendario
   * Para calcular fecha fin a partir de fecha inicio y días hábiles
   */
  convertBusinessToCalendarDays(businessDays) {
    return convertirHabilesACalendario(businessDays);
  }

  // ============================================================================
  // OBTENER BALANCE FORMATEADO PARA UI
  // ============================================================================

  /**
   * Obtiene balance formateado para mostrar en interfaz
   */
  async getFormattedBalance(employeeId, companyId) {
    try {
      const balance = await VacationBalance.findOne({ employeeId, companyId })
        .populate('leaderId', 'name email')
        .populate('employeeId', 'name email');

      if (!balance) {
        return null;
      }

      // Recalcular con suspensiones
      const periodosSinCausar = (balance.suspensionPeriods || []).map(p => ({
        inicio: p.startDate,
        fin: p.endDate
      }));

      const causacion = calcularCausacion(balance.hireDate, new Date(), {
        base: balance.calculationBase,
        factorJornada: balance.workTimeFactor,
        periodosSinCausar
      });

      // Actualizar días causados si es necesario
      if (causacion.valido && Math.abs(causacion.diasCausados - balance.accruedDays) > 0.0001) {
        balance.accruedDays = causacion.diasCausados;
        balance.lastAccrualDate = new Date();
        await balance.save();
      }

      // Obtener resumen formateado
      const resumen = obtenerResumenFormateado(balance);

      return {
        balance: balance.toObject(),
        causacion: causacion.valido ? {
          diasCausados: formatearDiasParaDisplay(causacion.diasCausados),
          diasTrabajados: causacion.diasTrabajados,
          diasSuspension: causacion.diasSuspension,
          anosServicio: causacion.anosServicio,
          tasaDiaria: formatearDiasParaDisplay(causacion.tasaDiaria)
        } : null,
        resumen,
        suspensiones: {
          total: balance.totalSuspensionDays || 0,
          periodos: balance.suspensionPeriods || []
        },
        historialCambiosBase: balance.baseChangeHistory || []
      };
    } catch (error) {
      throw new Error(`Error obteniendo balance formateado: ${error.message}`);
    }
  }

  // ============================================================================
  // HELPERS INTERNOS
  // ============================================================================

  _getApprovalStage(status) {
    const stages = {
      'requested': { stage: 1, label: 'Pendiente Líder', color: 'warning' },
      'leader_approved': { stage: 2, label: 'Pendiente TH', color: 'info' },
      'leader_rejected': { stage: -1, label: 'Rechazada por Líder', color: 'error' },
      'hr_approved': { stage: 3, label: 'Aprobada', color: 'success' },
      'hr_rejected': { stage: -1, label: 'Rechazada por TH', color: 'error' },
      'scheduled': { stage: 4, label: 'Programada', color: 'success' },
      'enjoyed': { stage: 5, label: 'Disfrutada', color: 'default' },
      'cancelled': { stage: -1, label: 'Cancelada', color: 'default' }
    };

    return stages[status] || { stage: 0, label: 'Desconocido', color: 'default' };
  }
}

module.exports = new VacationServiceV2();
