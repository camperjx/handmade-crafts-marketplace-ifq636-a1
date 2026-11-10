const { expect } = require('chai');
const { validateOrderCreate, validateOrderStatus, canTransition, STATUSES, positiveMoney } = require('../utils/orderValidation');
const Order = require('../models/Order');
describe('Order input and state rules', function () {
  const input = { productId: 'a'.repeat(24), quantity: 2 };
  for (const quantity of [1, 2, 100]) it('accepts bounded integer quantity ' + quantity, function () {
    expect(validateOrderCreate({ ...input, quantity }).ok).to.equal(true);
  });
  for (const quantity of [0, -1, 1.5, 101, '2', null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER]) it('rejects quantity ' + String(quantity), function () {
    expect(validateOrderCreate({ ...input, quantity }).ok).to.equal(false);
  });
  for (const body of [null, [], {}, { ...input, buyerId: 'b'.repeat(24) }, { ...input, totalCents: 1 }, { ...input, status: 'pending' }, { ...input, $set: {} }, { ...input, productId: 'invalid' }]) it('rejects missing, malformed or injected create fields', function () {
    expect(validateOrderCreate(body).ok).to.equal(false);
  });
  for (const from of STATUSES) for (const to of STATUSES) it('checks transition ' + from + ' to ' + to, function () {
    expect(canTransition(from, to)).to.equal((from === 'pending' && ['accepted', 'rejected'].includes(to)) || (from === 'accepted' && to === 'completed'));
  });
  it('requires the expected state and rejects unknown status fields', function () {
    expect(validateOrderStatus({ status: 'accepted', expectedStatus: 'pending' }).ok).to.equal(true);
    for (const body of [{ status: 'accepted' }, { status: 'cancelled', expectedStatus: 'pending' }, { status: 'accepted', expectedStatus: 'pending', quantity: 3 }]) expect(validateOrderStatus(body).ok).to.equal(false);
  });
  it('rejects unsafe monetary results without rounding them into valid totals', function () {
    expect(positiveMoney(2500 * 2)).to.equal(true);
    for (const value of [0, -1, 1.5, '2500', Number.MAX_SAFE_INTEGER * 2]) expect(positiveMoney(value)).to.equal(false);
  });
  it('validates the actual model default and rejects an inconsistent saved total', async function () {
    const valid={buyerId:'a'.repeat(24),sellerId:'b'.repeat(24),productId:'c'.repeat(24),productTitle:'Mug',quantity:2,unitPriceCents:2500,totalCents:5000};
    const order=new Order(valid);await order.validate();expect(order.status).to.equal('pending');
    let rejected=false;try{await new Order({...valid,totalCents:1}).validate();}catch(error){rejected=Boolean(error.errors.totalCents);}
    expect(rejected).to.equal(true);
  });
  it('protects the model quantity boundary even outside the HTTP controller', async function () {
    const order=new Order({buyerId:'a'.repeat(24),sellerId:'b'.repeat(24),productId:'c'.repeat(24),productTitle:'Mug',quantity:101,unitPriceCents:1,totalCents:101});
    let rejected=false;try{await order.validate();}catch(error){rejected=Boolean(error.errors.quantity);}
    expect(rejected).to.equal(true);
  });
});
