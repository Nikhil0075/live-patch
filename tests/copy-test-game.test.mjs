import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { copyTestGame } from '../scripts/copy-test-game.mjs';

describe('isolated game copy', () => {
  it('keeps tracked built-ins and excludes a shipped Practice demo', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-test-copy-'));
    try {
      const game = path.join(root, 'games', 'example');
      const mutations = path.join(game, 'mutations');
      fs.mkdirSync(mutations, { recursive: true });
      fs.writeFileSync(path.join(mutations, 'built-in.js'), 'export const id = 1;');
      fs.writeFileSync(path.join(mutations, 'demo-shipped.js'), 'export const id = 2;');
      fs.writeFileSync(path.join(game, 'live-patch.json'), '{}');
      execFileSync('git', ['init', '-q'], { cwd: root });
      execFileSync('git', ['add', 'games/example/mutations/built-in.js'], { cwd: root });
      const copied = path.join(root, 'copy');
      copyTestGame(root, game, copied, 'mutations');
      expect(fs.readdirSync(path.join(copied, 'mutations'))).toEqual(['built-in.js']);
      expect(fs.existsSync(path.join(copied, 'live-patch.json'))).toBe(true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it('copies built-ins without Git while excluding generated demo and patch modules', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-no-git-copy-'));
    try {
      const game = path.join(root, 'games', 'example');
      const mutations = path.join(game, 'mutations');
      fs.mkdirSync(mutations, { recursive: true });
      for (const name of ['01-built-in.js', 'demo-shipped.js', 'patch-aabbcc.js']) fs.writeFileSync(path.join(mutations, name), 'export const id = 1;');
      const copied = path.join(root, 'copy');
      copyTestGame(root, game, copied, 'mutations');
      expect(fs.readdirSync(path.join(copied, 'mutations'))).toEqual(['01-built-in.js']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
