const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VacationBalanceSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Información laboral del empleado
  hireDate: {
    type: Date,
    required: true
  },
  // Líder/Jefe inmediato del empleado (para flujo de aprobación)
  leaderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  // Cargo/Posición del empleado
  position: {
    type: String,
    default: null
  },
  // Departamento/Área
  department: {
    type: String,
    default: null
  },
  // Días causados según fórmula: (días trabajados / 365) * 15
  accruedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  // Días ya disfrutados (histórico + actuales)
  enjoyedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  // Días aprobados pendientes de disfrutar
  approvedPendingDays: {
    type: Number,
    default: 0,
    min: 0
  },
  // Días disponibles (calculado automáticamente)
  availableDays: {
    type: Number,
    default: 0,
    min: 0
  },
  // Días históricos pre-cargados (vacaciones disfrutadas antes del sistema)
  historicalEnjoyedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  lastAccrualDate: {
    type: Date,
    default: null
  },
  // Base de cálculo (365 estándar legal, 360 comercial)
  calculationBase: {
    type: String,
    enum: ['365', '360'],
    default: '365'
  },
  // Factor de jornada (1.0 = tiempo completo, 0.5 = medio tiempo)
  workTimeFactor: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 1
  },
  // Periodos de suspensión (licencias no remuneradas, ausencias injustificadas)
  // Estos días NO causan vacaciones según CST
  suspensionPeriods: [{
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      enum: ['licencia_no_remunerada', 'ausencia_injustificada', 'suspension_disciplinaria', 'otro'],
      required: true
    },
    description: {
      type: String,
      default: null
    },
    daysCount: {
      type: Number,
      default: 0
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    registeredAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Total días de suspensión calculado
  totalSuspensionDays: {
    type: Number,
    default: 0,
    min: 0
  },
  // Historial de cambios de base de cálculo (ADR)
  baseChangeHistory: [{
    fromBase: {
      type: String,
      enum: ['365', '360']
    },
    toBase: {
      type: String,
      enum: ['365', '360']
    },
    changeDate: {
      type: Date,
      default: Date.now
    },
    accruedAtChange: {
      type: Number
    },
    adjustmentApplied: {
      type: Number,
      default: 0
    },
    reason: {
      type: String
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Notas adicionales sobre el balance
  notes: {
    type: String,
    default: null
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for unique employee per company
VacationBalanceSchema.index({ employeeId: 1, companyId: 1 }, { unique: true });

// Index for efficient queries
VacationBalanceSchema.index({ companyId: 1, lastAccrualDate: 1 });
VacationBalanceSchema.index({ leaderId: 1, companyId: 1 });
VacationBalanceSchema.index({ department: 1, companyId: 1 });

// Virtual for pending request days calculation
VacationBalanceSchema.virtual('pendingRequestDays').get(function() {
  return this.accruedDays - this.enjoyedDays - this.approvedPendingDays;
});

// Method to calculate total available days
VacationBalanceSchema.methods.getTotalAvailableDays = function() {
  return this.accruedDays - this.enjoyedDays - this.approvedPendingDays;
};

// Pre-save hook to update availableDays automatically
VacationBalanceSchema.pre('save', function(next) {
  // Incluir días históricos en el cálculo de disfrutados
  const totalEnjoyed = this.enjoyedDays + (this.historicalEnjoyedDays || 0);
  this.availableDays = this.accruedDays - totalEnjoyed - this.approvedPendingDays;
  this.updatedAt = new Date();
  next();
});

// Method to get complete vacation summary
VacationBalanceSchema.methods.getSummary = function() {
  const totalEnjoyed = this.enjoyedDays + (this.historicalEnjoyedDays || 0);
  return {
    accruedDays: this.accruedDays,
    enjoyedDays: this.enjoyedDays,
    historicalEnjoyedDays: this.historicalEnjoyedDays || 0,
    totalEnjoyedDays: totalEnjoyed,
    approvedPendingDays: this.approvedPendingDays,
    availableDays: this.availableDays,
    hireDate: this.hireDate,
    yearsOfService: this.getYearsOfService(),
    workTimeFactor: this.workTimeFactor,
    calculationBase: this.calculationBase
  };
};

// Method to calculate years of service
VacationBalanceSchema.methods.getYearsOfService = function() {
  const now = new Date();
  const hire = new Date(this.hireDate);
  const diffMs = now - hire;
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.floor(years * 100) / 100;
};

module.exports = mongoose.model('VacationBalance', VacationBalanceSchema);
