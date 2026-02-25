const mongoose = require('mongoose');

const handCashSchema = new mongoose.Schema({
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('HandCash', handCashSchema);