import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { Codex, type Thread } from '@openai/codex-sdk';
import type { GameManifest } from '../manifest/schema';
import type { Idea, IdeaStore } from '../pipeline/ideas';
import { buildPrompt, gateCandidate, unsafeIdea } from './gates';
import { RunStore, publicFailure, type RunRecord, type RunnerEvent } from './store';
import { codexBinary, disabledMcpConfig, runnerConfig, runnerEnvironment, verifySandbox } from './sandbox';

const RUN_TIMEOUT_MS = 3 * 60_000;
const RUNNER_ROOT_NAME = 'live-patch-runner';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024 }).trim();
}
function deleteBranch(root: string, branch: string) {
  try { execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root, stdio: 'ignore', timeout: 20_000 }); }
  catch { return; }
  git(root, 'branch', '-D', branch);
}
function within(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}
function safeRemove(runnerRoot: string, directory: string) {
  if (!within(runnerRoot, directory)) throw Error('Runner cleanup path escaped its root');
  fs.rmSync(directory, { recursive: true, force: true });
}
function stripBuilderInstructions(directory: string) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const file = path.join(directory, entry.name);
    if (entry.name === '.codex' || entry.name === 'AGENTS.md' || entry.name === 'AGENTS.override.md') fs.rmSync(file, { recursive: entry.isDirectory(), force: true });
    else if (entry.isDirectory()) stripBuilderInstructions(file);
  }
}
export interface AgentSession {
  run(prompt: string): Promise<void>;
  threadId(): string | undefined;
}
export type AgentFactory = (worktree: string, signal: AbortSignal, emit: (type: RunnerEvent['type'], message?: string, threadId?: string) => void) => AgentSession;

export function codexAgent(worktree: string, signal: AbortSignal, emit: (type: RunnerEvent['type'], message?: string, threadId?: string) => void): AgentSession {
  const binary = codexBinary();
  const environment = runnerEnvironment();
  const mcpServers = disabledMcpConfig(binary, worktree, environment);
  const codex = new Codex({ codexPathOverride: binary, env: environment, config: { ...runnerConfig, mcp_servers: mcpServers } });
  const thread: Thread = codex.startThread({ workingDirectory: worktree, sandboxMode: 'workspace-write', networkAccessEnabled: false, webSearchMode: 'disabled', approvalPolicy: 'never' });
  let verified = false;
  return {
    threadId: () => thread.id ?? undefined,
    async run(prompt) {
      if (!verified) {
        await verifySandbox(binary, worktree, process.cwd(), environment, signal);
        verified = true;
        emit('sandbox_verified');
      }
      const { events } = await thread.runStreamed(prompt, { signal });
      for await (const event of events) {
        if (event.type === 'thread.started') emit('thread', undefined, event.thread_id);
        else if (event.type === 'item.started' && ['command_execution', 'mcp_tool_call', 'web_search'].includes(event.item.type))
          throw Error(`Codex attempted an unavailable tool: ${event.item.type}`);
        else if (event.type === 'item.completed' && event.item.type === 'file_change')
          for (const change of event.item.changes) emit('file', change.path);
        else if (event.type === 'turn.failed' || event.type === 'error') throw Error(event.type === 'error' ? event.message : event.error.message);
      }
      if (signal.aborted) throw Error('Codex run timed out');
    }
  };
}

function smoke(command: string, root: string, gameDirectory: string, filename: string, signal: AbortSignal): Promise<void> {
  if (!command.includes('{file}')) throw Error('Manifest testCommand must contain {file}');
  if (!/^[\w .\/\\{}:-]+$/.test(command)) throw Error('Manifest testCommand contains unsupported shell characters');
  const shellCommand = command.replaceAll('{file}', filename);
  return new Promise((resolve, reject) => {
    const child = spawn(shellCommand, { cwd: root, env: { ...process.env, LIVE_PATCH_GAME: gameDirectory, LIVE_PATCH_TEST_SERVER: '1', LIVE_PATCH_SMOKE_COMBINED: '1' }, shell: true, windowsHide: true, detached: process.platform !== 'win32', signal });
    const killTree = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => {});
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* The group already exited. */ }
      }
    };
    signal.addEventListener('abort', killTree, { once: true });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream?.on('data', chunk => { output = (output + String(chunk)).slice(-6000); });
    child.on('error', reject);
    child.on('close', code => {
      signal.removeEventListener('abort', killTree);
      code === 0 ? resolve() : reject(Error(`Smoke test failed (${code}): ${output.slice(-4000)}`));
    });
  });
}

