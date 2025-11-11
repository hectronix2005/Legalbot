const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  // Información básica del proveedor
  identification_type: {
    type: String,
    required: true,
    enum: ['NIT', 'CC', 'CE', 'Pasaporte', 'RUT', 'Otro'],
    description: 'Tipo de identificación del proveedor'
  },
  identification_number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    description: 'Número de identificación del proveedor'
  },
  id_issue_city: {
    type: String,
    trim: true,
    description: 'Ciudad de expedición del documento de identificación'
  },
  legal_name: {
    type: String,
    trim: true,
    description: 'Razón social completa del proveedor (para empresas) / Nombre completo (para personas naturales)'
  },
  legal_name_short: {
    type: String,
    trim: true,
    description: 'Razón social abreviada (solo para empresas)'
  },

  // Información del representante legal (solo para empresas)
  legal_representative_name: {
    type: String,
    trim: true,
    description: 'Nombre completo del representante legal (solo para empresas)'
  },
  legal_representative_id_type: {
    type: String,
    enum: ['CC', 'CE', 'Pasaporte', 'Otro'],
    description: 'Tipo de identificación del representante legal (solo para empresas)'
  },
  legal_representative_id_number: {
    type: String,
    trim: true,
    description: 'Número de identificación del representante legal (solo para empresas)'
  },

  // Nombre completo para personas naturales
  full_name: {
    type: String,
    trim: true,
    description: 'Nombre completo de la persona natural (empleados, clientes personas, etc.)'
  },

  // Información adicional para Propiedad Horizontal
  licensee_name: {
    type: String,
    trim: true,
    description: 'Nombre del Licenciatario (solo para PH)'
  },

  // Información de contacto (opcional)
  email: {
    type: String,
    trim: true,
    lowercase: true,
    description: 'Email de contacto del proveedor'
  },
  phone: {
    type: String,
    trim: true,
    description: 'Teléfono de contacto'
  },
  address: {
    type: String,
    trim: true,
    description: 'Dirección física'
  },
  city: {
    type: String,
    trim: true,
    description: 'Ciudad'
  },
  country: {
    type: String,
    trim: true,
    default: 'Colombia',
    description: 'País'
  },

  // Relación con empresa (multi-tenant)
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
    description: 'Empresa a la que pertenece el proveedor'
  },

  // Tipo de tercero
  third_party_type: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ThirdPartyTypeConfig',
    description: 'Tipo de tercero (proveedor, cliente, empleado, etc.)'
  },

  // Campos personalizados según el tipo de tercero
  custom_fields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Campos adicionales configurados según el tipo de tercero'
  },

  // Estado
  active: {
    type: Boolean,
    default: false,
    description: 'Indica si el proveedor está activo (se activa después de aprobación)'
  },

  // Estado de aprobación (NUEVO)
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    description: 'Estado de aprobación del tercero'
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Abogado que aprobó el tercero'
  },
  approved_at: {
    type: Date,
    description: 'Fecha de aprobación'
  },
  rejection_reason: {
    type: String,
    description: 'Razón del rechazo del tercero'
  },
  rejected_at: {
    type: Date,
    description: 'Fecha de rechazo'
  },

  // Metadatos
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'Usuario que creó el registro'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Usuario que actualizó el registro por última vez'
  }
}, {
  timestamps: true
});

// Índices para mejorar rendimiento
supplierSchema.index({ company: 1, identification_number: 1 }, { unique: true });
supplierSchema.index({ company: 1, active: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
