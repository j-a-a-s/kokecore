import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createReproducibleConfigArtifact } from './certify-config-artifact.mjs';

export const CONFIG_LINK_SPECIFIER = 'link:../../../kokecore/packages/config';

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
]);

const ROLLBACK_VALIDATIONS = Object.freeze([['typecheck'], ['test'], ['build']]);

export function temporaryArtifactSpecifier(archiveName) {
  if (!/^kokecore-config-[0-9]+\.[0-9]+\.[0-9]+\.tgz$/.test(archiveName)) {
    throw new Error(`Invalid Config artifact name: ${archiveName}`);
  }
  return `file:../../../artifacts/${archiveName}`;
}

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

export function validateKaklenDependencyContract(manifests, lockfile, expectedConfigSpecifier) {
  const dependencies = collectKokecoreDependencies(manifests);
  const errors = [];
  const configUses = dependencies.get('@kokecore/config') ?? [];

  if (configUses.length === 0) errors.push('expected at least one @kokecore/config dependency');
  for (const use of configUses) {
    if (use.specifier !== expectedConfigSpecifier) {
      errors.push(`@kokecore/config uses an unexpected specifier in ${use.path}`);
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

  if (expectedConfigSpecifier.startsWith('file:')) {
    if (!lockfile.includes('kokecore-config-0.2.0.tgz')) {
      errors.push('lockfile does not contain the temporary certified Config artifact');
    }
    if (/['"]?@kokecore\/config['"]?:[\s\S]{0,250}(?:specifier|version):\s*link:/.test(lockfile)) {
      errors.push('lockfile still contains a local Config link');
    }
  }
  return errors;
}

export function findConfigDeepImports(files) {
  const pattern = /(?:from\s+|import\s*\(\s*)["']@kokecore\/config\//;
  return files.filter(({ content }) => pattern.test(content)).map(({ path }) => path);
}

export function certifyConfigWithKaklen({
  coreRoot = process.cwd(),
  kaklenSource = process.env.KAKLEN_SOURCE_PATH ?? resolve(process.cwd(), '..', 'kaklen'),
  expectedKaklenSha = process.env.KAKLEN_EXPECTED_SHA,
  archive,
} = {}) {
  const workspaceRoot = resolve(coreRoot);
  const source = resolve(kaklenSource);
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'kokecore-config-kaklen-'));
  const kaklenRoot = join(temporaryRoot, 'kaklen');
  const artifactsRoot = join(temporaryRoot, 'artifacts');

  try {
    assertRepository(source, 'Kaklen source');
    assertRepository(workspaceRoot, 'KOKE CORE source');
    run('git', ['clone', '--quiet', '--no-local', source, kaklenRoot], temporaryRoot);
    const kaklenSha = capture('git', ['rev-parse', 'HEAD'], kaklenRoot).trim();
    if (expectedKaklenSha && kaklenSha !== expectedKaklenSha) {
      throw new Error(`Kaklen SHA mismatch: expected ${expectedKaklenSha}, received ${kaklenSha}.`);
    }

    symlinkSync(workspaceRoot, join(temporaryRoot, 'kokecore'), 'dir');
    const artifact = archive
      ? { archive: resolve(archive) }
      : createReproducibleConfigArtifact({ root: workspaceRoot, destination: artifactsRoot });
    if (!existsSync(artifact.archive)) {
      throw new Error(`Certified Config artifact does not exist: ${artifact.archive}`);
    }
    mkdirSync(artifactsRoot, { recursive: true });
    if (resolve(artifact.archive) !== join(artifactsRoot, basename(artifact.archive))) {
      symlinkSync(resolve(artifact.archive), join(artifactsRoot, basename(artifact.archive)));
    }

    rmSync(join(kaklenRoot, 'vendor', 'kokecore', 'config'), {
      recursive: true,
      force: true,
    });

    setConfigSpecifier(kaklenRoot, CONFIG_LINK_SPECIFIER);
    run('pnpm', ['install', '--no-frozen-lockfile'], kaklenRoot);
    const baselineLockfile = readFileSync(join(kaklenRoot, 'pnpm-lock.yaml'), 'utf8');
    validateKaklenCheckout(kaklenRoot, CONFIG_LINK_SPECIFIER);

    const artifactSpecifier = temporaryArtifactSpecifier(basename(artifact.archive));
    const integrationStartedAt = Date.now();
    setConfigSpecifier(kaklenRoot, artifactSpecifier);
    run('pnpm', ['install', '--no-frozen-lockfile'], kaklenRoot);
    run('pnpm', ['prisma:generate'], kaklenRoot);
    validateKaklenCheckout(kaklenRoot, artifactSpecifier);
    for (const args of KAKLEN_VALIDATIONS) {
      if (args[0] === 'test') clearKaklenTestRedisState(kaklenRoot);
      run('pnpm', args, kaklenRoot);
    }
    const integrationDurationMs = Date.now() - integrationStartedAt;

    const rollbackStartedAt = Date.now();
    setConfigSpecifier(kaklenRoot, CONFIG_LINK_SPECIFIER);
    writeFileSync(join(kaklenRoot, 'pnpm-lock.yaml'), baselineLockfile);
    run('pnpm', ['install', '--no-frozen-lockfile'], kaklenRoot);
    validateKaklenCheckout(kaklenRoot, CONFIG_LINK_SPECIFIER);
    for (const args of ROLLBACK_VALIDATIONS) {
      if (args[0] === 'test') clearKaklenTestRedisState(kaklenRoot);
      run('pnpm', args, kaklenRoot);
    }
    const rollbackDurationMs = Date.now() - rollbackStartedAt;

    console.log('KAKLEN_CONFIG_INTEGRATION_PASSED');
    console.log(`Kaklen SHA: ${kaklenSha}`);
    console.log(`Artifact: ${basename(artifact.archive)}`);
    console.log(`Integration duration: ${integrationDurationMs} ms`);
    console.log(`Rollback duration: ${rollbackDurationMs} ms`);
    console.log('Temporary checkout removed: yes');
    return { artifact, integrationDurationMs, kaklenSha, rollbackDurationMs };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function setConfigSpecifier(kaklenRoot, specifier) {
  let replacements = 0;
  for (const item of collectPackageManifests(kaklenRoot)) {
    let changed = false;
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (item.manifest[section]?.['@kokecore/config'] === undefined) continue;
      item.manifest[section]['@kokecore/config'] = specifier;
      replacements += 1;
      changed = true;
    }
    if (changed) {
      writeFileSync(join(kaklenRoot, item.path), `${JSON.stringify(item.manifest, null, 2)}\n`);
    }
  }
  if (replacements === 0) throw new Error('Kaklen has no @kokecore/config dependency to certify.');
}

function clearKaklenTestRedisState(kaklenRoot) {
  const script = [
    'const Redis = require("ioredis");',
    'const redis = new Redis("redis://localhost:6379/12", { connectTimeout: 3000, maxRetriesPerRequest: 1 });',
    'redis.flushdb().then(() => redis.quit()).catch(async (error) => {',
    '  console.error(`Unable to isolate Kaklen test Redis state: ${error.message}`);',
    '  redis.disconnect();',
    '  process.exitCode = 1;',
    '});',
  ].join('\n');
  run('node', ['--eval', script], join(kaklenRoot, 'apps', 'api'));
}

function validateKaklenCheckout(kaklenRoot, expectedConfigSpecifier) {
  const manifests = collectPackageManifests(kaklenRoot);
  const lockfile = readFileSync(join(kaklenRoot, 'pnpm-lock.yaml'), 'utf8');
  const dependencyErrors = validateKaklenDependencyContract(
    manifests,
    lockfile,
    expectedConfigSpecifier
  );
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

function parseArchiveArgument(args) {
  const index = args.indexOf('--archive');
  if (index === -1) return undefined;
  const archive = args[index + 1];
  if (!archive) throw new Error('--archive requires a tarball path');
  return archive;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  certifyConfigWithKaklen({ archive: parseArchiveArgument(process.argv.slice(2)) });
}
