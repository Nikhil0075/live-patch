import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { expect, it } from 'vitest';

const root = process.cwd();
const ideas = [
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
const requestedCount = Number(process.env.LIVE_PATCH_LIVE_EVAL_COUNT ?? '10');
const selectedIdeas = ideas.slice(0, requestedCount);

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') { server.close(); reject(Error('No free port')); return; }
      server.close(() => resolve(address.port));
    });
  });
}

it.skipIf(process.env.LIVE_PATCH_LIVE_EVAL !== '1')('ships ten ideas through an isolated dev server simulator', async () => {
  const evaluation = path.join(path.dirname(root), 'live-patch-evaluations', `phase3-live-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
  const fixture = path.join(evaluation, 'repo');
  fs.mkdirSync(evaluation, { recursive: true });
  execFileSync('git', ['clone', '--local', root, fixture], { cwd: root, stdio: 'ignore' });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const output = fs.createWriteStream(path.join(evaluation, 'server.log'));
  const env = { ...process.env, TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '', TWITCH_REDIRECT_URI: '', TWITCH_PITCH_REWARD_ID: '', LIVE_PATCH_GAME: 'games/arena-survivor', LIVE_PATCH_TEST_SERVER: '1', LIVE_PATCH_HTTP_PORT: String(port), LIVE_PATCH_SIMULATOR_ENABLED: '1', LIVE_PATCH_DATA_DIR: path.join(fixture, '.live-patch') };
  const server = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: fixture, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout?.pipe(output); server.stderr?.pipe(output);
  process.stdout.write(`LIVE EVALUATION ${evaluation}\n`);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw Error(`Evaluation server exited: ${server.exitCode}`);
      try { const response = await fetch(`${base}/api/runs`); if (response.ok) { ready = true; break; } } catch { /* Server is starting. */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw Error('Evaluation server did not start');
    const post = async (body: unknown) => {
      const response = await fetch(`${base}/api/simulator/events`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(body) });
      if (!response.ok) throw Error(`Simulator returned ${response.status}: ${await response.text()}`);
      return response.json() as Promise<{ idea?: { id: string } }>;
    };
    const outcomes: { idea: string; status: string; durationMs?: number; threadId?: string; mutationName?: string }[] = [];
    for (let index = 0; index < selectedIdeas.length; index++) {
      const viewer = { id: `viewer-${index}`, login: `viewer${index}`, name: `Viewer${index}`, moderator: false, broadcaster: false };
      const pitch = await post({ id: `pitch-${index}`, kind: 'chat', viewer, text: `!idea ${selectedIdeas[index]}` });
      if (!pitch.idea?.id) throw Error(`Idea ${index} did not enter the pipeline`);
      await post({ id: `approve-${index}`, kind: 'chat', viewer: { ...viewer, id: 'mod', login: 'mod', name: 'Mod', moderator: true }, text: `!approve ${pitch.idea.id}` });
      let result: { ideaId: string; status: string; durationMs?: number; threadId?: string; mutationName?: string } | undefined;
      for (let attempt = 0; attempt < 240; attempt++) {
        const response = await fetch(`${base}/api/runs`);
        const body = await response.json() as { runs: typeof result[] };
        result = body.runs.find(run => run?.ideaId === pitch.idea!.id && run.status !== 'building');
        if (result) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!result) throw Error(`Idea ${index} exceeded the four-minute evaluation deadline`);
      const outcome = { idea: selectedIdeas[index], status: result.status, durationMs: result.durationMs, threadId: result.threadId, mutationName: result.mutationName };
      outcomes.push(outcome);
      process.stdout.write(`LIVE RESULT ${JSON.stringify(outcome)}\n`);
      fs.writeFileSync(path.join(evaluation, 'results.json'), JSON.stringify(outcomes, null, 2));
    }
    const shipped = outcomes.filter(item => item.status === 'shipped');
    const durations = shipped.map(item => item.durationMs!).sort((a, b) => a - b);
    const median = (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2;
    process.stdout.write(`LIVE SUMMARY ${JSON.stringify({ total: outcomes.length, shipped: shipped.length, medianIdeaToShippedMs: median })}\n`);
    expect(shipped.length).toBeGreaterThanOrEqual(Math.min(7, selectedIdeas.length));
    expect(shipped.every(item => item.threadId && item.mutationName)).toBe(true);
  } finally {
    server.kill();
    if (server.exitCode === null) await Promise.race([new Promise(resolve => server.once('close', resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
    output.end();
    process.stdout.write(`LIVE RETAINED ${evaluation}\n`);
  }
}, 45 * 60_000);
