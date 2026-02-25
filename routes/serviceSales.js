const express = require('express');
const ServiceSale = require('../models/ServiceSale');
const Service = require('../models/Service');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/service-sales/stats
// @desc    Get service sales statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await ServiceSale.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalStats = await ServiceSale.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      today: todayStats[0] || { totalSales: 0, totalPaid: 0, totalDue: 0, count: 0 },
      total: totalStats[0] || { totalSales: 0, totalPaid: 0, totalDue: 0, count: 0 }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/service-sales
// @desc    Get all service sales
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, paymentStatus, serviceId, customerId, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    let query = {};
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (serviceId) query.service = serviceId;
    if (customerId) query.customer = customerId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    let sortObj = {};
    if (sortBy === 'amount') {
      sortObj.totalAmount = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'quantity') {
      sortObj.quantity = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortObj.createdAt = sortOrder === 'desc' ? -1 : 1;
    }

    const sales = await ServiceSale.find(query)
      .populate('service', 'name category')
      .populate('customer', 'name phone')
      .populate('handledBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sortObj);

    const total = await ServiceSale.countDocuments(query);

    res.json({
      sales,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/service-sales
// @desc    Create service sale
// @access  Private
router.post('/', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { serviceId, quantity, unitPrice, customer, paymentStatus, paidAmount, notes } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    let customerData = null;
    if (customer && customer.trim()) {
      customerData = await User.findById(customer);
      if (!customerData) {
        return res.status(404).json({ message: 'Customer not found' });
      }
    }

    const totalAmount = quantity * unitPrice;
    const paidAmt = paidAmount || (paymentStatus === 'paid' ? totalAmount : 0);
    const dueAmount = totalAmount - paidAmt;

    const sale = new ServiceSale({
      service: serviceId,
      serviceName: service.name,
      quantity,
      unitPrice,
      totalAmount,
      customer: customerData ? customer : null,
      customerName: customerData ? customerData.name : 'Walk-in Customer',
      customerPhone: customerData ? customerData.phone : null,
      paymentStatus: paymentStatus || 'paid',
      paidAmount: paidAmt,
      dueAmount: Math.max(0, dueAmount),
      notes,
      handledBy: req.user.id
    });

    await sale.save();

    // Update customer due amount if there's any due and customer exists
    if (dueAmount > 0 && customerData) {
      customerData.dueAmount = (customerData.dueAmount || 0) + dueAmount;
      await customerData.save();
    }

    // Only populate if customer exists
    const populateFields = ['service', 'handledBy'];
    if (sale.customer) {
      populateFields.push('customer');
    }
    await sale.populate(populateFields);

    res.status(201).json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/service-sales/:id
// @desc    Update service sale
// @access  Private
router.put('/:id', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { paidAmount, paymentStatus, notes } = req.body;
    
    const sale = await ServiceSale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    if (paidAmount !== undefined) {
      sale.paidAmount = paidAmount;
      sale.dueAmount = Math.max(0, sale.totalAmount - paidAmount);
      
      if (sale.dueAmount === 0) {
        sale.paymentStatus = 'paid';
      } else if (sale.paidAmount > 0) {
        sale.paymentStatus = 'partial';
      } else {
        sale.paymentStatus = 'due';
      }
    }

    if (paymentStatus) sale.paymentStatus = paymentStatus;
    if (notes !== undefined) sale.notes = notes;

    await sale.save();
    await sale.populate(['service', 'customer', 'handledBy']);

    res.json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;