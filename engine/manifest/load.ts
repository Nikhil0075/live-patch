import fs from 'node:fs';
import path from 'node:path';
import { manifestSchema, type GameManifest } from './schema';

export function loadGame(root: string, argument: string): { directory: string; manifest: GameManifest } {
  const directory = path.resolve(root, argument);
  const manifestFile = path.join(directory, 'live-patch.json');
  if (!fs.existsSync(manifestFile)) throw new Error(`Missing game manifest: ${manifestFile}`);
  let data: unknown;
  try { data = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); }
  catch (error) { throw new Error(`Invalid JSON in ${manifestFile}: ${String(error)}`); }
  const result = manifestSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid game manifest ${manifestFile}: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  for (const field of ['entry', 'mutationDir', 'apiDocs'] as const) {
    const target = path.resolve(directory, result.data[field]);
    if (!target.startsWith(directory + path.sep)) throw new Error(`Manifest ${field} escapes game directory`);
    if (!fs.existsSync(target)) throw new Error(`Manifest ${field} does not exist: ${target}`);
  }
  return { directory, manifest: result.data };
}
