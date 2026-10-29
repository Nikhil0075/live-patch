import ts from 'typescript';

export function mutationTitle(source: string): string | null {
  const tree = ts.createSourceFile('mutation.js', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  for (const statement of tree.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(item => item.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'meta' || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      const title = declaration.initializer.properties.find(item => ts.isPropertyAssignment(item) && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === 'title');
      if (!title || !ts.isPropertyAssignment(title) || !ts.isStringLiteralLike(title.initializer)) return null;
      return title.initializer.text.trim() || null;
    }
  }
  return null;
}
