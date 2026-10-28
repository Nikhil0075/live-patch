import type { GameManifest } from '../manifest/schema';
import ts from 'typescript';

const engineForbidden = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'eval', 'Function', 'document', 'window', 'globalThis', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'Worker', 'SharedWorker', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'parent', 'self', 'top', 'frames', 'location', 'postMessage', 'require']);

export function validateMutation(source: string, manifest: GameManifest): string | null {
  if (source.split(/\r?\n/).length > manifest.maxFileLines) return `Mutation exceeds ${manifest.maxFileLines} lines`;
  if (source.length > 12_000) return 'Mutation exceeds 12000 bytes';
  const forbidden = new Set([...engineForbidden, ...manifest.forbidden.map(token => token.replace(/\W/g, ''))]);
  const tree = ts.createSourceFile('mutation.js', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  if ((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length) return 'Invalid JavaScript syntax';
  interface Scope { parent?: Scope; names: Set<string> }
  const root: Scope = { names: new Set() };
  const scopes = new WeakMap<ts.Node, Scope>();
  const bind = (name: ts.BindingName, scope: Scope): void => {
    if (ts.isIdentifier(name)) scope.names.add(name.text);
    else for (const element of name.elements) if (ts.isBindingElement(element)) bind(element.name, scope);
  };
  const isScope = (node: ts.Node) => ts.isBlock(node) || ts.isFunctionLike(node) || ts.isCatchClause(node) || ts.isClassLike(node);
  const collect = (node: ts.Node, parent: Scope): void => {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) parent.names.add(node.name.text);
    const scope = node === tree ? root : isScope(node) ? { parent, names: new Set<string>() } : parent;
    scopes.set(node, scope);
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) bind(node.name, scope);
    if ((ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name) scope.names.add(node.name.text);
    ts.forEachChild(node, child => collect(child, scope));
  };
  collect(tree, root);
  const local = (name: string, node: ts.Node): boolean => {
    for (let scope: Scope | undefined = scopes.get(node); scope; scope = scope.parent) if (scope.names.has(name)) return true;
    return false;
  };
  let error: string | null = null;
  const visit = (node: ts.Node) => {
    if (error) return;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && !!node.moduleSpecifier || ts.isImportEqualsDeclaration(node) || node.kind === ts.SyntaxKind.ImportKeyword) { error = 'Forbidden token: import'; return; }
    if (ts.isIdentifier(node) && forbidden.has(node.text) && !local(node.text, node)) {
      const parent = node.parent;
      const property = (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node;
      const label = (ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node;
      const declaration = (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) && parent.name === node;
      if (!property && !label && !declaration) { error = `Forbidden token: ${node.text}`; return; }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (error) return error;
  if (!/export\s+const\s+meta\s*=/.test(source)) return 'Missing export const meta';
  return null;
}
