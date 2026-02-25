const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users with filtering
// @access  Private (Admin, Staff)
router.get('/', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;
    
    let query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nameEnglish: { $regex: search, $options: 'i' } },
        { nameBangla: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('batch', 'name')
      .populate('courses', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({ users, total, pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users
// @desc    Create new user
// @access  Private (Admin, Staff)
router.post('/', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { name, nameEnglish, nameBangla, fatherName, motherName, email, phone, mobile, guardianPhone, guardianMobile, password, role, address, permanentAddress, presentAddress, dateOfBirth, gender, nidOrBirth, education, qualification, experience, specialization, salary, joiningDate, businessName, nid, batch, courses } = req.body;

    // Check if user already exists by email (if provided)
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
    }

    // Generate unique IDs based on role
    let generatedId = null;
    if (role === 'student') {
      const lastStudent = await User.findOne({ role: 'student' }).sort({ createdAt: -1 });
      const lastNumber = lastStudent?.studentId ? parseInt(lastStudent.studentId.replace('ST', '')) : 0;
      generatedId = `ST${String(lastNumber + 1).padStart(4, '0')}`;
    } else if (['teacher', 'staff', 'admin'].includes(role)) {
      const lastEmployee = await User.findOne({ 
        role: { $in: ['teacher', 'staff', 'admin'] } 
      }).sort({ createdAt: -1 });
      const lastNumber = lastEmployee?.employeeId ? parseInt(lastEmployee.employeeId.replace('EM', '')) : 0;
      generatedId = `EM${String(lastNumber + 1).padStart(4, '0')}`;
    }

    // Create user data
    const userData = {
      name: nameEnglish || name,
      nameEnglish: nameEnglish || name,
      nameBangla,
      fatherName,
      motherName,
      phone: mobile || phone,
      mobile: mobile || phone,
      guardianPhone: guardianMobile || guardianPhone,
      guardianMobile: guardianMobile || guardianPhone,
      role: role || 'student',
      address: permanentAddress || address,
      permanentAddress: permanentAddress || address,
      presentAddress: presentAddress || address,
      dateOfBirth,
      gender,
      nidOrBirth,
      education,
      qualification,
      experience,
      specialization,
      salary,
      joiningDate,
      businessName,
      nid,
      batch: batch || undefined,
      courses: courses || []
    };

    // Add email only if provided
    if (email) {
      userData.email = email;
    }

    // Add generated ID
    if (role === 'student') {
      userData.studentId = generatedId;
    } else if (['teacher', 'staff', 'admin'].includes(role)) {
      userData.employeeId = generatedId;
    }

    // Only add password for roles that need login access
    if (['admin', 'staff', 'teacher', 'student'].includes(role)) {
      userData.password = password || 'password123'; // Use provided password or default
    }

    const user = new User(userData);
    await user.save();

    // If student is assigned to a batch, add them to the batch
    if (role === 'student' && batch) {
      const Batch = require('../models/Batch');
      await Batch.findByIdAndUpdate(
        batch,
        { $addToSet: { students: user._id } }
      );
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('batch', 'name course')
      .populate('courses', 'name fee duration');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin, Staff, or own profile)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user can update this profile
    if (req.user.id !== req.params.id && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updates = req.body;
    delete updates.password; // Prevent password update through this route

    const oldUser = await User.findById(req.params.id);
    if (!oldUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle batch changes for students
    if (oldUser.role === 'student') {
      const Batch = require('../models/Batch');
      
      // Remove from old batch if exists
      if (oldUser.batch && oldUser.batch.toString() !== updates.batch) {
        await Batch.findByIdAndUpdate(
          oldUser.batch,
          { $pull: { students: req.params.id } }
        );
      }
      
      // Add to new batch if provided
      if (updates.batch && updates.batch !== oldUser.batch?.toString()) {
        await Batch.findByIdAndUpdate(
          updates.batch,
          { $addToSet: { students: req.params.id } }
        );
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If student, remove from batch and delete related data
    if (user.role === 'student') {
      const Batch = require('../models/Batch');
      const StudentFee = require('../models/StudentFee');
      
      // Remove from batch
      if (user.batch) {
        await Batch.findByIdAndUpdate(
          user.batch,
          { $pull: { students: req.params.id } }
        );
      }
      
      // Delete student fees
      await StudentFee.deleteMany({ student: req.params.id });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/due-amount
// @desc    Add due amount for customer
// @access  Private (Admin, Staff)
router.post('/:id/due-amount', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { amount, description } = req.body;
    const customerId = req.params.id;

    const customer = await User.findById(customerId);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Update customer due amount
    customer.dueAmount = (customer.dueAmount || 0) + amount;
    customer.lastDueUpdate = new Date();
    await customer.save();

    // Create transaction record
    const Transaction = require('../models/Transaction');
    const transaction = new Transaction({
      type: 'due_amount_add',
      customerRef: customerId,
      amount,
      description: description || 'Due amount added',
      handledBy: req.user.id,
      status: 'completed'
    });
    await transaction.save();

    res.json({ message: 'Due amount added successfully', dueAmount: customer.dueAmount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/collect-due
// @desc    Collect due amount from customer
// @access  Private (Admin, Staff)
router.post('/:id/collect-due', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { amount, paymentMethod = 'cash', description } = req.body;
    const customerId = req.params.id;

    const customer = await User.findById(customerId);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (amount > customer.dueAmount) {
      return res.status(400).json({ message: 'Collection amount cannot exceed due amount' });
    }

    // Update customer due amount
    customer.dueAmount = (customer.dueAmount || 0) - amount;
    customer.lastDueUpdate = new Date();
    await customer.save();

    // Create transaction record
    const Transaction = require('../models/Transaction');
    const transaction = new Transaction({
      type: 'due_amount_collect',
      customerRef: customerId,
      amount,
      paymentMethod,
      description: description || 'Due amount collected',
      handledBy: req.user.id,
      status: 'completed'
    });
    await transaction.save();

    res.json({ message: 'Due amount collected successfully', dueAmount: customer.dueAmount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;