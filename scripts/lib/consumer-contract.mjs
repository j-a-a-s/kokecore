import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { packWorkspacePackages } from './package-tarballs.mjs';

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}\n${result.stdout}\n${result.stderr}`
    );
  }
  return result;
}

export function runPackagedConsumerContract(root = process.cwd()) {
  const workspaceRoot = resolve(root);
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'kokecore-consumer-contract-'));
  const archivesRoot = join(temporaryRoot, 'archives');
  const consumerRoot = join(temporaryRoot, 'consumer');

  try {
    mkdirSync(archivesRoot, { recursive: true });
    const archives = packWorkspacePackages(workspaceRoot, archivesRoot);
    cpSync(join(workspaceRoot, 'apps', 'reference-consumer'), consumerRoot, { recursive: true });

    const manifestPath = join(consumerRoot, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const dependency of Object.keys(manifest.dependencies)) {
      const archive = archives.get(dependency);
      if (!archive) throw new Error(`No packed archive found for ${dependency}`);
      manifest.dependencies[dependency] = `file:${archive}`;
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    run('pnpm', ['install', '--no-frozen-lockfile'], consumerRoot);
    run('pnpm', ['run', 'typecheck'], consumerRoot);
    run('pnpm', ['run', 'build'], consumerRoot);
    const execution = run('pnpm', ['run', 'start'], consumerRoot);
    if (!execution.stdout.includes('REFERENCE_CONSUMER_OK')) {
      throw new Error('Reference consumer did not report successful execution.');
    }

    const deepImport = spawnSync('node', ['-e', "require('@kokecore/config' + '/src/index')"], {
      cwd: consumerRoot,
      encoding: 'utf8',
    });
    if (
      deepImport.status === 0 ||
      !`${deepImport.stderr}${deepImport.stdout}`.includes('ERR_PACKAGE_PATH_NOT_EXPORTED')
    ) {
      throw new Error('A package deep import was not rejected by the exports map.');
    }

    return { packageCount: archives.size, output: execution.stdout.trim() };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
