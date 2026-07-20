import assert from 'node:assert/strict';
import test from 'node:test';

import { scanText } from './scan-secrets.mjs';

test('detects credential classes without returning their values', () => {
  const aws = ['AKIA', '1234567890ABCDEF'].join('');
  const github = ['ghp_', '1234567890abcdefghijklmnop'].join('');
  const privateKey = ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join('');
  const text = [aws, github, privateKey, `PASSWORD="${'real-value-123'}"`].join('\n');
  const findings = scanText(text, 'fixture.txt');

  assert.deepEqual(
    findings.map((item) => item.type),
    ['AWS access key', 'GitHub token', 'Private key', 'Hard-coded credential']
  );
  assert.equal(JSON.stringify(findings).includes('real-value-123'), false);
});

test('allows explicit development examples and placeholders', () => {
  const text = [
    'JWT_SECRET="dev-secret-change-before-production-123"',
    'PASSWORD=<set-in-secret-manager>',
    'TOKEN="placeholder-token"',
    'DATABASE_URL=postgresql://kokecore:kokecore_dev_password@localhost:5432/kokecore_dev',
  ].join('\n');

  assert.deepEqual(scanText(text), []);
});

test('supports an explicit safe-example marker', () => {
  const secret = ['sk_live_', '1234567890abcdef'].join('');
  assert.deepEqual(scanText(`${secret} // secret-scan: allow-safe-example`), []);
});
