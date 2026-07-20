import assert from 'node:assert/strict';
import test from 'node:test';

import { comparePublicApiSnapshots } from './lib/public-api.mjs';

const snapshot = {
  package: '@kokecore/example',
  version: '0.1.0',
  entry: 'dist/public.d.ts',
  exports: [{ name: 'Example', kind: 'ClassDeclaration', signatureHash: 'abc' }],
};

test('detects public API snapshot changes', () => {
  assert.equal(comparePublicApiSnapshots(snapshot, structuredClone(snapshot)), true);
  assert.equal(
    comparePublicApiSnapshots(snapshot, {
      ...snapshot,
      exports: [{ ...snapshot.exports[0], signatureHash: 'changed' }],
    }),
    false
  );
});
