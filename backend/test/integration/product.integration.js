const { randomUUID, randomBytes } = require('crypto');
const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { configureProductTestEnvironment, connectProductTestDatabase, cleanProductFixtures } = require('../helpers/productFixtures');
const enabled = process.env.RUN_PRODUCT_DB_TESTS === '1';
const uri = enabled ? configureProductTestEnvironment() : null;
const app = require('../../server');
const User = require('../../models/User');
const Product = require('../../models/Product');
chai.use(chaiHttp);
const { expect } = chai;
const input = { title: 'Ceramic mug', description: 'Handmade mug', category: 'Ceramics', priceCents: 2500 };

(enabled ? describe : describe.skip)('S08 real MongoDB Product verification (dedicated database)', function () {
  this.timeout(30000);
  const prefix = 's08-' + randomUUID();
  const emails = new Set();
  const accounts = {};
  const password = randomBytes(18).toString('hex');
  let product;
  async function account(label, role) {
    const email = prefix + '-' + label + '@example.com'; emails.add(email);
    const registered = await chai.request(app).post('/api/auth/register').send({ name: 'S08 ' + label, email, password, role });
    expect(registered.status).to.equal(201);
    const signedIn = await chai.request(app).post('/api/auth/login').send({ email, password });
    expect(signedIn.status).to.equal(200);
    return signedIn.body;
  }
  function call(method, suffix = '', user, body) {
    const request = chai.request(app)[method]('/api/products' + suffix);
    if (user) request.set('Authorization', 'Bearer ' + user.token);
    return body === undefined ? request : request.send(body);
  }
  async function create(label, user = accounts.seller) {
    const response = await call('post', '', user, { ...input, title: prefix + ' ' + label });
    expect(response.status).to.equal(201);
    return response.body.product;
  }
  const raw = id => Product.findById(id).lean();
  const snapshot = async id => JSON.stringify(await raw(id));
  before(async function () {
    await connectProductTestDatabase(uri);
    accounts.seller = await account('seller', 'seller');
    accounts.other = await account('other', 'seller');
    accounts.buyer = await account('buyer', 'buyer');
  });
  after(async function () {
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.name === 'hm_s08_test') {
        console.log('Fixture cleanup: ' + JSON.stringify(await cleanProductFixtures(emails)));
      }
    } finally { await mongoose.disconnect(); }
  });

  it('P01 returns a genuine empty public catalogue when the isolated DB has no active records', async function () {
    if (await Product.countDocuments({status:'active'})) return this.skip();
    const response = await call('get'); expect(response.status).to.equal(200); expect(response.body).to.deep.equal({ products: [] });
  });
  it('P02 creates and persists one active product with server-derived ownership', async function () {
    product = await create('main');
    const saved = await raw(product.id);
    expect(String(saved.sellerId)).to.equal(accounts.seller.id); expect(saved.status).to.equal('active');
    expect(saved.priceCents).to.equal(2500); expect(saved.createdAt).to.be.instanceOf(Date); expect(saved.updatedAt).to.be.instanceOf(Date);
  });
  it('P03 reads safe DTOs through public list/detail and owner mine', async function () {
    const detail = await call('get','/'+product.id);
    expect(detail.status).to.equal(200);
    expect(Object.keys(detail.body.product).sort()).to.deep.equal(['id','sellerId','title','description','category','priceCents','status','createdAt','updatedAt'].sort());
    expect((await call('get')).body.products.some(row=>row.id===product.id)).to.equal(true);
    expect((await call('get','/mine',accounts.seller)).body.products.map(row=>row.id)).to.include(product.id);
  });
  it('P04 isolates Seller B mine from Seller A products', async function () {
    const response = await call('get','/mine',accounts.other);
    expect(response.status).to.equal(200); expect(response.body.products).to.deep.equal([]);
  });
  it('P05 verifies HM-15 AC4 with real Buyer Product writes and unchanged MongoDB data', async function () {
    const count = await Product.countDocuments({}); const before = await snapshot(product.id);
    expect((await call('post','',accounts.buyer,input)).status).to.equal(403);
    expect((await call('patch','/'+product.id,accounts.buyer,{priceCents:1})).status).to.equal(403);
    expect(await Product.countDocuments({})).to.equal(count); expect(await snapshot(product.id)).to.equal(before);
  });
  it('P06 rejects unauthenticated writes and mine without changing data', async function () {
    const before=await snapshot(product.id);
    expect((await call('post','',null,input)).status).to.equal(401);
    expect((await call('patch','/'+product.id,null,{status:'archived'})).status).to.equal(401);
    expect((await call('get','/mine')).status).to.equal(401); expect(await snapshot(product.id)).to.equal(before);
  });
  it('P07/P10 rejects owner/status/operator smuggling without creating products', async function () {
    const count=await Product.countDocuments({});
    for(const extra of [{sellerId:accounts.other.id},{status:'active'},{'$set':{status:'active'}},{imagePath:'/private'}]) {
      expect((await call('post','',accounts.seller,{...input,...extra})).status).to.equal(400);
    }
    expect((await call('post','',accounts.seller,[])).status).to.equal(400);
    expect(await Product.countDocuments({})).to.equal(count);
  });
  it('P08/P09 rejects invalid fields and prices without persisting or patching', async function () {
    const before=await snapshot(product.id), count=await Product.countDocuments({sellerId:accounts.seller.id});
    for(const bad of [{title:' '},{description:null},{category:'x'.repeat(61)},{priceCents:0},{priceCents:-1},{priceCents:1.5},{priceCents:'2500'},{priceCents:Number.MAX_SAFE_INTEGER+1}]) {
      expect((await call('post','',accounts.seller,{...input,...bad})).status).to.equal(400);
      expect((await call('patch','/'+product.id,accounts.seller,bad)).status).to.equal(400);
    }
    expect(await snapshot(product.id)).to.equal(before); expect(await Product.countDocuments({sellerId:accounts.seller.id})).to.equal(count);
  });
  it('P11 rejects Buyer mine on the real route', async function () {
    expect((await call('get','/mine',accounts.buyer)).status).to.equal(403);
  });
  it('P12 saves an owner update and returns it on a new public request', async function () {
    const before=await raw(product.id);
    const changed=await call('patch','/'+product.id,accounts.seller,{title:prefix+' updated',priceCents:3000});
    expect(changed.status).to.equal(200);
    const read=await call('get','/'+product.id);expect(read.body.product.priceCents).to.equal(3000);
    const saved=await raw(product.id);expect(saved.title).to.equal(prefix+' updated');expect(String(saved.sellerId)).to.equal(accounts.seller.id);
    expect(saved.createdAt.getTime()).to.equal(before.createdAt.getTime());expect(saved.updatedAt.getTime()).to.be.at.least(before.updatedAt.getTime());
  });
  it('P13 rejects cross-owner changes and preserves the complete original record', async function () {
    const before=await snapshot(product.id);
    for(const body of [{priceCents:1},{status:'archived'}]) expect((await call('patch','/'+product.id,accounts.other,body)).status).to.equal(403);
    expect(await snapshot(product.id)).to.equal(before);
  });
  it('P14/P15 rejects whole invalid or empty patches without partial writes', async function () {
    const before=await snapshot(product.id);
    for(const body of [{},{title:'Must not save',sellerId:accounts.other.id},{title:'Must not save',priceCents:0}]) expect((await call('patch','/'+product.id,accounts.seller,body)).status).to.equal(400);
    expect(await snapshot(product.id)).to.equal(before);
  });
  it('P16/P17 distinguishes malformed IDs and genuinely absent IDs', async function () {
    for(const id of ['bad','a'.repeat(12),'a'.repeat(23),'z'.repeat(24)]) expect((await call('get','/'+id)).status).to.equal(400);
    const absent=String(new mongoose.Types.ObjectId());expect(await raw(absent)).to.equal(null);
    expect((await call('get','/'+absent)).status).to.equal(404);
    expect((await call('patch','/'+absent,accounts.seller,{priceCents:1})).status).to.equal(404);
  });
  it('P18 archives without deleting the record', async function () {
    const count=await Product.countDocuments({sellerId:accounts.seller.id});
    const response=await call('patch','/'+product.id,accounts.seller,{status:'archived'});
    expect(response.status).to.equal(200);expect(response.body.product.status).to.equal('archived');
    expect((await raw(product.id)).status).to.equal('archived');expect(await Product.countDocuments({sellerId:accounts.seller.id})).to.equal(count);
  });
  it('P19 hides archived products even when query parameters ask for them', async function () {
    const list=await call('get','?status=archived&sellerId='+accounts.seller.id);
    expect(list.body.products.some(row=>row.id===product.id)).to.equal(false);
    for(const user of [undefined,accounts.buyer,accounts.other]) expect((await call('get','/'+product.id,user)).status).to.equal(404);
  });
  it('P20 permits authenticated owner archived detail/mine', async function () {
    expect((await call('get','/'+product.id,accounts.seller)).body.product.status).to.equal('archived');
    expect((await call('get','/mine',accounts.seller)).body.products.find(row=>row.id===product.id).status).to.equal('archived');
  });
  it('P21/P22 preserves archived state on repeated changes or reopening attempts', async function () {
    const before=await snapshot(product.id);
    for(const body of [{status:'archived'},{priceCents:4000}]) expect((await call('patch','/'+product.id,accounts.seller,body)).status).to.equal(409);
    expect((await call('patch','/'+product.id,accounts.seller,{status:'active'})).status).to.equal(400);
    expect(await snapshot(product.id)).to.equal(before);
  });
  it('P23 resolves genuinely competing archives with one success and one conflict', async function () {
    const item=await create('race');
    const responses=await Promise.all([call('patch','/'+item.id,accounts.seller,{status:'archived'}),call('patch','/'+item.id,accounts.seller,{status:'archived'})]);
    expect(responses.map(row=>row.status).sort()).to.deep.equal([200,409]);expect((await raw(item.id)).status).to.equal('archived');
  });
  it('P24 rejects expired and deleted-account credentials on Product writes', async function () {
    const expired={token:jwt.sign({id:accounts.seller.id},process.env.JWT_SECRET,{expiresIn:-10})};
    expect((await call('post','',expired,input)).status).to.equal(401);
    const removed=await account('deleted','seller');await User.deleteOne({_id:removed.id,email:removed.email});
    expect((await call('post','',removed,input)).status).to.equal(401);
  });
  it('preserves the S07 unavailable-role distinction on Product routes', async function () {
    const legacy=await account('legacy','seller');
    await User.collection.updateOne({_id:new mongoose.Types.ObjectId(legacy.id),email:legacy.email},{$unset:{role:''}});
    const response=await call('post','',legacy,input);expect(response.status).to.equal(403);expect(response.body.code).to.equal('ACCOUNT_ROLE_UNAVAILABLE');
  });
  it('P25 rejects supplied invalid authentication while permitting anonymous active reads', async function () {
    expect((await call('get','',{token:'invalid'})).status).to.equal(401);
    expect((await call('get')).status).to.equal(200);
  });
  it('P28 retains actual values across a database-client reconnect', async function () {
    await mongoose.disconnect();await connectProductTestDatabase(uri);
    const response=await call('get','/'+product.id,accounts.seller);
    expect(response.status).to.equal(200);expect(response.body.product.priceCents).to.equal(3000);expect(response.body.product.status).to.equal('archived');
  });
});
