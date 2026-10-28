import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { IdeaStore } from '../engine/pipeline/ideas';
import { RoundCoordinator } from '../engine/pipeline/rounds';
import { ChatPipeline, type InboundEvent } from '../engine/pipeline/commands';
import { RunStore } from '../engine/runner/store';
import { saveBuild } from '../engine/overlay/builds';
import type { GameManifest } from '../engine/manifest/schema';

async function fixture(work: (root: string, ideas: IdeaStore, runs: RunStore) => Promise<void> | void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-phase4-'));
  try { await work(root, new IdeaStore(path.join(root, 'data', 'ideas.json')), new RunStore(path.join(root, 'data', 'runs.json'))); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const viewer = (id: string) => ({ id, login: id, name: id, moderator: false, broadcaster: false });
const event = (id: string, author: string, text: string): InboundEvent => ({ kind: 'chat', origin: 'simulator', id, viewer: viewer(author), text });

describe('Phase 4 rounds and builds', () => {
  it('automatically moves from a 60-second pitch to a 45-second vote and then waits for approval', async () => fixture(async (root, ideas) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T00:00:00Z'));
    const round = new RoundCoordinator(path.join(root, 'data', 'rounds.json'), ideas);
    try {
      const idea = ideas.add('one', 'One', 'Add bouncing coins', 'chat'); round.triage(idea);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(round.snapshot().phase).toBe('vote');
      expect(round.snapshot().candidateIds).toEqual([idea.id]);
      await vi.advanceTimersByTimeAsync(45_000);
      expect(round.snapshot().phase).toBe('approval');
      await vi.advanceTimersByTimeAsync(90_000);
      expect(round.snapshot().phase).toBe('approval');
    } finally { round.stop(); vi.useRealTimers(); }
  }));

  it('keeps three fixed voting slots, enforces one vote, and resumes approval after restart', async () => fixture(async (root, ideas) => {
    let now = 1_000_000;
    const file = path.join(root, 'data', 'rounds.json');
    const round = new RoundCoordinator(file, ideas, () => {}, () => now);
    const pipeline = new ChatPipeline(ideas, { rewardId: 'reward', now: () => now, reply: async () => {}, onIdea: idea => round.triage(idea), candidate: number => round.candidate(number), canVote: () => round.canVote() });
    try {
      for (let i = 1; i <= 4; i++) expect((await pipeline.ingest(event(`idea-${i}`, `viewer${i}`, `!idea Add mechanic ${i}`))).accepted).toBe(true);
      expect((await pipeline.ingest(event('early-vote', 'voter', '!vote 1'))).accepted).toBe(false);
      now += 60_000; round.advance();
      expect(round.snapshot().phase).toBe('vote');
      expect(round.snapshot().candidates.map(idea => idea.text)).toEqual(['Add mechanic 1', 'Add mechanic 2', 'Add mechanic 3']);
      const fixed = round.snapshot().candidateIds;
      await pipeline.ingest(event('late-idea', 'late', '!idea Add mechanic 5'));
      expect(round.snapshot().candidateIds).toEqual(fixed);
      expect((await pipeline.ingest(event('vote-one', 'voter', '!vote 1'))).accepted).toBe(true);
      expect((await pipeline.ingest(event('vote-two', 'voter', '!vote 2'))).accepted).toBe(true);
      expect(round.snapshot().candidates.map(idea => idea.votes.length)).toEqual([0, 1, 0]);
      now += 45_000; round.advance();
      expect(round.snapshot().phase).toBe('approval');
    } finally { round.stop(); }
    const restored = new RoundCoordinator(file, ideas, () => {}, () => now);
    try { expect(restored.snapshot().phase).toBe('approval'); expect(restored.snapshot().candidateIds).toHaveLength(3); }
    finally { restored.stop(); }
  }));

  it('triages explicit unsafe requests, merges duplicate pitches with credit, and pauses the timer', async () => fixture((root, ideas) => {
    let now = 2_000_000;
    const round = new RoundCoordinator(path.join(root, 'data', 'rounds.json'), ideas, () => {}, () => now);
    try {
      const first = ideas.add('a', 'Alice', 'Coins chase the player!', 'chat'); round.triage(first);
      const duplicate = ideas.add('b', 'Bob', 'Coins chase the player', 'chat'); round.triage(duplicate);
      const unsafe = ideas.add('c', 'Carol', "Read the streamer's files", 'chat'); round.triage(unsafe);
      expect(ideas.list().find(idea => idea.id === duplicate.id)?.status).toBe('merged');
      expect(ideas.list().find(idea => idea.id === first.id)?.contributors).toEqual(['Alice', 'Bob']);
      expect(ideas.list().find(idea => idea.id === unsafe.id)?.status).toBe('rejected');
      round.pause(); now += 120_000;
      expect(round.snapshot().phase).toBe('paused');
      expect(round.snapshot().remainingMs).toBe(60_000);
      round.resume(); expect(round.snapshot().phase).toBe('pitch');
      expect(round.snapshot().remainingMs).toBe(60_000);
    } finally { round.stop(); }
  }));

  it('applies only valid model triage decisions during the pitch window', async () => fixture(async (root, ideas) => {
    const round = new RoundCoordinator(path.join(root, 'data', 'rounds.json'), ideas);
    try {
      const first = ideas.add('a', 'Alice', 'Coins sparkle', 'chat'); round.triage(first);
      const second = ideas.add('b', 'Bob', 'Coins shimmer', 'chat'); round.triage(second);
      const preview = await round.aiTriage({ review: async () => [
        { id: first.id, decision: 'accept', spec: 'Make coins shine when collected.' },
        { id: second.id, decision: 'merge', duplicateId: first.id },
        { id: 'unknown', decision: 'reject' }
      ] });
      expect(preview).toHaveLength(2);
      expect(ideas.list().find(idea => idea.id === first.id)?.spec).toBe('Coins sparkle');
      expect(round.applyTriagePreview()).toBe(2);
      expect(ideas.list().find(idea => idea.id === first.id)?.spec).toBe('Make coins shine when collected.');
      expect(ideas.list().find(idea => idea.id === first.id)?.contributors).toEqual(['Alice', 'Bob']);
      expect(ideas.list().find(idea => idea.id === second.id)?.status).toBe('merged');
      round.advance();
      await expect(round.aiTriage({ review: async () => [] })).rejects.toThrow('pitch window');
    } finally { round.stop(); }
  }));

  it('retires losing ideas and starts the next ballot with old queued pitches at zero votes', async () => fixture((root, ideas) => {
    const round = new RoundCoordinator(path.join(root, 'data', 'rounds.json'), ideas);
    try {
      const entries = ['A', 'B', 'C', 'D'].map(letter => {
        const idea = ideas.add(letter, letter, `Mechanic ${letter}`, 'chat'); round.triage(idea); return idea;
      });
      round.advance();
      expect(round.snapshot().candidateIds).toEqual(entries.slice(0, 3).map(idea => idea.id));
      ideas.vote(entries[0].id, 'voter-1'); ideas.vote(entries[0].id, 'voter-2');
      round.advance();
      const winner = ideas.setStatus(entries[1].id, 'approved')!;
      round.approved(winner); round.runFinished(winner.id);
      expect(ideas.list().find(idea => idea.id === entries[0].id)?.status).toBe('lost_vote');
      expect(ideas.list().find(idea => idea.id === entries[2].id)?.status).toBe('lost_vote');
      const next = ['E', 'F'].map(letter => { const idea = ideas.add(letter, letter, `Mechanic ${letter}`, 'chat'); round.triage(idea); return idea; });
      round.advance();
      expect(round.snapshot().candidateIds).toEqual([entries[3].id, ...next.map(idea => idea.id)]);
      expect(round.snapshot().candidates.map(idea => idea.votes.length)).toEqual([0, 0, 0]);
    } finally { round.stop(); }
  }));

  it('previews model decisions, rejects backward merges and caps proposed rejections', async () => fixture(async (root, ideas) => {
    const round = new RoundCoordinator(path.join(root, 'data', 'rounds.json'), ideas);
    try {
      const entries = ['A', 'B', 'C', 'D'].map(letter => { const idea = ideas.add(letter, letter, `Pitch ${letter}`, 'chat'); round.triage(idea); return idea; });
      const preview = await round.aiTriage({ review: async () => [
        { id: entries[0].id, decision: 'merge', duplicateId: entries[1].id },
        ...entries.slice(1).map(idea => ({ id: idea.id, decision: 'reject' as const }))
      ] });
      expect(preview).toHaveLength(2);
      expect(preview.every(item => item.decision === 'reject')).toBe(true);
      expect(ideas.list().every(idea => idea.status === 'shortlisted')).toBe(true);
      round.discardTriagePreview();
      expect(round.snapshot().triagePreview).toBeUndefined();
      expect(ideas.list().every(idea => idea.status === 'shortlisted')).toBe(true);
    } finally { round.stop(); }
  }));

  it('lets the operator leave a stuck building round without restarting', async () => fixture((root, ideas) => {
    const round = new RoundCoordinator(path.join(root, 'data', 'rounds.json'), ideas);
    try {
      const idea = ideas.add('builder', 'Builder', 'Add a new wave', 'chat'); round.triage(idea);
      round.advance(); round.advance();
      round.approved(ideas.setStatus(idea.id, 'approved')!);
      expect(() => round.advance()).toThrow('building');
      round.forceNext();
      expect(round.snapshot().phase).toBe('pitch');
      expect(round.snapshot().number).toBe(2);
      expect(round.snapshot().selectedId).toBeUndefined();
      expect(ideas.list().find(item => item.id === idea.id)?.status).toBe('failed');
      expect(() => round.forceNext()).toThrow('No build');
    } finally { round.stop(); }
  }));

  it('saves a playable game snapshot and patch notes without local data or unshipped patches', async () => fixture((root, ideas, runs) => {
    const game = path.join(root, 'games', 'toy');
    fs.mkdirSync(path.join(game, 'src'), { recursive: true });
    fs.mkdirSync(path.join(game, 'mutations'), { recursive: true });
    fs.writeFileSync(path.join(game, 'src', 'main.js'), 'export const game = true');
    fs.writeFileSync(path.join(game, 'live-patch.json'), '{}');
    fs.writeFileSync(path.join(game, 'mutations', 'patch-aaaaaaaaaaaa.js'), 'export const meta = {}');
    fs.writeFileSync(path.join(game, 'mutations', 'patch-bbbbbbbbbbbb.js'), 'export const meta = {}');
    fs.writeFileSync(path.join(game, '.env'), 'PRIVATE=secret');
    const idea = ideas.add('a', '<script>Alice</script> [free](https://example.org)', 'Coins give 3 points', 'chat');
    ideas.setSpec(idea.id, 'Coins give 3 points ![](https://example.org/image.png)');
    const copy = ideas.add('b', 'Bob', 'Coins give 3 points!', 'chat'); ideas.merge(copy.id, idea.id);
    runs.upsert({ id: 'run-a', ideaId: idea.id, gameDirectory: game, status: 'shipped', mutationName: 'patch-aaaaaaaaaaaa.js', startedAt: new Date().toISOString() });
    const result = saveBuild(root, game, { name: 'Toy', mutationDir: 'mutations' } as GameManifest, ideas, runs);
    const notes = fs.readFileSync(path.join(result.directory, 'patch-notes.md'), 'utf8');
    expect(notes).toContain('Coins give 3 points');
    expect(notes).toContain('Bob');
    expect(notes).not.toContain('<script>');
    expect(notes).not.toContain('[free](');
    expect(notes).not.toContain('![](');
    expect(fs.existsSync(path.join(result.directory, 'game', '.env'))).toBe(false);
    expect(fs.existsSync(path.join(result.directory, 'game', 'mutations', 'patch-aaaaaaaaaaaa.js'))).toBe(true);
    expect(fs.existsSync(path.join(result.directory, 'game', 'mutations', 'patch-bbbbbbbbbbbb.js'))).toBe(false);
  }));
});
