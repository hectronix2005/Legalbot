const mongoose = require('mongoose');

const contractRequestSchema = new mongoose.Schema({
  // Categoría del contrato (NUEVO)
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractCategory',
    required: true,
    description: 'Categoría del contrato solicitado'
  },

  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractTemplate',
    required: false,
    description: 'Plantilla asignada (puede ser null, se asigna al aprobar)'
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in_review', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },

  // Respuestas del cuestionario (NUEVO)
  questionnaire_answers: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Respuestas al cuestionario de la categoría'
  },

  field_data: {
    type: Map,
    of: String,
    required: false,
    default: {}
  },
  assigned_lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assigned_at: {
    type: Date,
    description: 'Fecha de asignación al abogado'
  },
  legal_notes: String,
  rejection_reason: String,
  reviewed_at: Date,

  // Contrato generado
  generated_contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    description: 'Contrato generado cuando se aprueba la solicitud'
  },

  // Prioridad
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    description: 'Prioridad de la solicitud'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ContractRequest', contractRequestSchema);

