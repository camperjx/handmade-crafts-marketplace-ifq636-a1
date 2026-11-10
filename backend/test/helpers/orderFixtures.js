const fs = require('fs');
const path = require('path');
const { randomBytes, randomUUID } = require('crypto');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const DATABASE = 'hm_s12_s14_test';
function configureOrderTestEnvironment() {
  if (process.env.RUN_ORDER_DB_TESTS !== '1') throw new Error('Order test database access requires explicit opt-in.');
  let settings;
  try { settings = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../../.env.s12-s14-test.local'))); }
  catch { throw new Error('Private Order test configuration is missing.'); }
  let valid = false;
  try { const uri = new URL(settings.ORDER_TEST_MONGO_URI); valid = ['mongodb:', 'mongodb+srv:'].includes(uri.protocol) && uri.pathname === '/' + DATABASE && !uri.searchParams.has('dbName'); } catch { /* Safe error below. */ }
  if (!valid) throw new Error('Use the dedicated hm_s12_s14_test database.');
  if (!settings.ORDER_TEST_JWT_SECRET || settings.ORDER_TEST_JWT_SECRET.length < 32) throw new Error('Configure a separate test signing secret of at least 32 characters.');
  process.env.MONGO_URI = settings.ORDER_TEST_MONGO_URI;
  process.env.JWT_SECRET = settings.ORDER_TEST_JWT_SECRET;
  return settings.ORDER_TEST_MONGO_URI;
}
async function connectOrderTestDatabase(uri) {
  try { mongoose.set('strictQuery', true); await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 }); }
  catch { throw new Error('Dedicated Order test database is unavailable. Check approved connectivity.'); }
  if (mongoose.connection.name !== DATABASE) { await mongoose.disconnect(); throw new Error('Refusing to use a different database.'); }
  await Promise.all([User.init(), Product.init(), Order.init()]);
}
function fixtureScope() {
  const prefix = 's14-' + randomUUID();
  const emails = new Set();
  const identity = (label, role) => {
    const email = prefix + '-' + label + '@example.com'; emails.add(email);
    return { name: 'S14 ' + label, email, password: randomBytes(24).toString('hex'), role };
  };
  async function cleanup() {
    if (mongoose.connection.readyState !== 1 || mongoose.connection.name !== DATABASE) throw new Error('Cleanup requires the verified test connection.');
    const users = await User.find({ email: { $in: [...emails] } }).select('_id').lean();
    const ids = users.map(user => user._id);
    const orderScope = { $or: [{ buyerId: { $in: ids } }, { sellerId: { $in: ids } }] };
    const orders = await Order.find(orderScope).select('_id').lean();
    const products = await Product.find({ sellerId: { $in: ids } }).select('_id').lean();
    await Order.deleteMany({ _id: { $in: orders.map(row => row._id) }, ...orderScope });
    await Product.deleteMany({ _id: { $in: products.map(row => row._id) }, sellerId: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids }, email: { $in: [...emails] } });
    const remainingUsers = await User.countDocuments({ email: { $in: [...emails] } });
    const remainingProducts = await Product.countDocuments({ sellerId: { $in: ids } });
    const remainingOrders = await Order.countDocuments(orderScope);
    if (remainingUsers || remainingProducts || remainingOrders) throw new Error('Scoped fixture cleanup was incomplete.');
    return { removedUsers: users.length, removedProducts: products.length, removedOrders: orders.length, remainingUsers, remainingProducts, remainingOrders };
  }
  return { prefix, identity, cleanup };
}
module.exports = { DATABASE, configureOrderTestEnvironment, connectOrderTestDatabase, fixtureScope };
