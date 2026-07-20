import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CERTIFIED_CONFIG_SPECIFIER,
  findConfigDeepImports,
  readExpectedChecksum,
  validateKaklenDependencyContract,
} from './certify-config-kaklen.mjs';

function manifests(configSpecifier = CERTIFIED_CONFIG_SPECIFIER, linkedSpecifier = 'link:../core') {
  return [
    {
      path: 'packages/config/package.json',
      manifest: { dependencies: { '@kokecore/config': configSpecifier } },
    },
    {
      path: 'apps/api/package.json',
      manifest: {
        dependencies: Object.fromEntries(
          ['auth', 'calendar', 'errors', 'logging', 'rbac', 'storage', 'validation'].map((name) => [
            `@kokecore/${name}`,
            linkedSpecifier,
          ])
        ),
      },
    },
  ];
}

const validLockfile = `
packages/config:
  dependencies:
    '@kokecore/config':
      specifier: ${CERTIFIED_CONFIG_SPECIFIER}
      version: file:vendor/kokecore/config/kokecore-config-0.2.0.tgz
`;

test('accepts only the certified Config artifact while seven packages stay linked', () => {
  assert.deepEqual(validateKaklenDependencyContract(manifests(), validLockfile), []);
});

test('rejects a Config link and migration of another package', () => {
  const errors = validateKaklenDependencyContract(
    manifests('link:../../../kokecore/packages/config', 'file:auth.tgz'),
    validLockfile.replace(CERTIFIED_CONFIG_SPECIFIER, 'link:../../../kokecore/packages/config')
  );
  assert.ok(errors.some((error) => error.includes('uncertified specifier')));
  assert.ok(errors.some((error) => error.includes('must remain a local link')));
  assert.ok(errors.some((error) => error.includes('lockfile still contains a local Config link')));
});

test('detects Config deep imports but accepts the package root', () => {
  const deepImport = ['@kokecore/config', 'src/public'].join('/');
  assert.deepEqual(
    findConfigDeepImports([
      { path: 'root.ts', content: 'import { readString } from "@kokecore/config";' },
      { path: 'deep.ts', content: `import { hidden } from "${deepImport}";` },
    ]),
    ['deep.ts']
  );
});

test('reads only a complete SHA-256 entry for the expected archive', () => {
  const checksum = 'a'.repeat(64);
  assert.equal(
    readExpectedChecksum(`${checksum}  kokecore-config-0.2.0.tgz\n`, 'kokecore-config-0.2.0.tgz'),
    checksum
  );
  assert.throws(() => readExpectedChecksum('invalid  other.tgz\n', 'kokecore-config-0.2.0.tgz'));
});
