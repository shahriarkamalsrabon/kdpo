const mongoose = require('mongoose');
const Notice = require('./models/Notice');
const User = require('./models/User');
require('dotenv').config();

async function createTestNotice() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kdpo');
    console.log('Connected to MongoDB');

    // Find an admin user to send the notice
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('No admin user found. Please create an admin user first.');
      return;
    }

    // Create a test notice
    const testNotice = new Notice({
      title: 'Welcome to KDPO!',
      message: 'This is a test notice to verify the notice system is working properly. All students can see this message.',
      sentBy: adminUser._id,
      recipients: 'all_students'
    });

    await testNotice.save();
    console.log('Test notice created successfully!');
    
    // Verify the notice was created
    const notices = await Notice.find({ isActive: true }).populate('sentBy', 'name role');
    console.log(`Total notices in database: ${notices.length}`);
    
  } catch (error) {
    console.error('Error creating test notice:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestNotice();