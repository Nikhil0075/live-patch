import { expect, it } from 'vitest';
import { CodexTriage } from '../engine/pipeline/triage';
import type { Idea } from '../engine/pipeline/ideas';

it.skipIf(process.env.LIVE_PATCH_REAL_TRIAGE !== '1')('triages viewer ideas with a signed-in no-tool Codex thread', async () => {
  const base = { authorId: 'viewer', authorName: 'Viewer', source: 'chat' as const, status: 'shortlisted' as const, votes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const ideas: Idea[] = [
    { ...base, id: 'idea-1', text: 'Make coins bounce off walls' },
    { ...base, id: 'idea-2', text: 'Coins should ricochet from the arena edges' }
  ];
  const decisions = await new CodexTriage().review(ideas);
  expect(decisions.map(item => item.id).sort()).toEqual(['idea-1', 'idea-2']);
  expect(decisions.every(item => ['accept', 'reject', 'merge'].includes(item.decision))).toBe(true);
}, 60_000);
