import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RollbackVotes } from '../engine/pipeline/rollback-votes';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
describe('chat rollback ballot', () => {
  it('counts each viewer once, survives restart, and needs confirmation', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-rollback-')); dirs.push(dir);
    const file = path.join(dir, 'votes.json'); let now = 1000;
    let votes = new RollbackVotes(file, () => now);
    expect(votes.vote('run-a', 'a').state.votes).toBe(1);
    expect(votes.vote('run-a', 'a').accepted).toBe(false);
    votes = new RollbackVotes(file, () => now);
    expect(votes.confirm('run-a')).toBe(false);
    votes.vote('run-a', 'b'); votes.vote('run-a', 'c');
    expect(votes.snapshot('run-a')?.ready).toBe(true);
    expect(votes.confirm('run-a')).toBe(true);
    expect(votes.confirm('run-a')).toBe(false);
    expect(votes.vote('run-a', 'd').accepted).toBe(false);
    now += 120_001;
    expect(votes.snapshot('run-a')).toBeUndefined();
    expect(votes.vote('run-b', 'd').state.votes).toBe(1);
  });
});
