import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

function normalizeDeclaration(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function declarationHash(symbol, checker) {
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declarations = target.getDeclarations() ?? [];
  const signature = declarations
    .map((declaration) => normalizeDeclaration(declaration.getText()))
    .sort()
    .join('\n');
  return createHash('sha256').update(signature).digest('hex');
}

function symbolKind(symbol, checker) {
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declaration = target.getDeclarations()?.[0];
  return declaration ? ts.SyntaxKind[declaration.kind] : 'Unknown';
}

export function createPublicApiSnapshot(packageDirectory, manifest) {
  const declarationPath = join(packageDirectory, 'dist', 'public.d.ts');
  if (!existsSync(declarationPath)) {
    throw new Error(`Missing compiled public declaration: ${declarationPath}`);
  }

  const program = ts.createProgram([declarationPath], {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    skipLibCheck: false,
    strict: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => packageDirectory,
        getNewLine: () => '\n',
      })
    );
  }

  const source = program.getSourceFile(declarationPath);
  const checker = program.getTypeChecker();
  const moduleSymbol = source && checker.getSymbolAtLocation(source);
  if (!moduleSymbol) throw new Error(`Unable to resolve public module: ${declarationPath}`);

  const exports = checker
    .getExportsOfModule(moduleSymbol)
    .map((symbol) => ({
      name: symbol.getName(),
      kind: symbolKind(symbol, checker),
      signatureHash: declarationHash(symbol, checker),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    package: manifest.name,
    version: manifest.version,
    entry: 'dist/public.d.ts',
    exports,
  };
}

export function comparePublicApiSnapshots(expected, actual) {
  return JSON.stringify(expected) === JSON.stringify(actual);
}

export function readPublicApiSnapshot(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
