const mongoose = require('mongoose');

const contractCounterSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  counter: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índice único para company + year
contractCounterSchema.index({ company: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('ContractCounter', contractCounterSchema);
