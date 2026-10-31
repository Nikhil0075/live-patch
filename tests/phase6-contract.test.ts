import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { manifestSchema } from '../engine/manifest/schema';

const game = path.resolve('games/lantern-run');
const manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(game, 'live-patch.json'), 'utf8')));
const docs = fs.readFileSync(path.join(game, 'docs/mutation-api.md'), 'utf8');

describe('Lantern Run manifest and API documentation', () => {
  it('documents exactly the declared mutation actions and hooks', () => {
    const actions = [...docs.matchAll(/^\| `([a-zA-Z]+)\([^`]*\)` \|/gm)].map(match => match[1]).sort();
    const hooks = [...docs.matchAll(/^\| `([a-zA-Z]+)` \| `(on[A-Za-z]+)` \|/gm)].map(match => [match[1], match[2]]);
    expect(actions).toEqual(Object.keys(manifest.actions).sort());
    expect(Object.fromEntries(hooks)).toEqual(manifest.hooks);
  });

  it('has three distinct built-in patches and six runnable fixture sketches', () => {
    const builtIns = fs.readdirSync(path.join(game, 'mutations')).filter(file => file.endsWith('.js'));
    const fixtures = fs.readdirSync(path.join(game, 'tests/fixtures')).filter(file => file.endsWith('.js'));
    expect(builtIns).toHaveLength(3);
    expect(fixtures).toHaveLength(6);
    for (const file of [...builtIns.map(name => path.join(game, 'mutations', name)), ...fixtures.map(name => path.join(game, 'tests/fixtures', name))]) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).toContain('export const meta');
      expect(source).toMatch(/export function on[A-Z]/);
    }
  });
});
