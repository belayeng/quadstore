
import { BrowserLevel } from 'browser-level';
import { DataFactory } from 'rdf-data-factory';
import { uid } from '../../dist/utils/uid.js';
import { runQuadstoreTests } from '../quadstore/quadstore.js';

export const runBrowserLevelTests = () => {

  describe('BrowserLevel backend', () => {

    beforeEach(async function () {
      this.db = new BrowserLevel(`quadstore-${uid()}`);
      this.indexes = null;
      this.dataFactory = new DataFactory();
      this.prefixes = {
        expandTerm: (term: string) => term,
        compactIri: (iri: string) => iri,
      };
    });

    runQuadstoreTests();

  });

};
