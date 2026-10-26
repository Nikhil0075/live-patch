import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { defaultGame, loadGame } from '../engine/manifest/load';
import { validateMutation } from '../engine/mutation/validate';

const root = process.cwd();
const gamePath = process.env.LIVE_PATCH_GAME || defaultGame(root);
describe('platform contract', () => {
  it('loads the active game through its manifest', () => {
    const { manifest } = loadGame(root, gamePath);
    expect(manifest.name).toBe('Arena Survivor');
    expect(manifest.mutationDir).toBe('mutations/');
  });
  it('rejects missing and invalid manifests with clear errors', () => {
    expect(() => loadGame(root, 'games/no-such-game')).toThrow(/Missing game manifest/);
    const temp = fs.mkdtempSync(path.join(root, '.test-manifest-'));
    try { fs.writeFileSync(path.join(temp, 'live-patch.json'), '{}'); expect(() => loadGame(root, temp)).toThrow(/Invalid game manifest/); }
    finally { fs.rmSync(temp, { recursive: true, force: true }); }
  });
  it('keeps the engine independent of games', () => {
    function walk(dir: string): string[] { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
    for (const file of [...walk(path.join(root, 'engine')).filter(f => f.endsWith('.ts')), path.join(root, 'vite.config.ts')]) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
      const visit = (node: ts.Node) => {
        let specifier: string | undefined;
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
        if (ts.isCallExpression(node) && node.arguments.length && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require') && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) specifier = node.arguments[0].text;
        if (ts.isCallExpression(node) && node.arguments.length && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require') && ts.isTemplateExpression(node.arguments[0])) specifier = node.arguments[0].head.text;
        if (specifier?.startsWith('.')) {
          const target = path.resolve(path.dirname(file), specifier);
          const gamesRoot = path.join(root, 'games');
          expect(target === gamesRoot || target.startsWith(gamesRoot + path.sep), file).toBe(false);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  });
  it('blocks direct browser and network access in mutation source', () => {
    const { manifest } = loadGame(root, gamePath);
    expect(validateMutation('export const meta = {}; fetch("https://bad.example")', manifest)).toMatch(/Forbidden/);
    expect(validateMutation('export const meta = {}; import("/x.js")', manifest)).toMatch(/Forbidden/);
    expect(validateMutation('export const meta = { description: "Coins become more important to a medieval knight" };', manifest)).toBeNull();
    expect(validateMutation('export const meta = {}; parent.frames[0].postMessage({})', manifest)).toMatch(/Forbidden/);
    expect(validateMutation('export const meta = {}; const s = `ok ${0}`; fetch("/escape")', manifest)).toMatch(/Forbidden token: fetch/);
    expect(validateMutation('export const meta = { description: `top self frames ${0}` }; let frames = 0; frames++;', manifest)).toBeNull();
    expect(validateMutation('export const meta = {}; const obj = { top: 1, self: 2 }; obj.top;', manifest)).toBeNull();
  });
  it('rejects example paths that escape the game folder', () => {
    const source = path.resolve(root, gamePath);
    const temp = fs.mkdtempSync(path.join(root, '.test-manifest-'));
    try {
      fs.cpSync(source, temp, { recursive: true });
      const file = path.join(temp, 'live-patch.json');
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { examples: string[] };
      data.examples = ['../']; fs.writeFileSync(file, JSON.stringify(data));
      expect(() => loadGame(root, temp)).toThrow(/example escapes/);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  });
});
