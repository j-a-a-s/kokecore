import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { listWorkspacePackages, packPackage } from './lib/package-tarballs.mjs';
import { scanFiles } from './scan-secrets.mjs';

const REJECTED_PATHS = [
  { label: 'environment file', pattern: /(^|\/)\.env(?:\.|$)/i },
  {
    label: 'test file',
    pattern: /(?:^|\/)(?:__tests__|tests?)(?:\/|$)|\.(?:spec|test)\.[cm]?[jt]sx?$/i,
  },
  { label: 'coverage output', pattern: /(?:^|\/)(?:coverage|\.nyc_output)(?:\/|$)/i },
  { label: 'temporary file', pattern: /(?:^|\/)(?:tmp|temp)(?:\/|$)|(?:\.swp|~)$/i },
  { label: 'private configuration', pattern: /(?:^|\/)(?:\.npmrc|jest\.config|tsconfig)(?:\.|$)/i },
  { label: 'credential or key', pattern: /\.(?:key|pem|p12|pfx)$/i },
  { label: 'dump', pattern: /\.(?:dump|sql)$/i },
  { label: 'log', pattern: /\.log$/i },
  { label: 'source map', pattern: /\.map$/i },
  { label: 'source file', pattern: /^package\/src\/|(?<!\.d)\.ts$/i },
];

const REQUIRED_FILES = [
  'package/package.json',
  'package/README.md',
  'package/CHANGELOG.md',
  'package/NOTICE',
  'package/LICENSE',
  'package/dist/public.js',
  'package/dist/public.d.ts',
];

export function validateManifest(manifest) {
  const errors = [];
  if (manifest.private !== true) errors.push('manifest must set private: true');
  if (manifest.license !== 'UNLICENSED') errors.push('manifest license must be UNLICENSED');
  if (manifest.publishConfig) errors.push('manifest must not define publishConfig during Alpha');
  if (
    !Array.isArray(manifest.files) ||
    manifest.files.some((entry) => entry === 'src' || entry === 'dist')
  ) {
    errors.push('manifest files must explicitly include compiled JavaScript and declarations');
  }
  const exportKeys = Object.keys(manifest.exports ?? {});
  if (exportKeys.length !== 1 || exportKeys[0] !== '.') {
    errors.push('manifest exports must expose only the package root');
  }
  return errors;
}

export function validateArchiveEntries(entries) {
  const errors = [];
  const normalized = entries.filter(Boolean);
  for (const required of REQUIRED_FILES) {
    if (!normalized.includes(required)) errors.push(`missing required file: ${required}`);
  }
  for (const entry of normalized) {
    for (const rejected of REJECTED_PATHS) {
      if (rejected.pattern.test(entry)) errors.push(`${rejected.label}: ${entry}`);
    }
  }
  return [...new Set(errors)];
}

function listArchive(archive) {
  const result = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Unable to inspect ${archive}: ${result.stderr}`);
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function extractArchive(archive, destination) {
  const result = spawnSync('tar', ['-xzf', archive, '-C', destination], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Unable to extract ${archive}: ${result.stderr}`);
}

export function verifyPackageContents(root = process.cwd()) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'kokecore-package-validation-'));
  const failures = [];

  try {
    for (const item of listWorkspacePackages(resolve(root))) {
      const manifestErrors = validateManifest(item.manifest);
      const archive = packPackage(item.directory, temporaryRoot);
      const entries = listArchive(archive);
      const archiveErrors = validateArchiveEntries(entries);
      const extractionRoot = join(temporaryRoot, item.shortName);
      mkdirSync(extractionRoot, { recursive: true });
      extractArchive(archive, extractionRoot);

      const packagedManifestPath = join(extractionRoot, 'package', 'package.json');
      const packagedManifest = JSON.parse(readFileSync(packagedManifestPath, 'utf8'));
      const packagedManifestErrors = validateManifest(packagedManifest);
      const textFiles = entries.filter((entry) => !entry.endsWith('/'));
      const secretFindings = scanFiles(extractionRoot, textFiles);

      const errors = [
        ...manifestErrors,
        ...archiveErrors,
        ...packagedManifestErrors.map((error) => `packaged ${error}`),
        ...secretFindings.map(
          (finding) =>
            `${finding.type} in tarball at ${finding.file}:${finding.line} (${finding.fingerprint})`
        ),
      ];

      if (errors.length > 0) {
        failures.push({ name: item.manifest.name, errors });
      } else {
        console.log(`Package contents passed: ${item.manifest.name} (${basename(archive)})`);
      }
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`Package validation failed: ${failure.name}`);
      for (const error of failure.errors) console.error(`- ${error}`);
    }
    return false;
  }
  return true;
}

function main() {
  if (!verifyPackageContents()) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
