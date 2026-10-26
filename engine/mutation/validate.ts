import type { GameManifest } from '../manifest/schema';
import ts from 'typescript';

const engineForbidden = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'eval', 'Function', 'document', 'window', 'globalThis', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'Worker', 'SharedWorker', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'parent', 'self', 'top', 'frames', 'location', 'postMessage', 'require']);

export function validateMutation(source: string, manifest: GameManifest): string | null {
  if (source.split(/\r?\n/).length > manifest.maxFileLines) return `Mutation exceeds ${manifest.maxFileLines} lines`;
  if (source.length > 12_000) return 'Mutation exceeds 12000 bytes';
  const forbidden = new Set([...engineForbidden, ...manifest.forbidden.map(token => token.replace(/\W/g, ''))]);
  const tree = ts.createSourceFile('mutation.js', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  if ((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length) return 'Invalid JavaScript syntax';
  const declared = new Set<string>();
  const binding = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) declared.add(name.text);
    else for (const element of name.elements) if (ts.isBindingElement(element)) binding(element.name);
  };
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) binding(node.name);
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) declared.add(node.name.text);
    ts.forEachChild(node, collect);
  };
  collect(tree);
  let error: string | null = null;
  const visit = (node: ts.Node) => {
    if (error) return;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && !!node.moduleSpecifier || ts.isImportEqualsDeclaration(node) || node.kind === ts.SyntaxKind.ImportKeyword) { error = 'Forbidden token: import'; return; }
    if (ts.isIdentifier(node) && forbidden.has(node.text) && !declared.has(node.text)) {
      const parent = node.parent;
      const property = (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node;
      const label = (ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node;
      if (!property && !label) { error = `Forbidden token: ${node.text}`; return; }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (error) return error;
  if (!/export\s+const\s+meta\s*=/.test(source)) return 'Missing export const meta';
  return null;
}
