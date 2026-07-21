import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONFIG_LINK_SPECIFIER,
  findConfigDeepImports,
  temporaryArtifactSpecifier,
  validateKaklenDependencyContract,
} from './certify-config-kaklen.mjs';

const artifactSpecifier = temporaryArtifactSpecifier('kokecore-config-0.2.0.tgz');

function manifests(configSpecifier = artifactSpecifier, linkedSpecifier = 'link:../core') {
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

const validArtifactLockfile = `
packages/config:
  dependencies:
    '@kokecore/config':
      specifier: ${artifactSpecifier}
      version: file:../artifacts/kokecore-config-0.2.0.tgz
`;

test('accepts a temporary Config artifact while seven packages stay linked', () => {
  assert.deepEqual(
    validateKaklenDependencyContract(manifests(), validArtifactLockfile, artifactSpecifier),
    []
  );
});

test('rejects a Config link during artifact validation and migration of another package', () => {
  const errors = validateKaklenDependencyContract(
    manifests(CONFIG_LINK_SPECIFIER, 'file:auth.tgz'),
    validArtifactLockfile.replace(artifactSpecifier, CONFIG_LINK_SPECIFIER),
    artifactSpecifier
  );
  assert.ok(errors.some((error) => error.includes('unexpected specifier')));
  assert.ok(errors.some((error) => error.includes('must remain a local link')));
  assert.ok(errors.some((error) => error.includes('lockfile still contains a local Config link')));
});

test('accepts the restored Config link during rollback', () => {
  const linkLockfile = `
packages/config:
  dependencies:
    '@kokecore/config':
      specifier: ${CONFIG_LINK_SPECIFIER}
      version: link:../../../kokecore/packages/config
`;
  assert.deepEqual(
    validateKaklenDependencyContract(
      manifests(CONFIG_LINK_SPECIFIER),
      linkLockfile,
      CONFIG_LINK_SPECIFIER
    ),
    []
  );
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

test('only accepts the certified Config tarball name for temporary installation', () => {
  assert.equal(
    temporaryArtifactSpecifier('kokecore-config-0.2.0.tgz'),
    'file:../../../artifacts/kokecore-config-0.2.0.tgz'
  );
  assert.throws(() => temporaryArtifactSpecifier('../config.tgz'));
});
