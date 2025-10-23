const mongoose = require('mongoose');

const documentVersionSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true
  },
  version: {
    type: Number,
    required: true,
    default: 1
  },
  content: {
    type: String,
    required: true
  },
  word_file_path: {
    type: String,
    required: false
  },
  pdf_file_path: {
    type: String,
    required: false
  },
  editable_content: {
    type: String,
    required: false
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  change_description: {
    type: String,
    default: 'Versión inicial'
  },
  is_current: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice para búsquedas eficientes
documentVersionSchema.index({ contract: 1, version: -1 });
documentVersionSchema.index({ contract: 1, is_current: 1 });

module.exports = mongoose.model('DocumentVersion', documentVersionSchema);
