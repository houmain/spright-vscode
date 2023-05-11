import * as vscode from 'vscode';
import { dirname, relative } from 'path';

const uriListMime = 'text/uri-list';

export class SprightDocumentDropEditProvider implements vscode.DocumentDropEditProvider {
  async provideDocumentDropEdits(
    document: vscode.TextDocument,
    _position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentDropEdit | undefined> {

    const dataTransferItem = dataTransfer.get(uriListMime);
    if (!dataTransferItem)
      return;

    const urlList = await dataTransferItem.asString();
    if (token.isCancellationRequested)
      return;

    const uris: vscode.Uri[] = [];
    for (const resource of urlList.split('\n')) {
      try {
        uris.push(vscode.Uri.parse(resource));
      } catch {
        // noop
      }
    }
    if (!uris.length)
      return;

    const snippet = new vscode.SnippetString();
    uris.forEach(uri => {
      const fileName = relative(dirname(document.fileName), uri.path);
      snippet.appendText(`input "${fileName}"`);
      snippet.appendText("\n");
    });
    return { insertText: snippet };
  }
}