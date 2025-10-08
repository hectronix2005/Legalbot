const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  entity_type: {
    type: String,
    required: true
  },
  entity_id: {
    type: String,
    required: true
  },
  description: String
}, {
  timestamps: true
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);

