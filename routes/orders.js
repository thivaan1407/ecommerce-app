const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();
const STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

// POST /api/orders   (checkout) body: { items:[{product, qty}], shippingAddress, paymentMethod }
// Prices are always read from the database, never trusted from the client.
router.post('/', protect, async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Cart is empty' });
  }
  if (!shippingAddress || !shippingAddress.trim()) {
    return res.status(400).json({ message: 'Shipping address is required' });
  }

  const reserved = []; // products whose stock we already reduced (for rollback)
  try {
    const orderItems = [];
    let total = 0;

    for (const it of items) {
      const qty = parseInt(it.qty, 10);
      if (!mongoose.isValidObjectId(it.product) || !(qty > 0)) {
        throw Object.assign(new Error('Invalid cart item'), { status: 400 });
      }
      // Atomic check-and-decrement so stock never goes negative
      const product = await Product.findOneAndUpdate(
        { _id: it.product, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!product) {
        throw Object.assign(new Error('A product is unavailable or has not enough stock'), { status: 400 });
      }
      reserved.push({ id: product._id, qty });
      orderItems.push({ product: product._id, name: product.name, price: product.price, qty });
      total += product.price * qty;
    }

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress: shippingAddress.trim(),
      paymentMethod: paymentMethod || 'Cash on Delivery',
      total: Math.round(total * 100) / 100,
    });
    res.status(201).json(order);
  } catch (err) {
    // roll back stock reservations
    for (const r of reserved) await Product.findByIdAndUpdate(r.id, { $inc: { stock: r.qty } });
    res.status(err.status || 500).json({ message: err.message });
  }
});

// GET /api/orders/mine   (logged-in user's own orders = order tracking)
router.get('/mine', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders   (admin: all orders)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/orders/:id/status   (admin) body: { status }
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status === 'Cancelled' && status !== 'Cancelled') {
      return res.status(400).json({ message: 'Cancelled orders cannot be reopened' });
    }
    // Cancelling returns the stock
    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      for (const i of order.items) await Product.findByIdAndUpdate(i.product, { $inc: { stock: i.qty } });
    }
    order.status = status;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/orders/:id/cancel   (user can cancel own order while Pending)
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }
    for (const i of order.items) await Product.findByIdAndUpdate(i.product, { $inc: { stock: i.qty } });
    order.status = 'Cancelled';
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
