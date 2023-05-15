import * as vscode from "vscode";
import { dirname, relative } from "path";

const uriListMime = "text/uri-list";

export class SprightDocumentDropEditProvider
  implements vscode.DocumentDropEditProvider
{
  async provideDocumentDropEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentDropEdit | undefined> {
    const dataTransferItem = dataTransfer.get(uriListMime);
    if (!dataTransferItem) return;

    const urlList = await dataTransferItem.asString();
    if (token.isCancellationRequested) return;

    const uris: vscode.Uri[] = [];
    for (const resource of urlList.split("\n")) {
      try {
        uris.push(vscode.Uri.parse(resource));
      } catch {
        // noop
      }
    }
    if (!uris.length) return;

    const indent = this.getIndent(document, position);

    const snippet = new vscode.SnippetString();
    uris.forEach((uri) => {
      const fileName = relative(dirname(document.fileName), uri.fsPath);
      snippet.appendText(`${indent}input "${fileName}"`);
      snippet.appendText("\n");
    });
    return { insertText: snippet };
  }

  private getIndent(document: vscode.TextDocument, position: vscode.Position) {
    for (let i = position.line; i >= 0; --i) {
      const line = document.lineAt(i).text;
      if (line.trimStart().startsWith("input"))
        return line.substring(0, line.length - line.trimStart().length);
    }
    return "";
  }
}
