const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VacationRequestSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  requestedDays: {
    type: Number,
    required: true,
    min: 0.5
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  // Estados con flujo de doble aprobación según legislación colombiana
  status: {
    type: String,
    enum: [
      'requested',           // Solicitada por empleado
      'leader_approved',     // Aprobada por líder/jefe inmediato
      'leader_rejected',     // Rechazada por líder
      'hr_approved',         // Aprobada por Talento Humano (aprobación final)
      'hr_rejected',         // Rechazada por Talento Humano
      'scheduled',           // Programada
      'enjoyed',             // Disfrutada
      'cancelled'            // Cancelada
    ],
    default: 'requested',
    index: true
  },
  // Aprobación del líder/jefe inmediato
  leaderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  leaderApprovalDate: {
    type: Date,
    default: null
  },
  leaderComments: {
    type: String,
    default: null
  },
  // Aprobación de Talento Humano
  hrApproverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  hrApprovalDate: {
    type: Date,
    default: null
  },
  hrComments: {
    type: String,
    default: null
  },
  // Campo legacy para compatibilidad
  approverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvalDate: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  rejectedBy: {
    type: String,
    enum: ['leader', 'hr', null],
    default: null
  },
  enjoyedDate: {
    type: Date,
    default: null
  },
  // Observaciones del empleado
  employeeNotes: {
    type: String,
    default: null,
    maxlength: 500
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

// Compound indexes for efficient queries
VacationRequestSchema.index({ employeeId: 1, status: 1, companyId: 1 });
VacationRequestSchema.index({ companyId: 1, status: 1, requestDate: -1 });
VacationRequestSchema.index({ startDate: 1, endDate: 1, status: 1 });

// Validation: endDate must be after startDate
VacationRequestSchema.pre('validate', function(next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    const error = new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    error.name = 'ValidationError';
    return next(error);
  }
  next();
});

// Virtual to check if request is pending approval
VacationRequestSchema.virtual('isPending').get(function() {
  return this.status === 'requested';
});

// Virtual to check if request is active
VacationRequestSchema.virtual('isActive').get(function() {
  return ['requested', 'approved', 'scheduled'].includes(this.status);
});

// Method to check if request can be cancelled
VacationRequestSchema.methods.canBeCancelled = function() {
  return ['requested', 'approved', 'scheduled'].includes(this.status);
};

// Method to check if request can be approved by leader
VacationRequestSchema.methods.canBeApprovedByLeader = function() {
  return this.status === 'requested';
};

// Method to check if request can be approved by HR
VacationRequestSchema.methods.canBeApprovedByHR = function() {
  return this.status === 'leader_approved';
};

// Method to check if request can be approved (legacy compatibility)
VacationRequestSchema.methods.canBeApproved = function() {
  return this.status === 'requested' || this.status === 'leader_approved';
};

// Method to check if request can be enjoyed
VacationRequestSchema.methods.canBeEnjoyed = function() {
  const now = new Date();
  return (this.status === 'scheduled' || this.status === 'hr_approved') && now >= this.startDate;
};

// Method to check current approval stage
VacationRequestSchema.methods.getApprovalStage = function() {
  switch (this.status) {
    case 'requested':
      return { stage: 'leader', description: 'Pendiente aprobación del líder' };
    case 'leader_approved':
      return { stage: 'hr', description: 'Pendiente aprobación de Talento Humano' };
    case 'hr_approved':
    case 'scheduled':
      return { stage: 'complete', description: 'Completamente aprobada' };
    case 'leader_rejected':
    case 'hr_rejected':
      return { stage: 'rejected', description: 'Rechazada' };
    case 'enjoyed':
      return { stage: 'finished', description: 'Disfrutada' };
    case 'cancelled':
      return { stage: 'cancelled', description: 'Cancelada' };
    default:
      return { stage: 'unknown', description: 'Estado desconocido' };
  }
};

// Pre-save hook
VacationRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('VacationRequest', VacationRequestSchema);
