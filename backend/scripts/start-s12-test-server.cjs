const { spawn } = require('child_process');
const path = require('path');
const { configureOrderTestEnvironment } = require('../test/helpers/orderFixtures');
try {
  configureOrderTestEnvironment();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'), stdio: 'inherit',
    env: { ...process.env, PORT: '5004', NODE_ENV: process.argv.includes('--production') ? 'production' : 'development' },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (child.exitCode === null) child.kill(signal); });
  child.on('error', () => { console.error('The local test server could not start.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code || 0; });
} catch (error) { console.error(error.message); process.exitCode = 1; }
