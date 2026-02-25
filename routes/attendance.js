const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/attendance/checkin
// @desc    Check in employee
// @access  Private
router.post('/checkin', auth, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employee: employeeId || req.user.id,
      date: today
    });

    if (existingAttendance) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    const attendance = new Attendance({
      employee: employeeId || req.user.id,
      date: today,
      checkIn: new Date(),
      status: 'present'
    });

    await attendance.save();
    await attendance.populate('employee', 'name employeeId');

    res.status(201).json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/attendance/checkout
// @desc    Check out employee
// @access  Private
router.put('/checkout', auth, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId || req.user.id,
      date: today
    });

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for today' });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ message: 'Already checked out' });
    }

    attendance.checkOut = new Date();
    attendance.status = 'checked_out';

    // Calculate working hours
    const totalTime = attendance.checkOut - attendance.checkIn;
    const totalBreakTime = attendance.breaks.reduce((total, breakItem) => {
      if (breakItem.breakIn && breakItem.breakOut) {
        return total + (breakItem.breakIn - breakItem.breakOut);
      }
      return total;
    }, 0);

    attendance.totalWorkingHours = Math.round(totalTime / (1000 * 60 * 60) * 100) / 100;
    attendance.totalBreakTime = Math.round(totalBreakTime / (1000 * 60 * 60) * 100) / 100;
    attendance.netWorkingHours = Math.round((totalTime - totalBreakTime) / (1000 * 60 * 60) * 100) / 100;

    await attendance.save();
    await attendance.populate('employee', 'name employeeId');

    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/attendance/break-out
// @desc    Mark break start
// @access  Private
router.put('/break-out', auth, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId || req.user.id,
      date: today
    });

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for today' });
    }

    if (attendance.status === 'on_break') {
      return res.status(400).json({ message: 'Already on break' });
    }

    attendance.breaks.push({ breakOut: new Date() });
    attendance.status = 'on_break';

    await attendance.save();
    await attendance.populate('employee', 'name employeeId');

    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/attendance/break-in
// @desc    Mark break end
// @access  Private
router.put('/break-in', auth, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId || req.user.id,
      date: today
    });

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for today' });
    }

    if (attendance.status !== 'on_break') {
      return res.status(400).json({ message: 'Not currently on break' });
    }

    // Find the last break without breakIn
    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    if (lastBreak && !lastBreak.breakIn) {
      lastBreak.breakIn = new Date();
      attendance.status = 'present';
    }

    await attendance.save();
    await attendance.populate('employee', 'name employeeId');

    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance
// @desc    Get attendance records
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { employeeId, startDate, endDate, page = 1, limit = 20 } = req.query;

    let query = {};
    if (employeeId) query.employee = employeeId;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(query)
      .populate('employee', 'name employeeId')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 });

    const total = await Attendance.countDocuments(query);

    res.json({
      attendance,
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

// @route   GET /api/attendance/today
// @desc    Get today's attendance status
// @access  Private
router.get('/today', auth, async (req, res) => {
  try {
    const { employeeId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId || req.user.id,
      date: today
    }).populate('employee', 'name employeeId');

    if (attendance) {
      // Calculate real-time break time and working hours
      const now = new Date();
      let totalBreakTime = 0;
      
      attendance.breaks.forEach(breakItem => {
        if (breakItem.breakOut) {
          const breakEnd = breakItem.breakIn || (attendance.status === 'on_break' ? now : breakItem.breakOut);
          totalBreakTime += (breakEnd - breakItem.breakOut);
        }
      });
      
      const totalTime = (attendance.checkOut || now) - attendance.checkIn;
      attendance.totalBreakTime = Math.round(totalBreakTime / (1000 * 60 * 60) * 100) / 100;
      attendance.totalWorkingHours = Math.round(totalTime / (1000 * 60 * 60) * 100) / 100;
      attendance.netWorkingHours = Math.round((totalTime - totalBreakTime) / (1000 * 60 * 60) * 100) / 100;
    }

    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/report
// @desc    Get attendance report/summary for an employee
// @access  Private
router.get('/report', auth, async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;

    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }

    // Default to current month/year
    const reportMonth = parseInt(month) || (new Date().getMonth() + 1);
    const reportYear = parseInt(year) || new Date().getFullYear();

    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0); // last day of month

    const records = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    }).populate('employee', 'name employeeId').sort({ date: 1 });

    // Enhance records with break information
    const enhancedRecords = records.map(record => {
      const recordObj = record.toObject();
      if (recordObj.breaks && recordObj.breaks.length > 0) {
        recordObj.breakDetails = recordObj.breaks.map(b => ({
          breakOut: b.breakOut,
          breakIn: b.breakIn,
          duration: b.breakIn ? Math.round((b.breakIn - b.breakOut) / (1000 * 60)) : null // minutes
        }));
      }
      return recordObj;
    });

    // Calculate the total calendar days in the month
    const totalDaysInMonth = endDate.getDate();

    // Calculate today or end of month
    const today = new Date();
    const effectiveEnd = today < endDate ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : endDate;
    const effectiveStart = startDate;

    // Count working days (exclude weekends - Friday in Bangladesh context)
    let totalWorkingDays = 0;
    const currentDate = new Date(effectiveStart);
    while (currentDate <= effectiveEnd) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 5) { // Friday off 
        totalWorkingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const presentDays = records.length;
    const absentDays = Math.max(0, totalWorkingDays - presentDays);
    const totalWorkingHours = records.reduce((sum, r) => sum + (r.netWorkingHours || 0), 0);
    const avgWorkingHours = presentDays > 0 ? totalWorkingHours / presentDays : 0;
    const totalBreakTime = records.reduce((sum, r) => sum + (r.totalBreakTime || 0), 0);
    const avgBreakTime = presentDays > 0 ? totalBreakTime / presentDays : 0;

    // Attendance rate
    const attendanceRate = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100 * 100) / 100 : 0;

    // Early check-ins (before 9 AM) & late check-ins (after 9:30 AM)
    let earlyCheckIns = 0;
    let lateCheckIns = 0;
    let onTimeCheckIns = 0;
    records.forEach(r => {
      if (r.checkIn) {
        const checkInHour = new Date(r.checkIn).getHours();
        const checkInMinute = new Date(r.checkIn).getMinutes();
        const totalMinutes = checkInHour * 60 + checkInMinute;
        if (totalMinutes < 540) { // before 9:00 AM
          earlyCheckIns++;
        } else if (totalMinutes > 570) { // after 9:30 AM
          lateCheckIns++;
        } else {
          onTimeCheckIns++;
        }
      }
    });

    res.json({
      summary: {
        employeeId,
        month: reportMonth,
        year: reportYear,
        totalDaysInMonth,
        totalWorkingDays,
        presentDays,
        absentDays,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
        avgWorkingHours: Math.round(avgWorkingHours * 100) / 100,
        totalBreakTime: Math.round(totalBreakTime * 100) / 100,
        avgBreakTime: Math.round(avgBreakTime * 100) / 100,
        earlyCheckIns,
        onTimeCheckIns,
        lateCheckIns
      },
      records: enhancedRecords
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/attendance/recalculate
// @desc    Recalculate all attendance working hours
// @access  Private (Admin only)
router.put('/recalculate', auth, authorize(['admin']), async (req, res) => {
  try {
    const attendanceRecords = await Attendance.find({});
    let updated = 0;
    
    for (const record of attendanceRecords) {
      if (record.checkIn) {
        await record.save(); // This will trigger the pre-save middleware
        updated++;
      }
    }
    
    res.json({ message: `Recalculated ${updated} attendance records` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;