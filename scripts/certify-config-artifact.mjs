import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { packPackage } from './lib/package-tarballs.mjs';
import { scanFiles } from './scan-secrets.mjs';

export const CONFIG_ARCHIVE_ENTRIES = Object.freeze([
  'package/NOTICE',
  'package/README.md',
  'package/dist/index.d.ts',
  'package/dist/index.js',
  'package/dist/public.d.ts',
  'package/dist/public.js',
  'package/package.json',
]);

export const CONFIG_MANIFEST_FILES = Object.freeze([
  'dist/**/*.js',
  'dist/**/*.d.ts',
  'README.md',
  'NOTICE',
]);

const PRODUCT_PATTERNS = [
  /\bKaklen\b/i,
  /\b(?:JWT|CORS|REDIS|WHATSAPP|PAYMENT|MAIL|DATABASE)_[A-Z0-9_]+\b/,
  /kokecore_dev_password/i,
  /localhost:4200/,
];

export function validateConfigArchiveEntries(entries) {
  const actual = [...new Set(entries.filter(Boolean))].sort();
  const expected = [...CONFIG_ARCHIVE_ENTRIES].sort();
  const errors = [];

  for (const entry of expected) {
    if (!actual.includes(entry)) errors.push(`missing required file: ${entry}`);
  }
  for (const entry of actual) {
    if (!expected.includes(entry)) errors.push(`unexpected archive file: ${entry}`);
  }
  return errors;
}

export function validateConfigManifest(manifest) {
  const errors = [];
  if (manifest.name !== '@kokecore/config') errors.push('package name must be @kokecore/config');
  if (manifest.version !== '0.2.0') errors.push('package version must be 0.2.0');
  if (manifest.private !== true) errors.push('package must remain private during Alpha');
  if (manifest.license !== 'UNLICENSED') errors.push('package license must be UNLICENSED');
  if (manifest.sideEffects !== false) errors.push('sideEffects must be false');
  if (manifest.engines?.node !== '>=22 <25') errors.push('Node engine must be >=22 <25');
  if (manifest.engines?.pnpm !== '>=8 <10') errors.push('pnpm engine must be >=8 <10');
  if (manifest.main !== './dist/public.js') errors.push('main must target dist/public.js');
  if (manifest.types !== './dist/public.d.ts') errors.push('types must target dist/public.d.ts');
  if (Object.keys(manifest.exports ?? {}).join(',') !== '.') {
    errors.push('exports must expose only the package root');
  }
  if (JSON.stringify(manifest.files) !== JSON.stringify(CONFIG_MANIFEST_FILES)) {
    errors.push('files must contain only the certified package file patterns');
  }
  if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
    errors.push('certified Config artifact must not have runtime dependencies');
  }
  if (manifest.publishConfig) errors.push('publishConfig is prohibited during Alpha');
  return errors;
}

export function createAndValidateConfigArtifact({ root = process.cwd(), destination }) {
  const repositoryRoot = resolve(root);
  const outputDirectory = resolve(destination);
  const packageDirectory = join(repositoryRoot, 'packages', 'config');
  const extractionRoot = mkdtempSync(join(tmpdir(), 'kokecore-config-artifact-'));
  const packageStage = mkdtempSync(join(tmpdir(), 'kokecore-config-package-'));
  mkdirSync(outputDirectory, { recursive: true });

  run('corepack', ['pnpm', '--filter', '@kokecore/config', 'clean'], repositoryRoot);
  run('corepack', ['pnpm', '--filter', '@kokecore/config', 'build'], repositoryRoot);

  const expectedArchive = join(outputDirectory, 'kokecore-config-0.2.0.tgz');
  rmSync(expectedArchive, { force: true });

  try {
    stagePackage(packageDirectory, packageStage);
    const archive = packPackage(packageStage, outputDirectory);
    const entries = listArchive(archive);
    const entryErrors = validateConfigArchiveEntries(entries);
    run('tar', ['-xzf', archive, '-C', extractionRoot], repositoryRoot);

    const manifest = JSON.parse(
      readFileSync(join(extractionRoot, 'package', 'package.json'), 'utf8')
    );
    const manifestErrors = validateConfigManifest(manifest);
    const secretFindings = scanFiles(extractionRoot, entries);
    const contentErrors = validateExtractedContent(extractionRoot, entries);
    const errors = [
      ...entryErrors,
      ...manifestErrors,
      ...contentErrors,
      ...secretFindings.map(
        (finding) => `${finding.type} at ${finding.file}:${finding.line} (${finding.fingerprint})`
      ),
    ];
    if (errors.length > 0) {
      throw new Error(`Config artifact validation failed:\n- ${errors.join('\n- ')}`);
    }

    return {
      archive,
      checksum: sha256(archive),
      entries: Object.freeze([...entries].sort()),
      sizeBytes: statSync(archive).size,
      version: manifest.version,
    };
  } finally {
    rmSync(extractionRoot, { recursive: true, force: true });
    rmSync(packageStage, { recursive: true, force: true });
  }
}

