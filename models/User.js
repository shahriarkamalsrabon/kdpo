const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameEnglish: {
    type: String,
    trim: true
  },
  nameBangla: {
    type: String,
    trim: true
  },
  fatherName: {
    type: String,
    trim: true
  },
  motherName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: function() {
      return ['admin', 'teacher', 'staff', 'student'].includes(this.role);
    },
    unique: true,
    sparse: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  mobile: {
    type: String
  },
  guardianPhone: {
    type: String
  },
  guardianMobile: {
    type: String
  },
  password: {
    type: String,
    minlength: 6,
    required: function() {
      return ['admin', 'teacher', 'staff', 'student'].includes(this.role);
    }
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'staff', 'student', 'customer'],
    default: 'student'
  },
  address: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  guardianName: {
    type: String
  },
  nidOrBirth: {
    type: String
  },
  permanentAddress: {
    type: String
  },
  presentAddress: {
    type: String
  },
  education: [{
    examName: String, // SSC, HSC, etc.
    passingYear: Number,
    result: String, // GPA/CGPA
    board: String,
    rollNumber: String,
    registrationNumber: String
  }],
  joinDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Student specific fields
  studentId: {
    type: String,
    unique: true,
    sparse: true
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  // Staff/Teacher specific fields
  employeeId: {
    type: String,
    unique: true,
    sparse: true
  },
  salary: {
    type: Number
  },
  specialization: {
    type: String
  },
  qualification: {
    type: String
  },
  experience: {
    type: Number
  },
  joiningDate: {
    type: Date
  },
  // Customer specific fields
  businessName: {
    type: String
  },
  nid: {
    type: String
  },
  // Due amount tracking for customers
  dueAmount: {
    type: Number,
    default: 0
  },
  lastDueUpdate: {
    type: Date
  },
  // Customer color coding
  customerStatus: {
    type: String,
    enum: ['red', 'green', 'blue', 'yellow'],
    default: 'green'
  },
  statusNotes: {
    type: String
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);