import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { codexBinary, runnerEnvironment, verifySandbox } from '../runner/sandbox';
import type { TwitchConfig } from '../twitch/auth';
import type { RewardState } from '../twitch/rewards';

export type CheckState = 'Ready' | 'Needs action' | 'Not available here';
export interface SetupCheck { id: string; label: string; state: CheckState; reason: string; fix?: string }
const check = (id: string, label: string, state: CheckState, reason: string, fix?: string): SetupCheck => ({ id, label, state, reason, fix });
export const command = (binary: string, args: string[], timeout = 4000): Promise<string> => new Promise(resolve => {
  execFile(binary, args, { encoding: 'utf8', timeout, windowsHide: true }, (error, stdout, stderr) => resolve(error ? '' : `${stdout}\n${stderr}`.trim()));
});
export const codexSignedIn = (output: string): boolean => /^(?:logged in\b|authenticated\b)/im.test(output);

export function classifySandboxError(raw: string): SetupCheck {
  const text = raw.toLowerCase();
  if (/usage:\s*setup|unrecognized (?:option|argument)|unexpected argument|--current-user.*required/.test(text)) return check('sandbox', 'Codex elevated sandbox', 'Needs action', 'The installed Codex CLI rejected the sandbox setup command.', 'Update Codex or run the command shown in Setup. Copy diagnostics if it still fails.');
  if (/1385|log on locally|logon type/.test(text)) return check('sandbox', 'Codex elevated sandbox', 'Needs action', 'The sandbox account lacks the Log on locally right (error 1385).', 'Ask IT to grant the “Allow log on locally” user right through Local Security Policy or Group Policy.');
  if (/access is denied|permission denied|eacces|eperm|onedrive|protected folder/.test(text)) return check('sandbox', 'Codex elevated sandbox', 'Needs action', 'The sandbox cannot write in its temporary worktree or project location.', 'Move the project out of OneDrive/protected folders, check the exact blocked executable in Windows Security, and retry setup.');
  if (/administrator|elevation|uac|cancelled|canceled|refused/.test(text)) return check('sandbox', 'Codex elevated sandbox', 'Needs action', 'Administrator approval was refused or is unavailable.', 'Run setup with an administrator, or ask IT to provision the elevated sandbox for this Windows account and CODEX_HOME.');
  if (/firewall|security software|antivirus|defender|policy/.test(text)) return check('sandbox', 'Codex elevated sandbox', 'Needs action', 'Security software blocked a sandbox setup change.', 'Check Windows Security Protection history and allow only the specific blocked Codex executable, or ask IT.');
  if (/different user|codex.home|user profile|account mismatch/.test(text)) return check('sandbox', 'Codex elevated sandbox', 'Needs action', 'The sandbox appears to be set up for another Windows user or Codex home.', 'Run the official elevated setup again for the account and CODEX_HOME that start Live Patch.');
  if (/cannot write in its worktree|not set up|sandbox setup/.test(text)) return check('sandbox', 'Codex elevated sandbox', 'Needs action', 'Elevated sandbox setup has not passed for this account.', 'Run Codex sandbox setup and approve the Windows administrator prompt.');
  return check('sandbox', 'Codex elevated sandbox', 'Needs action', 'Sandbox self-test did not pass.', 'Copy redacted diagnostics and check the runner setup guide.');
}

