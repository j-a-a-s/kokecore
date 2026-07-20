import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { listWorkspacePackages } from './lib/package-tarballs.mjs';
import { createPublicApiSnapshot } from './lib/public-api.mjs';

const root = resolve(process.cwd());
for (const item of listWorkspacePackages(root)) {
  const snapshot = createPublicApiSnapshot(item.directory, item.manifest);
  const apiDirectory = join(item.directory, 'api');
  const snapshotPath = join(apiDirectory, 'public-api.json');
  mkdirSync(apiDirectory, { recursive: true });
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Updated public API snapshot: ${item.manifest.name}`);
}
