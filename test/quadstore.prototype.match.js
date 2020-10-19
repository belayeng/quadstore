
'use strict';



const _ = require('../dist/lib/utils');
const utils = require('../dist/lib/utils');
const should = require('should');
const factory = require('@rdfjs/data-model');
const AsyncIterator = require('asynciterator');
const {DefaultGraphMode} = require('../dist/lib/types');

function stripTermSerializedValue(quads) {
  const _quads = Array.isArray(quads) ? quads : [quads];
  quads.forEach((quad) => {
    ['subject', 'predicate', 'object', 'graph'].forEach((termKey) => {
      delete quad[termKey]._serializedValue;
    });
  });
  return Array.isArray(quads) ? _quads : _quads[0];
}

module.exports = () => {

  describe('Quadstore.prototype.match()', () => {

    describe('Match by value', () => {

      it('should match quads by subject', async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const subject = factory.namedNode('http://ex.com/s2');
        const matchedQuads = await utils.streamToArray(rs.match(subject));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should match quads by predicate',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p2'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const predicate = factory.namedNode('http://ex.com/p2');
        const matchedQuads = await utils.streamToArray(rs.match(null, predicate));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should match quads by object',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g2')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o2', 'en-gb'),
            factory.namedNode('http://ex.com/g2')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const object = factory.literal('o2', 'en-gb');
        const matchedQuads = await utils.streamToArray(rs.match(null, null, object));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should match quads by graph',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g2')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const graph = factory.namedNode('http://ex.com/g2');
        const matchedQuads = await utils.streamToArray(rs.match(null, null, null, graph));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should match the default graph when explicitly passed',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p0'),
            factory.literal('o0', 'en-gb'),
            factory.defaultGraph()
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s1'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o1', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const matchedQuads = await utils.streamToArray(rs.match(null, null, null, factory.defaultGraph()));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[0]);
      });

      it('should match the default graph when using DEFAULT graph mode',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p0'),
            factory.literal('o0', 'en-gb'),
            factory.defaultGraph()
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s1'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o1', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const matchedQuads = await utils.streamToArray(rs.match(null, null, null, null, { defaultGraphMode: DefaultGraphMode.DEFAULT}));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[0]);
      });

      it('should match the union graph when using UNION graph mode',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p0'),
            factory.literal('o0', 'en-gb'),
            factory.defaultGraph()
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s1'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o1', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const matchedQuads = await utils.streamToArray(rs.match(null, null, null, null, { defaultGraphMode: DefaultGraphMode.UNION}));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(2);
        should(matchedQuads).be.equalToQuadArray(quads, store);
      });

    });

    describe('Match by range', () => {

      it('should match quads by object (literal) [GT]', async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('5', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('7', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        // console.log(await store._debugQuads());
        const match = { termType: 'Range',
          gt: factory.literal('6', 'http://www.w3.org/2001/XMLSchema#integer') };
        const matchedQuads = await utils.streamToArray(rs.match(null, null, match, null));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });
      it('should match quads by object (literal) [GTE]', async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('5', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('7', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const match = { termType: 'Range',
          gte: factory.literal('7.0', 'http://www.w3.org/2001/XMLSchema#double') };
        const matchedQuads = await utils.streamToArray(rs.match(null, null, match, null));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should not match quads by object (literal) if out of range [GT]', async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('5', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('7', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const match = {
          termType: 'Range',
          gt: factory.literal('7.0', 'http://www.w3.org/2001/XMLSchema#double'),
        };
        const matchedQuads = await utils.streamToArray(rs.match(null, null, match, null));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(0);
      });
    });

  });

};
