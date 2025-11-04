const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    description: 'Texto de la pregunta'
  },
  field_name: {
    type: String,
    required: true,
    description: 'Nombre del campo para almacenar la respuesta'
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'textarea', 'number', 'date', 'select', 'multiselect', 'checkbox', 'radio', 'email', 'phone'],
    description: 'Tipo de campo de entrada'
  },
  options: {
    type: [String],
    default: [],
    description: 'Opciones para campos select, multiselect, radio'
  },
  required: {
    type: Boolean,
    default: true,
    description: 'Indica si la pregunta es obligatoria'
  },
  placeholder: {
    type: String,
    description: 'Texto placeholder para el campo'
  },
  help_text: {
    type: String,
    description: 'Texto de ayuda para el usuario'
  },
  validation: {
    min: Number,
    max: Number,
    pattern: String
  },
  order: {
    type: Number,
    required: true,
    description: 'Orden de la pregunta en el cuestionario'
  }
}, { _id: false });

const contractCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    description: 'Nombre de la categoría (ej: Contrato Laboral, NDA, Contrato Comercial)'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    description: 'Descripción de la categoría'
  },
  icon: {
    type: String,
    default: 'document',
    description: 'Icono para la UI (nombre del icono)'
  },
  color: {
    type: String,
    default: '#3B82F6',
    description: 'Color hexadecimal para la categoría'
  },

  // Cuestionario dinámico
  questionnaire: {
    type: [questionSchema],
    default: [],
    description: 'Preguntas del cuestionario para esta categoría'
  },

  // Relación con plantilla de contrato
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractTemplate',
    description: 'Plantilla de contrato asociada a esta categoría'
  },

  // Multi-tenant
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
    description: 'Empresa a la que pertenece la categoría'
  },

  // Estado
  active: {
    type: Boolean,
    default: true,
    description: 'Indica si la categoría está activa'
  },

  // Configuración adicional
  requires_approval: {
    type: Boolean,
    default: true,
    description: 'Indica si las solicitudes de esta categoría requieren aprobación'
  },

  auto_assign_lawyer: {
    type: Boolean,
    default: false,
    description: 'Asignar automáticamente un abogado disponible'
  },

  // Metadatos
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'Usuario que creó la categoría'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Usuario que actualizó la categoría por última vez'
  }
}, {
  timestamps: true
});

// Índices
contractCategorySchema.index({ company: 1, active: 1 });
contractCategorySchema.index({ company: 1, name: 1 }, { unique: true });

// Método para validar respuestas del cuestionario
contractCategorySchema.methods.validateAnswers = function(answers) {
  const errors = [];

  this.questionnaire.forEach(question => {
    const answer = answers[question.field_name];

    // Validar campos requeridos
    if (question.required && (!answer || answer === '')) {
      errors.push({
        field: question.field_name,
        message: `${question.question} es obligatorio`
      });
    }

    // Validar tipo de dato
    if (answer) {
      if (question.type === 'number' && isNaN(answer)) {
        errors.push({
          field: question.field_name,
          message: `${question.question} debe ser un número`
        });
      }

      if (question.type === 'email' && !answer.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push({
          field: question.field_name,
          message: `${question.question} debe ser un email válido`
        });
      }

      // Validar opciones para select/multiselect
      if ((question.type === 'select' || question.type === 'radio') &&
          question.options.length > 0 &&
          !question.options.includes(answer)) {
        errors.push({
          field: question.field_name,
          message: `${question.question} debe ser una opción válida`
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = mongoose.model('ContractCategory', contractCategorySchema);
