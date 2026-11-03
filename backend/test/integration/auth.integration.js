// Explicit opt-in: writes only UUID-namespaced accounts to the configured dev DB.
const { randomUUID, randomBytes } = require('crypto');
const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const User = require('../../models/User');
chai.use(chaiHttp);
const { expect } = chai;
const suite = process.env.RUN_AUTH_DB_TESTS === '1' ? describe : describe.skip;

suite('S07 real MongoDB auth integration (dedicated temporary accounts)', function () {
  this.timeout(30000);
  const prefix = 's07-' + randomUUID();
  const password = randomBytes(18).toString('hex');
  const emails = new Set();
  const accounts = {};
  const register = (label, role) => {
    const email = prefix + '-' + label + '@example.com'; emails.add(email);
    return chai.request(app).post('/api/auth/register').send({ name: 'S07 ' + label, email, password, ...(role === undefined ? {} : { role }) });
  };
  const login = email => chai.request(app).post('/api/auth/login').send({ email, password });
  const profile = (token, body) => {
    const request = body === undefined ? chai.request(app).get('/api/auth/profile') : chai.request(app).put('/api/auth/profile');
    if (token) request.set('Authorization', 'Bearer ' + token);
    return body === undefined ? request : request.send(body);
  };
  before(async function () {
    if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('Configure a development MongoDB and JWT secret before opting in.');
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    await User.init();
  });
  after(async function () {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: { $in: [...emails] } });
      expect(await User.countDocuments({ email: { $in: [...emails] } })).to.equal(0);
    }
    await mongoose.disconnect();
  });
  it('persists Buyer and Seller registration and a single bcrypt hash', async function () {
    for (const role of ['buyer', 'seller']) {
      const response = await register(role, role); expect(response.status).to.equal(201);
      expect(response.body.role).to.equal(role); expect(response.body).not.to.have.property('token');
      const raw = await User.findById(response.body.id).lean();
      expect(raw.role).to.equal(role); expect(await bcrypt.compare(password, raw.password)).to.equal(true);
      accounts[role] = response.body;
    }
  });
  it('persists the omitted-role default', async function () {
    const response = await register('default'); expect(response.status).to.equal(201);
    expect((await User.findById(response.body.id).lean()).role).to.equal('buyer');
  });
  it('rejects invalid roles and malformed fields without creating accounts', async function () {
    const invalid = [null, '', 'admin', {}, [], 4];
    for (let i = 0; i < invalid.length; i++) {
      const response = await register('invalid-' + i, invalid[i]); expect(response.status).to.equal(400);
    }
    for (const bad of [{ name: ' ' }, { email: {} }, { password: 'short' }, { password: '🙂'.repeat(19) }]) {
      const email = prefix + '-invalid-field-' + emails.size + '@example.com'; emails.add(email);
      const response = await chai.request(app).post('/api/auth/register').send({ name: 'Invalid', email, password, role: 'buyer', ...bad });
      expect(response.status).to.equal(400);
    }
    expect(await User.countDocuments({ email: { $in: [...emails].filter(e => e.includes('-invalid-')) } })).to.equal(0);
  });
  it('normalizes duplicate emails and handles simultaneous registration', async function () {
    const duplicate = await chai.request(app).post('/api/auth/register').send({ name: 'Duplicate', email: ' ' + accounts.buyer.email.toUpperCase() + ' ', password, role: 'seller' });
    expect(duplicate.status).to.equal(409);
    const responses = await Promise.all([register('race', 'buyer'), register('race', 'buyer')]);
    expect(responses.map(r => r.status).sort()).to.deep.equal([201, 409]);
    expect(await User.countDocuments({ email: prefix + '-race@example.com' })).to.equal(1);
  });
  it('logs both roles in using their persisted account identity', async function () {
    for (const role of ['buyer', 'seller']) {
      const response = await login(accounts[role].email); expect(response.status).to.equal(200);
      expect(response.body.role).to.equal(role); expect(response.body.token).to.be.a('string');
      accounts[role].token = response.body.token;
    }
  });
  it('rejects wrong and missing-account credentials consistently', async function () {
    const a = await chai.request(app).post('/api/auth/login').send({ email: accounts.buyer.email, password: 'wrong password' });
    const b = await chai.request(app).post('/api/auth/login').send({ email: prefix + '-absent@example.com', password: 'wrong password' });
    expect(a.status).to.equal(401); expect(b.status).to.equal(401); expect(a.body).to.deep.equal(b.body);
  });
  it('returns only the current safe profile and rejects missing/expired authentication', async function () {
    const response = await profile(accounts.buyer.token); expect(response.status).to.equal(200);
    expect(Object.keys(response.body).sort()).to.deep.equal(['address', 'email', 'id', 'name', 'role']);
    expect((await profile()).status).to.equal(401);
    const expired = jwt.sign({ id: accounts.buyer.id }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: -10 });
    expect((await profile(expired)).status).to.equal(401);
  });
  it('persists profile updates without changing the password hash', async function () {
    const before = await User.findById(accounts.buyer.id).lean();
    const response = await profile(accounts.buyer.token, { name: 'Updated S07 Buyer', address: 'Brisbane' });
    expect(response.status).to.equal(200); expect(response.body).not.to.have.property('token');
    const after = await User.findById(accounts.buyer.id).lean();
    expect(after.name).to.equal('Updated S07 Buyer'); expect(after.address).to.equal('Brisbane');
    expect(before.password === after.password).to.equal(true);
  });
  it('rejects an entire role-smuggling update and retains persisted identity', async function () {
    expect((await profile(accounts.buyer.token, { role: 'seller', name: 'Must not save' })).status).to.equal(400);
    const raw = await User.findById(accounts.buyer.id).lean();
    expect(raw.role).to.equal('buyer'); expect(raw.name).to.equal('Updated S07 Buyer');
  });
  it('preserves profile after duplicate-email failure and permits clearing address', async function () {
    expect((await profile(accounts.buyer.token, { email: accounts.seller.email })).status).to.equal(409);
    expect((await User.findById(accounts.buyer.id).lean()).email).to.equal(accounts.buyer.email);
    expect((await profile(accounts.buyer.token, { address: '' })).status).to.equal(200);
    expect((await User.findById(accounts.buyer.id).lean()).address).to.equal('');
  });
  it('still reads the saved profile after a database client reconnect', async function () {
    await mongoose.disconnect();
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const response = await profile(accounts.buyer.token);
    expect(response.status).to.equal(200); expect(response.body.name).to.equal('Updated S07 Buyer');
  });
  it('rejects a token whose dedicated temporary User has been deleted', async function () {
    const created = await register('deleted', 'buyer'); const signedIn = await login(created.body.email);
    const removed = await User.deleteOne({ _id: created.body.id, email: created.body.email });
    expect(removed.deletedCount).to.equal(1); expect((await profile(signedIn.body.token)).status).to.equal(401);
  });
  it('rejects a legacy missing role instead of silently applying a schema default', async function () {
    const created = await register('legacy', 'buyer'); const signedIn = await login(created.body.email);
    await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(created.body.id), email: created.body.email }, { $unset: { role: '' } });
    expect((await login(created.body.email)).status).to.equal(403);
    expect((await profile(signedIn.body.token)).status).to.equal(403);
  });
});
