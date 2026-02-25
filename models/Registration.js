const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  examName: { type: String, required: true }, // SSC, HSC, etc.
  passingYear: { type: Number, required: true },
  result: { type: String, required: true }, // GPA/CGPA
  board: { type: String, required: true },
  rollNumber: { type: String, required: true },
  registrationNumber: { type: String, required: true }
});

const registrationSchema = new mongoose.Schema({
  // Basic Info
  nameEnglish: { type: String, required: true },
  nameBangla: { type: String, required: true },
  fatherName: { type: String, required: true },
  motherName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  nidOrBirth: { type: String, required: true },
  
  // Contact
  mobile: { type: String, required: true },
  guardianMobile: { type: String, required: true },
  
  // Address
  permanentAddress: { type: String, required: true },
  presentAddress: { type: String, required: true },
  
  // Education
  education: [educationSchema],
  
  // Application Status
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  email: { type: String }, // Set by admin on approval
  password: { type: String }, // Set by admin on approval
  rejectionReason: { type: String },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
}, {
  timestamps: true
});

module.exports = mongoose.model('Registration', registrationSchema);