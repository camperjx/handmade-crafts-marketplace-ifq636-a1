const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const mongoose = require('mongoose');
const app = require('../server');
chai.use(chaiHttp);
const { expect } = chai;

describe('S11 readiness', function () {
  afterEach(() => sinon.restore());
  for (const state of [0, 1, 2, 3]) {
    it('reports connection state ' + state + ' without exposing configuration', async function () {
      sinon.stub(mongoose, 'connection').get(() => ({ readyState: state }));
      const response = await chai.request(app).get('/api/health');
      expect(response.status).to.equal(state === 1 ? 200 : 503);
      expect(response.headers['cache-control']).to.equal('no-store');
      expect(response.body).to.deep.equal({
        service: 'handmade-crafts-marketplace',
        status: state === 1 ? 'ready' : 'unavailable',
      });
    });
  }
});
