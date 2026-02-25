const express = require('express');
const Course = require('../models/Course');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/courses
// @desc    Get all courses
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;
    
    let query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const courses = await Course.find(query)
      .populate('createdBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Course.countDocuments(query);

    res.json({
      success: true,
      courses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/courses
// @desc    Create course
// @access  Private (Admin, Staff)
router.post('/', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { name, description, duration, fee, syllabus, prerequisites } = req.body;
    
    // Validate required fields
    if (!name || !description || !duration || !fee) {
      return res.status(400).json({ message: 'Name, description, duration, and fee are required' });
    }

    const course = new Course({
      name,
      description,
      duration,
      fee,
      syllabus: syllabus || [],
      prerequisites: prerequisites || '',
      createdBy: req.user.id
    });

    await course.save();
    await course.populate('createdBy', 'name');

    res.status(201).json(course);
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/courses/:id
// @desc    Update course
// @access  Private (Admin, Staff)
router.put('/:id', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { syllabus, ...updateData } = req.body;
    
    // Ensure syllabus is an array if provided
    if (syllabus !== undefined) {
      updateData.syllabus = Array.isArray(syllabus) ? syllabus : [];
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/courses/:id
// @desc    Delete course
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;