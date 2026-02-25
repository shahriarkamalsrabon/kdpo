const mongoose = require('mongoose');

const mfsTransactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['cash_in', 'cash_out', 'send_money', 'receive_money', 'payment', 'b2b'],
    required: true
  },
  mfsAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MFSAccount',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  customerPhone: String,
  customerName: String,
  commission: {
    type: Number,
    default: 0
  },
  netAmount: Number,
  mfsTransactionId: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  handledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String,
  balanceBefore: Number,
  balanceAfter: Number
}, {
  timestamps: true
});

// Calculate net amount before saving
mfsTransactionSchema.pre('save', function(next) {
  // No commission calculation as per requirement
  this.netAmount = this.amount;
  next();
});

module.exports = mongoose.model('MFSTransaction', mfsTransactionSchema);