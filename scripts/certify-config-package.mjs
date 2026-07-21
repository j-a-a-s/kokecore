import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReproducibleConfigArtifact } from './certify-config-artifact.mjs';
import { certifyIsolatedConfigConsumer } from './certify-config-isolated.mjs';
import { certifyConfigWithKaklen } from './certify-config-kaklen.mjs';

export function certifyConfigPackage({
  root = process.cwd(),
  output,
  kaklenSource = process.env.KAKLEN_SOURCE_PATH,
  expectedKaklenSha = process.env.KAKLEN_EXPECTED_SHA,
}) {
  if (Number(process.versions.node.split('.')[0]) !== 22) {
    throw new Error(`Config package certification requires Node 22, received ${process.version}.`);
  }
  if (!kaklenSource) throw new Error('KAKLEN_SOURCE_PATH is required.');

  const repositoryRoot = resolve(root);
  const outputRoot = resolve(output);
  mkdirSync(outputRoot, { recursive: true });

  const artifact = createReproducibleConfigArtifact({
    root: repositoryRoot,
    destination: outputRoot,
  });
  const consumers = ['8.15.0', '9.15.4'].map((pnpmVersion) =>
    certifyIsolatedConfigConsumer({
      archive: artifact.archive,
      pnpmVersion,
      root: repositoryRoot,
    })
  );
  const kaklen = certifyConfigWithKaklen({
    archive: artifact.archive,
    coreRoot: repositoryRoot,
    expectedKaklenSha,
    kaklenSource,
  });
  const evidence = {
    package: '@kokecore/config',
    version: artifact.version,
    commitSha: artifact.commitSha,
    generatedAtUtc: artifact.generatedAtUtc,
    artifact: basename(artifact.archive),
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.checksum,
    entries: artifact.entries,
    reproducible: artifact.reproducible,
    consumers,
    kaklen: {
      commitSha: kaklen.kaklenSha,
      integrationDurationMs: kaklen.integrationDurationMs,
      rollbackDurationMs: kaklen.rollbackDurationMs,
    },
  };
  writeFileSync(
    join(outputRoot, 'kokecore-config-0.2.0-certification.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  return evidence;
}

function parseOutputArgument(args) {
  const index = args.indexOf('--output');
  if (index === -1) return undefined;
  const output = args[index + 1];
  if (!output) throw new Error('--output requires a directory');
  return output;
}

function main() {
  const temporaryOutput = mkdtempSync(join(tmpdir(), 'kokecore-config-certification-'));
  const requestedOutput = parseOutputArgument(process.argv.slice(2));
  const output = requestedOutput ?? temporaryOutput;

  try {
    const result = certifyConfigPackage({ output });
    console.log('CONFIG_PACKAGE_CERTIFICATION_PASSED');
    console.log(`Version: ${result.version}`);
    console.log(`Commit: ${result.commitSha}`);
    console.log(`Artifact: ${result.artifact}`);
    console.log(`Size: ${result.sizeBytes} bytes`);
    console.log(`SHA256: ${result.sha256}`);
    console.log(`Files: ${result.entries.length}`);
    console.log(`Node: ${result.consumers[0]?.nodeVersion}`);
    console.log(`pnpm: ${result.consumers.map((item) => item.pnpmVersion).join(', ')}`);
    console.log(`Kaklen: ${result.kaklen.commitSha}`);
    console.log(`Rollback: passed in ${result.kaklen.rollbackDurationMs} ms`);
    if (requestedOutput) console.log(`Evidence: ${output}`);
  } finally {
    if (!requestedOutput) rmSync(temporaryOutput, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
