import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createAndValidateConfigArtifact } from './certify-config-artifact.mjs';

export const CERTIFIED_CONFIG_SPECIFIER =
  'file:../../vendor/kokecore/config/kokecore-config-0.2.0.tgz';

export const LINKED_KOKECORE_PACKAGES = Object.freeze([
  '@kokecore/auth',
  '@kokecore/calendar',
  '@kokecore/errors',
  '@kokecore/logging',
  '@kokecore/rbac',
  '@kokecore/storage',
  '@kokecore/validation',
]);

const KAKLEN_VALIDATIONS = Object.freeze([
  ['env:verify'],
  ['lint'],
  ['typecheck'],
  ['test'],
  ['build'],
  ['architecture:check'],
  ['security:scan'],
  ['--filter', '@kaklen/config', 'test'],
]);

export function collectKokecoreDependencies(manifests) {
  const dependencies = new Map();
  for (const { path, manifest } of manifests) {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
        if (!name.startsWith('@kokecore/')) continue;
        const uses = dependencies.get(name) ?? [];
        uses.push({ path, section, specifier });
        dependencies.set(name, uses);
      }
    }
  }
  return dependencies;
}

export function validateKaklenDependencyContract(manifests, lockfile) {
  const dependencies = collectKokecoreDependencies(manifests);
  const errors = [];
  const configUses = dependencies.get('@kokecore/config') ?? [];

  if (configUses.length !== 1) {
    errors.push(`expected one @kokecore/config dependency, found ${configUses.length}`);
  }
  for (const use of configUses) {
    if (use.specifier !== CERTIFIED_CONFIG_SPECIFIER) {
      errors.push(`@kokecore/config uses an uncertified specifier in ${use.path}`);
    }
  }

  for (const packageName of LINKED_KOKECORE_PACKAGES) {
    const uses = dependencies.get(packageName) ?? [];
    if (uses.length === 0) {
      errors.push(`${packageName} local link is missing`);
      continue;
    }
    for (const use of uses) {
      if (!use.specifier.startsWith('link:')) {
        errors.push(`${packageName} must remain a local link in ${use.path}`);
      }
    }
  }

  for (const packageName of dependencies.keys()) {
    if (packageName !== '@kokecore/config' && !LINKED_KOKECORE_PACKAGES.includes(packageName)) {
      errors.push(`unexpected KOKE CORE dependency: ${packageName}`);
    }
  }

  if (!lockfile.includes('file:vendor/kokecore/config/kokecore-config-0.2.0.tgz')) {
    errors.push('lockfile does not contain the certified Config artifact');
  }
  if (/['"]?@kokecore\/config['"]?:[\s\S]{0,250}(?:specifier|version):\s*link:/.test(lockfile)) {
    errors.push('lockfile still contains a local Config link');
  }
  return errors;
}

export function findConfigDeepImports(files) {
  const pattern = /(?:from\s+|import\s*\(\s*)["']@kokecore\/config\//;
  return files.filter(({ content }) => pattern.test(content)).map(({ path }) => path);
}

export function readExpectedChecksum(content, archiveName) {
  const line = content
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.endsWith(`  ${archiveName}`));
  const checksum = line?.split(/\s+/)[0];
  if (!checksum || !/^[a-f0-9]{64}$/.test(checksum)) {
    throw new Error(`No valid SHA-256 entry found for ${archiveName}.`);
  }
  return checksum;
}

export function certifyConfigWithKaklen({
  coreRoot = process.cwd(),
  kaklenSource = process.env.KAKLEN_SOURCE_PATH ?? resolve(process.cwd(), '..', 'kaklen'),
  expectedKaklenSha = process.env.KAKLEN_EXPECTED_SHA,
} = {}) {
  const workspaceRoot = resolve(coreRoot);
  const source = resolve(kaklenSource);
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'kokecore-config-kaklen-'));
  const kaklenRoot = join(temporaryRoot, 'kaklen');
  const artifactRoot = join(temporaryRoot, 'artifacts');

  try {
    assertRepository(source, 'Kaklen source');
    assertRepository(workspaceRoot, 'KOKE CORE source');
    run('git', ['clone', '--quiet', '--no-local', source, kaklenRoot], temporaryRoot);
    const kaklenSha = capture('git', ['rev-parse', 'HEAD'], kaklenRoot).trim();
    if (expectedKaklenSha && kaklenSha !== expectedKaklenSha) {
      throw new Error(`Kaklen SHA mismatch: expected ${expectedKaklenSha}, received ${kaklenSha}.`);
    }

    symlinkSync(workspaceRoot, join(temporaryRoot, 'kokecore'), 'dir');
    run('corepack', ['pnpm', 'build'], workspaceRoot);

    const artifact = createAndValidateConfigArtifact({
      root: workspaceRoot,
      destination: artifactRoot,
    });
    const vendorRoot = join(kaklenRoot, 'vendor', 'kokecore', 'config');
    const vendorArchive = join(vendorRoot, basename(artifact.archive));
    copyFileSync(artifact.archive, vendorArchive);
    validateArtifactChecksum(vendorRoot, vendorArchive, artifact.checksum);
    validateKaklenCheckout(kaklenRoot);

    run('pnpm', ['install', '--frozen-lockfile'], kaklenRoot);
    run('pnpm', ['prisma:generate'], kaklenRoot);
    for (const args of KAKLEN_VALIDATIONS) run('pnpm', args, kaklenRoot);

    console.log('KAKLEN_CONFIG_INTEGRATION_PASSED');
    console.log(`Kaklen SHA: ${kaklenSha}`);
    console.log(`Config version: ${artifact.version}`);
    console.log(`Config SHA256: ${artifact.checksum}`);
    console.log('Temporary checkout removed: yes');
    return { artifact, kaklenSha };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function validateKaklenCheckout(kaklenRoot) {
  const manifests = collectPackageManifests(kaklenRoot);
  const lockfile = readFileSync(join(kaklenRoot, 'pnpm-lock.yaml'), 'utf8');
  const dependencyErrors = validateKaklenDependencyContract(manifests, lockfile);
  const sourceFiles = collectSourceFiles(kaklenRoot);
  const deepImports = findConfigDeepImports(sourceFiles);
  const errors = [
    ...dependencyErrors,
    ...deepImports.map((path) => `Config deep import found in ${path}`),
  ];
  if (errors.length > 0) {
    throw new Error(`Kaklen Config consumption contract failed:\n- ${errors.join('\n- ')}`);
  }
}

function validateArtifactChecksum(vendorRoot, vendorArchive, actualChecksum) {
  const archiveName = basename(vendorArchive);
  const expectedChecksum = readExpectedChecksum(
    readFileSync(join(vendorRoot, 'SHA256SUMS'), 'utf8'),
    archiveName
  );
  const copiedChecksum = createHash('sha256').update(readFileSync(vendorArchive)).digest('hex');
  if (actualChecksum !== expectedChecksum || copiedChecksum !== expectedChecksum) {
    throw new Error(
      `Config artifact checksum mismatch: expected ${expectedChecksum}, generated ${actualChecksum}, copied ${copiedChecksum}.`
    );
  }
}

function collectPackageManifests(root) {
  const manifests = [];
  for (const parent of ['apps', 'packages']) {
    const directory = join(root, parent);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(directory, entry.name, 'package.json');
      if (!existsSync(manifestPath)) continue;
      manifests.push({
        path: relative(root, manifestPath),
        manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
      });
    }
  }
  return manifests;
}

function collectSourceFiles(root) {
  const files = [];
  for (const parent of ['apps', 'packages'])
    collectSourceFilesFrom(join(root, parent), root, files);
  return files;
}

function collectSourceFilesFrom(directory, root, files) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['dist', 'node_modules', 'coverage'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFilesFrom(path, root, files);
    } else if (/\.(?:ts|mts|cts|mjs)$/.test(entry.name)) {
      files.push({ path: relative(root, path), content: readFileSync(path, 'utf8') });
    }
  }
}

function assertRepository(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory() || !existsSync(join(path, '.git'))) {
    throw new Error(`${label} is not a Git repository: ${path}`);
  }
}

function capture(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    timeout: commandTimeout(),
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}: ${result.error?.message ?? result.stderr ?? result.stdout}`
    );
  }
  return result.stdout;
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    timeout: commandTimeout(),
    killSignal: 'SIGTERM',
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}: ${result.error?.message ?? `exit ${result.status}`}`
    );
  }
}

function commandTimeout() {
  const timeout = Number(process.env.KOKE_CONFIG_COMMAND_TIMEOUT_MS ?? 900_000);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new Error('KOKE_CONFIG_COMMAND_TIMEOUT_MS must be a positive integer.');
  }
  return timeout;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  certifyConfigWithKaklen();
}
