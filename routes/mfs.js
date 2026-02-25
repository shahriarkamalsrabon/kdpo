const express = require('express');
const MFSAccount = require('../models/MFSAccount');
const MFSTransaction = require('../models/MFSTransaction');
const HandCash = require('../models/HandCash');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// ============ HAND CASH ============

// @route   GET /api/mfs/handcash
// @desc    Get hand cash amount
// @access  Private (Admin, Staff)
router.get('/handcash', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    let handCash = await HandCash.findOne();
    if (!handCash) {
      handCash = new HandCash({ amount: 0 });
      await handCash.save();
    }
    res.json({ amount: handCash.amount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/mfs/handcash
// @desc    Update hand cash amount
// @access  Private (Admin, Staff)
router.put('/handcash', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { amount } = req.body;
    let handCash = await HandCash.findOne();
    if (!handCash) {
      handCash = new HandCash({ amount, lastUpdatedBy: req.user.id });
    } else {
      handCash.amount = amount;
      handCash.lastUpdatedBy = req.user.id;
    }
    await handCash.save();
    res.json({ amount: handCash.amount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ MFS ACCOUNTS ============

// @route   GET /api/mfs/accounts
// @desc    Get all MFS accounts
// @access  Private (Admin, Staff)
router.get('/accounts', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const accounts = await MFSAccount.find().sort({ provider: 1, accountType: 1 });
    res.json(accounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/mfs/accounts
// @desc    Create MFS account
// @access  Private (Admin only)
router.post('/accounts', auth, authorize('admin'), async (req, res) => {
  try {
    const account = new MFSAccount(req.body);
    await account.save();
    res.status(201).json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/mfs/accounts/:id
// @desc    Update MFS account
// @access  Private (Admin only)
router.put('/accounts/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const account = await MFSAccount.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ MFS TRANSACTIONS ============

// @route   GET /api/mfs/transactions
// @desc    Get MFS transactions
// @access  Private (Admin, Staff)
router.get('/transactions', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { type, provider, status, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (type) query.transactionType = type;
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await MFSTransaction.find(query)
      .populate('mfsAccount', 'provider accountType accountNumber accountName')
      .populate('handledBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Filter by provider if specified
    let filteredTransactions = transactions;
    if (provider) {
      filteredTransactions = transactions.filter(t => t.mfsAccount.provider === provider);
    }

    res.json(filteredTransactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/mfs/transactions
// @desc    Create MFS transaction (Cash In/Out/Send/Receive/Payment/B2B)
// @access  Private (Admin, Staff)
router.post('/transactions', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { mfsAccount: accountId, amount, transactionType } = req.body;
    
    // Get account and update balance
    const account = await MFSAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: 'MFS Account not found' });
    }

    if (!account.isActive) {
      return res.status(400).json({ message: 'Account is inactive' });
    }

    const transaction = new MFSTransaction({
      ...req.body,
      handledBy: req.user.id,
      balanceBefore: account.balance,
      commission: 0 // No commission as per requirement
    });

    // Update account balance based on transaction type
    if (transactionType === 'cash_out') {
      // Agent account increases, hand cash decreases
      account.balance += amount;
    } else if (transactionType === 'cash_in') {
      // Agent account decreases, hand cash increases
      if (account.balance < amount) {
        return res.status(400).json({ message: 'Insufficient account balance' });
      }
      account.balance -= amount;
    } else if (transactionType === 'b2b') {
      // Agent account decreases, hand cash increases
      if (account.balance < amount) {
        return res.status(400).json({ message: 'Insufficient account balance' });
      }
      account.balance -= amount;
    } else if (transactionType === 'send_money') {
      // Personal account decreases, hand cash increases
      if (account.balance < amount) {
        return res.status(400).json({ message: 'Insufficient account balance' });
      }
      account.balance -= amount;
    } else if (transactionType === 'receive_money') {
      // Personal account increases, hand cash decreases
      account.balance += amount;
    } else if (transactionType === 'payment') {
      // Personal account decreases, hand cash increases
      if (account.balance < amount) {
        return res.status(400).json({ message: 'Insufficient account balance' });
      }
      account.balance -= amount;
    }

    transaction.balanceAfter = account.balance;
    
    await transaction.save();
    await account.save();
    
    await transaction.populate([
      { path: 'mfsAccount', select: 'provider accountType accountNumber accountName' },
      { path: 'handledBy', select: 'name' }
    ]);

    res.status(201).json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/mfs/stats
// @desc    Get MFS statistics
// @access  Private (Admin, Staff)
router.get('/stats', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's stats
    const todayStats = await MFSTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$transactionType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCommission: { $sum: '$commission' }
        }
      }
    ]);

    // Monthly stats
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyStats = await MFSTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: monthStart },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$transactionType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCommission: { $sum: '$commission' }
        }
      }
    ]);

    // Account balances
    const accounts = await MFSAccount.find({ isActive: true }, 'provider accountType balance');

    res.json({
      todayStats,
      monthlyStats,
      accounts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;