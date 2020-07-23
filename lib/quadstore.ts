
'use strict';

import {
  TSApproximateSizeResult,
  TSBindingArrayResult,
  TSEmptyOpts,
  TSIndex,
  TSPattern,
  TSQuad,
  TSQuadArrayResult,
  TSQuadStreamResult,
  TSRange,
  TSReadable,
  TSResultType,
  TSSearchStage,
  TSStore,
  TSStoreOpts,
  TSTermName,
  TSVoidResult
} from './types/index.js';
import assert from 'assert';
import events from 'events';
import levelup from 'levelup';
import {TransformIterator} from 'asynciterator';
import {AbstractLevelDOWN} from 'abstract-leveldown';

import * as _ from './utils/lodash.js';
import * as utils from './utils/index.js';
import * as get from './get/index.js';
import * as search from './search/index.js';

class QuadStore extends events.EventEmitter implements TSStore {

  readonly db: AbstractLevelDOWN;
  readonly abstractLevelDOWN: AbstractLevelDOWN;

  readonly defaultGraph: string;
  readonly indexes: TSIndex[];
  readonly id: string;

  readonly separator: string;
  readonly boundary: string;

  /*
   * ==========================================================================
   *                           STORE LIFECYCLE
   * ==========================================================================
   */

  constructor(opts: TSStoreOpts) {
    super();
    assert(_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
    assert(
      utils.isAbstractLevelDOWNInstance(opts.backend),
      'Invalid "opts" argument: "opts.backend" is not an instance of AbstractLevelDOWN',
    );
    this.abstractLevelDOWN = opts.backend;
    this.db = levelup(this.abstractLevelDOWN);
    this.defaultGraph = opts.defaultGraph || '_DEFAULT_CONTEXT_';
    this.indexes = [];
    this.id = utils.nanoid();
    this.boundary = opts.boundary || '\uDBFF\uDFFF';
    this.separator = opts.separator || '\u0000\u0000';
    (opts.indexes || utils.genDefaultIndexes())
      .forEach((index: TSTermName[]) => this._addIndex(index));
    setImmediate(() => { this._initialize(); });
  }

  _initialize() {
    this.emit('ready');
  }

  async close() {
    await new Promise((resolve, reject) => {
      this.db.close((err) => {
        err ? reject(err) : resolve();
      });
    });
  }

  /*
   * ==========================================================================
   *                           STORE SERIALIZATION
   * ==========================================================================
   */

  toString() {
    return this.toJSON();
  }

  toJSON() {
    return `[object ${this.constructor.name}::${this.id}]`;
  }

  /*
   * ==========================================================================
   *                                  INDEXES
   * ==========================================================================
   */

  _addIndex(terms: TSTermName[]): void {
    // assert(utils.hasAllTerms(terms), 'Invalid index (bad terms).');
    const name = terms.map(t => t.charAt(0).toUpperCase()).join('');
    this.indexes.push({
      terms,
      name,
      getKey: eval(
        '(quad) => `'
          + name + this.separator
          + terms.map(term => `\${quad['${term}']}${this.separator}`).join('')
          + '`'
      ),
    });
  }

  /*
   * ==========================================================================
   *                            NON-STREAMING API
   * ==========================================================================
   */

  async put(quad: TSQuad, opts?: TSEmptyOpts): Promise<TSVoidResult> {
    const value = `{"subject": "${quad.subject}","predicate":"${quad.predicate}","object":"${quad.object}","graph":"${quad.graph}"}`;
    const batch = this.indexes.reduce((batch, i) => {
      return batch.put(i.getKey(quad), value);
    }, this.db.batch());
    // @ts-ignore
    await batch.write();
    return { type: TSResultType.VOID };
  }

  async multiPut(newQuads: TSQuad[], opts?: TSEmptyOpts): Promise<TSVoidResult> {
    // @ts-ignore
    await this.db.batch(_.flatMap(newQuads, quad => this._quadToBatch(quad, 'put')));
    return { type: TSResultType.VOID };
  }

  async del(oldQuad: TSQuad, opts?: TSEmptyOpts): Promise<TSVoidResult> {
    // @ts-ignore
    await this.db.batch(this._quadToBatch(oldQuad, 'del'));
    return { type: TSResultType.VOID };
  }

  async multiDel(oldQuads: TSQuad[], opts?: TSEmptyOpts): Promise<TSVoidResult> {
    // @ts-ignore
    await this.db.batch(_.flatMap(oldQuads, quad => this._quadToBatch(quad, 'del')));
    return { type: TSResultType.VOID };
  }

  async patch(oldQuad: TSQuad, newQuad: TSQuad, opts?: TSEmptyOpts): Promise<TSVoidResult> {
    // @ts-ignore
    await this.db.batch([
      ...(this._quadToBatch(oldQuad, 'del')),
      ...(this._quadToBatch(newQuad, 'put')),
    ]);
    return { type: TSResultType.VOID };
  }

  async multiPatch(oldQuads: TSQuad[], newQuads: TSQuad[], opts?: TSEmptyOpts): Promise<TSVoidResult> {
    // @ts-ignore
    await this.db.batch([
      ...(_.flatMap(oldQuads, quad => this._quadToBatch(quad, 'del'))),
      ...(_.flatMap(newQuads, quad => this._quadToBatch(quad, 'put'))),
    ]);
    return { type: TSResultType.VOID };
  }

  async get(pattern: TSPattern, opts: TSEmptyOpts): Promise<TSQuadArrayResult> {
    if (_.isNil(opts)) opts = {};
    if (_.isNil(pattern)) pattern = {};
    assert(_.isObject(pattern), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const results = await this.getStream(pattern, opts);
    const quads = await utils.streamToArray(results.iterator);
    return { type: TSResultType.QUADS, items: quads, sorting: results.sorting };
  }

  async search(stages: TSSearchStage[], opts: TSEmptyOpts): Promise<TSQuadArrayResult|TSBindingArrayResult> {
    if (_.isNil(opts)) opts = {};
    assert(_.isArray(stages), 'The "patterns" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const results = await this.searchStream(stages, opts);
    switch (results.type) {
      case TSResultType.BINDINGS: {
        const bindings = await utils.streamToArray(results.iterator);
        return { ...results, type: results.type, items: bindings };
      } break;
      default:
        throw new Error(`Unsupported result type "${results.type}"`);
    }
  }

  /*
   * ==========================================================================
   *                                COUNTING API
   * ==========================================================================
   */

  async getApproximateSize(pattern: TSPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult> {
    if (_.isNil(pattern)) pattern = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(pattern), 'The "matchTerms" argument is not a function..');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await get.getApproximateSize(this, pattern, opts);
  }

  /*
   * ==========================================================================
   *                            STREAMING API
   * ==========================================================================
   */

  async getStream(pattern: TSPattern, opts: TSEmptyOpts): Promise<TSQuadStreamResult> {
    if (_.isNil(pattern)) pattern = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(pattern), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await get.getStream(this, pattern, opts);
  }

  async searchStream(stages: TSSearchStage[], opts?: TSEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isArray(stages), 'The "patterns" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await search.searchStream(this, stages);
  }

  async putStream(source: TSReadable<TSQuad>, opts: TSEmptyOpts): Promise<TSVoidResult> {
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const transformOpts = {
      transform: (quad: TSQuad, cb: () => void) => {
        this.put(quad, opts)
          .then(cb.bind(null, null))
          .catch(cb);
      },
    };
    const iterator = new TransformIterator(source).transform(transformOpts);
    await utils.streamToArray(iterator);
    return { type: TSResultType.VOID };
  }

  async delStream(source: TSReadable<TSQuad>, opts: TSEmptyOpts): Promise<TSVoidResult> {
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const transformOpts = {
      transform: (quad: TSQuad, cb: () => void) => {
        this.del(quad, opts)
          .then(cb.bind(null, null))
          .catch(cb);
      },
    };
    const iterator = new TransformIterator(source).transform(transformOpts);
    await utils.streamToArray(iterator);
    return { type: TSResultType.VOID };
  }

  protected _isQuad(obj: any): boolean {
    return _.isString(obj.subject)
      && _.isString(obj.predicate)
      && _.isString(obj.object)
      && _.isString(obj.graph);
  }

  /*
   * ==========================================================================
   *                            LOW-LEVEL DB HELPERS
   * ==========================================================================
   */

  /**
   * Transforms a quad into a batch of either put or del
   * operations, one per each of the six indexes.
   * @param quad
   * @param type
   * @returns {}
   */
  protected _quadToBatch(quad: TSQuad, type: 'del'|'put') {
    const value = `{"subject": "${quad.subject}","predicate":"${quad.predicate}","object":"${quad.object}","graph":"${quad.graph}"}`;
    return this.indexes.map(i => ({
        type,
        value,
        key: i.getKey(quad),
    }));
  }

  _getTermNames(): TSTermName[] {
    // @ts-ignore
    return ['subject', 'predicate', 'object', 'graph'];
  }

  protected _getTermValueComparator(): (a: string, b: string) => -1|0|1 {
    return (a: string, b: string) => {
      if (a < b) return -1;
      else if (a === b) return 0;
      else return 1;
    }
  }

  protected _getQuadComparator(termNames: TSTermName[]) {
    if (!termNames) termNames = this._getTermNames();
    const valueComparator = this._getTermValueComparator();
    return (a: TSQuad, b: TSQuad) => {
      for (let i = 0, n = termNames.length, r: -1|0|1; i <= n; i += 1) {
        r = valueComparator(a[termNames[i]], b[termNames[i]]);
        if (r !== 0) return r;
      }
      return 0;
    };
  }

  protected _mergeTermRanges(a: TSRange, b: TSRange): TSRange {
    const c = {...b};
    if (!_.isNil(a.lt)) {
      if (!_.isNil(c.lt)) {
        // @ts-ignore
        if (a.lt < c.lt) {
          c.lt = a.lt;
        }
      } else {
        c.lt = a.lt;
      }
    }
    if (!_.isNil(a.lte)) {
      if (!_.isNil(c.lte)) {
        // @ts-ignore
        if (a.lte < c.lte) {
          c.lte = a.lte;
        }
      } else {
        c.lte = a.lte;
      }
    }
    if (!_.isNil(a.gt)) {
      if (!_.isNil(c.gt)) {
        // @ts-ignore
        if (a.gt > c.gt) {
          c.gt = a.gt;
        }
      } else {
        c.gt = a.gt;
      }
    }
    if (!_.isNil(a.gte)) {
      if (!_.isNil(c.gte)) {
        // @ts-ignore
        if (a.gte > c.gte) {
          c.gte = a.gte;
        }
      } else {
        c.gte = a.gte;
      }
    }
    return c;
  }

  // protected _mergeMatchTerms(a: TSPattern, b: TSPattern, termNames: TSTermName[]): TSPattern {
  //   if (!termNames) {
  //     termNames = this._getTermNames();
  //   }
  //   const c = { ...b };
  //   termNames.forEach((termName) => {
  //     if (_.isNil(c[termName])) {
  //       if (!_.isNil(a[termName])) {
  //         c[termName] = a[termName];
  //       }
  //     } else {
  //       if (!_.isNil(a[termName])) {
  //         if (_.isObject(a[termName]) && _.isObject(c[termName])) {
  //           // @ts-ignore
  //           c[termName] = this._mergeTermRanges(a[termName], c[termName]);
  //         } else {
  //           throw new Error(`Cannot merge match terms`);
  //         }
  //       }
  //     }
  //   });
  //   return c;
  // };

}

export default QuadStore;
