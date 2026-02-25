const express = require('express');
const User = require('../models/User');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Transaction = require('../models/Transaction');
const ServiceSale = require('../models/ServiceSale');
const StudentFee = require('../models/StudentFee');
const MFSTransaction = require('../models/MFSTransaction');
const MFSAccount = require('../models/MFSAccount');
const HandCash = require('../models/HandCash');
const Salary = require('../models/Salary');
const Registration = require('../models/Registration');
const Attendance = require('../models/Attendance');
const Service = require('../models/Service');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/reports/dashboard
// @desc    Get comprehensive dashboard statistics
// @access  Private (Admin, Staff)
router.get('/dashboard', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));

    // User counts
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalTeachers = await User.countDocuments({ role: 'teacher', isActive: true });
    const totalStaff = await User.countDocuments({ role: 'staff', isActive: true });

    // Course and batch counts
    const totalCourses = await Course.countDocuments({ isActive: true });
    const totalBatches = await Batch.countDocuments({ isActive: true });

    // Revenue from all sources - TODAY
    const [todayServiceRevenue, todayStudentFees, todayMFSRevenue] = await Promise.all([
      ServiceSale.aggregate([{ $match: { createdAt: { $gte: startOfDay }, paymentStatus: { $in: ['paid', 'partial'] } } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
      StudentFee.aggregate([{ $unwind: '$payments' }, { $match: { 'payments.paymentDate': { $gte: startOfDay } } }, { $group: { _id: null, total: { $sum: '$payments.amount' } } }]),
      MFSTransaction.aggregate([{ $match: { createdAt: { $gte: startOfDay }, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$commission' } } }])
    ]);

    // Revenue from all sources - MONTHLY
    const [monthlyServiceRevenue, monthlyStudentFees, monthlyMFSRevenue] = await Promise.all([
      ServiceSale.aggregate([{ $match: { createdAt: { $gte: startOfMonth }, paymentStatus: { $in: ['paid', 'partial'] } } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
      StudentFee.aggregate([{ $unwind: '$payments' }, { $match: { 'payments.paymentDate': { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$payments.amount' } } }]),
      MFSTransaction.aggregate([{ $match: { createdAt: { $gte: startOfMonth }, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$commission' } } }])
    ]);

    const todayRevenue = (todayServiceRevenue[0]?.total || 0) + (todayStudentFees[0]?.total || 0) + (todayMFSRevenue[0]?.total || 0);
    const monthlyRevenue = (monthlyServiceRevenue[0]?.total || 0) + (monthlyStudentFees[0]?.total || 0) + (monthlyMFSRevenue[0]?.total || 0);

    // Expenses
    const monthlyExpenses = await Transaction.aggregate([{ $match: { createdAt: { $gte: startOfMonth }, type: 'expense' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const monthlySalaries = await Salary.aggregate([{ $match: { year: today.getFullYear(), month: today.getMonth() + 1 } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]);

    // Registration stats
    const pendingRegistrations = await Registration.countDocuments({ status: 'pending' });
    const monthlyRegistrations = await Registration.countDocuments({ createdAt: { $gte: startOfMonth } });

    // MFS stats
    const mfsAccounts = await MFSAccount.find({ isActive: true });
    const totalMFSBalance = mfsAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const handCash = await HandCash.findOne().sort({ createdAt: -1 });

    // Recent transactions from all sources
    const recentTransactions = await Transaction.find()
      .populate('customerRef', 'name phone')
      .populate('handledBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      userStats: { totalStudents, totalTeachers, totalStaff },
      courseStats: { totalCourses, totalBatches },
      revenueStats: { todayRevenue, monthlyRevenue },
      expenseStats: { monthlyExpenses: monthlyExpenses[0]?.total || 0, monthlySalaries: monthlySalaries[0]?.total || 0 },
      registrationStats: { pendingRegistrations, monthlyRegistrations },
      mfsStats: { totalMFSBalance, handCash: handCash?.amount || 0, activeAccounts: mfsAccounts.length },
      recentTransactions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/revenue
// @desc    Get revenue report
// @access  Private (Admin, Staff)
router.get('/revenue', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    let matchQuery = { status: 'completed' };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    let groupFormat;
    switch (groupBy) {
      case 'month':
        groupFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        break;
      case 'week':
        groupFormat = { $dateToString: { format: "%Y-W%U", date: "$createdAt" } };
        break;
      default:
        groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    }

    const revenueData = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupFormat,
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          serviceRevenue: {
            $sum: {
              $cond: [{ $eq: ['$type', 'service_sale'] }, '$amount', 0]
            }
          },
          courseFeeRevenue: {
            $sum: {
              $cond: [{ $eq: ['$type', 'course_fee'] }, '$amount', 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(revenueData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/students
// @desc    Get student enrollment report
// @access  Private (Admin, Staff)
router.get('/students', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let matchQuery = { role: 'student' };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const enrollmentData = await User.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          newEnrollments: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const batchWiseStudents = await Batch.aggregate([
      {
        $lookup: {
          from: 'courses',
          localField: 'course',
          foreignField: '_id',
          as: 'courseInfo'
        }
      },
      {
        $project: {
          name: 1,
          courseName: { $arrayElemAt: ['$courseInfo.name', 0] },
          studentCount: { $size: '$students' },
          maxStudents: 1
        }
      }
    ]);

    res.json({
      enrollmentTrend: enrollmentData,
      batchWiseStudents
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/analytics
// @desc    Get comprehensive analytics
// @access  Private (Admin, Staff)
router.get('/analytics', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Service Sales Revenue
    const serviceRevenue = await ServiceSale.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: '$paidAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Student Fee Revenue
    const studentFeeRevenue = await StudentFee.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.paymentDate': { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$payments.paymentDate" } }, revenue: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // MFS Commission Revenue
    const mfsRevenue = await MFSTransaction.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: 'completed' } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: '$commission' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Expenses
    const expenses = await Transaction.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, type: 'expense' } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Salaries
    const salaries = await Salary.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, amount: { $sum: '$paidAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Service Performance
    const servicePerformance = await ServiceSale.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$serviceName', revenue: { $sum: '$paidAmount' }, quantity: { $sum: '$quantity' }, transactions: { $sum: 1 } } },
      { $sort: { revenue: -1 } }
    ]);

    // Registration Analytics
    const registrationStats = await Registration.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, status: '$status' }, count: { $sum: 1 } } },
      { $sort: { '_id.date': 1 } }
    ]);

    // MFS Analytics
    const mfsAnalytics = await MFSTransaction.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { type: '$transactionType', date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } }, volume: { $sum: '$amount' }, commission: { $sum: '$commission' }, count: { $sum: 1 } } },
      { $sort: { '_id.date': 1 } }
    ]);

    res.json({
      financial: { serviceRevenue, studentFeeRevenue, mfsRevenue, expenses, salaries },
      servicePerformance,
      registrationStats,
      mfsAnalytics
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/comparison
// @desc    Get comparative analytics
// @access  Private (Admin, Staff)
router.get('/comparison', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const today = new Date();
    const thisMonth = { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date() };
    const lastMonth = { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 0) };

    const getRevenue = async (start, end) => {
      const [service, student, mfs] = await Promise.all([
        ServiceSale.aggregate([{ $match: { createdAt: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
        StudentFee.aggregate([{ $unwind: '$payments' }, { $match: { 'payments.paymentDate': { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$payments.amount' } } }]),
        MFSTransaction.aggregate([{ $match: { createdAt: { $gte: start, $lte: end }, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$commission' } } }])
      ]);
      return (service[0]?.total || 0) + (student[0]?.total || 0) + (mfs[0]?.total || 0);
    };

    const thisMonthRevenue = await getRevenue(thisMonth.start, thisMonth.end);
    const lastMonthRevenue = await getRevenue(lastMonth.start, lastMonth.end);
    const growth = lastMonthRevenue ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;

    const thisMonthStudents = await User.countDocuments({ role: 'student', createdAt: { $gte: thisMonth.start, $lte: thisMonth.end } });
    const lastMonthStudents = await User.countDocuments({ role: 'student', createdAt: { $gte: lastMonth.start, $lte: lastMonth.end } });
    const studentGrowth = lastMonthStudents ? ((thisMonthStudents - lastMonthStudents) / lastMonthStudents * 100) : 0;

    res.json({
      revenue: { thisMonth: thisMonthRevenue, lastMonth: lastMonthRevenue, growth },
      students: { thisMonth: thisMonthStudents, lastMonth: lastMonthStudents, growth: studentGrowth }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/advanced-analytics
// @desc    Get advanced analytics with predictions and insights
// @access  Private (Admin, Staff)
router.get('/advanced-analytics', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { period = '6months' } = req.query;
    const today = new Date();
    const monthsBack = period === '1year' ? 12 : 6;
    const startDate = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);

    // Revenue Trend Analysis
    const revenueByMonth = await Promise.all([
      ServiceSale.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: '$paidAmount' } } },
        { $sort: { _id: 1 } }
      ]),
      StudentFee.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.paymentDate': { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$payments.paymentDate" } }, revenue: { $sum: '$payments.amount' } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Service Profitability Analysis
    const serviceProfitability = await ServiceSale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'serviceInfo' } },
      { $group: {
        _id: '$serviceName',
        totalRevenue: { $sum: '$paidAmount' },
        totalQuantity: { $sum: '$quantity' },
        avgPrice: { $avg: '$unitPrice' },
        transactions: { $sum: 1 },
        profitMargin: { $avg: { $subtract: ['$unitPrice', { $multiply: ['$unitPrice', 0.3] }] } }
      }},
      { $sort: { totalRevenue: -1 } }
    ]);

    // Student Journey Analytics
    const studentJourney = await Registration.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: {
          $avg: {
            $cond: [
              { $ne: ['$reviewedAt', null] },
              { $subtract: ['$reviewedAt', '$createdAt'] },
              null
            ]
          }
        }
      }}
    ]);

    // Staff Performance Rankings
    const staffPerformance = await Attendance.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $lookup: { from: 'users', localField: 'employee', foreignField: '_id', as: 'employeeInfo' } },
      { $group: {
        _id: '$employee',
        name: { $first: { $arrayElemAt: ['$employeeInfo.name', 0] } },
        totalHours: { $sum: '$netWorkingHours' },
        avgDailyHours: { $avg: '$netWorkingHours' },
        daysWorked: { $sum: 1 },
        efficiency: { $avg: { $divide: ['$netWorkingHours', 8] } }
      }},
      { $sort: { efficiency: -1 } }
    ]);

    // Revenue Prediction (Simple linear regression)
    const last3Months = revenueByMonth[0].slice(-3);
    const avgGrowth = last3Months.length > 1 ? 
      (last3Months[last3Months.length - 1].revenue - last3Months[0].revenue) / (last3Months.length - 1) : 0;
    const nextMonthPrediction = last3Months.length > 0 ? 
      last3Months[last3Months.length - 1].revenue + avgGrowth : 0;

    // Key Performance Indicators
    const kpis = {
      revenueGrowthRate: avgGrowth,
      customerAcquisitionRate: await User.countDocuments({ role: 'student', createdAt: { $gte: new Date(today.getFullYear(), today.getMonth(), 1) } }),
      averageTransactionValue: serviceProfitability.reduce((sum, s) => sum + s.avgPrice, 0) / serviceProfitability.length,
      staffUtilization: staffPerformance.reduce((sum, s) => sum + s.efficiency, 0) / staffPerformance.length
    };

    res.json({
      revenueByMonth,
      serviceProfitability,
      studentJourney,
      staffPerformance,
      predictions: { nextMonthRevenue: nextMonthPrediction, growthRate: avgGrowth },
      kpis
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/real-time
// @desc    Get real-time metrics
// @access  Private (Admin, Staff)
router.get('/real-time', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [todayStats, hourlyRevenue, activeUsers, recentActivity] = await Promise.all([
      // Today's key metrics
      Promise.all([
        ServiceSale.countDocuments({ createdAt: { $gte: startOfDay } }),
        ServiceSale.aggregate([{ $match: { createdAt: { $gte: startOfDay } } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
        User.countDocuments({ role: 'student', createdAt: { $gte: startOfDay } }),
        Registration.countDocuments({ createdAt: { $gte: startOfDay } })
      ]),
      // Hourly revenue for last 24 hours
      ServiceSale.aggregate([
        { $match: { createdAt: { $gte: last24Hours } } },
        { $group: {
          _id: { $hour: '$createdAt' },
          revenue: { $sum: '$paidAmount' },
          transactions: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      // Currently active users (checked in today)
      Attendance.countDocuments({ date: { $gte: startOfDay }, checkOut: null }),
      // Recent activity
      Transaction.find({ createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } })
        .populate('handledBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    res.json({
      todayStats: {
        transactions: todayStats[0],
        revenue: todayStats[1][0]?.total || 0,
        newStudents: todayStats[2],
        newRegistrations: todayStats[3]
      },
      hourlyRevenue,
      activeUsers,
      recentActivity
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;