import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const run = (command, args, timeout = 120_000) => spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout, shell: process.platform === 'win32' && ['npm', 'npx'].includes(command), windowsHide: true });
const line = (label, ready, detail) => console.log(`${ready ? 'Ready' : 'Needs action'} · ${label}${detail ? ` · ${detail}` : ''}`);
const major = Number(process.versions.node.split('.')[0]);
line('Node.js 20+', major >= 20, process.versions.node);
if (major < 20) process.exit(1);

const git = run('git', ['--version'], 5000);
line('Git', git.status === 0, git.status === 0 ? git.stdout.trim() : 'Install Git before building patches');
if (!fs.existsSync(path.join(root, 'node_modules', 'vite'))) {
  console.log('Installing project dependencies with npm ci…');
  const install = run('npm', ['ci'], 300_000);
  if (install.status !== 0) { line('Dependencies', false, 'npm ci failed; run it manually for diagnostics'); process.exit(1); }
}
line('Dependencies', true, 'installed');

const { chromium } = require('@playwright/test');
if (!fs.existsSync(chromium.executablePath())) {
  console.log('Installing Playwright Chromium…');
  const install = run('npx', ['playwright', 'install', 'chromium'], 300_000);
  if (install.status !== 0) { line('Chromium', false, 'run npx playwright install chromium'); process.exit(1); }
}
line('Chromium', true, 'installed');

let codex;
try {
  const packageDir = path.dirname(require.resolve(`@openai/codex-${process.platform}-${process.arch}/package.json`));
  const targets = fs.readdirSync(path.join(packageDir, 'vendor'));
  if (targets.length === 1) codex = path.join(packageDir, 'vendor', targets[0], 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex');
} catch { /* Report the missing binary below. */ }
const login = codex && fs.existsSync(codex) ? run(codex, ['login', 'status'], 10_000) : undefined;
const signedIn = Boolean(login && /\b(?:logged in|authenticated)\b/i.test(`${login.stdout}\n${login.stderr}`));
line('Codex sign-in', signedIn, signedIn ? 'signed in' : 'open Codex and sign in');
line('Elevated sandbox', false, 'open Setup and run the sandbox self-test for this Windows account');
console.log('Optional · Twitch connection · verify broadcaster and bot in Setup; Practice works offline');
console.log('\nStart the studio with npm run dev, then open the printed URL. Setup opens automatically on first visit.');
