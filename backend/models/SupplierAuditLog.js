const mongoose = require('mongoose');

/**
 * Modelo de Auditoría de Terceros
 *
 * Registra TODOS los cambios realizados a terceros para:
 * - Rastrear quién hizo qué y cuándo
 * - Recuperar datos en caso de pérdida
 * - Cumplir con requisitos de auditoría
 * - Detectar patrones sospechosos
 */

const supplierAuditLogSchema = new mongoose.Schema({
  // Tercero afectado
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
    index: true,
    description: 'Tercero al que pertenece este registro de auditoría'
  },

  // Tipo de operación
  operation: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'BULK_DELETE', 'APPROVE', 'REJECT'],
    index: true,
    description: 'Tipo de operación realizada'
  },

  // Usuario que realizó la operación
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    description: 'Usuario que realizó la operación'
  },

  // Empresa
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
    description: 'Empresa a la que pertenece el tercero'
  },

  // Estado anterior (snapshot antes del cambio)
  stateBefore: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Snapshot completo del estado anterior'
  },

  // Estado posterior (snapshot después del cambio)
  stateAfter: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Snapshot completo del estado posterior'
  },

  // Campos modificados
  changedFields: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],

  // Metadatos de la operación
  ipAddress: {
    type: String,
    description: 'Dirección IP desde donde se realizó la operación'
  },

  userAgent: {
    type: String,
    description: 'User agent del navegador'
  },

  reason: {
    type: String,
    description: 'Razón proporcionada para la operación (especialmente para DELETE)'
  },

  // Información adicional
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Información adicional relevante'
  },

  // Sistema de alertas
  isSuspicious: {
    type: Boolean,
    default: false,
    description: 'Si la operación fue marcada como sospechosa'
  },

  suspiciousReason: {
    type: String,
    description: 'Razón por la que se marcó como sospechosa'
  }

}, {
  timestamps: true // Agrega createdAt y updatedAt automáticamente
});

// Índices compuestos para queries comunes
supplierAuditLogSchema.index({ company: 1, createdAt: -1 });
supplierAuditLogSchema.index({ supplier: 1, createdAt: -1 });
supplierAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
supplierAuditLogSchema.index({ operation: 1, createdAt: -1 });
supplierAuditLogSchema.index({ isSuspicious: 1 });

// Método estático para crear un log de auditoría
supplierAuditLogSchema.statics.logOperation = async function(data) {
  const {
    supplier,
    operation,
    performedBy,
    company,
    stateBefore = null,
    stateAfter = null,
    ipAddress = null,
    userAgent = null,
    reason = null,
    metadata = {}
  } = data;

  // Calcular campos modificados
  const changedFields = [];
  if (stateBefore && stateAfter) {
    const beforeObj = stateBefore.toObject ? stateBefore.toObject() : stateBefore;
    const afterObj = stateAfter.toObject ? stateAfter.toObject() : stateAfter;

    Object.keys(afterObj).forEach(key => {
      if (key === '_id' || key === '__v' || key === 'createdAt' || key === 'updatedAt') {
        return; // Ignorar campos meta
      }

      const oldValue = beforeObj[key];
      const newValue = afterObj[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changedFields.push({
          field: key,
          oldValue,
          newValue
        });
      }
    });
  }

  // Detectar operaciones sospechosas
  let isSuspicious = false;
  let suspiciousReason = null;

  // Regla 1: Múltiples eliminaciones en poco tiempo
  if (operation === 'DELETE' || operation === 'BULK_DELETE') {
    const recentDeletes = await this.countDocuments({
      performedBy,
      operation: { $in: ['DELETE', 'BULK_DELETE'] },
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Últimos 5 minutos
    });

    if (recentDeletes >= 5) {
      isSuspicious = true;
      suspiciousReason = `Usuario ha eliminado ${recentDeletes + 1} terceros en los últimos 5 minutos`;
    }
  }

  const auditLog = await this.create({
    supplier: supplier._id || supplier,
    operation,
    performedBy,
    company,
    stateBefore: stateBefore ? (stateBefore.toObject ? stateBefore.toObject() : stateBefore) : null,
    stateAfter: stateAfter ? (stateAfter.toObject ? stateAfter.toObject() : stateAfter) : null,
    changedFields,
    ipAddress,
    userAgent,
    reason,
    metadata,
    isSuspicious,
    suspiciousReason
  });

  // Log de alertas sospechosas
  if (isSuspicious) {
    console.warn(`⚠️  OPERACIÓN SOSPECHOSA DETECTADA:`);
    console.warn(`   Usuario: ${performedBy}`);
    console.warn(`   Operación: ${operation}`);
    console.warn(`   Razón: ${suspiciousReason}`);
  }

  return auditLog;
};

// Método estático para obtener historial de un tercero
supplierAuditLogSchema.statics.getSupplierHistory = async function(supplierId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    includeDeleted = true
  } = options;

  return await this.find({ supplier: supplierId })
    .populate('performedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Método estático para obtener operaciones sospechosas
supplierAuditLogSchema.statics.getSuspiciousOperations = async function(options = {}) {
  const {
    limit = 100,
    since = new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas por defecto
  } = options;

  return await this.find({
    isSuspicious: true,
    createdAt: { $gte: since }
  })
  .populate('performedBy', 'name email role')
  .populate('supplier', 'legal_name identification_number')
  .populate('company', 'name')
  .sort({ createdAt: -1 })
  .limit(limit);
};

const SupplierAuditLog = mongoose.model('SupplierAuditLog', supplierAuditLogSchema);

module.exports = SupplierAuditLog;
