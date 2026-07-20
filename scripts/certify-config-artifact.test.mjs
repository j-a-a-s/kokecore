import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONFIG_ARCHIVE_ENTRIES,
  validateConfigArchiveEntries,
  validateConfigManifest,
} from './certify-config-artifact.mjs';

function validManifest() {
  return {
    name: '@kokecore/config',
    version: '0.2.0',
    private: true,
    license: 'UNLICENSED',
    main: './dist/public.js',
    types: './dist/public.d.ts',
    engines: { node: '>=22 <25', pnpm: '>=8 <10' },
    exports: { '.': { default: './dist/public.js' } },
  };
}

test('accepts the exact certified Config archive and manifest', () => {
  assert.deepEqual(validateConfigArchiveEntries(CONFIG_ARCHIVE_ENTRIES), []);
  assert.deepEqual(validateConfigManifest(validManifest()), []);
});

test('rejects missing and unexpected archive files', () => {
  const entries = CONFIG_ARCHIVE_ENTRIES.filter((entry) => entry !== 'package/LICENSE');
  const errors = validateConfigArchiveEntries([...entries, 'package/src/index.ts']);
  assert.ok(errors.includes('missing required file: package/LICENSE'));
  assert.ok(errors.includes('unexpected archive file: package/src/index.ts'));
});

test('rejects mutable or publicly publishable manifests', () => {
  const errors = validateConfigManifest({
    ...validManifest(),
    private: false,
    license: 'MIT',
    engines: { node: '>=18', pnpm: '*' },
    exports: { '.': {}, './internal': {} },
    dependencies: { zod: '^4.0.0' },
    publishConfig: { access: 'public' },
  });
  assert.equal(errors.length, 7);
});
