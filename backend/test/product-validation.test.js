const { expect } = require('chai');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { validateProductCreate: create, validateProductPatch: patch } = require('../utils/productValidation');
const { toProductDto } = require('../utils/productDto');
const input = { title: 'Ceramic mug', description: 'Handmade mug', category: 'Ceramics', priceCents: 2500 };

describe('S08 Product input and document validation (no database)', function () {
  for (const body of [null, [], 'text', 7, true, undefined]) {
    it('rejects non-object create and patch body ' + JSON.stringify(body), function () {
      expect(create(body).ok).to.equal(false); expect(patch(body).ok).to.equal(false);
    });
  }
  for (const [field, maximum] of [['title', 120], ['description', 2000], ['category', 60]]) {
    for (const value of [undefined, '', '  ', null, 42, [], {}, 'x'.repeat(maximum + 1)]) {
      it('rejects an invalid ' + field + ' on both create and patch: ' + String(value).slice(0, 20), function () {
        expect(create({ ...input, [field]: value }).errors).to.have.property(field);
        expect(patch({ [field]: value }).errors).to.have.property(field);
      });
    }
    it('accepts trimmed text at the ' + field + ' maximum', function () {
      const result = create({ ...input, [field]: '  ' + 'x'.repeat(maximum) + '  ' });
      expect(result.ok).to.equal(true); expect(result.values[field]).to.equal('x'.repeat(maximum));
    });
  }
  for (const price of [undefined, 0, -1, 1.5, '2500', null, true, {}, [], Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    it('rejects non-positive/non-number/unsafe cents ' + String(price), function () {
      expect(create({ ...input, priceCents: price }).errors).to.have.property('priceCents');
      expect(patch({ priceCents: price }).errors).to.have.property('priceCents');
    });
  }
  for (const price of [1, Number.MAX_SAFE_INTEGER]) it('accepts the safe cents boundary ' + price, function () {
    expect(create({ ...input, priceCents: price }).ok).to.equal(true);
    expect(patch({ priceCents: price }).ok).to.equal(true);
  });
  for (const field of ['sellerId', '_id', 'id', 'createdAt', 'updatedAt', 'imagePath', '$set', '__proto__']) {
    it('rejects unsupported own field ' + field + ' as a whole request', function () {
      const bad = JSON.parse('{"' + field + '":"not-allowed"}');
      expect(create({ ...input, ...bad }).ok).to.equal(false);
      expect(patch({ title: 'Allowed alone', ...bad }).ok).to.equal(false);
    });
  }
  it('rejects even an active initial status and an empty patch', function () {
    expect(create({ ...input, status: 'active' }).ok).to.equal(false);
    expect(patch({}).ok).to.equal(false);
  });
  for (const status of ['active', 'deleted', '', null, {}, false]) it('rejects status ' + JSON.stringify(status), function () {
    expect(patch({ status }).ok).to.equal(false);
  });
  it('accepts archive with valid fields while retaining omitted fields', function () {
    expect(patch({ title: '  Revised  ', status: 'archived' })).to.deep.equal({
      ok: true, values: { title: 'Revised', status: 'archived' }, errors: {},
    });
  });
  it('validates actual model constraints and active default without connecting', function () {
    const good = new Product({ ...input, sellerId: new mongoose.Types.ObjectId() });
    expect(good.validateSync()).to.equal(undefined); expect(good.status).to.equal('active');
    const bad = new Product({ title: ' ', description: '', category: 'x'.repeat(61), priceCents: 1.5, status: 'deleted' });
    expect(bad.validateSync().errors).to.have.all.keys('sellerId', 'title', 'description', 'category', 'priceCents', 'status');
    expect(Product.schema.path('sellerId').options.immutable).to.equal(true);
  });
  it('does not return document internals or private fields in a lean DTO', function () {
    const id = new mongoose.Types.ObjectId(), sellerId = new mongoose.Types.ObjectId();
    const dto = toProductDto({ ...input, _id: id, sellerId, status: 'active', createdAt: new Date(), updatedAt: new Date(), __v: 3, password: 'private', email: 'private@example.com' });
    expect(Object.keys(dto).sort()).to.deep.equal(['id','sellerId','title','description','category','priceCents','status','createdAt','updatedAt'].sort());
    expect(dto.id).to.equal(String(id)); expect(dto.sellerId).to.equal(String(sellerId));
  });
  it('supports the same DTO for an actual model document', function () {
    const document = new Product({ ...input, sellerId: new mongoose.Types.ObjectId() });
    expect(toProductDto(document).id).to.equal(String(document._id));
  });
});
