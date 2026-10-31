import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { execFileSync, spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const pitches = [
  'The fox can double jump',
  'Make the forest rainy and slow the fox a little',
  'Spawn a mushroom spring ahead of the fox every 200 meters'
];
const tempRoot = fs.mkdtempSync(path.join(path.dirname(root), 'live-patch-phase6-live-'));
const clone = path.join(tempRoot, 'repo');
const dataDir = path.join(clone, '.live-patch');
const logFile = path.join(tempRoot, 'server.log');

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      if (!address || typeof address === 'string') { socket.close(); reject(Error('No free port')); return; }
      socket.close(() => resolve(address.port));
    });
  });
}

function localRun(ideaId) {
  const file = path.join(dataDir, 'runs.json');
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')).find(run => run.ideaId === ideaId);
}

let server;
let output;
try {
  try { execFileSync('git', ['clone', '--local', root, clone], { cwd: root, encoding: 'utf8' }); }
  catch (error) { throw Error(`Test clone failed: ${String(error.stderr ?? error.message)}`); }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(clone, 'node_modules'), 'junction');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  output = fs.createWriteStream(logFile);
  const env = {
    ...process.env,
    TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '', TWITCH_REDIRECT_URI: '', TWITCH_PITCH_REWARD_ID: '',
    LIVE_PATCH_GAME: 'games/lantern-run', LIVE_PATCH_TEST_SERVER: '1',
    LIVE_PATCH_HTTP_PORT: String(port), LIVE_PATCH_SIMULATOR_ENABLED: '1', LIVE_PATCH_DATA_DIR: dataDir
  };
  server = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: clone, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(output);
  server.stderr.pipe(output);

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw Error(`Verification server exited: ${server.exitCode}`);
    try { ready = (await fetch(`${base}/api/runs`)).ok; if (ready) break; } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw Error('Verification server did not start');

  const post = async body => {
    const response = await fetch(`${base}/api/simulator/events`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(body)
    });
    if (!response.ok) throw Error(`Simulator returned ${response.status}: ${await response.text()}`);
    return response.json();
  };

  const outcomes = [];
  for (let index = 0; index < pitches.length; index++) {
    const beganAt = Date.now();
    const viewer = { id: `phase6-viewer-${index}`, login: `phase6viewer${index}`, name: `Phase6Viewer${index}`, moderator: false, broadcaster: false };
    const pitch = await post({ id: `phase6-pitch-${index}`, kind: 'chat', viewer, text: `!idea ${pitches[index]}` });
    if (!pitch.idea?.id) throw Error(`Pitch ${index + 1} did not enter the pipeline`);
    await post({ id: `phase6-approve-${index}`, kind: 'chat', viewer: { id: 'phase6-mod', login: 'phase6mod', name: 'Phase6Mod', moderator: true, broadcaster: false }, text: `!approve ${pitch.idea.id}` });
    process.stdout.write(`BUILD ${index + 1}/3 STARTED: ${pitches[index]}\n`);
    let run;
    for (let attempt = 0; attempt < 300; attempt++) {
      const response = await fetch(`${base}/api/runs`);
      const body = await response.json();
      run = body.runs?.find(item => item.ideaId === pitch.idea.id && item.status !== 'building');
      if (run) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!run) throw Error(`Build ${index + 1} exceeded five minutes`);
    const stored = localRun(pitch.idea.id);
    const outcome = {
      pitch: pitches[index], status: run.status, durationMs: run.durationMs ?? Date.now() - beganAt,
      mutationName: run.mutationName, threadId: run.threadId,
      failureKind: stored?.failureKind, stopReason: stored?.stopReason,
      reason: stored?.error ?? run.error
    };
    outcomes.push(outcome);
    process.stdout.write(`BUILD ${index + 1}/3 RESULT: ${JSON.stringify(outcome)}\n`);
  }
  const shipped = outcomes.filter(item => item.status === 'shipped').length;
  process.stdout.write(`SUMMARY: ${shipped}/3 shipped\n`);
  if (shipped < 2) process.exitCode = 1;
} finally {
  if (server) {
    server.kill();
    if (server.exitCode === null) await Promise.race([new Promise(resolve => server.once('close', resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
  }
  if (output) await new Promise(resolve => output.end(resolve));
  const resolved = path.resolve(tempRoot);
  const expectedParent = path.dirname(root);
  if (path.dirname(resolved) !== expectedParent || !path.basename(resolved).startsWith('live-patch-phase6-live-'))
    throw Error(`Refusing to remove unexpected test clone: ${resolved}`);
  try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); }
  catch (error) { process.stderr.write(`TEST CLONE NOT DELETED: ${resolved}: ${error}\n`); }
}