export async function sandboxSelfTest(root: string): Promise<SetupCheck> {
  if (process.platform !== 'win32') return check('sandbox', 'Codex elevated sandbox', 'Not available here', 'The elevated sandbox check runs on Windows.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-setup-'));
  try {
    await verifySandbox(codexBinary(), directory, root, runnerEnvironment(), AbortSignal.timeout(20_000));
    return check('sandbox', 'Codex elevated sandbox', 'Ready', 'Worktree write succeeds and project write is blocked.');
  } catch (error) { return classifySandboxError(String(error)); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

export async function setupChecks(root: string, config: TwitchConfig, identities: { broadcaster: boolean; bot: boolean }, sandbox?: SetupCheck, reward?: RewardState): Promise<SetupCheck[]> {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const git = await command('git', ['--version']);
  let codex = ''; try { codex = codexBinary(); } catch { /* unavailable */ }
  const signedIn = codex ? codexSignedIn(await command(codex, ['login', 'status'], 6000)) : false;
  const browser = fs.existsSync(chromium.executablePath());
  const synced = /onedrive|dropbox|sharepoint/i.test(root);
  let writable = true; try { fs.accessSync(root, fs.constants.W_OK); } catch { writable = false; }
  const checks: SetupCheck[] = [
    check('node', 'Node.js 20+', nodeMajor >= 20 ? 'Ready' : 'Needs action', nodeMajor >= 20 ? `Node ${process.versions.node}` : 'Install Node.js 20 or newer.'),
    check('git', 'Git', git ? 'Ready' : 'Needs action', git || 'Git was not found on PATH.'),
    check('dependencies', 'Dependencies', fs.existsSync(path.join(root, 'node_modules', 'vite')) ? 'Ready' : 'Needs action', fs.existsSync(path.join(root, 'node_modules', 'vite')) ? 'Installed' : 'Run npm install.'),
    check('browser', 'Playwright browser', browser ? 'Ready' : 'Needs action', browser ? 'Chromium installed' : 'Run npx playwright install chromium.'),
    check('codex', 'Codex CLI and sign-in', codex && signedIn ? 'Ready' : 'Needs action', !codex ? 'Codex CLI was not found.' : signedIn ? 'Signed in' : 'Open Codex and sign in with ChatGPT.'),
    sandbox ?? check('sandbox', 'Codex elevated sandbox', 'Needs action', 'Run the sandbox self-test to verify worktree isolation.'),
    check('project', 'Project location', !synced && writable ? 'Ready' : 'Needs action', synced ? 'This project is in a synced folder; sandbox writes may be blocked.' : writable ? 'Writable local folder' : 'This account cannot write to the project folder.'),
    check('twitch-app', 'Twitch app', config.clientId && config.clientSecret ? 'Ready' : 'Needs action', config.clientId && config.clientSecret ? 'Credentials are saved; secret is hidden.' : 'Add Twitch app credentials below. Twitch is optional for practice.'),
    check('accounts', 'Broadcaster and bot', identities.broadcaster && identities.bot ? 'Ready' : 'Needs action', identities.broadcaster && identities.bot ? 'Both accounts connected' : 'Connect separate broadcaster and bot accounts.'),
    check('reward', 'Pitch reward', reward?.state === 'enabled' ? 'Ready' : 'Needs action', reward?.reason ?? (config.rewardId ? 'Checking the reward on Twitch.' : 'Optional: add the custom reward ID.')),
    check('overlay', 'OBS overlay', 'Ready', 'The local overlay URL is available at /overlay.html.')
  ];
  if (process.platform !== 'win32') checks.push(check('defender', 'Controlled Folder Access', 'Not available here', 'Windows Security is available only on Windows.'));
  else {
    const [preference, recent] = await Promise.all([
      command('powershell.exe', ['-NoProfile', '-Command', '$p=Get-MpPreference; @{ enabled=[int]$p.EnableControlledFolderAccess; folders=@($p.ControlledFolderAccessProtectedFolders) } | ConvertTo-Json -Compress'], 5000),
      command('powershell.exe', ['-NoProfile', '-Command', 'Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-Windows Defender/Operational"; Id=1123,1127; StartTime=(Get-Date).AddDays(-7)} -MaxEvents 30 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Message'], 5000)
    ]);
    let enabled: number | undefined; let folders: string[] = [];
    try { const parsed = JSON.parse(preference) as { enabled?: number; folders?: unknown }; enabled = parsed.enabled; folders = Array.isArray(parsed.folders) ? parsed.folders.filter((value): value is string => typeof value === 'string' && value.length > 0) : []; } catch { /* Defender may be unavailable or managed by another product. */ }
    const protectedPath = folders.find(folder => root.toLowerCase().startsWith(path.resolve(folder).toLowerCase() + path.sep));
    const relevant = recent.split(/\r?\n/).filter(line => /codex|node\.exe|live.patch|twitchconx/i.test(line)).slice(0, 3);
    const state: CheckState = enabled === undefined ? 'Not available here' : protectedPath || relevant.length ? 'Needs action' : 'Ready';
    const reason = enabled === undefined ? 'Windows Security status could not be read. Check it manually.' : `Controlled Folder Access is ${enabled === 1 ? 'on' : 'off'}. ${protectedPath ? `Project is under protected folder ${protectedPath}. ` : 'Project is not in a listed protected folder. '}${relevant.length ? `Recent block: ${relevant.join(' ').slice(0, 350)}` : 'No recent Codex or Node block was found in the readable event log.'}`;
    checks.push(check('defender', 'Controlled Folder Access', state, reason, state === 'Needs action' ? 'Open Windows Security → Protection history to confirm the exact blocked executable; allow that executable only or move the project.' : undefined));
  }
  return checks;
}

export function sandboxSetupArgs(user: string, codexHome: string): string[] {
  return ['sandbox', 'setup', '--elevated', '--user', user, '--codex-home', codexHome];
}
export function sandboxSetupPowerShell(binary: string, user: string, codexHome: string): string {
  const single = (value: string) => value.replaceAll("'", "''");
  const quoted = (value: string) => `"${value.replaceAll('"', '\\"')}"`;
  const args = sandboxSetupArgs(user, codexHome).map((value, index) => index === 4 || index === 6 ? quoted(value) : value).join(' ');
  return `$p=Start-Process -FilePath '${single(binary)}' -ArgumentList '${single(args)}' -Verb RunAs -Wait -PassThru; exit $p.ExitCode`;
}

export async function runSandboxSetup(): Promise<{ success: boolean; error?: string }> {
  if (process.platform !== 'win32') return { success: false, error: 'Windows setup is not available here' };
  return new Promise(resolve => {
    let binary: string; try { binary = codexBinary(); } catch { resolve({ success: false, error: 'Codex CLI is missing' }); return; }
    void command('whoami', [], 4000).then(user => {
      if (!user) { resolve({ success: false, error: 'Could not identify the Windows account running Live Patch' }); return; }
      const codexHome = path.resolve(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'));
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', sandboxSetupPowerShell(binary, user, codexHome)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let detail = '';
      const collect = (chunk: Buffer) => { detail = (detail + chunk.toString()).slice(-1000); };
      child.stdout.on('data', collect); child.stderr.on('data', collect);
      child.on('error', error => resolve({ success: false, error: String(error) }));
      child.on('close', code => resolve(code === 0 ? { success: true } : { success: false, error: detail || `Setup exited ${code}` }));
    }).catch(error => resolve({ success: false, error: String(error) }));
  });
}