export class LiveRunner {
  private queue: Promise<void> = Promise.resolve();
  private runnerRoot: string;
  private activeAbort?: AbortController;
  private rollbackEpoch = 0;
  private closed = false;
  constructor(
    private root: string,
    private gameDirectory: string,
    private manifest: GameManifest,
    private ideas: IdeaStore,
    private runs: RunStore,
    private onEvent: (event: RunnerEvent) => void,
    private agentFactory: AgentFactory = codexAgent,
    private smokeTest: typeof smoke = smoke
  ) {
    const fingerprint = createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 12);
    this.runnerRoot = path.join(os.tmpdir(), RUNNER_ROOT_NAME, fingerprint);
    this.recoverInterrupted();
  }
  enqueue(idea: Idea): Promise<void> {
    if (this.closed) return Promise.reject(Error('Runner is stopped'));
    const epoch = this.rollbackEpoch;
    const task = this.queue.then(() => this.build(idea, epoch));
    this.queue = task.catch(error => { console.error(`Runner idea ${idea.id} failed:`, error); });
    return task;
  }
  requestRollback(): Promise<void> {
    if (this.closed) return Promise.reject(Error('Runner is stopped'));
    const shipped = this.runs.lastShipped(this.gameDirectory);
    if (!shipped?.branch || !shipped.commit || !shipped.mutationName) return Promise.reject(Error('No shipped mutation to roll back'));
    this.rollbackEpoch++;
    this.activeAbort?.abort('Moderator requested rollback');
    return Promise.resolve().then(() => this.rollback());
  }
  stop() { this.closed = true; this.activeAbort?.abort('Server stopped'); }
  private emit(record: RunRecord, type: RunnerEvent['type'], message?: string, threadId?: string) {
    const publicMessage = type === 'file' && message ? path.basename(message) : type === 'failed' ? publicFailure(record.error) : message;
    this.onEvent({ runId: record.id, ideaId: record.ideaId, type, at: new Date().toISOString(), ...(publicMessage ? { message: publicMessage } : {}), ...(threadId ? { threadId } : {}) });
  }
  private prepare(id: string): { directory: string; branch: string; gameRelative: string; game: string; pointer: string } {
    const directory = path.join(this.runnerRoot, id);
    if (!within(this.runnerRoot, directory)) throw Error('Runner worktree path escaped its root');
    fs.mkdirSync(this.runnerRoot, { recursive: true });
    const branch = `live-patch/run-${id}`;
    git(this.root, 'worktree', 'add', '-b', branch, directory, 'HEAD');
    try {
      const relative = path.relative(this.root, this.gameDirectory);
      const gameRelative = within(this.root, this.gameDirectory) ? relative : path.join('games', `external-${id}`);
      const game = path.resolve(directory, gameRelative);
      if (!within(directory, game)) throw Error('Game path escaped worktree');
      if (fs.existsSync(game)) safeRemove(directory, game);
      fs.cpSync(this.gameDirectory, game, {
        recursive: true,
        filter: file => {
          const name = path.basename(file);
          if (name === '.git' || name === 'node_modules' || name === 'dist' || name === '.live-patch' || name.startsWith('.env')) return false;
          if (fs.lstatSync(file).isSymbolicLink()) throw Error(`Game contains symlink: ${file}`);
          return true;
        }
      });
      stripBuilderInstructions(directory);
      git(directory, 'add', '-A');
      git(directory, 'commit', '--allow-empty', '-m', `live patch: snapshot ${id}`);
      return { directory, branch, gameRelative, game, pointer: fs.readFileSync(path.join(directory, '.git'), 'utf8') };
    } catch (error) {
      this.cleanup(directory);
      throw error;
    }
  }
  private cleanup(directory: string) {
    if (!within(this.runnerRoot, directory)) throw Error('Runner cleanup path escaped its root');
    try { git(this.root, 'worktree', 'remove', '--force', directory); } finally { if (fs.existsSync(directory)) safeRemove(this.runnerRoot, directory); }
  }
  private recoverInterrupted() {
    const mutationDir = path.resolve(this.gameDirectory, this.manifest.mutationDir);
    for (const record of this.runs.list().filter(item => item.gameDirectory === this.gameDirectory && item.status === 'building')) {
      const candidate = path.join(mutationDir, `patch-${record.id.replaceAll('-', '').slice(0, 12)}.js`);
      if (within(mutationDir, candidate) && fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) fs.rmSync(candidate);
      record.status = 'failed';
      record.error = 'Server restarted during build';
      record.finishedAt = new Date().toISOString();
      this.runs.upsert(record);
      if (this.ideas.list().find(idea => idea.id === record.ideaId)?.status === 'building') this.ideas.setStatus(record.ideaId, 'failed');
      this.emit(record, 'failed', record.error);
      const directory = path.join(this.runnerRoot, record.id);
      if (fs.existsSync(directory)) try { this.cleanup(directory); } catch (error) { console.error(`Runner recovery ${record.id} cleanup failed:`, error); }
      try { git(this.root, 'worktree', 'prune'); } catch (error) { console.error(`Runner recovery ${record.id} prune failed:`, error); }
      try { deleteBranch(this.root, record.branch ?? `live-patch/run-${record.id}`); } catch (error) { console.error(`Runner recovery ${record.id} branch cleanup failed:`, error); }
    }
    for (const record of this.runs.list().filter(item => item.gameDirectory === this.gameDirectory && item.status === 'shipped')) {
      const target = record.mutationName ? path.join(mutationDir, record.mutationName) : '';
      if (target && within(mutationDir, target) && !fs.existsSync(target)) {
        record.status = 'rolled_back';
        this.runs.upsert(record);
      }
      const idea = this.ideas.list().find(item => item.id === record.ideaId);
      if (idea?.status === 'building' || (record.status === 'rolled_back' && idea?.status === 'shipped')) this.ideas.setStatus(record.ideaId, record.status);
    }
  }
  private async build(idea: Idea, epoch: number) {
    if (this.closed) return;
    if (epoch !== this.rollbackEpoch) {
      if (this.ideas.list().find(item => item.id === idea.id)?.status === 'approved') {
        const now = new Date().toISOString();
        const record: RunRecord = { id: randomUUID(), ideaId: idea.id, gameDirectory: this.gameDirectory, status: 'failed', startedAt: now, finishedAt: now, error: 'Cancelled by moderator rollback' };
        this.runs.upsert(record);
        this.ideas.setStatus(idea.id, 'failed');
        this.emit(record, 'failed', record.error);
      }
      return;
    }
    if (idea.status !== 'approved' || this.ideas.list().find(item => item.id === idea.id)?.status !== 'approved') return;
    const id = randomUUID();
    const record: RunRecord = { id, ideaId: idea.id, gameDirectory: this.gameDirectory, status: 'building', startedAt: new Date().toISOString() };
    this.runs.upsert(record);
    this.ideas.setStatus(idea.id, 'building');
    this.emit(record, 'started');
    let worktree: ReturnType<LiveRunner['prepare']> | undefined;
    let publishedFile: string | undefined;
    const abort = new AbortController();
    this.activeAbort = abort;
    const timeout = setTimeout(() => abort.abort('Run timed out after three minutes'), RUN_TIMEOUT_MS);
    try {
      if (unsafeIdea(idea.text)) throw Error('Idea asks for files, secrets or network access outside the mutation API');
      worktree = this.prepare(id);
      record.branch = worktree.branch; this.runs.upsert(record);
      const filename = `patch-${id.replaceAll('-', '').slice(0, 12)}.js`;
      const mutationDir = path.resolve(this.gameDirectory, this.manifest.mutationDir);
      const active = fs.readdirSync(mutationDir).filter(name => name.endsWith('.js') && !name.startsWith('.'));
      const apiDocs = fs.readFileSync(path.resolve(this.gameDirectory, this.manifest.apiDocs), 'utf8');
      const examples = this.manifest.examples.flatMap(exampleDir => fs.readdirSync(path.resolve(this.gameDirectory, exampleDir)).filter(name => name.endsWith('.js')).slice(0, 4).map(name => ({ name, source: fs.readFileSync(path.resolve(this.gameDirectory, exampleDir, name), 'utf8') })));
      const prompt = buildPrompt(idea, this.manifest, worktree.gameRelative, apiDocs, examples, active, filename);
      const agent = this.agentFactory(worktree.directory, abort.signal, (type, message, threadId) => {
        if (threadId) { record.threadId = threadId; this.runs.upsert(record); }
        this.emit(record, type, message, threadId);
      });
      let source = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        await agent.run(attempt === 0 ? prompt : `The host rejected the previous output: ${source}. Repair the worktree. Keep only the single required file ${path.posix.join(worktree.gameRelative.replaceAll('\\', '/'), this.manifest.mutationDir, filename)} relative to the worktree root; do not touch anything else.`);
        if (agent.threadId() && !record.threadId) { record.threadId = agent.threadId(); this.runs.upsert(record); }
        try {
          const candidate = gateCandidate(worktree.directory, worktree.gameRelative, this.manifest, filename, worktree.pointer);
          source = candidate.source;
          this.emit(record, 'testing');
          await this.smokeTest(this.manifest.testCommand, this.root, worktree.game, filename, abort.signal);
          const after = gateCandidate(worktree.directory, worktree.gameRelative, this.manifest, filename, worktree.pointer);
          if (after.source !== source) throw Error('Mutation changed during smoke test');
          if (abort.signal.aborted || this.closed || epoch !== this.rollbackEpoch) throw Error('Run stopped before publish');
          this.emit(record, 'passed');
          git(worktree.directory, 'add', '--', path.relative(worktree.directory, candidate.file));
          git(worktree.directory, 'commit', '-m', `live patch: ${idea.id}`);
          record.commit = git(worktree.directory, 'rev-parse', 'HEAD');
          const target = path.join(mutationDir, filename);
          if (fs.existsSync(target)) throw Error('Mutation target already exists');
          const temp = path.join(mutationDir, `.${filename}.tmp`);
          fs.writeFileSync(temp, source, { flag: 'wx' });
          try { fs.renameSync(temp, target); } finally { if (fs.existsSync(temp)) fs.rmSync(temp); }
          publishedFile = target;
          record.mutationName = filename;
          record.status = 'shipped';
          record.finishedAt = new Date().toISOString();
          record.durationMs = Date.parse(record.finishedAt) - Date.parse(record.startedAt);
          this.runs.upsert(record);
          this.ideas.setStatus(idea.id, 'shipped');
          this.emit(record, 'shipped', filename);
          return;
        } catch (error) {
          if (attempt === 1 || abort.signal.aborted) throw error;
          source = String(error).slice(-4000);
        }
      }
    } catch (error) {
      if (publishedFile && fs.existsSync(publishedFile)) fs.rmSync(publishedFile);
      record.status = 'failed';
      record.error = abort.signal.aborted ? String(abort.signal.reason) : String(error).slice(0, 1000);
      record.finishedAt = new Date().toISOString();
      this.runs.upsert(record);
      this.ideas.setStatus(idea.id, 'failed');
      this.emit(record, 'failed', record.error);
    } finally {
      clearTimeout(timeout);
      if (this.activeAbort === abort) this.activeAbort = undefined;
      if (worktree) try { this.cleanup(worktree.directory); } catch (error) { console.error(`Runner cleanup ${id} failed:`, error); }
      if (record.status === 'failed') {
        try { deleteBranch(this.root, record.branch ?? `live-patch/run-${id}`); } catch (error) { console.error(`Runner ${id} branch cleanup failed:`, error); }
      }
    }
  }
  private rollback() {
    if (this.closed) throw Error('Runner is stopped');
    const record = this.runs.lastShipped(this.gameDirectory);
    if (!record?.branch || !record.commit || !record.mutationName) throw Error('No shipped mutation to roll back');
    const target = path.resolve(this.gameDirectory, this.manifest.mutationDir, record.mutationName);
    const mutationDir = path.resolve(this.gameDirectory, this.manifest.mutationDir);
    if (!within(mutationDir, target)) throw Error('Rollback path escaped mutation directory');
    if (fs.existsSync(target)) {
      if (!fs.lstatSync(target).isFile()) throw Error('Rollback target is not a regular file');
      fs.rmSync(target);
    }
    record.status = 'rolled_back';
    this.runs.upsert(record);
    this.ideas.setStatus(record.ideaId, 'rolled_back');
    this.emit(record, 'rolled_back', record.mutationName);
    const directory = path.join(this.runnerRoot, `rollback-${randomUUID()}`);
    if (!within(this.runnerRoot, directory)) throw Error('Rollback worktree path escaped its root');
    fs.mkdirSync(this.runnerRoot, { recursive: true });
    try {
      git(this.root, 'worktree', 'add', directory, record.branch);
      git(directory, 'revert', '--no-edit', record.commit);
    } catch (error) {
      console.error(`Runner rollback ${record.id} Git history failed after live removal:`, error);
    } finally { if (fs.existsSync(directory)) this.cleanup(directory); }
  }
}
