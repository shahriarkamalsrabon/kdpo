const mongoose = require('mongoose');

const mfsAccountSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['bkash', 'nagad', 'rocket', 'upay', 'cellfin', 'mcash', 'handcash'],
    required: true
  },
  accountType: {
    type: String,
    enum: ['personal', 'agent', 'merchant'],
    required: true
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true
  },
  accountName: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  commission: {
    cashIn: {
      type: Number,
      default: 0 // Commission per transaction
    },
    cashOut: {
      type: Number,
      default: 0
    }
  },
  limits: {
    dailyLimit: {
      type: Number,
      default: 100000
    },
    perTransactionLimit: {
      type: Number,
      default: 25000
    }
  },
  notes: String
}, {
  timestamps: true
});

module.exports = mongoose.model('MFSAccount', mfsAccountSchema);