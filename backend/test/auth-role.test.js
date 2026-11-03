const { randomBytes } = require('crypto');
const express = require('express');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
chai.use(chaiHttp);
const { expect } = chai;

describe('S07 authentication and role middleware (isolated DB)', function () {
  const ids = Object.fromEntries(['buyer', 'seller', 'legacy', 'missing', 'outage', 'invalid'].map((r, i) => [r, String(i + 1).repeat(24)]));
  const users = {
    [ids.buyer]: { _id: ids.buyer, role: 'buyer' }, [ids.seller]: { _id: ids.seller, role: 'seller' },
    [ids.legacy]: { _id: ids.legacy }, [ids.invalid]: { _id: ids.invalid, role: 'admin' },
  };
  let app, secret, previousSecret;
  const tokenFor = (id, extra = {}, options = {}) => jwt.sign({ id, ...extra }, secret, { algorithm: 'HS256', expiresIn: '5m', ...options });
  before(function () { previousSecret = process.env.JWT_SECRET; secret = randomBytes(32).toString('hex'); process.env.JWT_SECRET = secret; });
  after(function () { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  beforeEach(function () {
    sinon.stub(User, 'findById').callsFake(id => ({ select: () => ({ lean: async () => {
      if (id === ids.outage) throw new Error('simulated database outage');
      return users[id] || null;
    } }) }));
    app = express();
    app.get('/seller-only', protect, authorize('seller'), (req, res) => res.json({ role: req.user.role }));
  });
  afterEach(function () { sinon.restore(); });
  const call = token => {
    const request = chai.request(app).get('/seller-only');
    return token ? request.set('Authorization', 'Bearer ' + token) : request;
  };
  it('rejects missing credentials before querying DB', async function () {
    expect((await call()).status).to.equal(401); sinon.assert.notCalled(User.findById);
  });
  for (const header of ['Bearer', 'BearerXYZ abc', 'Bearer a b']) it('rejects malformed authorization: ' + header, async function () {
    expect((await chai.request(app).get('/seller-only').set('Authorization', header)).status).to.equal(401);
    sinon.assert.notCalled(User.findById);
  });
  it('rejects invalid signatures', async function () { expect((await call('not-a-jwt')).status).to.equal(401); });
  it('rejects a genuinely expired signed token', async function () { expect((await call(tokenFor(ids.seller, {}, { expiresIn: -10 }))).status).to.equal(401); });
  it('rejects a different signing algorithm', async function () { expect((await call(tokenFor(ids.seller, {}, { algorithm: 'HS384' }))).status).to.equal(401); });
  it('rejects invalid token User IDs before querying DB', async function () {
    expect((await call(tokenFor('not-an-object-id'))).status).to.equal(401); sinon.assert.notCalled(User.findById);
  });
  it('rejects a deleted account', async function () { expect((await call(tokenFor(ids.missing))).status).to.equal(401); });
  for (const role of ['legacy', 'invalid']) it('rejects persisted ' + role + ' role', async function () {
    const response = await call(tokenFor(ids[role]));
    expect(response.status).to.equal(403); expect(response.body.code).to.equal('ACCOUNT_ROLE_UNAVAILABLE');
  });
  it('rejects a Buyer regardless of the visible UI', async function () { expect((await call(tokenFor(ids.buyer))).status).to.equal(403); });
  it('uses DB role rather than a signed token role claim', async function () { expect((await call(tokenFor(ids.buyer, { role: 'seller' }))).status).to.equal(403); });
  it('permits a persisted Seller', async function () {
    const response = await call(tokenFor(ids.seller)); expect(response.status).to.equal(200); expect(response.body.role).to.equal('seller');
  });
  it('returns service failure rather than 401 on DB outage', async function () {
    const response = await call(tokenFor(ids.outage)); expect(response.status).to.equal(500);
    expect(JSON.stringify(response.body)).not.to.include('simulated database');
  });
});
