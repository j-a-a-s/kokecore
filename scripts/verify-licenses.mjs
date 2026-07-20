import { resolve } from 'node:path';

import { collectDependencyInventory } from './lib/dependency-inventory.mjs';

const DISALLOWED = /\b(?:A?GPL|SSPL|BUSL|Commons-Clause)(?:-|\b)/i;

const root = resolve(process.cwd());
const inventory = collectDependencyInventory(root);
const missing = inventory.filter((item) => !item.license && !item.private);
const disallowed = inventory.filter((item) => DISALLOWED.test(item.license));

if (missing.length > 0 || disallowed.length > 0) {
  for (const item of missing) {
    console.error(`Missing dependency license: ${item.name}@${item.version}`);
  }
  for (const item of disallowed) {
    console.error(`Disallowed dependency license: ${item.name}@${item.version} (${item.license})`);
  }
  process.exitCode = 1;
} else {
  console.log(`License review passed for ${inventory.length} unique components.`);
}
