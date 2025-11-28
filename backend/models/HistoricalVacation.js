/**
 * HistoricalVacation Model
 *
 * Modelo para registrar vacaciones históricas disfrutadas antes de la
 * implementación del sistema. Permite cargar el historial de vacaciones
 * de empleados que ya han disfrutado días previos.
 *
 * Según legislación colombiana (CST Art. 186):
 * - 15 días hábiles de vacaciones por cada año de servicio
 * - Se deben registrar las vacaciones disfrutadas históricamente
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HistoricalVacationSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Período de vacaciones (año de servicio al que corresponden)
  servicePeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  // Días disfrutados en este período
  daysEnjoyed: {
    type: Number,
    required: true,
    min: 0.5
  },
  // Fecha en que se disfrutaron las vacaciones
  enjoyedStartDate: {
    type: Date,
    required: true
  },
  enjoyedEndDate: {
    type: Date,
    required: true
  },
  // Tipo de registro
  type: {
    type: String,
    enum: [
      'historical',           // Cargado manualmente como histórico
      'imported',             // Importado de otro sistema
      'adjustment',           // Ajuste por corrección
      'compensation'          // Compensación en dinero (liquidación parcial)
    ],
    default: 'historical'
  },
  // Documento de soporte (número de resolución, acta, etc.)
  supportDocument: {
    type: String,
    default: null
  },
  // Notas/Observaciones
  notes: {
    type: String,
    default: null
  },
  // Quién registró
  registeredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  // Si fue verificado por TH
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
HistoricalVacationSchema.index({ employeeId: 1, companyId: 1 });
HistoricalVacationSchema.index({ companyId: 1, registeredAt: -1 });
HistoricalVacationSchema.index({ employeeId: 1, 'servicePeriod.startDate': 1 });

// Validación: endDate debe ser posterior a startDate
HistoricalVacationSchema.pre('validate', function(next) {
  if (this.enjoyedEndDate && this.enjoyedStartDate && this.enjoyedEndDate < this.enjoyedStartDate) {
    const error = new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    error.name = 'ValidationError';
    return next(error);
  }
  next();
});

// Static: Obtener total de días históricos de un empleado
HistoricalVacationSchema.statics.getTotalHistoricalDays = async function(employeeId, companyId) {
  const result = await this.aggregate([
    {
      $match: {
        employeeId: new mongoose.Types.ObjectId(employeeId),
        companyId: new mongoose.Types.ObjectId(companyId)
      }
    },
    {
      $group: {
        _id: null,
        totalDays: { $sum: '$daysEnjoyed' },
        count: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { totalDays: 0, count: 0 };
};

// Static: Obtener historial por período de servicio
HistoricalVacationSchema.statics.getByServicePeriod = async function(employeeId, companyId, year) {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  return this.find({
    employeeId,
    companyId,
    'servicePeriod.startDate': { $gte: startOfYear, $lte: endOfYear }
  })
  .populate('registeredBy', 'name email')
  .populate('verifiedBy', 'name email')
  .sort({ enjoyedStartDate: -1 });
};

// Static: Obtener resumen por empleado
HistoricalVacationSchema.statics.getEmployeeSummary = async function(employeeId, companyId) {
  const records = await this.find({ employeeId, companyId })
    .populate('registeredBy', 'name email')
    .populate('verifiedBy', 'name email')
    .sort({ enjoyedStartDate: -1 });

  const totalDays = records.reduce((sum, r) => sum + r.daysEnjoyed, 0);
  const verifiedDays = records.filter(r => r.isVerified).reduce((sum, r) => sum + r.daysEnjoyed, 0);
  const pendingVerification = records.filter(r => !r.isVerified);

  return {
    records,
    summary: {
      totalRecords: records.length,
      totalDays,
      verifiedDays,
      pendingVerificationDays: totalDays - verifiedDays,
      pendingVerificationCount: pendingVerification.length
    }
  };
};

module.exports = mongoose.model('HistoricalVacation', HistoricalVacationSchema);
