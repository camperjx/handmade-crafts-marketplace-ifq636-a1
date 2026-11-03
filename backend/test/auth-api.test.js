const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');
const User = require('../models/User');
const app = require('../server');
chai.use(chaiHttp);
const { expect } = chai;

describe('S07 auth API contracts (isolated DB)', function () {
  let user, token, previousSecret;
  const credentials = { name: 'Test Buyer', email: 'buyer@example.com', password: 'S07 example password', role: 'buyer' };
  before(async function () {
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex');
    user = { _id: 'a'.repeat(24), name: credentials.name, email: credentials.email, role: 'buyer', address: '', password: await bcrypt.hash(credentials.password, 10), university: 'legacy value' };
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  });
  after(function () { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  afterEach(function () { sinon.restore(); });
  const lean = value => ({ lean: async () => value });
  function protectAsUser() { sinon.stub(User, 'findById').returns({ select: () => lean(user) }); }
  const assertDto = body => { expect(Object.keys(body).sort()).to.deep.equal(['address', 'email', 'id', 'name', 'role']); };

  for (const bad of [null, [], 'admin', '', {}, 42]) it('rejects unsupported registration role ' + JSON.stringify(bad), async function () {
    const create = sinon.stub(User, 'create');
    expect((await chai.request(app).post('/api/auth/register').send({ ...credentials, role: bad })).status).to.equal(400);
    sinon.assert.notCalled(create);
  });
  for (const body of [{ ...credentials, name: ' ' }, { ...credentials, email: {} }, { ...credentials, password: 'short' }, { ...credentials, password: '🙂'.repeat(19) }, { ...credentials, sellerId: 'not-allowed' }]) {
    it('rejects invalid registration input without writing a User', async function () {
      const create = sinon.stub(User, 'create');
      expect((await chai.request(app).post('/api/auth/register').send(body)).status).to.equal(400);
      sinon.assert.notCalled(create);
    });
  }
  it('defaults an omitted role and normalizes email before creating', async function () {
    const find = sinon.stub(User, 'findOne').returns(lean(null)); const create = sinon.stub(User, 'create').resolves(user);
    const { role, ...body } = credentials;
    const response = await chai.request(app).post('/api/auth/register').send({ ...body, email: ' BUYER@EXAMPLE.COM ' });
    expect(response.status).to.equal(201); assertDto(response.body);
    expect(create.firstCall.args[0].role).to.equal('buyer'); expect(find.firstCall.args[0].email).to.equal('buyer@example.com');
  });
  it('maps a duplicate-key race to 409 without exposing database details', async function () {
    sinon.stub(User, 'findOne').returns(lean(null)); sinon.stub(User, 'create').rejects(Object.assign(new Error('private DB detail'), { code: 11000 }));
    const response = await chai.request(app).post('/api/auth/register').send(credentials);
    expect(response.status).to.equal(409); expect(JSON.stringify(response.body)).not.to.include('private DB');
  });
  it('returns persisted role and a token only on successful login', async function () {
    sinon.stub(User, 'findOne').returns(lean(user));
    const response = await chai.request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password });
    expect(response.status).to.equal(200); expect(response.body.role).to.equal('buyer'); expect(response.body.token).to.be.a('string');
    expect(response.body).not.to.have.property('password');
  });
  it('uses the same response for wrong password and missing account', async function () {
    const find = sinon.stub(User, 'findOne'); find.onFirstCall().returns(lean(user)); find.onSecondCall().returns(lean(null));
    const a = await chai.request(app).post('/api/auth/login').send({ email: credentials.email, password: 'wrong password' });
    const b = await chai.request(app).post('/api/auth/login').send({ email: 'missing@example.com', password: 'wrong password' });
    expect(a.status).to.equal(401); expect(b.status).to.equal(401); expect(a.body).to.deep.equal(b.body);
  });
  it('rejects a correct password if the persisted role is missing', async function () {
    const { role, ...legacy } = user; sinon.stub(User, 'findOne').returns(lean(legacy));
    expect((await chai.request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password })).status).to.equal(403);
  });
  it('never returns hash, token or legacy university on profile', async function () {
    protectAsUser(); const response = await chai.request(app).get('/api/auth/profile').set('Authorization', 'Bearer ' + token);
    expect(response.status).to.equal(200); assertDto(response.body);
  });
  for (const body of [{ role: 'seller', name: 'Must not save' }, { password: 'replacement' }, { university: 'not allowed' }, { _id: 'b'.repeat(24) }, {}, { address: null }]) {
    it('rejects the entire disallowed/empty profile update', async function () {
      protectAsUser(); const update = sinon.stub(User, 'findOneAndUpdate');
      expect((await chai.request(app).put('/api/auth/profile').set('Authorization', 'Bearer ' + token).send(body)).status).to.equal(400);
      sinon.assert.notCalled(update);
    });
  }
  it('allows an explicit empty address using a whitelisted validated query update', async function () {
    protectAsUser(); const update = sinon.stub(User, 'findOneAndUpdate').returns({ select: () => lean(user) });
    const response = await chai.request(app).put('/api/auth/profile').set('Authorization', 'Bearer ' + token).send({ address: '' });
    expect(response.status).to.equal(200); assertDto(response.body);
    expect(update.firstCall.args[1]).to.deep.equal({ $set: { address: '' } }); expect(update.firstCall.args[2].runValidators).to.equal(true);
  });
  it('returns safe JSON for malformed JSON', async function () {
    const response = await chai.request(app).post('/api/auth/register').set('Content-Type', 'application/json').send('{');
    expect(response.status).to.equal(400); expect(response.body.code).to.equal('INVALID_JSON');
  });
});
