import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import type { GameManifest } from '../engine/manifest/schema';
import { IdeaStore } from '../engine/pipeline/ideas';
import { ChatPipeline } from '../engine/pipeline/commands';
import { normalizeSimulator } from '../engine/twitch/events';
import { LiveRunner } from '../engine/runner/runner';
import { RunStore } from '../engine/runner/store';

const root = process.cwd();
const enabled = process.env.LIVE_PATCH_REAL_AGENT === '1';
const ideaText = process.env.LIVE_PATCH_REAL_IDEA || 'Every 20 seconds, flip gravity left and right';
const batch = process.env.LIVE_PATCH_REAL_BATCH === '1';
const batchIdeas = [
  'Every 20 seconds, flip gravity left and right',
  'When an enemy is hit, split it into two small enemies',
  'Coins move away from the player twice per second',
  'Leave a short fire trail behind the player while moving',
  'Show the latest chat message above an enemy',
  'When two enemies touch, merge them into one larger enemy',
  'Make the player move faster for the first 15 seconds of each run',
  'Make collected coins worth three points',
  'Make enemies slow down when the player has one life left',
  'Draw a pulsing ring around the player once per second'
];

it.skipIf(!enabled)('uses the signed-in Codex SDK and real browser smoke gate for one simulator idea', async () => {
  const evaluation = path.join(root, '.live-patch', 'evaluations', `phase3-round1-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
  const fixture = path.join(evaluation, 'repo');
  const game = path.join(fixture, 'games', 'arena-survivor');
  fs.mkdirSync(evaluation, { recursive: true });
  process.stdout.write(`RUNNER EVALUATION ${evaluation}\n`);
  try {
    execFileSync('git', ['clone', '--local', root, fixture], { cwd: root, stdio: 'ignore' });
    fs.cpSync(path.join(root, 'games', 'arena-survivor'), game, { recursive: true });
    const manifestFile = path.join(game, 'live-patch.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as GameManifest;
    manifest.testCommand = `npm --prefix ${root} run smoke -- --mutation {file}`;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    fs.appendFileSync(path.join(fixture, '.gitignore'), '\n.test-data/\n');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: fixture, encoding: 'utf8' });
    git('config', 'user.name', 'Live Patch Evaluation');
    git('config', 'user.email', 'eval@example.invalid');
    git('add', '-A');
    git('commit', '--allow-empty', '-m', 'evaluation base');
    const ideas = new IdeaStore(path.join(fixture, '.test-data', 'ideas.json'));
    const runs = new RunStore(path.join(fixture, '.test-data', 'runs.json'));
    const runner = new LiveRunner(fixture, game, manifest, ideas, runs, event => {
      if (['thread', 'testing', 'passed', 'failed', 'shipped'].includes(event.type)) process.stdout.write(`RUNNER ${event.type} ${event.message ?? event.threadId ?? ''}\n`);
    });
    let pending: Promise<void> | undefined;
    const pipeline = new ChatPipeline(ideas, { rewardId: 'sim-pitch', reply: async () => {}, onControl: (action, idea) => {
      if (action === 'approve' && idea) pending = runner.enqueue(idea);
    } });
    const ideasToRun = batch ? batchIdeas : [ideaText];
    for (let index = 0; index < ideasToRun.length; index++) {
      const viewer = { id: `viewer-${index}`, login: `viewer${index}`, name: `Viewer${index}`, moderator: false, broadcaster: false };
      const submitted = await pipeline.ingest(normalizeSimulator({ id: `pitch-${index}`, kind: 'chat', viewer, text: `!idea ${ideasToRun[index]}` }, 'sim-pitch')!);
      expect(submitted.idea).toBeDefined();
      const mod = { ...viewer, id: 'mod', login: 'mod', name: 'Mod', moderator: true };
      await pipeline.ingest(normalizeSimulator({ id: `approve-${index}`, kind: 'chat', viewer: mod, text: `!approve ${submitted.idea!.id}` }, 'sim-pitch')!);
      await pending;
      const result = runs.list()[index];
      process.stdout.write(`RUNNER RESULT ${JSON.stringify({ idea: ideasToRun[index], status: result.status, durationMs: result.durationMs, threadId: result.threadId, module: result.mutationName, error: result.error })}\n`);
    }
    const results = runs.list();
    const shipped = results.filter(result => result.status === 'shipped');
    const durations = shipped.map(result => result.durationMs!).sort((a, b) => a - b);
    const median = durations.length ? (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2 : null;
    process.stdout.write(`RUNNER SUMMARY ${JSON.stringify({ total: results.length, shipped: shipped.length, medianIdeaToShippedMs: median })}\n`);
    fs.writeFileSync(path.join(evaluation, 'results.json'), JSON.stringify({ ideas: ideasToRun.map((idea, index) => ({ idea, ...results[index] })), medianIdeaToShippedMs: median }, null, 2));
    expect(shipped.length).toBeGreaterThanOrEqual(batch ? 7 : 1);
    expect(shipped.every(result => result.threadId && result.durationMs! > 0)).toBe(true);
    const liveBeforeCrash = fs.readdirSync(path.join(game, manifest.mutationDir)).filter(name => name.endsWith('.js')).sort();
    const crashingAgent = (worktree: string) => ({
      threadId: () => 'crash-fixture',
      async run(prompt: string) {
        const relative = /(?:Write exactly one new file relative to the worktree root: |single required file )([^\s;]+)/.exec(prompt)?.[1];
        if (!relative) throw Error('Missing candidate path');
        const candidate = path.join(worktree, relative);
        fs.mkdirSync(path.dirname(candidate), { recursive: true });
        fs.writeFileSync(candidate, "export const meta={id:'crash',title:'Crash',author:'test',description:'test'}; export function onStart(){throw Error('boom');}");
      }
    });
    const crashRunner = new LiveRunner(fixture, game, manifest, ideas, runs, () => {}, crashingAgent);
    const crashIdea = ideas.add('crash-viewer', 'Crash Viewer', 'Show an intentionally broken effect', 'chat');
    ideas.setStatus(crashIdea.id, 'approved');
    await crashRunner.enqueue({ ...crashIdea, status: 'approved' });
    expect(runs.list().at(-1)?.status).toBe('failed');
    expect(fs.readdirSync(path.join(game, manifest.mutationDir)).filter(name => name.endsWith('.js')).sort()).toEqual(liveBeforeCrash);
    process.stdout.write('RUNNER CRASH REJECTED by real browser smoke gate\n');
  } finally { process.stdout.write(`RUNNER RETAINED ${evaluation}\n`); }
}, 40 * 60_000);
