import fs from 'node:fs';
import path from 'node:path';
import { loadGame } from './load';
import { smoke } from '../runner/runner';

export interface LibraryGame { directory: string; name: string; description: string; cover?: string; tags: string[]; version?: string; author?: string; valid: boolean; error?: string; examples: number; hooks?: string[]; actions?: string[]; audio?: string[]; effects?: string[]; smoke?: { status: 'passed' | 'failed'; at: string; detail?: string }; shipped: number }
const safePath = (root: string, directory: string) => path.relative(root, directory).replaceAll('\\', '/');
const readJson = <T>(file: string, fallback: T): T => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as T : fallback;
function atomic(file: string, value: unknown) { fs.mkdirSync(path.dirname(file), { recursive: true }); const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); }

export function discoverGames(root: string, dataDir: string): LibraryGame[] {
  const imports = readJson<string[]>(path.join(dataDir, 'imported-games.json'), []);
  const standard = path.join(root, 'games');
  const folders = fs.existsSync(standard) ? fs.readdirSync(standard, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => path.join(standard, item.name)) : [];
  const smoke = readJson<Record<string, LibraryGame['smoke']>>(path.join(dataDir, 'smoke-results.json'), {});
  const runs = readJson<{ gameDirectory: string; status: string }[]>(path.join(dataDir, 'runs.json'), []);
  return [...new Set([...folders, ...imports])].filter(directory => fs.existsSync(path.join(directory, 'live-patch.json'))).map(directory => {
    try {
      const { manifest } = loadGame(root, directory);
      const examples = manifest.examples.reduce((count, folder) => count + fs.readdirSync(path.join(directory, folder)).filter(name => name.endsWith('.js')).length, 0);
      return { directory, name: manifest.name, description: manifest.description ?? manifest.hint, cover: manifest.cover ? `/api/library/cover?directory=${encodeURIComponent(directory)}` : undefined, tags: manifest.tags ?? [], version: manifest.version, author: manifest.author, valid: true, examples, hooks: Object.values(manifest.hooks), actions: Object.keys(manifest.actions), audio: manifest.audio, effects: manifest.effects, smoke: smoke[directory], shipped: runs.filter(run => run.gameDirectory === directory && run.status === 'shipped').length };
    } catch (error) { return { directory, name: path.basename(directory), description: '', tags: [], valid: false, error: String(error), examples: 0, smoke: smoke[directory], shipped: 0 }; }
  });
}

export function validateImport(root: string, directory: string) {
  const resolved = path.resolve(directory);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) throw Error('Game folder does not exist');
  if (fs.lstatSync(resolved).isSymbolicLink()) throw Error('Game folders cannot be symlinks');
  const walk = (folder: string, depth: number) => {
    if (depth > 10) throw Error('Folder is too deeply nested');
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name);
      if (item.isSymbolicLink()) throw Error('Game folders cannot contain symlinks');
      if (item.isDirectory()) walk(file, depth + 1);
      else if (!item.isFile() || fs.statSync(file).size > 1_000_000) throw Error(`Oversized or unsupported file: ${safePath(resolved, file)}`);
    }
  };
  walk(resolved, 0);
  const game = loadGame(root, resolved);
  if (!game.manifest.examples.length) throw Error('Game needs an example mutation for its first smoke test');
  const exampleFolder = path.join(resolved, game.manifest.examples[0]);
  const example = fs.readdirSync(exampleFolder).find(name => name.endsWith('.js'));
  if (!example) throw Error('Game needs an example mutation for its first smoke test');
  return { ...game, example };
}

export async function smokeGame(root: string, dataDir: string, directory: string, example: string): Promise<void> {
  const { manifest } = loadGame(root, directory);
  let failure = '';
  try { await smoke(manifest.testCommand, root, directory, example, AbortSignal.timeout(90_000)); }
  catch (error) { failure = String(error).slice(-4000); }
  const file = path.join(dataDir, 'smoke-results.json');
  const records = readJson<Record<string, LibraryGame['smoke']>>(file, {});
  records[directory] = { status: failure ? 'failed' : 'passed', at: new Date().toISOString(), ...(failure ? { detail: failure } : {}) };
  atomic(file, records);
  if (failure) throw Error(`Smoke test failed: ${failure}`);
}

export function addImport(dataDir: string, directory: string) {
  const file = path.join(dataDir, 'imported-games.json');
  const imports = readJson<string[]>(file, []);
  if (!imports.includes(directory)) { imports.push(directory); atomic(file, imports); }
}

export function makeActive(root: string, directory: string) {
  loadGame(root, directory);
  atomic(path.join(path.resolve(process.env.LIVE_PATCH_DATA_DIR ?? path.join(root, '.live-patch')), 'active-game.json'), { directory: path.resolve(directory) });
}
