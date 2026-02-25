const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Course = require('./models/Course');
const StudentFee = require('./models/StudentFee');

const seedStudentFees = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kdpo');
    console.log('Connected to MongoDB');

    // Get some students and courses
    const students = await User.find({ role: 'student' }).limit(5);
    const courses = await Course.find().limit(3);

    if (students.length === 0) {
      console.log('No students found. Please create some students first.');
      return;
    }

    if (courses.length === 0) {
      console.log('No courses found. Please create some courses first.');
      return;
    }

    // Create fee records for students
    for (const student of students) {
      // Assign 1-2 courses to each student
      const numCourses = Math.floor(Math.random() * 2) + 1;
      const selectedCourses = courses.slice(0, numCourses);

      for (const course of selectedCourses) {
        // Check if fee record already exists
        const existingFee = await StudentFee.findOne({
          student: student._id,
          course: course._id
        });

        if (!existingFee) {
          const totalFee = course.fee || 5000;
          const paidAmount = Math.floor(Math.random() * totalFee);
          
          const studentFee = new StudentFee({
            student: student._id,
            course: course._id,
            batch: student.batch,
            totalFee,
            paidAmount,
            dueAmount: totalFee - paidAmount,
            enrollmentDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
          });

          // Add some payment history if there's paid amount
          if (paidAmount > 0) {
            const numPayments = Math.floor(Math.random() * 3) + 1;
            let remainingAmount = paidAmount;
            
            for (let i = 0; i < numPayments && remainingAmount > 0; i++) {
              const paymentAmount = i === numPayments - 1 ? remainingAmount : Math.floor(Math.random() * remainingAmount);
              remainingAmount -= paymentAmount;
              
              studentFee.payments.push({
                amount: paymentAmount,
                paymentDate: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000),
                paymentMethod: Math.random() > 0.5 ? 'cash' : 'bank_transfer',
                collectedBy: student._id, // Using student ID as placeholder
                notes: `Payment ${i + 1}`
              });
            }
          }

          await studentFee.save();
          console.log(`Created fee record for ${student.name} - ${course.name}`);
        }
      }
    }

    console.log('Student fee seeding completed!');
  } catch (error) {
    console.error('Error seeding student fees:', error);
  } finally {
    await mongoose.disconnect();
  }
};

seedStudentFees();