const express = require('express');
const Transaction = require('../models/Transaction');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/transactions/stats
// @desc    Get transaction statistics
// @access  Private (Admin, Staff)
router.get('/stats', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Monthly stats
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: monthStart }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Total balance
    const totalStats = await Transaction.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const formatStats = (stats) => {
      const revenue = stats.find(s => s._id === 'revenue')?.total || 0;
      const expense = stats.find(s => s._id === 'expense')?.total || 0;
      return { revenue, expense, balance: revenue - expense };
    };

    res.json({
      today: formatStats(todayStats),
      monthly: formatStats(monthlyStats),
      total: formatStats(totalStats)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/transactions
// @desc    Get all transactions
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { type, category, paymentMethod, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (type) query.type = type;
    if (category) query.category = new RegExp(category, 'i');
    if (paymentMethod) query.paymentMethod = paymentMethod;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .populate('handledBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/transactions
// @desc    Create transaction
// @access  Private (Admin, Staff)
router.post('/', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const transaction = new Transaction({
      ...req.body,
      handledBy: req.user.id
    });

    await transaction.save();
    await transaction.populate('handledBy', 'name');

    res.status(201).json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Update transaction
// @access  Private (Admin, Staff)
router.put('/:id', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('handledBy', 'name');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Delete transaction
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;