import assert from 'node:assert/strict';
import test from 'node:test';

import { validateArchiveEntries, validateManifest } from './verify-package-contents.mjs';

const validEntries = [
  'package/package.json',
  'package/README.md',
  'package/CHANGELOG.md',
  'package/NOTICE',
  'package/LICENSE',
  'package/dist/public.js',
  'package/dist/public.d.ts',
];

test('accepts a minimal private package contract', () => {
  assert.deepEqual(validateArchiveEntries(validEntries), []);
  assert.deepEqual(
    validateManifest({
      private: true,
      license: 'UNLICENSED',
      files: ['dist/**/*.js', 'dist/**/*.d.ts', 'README.md', 'CHANGELOG.md', 'NOTICE'],
      exports: { '.': './dist/public.js' },
    }),
    []
  );
});

test('rejects source, tests, environment files, and public metadata', () => {
  const archiveErrors = validateArchiveEntries([
    ...validEntries,
    'package/src/index.ts',
    'package/.env.production',
    'package/dist/index.spec.js',
    'package/dist/public.js.map',
  ]);
  assert.ok(archiveErrors.some((error) => error.includes('source file')));
  assert.ok(archiveErrors.some((error) => error.includes('environment file')));
  assert.ok(archiveErrors.some((error) => error.includes('test file')));
  assert.ok(archiveErrors.some((error) => error.includes('source map')));

  const manifestErrors = validateManifest({
    private: false,
    license: 'MIT',
    files: ['dist', 'src'],
    exports: { '.': './dist/public.js', './src/*': './src/*' },
    publishConfig: { access: 'public' },
  });
  assert.equal(manifestErrors.length, 5);
});
