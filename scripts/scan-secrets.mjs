import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ALLOW_MARKER = 'secret-scan: allow-safe-example';
const MAX_FILE_SIZE = 1024 * 1024;
const BINARY_EXTENSIONS = new Set([
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.tar',
  '.tgz',
  '.woff',
  '.woff2',
  '.zip',
]);

const DIRECT_PATTERNS = [
  { type: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { type: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,255}\b/g },
  { type: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'Stripe live key', pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  {
    type: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    type: 'Private key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    type: 'Credential URL',
    pattern:
      /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/gi,
  },
];

const QUOTED_ASSIGNMENT =
  /\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\b\s*[:=]\s*(['"`])([^'"`\r\n]+)\1/gi;
const ENV_ASSIGNMENT =
  /^\s*[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|ACCESS_KEY)[A-Z0-9_]*\s*=\s*(.+?)\s*$/i;

function isSafeExample(value) {
  const normalized = value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase();
  if (!normalized) return true;
  if (/^(?:\$\{|<|process\.env\.)/.test(normalized)) return true;
  if (/^(?:example|placeholder|changeme|replace-me|dummy|redacted|not-a-secret)/.test(normalized)) {
    return true;
  }
  if (normalized.includes('dev-secret') || normalized.includes('test-only')) return true;
  if (
    /^postgresql:\/\/kokecore:kokecore_dev_password@localhost(?::\d+)?\/kokecore_dev/.test(
      normalized
    )
  ) {
    return true;
  }
  if (/^x{8,}$/.test(normalized)) return true;
  return normalized === 'kokecore_dev_password';
}

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function finding(type, file, line, value) {
  return { type, file, line, fingerprint: fingerprint(value) };
}

export function scanText(text, file = '<memory>') {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (line.includes(ALLOW_MARKER)) continue;

    for (const { type, pattern } of DIRECT_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const value = match[0];
        if (!isSafeExample(value)) findings.push(finding(type, file, index + 1, value));
      }
    }

    let quotedCredentialFound = false;
    QUOTED_ASSIGNMENT.lastIndex = 0;
    for (const match of line.matchAll(QUOTED_ASSIGNMENT)) {
      const value = match[2] ?? '';
      if (!isSafeExample(value)) {
        quotedCredentialFound = true;
        findings.push(finding('Hard-coded credential', file, index + 1, value));
      }
    }

    const envMatch = line.match(ENV_ASSIGNMENT);
    if (envMatch && !quotedCredentialFound) {
      const value = envMatch[1] ?? '';
      if (!isSafeExample(value)) {
        findings.push(finding('Environment credential', file, index + 1, value));
      }
    }
  }

  return findings;
}

export function scanFiles(root, files) {
  const findings = [];
  for (const file of files) {
    const absolutePath = resolve(root, file);
    if (BINARY_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    try {
      if (statSync(absolutePath).size > MAX_FILE_SIZE) continue;
      findings.push(...scanText(readFileSync(absolutePath, 'utf8'), file));
    } catch {
      // A concurrently removed or non-text file is outside the scan surface.
    }
  }
  return findings;
}

function trackedFiles(root) {
  const result = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );
  if (result.status !== 0) {
    throw new Error('Unable to enumerate tracked files for secret scanning.');
  }
  return result.stdout.split('\0').filter(Boolean);
}

function main() {
  const root = resolve(process.cwd());
  const findings = scanFiles(root, trackedFiles(root));
  if (findings.length > 0) {
    console.error(`Secret scan failed with ${findings.length} finding(s):`);
    for (const item of findings) {
      console.error(
        `- ${item.type} at ${item.file}:${item.line} (fingerprint ${item.fingerprint})`
      );
    }
    process.exitCode = 1;
    return;
  }
  console.log('Secret scan passed: no credential patterns found.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
