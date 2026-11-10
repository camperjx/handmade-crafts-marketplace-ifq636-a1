const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();
const production = process.env.NODE_ENV === 'production';
const buildDir = path.resolve(__dirname, '../frontend/build');

if (!production) app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.set('Cache-Control', 'no-store');
  res.status(ready ? 200 : 503).json({
    service: 'handmade-crafts-marketplace',
    status: ready ? 'ready' : 'unavailable',
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api', (req, res) => res.status(404).json({ code: 'API_NOT_FOUND', message: 'This API route does not exist.' }));

if (production) {
  app.use(express.static(buildDir, { index: false }));
  const frontendPaths = [
    '/', '/login', '/register', '/profile', '/products',
    '/seller/products', '/seller/products/new',
    /^\/products\/[a-f\d]{24}\/?$/i,
    /^\/seller\/products\/[a-f\d]{24}\/edit\/?$/i,
  ];
  app.get(frontendPaths, (req, res, next) => {
    if (!req.accepts('html')) return next();
    res.set('Cache-Control', 'no-store');
    return res.sendFile(path.join(buildDir, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({
  code: 'RESOURCE_NOT_FOUND', message: 'This resource does not exist.',
}));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ code: 'INVALID_JSON', message: 'Send a valid JSON object.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ code: 'BODY_TOO_LARGE', message: 'This request is too large.' });
  if (error.name === 'ValidationError') {
    const errors = {};
    for (const field of ['title', 'description', 'category', 'priceCents', 'status', 'productId', 'quantity', 'expectedStatus', 'unitPriceCents', 'totalCents', 'productTitle']) {
      if (error.errors?.[field]) errors[field] = 'Enter a valid value.';
    }
    if (!Object.keys(errors).length) errors._form = 'Please check the submitted values.';
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', errors });
  }
  if (error.name === 'CastError') return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Please check the submitted values.' });
  return res.status(500).json({ code: 'SERVER_ERROR', message: 'We could not complete this request. Please try again.' });
});
async function start() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('Missing required server configuration.');
  const port = Number(process.env.PORT || 5001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
  if (production && !fs.existsSync(path.join(buildDir, 'index.html'))) {
    throw new Error('Production frontend build is missing.');
  }
  await connectDB();
  await require('./models/User').init();
  await require('./models/Product').init();
  await require('./models/Order').init();
  const server = app.listen(port, () => console.log('Server running on port ' + port));
  server.once('error', async () => {
    console.error('Server could not listen. Check the configured port and existing process.');
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
if (require.main === module) start().catch(async () => {
  console.error('Server could not start. Check configuration, database access and the production build.');
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
module.exports = app;
