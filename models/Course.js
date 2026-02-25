const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in months
    required: true
  },
  fee: {
    type: Number,
    required: true
  },
  syllabus: {
    type: String // Store as text for simplicity
  },
  prerequisites: {
    type: String
  },
  category: {
    type: String,
    enum: ['basic', 'office', 'programming', 'design', 'web', 'other']
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Course', courseSchema);