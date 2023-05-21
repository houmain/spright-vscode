import * as vscode from "vscode";

type Scope = {
  symbol: vscode.DocumentSymbol;
  level: number;
};

function getSymbolKind(definition: string): vscode.SymbolKind | undefined {
  switch (definition) {
    case "path":
      return vscode.SymbolKind.Function;
    case "glob":
      return vscode.SymbolKind.Function;
    case "input":
      return vscode.SymbolKind.Field;
    case "output":
      return vscode.SymbolKind.Function;
    case "sheet":
      return vscode.SymbolKind.Variable;
    case "description":
      return vscode.SymbolKind.Function;
    case "group":
      return vscode.SymbolKind.Package;
  }
}

export class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentSymbol[]> {
    return new Promise((resolve, reject) => {
      const symbols: vscode.DocumentSymbol[] = [];
      const nodes = [symbols];

      const scopes: Scope[] = [];
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const parts = line.text.match("(\\s*)([a-z][a-z\\-]*)\\s*(.*)");
        if (!parts) continue;
        const level = parts[1].length;
        const definition = parts[2];
        const args = parts[3];
        const symbolKind = getSymbolKind(definition);
        if (symbolKind) {
          const symbol = new vscode.DocumentSymbol(
            definition,
            args,
            symbolKind,
            line.range,
            line.range
          );

          while (
            scopes.length > 0 &&
            scopes[scopes.length - 1].level >= level
          ) {
            scopes.pop();
          }
          if (scopes.length > 0) {
            scopes[scopes.length - 1].symbol.children.push(symbol);
          } else {
            nodes[nodes.length - 1].push(symbol);
          }
          scopes.push({
            symbol,
            level,
          });
        }
      }
      resolve(symbols);
    });
  }
}
