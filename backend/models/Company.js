const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  tax_id: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: false
  },
  address: String,
  phone: String,
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);

