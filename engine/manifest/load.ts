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
  for (const example of result.data.examples) {
    const target = path.resolve(directory, example);
    if (!target.startsWith(directory + path.sep)) throw new Error(`Manifest example escapes game directory: ${example}`);
    if (!fs.existsSync(target)) throw new Error(`Manifest example does not exist: ${target}`);
  }
  if (result.data.cover) {
    const cover = path.resolve(directory, result.data.cover);
    if (!cover.startsWith(directory + path.sep) || !fs.existsSync(cover) || !fs.statSync(cover).isFile() || fs.statSync(cover).size > 1_000_000) throw Error('Manifest cover must be an image inside the game folder, at most 1 MB');
  }
  return { directory, manifest: result.data };
}

export function defaultGame(root: string): string {
  const activeFile = path.join(path.resolve(process.env.LIVE_PATCH_DATA_DIR ?? path.join(root, '.live-patch')), 'active-game.json');
  if (fs.existsSync(activeFile)) {
    const active = JSON.parse(fs.readFileSync(activeFile, 'utf8')) as { directory?: string };
    if (active.directory && fs.existsSync(path.join(active.directory, 'live-patch.json'))) return active.directory;
  }
  const packageFile = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { livePatch?: { defaultGame?: string } };
  if (!packageFile.livePatch?.defaultGame) throw new Error('package.json livePatch.defaultGame is required');
  return packageFile.livePatch.defaultGame;
}
