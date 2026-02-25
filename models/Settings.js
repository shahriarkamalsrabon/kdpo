const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  course3MonthPrice: {
    type: Number,
    default: 3000
  },
  course6MonthPrice: {
    type: Number,
    default: 5000
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);