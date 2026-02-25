const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// @route   POST /api/setup/admin
// @desc    Create initial admin user (only if no admin exists)
// @access  Public (one-time setup)
router.post('/admin', async (req, res) => {
  try {
    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin user already exists' });
    }

    const { name, email, phone, password } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user with email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate employee ID
    const employeeCount = await User.countDocuments({ role: { $in: ['admin', 'teacher', 'staff'] } });
    const employeeId = `EM${String(employeeCount + 1).padStart(4, '0')}`;

    // Create admin user
    const admin = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'admin',
      employeeId,
      address: req.body.address || 'Katbowla, Cumilla',
      isActive: true
    });

    await admin.save();

    res.status(201).json({
      message: 'Admin user created successfully',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        employeeId: admin.employeeId,
        role: admin.role
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;