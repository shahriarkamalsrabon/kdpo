const express = require('express');
const router = express.Router();
const StudentFee = require('../models/StudentFee');
const User = require('../models/User');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const { auth } = require('../middleware/auth');

// Get student fees
router.get('/', auth, async (req, res) => {
  try {
    const { studentId } = req.query;
    
    let query = {};
    if (studentId) {
      query.student = studentId;
    }
    
    const fees = await StudentFee.find(query)
      .populate('student', 'name studentId email phone')
      .populate('batch', 'name')
      .populate('payments.collectedBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: fees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create student fee record
router.post('/', auth, async (req, res) => {
  try {
    const { studentId, course, batchId, totalFee, dueDate } = req.body;
    
    // Check if fee record already exists
    const existingFee = await StudentFee.findOne({
      student: studentId,
      course: course
    });
    
    if (existingFee) {
      return res.status(400).json({
        success: false,
        message: 'Fee record already exists for this student and course'
      });
    }
    
    const studentFee = new StudentFee({
      student: studentId,
      course: course,
      batch: batchId,
      totalFee,
      dueAmount: totalFee,
      dueDate
    });
    
    await studentFee.save();
    
    const populatedFee = await StudentFee.findById(studentFee._id)
      .populate('student', 'name studentId email phone')
      .populate('batch', 'name');
    
    res.status(201).json({ success: true, data: populatedFee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Collect payment
router.post('/:id/payment', auth, async (req, res) => {
  try {
    const { amount, paymentMethod, notes } = req.body;
    const feeId = req.params.id;
    
    const studentFee = await StudentFee.findById(feeId);
    if (!studentFee) {
      return res.status(404).json({ success: false, message: 'Fee record not found' });
    }
    
    if (amount > studentFee.dueAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount cannot exceed due amount'
      });
    }
    
    // Add payment
    studentFee.payments.push({
      amount,
      paymentMethod,
      collectedBy: req.user.id,
      notes
    });
    
    studentFee.paidAmount += amount;
    await studentFee.save();
    
    const updatedFee = await StudentFee.findById(feeId)
      .populate('student', 'name studentId email phone')
      .populate('batch', 'name')
      .populate('payments.collectedBy', 'name');
    
    res.json({ success: true, data: updatedFee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get student fee summary
router.get('/summary/:studentId', auth, async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    const fees = await StudentFee.find({ student: studentId })
      .populate('batch', 'name');
    
    const summary = {
      totalFees: fees.reduce((sum, fee) => sum + fee.totalFee, 0),
      totalPaid: fees.reduce((sum, fee) => sum + fee.paidAmount, 0),
      totalDue: fees.reduce((sum, fee) => sum + fee.dueAmount, 0),
      courses: fees.length,
      fees: fees
    };
    
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;