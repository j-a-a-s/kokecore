import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// These legacy transitive packages omit package.json#license but ship an MIT
// notice in LICENSE or Readme.md. Keep exceptions exact and review on upgrade.
const VERIFIED_LICENSES = new Map([
  ['passport-strategy@1.0.0', 'MIT'],
  ['pause@0.0.1', 'MIT'],
]);

function readPackageJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function addPackage(inventory, packageJson, source) {
  if (!packageJson?.name || !packageJson.version) return;
  const key = `${packageJson.name}@${packageJson.version}`;
  inventory.set(key, {
    name: packageJson.name,
    version: packageJson.version,
    license: normalizeLicense(packageJson.license) || VERIFIED_LICENSES.get(key) || '',
    private: packageJson.private === true,
    source,
  });
}

function addNodeModulesDirectory(inventory, directory) {
  if (!existsSync(directory)) return;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const entryPath = join(directory, entry.name);

    if (entry.name.startsWith('@')) {
      for (const scopedEntry of readdirSync(entryPath, { withFileTypes: true })) {
        if (!scopedEntry.isDirectory()) continue;
        const packagePath = join(entryPath, scopedEntry.name, 'package.json');
        addPackage(inventory, readPackageJson(packagePath), packagePath);
      }
      continue;
    }

    const packagePath = join(entryPath, 'package.json');
    addPackage(inventory, readPackageJson(packagePath), packagePath);
  }
}

export function normalizeLicense(license) {
  if (typeof license === 'string') return license.trim();
  if (license && typeof license.type === 'string') return license.type.trim();
  if (Array.isArray(license)) {
    return license
      .map((entry) => normalizeLicense(entry))
      .filter(Boolean)
      .join(' OR ');
  }
  return '';
}

export function collectDependencyInventory(root) {
  const inventory = new Map();
  addPackage(inventory, readPackageJson(join(root, 'package.json')), 'workspace');

  const packagesRoot = join(root, 'packages');
  if (existsSync(packagesRoot)) {
    for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packagePath = join(packagesRoot, entry.name, 'package.json');
      addPackage(inventory, readPackageJson(packagePath), packagePath);
    }
  }

  const storeRoot = join(root, 'node_modules', '.pnpm');
  if (existsSync(storeRoot)) {
    for (const entry of readdirSync(storeRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      addNodeModulesDirectory(inventory, join(storeRoot, entry.name, 'node_modules'));
    }
  }

  return [...inventory.values()].sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`)
  );
}
