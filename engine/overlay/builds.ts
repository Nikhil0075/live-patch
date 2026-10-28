import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GameManifest } from '../manifest/schema';
import type { IdeaStore } from '../pipeline/ideas';
import type { RunStore } from '../runner/store';

const safeText = (text: string) => text.replace(/[\r\n]+/g, ' ').slice(0, 220)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[\\`*_{}\[\]()#+.!|:]/g, char => `\\${char}`);

export function saveBuild(root: string, gameDirectory: string, manifest: GameManifest, ideas: IdeaStore, runs: RunStore) {
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const directory = path.join(root, 'builds', id);
  const game = path.join(directory, 'game');
  const mutationDir = path.resolve(gameDirectory, manifest.mutationDir);
  const shipped = runs.list().filter(run => run.gameDirectory === gameDirectory && run.status === 'shipped' && run.mutationName && /^patch-[a-f0-9]{12}\.js$/.test(run.mutationName) && fs.existsSync(path.join(mutationDir, run.mutationName)));
  const credits = shipped.map(run => {
    const idea = ideas.list().find(item => item.id === run.ideaId);
    return { file: run.mutationName!, idea: idea?.spec ?? idea?.text ?? 'Unknown idea', authors: idea?.contributors ?? (idea ? [idea.authorName] : []), ideaId: run.ideaId };
  });
  fs.mkdirSync(game, { recursive: true });
  try {
    fs.cpSync(gameDirectory, game, {
      recursive: true,
      filter: source => {
        if (source === gameDirectory) return true;
        const name = path.basename(source);
        if (name.startsWith('.') || ['node_modules', 'tests', 'dist', 'builds'].includes(name) || /^tokens\.json$|^ideas\.json$|^runs\.json$/.test(name)) return false;
        if (fs.lstatSync(source).isSymbolicLink()) throw Error('Game snapshot contains a symlink');
        return true;
      }
    });
    const copiedMutations = path.resolve(game, manifest.mutationDir);
    for (const name of fs.readdirSync(copiedMutations)) {
      if (!name.endsWith('.js')) continue;
      if (name.startsWith('patch-') && !credits.some(credit => credit.file === name)) fs.rmSync(path.join(copiedMutations, name));
    }
    const notes = [`# ${safeText(manifest.name)} — patch notes`, '', `Saved ${new Date().toISOString()}.`, '', ...credits.flatMap((credit, index) => [`## ${index + 1}. ${safeText(credit.idea)}`, '', `By ${credit.authors.map(author => `@${safeText(author)}`).join(', ') || 'unknown viewer'}`, '', `Module: \`${credit.file}\``, ''])];
    if (!credits.length) notes.push('No viewer patches had shipped yet.', '');
    fs.writeFileSync(path.join(directory, 'patch-notes.md'), notes.join('\n'));
    fs.writeFileSync(path.join(directory, 'build.json'), JSON.stringify({ id, game: manifest.name, createdAt: new Date().toISOString(), patches: credits }, null, 2));
    fs.writeFileSync(path.join(directory, 'README.md'), `# Saved Live Patch build\n\nThis snapshot is play-only. From the repository root, run \`npm run dev -- --game builds/${id}/game\` to play it. Return to the original game folder to build more patches.\n`);
    return { id, directory, patches: credits.length };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}
