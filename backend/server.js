const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/authRoutes'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ code: 'INVALID_JSON', message: 'Send a valid JSON object.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ code: 'BODY_TOO_LARGE', message: 'This request is too large.' });
  return res.status(500).json({ code: 'SERVER_ERROR', message: 'We could not complete this request. Please try again.' });
});
async function start() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('Missing required server configuration.');
  await connectDB();
  await require('./models/User').init();
  const port = process.env.PORT || 5001;
  app.listen(port, () => console.log('Server running on port ' + port));
}
if (require.main === module) start().catch(() => {
  console.error('Server could not start. Check database access and required configuration.');
  process.exitCode = 1;
});
module.exports = app;
