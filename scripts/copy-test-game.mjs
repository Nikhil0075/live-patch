import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function copyTestGame(root, source, target, mutationDir, selected, smoke = false) {
  const mutations = path.resolve(source, mutationDir);
  const relativeGame = path.relative(root, source);
  if (smoke || relativeGame.startsWith('..') || path.isAbsolute(relativeGame)) {
    console.log(`Test game copy: ${smoke ? 'smoke with active mutations' : 'external game with active mutations'}`);
    fs.cpSync(source, target, { recursive: true });
    return;
  }
  const prefix = path.relative(root, mutations).replaceAll('\\', '/') + '/';
  let tracked;
  try {
    tracked = new Set(execFileSync('git', ['ls-files', '--cached', '--', prefix], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).filter(Boolean).map(file => path.basename(file)));
    if (selected) tracked.add(path.basename(selected));
    console.log('Test game copy: Git-tracked built-in mutations');
  } catch {
    console.log('Test game copy: no Git index; excluding generated demo and patch modules');
  }
  fs.cpSync(source, target, { recursive: true, filter: file => {
    const relative = path.relative(mutations, file);
    return relative === '' || relative.startsWith('..') || (!relative.includes(path.sep) && (tracked ? tracked.has(relative) : !/^(?:demo|patch)-[^/\\]+\.js$/i.test(relative)));
  } });
}