export function createReproducibleConfigArtifact({ root = process.cwd(), destination }) {
  const repositoryRoot = resolve(root);
  const outputDirectory = resolve(destination);
  const comparisonRoot = mkdtempSync(join(tmpdir(), 'kokecore-config-reproducibility-'));

  try {
    const first = createAndValidateConfigArtifact({
      root: repositoryRoot,
      destination: join(comparisonRoot, 'first'),
    });
    const second = createAndValidateConfigArtifact({
      root: repositoryRoot,
      destination: join(comparisonRoot, 'second'),
    });

    if (first.checksum !== second.checksum) {
      throw new Error(
        `Config artifact is not reproducible: ${first.checksum} != ${second.checksum}`
      );
    }
    if (JSON.stringify(first.entries) !== JSON.stringify(second.entries)) {
      throw new Error('Config artifact entries changed between clean builds.');
    }

    mkdirSync(outputDirectory, { recursive: true });
    const archive = join(outputDirectory, basename(second.archive));
    rmSync(archive, { force: true });
    copyFileSync(second.archive, archive);

    return {
      ...second,
      archive,
      commitSha: capture('git', ['rev-parse', 'HEAD'], repositoryRoot).trim(),
      generatedAtUtc: new Date().toISOString(),
      reproducible: true,
    };
  } finally {
    rmSync(comparisonRoot, { recursive: true, force: true });
  }
}

function stagePackage(packageDirectory, packageStage) {
  for (const file of ['package.json', 'README.md', 'NOTICE']) {
    copyFileSync(join(packageDirectory, file), join(packageStage, file));
  }
  cpSync(join(packageDirectory, 'dist'), join(packageStage, 'dist'), { recursive: true });
}

function validateExtractedContent(extractionRoot, entries) {
  const errors = [];
  const textEntries = entries.filter((entry) => !entry.endsWith('/'));

  for (const entry of textEntries) {
    const content = readFileSync(join(extractionRoot, entry), 'utf8');
    if (content.includes('sourceMappingURL=')) {
      errors.push(`source map reference is not allowed: ${entry}`);
    }
    if (/from\s+["']@kokecore\/config\//.test(content)) {
      errors.push(`deep package import is not allowed: ${entry}`);
    }
    for (const pattern of PRODUCT_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) errors.push(`product-specific content in ${entry}`);
    }
  }

  const notice = readFileSync(join(extractionRoot, 'package', 'NOTICE'), 'utf8');
  if (!/proprietary/i.test(notice)) errors.push('NOTICE must declare proprietary terms');
  return [...new Set(errors)];
}

function listArchive(archive) {
  const result = run('tar', ['-tzf', archive], process.cwd());
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function capture(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout || 'no output'}`
    );
  }
  return result.stdout;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout || 'no output'}`
    );
  }
  return result;
}

function parseOutputArgument(args) {
  const outputIndex = args.indexOf('--output');
  if (outputIndex === -1) return undefined;
  const output = args[outputIndex + 1];
  if (!output) throw new Error('--output requires a directory');
  return output;
}

function main() {
  const temporaryOutput = mkdtempSync(join(tmpdir(), 'kokecore-config-output-'));
  const requestedOutput = parseOutputArgument(process.argv.slice(2));
  const destination = requestedOutput ?? temporaryOutput;

  try {
    const result = createReproducibleConfigArtifact({ destination });
    console.log('CONFIG_ARTIFACT_VALIDATED');
    console.log('Reproducible: yes');
    console.log(`Artifact: ${basename(result.archive)}`);
    console.log(`Version: ${result.version}`);
    console.log(`Size: ${result.sizeBytes} bytes`);
    console.log(`SHA256: ${result.checksum}`);
    console.log(`Commit: ${result.commitSha}`);
    console.log(`Generated UTC: ${result.generatedAtUtc}`);
    console.log(`Files: ${result.entries.length}`);
    if (requestedOutput) console.log(`Path: ${result.archive}`);
  } finally {
    rmSync(temporaryOutput, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
