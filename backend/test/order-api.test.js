const { randomBytes } = require('crypto');
const chai = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const app = require('../server');
chai.use(require('chai-http'));
const { expect } = chai;
const lean = value => ({ lean: async () => value });
describe('Order HTTP contracts with isolated model stubs', function () {
  const ids = { buyer: 'a'.repeat(24), seller: 'b'.repeat(24), other: 'c'.repeat(24) };
  const order = { _id: 'd'.repeat(24), buyerId: ids.buyer, sellerId: ids.seller, productId: 'e'.repeat(24), productTitle: 'Mug', unitPriceCents: 2500, quantity: 2, totalCents: 5000, status: 'pending' };
  let previous, tokens;
  before(function () { previous = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex'); tokens = Object.fromEntries(Object.entries(ids).map(([k,id]) => [k,jwt.sign({id},process.env.JWT_SECRET)])); });
  after(function () { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  beforeEach(function () { sinon.stub(User,'findById').callsFake(id => ({select:()=>lean({_id:id,role:id===ids.buyer?'buyer':'seller'})})); });
  afterEach(function () { sinon.restore(); });
  function call(method, suffix, role, body) { const req=chai.request(app)[method]('/api/orders'+suffix); if(role)req.set('Authorization','Bearer '+tokens[role]);return body===undefined?req:req.send(body); }
  it('denies anonymous requests and wrong roles before any write', async function () {
    const create=sinon.stub(Order,'create');
    expect((await call('post','',null,{})).status).to.equal(401);
    expect((await call('post','','seller',{})).status).to.equal(403);
    expect((await call('patch','/'+order._id+'/status','buyer',{})).status).to.equal(403);
    sinon.assert.notCalled(create);
  });
  it('filters lists by authenticated identity and never accepts widening queries', async function () {
    const find=sinon.stub(Order,'find').returns({sort:()=>lean([])});
    expect((await call('get','/mine','buyer')).body.orders).to.deep.equal([]);
    expect(find.firstCall.args[0]).to.deep.equal({buyerId:ids.buyer});
    expect((await call('get','/seller','seller')).status).to.equal(200);
    expect(find.lastCall.args[0]).to.deep.equal({sellerId:ids.seller});
    expect((await call('get','/mine?buyerId='+ids.other,'buyer')).status).to.equal(400);
    expect(find.callCount).to.equal(2);
  });
  it('derives a creation snapshot from the Product and authenticated Buyer', async function () {
    sinon.stub(Product,'findById').returns(lean({_id:order.productId,sellerId:ids.seller,title:'Mug',priceCents:2500,status:'active'}));
    const create=sinon.stub(Order,'create').resolves(order);
    const res=await call('post','','buyer',{productId:order.productId,quantity:2});
    expect(res.status).to.equal(201);expect(res.body.order.totalCents).to.equal(5000);
    expect(create.firstCall.args[0]).to.deep.equal({buyerId:ids.buyer,sellerId:ids.seller,productId:order.productId,productTitle:'Mug',unitPriceCents:2500,quantity:2,totalCents:5000,status:'pending'});
  });
  it('does not reveal unrelated details or write on a forbidden transition', async function () {
    sinon.stub(Order,'findById').returns(lean(order));const update=sinon.stub(Order,'findOneAndUpdate');
    expect((await call('get','/'+order._id,'other')).status).to.equal(403);
    expect((await call('patch','/'+order._id+'/status','other',{status:'accepted',expectedStatus:'pending'})).status).to.equal(403);
    expect((await call('patch','/'+order._id+'/status','seller',{status:'completed',expectedStatus:'pending'})).status).to.equal(409);
    sinon.assert.notCalled(update);
  });
  it('includes the expected state and owner in the conditional write', async function () {
    sinon.stub(Order,'findById').returns(lean(order));const update=sinon.stub(Order,'findOneAndUpdate').returns(lean({...order,status:'accepted'}));
    const res=await call('patch','/'+order._id+'/status','seller',{status:'accepted',expectedStatus:'pending'});
    expect(res.body.order.status).to.equal('accepted');
    expect(update.firstCall.args).to.deep.equal([{_id:order._id,sellerId:ids.seller,status:'pending'},{$set:{status:'accepted'}},{new:true,runValidators:true}]);
  });
  it('returns conflict when a competing write defeats the condition', async function () {
    const read=sinon.stub(Order,'findById');read.onFirstCall().returns(lean(order));read.onSecondCall().returns(lean({...order,status:'rejected'}));
    sinon.stub(Order,'findOneAndUpdate').returns(lean(null));
    expect((await call('patch','/'+order._id+'/status','seller',{status:'accepted',expectedStatus:'pending'})).status).to.equal(409);
  });
  it('rejects malformed IDs and safely handles service errors', async function () {
    expect((await call('get','/bad','buyer')).status).to.equal(400);
    sinon.stub(Order,'findById').returns({lean:async()=>{throw new Error('private connection details');}});
    const res=await call('get','/'+order._id,'buyer');expect(res.status).to.equal(500);expect(JSON.stringify(res.body)).not.to.include('private');
  });
});
