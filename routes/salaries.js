const express = require('express');
const Salary = require('../models/Salary');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/salaries
// @desc    Get salary records
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { employeeId, month, year, status, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (employeeId) query.employee = employeeId;
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.status = status;

    const salaries = await Salary.find(query)
      .populate('employee', 'name employeeId')
      .populate('processedBy', 'name')
      .populate('payments.paidBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ year: -1, month: -1 });

    const total = await Salary.countDocuments(query);

    res.json({
      salaries,
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

// @route   POST /api/salaries/generate
// @desc    Generate salary for employee
// @access  Private (Admin, Staff)
router.post('/generate', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { employeeId, month, year, bonus = 0, deductions = 0, notes } = req.body;

    // Check if salary already exists
    const existingSalary = await Salary.findOne({
      employee: employeeId,
      month: parseInt(month),
      year: parseInt(year)
    });

    if (existingSalary) {
      return res.status(400).json({ message: 'Salary already generated for this month' });
    }

    // Get employee details
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Calculate attendance for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendanceRecords = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    const workingDays = attendanceRecords.length;
    const totalWorkingHours = attendanceRecords.reduce((sum, record) => sum + (record.netWorkingHours || 0), 0);

    const baseSalary = employee.salary || 0;
    const totalAmount = baseSalary + bonus - deductions;

    const salary = new Salary({
      employee: employeeId,
      month: parseInt(month),
      year: parseInt(year),
      baseSalary,
      workingDays,
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      bonus,
      deductions,
      totalAmount,
      dueAmount: totalAmount,
      notes,
      processedBy: req.user.id
    });

    await salary.save();
    await salary.populate(['employee', 'processedBy']);

    res.status(201).json(salary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/salaries/:id/pay
// @desc    Pay salary
// @access  Private (Admin, Staff)
router.put('/:id/pay', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { amount, notes } = req.body;

    const salary = await Salary.findById(req.params.id);
    if (!salary) {
      return res.status(404).json({ message: 'Salary record not found' });
    }

    const payAmount = parseFloat(amount);
    if (payAmount <= 0 || payAmount > salary.dueAmount) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    // Add payment to history
    salary.payments.push({
      amount: payAmount,
      paidDate: new Date(),
      notes,
      paidBy: req.user.id
    });

    salary.paidAmount += payAmount;
    salary.dueAmount -= payAmount;

    if (salary.dueAmount === 0) {
      salary.status = 'paid';
      salary.paidDate = new Date();
    } else {
      salary.status = 'partial';
    }

    if (notes) salary.notes = notes;

    await salary.save();
    await salary.populate(['employee', 'processedBy', 'payments.paidBy']);

    res.json(salary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/salaries/stats
// @desc    Get salary statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const stats = await Salary.aggregate([
      {
        $group: {
          _id: null,
          totalSalaries: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const monthlyStats = await Salary.aggregate([
      {
        $match: { month: currentMonth, year: currentYear }
      },
      {
        $group: {
          _id: null,
          monthlyTotal: { $sum: '$totalAmount' },
          monthlyPaid: { $sum: '$paidAmount' },
          monthlyDue: { $sum: '$dueAmount' },
          monthlyCount: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overall: stats[0] || { totalSalaries: 0, totalPaid: 0, totalDue: 0, count: 0 },
      monthly: monthlyStats[0] || { monthlyTotal: 0, monthlyPaid: 0, monthlyDue: 0, monthlyCount: 0 }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;