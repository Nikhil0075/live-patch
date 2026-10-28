import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);

export const runnerConfig = {
  sandbox_mode: 'workspace-write',
  sandbox_workspace_write: { network_access: false, writable_roots: [], exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
  windows: { sandbox: 'elevated' },
  features: { shell_tool: false, plugins: false },
  apps: { _default: { enabled: false } },
  web_search: 'disabled'
};

export function codexBinary(): string {
  const packageName = `@openai/codex-${process.platform}-${process.arch}`;
  const packageDir = path.dirname(require.resolve(`${packageName}/package.json`));
  const vendor = path.join(packageDir, 'vendor');
  const targets = fs.readdirSync(vendor);
  if (targets.length !== 1) throw Error(`Ambiguous Codex native binary in ${packageName}`);
  const binary = path.join(vendor, targets[0], 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex');
  if (!fs.statSync(binary).isFile()) throw Error('Codex native binary is missing');
  return binary;
}

export function runnerEnvironment(): Record<string, string> {
  const allowed = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'HOME', 'CODEX_HOME', 'OPENAI_API_KEY'];
  return Object.fromEntries(allowed.filter(key => process.env[key]).map(key => [key, process.env[key]!]));
}

export interface McpServer { name: string; enabled: boolean; transport: { type: string } }

function listMcpServers(binary: string, worktree: string, env: Record<string, string>, overrides: string[] = []): McpServer[] {
  const output = execFileSync(binary, ['mcp', 'list', '--json', ...overrides.flatMap(value => ['-c', value])], { cwd: worktree, env, encoding: 'utf8', timeout: 15_000, windowsHide: true });
  const servers: unknown = JSON.parse(output);
  if (!Array.isArray(servers) || !servers.every(server => server && typeof server.name === 'string' && typeof server.enabled === 'boolean' && typeof server.transport?.type === 'string')) throw Error('Cannot verify Codex MCP server configuration');
  return servers as McpServer[];
}

async function listMcpServersAsync(binary: string, worktree: string, env: Record<string, string>, overrides: string[] = []): Promise<McpServer[]> {
  const { stdout } = await promisify(execFile)(binary, ['mcp', 'list', '--json', ...overrides.flatMap(value => ['-c', value])], { cwd: worktree, env, encoding: 'utf8', timeout: 15_000, windowsHide: true });
  const servers: unknown = JSON.parse(stdout);
  if (!Array.isArray(servers) || !servers.every(server => server && typeof server.name === 'string' && typeof server.enabled === 'boolean' && typeof server.transport?.type === 'string')) throw Error('Cannot verify Codex MCP server configuration');
  return servers as McpServer[];
}

export async function disabledMcpConfigAsync(binary: string, worktree: string, env: Record<string, string>) {
  const servers = await listMcpServersAsync(binary, worktree, env);
  if (servers.some(server => !/^[a-zA-Z0-9_-]+$/.test(server.name))) throw Error('Unsafe MCP server name in Codex configuration');
  if (servers.some(server => server.transport.type !== 'stdio')) throw Error('Unsupported MCP transport in Codex configuration');
  const overrides = servers.flatMap(server => [`mcp_servers.${server.name}.command=${JSON.stringify(process.execPath)}`, `mcp_servers.${server.name}.enabled=false`]);
  const effective = await listMcpServersAsync(binary, worktree, env, overrides);
  if (effective.some(server => server.enabled)) throw Error('Codex MCP server remained enabled');
  return Object.fromEntries(servers.map(server => [server.name, { command: process.execPath, enabled: false }]));
}

export function disabledMcpConfig(binary: string, worktree: string, env: Record<string, string>, list: (overrides: string[]) => McpServer[] = overrides => listMcpServers(binary, worktree, env, overrides)) {
  const servers = list([]);
  if (servers.some(server => !/^[a-zA-Z0-9_-]+$/.test(server.name))) throw Error('Unsafe MCP server name in Codex configuration');
  if (servers.some(server => server.transport.type !== 'stdio')) throw Error('Unsupported MCP transport in Codex configuration');
  const overrides = servers.flatMap(server => [
    `mcp_servers.${server.name}.command=${JSON.stringify(process.execPath)}`,
    `mcp_servers.${server.name}.enabled=false`
  ]);
  const effective = list(overrides);
  if (effective.some(server => server.enabled)) throw Error('Codex MCP server remained enabled');
  return Object.fromEntries(servers.map(server => [server.name, { command: process.execPath, enabled: false }]));
}

function sandboxCommand(binary: string, worktree: string, code: string, env: Record<string, string>, signal: AbortSignal): Promise<number> {
  const args = [
    'sandbox', '-P', ':workspace', '-C', worktree,
    '-c', 'windows.sandbox="elevated"',
    '-c', 'sandbox_workspace_write.network_access=false',
    '-c', 'sandbox_workspace_write.writable_roots=[]',
    '-c', 'sandbox_workspace_write.exclude_tmpdir_env_var=true',
    '--', process.execPath, '-e', code
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: worktree, env, windowsHide: true, signal, stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', code => resolve(code ?? -1));
  });
}

export async function verifySandbox(binary: string, worktree: string, repository: string, env: Record<string, string>, signal: AbortSignal): Promise<void> {
  const inside = path.join(worktree, '.sandbox-probe');
  const outside = path.join(repository, `.sandbox-probe-${path.basename(worktree)}`);
  if (fs.existsSync(inside) || fs.existsSync(outside)) throw Error('Sandbox probe path already exists');
  try {
    const writeInside = `require('fs').writeFileSync(${JSON.stringify(inside)},'ok',{flag:'wx'})`;
    if (await sandboxCommand(binary, worktree, writeInside, env, signal) !== 0 || !fs.existsSync(inside)) throw Error('Codex sandbox cannot write in its worktree');
    const writeOutside = `require('fs').writeFileSync(${JSON.stringify(outside)},'unsafe',{flag:'wx'})`;
    if (await sandboxCommand(binary, worktree, writeOutside, env, signal) === 0 || fs.existsSync(outside)) throw Error('Codex sandbox can write outside its worktree');
  } finally {
    fs.rmSync(inside, { force: true });
    fs.rmSync(outside, { force: true });
  }
}
