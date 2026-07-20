import assert from 'node:assert/strict';
import test from 'node:test';

import { scanConfigPackage, scanConfigSource } from './scan-config-sast.mjs';

test('accepts product-neutral configuration code', () => {
  const findings = scanConfigSource(`
    export function readValue(environment: Readonly<Record<string, string | undefined>>) {
      return environment.VALUE?.trim();
    }
  `);
  assert.deepEqual(findings, []);
});

test('rejects system access, dynamic execution, process globals, and explicit any', () => {
  const findings = scanConfigSource(`
    import { readFileSync } from "node:fs";
    const value: any = process.env.VALUE;
    eval(value);
    import(value);
    new Function(value);
    require(value);
  `);
  assert.deepEqual([...new Set(findings.map((finding) => finding.code))].sort(), [
    'DIRECT_PROCESS_ENV',
    'DYNAMIC_EXECUTION',
    'DYNAMIC_IMPORT',
    'EXPLICIT_ANY',
    'SYSTEM_MODULE',
  ]);
});

test('the certified Config package has no focused SAST findings', () => {
  assert.deepEqual(scanConfigPackage(), { files: 2, findings: [] });
});
