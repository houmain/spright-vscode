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

export async function updateDocument(document: vscode.TextDocument, config: string) {
  const current = document.getText();
  const lineSeparator = utils.getLineSeparator(current);
  const currentLines = current.split(lineSeparator);
  const configLines = utils.splitLines(config);
  const range = utils.getDifferingRange(currentLines, configLines);
  if (!range) return;
  const edit = new vscode.WorkspaceEdit();

  const prependNewline =
    !current.endsWith(lineSeparator) && range.first == currentLines.length;
  const appendNewline = range.last != currentLines.length && range.diff.length > 0;
  edit.replace(
    document.uri,
    new vscode.Range(range.first, 0, range.last, 0),
    (prependNewline ? lineSeparator : "") +
    range.diff.join(lineSeparator) +
    (appendNewline ? lineSeparator : "")
  );
  return vscode.workspace.applyEdit(edit);
}
