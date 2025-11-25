/**
 * Vacation Service - Business Logic with Database Operations
 * Handles vacation requests, approvals, and balance management
 */

const VacationBalance = require('../models/VacationBalance');
const VacationRequest = require('../models/VacationRequest');
const VacationAuditLog = require('../models/VacationAuditLog');
const User = require('../models/User');
const {
  calculateAccruedVacationDays,
  validateVacationBalance,
  validateVacationDates,
  calculateVacationEndDate,
  calculateProjectedBalance
} = require('./vacationAccrualService');

class VacationService {
  /**
   * Initialize vacation balance for a new employee
   */
  async initializeEmployeeBalance(employeeId, hireDate, companyId) {
    try {
      // Check if balance already exists
      const existingBalance = await VacationBalance.findOne({ employeeId, companyId });

      if (existingBalance) {
        throw new Error('El balance de vacaciones ya existe para este empleado');
      }

      // Calculate initial accrued days
      const accrual = calculateAccruedVacationDays(new Date(hireDate));

      const balance = new VacationBalance({
        employeeId,
        hireDate: new Date(hireDate),
        accruedDays: accrual.accruedDays,
        enjoyedDays: 0,
        approvedPendingDays: 0,
        availableDays: accrual.accruedDays,
        lastAccrualDate: new Date(),
        companyId
      });

      await balance.save();

      // Create audit log
      await VacationAuditLog.createLog({
        employeeId,
        action: 'accrue',
        performedBy: employeeId,
        quantity: accrual.accruedDays,
        description: 'Balance inicial de vacaciones creado',
        metadata: { hireDate, yearsOfService: accrual.yearsOfService },
        companyId
      });

      return balance;
    } catch (error) {
      throw new Error(`Error inicializando balance: ${error.message}`);
    }
  }

  /**
   * Create a vacation request
   */
  async createRequest(employeeId, requestedDays, startDate, endDate, companyId, performedBy) {
    try {
      // 1. Get or create employee balance
      let balance = await VacationBalance.findOne({ employeeId, companyId });

      if (!balance) {
        // Get employee hire date
        const employee = await User.findById(employeeId);
        if (!employee) {
          throw new Error('Empleado no encontrado');
        }

        // This should come from employee profile - using a default for now
        const hireDate = new Date(); // TODO: Get from employee profile
        balance = await this.initializeEmployeeBalance(employeeId, hireDate, companyId);
      }

      // 2. Validate balance
      const balanceValidation = validateVacationBalance(balance.availableDays, requestedDays);
      if (!balanceValidation.isValid) {
        throw new Error(balanceValidation.message);
      }

      // 3. Validate dates
      const dateValidation = validateVacationDates(new Date(startDate), new Date(endDate));
      if (!dateValidation.isValid) {
        throw new Error(dateValidation.message);
      }

      // 4. Check for overlapping requests
      const overlapping = await VacationRequest.findOne({
        employeeId,
        companyId,
        status: { $in: ['requested', 'approved', 'scheduled'] },
        $or: [
          { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
        ]
      });

      if (overlapping) {
        throw new Error('Ya existe una solicitud activa que se solapa con estas fechas');
      }

      // 5. Create request
      const request = new VacationRequest({
        employeeId,
        requestedDays,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'requested',
        companyId
      });

      await request.save();

      // 6. Create audit log
      await VacationAuditLog.createLog({
        employeeId,
        action: 'request',
        requestId: request._id,
        performedBy: performedBy || employeeId,
        quantity: requestedDays,
        description: 'Solicitud de vacaciones creada',
        newState: { status: 'requested', startDate, endDate },
        companyId
      });

      return request;
    } catch (error) {
      throw new Error(`Error creando solicitud: ${error.message}`);
    }
  }

  /**
   * Approve a vacation request
   */
  async approveRequest(requestId, approverId, companyId) {
    try {
      // 1. Find request
      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!request.canBeApproved()) {
        throw new Error(`No se puede aprobar una solicitud en estado: ${request.status}`);
      }

      // 2. Validate balance still available
      const balance = await VacationBalance.findOne({
        employeeId: request.employeeId,
        companyId
      });

      if (!balance) {
        throw new Error('Balance de vacaciones no encontrado');
      }

      const balanceValidation = validateVacationBalance(
        balance.availableDays,
        request.requestedDays
      );

      if (!balanceValidation.isValid) {
        throw new Error(`Saldo insuficiente: ${balanceValidation.message}`);
      }

      // 3. Update request
      const previousState = { status: request.status };
      request.status = 'approved';
      request.approverId = approverId;
      request.approvalDate = new Date();
      await request.save();

      // 4. Update balance - move to approvedPendingDays
      balance.approvedPendingDays += request.requestedDays;
      await balance.save();

      // 5. Create audit log
      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'approve',
        requestId: request._id,
        performedBy: approverId,
        quantity: request.requestedDays,
        description: 'Solicitud aprobada',
        previousState,
        newState: { status: 'approved', approverId },
        companyId
      });

