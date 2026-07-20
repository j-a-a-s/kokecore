import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { collectDependencyInventory } from './lib/dependency-inventory.mjs';

function purl(name, version) {
  if (name.startsWith('@')) {
    const [scope, packageName] = name.slice(1).split('/');
    return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${version}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${version}`;
}

const root = resolve(process.cwd());
const output = resolve(root, process.argv[2] ?? 'artifacts/kokecore.cdx.json');
const inventory = collectDependencyInventory(root);
const components = inventory.map((item) => ({
  type: 'library',
  'bom-ref': purl(item.name, item.version),
  name: item.name,
  version: item.version,
  purl: purl(item.name, item.version),
  ...(item.license ? { licenses: [{ license: { id: item.license } }] } : {}),
  properties: [
    { name: 'kokecore:private', value: String(item.private) },
    { name: 'kokecore:source', value: item.source },
  ],
}));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: 'kokecore',
      version: '0.1.0',
    },
  },
  components,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(sbom, null, 2)}\n`);
console.log(`CycloneDX SBOM written to ${output} (${components.length} components).`);
