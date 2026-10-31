import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function copyTestGame(root, source, target, mutationDir, selected, smoke = false) {
  const mutations = path.resolve(source, mutationDir);
  const relativeGame = path.relative(root, source);
  if (smoke || relativeGame.startsWith('..') || path.isAbsolute(relativeGame)) {
    fs.cpSync(source, target, { recursive: true });
    return;
  }
  const prefix = path.relative(root, mutations).replaceAll('\\', '/') + '/';
  const tracked = new Set(execFileSync('git', ['ls-files', '--cached', '--', prefix], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean).map(file => path.basename(file)));
  if (selected) tracked.add(path.basename(selected));
  fs.cpSync(source, target, { recursive: true, filter: file => {
    const relative = path.relative(mutations, file);
    return relative === '' || relative.startsWith('..') || (!relative.includes(path.sep) && tracked.has(relative));
  } });
}
