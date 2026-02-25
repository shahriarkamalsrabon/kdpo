const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', [
  body('nameEnglish').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('mobile').notEmpty().withMessage('Mobile number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('permanentAddress').notEmpty().withMessage('Address is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, nameEnglish, nameBangla, fatherName, motherName, email, phone, mobile, guardianPhone, guardianMobile, password, role, address, permanentAddress, presentAddress, dateOfBirth, gender, nidOrBirth, education } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate IDs
    let studentId, employeeId;
    if (role === 'student') {
      const lastStudent = await User.findOne({ role: 'student' }).sort({ createdAt: -1 });
      const lastId = lastStudent?.studentId ? parseInt(lastStudent.studentId.slice(2)) : 0;
      studentId = `ST${(lastId + 1).toString().padStart(4, '0')}`;
    } else if (['teacher', 'staff', 'admin'].includes(role)) {
      const lastEmployee = await User.findOne({ role: { $in: ['teacher', 'staff', 'admin'] } }).sort({ createdAt: -1 });
      const lastId = lastEmployee?.employeeId ? parseInt(lastEmployee.employeeId.slice(2)) : 0;
      employeeId = `EM${(lastId + 1).toString().padStart(4, '0')}`;
    }

    // Create user
    user = new User({
      name: nameEnglish || name,
      nameEnglish: nameEnglish || name,
      nameBangla,
      fatherName,
      motherName,
      email,
      phone: mobile || phone,
      mobile: mobile || phone,
      guardianPhone: guardianMobile || guardianPhone,
      guardianMobile: guardianMobile || guardianPhone,
      password,
      role: role || 'student',
      address: permanentAddress || address,
      permanentAddress: permanentAddress || address,
      presentAddress: presentAddress || address,
      dateOfBirth,
      gender,
      nidOrBirth,
      education,
      studentId,
      employeeId
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        nameEnglish: user.nameEnglish,
        nameBangla: user.nameBangla,
        email: user.email,
        phone: user.phone,
        mobile: user.mobile,
        role: user.role,
        studentId: user.studentId,
        employeeId: user.employeeId,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        permanentAddress: user.permanentAddress,
        presentAddress: user.presentAddress,
        guardianMobile: user.guardianMobile,
        nidOrBirth: user.nidOrBirth
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).populate('batch', 'name');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        nameEnglish: user.nameEnglish,
        nameBangla: user.nameBangla,
        email: user.email,
        phone: user.phone,
        mobile: user.mobile,
        role: user.role,
        studentId: user.studentId,
        employeeId: user.employeeId,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        permanentAddress: user.permanentAddress,
        presentAddress: user.presentAddress,
        guardianMobile: user.guardianMobile,
        nidOrBirth: user.nidOrBirth,
        batch: user.batch
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('batch', 'name')
      .populate('courses', 'name');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;