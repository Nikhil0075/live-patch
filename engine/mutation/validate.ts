import type { GameManifest } from '../manifest/schema';
import ts from 'typescript';

const engineForbidden = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'eval', 'Function', 'document', 'window', 'globalThis', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'Worker', 'SharedWorker', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'parent', 'self', 'top', 'frames', 'location', 'postMessage', 'require']);

export function validateMutation(source: string, manifest: GameManifest): string | null {
  if (source.split(/\r?\n/).length > manifest.maxFileLines) return `Mutation exceeds ${manifest.maxFileLines} lines`;
  if (source.length > 12_000) return 'Mutation exceeds 12000 bytes';
  const forbidden = new Set([...engineForbidden, ...manifest.forbidden.map(token => token.replace(/\W/g, ''))]);
  const scanner = ts.createScanner(ts.ScriptTarget.ES2022, true, ts.LanguageVariant.Standard, source);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const word = scanner.getTokenText();
    if (token === ts.SyntaxKind.ImportKeyword || forbidden.has(word)) return `Forbidden token: ${word}`;
  }
  if (!/export\s+const\s+meta\s*=/.test(source)) return 'Missing export const meta';
  return null;
}