      return request;
    } catch (error) {
      throw new Error(`Error aprobando solicitud: ${error.message}`);
    }
  }

  /**
   * Reject a vacation request
   */
  async rejectRequest(requestId, approverId, rejectionReason, companyId) {
    try {
      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (request.status !== 'requested') {
        throw new Error(`No se puede rechazar una solicitud en estado: ${request.status}`);
      }

      const previousState = { status: request.status };
      request.status = 'rejected';
      request.approverId = approverId;
      request.approvalDate = new Date();
      request.rejectionReason = rejectionReason;
      await request.save();

      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'reject',
        requestId: request._id,
        performedBy: approverId,
        quantity: request.requestedDays,
        description: `Solicitud rechazada: ${rejectionReason}`,
        previousState,
        newState: { status: 'rejected', rejectionReason },
        companyId
      });

      return request;
    } catch (error) {
      throw new Error(`Error rechazando solicitud: ${error.message}`);
    }
  }

  /**
   * Schedule vacation enjoyment
   */
  async scheduleRequest(requestId, startDate, endDate, companyId, performedBy) {
    try {
      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (request.status !== 'approved') {
        throw new Error('Solo se pueden programar solicitudes aprobadas');
      }

      // Validate new dates
      const dateValidation = validateVacationDates(new Date(startDate), new Date(endDate));
      if (!dateValidation.isValid) {
        throw new Error(dateValidation.message);
      }

      const previousState = {
        status: request.status,
        startDate: request.startDate,
        endDate: request.endDate
      };

      request.status = 'scheduled';
      request.startDate = new Date(startDate);
      request.endDate = new Date(endDate);
      await request.save();

      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'schedule',
        requestId: request._id,
        performedBy,
        quantity: request.requestedDays,
        description: 'Vacaciones programadas',
        previousState,
        newState: { status: 'scheduled', startDate, endDate },
        companyId
      });

      return request;
    } catch (error) {
      throw new Error(`Error programando vacaciones: ${error.message}`);
    }
  }

  /**
   * Mark vacation as enjoyed and deduct from balance
   */
  async enjoyVacation(requestId, companyId, performedBy) {
    try {
      const request = await VacationRequest.findOne({ _id: requestId, companyId });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!request.canBeEnjoyed()) {
        const now = new Date();
        if (request.status !== 'scheduled') {
          throw new Error(`Solo se pueden disfrutar vacaciones programadas. Estado actual: ${request.status}`);
        }
        if (now < request.startDate) {
          throw new Error('La fecha de inicio de vacaciones aún no ha llegado');
        }
      }

      // Get balance
      const balance = await VacationBalance.findOne({
        employeeId: request.employeeId,
        companyId
      });

      if (!balance) {
        throw new Error('Balance de vacaciones no encontrado');
      }

      // Use optimistic locking to prevent race conditions
      const previousState = {
        status: request.status,
        enjoyedDays: balance.enjoyedDays,
        approvedPendingDays: balance.approvedPendingDays,
        availableDays: balance.availableDays
      };

      // Update request
      request.status = 'enjoyed';
      request.enjoyedDate = new Date();
      await request.save();

      // Update balance atomically
      balance.enjoyedDays += request.requestedDays;
      balance.approvedPendingDays -= request.requestedDays;
      // availableDays is calculated automatically in pre-save hook
      await balance.save();

      await VacationAuditLog.createLog({
        employeeId: request.employeeId,
        action: 'enjoy',
        requestId: request._id,
        performedBy,
        quantity: request.requestedDays,
        description: 'Vacaciones disfrutadas y descontadas del saldo',
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
      throw new Error(`Error registrando disfrute de vacaciones: ${error.message}`);
    }
  }

  /**
   * Daily accrual job - Update accrued days for all active employees
   */
  async dailyAccrual(companyId) {
    try {
      const balances = await VacationBalance.find({ companyId });
      const updateResults = [];

      for (const balance of balances) {
        try {
          // Calculate current accrual
          const accrual = calculateAccruedVacationDays(balance.hireDate);

          const previousAccrued = balance.accruedDays;
          const newAccrued = accrual.accruedDays;
          const dailyIncrease = newAccrued - previousAccrued;

          if (dailyIncrease > 0) {
            balance.accruedDays = newAccrued;
            balance.lastAccrualDate = new Date();
            await balance.save();

            await VacationAuditLog.createLog({
              employeeId: balance.employeeId,
              action: 'accrue',
              performedBy: balance.employeeId, // System action
              quantity: dailyIncrease,
              description: 'Causación diaria de vacaciones',
              previousState: { accruedDays: previousAccrued },
              newState: { accruedDays: newAccrued },
              metadata: { yearsOfService: accrual.yearsOfService },
              companyId
            });

            updateResults.push({
              employeeId: balance.employeeId,
              previousAccrued,
              newAccrued,
              increase: dailyIncrease
            });
          }
        } catch (error) {
          console.error(`Error actualizando balance para empleado ${balance.employeeId}:`, error);
        }
      }

      return {
        success: true,
        totalProcessed: balances.length,
        totalUpdated: updateResults.length,
        updates: updateResults
      };
    } catch (error) {
      throw new Error(`Error en causación diaria: ${error.message}`);
    }
  }

  /**
   * Get employee balance
   */
  async getBalance(employeeId, companyId) {
    try {
      const balance = await VacationBalance.findOne({ employeeId, companyId });

      if (!balance) {
        return null;
      }

      // Get pending requests
      const pendingRequests = await VacationRequest.find({
        employeeId,
        companyId,
        status: { $in: ['requested', 'approved', 'scheduled'] }
      }).sort({ requestDate: -1 });

      return {
        balance,
        pendingRequests,
        summary: {
          accruedDays: balance.accruedDays,
          enjoyedDays: balance.enjoyedDays,
          approvedPendingDays: balance.approvedPendingDays,
          availableDays: balance.availableDays,
          pendingRequestsCount: pendingRequests.length
        }
      };
    } catch (error) {
      throw new Error(`Error obteniendo balance: ${error.message}`);
    }
  }

  /**
   * Get vacation requests with filters
   */
  async getRequests(filters, companyId, limit = 50, skip = 0) {
    try {
      const query = { companyId };

      if (filters.employeeId) {
        query.employeeId = filters.employeeId;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        query.startDate = {};
        if (filters.startDate) {
          query.startDate.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.startDate.$lte = new Date(filters.endDate);
        }
      }

      const requests = await VacationRequest.find(query)
        .populate('employeeId', 'name email')
        .populate('approverId', 'name email')
        .sort({ requestDate: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await VacationRequest.countDocuments(query);

      return {
        requests,
        total,
        limit,
        skip,
        hasMore: skip + requests.length < total
      };
    } catch (error) {
      throw new Error(`Error obteniendo solicitudes: ${error.message}`);
    }
  }
}

module.exports = new VacationService();
