const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const testUsers = [
  {
    name: 'Admin User',
    email: 'admin@kdpo.com',
    phone: '01700000001',
    password: 'admin123',
    role: 'admin',
    address: 'Katbowla, Cumilla'
  },
  {
    name: 'John Teacher',
    email: 'teacher@kdpo.com',
    phone: '01700000002',
    password: 'teacher123',
    role: 'teacher',
    address: 'Cumilla',
    specialization: 'Computer Science',
    qualification: 'MSc in CSE'
  },
  {
    name: 'Jane Staff',
    email: 'staff@kdpo.com',
    phone: '01700000003',
    password: 'staff123',
    role: 'staff',
    address: 'Cumilla'
  },
  {
    name: 'Alice Student',
    email: 'student@kdpo.com',
    phone: '01700000004',
    password: 'student123',
    role: 'student',
    address: 'Cumilla',
    dateOfBirth: new Date('2000-01-15'),
    gender: 'female',
    guardianName: 'Mr. Smith',
    guardianPhone: '01700000005'
  }
];

const createTestUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kdpo');
    console.log('Connected to MongoDB');

    // Clear existing users (optional)
    // await User.deleteMany({});
    // console.log('Cleared existing users');

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Generate IDs
      if (userData.role === 'student') {
        const lastStudent = await User.findOne({ role: 'student' }).sort({ createdAt: -1 });
        const lastId = lastStudent?.studentId ? parseInt(lastStudent.studentId.slice(2)) : 0;
        userData.studentId = `ST${(lastId + 1).toString().padStart(4, '0')}`;
      } else if (['teacher', 'staff', 'admin'].includes(userData.role)) {
        const lastEmployee = await User.findOne({ role: { $in: ['teacher', 'staff', 'admin'] } }).sort({ createdAt: -1 });
        const lastId = lastEmployee?.employeeId ? parseInt(lastEmployee.employeeId.slice(2)) : 0;
        userData.employeeId = `EM${(lastId + 1).toString().padStart(4, '0')}`;
      }

      const user = new User(userData);
      await user.save();
      console.log(`Created ${userData.role}: ${userData.email} (ID: ${userData.studentId || userData.employeeId})`);
    }

    console.log('Test users created successfully!');
    console.log('\nLogin credentials:');
    testUsers.forEach(user => {
      console.log(`${user.role}: ${user.email} / ${user.password}`);
    });

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await mongoose.disconnect();
  }
};

createTestUsers();