import path from "path";
import * as vscode from "vscode";
import * as utils from "./utils";

export function getDirectoryUri(uri: vscode.Uri) {
  return vscode.Uri.file(path.dirname(uri.fsPath));
}

function getPath(document: vscode.TextDocument, position: vscode.Position) {
  for (let i = position.line; i >= 0; --i) {
    const line = document.lineAt(i).text.trim();
    if (line.startsWith("path")) {
      return utils.removeQuotes(utils.removeComments(line.substring(4).trim()));
    }
  }
  return "";
}

export function getConfigLineDirectory(
  document: vscode.TextDocument,
  position: vscode.Position
) {
  return vscode.Uri.joinPath(
    getDirectoryUri(document.uri),
    getPath(document, position)
  );
}
