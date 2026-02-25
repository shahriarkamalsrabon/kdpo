const mongoose = require('mongoose');
const Service = require('./models/Service');

const services = [
  // Photocopy Services
  { name: 'A4 ফটোকপি (একপাশ)', category: 'photocopy', price: 3, unit: 'per_page' },
  { name: 'Legal ফটোকপি (একপাশ)', category: 'photocopy', price: 4, unit: 'per_page' },
  { name: 'A4 ফটোকপি (উভয় পিঠ)', category: 'photocopy', price: 4, unit: 'per_page' },
  { name: 'Legal ফটোকপি (উভয় পিঠ)', category: 'photocopy', price: 5, unit: 'per_page' },
  
  // Color Photocopy
  { name: 'কালার ফটোকপি A4 (একপাশ)', category: 'photocopy', price: 4, maxPrice: 4.5, unit: 'per_page', notes: 'পরিমাণ বেশি হলে আলোচনা স্বাপেক্ষে ছাড়' },
  { name: 'কালার ফটোকপি A4 (উভয় পিঠ)', category: 'photocopy', price: 5, maxPrice: 6, unit: 'per_page', notes: 'পরিমাণ বেশি হলে আলোচনা স্বাপেক্ষে ছাড়' },
  
  // Printing Services
  { name: 'ডকুমেন্ট প্রিন্ট (সাদা-কালো)', category: 'printing', price: 10, maxPrice: 20, unit: 'per_page', notes: 'পরিমাণ বেশি হলে আলোচনা স্বাপেক্ষে ছাড়' },
  { name: 'কালার প্রিন্ট A4', category: 'printing', price: 20, unit: 'per_page', notes: 'পরিমাণ বেশি হলে আলোচনা স্বাপেক্ষে ছাড়' },
  { name: 'PDF ফাইল প্রিন্ট', category: 'printing', price: 10, unit: 'per_page', description: 'পৃষ্ঠার সংখ্যার উপর নির্ভরশীল' },
  
  // Photo Services
  { name: 'পাসপোর্ট সাইজ ছবি', category: 'photo', price: 10, unit: 'per_photo' },
  { name: 'দুই জনের জোড়া ছবি', category: 'photo', price: 15, unit: 'per_photo' },
  
  // Lamination
  { name: 'লেমিনেশন A4', category: 'lamination', price: 40, unit: 'per_item', notes: 'বেশি হলে আলোচনা স্বাপেক্ষে কম-বেশি' },
  { name: 'লেমিনেশন Legal', category: 'lamination', price: 60, unit: 'per_item', notes: 'বেশি হলে আলোচনা স্বাপেক্ষে কম-বেশি' },
  
  // Scanning & Email
  { name: 'ডকুমেন্ট স্ক্যান', category: 'scanning', price: 20, unit: 'per_page' },
  { name: 'স্ক্যান ফাইল', category: 'scanning', price: 20, unit: 'per_file' },
  { name: 'ইমেইল পাঠানো', category: 'scanning', price: 20, unit: 'per_email', notes: 'নিয়মিত কাস্টমার হলে কম-বেশি হতে পারে' },
  
  // Online Applications
  { name: 'অনলাইনে চাকরির আবেদন', category: 'online_application', price: 80, unit: 'per_application', notes: 'আবেদন জটিল হলে অতিরিক্ত চার্জ' },
  { name: 'NID সংশোধন আবেদন', category: 'online_application', price: 100, maxPrice: 300, unit: 'per_application', notes: 'সরকারি ফি ব্যতীত' },
  { name: 'পুলিশ ক্লিয়ারেন্স আবেদন', category: 'online_application', price: 1800, maxPrice: 2000, unit: 'per_application', notes: 'সরকারি ফি ও কাজের ধরন অনুযায়ী' },
  { name: 'TIN সার্টিফিকেট আবেদন', category: 'online_application', price: 150, maxPrice: 200, unit: 'per_application' },
  { name: 'BMET আবেদন (ট্রেনিংসহ)', category: 'online_application', price: 300, unit: 'per_application', notes: 'সরকারি চার্জ ব্যতীত' },
  { name: 'স্ট্যাম্প প্রিন্ট', category: 'online_application', price: 80, maxPrice: 100, unit: 'per_item' },
  
  // Result/Admit Card
  { name: 'রেজাল্ট/এডমিট কার্ড (সাদা-কালো)', category: 'result_card', price: 20, unit: 'per_item' },
  { name: 'রেজাল্ট/এডমিট কার্ড (কালার)', category: 'result_card', price: 30, unit: 'per_item' },
  
  // Compose & Applications
  { name: 'বাংলা কম্পোজ', category: 'compose', price: 20, maxPrice: 100, unit: 'per_page', notes: 'সাধারণ কম্পোজের ন্যূনতম চার্জ ৩০ টাকা' },
  { name: 'দরখাস্ত (বড়/জটিল)', category: 'compose', price: 50, maxPrice: 200, unit: 'per_item' },
  
  // CV Services
  { name: 'ইংরেজি CV (২ পাতা)', category: 'cv', price: 100, unit: 'per_cv' },
  { name: 'বাংলা CV (১ পাতা)', category: 'cv', price: 30, maxPrice: 50, unit: 'per_cv' },
  { name: 'বিদেশি CV', category: 'cv', price: 200, unit: 'per_cv' },
  
  // Data Entry
  { name: 'ডেটা এন্ট্রি (৪-৫ কলাম)', category: 'data_entry', price: 3, maxPrice: 4, unit: 'per_cell' },
  
  // ID Card
  { name: 'অনলাইন আইডি কার্ড (লেমিনেশনসহ)', category: 'id_card', price: 100, unit: 'per_card' }
];

async function seedServices() {
  try {
    await mongoose.connect('mongodb://localhost:27017/kdpo');
    console.log('Connected to MongoDB');
    
    await Service.deleteMany({});
    console.log('Cleared existing services');
    
    await Service.insertMany(services);
    console.log(`Added ${services.length} services successfully`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding services:', error);
    process.exit(1);
  }
}

seedServices();