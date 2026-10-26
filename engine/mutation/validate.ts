import type { GameManifest } from '../manifest/schema';

const engineForbidden = [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|eval|Function|document|window|globalThis|localStorage|sessionStorage|indexedDB|navigator|Worker|SharedWorker|setTimeout|setInterval|requestAnimationFrame)\b/, /\bimport\s*(?:\(|[\w*{])/, /\brequire\s*\(/];

export function validateMutation(source: string, manifest: GameManifest): string | null {
  if (source.split(/\r?\n/).length > manifest.maxFileLines) return `Mutation exceeds ${manifest.maxFileLines} lines`;
  if (source.length > 12_000) return 'Mutation exceeds 12000 bytes';
  for (const pattern of engineForbidden) if (pattern.test(source)) return `Forbidden token: ${pattern}`;
  for (const token of manifest.forbidden) if (source.includes(token)) return `Forbidden token: ${token}`;
  if (!/export\s+const\s+meta\s*=/.test(source)) return 'Missing export const meta';
  return null;
}
