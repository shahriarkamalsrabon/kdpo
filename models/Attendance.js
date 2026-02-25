const mongoose = require('mongoose');

const breakSchema = new mongoose.Schema({
  breakOut: { type: Date, required: true },
  breakIn: { type: Date }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date
  },
  breaks: [breakSchema],
  totalWorkingHours: {
    type: Number,
    default: 0
  },
  totalBreakTime: {
    type: Number,
    default: 0
  },
  netWorkingHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'on_break', 'checked_out'],
    default: 'present'
  },
  notes: String
}, {
  timestamps: true
});

// Virtual for real-time calculations
attendanceSchema.virtual('currentWorkingHours').get(function() {
  if (!this.checkIn) return 0;
  const endTime = this.checkOut || new Date();
  const totalTime = endTime - this.checkIn;
  
  let totalBreakTime = 0;
  this.breaks.forEach(breakItem => {
    if (breakItem.breakOut) {
      const breakEnd = breakItem.breakIn || (this.status === 'on_break' ? new Date() : breakItem.breakOut);
      totalBreakTime += (breakEnd - breakItem.breakOut);
    }
  });
  
  return Math.round((totalTime - totalBreakTime) / (1000 * 60 * 60) * 100) / 100;
});

// Ensure one attendance record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Pre-save middleware to calculate working hours
attendanceSchema.pre('save', function(next) {
  if (this.checkIn && this.checkOut) {
    const totalTime = this.checkOut - this.checkIn;
    let totalBreakTime = 0;
    
    this.breaks.forEach(breakItem => {
      if (breakItem.breakOut && breakItem.breakIn) {
        totalBreakTime += (breakItem.breakIn - breakItem.breakOut);
      }
    });
    
    this.totalWorkingHours = Math.round(totalTime / (1000 * 60 * 60) * 100) / 100;
    this.totalBreakTime = Math.round(totalBreakTime / (1000 * 60 * 60) * 100) / 100;
    this.netWorkingHours = Math.round((totalTime - totalBreakTime) / (1000 * 60 * 60) * 100) / 100;
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);