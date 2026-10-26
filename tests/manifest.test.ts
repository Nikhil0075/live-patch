import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadGame } from '../engine/manifest/load';
import { validateMutation } from '../engine/mutation/validate';

const root = process.cwd();
describe('platform contract', () => {
  it('loads the active game through its manifest', () => {
    const { manifest } = loadGame(root, 'games/arena-survivor');
    expect(manifest.name).toBe('Arena Survivor');
    expect(manifest.mutationDir).toBe('mutations/');
  });
  it('rejects missing and invalid manifests with clear errors', () => {
    expect(() => loadGame(root, 'games/no-such-game')).toThrow(/Missing game manifest/);
    const temp = fs.mkdtempSync(path.join(root, '.test-manifest-'));
    try { fs.writeFileSync(path.join(temp, 'live-patch.json'), '{}'); expect(() => loadGame(root, temp)).toThrow(/Invalid game manifest/); }
    finally { fs.rmSync(temp, { recursive: true, force: true }); }
  });
  it('keeps the engine independent of games', () => {
    function walk(dir: string): string[] { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
    for (const file of walk(path.join(root, 'engine')).filter(f => f.endsWith('.ts'))) {
      expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/(?:from\s*['"]|import\s*\(['"])[^'"]*games\//);
    }
  });
  it('blocks direct browser and network access in mutation source', () => {
    const { manifest } = loadGame(root, 'games/arena-survivor');
    expect(validateMutation('export const meta = {}; fetch("https://bad.example")', manifest)).toMatch(/Forbidden/);
    expect(validateMutation('export const meta = {}; import("/x.js")', manifest)).toMatch(/Forbidden/);
  });
});
