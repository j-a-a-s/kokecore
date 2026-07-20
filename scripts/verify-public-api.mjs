import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { listWorkspacePackages } from './lib/package-tarballs.mjs';
import {
  comparePublicApiSnapshots,
  createPublicApiSnapshot,
  readPublicApiSnapshot,
} from './lib/public-api.mjs';

const CODE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const DEEP_IMPORT = /(?:@kokecore\/[a-z0-9-]+\/(?:src|dist)\/|packages\/[a-z0-9-]+\/src\/)/i;

function trackedCodeFiles(root) {
  const result = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8' }
  );
  if (result.status !== 0) throw new Error('Unable to enumerate files for public API validation.');
  return result.stdout
    .split('\0')
    .filter(Boolean)
    .filter((file) => CODE_EXTENSIONS.has(extname(file)));
}

function findDeepImports(root) {
  const failures = [];
  for (const file of trackedCodeFiles(root)) {
    const lines = readFileSync(join(root, file), 'utf8').split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (DEEP_IMPORT.test(line)) failures.push(`${file}:${index + 1}`);
    }
  }
  return failures;
}

const root = resolve(process.cwd());
const failures = [];

for (const item of listWorkspacePackages(root)) {
  const publicSource = join(item.directory, 'src', 'public.ts');
  const snapshotPath = join(item.directory, 'api', 'public-api.json');
  if (!existsSync(publicSource)) {
    failures.push(`${item.manifest.name}: missing src/public.ts`);
    continue;
  }
  if (item.manifest.main !== './dist/public.js' || item.manifest.types !== './dist/public.d.ts') {
    failures.push(`${item.manifest.name}: manifest entry points must target dist/public`);
  }
  if (!existsSync(snapshotPath)) {
    failures.push(`${item.manifest.name}: missing API snapshot`);
    continue;
  }

  const expected = readPublicApiSnapshot(snapshotPath);
  const actual = createPublicApiSnapshot(item.directory, item.manifest);
  if (!comparePublicApiSnapshots(expected, actual)) {
    failures.push(
      `${item.manifest.name}: public API changed; add a changeset and run pnpm api:snapshot`
    );
  }
}

for (const location of findDeepImports(root)) {
  failures.push(`deep import outside package implementation: ${location}`);
}

if (failures.length > 0) {
  console.error('Public API verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Public API verification passed for all packages.');
}
