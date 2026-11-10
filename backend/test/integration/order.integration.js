const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const chai = require('chai');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { configureOrderTestEnvironment, connectOrderTestDatabase, fixtureScope, DATABASE } = require('../helpers/orderFixtures');
const enabled = process.env.RUN_ORDER_DB_TESTS === '1';
const uri = enabled ? configureOrderTestEnvironment() : null;
const app = require('../../server');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
chai.use(require('chai-http'));
const { expect } = chai;
const repo = path.resolve(__dirname, '../../..');
const output = path.resolve(repo, process.env.S14_ARTIFACT_DIR || 'artifacts/s14-integration');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

(enabled ? describe : describe.skip)('S12-S14 real MongoDB Order verification', function () {
  this.timeout(30000);
  const scope = fixtureScope(); const accounts = {}; let product, success;
  const report = { startedAt: new Date().toISOString(), sourceCommit: git('rev-parse','HEAD'), workingTree: git('status','--short'), database: DATABASE, node: process.version, cases: [] };
  const input = { title: scope.prefix+' Ceramic mug', description: 'Dedicated verification fixture.', category: 'Ceramics', priceCents: 2500 };
  function call(method, route, account, body) {
    const req = chai.request(app)[method]('/api'+route);
    if (account) req.set('Authorization','Bearer '+account.token);
    return body === undefined ? req : req.send(body);
  }
  async function newOrder() { const res=await call('post','/orders',accounts.buyerA,{productId:product.id,quantity:2});expect(res.status).to.equal(201);return res.body.order; }
  const raw = id => Order.findById(id).lean();
  const serial = async id => JSON.stringify(await raw(id));
  const patch = (order, status, expectedStatus, account=accounts.sellerA) => call('patch','/orders/'+order.id+'/status',account,{status,expectedStatus});
  before(async function () {
    await connectOrderTestDatabase(uri);
    for (const [label, role] of [['sellerA','seller'],['sellerB','seller'],['buyerA','buyer'],['buyerB','buyer']]) {
      const identity=scope.identity(label,role);
      expect((await call('post','/auth/register',null,identity)).status).to.equal(201);
      const res=await call('post','/auth/login',null,{email:identity.email,password:identity.password});expect(res.status).to.equal(200);
      accounts[label]=res.body;
      if(label==='buyerA') {
        expect((await call('post','/auth/register',null,identity)).status).to.equal(409);
        expect((await call('post','/auth/login',null,{email:identity.email,password:'incorrect-password'})).status).to.equal(401);
      }
    }
    const res=await call('post','/products',accounts.sellerA,input);expect(res.status).to.equal(201);product=res.body.product;
  });
  afterEach(function () { report.cases.push({name:this.currentTest.title,status:this.currentTest.state}); });
  after(async function () {
    try { if (mongoose.connection.readyState===1) report.cleanup=await scope.cleanup(); }
    finally {
      await mongoose.disconnect();report.finishedAt=new Date().toISOString();report.status=report.cases.length && report.cases.every(row=>row.status==='passed') && report.cleanup ? 'pass':'fail';
      fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'order-integration-results.json'),JSON.stringify(report,null,2)+'\n');
      console.log('Scoped Order fixture cleanup: '+JSON.stringify(report.cleanup || {status:'not completed'}));
    }
  });
  it('TC07 starts with genuinely empty related-account lists',async function(){
    expect((await call('get','/orders/mine',accounts.buyerA)).body.orders).to.deep.equal([]);
    expect((await call('get','/orders/seller',accounts.sellerA)).body.orders).to.deep.equal([]);
  });
  it('TC09 creates a server-owned persistent snapshot and safe DTO',async function(){
    success=await newOrder();const saved=await raw(success.id);
    expect(String(saved.buyerId)).to.equal(accounts.buyerA.id);expect(String(saved.sellerId)).to.equal(accounts.sellerA.id);
    expect(saved.unitPriceCents).to.equal(2500);expect(saved.totalCents).to.equal(5000);expect(saved.status).to.equal('pending');
    expect(Object.keys(success).sort()).to.deep.equal(['id','buyerId','sellerId','productId','productTitle','unitPriceCents','quantity','totalCents','status','createdAt','updatedAt'].sort());
  });
  it('TC03/04 rejects wrong-role and cross-owner writes without changing data',async function(){
    const before=await serial(success.id),count=await Order.countDocuments({buyerId:accounts.buyerA.id});
    expect((await call('post','/orders',accounts.sellerA,{productId:product.id,quantity:2})).status).to.equal(403);
    expect((await patch(success,'accepted','pending',accounts.buyerA)).status).to.equal(403);
    expect((await patch(success,'accepted','pending',accounts.sellerB)).status).to.equal(403);
    expect((await call('post','/products',accounts.buyerA,input)).status).to.equal(403);
    expect((await call('patch','/products/'+product.id,accounts.sellerB,{priceCents:1})).status).to.equal(403);
    expect(await serial(success.id)).to.equal(before);expect(await Order.countDocuments({buyerId:accounts.buyerA.id})).to.equal(count);
  });
  it('TC08/09 rejects invalid quantities, payloads and unsafe totals without saving',async function(){
    const count=await Order.countDocuments({buyerId:accounts.buyerA.id});
    for (const quantity of [0,-1,1.5,101,'2',null,undefined]) expect((await call('post','/orders',accounts.buyerA,{productId:product.id,quantity})).status).to.equal(400);
    for (const extra of [{buyerId:accounts.buyerB.id},{sellerId:accounts.sellerB.id},{unitPriceCents:1},{totalCents:1},{status:'pending'},{$set:{status:'completed'}}]) expect((await call('post','/orders',accounts.buyerA,{productId:product.id,quantity:2,...extra})).status).to.equal(400);
    expect((await call('post','/orders',accounts.buyerA,[])).status).to.equal(400);
    const high=await call('post','/products',accounts.sellerA,{...input,title:scope.prefix+' expensive',priceCents:Number.MAX_SAFE_INTEGER});
    expect((await call('post','/orders',accounts.buyerA,{productId:high.body.product.id,quantity:2})).status).to.equal(400);
    expect(await Order.countDocuments({buyerId:accounts.buyerA.id})).to.equal(count);
    for (const quantity of [1,100]) expect((await call('post','/orders',accounts.buyerA,{productId:product.id,quantity})).status).to.equal(201);
  });
  it('TC05/12 distinguishes malformed, missing and unrelated resources',async function(){
    const absent=String(new mongoose.Types.ObjectId());
    expect((await call('get','/orders/bad',accounts.buyerA)).status).to.equal(400);
    expect((await call('get','/orders/'+absent,accounts.buyerA)).status).to.equal(404);
    expect((await call('post','/orders',accounts.buyerA,{productId:'bad',quantity:1})).status).to.equal(400);
    expect((await call('post','/orders',accounts.buyerA,{productId:absent,quantity:1})).status).to.equal(404);
    for(const account of [accounts.buyerB,accounts.sellerB]) expect((await call('get','/orders/'+success.id,account)).status).to.equal(403);
    expect((await call('get','/orders/mine',accounts.buyerB)).body.orders).to.deep.equal([]);
    expect((await call('get','/orders/seller',accounts.sellerB)).body.orders).to.deep.equal([]);
    expect((await call('get','/orders/mine?buyerId='+accounts.buyerA.id,accounts.buyerB)).status).to.equal(400);
    expect((await call('get','/orders/seller?sellerId='+accounts.sellerA.id,accounts.sellerB)).status).to.equal(400);
  });
  it('TC10 persists accepted then completed and returns the same result to both roles',async function(){
    expect((await patch(success,'accepted','pending')).body.order.status).to.equal('accepted');
    expect((await call('get','/orders/'+success.id,accounts.buyerA)).body.order.status).to.equal('accepted');
    expect((await patch(success,'completed','accepted')).body.order.status).to.equal('completed');
    for(const user of [accounts.buyerA,accounts.sellerA]) {
      const res=await call('get','/orders/'+success.id,user);expect(res.body.order.status).to.equal('completed');expect(res.body.order.totalCents).to.equal(5000);
    }
    expect((await raw(success.id)).status).to.equal('completed');
  });
  it('TC11 preserves terminal and illegal transitions and rejects malformed updates',async function(){
    const order=await newOrder();const before=await serial(order.id);
    expect((await patch(order,'completed','pending')).status).to.equal(409);expect(await serial(order.id)).to.equal(before);
    expect((await patch(order,'cancelled','pending')).status).to.equal(400);
    expect((await call('patch','/orders/'+order.id+'/status',accounts.sellerA,{status:'accepted'})).status).to.equal(400);
    expect((await call('patch','/orders/'+order.id+'/status',accounts.sellerA,{status:'accepted',expectedStatus:'pending',quantity:3})).status).to.equal(400);
    expect((await patch(order,'rejected','pending')).status).to.equal(200);const rejected=await serial(order.id);
    for (const status of ['accepted','completed','rejected','pending']) expect((await patch(order,status,'rejected')).status).to.equal(409);
    expect(await serial(order.id)).to.equal(rejected);
    const accepted=await newOrder();await patch(accepted,'accepted','pending');
    expect((await patch(accepted,'rejected','accepted')).status).to.equal(409);
  });
  it('TC13 permits exactly one truly competing accept/reject and preserves snapshots',async function(){
    const order=await newOrder();
    const replies=await Promise.all([patch(order,'accepted','pending'),patch(order,'rejected','pending')]);
    expect(replies.map(row=>row.status).sort()).to.deep.equal([200,409]);
    const saved=await raw(order.id),winner=replies.find(row=>row.status===200).body.order;
    expect(saved.status).to.equal(winner.status);expect(saved.totalCents).to.equal(order.totalCents);
    report.race={orderId:order.id,before:'pending',responses:replies.map(row=>({httpStatus:row.status,code:row.body.code || '',status:row.body.order?.status || null})),after:saved.status};
  });
  it('TC02 rejects expired and deleted-user credentials without a write',async function(){
    const count=await Order.countDocuments({});const expired={token:jwt.sign({id:accounts.buyerA.id},process.env.JWT_SECRET,{expiresIn:-10})};
    expect((await call('post','/orders',expired,{productId:product.id,quantity:1})).status).to.equal(401);
    const identity=scope.identity('deleted','buyer');await call('post','/auth/register',null,identity);
    const login=await call('post','/auth/login',null,{email:identity.email,password:identity.password});expect(login.status).to.equal(200);
    expect((await User.deleteOne({_id:login.body.id,email:identity.email})).deletedCount).to.equal(1);
    expect((await call('post','/orders',login.body,{productId:product.id,quantity:1})).status).to.equal(401);
    expect((await call('get','/orders/mine')).status).to.equal(401);expect(await Order.countDocuments({})).to.equal(count);
  });
  it('TC06/14 retains request snapshots after rename/reprice/archive and refuses new requests',async function(){
    const historical=await newOrder();
    expect((await call('patch','/products/'+product.id,accounts.sellerA,{title:scope.prefix+' renamed',priceCents:3000})).status).to.equal(200);
    expect((await call('get','/products/'+product.id)).body.product.priceCents).to.equal(3000);
    expect((await call('patch','/products/'+product.id,accounts.sellerA,{status:'archived'})).status).to.equal(200);
    const count=await Order.countDocuments({buyerId:accounts.buyerA.id});
    expect((await call('post','/orders',accounts.buyerA,{productId:product.id,quantity:1})).status).to.equal(409);
    expect(await Order.countDocuments({buyerId:accounts.buyerA.id})).to.equal(count);
    for(const user of [accounts.buyerA,accounts.sellerA]) {
      const saved=(await call('get','/orders/'+historical.id,user)).body.order;
      expect(saved.productTitle).to.equal(input.title);expect(saved.unitPriceCents).to.equal(2500);expect(saved.totalCents).to.equal(5000);
    }
    expect((await patch(historical,'accepted','pending')).status).to.equal(200);
    report.snapshot={orderId:historical.id,productArchived:true,originalTitle:input.title,unitPriceCents:2500,totalCents:5000,preserved:true};
  });
});
