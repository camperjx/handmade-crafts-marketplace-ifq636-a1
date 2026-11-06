const { randomBytes } = require('crypto');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Product = require('../models/Product');
const app = require('../server');
chai.use(chaiHttp);
const { expect } = chai;
const lean = value => ({ lean: async () => value });
const input = { title: 'Ceramic mug', description: 'Handmade mug', category: 'Ceramics', priceCents: 2500 };

describe('S08 Product HTTP contracts (real routes, isolated database)', function () {
  const ids = { seller: 'a'.repeat(24), other: 'b'.repeat(24), buyer: 'c'.repeat(24), missing: 'f'.repeat(24) };
  const product = { ...input, _id: 'd'.repeat(24), sellerId: ids.seller, status: 'active', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') };
  let previousSecret, tokens;
  before(function () {
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex');
    tokens = Object.fromEntries(Object.entries(ids).map(([role, id]) => [role, jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '5m', algorithm: 'HS256' })]));
  });
  after(function () { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  beforeEach(function () {
    sinon.stub(User, 'findById').callsFake(id => ({ select: () => lean(
      id === ids.missing ? null : { _id: id, role: id === ids.buyer ? 'buyer' : 'seller' }
    ) }));
  });
  afterEach(function () { sinon.restore(); });
  function call(method, path = '', role, body) {
    const request = chai.request(app)[method]('/api/products' + path);
    if (role !== undefined) request.set('Authorization', 'Bearer ' + (tokens[role] || role));
    return body === undefined ? request : request.send(body);
  }
  const stubRead = value => sinon.stub(Product, 'findById').returns(lean(value));
  const dtoKeys = ['id','sellerId','title','description','category','priceCents','status','createdAt','updatedAt'].sort();

  it('returns an explicit empty public list and never trusts query filters', async function () {
    const sort = sinon.stub().returns(lean([])); const find = sinon.stub(Product, 'find').returns({ sort });
    const response = await call('get', '?status=archived&sellerId=' + ids.other);
    expect(response.status).to.equal(200); expect(response.body).to.deep.equal({ products: [] });
    expect(find.firstCall.args[0]).to.deep.equal({ status: 'active' });
  });
  it('returns safe public product DTOs', async function () {
    sinon.stub(Product, 'find').returns({ sort: () => lean([{ ...product, __v: 2, password: 'private' }]) });
    const response = await call('get');
    expect(response.status).to.equal(200); expect(Object.keys(response.body.products[0]).sort()).to.deep.equal(dtoKeys);
  });
  it('routes mine before id and filters by verified identity', async function () {
    const find = sinon.stub(Product, 'find').returns({ sort: () => lean([{ ...product, status: 'archived' }]) });
    const response = await call('get', '/mine', 'seller');
    expect(response.status).to.equal(200); expect(response.body.products[0].status).to.equal('archived');
    expect(find.firstCall.args[0]).to.deep.equal({ sellerId: ids.seller });
  });
  for (const [role, status] of [[undefined,401],['buyer',403]]) it('denies mine to ' + String(role), async function () {
    const find = sinon.stub(Product, 'find');
    expect((await call('get','/mine',role)).status).to.equal(status); sinon.assert.notCalled(find);
  });
  for (const role of [undefined,'buyer','seller','other']) it('allows active detail for ' + String(role), async function () {
    stubRead(product); const response = await call('get','/'+product._id,role);
    expect(response.status).to.equal(200); expect(Object.keys(response.body.product).sort()).to.deep.equal(dtoKeys);
  });
  for (const role of [undefined,'buyer','other']) it('hides archived detail from ' + String(role), async function () {
    stubRead({ ...product, status: 'archived' });
    expect((await call('get','/'+product._id,role)).status).to.equal(404);
  });
  it('allows the authenticated owner to read archived detail', async function () {
    stubRead({ ...product, status: 'archived' });
    expect((await call('get','/'+product._id,'seller')).status).to.equal(200);
  });
  for (const id of ['bad','a'.repeat(12),'a'.repeat(23),'z'.repeat(24)]) it('rejects malformed Product ID '+id, async function () {
    const find = sinon.stub(Product,'findById');
    expect((await call('get','/'+id)).status).to.equal(400);
    expect((await call('patch','/'+id,'seller',{priceCents:3000})).status).to.equal(400);
    sinon.assert.notCalled(find);
  });
  it('distinguishes valid-but-missing IDs from malformed IDs', async function () {
    stubRead(null);
    expect((await call('get','/'+product._id)).status).to.equal(404);
    expect((await call('patch','/'+product._id,'seller',{priceCents:3000})).status).to.equal(404);
  });
  it('creates with server-derived owner/status and a safe response', async function () {
    const create = sinon.stub(Product,'create').resolves(product);
    const response = await call('post','','seller',input);
    expect(response.status).to.equal(201); expect(Object.keys(response.body.product).sort()).to.deep.equal(dtoKeys);
    expect(create.firstCall.args[0]).to.deep.equal({ ...input,sellerId:ids.seller,status:'active' });
  });
  for (const [role, status] of [[undefined,401],['buyer',403],['missing',401]]) it('rejects writes for '+String(role)+' before DB mutation', async function () {
    const create = sinon.stub(Product,'create'), update = sinon.stub(Product,'findOneAndUpdate'), read = sinon.stub(Product,'findById');
    expect((await call('post','',role,input)).status).to.equal(status);
    expect((await call('patch','/bad-id',role,{priceCents:3000})).status).to.equal(status);
    sinon.assert.notCalled(create); sinon.assert.notCalled(update); sinon.assert.notCalled(read);
  });
  for (const body of [{...input,sellerId:ids.seller},{...input,status:'active'},{...input,priceCents:'2500'},{...input,title:' '},[]]) it('rejects invalid creation without a write', async function () {
    const create=sinon.stub(Product,'create');
    expect((await call('post','','seller',body)).status).to.equal(400); sinon.assert.notCalled(create);
  });
  it('denies another Seller edit/archive before mutation', async function () {
    stubRead(product); const update=sinon.stub(Product,'findOneAndUpdate');
    for(const body of [{priceCents:3000},{status:'archived'}]) expect((await call('patch','/'+product._id,'other',body)).status).to.equal(403);
    sinon.assert.notCalled(update);
  });
  for(const body of [{},{title:'Valid',sellerId:ids.other},{title:'Valid',priceCents:1.1},{status:'active'},{'$set':{priceCents:1}}]) it('rejects the entire invalid patch without a write',async function(){
    stubRead(product);const update=sinon.stub(Product,'findOneAndUpdate');
    expect((await call('patch','/'+product._id,'seller',body)).status).to.equal(400);sinon.assert.notCalled(update);
  });
  it('constrains updates by id, owner and active state and returns the new data',async function(){
    stubRead(product);const update=sinon.stub(Product,'findOneAndUpdate').returns(lean({...product,priceCents:3000}));
    const response=await call('patch','/'+product._id,'seller',{priceCents:3000});
    expect(response.status).to.equal(200);expect(response.body.product.priceCents).to.equal(3000);
    expect(update.firstCall.args).to.deep.equal([{_id:product._id,sellerId:ids.seller,status:'active'},{$set:{priceCents:3000}},{new:true,runValidators:true}]);
  });
  it('archives through the same conditional update',async function(){
    stubRead(product);const update=sinon.stub(Product,'findOneAndUpdate').returns(lean({...product,status:'archived'}));
    expect((await call('patch','/'+product._id,'seller',{status:'archived'})).body.product.status).to.equal('archived');
    expect(update.firstCall.args[1]).to.deep.equal({$set:{status:'archived'}});
  });
  it('conflicts on an archived edit or repeated archive without mutation',async function(){
    stubRead({...product,status:'archived'});const update=sinon.stub(Product,'findOneAndUpdate');
    for(const body of [{priceCents:3000},{status:'archived'}]) expect((await call('patch','/'+product._id,'seller',body)).status).to.equal(409);
    sinon.assert.notCalled(update);
  });
  it('rechecks state when a concurrent archive defeats the conditional update',async function(){
    const read=sinon.stub(Product,'findById'); read.onFirstCall().returns(lean(product));read.onSecondCall().returns(lean({...product,status:'archived'}));
    sinon.stub(Product,'findOneAndUpdate').returns(lean(null));
    expect((await call('patch','/'+product._id,'seller',{priceCents:3000})).status).to.equal(409);
  });
  it('rechecks deletion when a conditional write no longer matches',async function(){
    const read=sinon.stub(Product,'findById');read.onFirstCall().returns(lean(product));read.onSecondCall().returns(lean(null));
    sinon.stub(Product,'findOneAndUpdate').returns(lean(null));
    expect((await call('patch','/'+product._id,'seller',{priceCents:3000})).status).to.equal(404);
  });
  for(const token of ['invalid','missing']) it('does not downgrade supplied invalid authentication to anonymous: '+token,async function(){
    const find=sinon.stub(Product,'find');
    expect((await call('get','',token)).status).to.equal(401);sinon.assert.notCalled(find);
  });
  it('rejects an expired token on the real Product endpoint',async function(){
    const expired=jwt.sign({id:ids.seller},process.env.JWT_SECRET,{expiresIn:-10});
    expect((await call('post','',expired,input)).status).to.equal(401);
  });
  it('safely handles DB rejection rather than leaking details',async function(){
    sinon.stub(Product,'find').returns({sort:()=>({lean:async()=>{throw new Error('private database detail');}})});
    const response=await call('get');expect(response.status).to.equal(500);expect(JSON.stringify(response.body)).not.to.include('private');
  });
  it('maps model validation errors to safe field feedback',async function(){
    sinon.stub(Product,'create').rejects(Object.assign(new Error('private validation detail'),{name:'ValidationError',errors:{priceCents:{message:'private'}}}));
    const response=await call('post','','seller',input);expect(response.status).to.equal(400);expect(response.body.errors).to.have.property('priceCents');expect(JSON.stringify(response.body)).not.to.include('private');
  });
  it('preserves JSON-parser errors, body limits and API 404 JSON',async function(){
    expect((await chai.request(app).post('/api/products').set('Content-Type','application/json').send('{')).status).to.equal(400);
    expect((await call('post','','seller',{...input,description:'x'.repeat(110000)})).status).to.equal(413);
    const missing=await chai.request(app).get('/api/no-such-route');expect(missing.status).to.equal(404);expect(missing.body.code).to.equal('API_NOT_FOUND');
  });
});
