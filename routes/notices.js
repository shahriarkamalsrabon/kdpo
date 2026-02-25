const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const { auth, authorize } = require('../middleware/auth');

// Get notices (students see their notices, staff see all)
router.get('/', auth, async (req, res) => {
  try {
    let query = { isActive: true };
    
    if (req.user.role === 'student') {
      query = {
        isActive: true,
        $or: [
          { recipients: 'all_students' },
          { recipients: 'individual', targetStudent: req.user.id },
          { recipients: 'batch', targetBatch: req.user.batch }
        ]
      };
    }
    
    const notices = await Notice.find(query)
      .populate('sentBy', 'name role')
      .populate('targetBatch', 'name')
      .populate('targetStudent', 'name studentId')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: notices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create notice (admin, staff, teacher only)
router.post('/', auth, async (req, res) => {
  try {
    // Check role manually
    if (!['admin', 'staff', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { title, message, recipients, targetBatch, targetStudent, priority, category } = req.body;
    
    const notice = new Notice({
      title,
      message,
      sentBy: req.user.id,
      recipients,
      targetBatch: targetBatch || undefined,
      targetStudent: targetStudent || undefined,
      priority: priority || 'normal',
      category: category || 'general'
    });
    
    await notice.save();
    
    const populatedNotice = await Notice.findById(notice._id)
      .populate('sentBy', 'name role')
      .populate('targetBatch', 'name')
      .populate('targetStudent', 'name studentId');
    
    res.status(201).json({ success: true, data: populatedNotice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update notice
router.put('/:id', auth, async (req, res) => {
  try {
    if (!['admin', 'staff', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const { title, message, recipients, targetBatch, targetStudent, priority, category } = req.body;
    
    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      {
        title,
        message,
        recipients,
        targetBatch: targetBatch || undefined,
        targetStudent: targetStudent || undefined,
        priority: priority || 'normal',
        category: category || 'general'
      },
      { new: true }
    ).populate('sentBy', 'name role')
     .populate('targetBatch', 'name')
     .populate('targetStudent', 'name studentId');
    
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }
    
    res.json({ success: true, data: notice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark notice as read/unread
router.post('/:id/read', auth, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }
    
    const existingRead = notice.readBy.find(read => read.user.toString() === req.user.id);
    
    if (existingRead) {
      // Remove from readBy array (mark as unread)
      notice.readBy = notice.readBy.filter(read => read.user.toString() !== req.user.id);
    } else {
      // Add to readBy array (mark as read)
      notice.readBy.push({ user: req.user.id });
    }
    
    await notice.save();
    res.json({ success: true, message: existingRead ? 'Marked as unread' : 'Marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete notice
router.delete('/:id', auth, async (req, res) => {
  try {
    await Notice.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Notice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;