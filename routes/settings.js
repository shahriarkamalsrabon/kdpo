const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { auth, authorize } = require('../middleware/auth');

// Get settings
router.get('/', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update course prices (Admin only)
router.put('/course-prices', auth, authorize('admin'), async (req, res) => {
  try {
    const { course3MonthPrice, course6MonthPrice } = req.body;
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    if (course3MonthPrice) settings.course3MonthPrice = course3MonthPrice;
    if (course6MonthPrice) settings.course6MonthPrice = course6MonthPrice;
    settings.lastUpdatedBy = req.user.id;
    
    await settings.save();
    
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;