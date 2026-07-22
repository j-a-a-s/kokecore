import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SUPPORTED_PNPM_VERSIONS = Object.freeze(['8.15.0', '9.15.4']);
const CONFIG_PACKAGE_NAME = '@kokecore/config';
const FORBIDDEN_DEEP_IMPORT = [CONFIG_PACKAGE_NAME, 'dist', 'index.js'].join('/');

export function certifyIsolatedConfigConsumer({ archive, pnpmVersion, root = process.cwd() }) {
  if (!SUPPORTED_PNPM_VERSIONS.includes(pnpmVersion)) {
    throw new Error(`Unsupported certification pnpm version: ${pnpmVersion}`);
  }
  if (Number(process.versions.node.split('.')[0]) !== 22) {
    throw new Error(`Config consumer certification requires Node 22, received ${process.version}.`);
  }

  const repositoryRoot = resolve(root);
  const archivePath = resolve(archive);
  const typescriptBinary = join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(archivePath)) throw new Error(`Config artifact does not exist: ${archivePath}`);
  if (!existsSync(typescriptBinary)) {
    throw new Error(
      'TypeScript compiler is unavailable. Run pnpm install --frozen-lockfile first.'
    );
  }

  const consumerRoot = mkdtempSync(join(tmpdir(), `kokecore-config-pnpm-${pnpmVersion}-`));
  const startedAt = Date.now();

  try {
    runPnpm(pnpmVersion, ['init'], consumerRoot);
    writeConsumerFiles(consumerRoot);
    runPnpm(pnpmVersion, ['add', archivePath, '--save-exact'], consumerRoot);
    validateInstalledManifest(consumerRoot, archivePath);

    run('node', [typescriptBinary, '-p', 'tsconfig.json'], consumerRoot);
    const execution = run('node', ['dist/index.js'], consumerRoot);
    if (!execution.stdout.includes('CONFIG_ISOLATED_CONSUMER_OK')) {
      throw new Error('The isolated Config consumer did not report success.');
    }

    const deepTypecheck = spawn(
      'node',
      [
        typescriptBinary,
        '--noEmit',
        '--strict',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        'src/deep-import.ts',
      ],
      consumerRoot
    );
    if (deepTypecheck.status === 0) {
      throw new Error('TypeScript unexpectedly accepted a Config deep import.');
    }

    const deepRuntime = spawn(
      'node',
      ['--input-type=module', '--eval', `await import(${JSON.stringify(FORBIDDEN_DEEP_IMPORT)})`],
      consumerRoot
    );
    const deepRuntimeOutput = `${deepRuntime.stdout}\n${deepRuntime.stderr}`;
    if (deepRuntime.status === 0 || !deepRuntimeOutput.includes('ERR_PACKAGE_PATH_NOT_EXPORTED')) {
      throw new Error(`Runtime deep import was not blocked.\n${deepRuntimeOutput}`);
    }

    return {
      pnpmVersion,
      nodeVersion: process.version,
      archiveName: basename(archivePath),
      durationMs: Date.now() - startedAt,
      validConfigurationAccepted: true,
      invalidConfigurationRejected: true,
      deepImportsBlocked: true,
    };
  } finally {
    rmSync(consumerRoot, { recursive: true, force: true });
  }
}

function writeConsumerFiles(consumerRoot) {
  mkdirSync(join(consumerRoot, 'src'), { recursive: true });
  writeFileSync(
    join(consumerRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'kokecore-config-isolated-consumer',
        version: '1.0.0',
        private: true,
        type: 'module',
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(consumerRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          outDir: 'dist',
          skipLibCheck: false,
        },
        include: ['src/index.ts'],
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(consumerRoot, 'src/index.ts'),
    `import {
  CONFIG_ISSUE_CODES,
  defineConfigSchema,
  isConfigurationError,
  readEnum,
  readInteger,
  validateEnvironment,
} from "@kokecore/config";

const schema = defineConfigSchema(["PORT", "MODE"], (environment) => ({
  port: readInteger(environment, "PORT", { minimum: 1, maximum: 65535 }),
  mode: readEnum(environment, "MODE", ["safe", "fast"] as const),
}));

const valid = validateEnvironment(schema, { PORT: "3000", MODE: "safe" });
if (valid.port !== 3000 || valid.mode !== "safe") {
  throw new Error("Valid configuration was not parsed correctly.");
}

let invalidRejected = false;
try {
  validateEnvironment(schema, { PORT: "invalid", MODE: "safe" });
} catch (error: unknown) {
  invalidRejected =
    isConfigurationError(error) && error.code === CONFIG_ISSUE_CODES.INVALID_VALUE;
}
if (!invalidRejected) throw new Error("Invalid configuration was accepted.");

console.log("CONFIG_ISOLATED_CONSUMER_OK");
`
  );
  writeFileSync(
    join(consumerRoot, 'src/deep-import.ts'),
    `import { readString } from ${JSON.stringify(FORBIDDEN_DEEP_IMPORT)};\nvoid readString;\n`
  );
}

function validateInstalledManifest(consumerRoot, archivePath) {
  const manifest = JSON.parse(readFileSync(join(consumerRoot, 'package.json'), 'utf8'));
  const dependencies = Object.entries(manifest.dependencies ?? {});
  if (dependencies.length !== 1 || dependencies[0]?.[0] !== '@kokecore/config') {
    throw new Error('The isolated consumer must install only @kokecore/config.');
  }
  const specifier = dependencies[0][1];
  if (typeof specifier !== 'string' || !specifier.includes(basename(archivePath))) {
    throw new Error('The isolated consumer is not bound to the certified tarball.');
  }
}

function runPnpm(version, args, cwd) {
  return run('corepack', [`pnpm@${version}`, ...args], cwd);
}

function spawn(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function run(command, args, cwd) {
  const result = spawn(command, args, cwd);
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}:\n${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`
    );
  }
  return result;
}

function parseArguments(args) {
  const archiveIndex = args.indexOf('--archive');
  const versionIndex = args.indexOf('--pnpm');
  const archive = archiveIndex === -1 ? undefined : args[archiveIndex + 1];
  const pnpmVersion = versionIndex === -1 ? undefined : args[versionIndex + 1];
  if (!archive || !pnpmVersion) {
    throw new Error('Usage: certify-config-isolated.mjs --archive <file.tgz> --pnpm <version>');
  }
  return { archive, pnpmVersion };
}

function main() {
  const result = certifyIsolatedConfigConsumer(parseArguments(process.argv.slice(2)));
  console.log('CONFIG_ISOLATED_CONSUMER_PASSED');
  console.log(`Node: ${result.nodeVersion}`);
  console.log(`pnpm: ${result.pnpmVersion}`);
  console.log(`Artifact: ${result.archiveName}`);
  console.log(`Duration: ${result.durationMs} ms`);
  console.log('Valid configuration: accepted');
  console.log('Invalid configuration: rejected');
  console.log('Deep imports: blocked');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
