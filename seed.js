// Run once:  npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

const products = [
  { name: 'Wireless Headphones', description: 'Bluetooth over-ear headphones with 30h battery.', price: 1999, category: 'Electronics', stock: 25, image: 'https://picsum.photos/seed/headphones/400/300' },
  { name: 'Smart Watch', description: 'Fitness tracking, heart-rate monitor, water resistant.', price: 2999, category: 'Electronics', stock: 15, image: 'https://picsum.photos/seed/watch/400/300' },
  { name: 'Running Shoes', description: 'Lightweight shoes for daily running.', price: 1499, category: 'Fashion', stock: 40, image: 'https://picsum.photos/seed/shoes/400/300' },
  { name: 'Backpack', description: '25L water-resistant laptop backpack.', price: 899, category: 'Fashion', stock: 30, image: 'https://picsum.photos/seed/backpack/400/300' },
  { name: 'Java Programming Book', description: 'Beginner friendly guide to Java and DSA.', price: 549, category: 'Books', stock: 50, image: 'https://picsum.photos/seed/book/400/300' },
  { name: 'Desk Lamp', description: 'LED lamp with adjustable brightness.', price: 699, category: 'Home', stock: 20, image: 'https://picsum.photos/seed/lamp/400/300' },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany(), Product.deleteMany(), Order.deleteMany()]);
  await User.create({ name: 'Admin', email: 'admin@store.com', password: 'admin123', role: 'admin' });
  await User.create({ name: 'Demo User', email: 'user@store.com', password: 'user123', role: 'user' });
  await Product.insertMany(products);
  console.log('Seeded!  Admin: admin@store.com / admin123   User: user@store.com / user123');
  await mongoose.disconnect();
})();
