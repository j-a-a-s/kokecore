import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { packWorkspacePackages } from './package-tarballs.mjs';

const EXPECTED_PACKAGES = [
  '@kokecore/auth',
  '@kokecore/calendar',
  '@kokecore/config',
  '@kokecore/errors',
  '@kokecore/logging',
  '@kokecore/rbac',
  '@kokecore/storage',
  '@kokecore/validation',
];

const REJECTED_SUBPATHS = ['src/index', 'src/public', 'dist/internal'];

function run(command, args, cwd) {
  const timeout = Number(process.env.KOKE_CONSUMER_COMMAND_TIMEOUT_MS ?? 180_000);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new Error('KOKE_CONSUMER_COMMAND_TIMEOUT_MS must be a positive integer.');
  }
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
    timeout,
    killSignal: 'SIGTERM',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(
      `${command} ${args.join(' ')} could not complete in ${cwd}: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}\n${result.stdout}\n${result.stderr}`
    );
  }
  return result;
}

function runPnpm(args, cwd) {
  const version = process.env.KOKE_CONSUMER_PNPM_VERSION;
  if (!version) return run('pnpm', args, cwd);
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid KOKE_CONSUMER_PNPM_VERSION: ${version}`);
  }
  return run('corepack', [`pnpm@${version}`, ...args], cwd);
}

export function runPackagedConsumerContract(root = process.cwd()) {
  const workspaceRoot = resolve(root);
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'kokecore-consumer-contract-'));
  const archivesRoot = join(temporaryRoot, 'archives');
  const consumerRoot = join(temporaryRoot, 'consumer');

  try {
    mkdirSync(archivesRoot, { recursive: true });
    const archives = packWorkspacePackages(workspaceRoot, archivesRoot);
    const packageNames = [...archives.keys()].sort();
    if (JSON.stringify(packageNames) !== JSON.stringify(EXPECTED_PACKAGES)) {
      throw new Error(
        `Packaged consumer expected ${EXPECTED_PACKAGES.join(', ')}, received ${packageNames.join(', ')}`
      );
    }
    cpSync(join(workspaceRoot, 'apps', 'reference-consumer'), consumerRoot, { recursive: true });

    const manifestPath = join(consumerRoot, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const [dependency, archive] of archives) {
      manifest.dependencies[dependency] = `file:${archive}`;
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    runPnpm(['install', '--no-frozen-lockfile'], consumerRoot);
    runPnpm(['run', 'typecheck'], consumerRoot);
    runPnpm(['run', 'build'], consumerRoot);
    const execution = runPnpm(['run', 'start'], consumerRoot);
    if (!execution.stdout.includes('REFERENCE_CONSUMER_OK')) {
      throw new Error('Reference consumer did not report successful execution.');
    }

    let rejectedDeepImports = 0;
    for (const packageName of EXPECTED_PACKAGES) {
      for (const subpath of REJECTED_SUBPATHS) {
        const specifier = `${packageName}/${subpath}`;
        const deepImport = spawnSync('node', ['-e', `require(${JSON.stringify(specifier)})`], {
          cwd: consumerRoot,
          encoding: 'utf8',
        });
        const output = `${deepImport.stderr}${deepImport.stdout}`;
        if (deepImport.status === 0 || !output.includes('ERR_PACKAGE_PATH_NOT_EXPORTED')) {
          throw new Error(
            `Deep import ${specifier} was not rejected by the package exports map.\n${output}`
          );
        }
        rejectedDeepImports += 1;
      }
    }

    return {
      packageCount: archives.size,
      rejectedDeepImports,
      output: execution.stdout.trim(),
    };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
