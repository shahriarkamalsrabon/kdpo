const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Submit registration application (public)
router.post('/apply', async (req, res) => {
  try {
    const registration = new Registration(req.body);
    await registration.save();
    res.status(201).json({ success: true, message: 'Application submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all applications (admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const applications = await Registration.find()
      .populate('reviewedBy', 'nameEnglish')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve application
router.put('/:id/approve', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const application = await Registration.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    
    // Generate student ID
    const lastStudent = await User.findOne({ role: 'student' }).sort({ createdAt: -1 });
    const lastId = lastStudent?.studentId ? parseInt(lastStudent.studentId.slice(2)) : 0;
    const studentId = `ST${(lastId + 1).toString().padStart(4, '0')}`;
    
    // Create user
    const user = new User({
      nameEnglish: application.nameEnglish,
      nameBangla: application.nameBangla,
      name: application.nameEnglish,
      phone: application.mobile,
      fatherName: application.fatherName,
      motherName: application.motherName,
      dateOfBirth: application.dateOfBirth,
      gender: application.gender,
      nidOrBirth: application.nidOrBirth,
      mobile: application.mobile,
      guardianMobile: application.guardianMobile,
      permanentAddress: application.permanentAddress,
      presentAddress: application.presentAddress,
      education: application.education,
      email: application.email,
      password: application.password,
      studentId,
      role: 'student'
    });
    
    await user.save();
    
    // Update application
    application.status = 'approved';
    application.reviewedBy = req.user.id;
    application.reviewedAt = new Date();
    await application.save();
    
    res.json({ success: true, message: 'Application approved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject application
router.put('/:id/reject', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const { reason } = req.body;
    const application = await Registration.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: req.user.id,
        reviewedAt: new Date()
      },
      { new: true }
    );
    
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    
    res.json({ success: true, message: 'Application rejected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;