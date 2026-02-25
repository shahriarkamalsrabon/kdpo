const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['photocopy', 'photo', 'online_application', 'printing', 'scanning', 'lamination', 'cv', 'data_entry', 'id_card', 'compose', 'result_card', 'other'],
    required: true
  },
  description: {
    type: String
  },
  price: {
    type: Number,
    required: true
  },
  maxPrice: {
    type: Number
  },
  unit: {
    type: String,
    default: 'per_item'
  },
  notes: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);