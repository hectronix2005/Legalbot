const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['super_admin', 'admin', 'lawyer', 'requester', 'talento_humano', 'colaboradores']
  },
  // Removido: company directa, ahora se maneja a través de UserCompany
  // company: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Company',
  //   default: null
  // },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);

