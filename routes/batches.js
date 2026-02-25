const express = require('express');
const Batch = require('../models/Batch');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/batches
// @desc    Get all batches
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { course, teacher, isActive, page = 1, limit = 10 } = req.query;
    
    let query = {};
    if (course) query.course = course;
    if (teacher) query.teacher = teacher;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const batches = await Batch.find(query)
      .populate('course', 'name fee duration')
      .populate('teacher', 'name email')
      .populate('students', 'name email studentId')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.json({ success: true, batches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/batches
// @desc    Create batch
// @access  Private (Admin, Staff)
router.post('/', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const batch = new Batch(req.body);
    await batch.save();
    
    await batch.populate([
      { path: 'course', select: 'name fee duration' },
      { path: 'teacher', select: 'name email' },
      { path: 'students', select: 'name email studentId' }
    ]);

    res.status(201).json(batch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/batches/:id
// @desc    Update batch
// @access  Private (Admin, Staff)
router.put('/:id', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'course', select: 'name fee duration' },
      { path: 'teacher', select: 'name email' },
      { path: 'students', select: 'name email studentId' }
    ]);

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    res.json(batch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/batches/:id
// @desc    Delete batch
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const batch = await Batch.findByIdAndDelete(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Remove batch reference from students
    await User.updateMany(
      { batch: req.params.id },
      { $unset: { batch: 1 } }
    );

    res.json({ message: 'Batch deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/batches/:id/students
// @desc    Add student to batch
// @access  Private (Admin, Staff)
router.put('/:id/students', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { studentId } = req.body;
    
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Check if batch is full
    if (batch.maxStudents && batch.students.length >= batch.maxStudents) {
      return res.status(400).json({ message: 'Batch is full' });
    }

    // Check if student already in batch
    if (batch.students.includes(studentId)) {
      return res.status(400).json({ message: 'Student already in this batch' });
    }

    batch.students.push(studentId);
    await batch.save();

    // Update student's batch
    await User.findByIdAndUpdate(studentId, { batch: batch._id });

    // Auto-create fee record for the course
    try {
      const StudentFee = require('../models/StudentFee');
      const Settings = require('../models/Settings');
      
      const existingFee = await StudentFee.findOne({
        student: studentId,
        course: batch.course
      });
      
      if (!existingFee) {
        const settings = await Settings.findOne();
        const coursePrice = batch.course === '3-month' 
          ? (settings?.course3MonthPrice || 3000)
          : (settings?.course6MonthPrice || 5000);
          
        const studentFee = new StudentFee({
          student: studentId,
          course: batch.course,
          batch: batch._id,
          totalFee: coursePrice,
          dueAmount: coursePrice
        });
        await studentFee.save();
      }
    } catch (feeError) {
      console.log('Fee record creation failed:', feeError.message);
    }

    await batch.populate('students', 'name email studentId');
    res.json(batch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/batches/:id/students/:studentId
// @desc    Remove student from batch
// @access  Private (Admin, Staff)
router.delete('/:id/students/:studentId', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    batch.students = batch.students.filter(
      student => student.toString() !== req.params.studentId
    );
    await batch.save();

    // Remove batch from student
    await User.findByIdAndUpdate(req.params.studentId, { $unset: { batch: 1 } });

    res.json({ message: 'Student removed from batch' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;