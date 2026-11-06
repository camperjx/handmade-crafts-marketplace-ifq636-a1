const path = require('path');
const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Product = require('../../models/Product');

function configureProductTestEnvironment() {
  if (process.env.RUN_PRODUCT_DB_TESTS !== '1') throw new Error('Product DB verification requires explicit opt-in.');
  require('dotenv').config({ path: path.join(__dirname, '../../.env.s08-test.local') });
  const uri = process.env.PRODUCT_TEST_MONGO_URI;
  let correctDatabase = false;
  try { correctDatabase = new URL(uri).pathname === '/hm_s08_test'; } catch { /* Report only the safe configuration error below. */ }
  if (!correctDatabase) throw new Error('Configure PRODUCT_TEST_MONGO_URI with the dedicated hm_s08_test database.');
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  return uri;
}

async function connectProductTestDatabase(uri) {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  } catch { throw new Error('Dedicated Product test database is unavailable. Check local test configuration and approved network access.'); }
  if (mongoose.connection.name !== 'hm_s08_test') throw new Error('Refusing to write outside hm_s08_test.');
  await User.init();
  await Product.init();
}

async function cleanProductFixtures(emails) {
  if (mongoose.connection.readyState !== 1 || mongoose.connection.name !== 'hm_s08_test') {
    throw new Error('Fixture cleanup requires the verified Product test database connection.');
  }
  const scope = { email: { $in: [...emails] } };
  const users = await User.find(scope).select('_id').lean();
  const owners = users.map(user => user._id);
  const products = await Product.find({ sellerId: { $in: owners } }).select('_id').lean();
  await Product.deleteMany({ _id: { $in: products.map(product => product._id) }, sellerId: { $in: owners } });
  await User.deleteMany({ _id: { $in: owners }, ...scope });
  const remainingUsers = await User.countDocuments(scope);
  const remainingProducts = await Product.countDocuments({ sellerId: { $in: owners } });
  if (remainingUsers || remainingProducts) throw new Error('Product fixture cleanup was incomplete.');
  return { removedUsers: users.length, removedProducts: products.length, remainingUsers, remainingProducts };
}

module.exports = { configureProductTestEnvironment, connectProductTestDatabase, cleanProductFixtures };
