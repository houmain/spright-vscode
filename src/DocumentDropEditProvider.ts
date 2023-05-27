import * as vscode from "vscode";
import * as common from "./common";
import * as utils from "./utils";

const uriListMime = "text/uri-list";

function importSpriteSheet(
  directory: vscode.Uri,
  toRelativePath: (uri: vscode.Uri) => string,
  json: any,
  indent: string
) {
  const levelIndent = indent[0] == "\t" ? "\t" : "  ";
  const indent1 = indent + levelIndent;
  const indent2 = indent1 + levelIndent;
  let snippet = "";

  const addFrame = function (filename: string, frame: any) {
    const rect = frame.frame;
    if (frame.rotated) {
      const t = rect.h;
      rect.h = rect.w;
      rect.w = t;
    }
    snippet += `${indent1}sprite "${filename}"` + "\n";
    snippet += `${indent2}rect ${rect.x} ${rect.y} ${rect.w} ${rect.h}` + "\n";
    const sss = frame?.spriteSourceSize;
    if (sss?.x && sss?.y) {
      snippet += `${indent2}align ${sss.x} ${sss.y}` + "\n";
    }
    const ss = frame?.sourceSize;
    if (ss?.w && ss?.h) {
      snippet += `${indent2}min-bounds ${ss.w} ${ss.h}` + "\n";
    }
  };
  const addFrames = function (frames: any) {
    if (frames[0]) {
      for (const frame of frames) {
        addFrame(frame.filename, frame);
      }
    } else {
      for (const [filename, frame] of Object.entries(frames) as [string, any]) {
        addFrame(filename, frame);
      }
    }
  };
  const resolve = (filename?: string) => {
    if (!filename) return "";
    return toRelativePath(vscode.Uri.joinPath(directory, filename));
  };

  if (json.frames) {
    // Phaser2 / PixiJS
    snippet += `${indent}input "${resolve(json.meta?.image)}"` + "\n";
    addFrames(json.frames);
  } else if (json.textures) {
    // Phaser3
    for (const texture of json.textures) {
      snippet += `${indent}input "${resolve(texture.image)}"` + "\n";
      addFrames(texture.frames);
    }
  } else {
    throw "unknown format";
  }
  return snippet;
}

function getInputIndent(
  document: vscode.TextDocument,
  position: vscode.Position
) {
  for (let i = position.line; i >= 0; --i) {
    const line = document.lineAt(i).text;
    if (line.trimStart().startsWith("input")) {
      return line.substring(0, line.length - line.trimStart().length);
    }
  }
  return "";
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

    const directory = common.getConfigLineDirectory(document, position).fsPath;
    const toRelativePath = (uri: vscode.Uri) => {
      return utils.relativePath(directory, uri.fsPath);
    };

    let snippet = "";

    let indent = getInputIndent(document, position);
    const lineStart = document
      .lineAt(position)
      .text.substring(0, position.character);
    if (lineStart.trim().length > 0) {
      snippet += "\n";
    } else {
      indent = indent.substring(0, indent.length - lineStart.length);
    }

    if (uris[0].fsPath.toLocaleLowerCase().endsWith(".json")) {
      try {
        const json = JSON.parse(await utils.readTextFile(uris[0].fsPath));
        snippet += importSpriteSheet(
          common.getDirectoryUri(uris[0]),
          toRelativePath,
          json,
          indent
        );
      } catch (ex) {
        vscode.window.showErrorMessage(`Importing sprites sheet failed: ` + ex);
      }
    } else {
      uris.forEach((uri) => {
        if (utils.directoryExist(uri.fsPath)) {
          snippet += `${indent}glob "${toRelativePath(uri)}/*.*"` + "\n";
        } else {
          snippet += `${indent}input "${toRelativePath(uri)}"` + "\n";
        }
      });
    }
    return { insertText: snippet };
  }
}
