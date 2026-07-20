import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const DISALLOWED_MODULES = new Set([
  'child_process',
  'dgram',
  'fs',
  'http',
  'https',
  'net',
  'tls',
  'worker_threads',
]);

export function scanConfigSource(source, file = '<memory>') {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const findings = [];

  for (const diagnostic of sourceFile.parseDiagnostics) {
    findings.push(createFinding('PARSE_ERROR', sourceFile, diagnostic.start ?? 0));
  }

  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      findings.push(createFinding('EXPLICIT_ANY', sourceFile, node.getStart(sourceFile)));
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text.replace(/^node:/, '');
      if (DISALLOWED_MODULES.has(moduleName)) {
        findings.push(createFinding('SYSTEM_MODULE', sourceFile, node.getStart(sourceFile)));
      }
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        findings.push(createFinding('DYNAMIC_IMPORT', sourceFile, node.getStart(sourceFile)));
      }
      if (ts.isIdentifier(node.expression) && ['eval', 'require'].includes(node.expression.text)) {
        findings.push(createFinding('DYNAMIC_EXECUTION', sourceFile, node.getStart(sourceFile)));
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Function'
    ) {
      findings.push(createFinding('DYNAMIC_EXECUTION', sourceFile, node.getStart(sourceFile)));
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'env' &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'process'
    ) {
      findings.push(createFinding('DIRECT_PROCESS_ENV', sourceFile, node.getStart(sourceFile)));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

export function scanConfigPackage(root = process.cwd()) {
  const repositoryRoot = resolve(root);
  const packageRoot = join(repositoryRoot, 'packages', 'config');
  const sourceRoot = join(packageRoot, 'src');
  const manifestPath = join(packageRoot, 'package.json');
  if (!existsSync(sourceRoot) || !existsSync(manifestPath)) {
    throw new Error(`Config package is incomplete: ${packageRoot}`);
  }

  const files = collectProductionSources(sourceRoot);
  const findings = files.flatMap((path) =>
    scanConfigSource(readFileSync(path, 'utf8'), relative(repositoryRoot, path))
  );
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (Object.keys(manifest.dependencies ?? {}).length > 0) {
    findings.push({
      code: 'RUNTIME_DEPENDENCY',
      file: relative(repositoryRoot, manifestPath),
      line: 1,
    });
  }
  return { files: files.length, findings };
}

function collectProductionSources(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectProductionSources(path));
    } else if (extname(entry.name) === '.ts' && !entry.name.endsWith('.spec.ts')) {
      files.push(path);
    }
  }
  return files.sort();
}

function createFinding(code, sourceFile, position) {
  const location = sourceFile.getLineAndCharacterOfPosition(position);
  return { code, file: sourceFile.fileName, line: location.line + 1 };
}

function main() {
  const result = scanConfigPackage();
  if (result.findings.length > 0) {
    console.error(`Config SAST failed with ${result.findings.length} finding(s):`);
    for (const finding of result.findings) {
      console.error(`- ${finding.code} at ${finding.file}:${finding.line}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`CONFIG_SAST_PASSED files=${result.files} findings=0`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
