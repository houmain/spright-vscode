import * as vscode from "vscode";
import * as utils from "./utils";
import { dirname, relative } from "path";

const uriListMime = "text/uri-list";

function importSpriteSheet(json: any, indent: string, defaultIndent: string) {
  const indent1 = indent + defaultIndent;
  const indent2 = indent1 + defaultIndent;
  let snippet = "";

  const addFrame = function(filename: string, frame: any, rotated?: boolean) {
    if (rotated) {
      const t = frame.h;
      frame.h = frame.w;
      frame.w = t;
    }
    snippet += `${indent1}sprite "${filename}"` + "\n";
    snippet += `${indent2}rect ${frame.x} ${frame.y} ${frame.w} ${frame.h}` + "\n";
  };
  const addFrames = function(frames: any) {
    if (frames[0]) {
      for (const frame of frames)
        addFrame(frame.filename, frame.frame, frame.rotated);
    }
    else {
      for (const [filename, frame] of Object.entries(frames) as [string, any])
        addFrame(filename, frame.frame, frame.rotated);
    }
  };

  // Phaser2 / PixiJS
  if (json.frames) {
    snippet += `${indent}input "${json.meta?.image}"` + "\n";
    addFrames(json.frames);
  }
  // Phaser3
  else if (json.textures) {
    for (const texture of json.textures) {
      snippet += `${indent}input "${texture.image}"` + "\n";
      addFrames(texture.frames);
    }
  }
  else {
    throw "unknown format";
  }
  return snippet;
}

export class DocumentDropEditProvider
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
    for (const resource of utils.toNewLineSeparators(urlList).split("\n")) {
      try {
        uris.push(vscode.Uri.parse(resource));
      } catch {
        // noop
      }
    }
    if (!uris.length) return;

    const indent = this.getIndent(document, position);
    const defaultIndent = (indent[0] == "\t" ? "\t" : "  ");

    let snippet = "";
    if (uris[0].fsPath.toLocaleLowerCase().endsWith(".json")) {
      try {
        const json = JSON.parse(await utils.readTextFile(uris[0].fsPath));
        snippet += importSpriteSheet(json, indent, defaultIndent);
      }
      catch (ex) {
        vscode.window.showErrorMessage(
          `Importing sprites sheet failed: ` + ex
        );
      }
    }
    else {
      uris.forEach((uri) => {
        const fileName = relative(dirname(document.fileName), uri.fsPath);
        snippet += `${indent}input "${fileName}"` + "\n";
      });
    }
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
