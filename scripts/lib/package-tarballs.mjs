import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function listWorkspacePackages(root) {
  const packagesRoot = join(root, 'packages');
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(packagesRoot, entry.name, 'package.json'))
    )
    .map((entry) => {
      const directory = join(packagesRoot, entry.name);
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
      return { directory, manifest, shortName: entry.name };
    })
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

export function packPackage(packageDirectory, destination) {
  const result = spawnSync('pnpm', ['pack', '--pack-destination', resolve(destination)], {
    cwd: packageDirectory,
    encoding: 'utf8',
    env: { ...process.env, npm_config_loglevel: 'error' },
  });
  if (result.status !== 0) {
    throw new Error(`pnpm pack failed in ${packageDirectory}: ${result.stderr || result.stdout}`);
  }
  const archive = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!archive || !existsSync(archive)) {
    throw new Error(`pnpm pack did not produce an archive for ${packageDirectory}`);
  }
  return resolve(archive);
}

export function packWorkspacePackages(root, destination) {
  const archives = new Map();
  for (const item of listWorkspacePackages(root)) {
    archives.set(item.manifest.name, packPackage(item.directory, destination));
  }
  return archives;
}
