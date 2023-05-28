import * as vscode from "vscode";
import * as common from "./common";
import * as utils from "./utils";
import { Description, Texture } from "./web/Description";

const uriListMime = "text/uri-list";

function accessible(test: () => void) {
  try {
    return test() !== undefined;
  } catch {
    return false;
  }
}

function getIndents(indent: string) {
  const levelIndent = indent[0] == "\t" ? "\t" : "  ";
  const indent1 = indent + levelIndent;
  const indent2 = indent1 + levelIndent;
  const indent3 = indent2 + levelIndent;
  return [indent1, indent2, indent3];
}

function isSprightDescription(json: any) {
  return accessible(() => json.sources[json.sprites[0].sourceIndex].filename);
}

function importSprightDescription(
  desc: Description,
  directory: vscode.Uri,
  toRelativePath: (uri: vscode.Uri) => string,
  indent: string
) {
  const [indent1, indent2, indent3] = getIndents(indent);

  let snippet = "";
  const addLine = (line?: string) => {
    snippet += (line ?? "") + "\n";
  };
  const resolve = (filename?: string) => {
    if (!filename) return "";
    return toRelativePath(vscode.Uri.joinPath(directory, filename));
  };

  const sliceTextureFilenames: string[] = [];
  for (const texture of desc.textures)
    if (!sliceTextureFilenames[texture.sliceIndex] && texture.scale == 1)
      sliceTextureFilenames[texture.sliceIndex] = texture.filename;
  for (const texture of desc.textures)
    if (!sliceTextureFilenames[texture.sliceIndex])
      throw "Cannot import when output was scaled";

  let sourceIndex = 0;
  addLine(`${indent}pack origin`);
  for (const source of desc.sources) {
    addLine(`${indent}sheet "sheet${sourceIndex}"`);
    addLine(`${indent1}output "${source.filename}"`);
    addLine(`${indent1}min-bounds ${source.width} ${source.height}`);
    let prevInputFilename = "";
    for (const input of desc.inputs) {
      for (const inputSource of input.sources) {
        if (inputSource.index == sourceIndex) {
          for (const spriteIndex of inputSource.spriteIndices) {
            const sprite = desc.sprites[spriteIndex];
            const inputFilename = sliceTextureFilenames[sprite.sliceIndex!];
            if (inputFilename != prevInputFilename) {
              addLine(`${indent1}input "${resolve(inputFilename)}"`);
              prevInputFilename = inputFilename;
            }
            addLine(`${indent2}sprite`);
            const r = sprite.trimmedRect!;
            const sr = sprite.trimmedSourceRect!;
            if (sprite.rotated) {
              [r.w, r.h] = [r.h, r.w];
              [sr.x, sr.y] = [sr.y, sr.x];
              addLine(`${indent3}min-bounds ${source.height} ${source.width}`);
            }
            addLine(`${indent3}rect ${r.x} ${r.y} ${r.w} ${r.h}`);
            addLine(`${indent3}align ${sr.x} ${sr.y}`);
          }
        }
      }
    }
    addLine();
    ++sourceIndex;
  }
  return snippet;
}

// Phaser2 / Phaser3 / PixiJS
function isPhaserJSON(json: any) {
  return (
    accessible(() => json.frames[0].frame) ||
    accessible(() => json.frames[Object.keys(json.frames)[0]].frame) ||
    accessible(() => json.textures[0].frames[0])
  );
}

function importPhaserJSON(
  json: any,
  directory: vscode.Uri,
  toRelativePath: (uri: vscode.Uri) => string,
  indent: string
) {
  const [indent1, indent2] = getIndents(indent);

  let snippet = "";
  const addLine = (line?: string) => {
    snippet += (line ?? "") + "\n";
  };
  const addFrame = function (filename: string, frame: any) {
    addLine(`${indent1}sprite "${filename}"`);
    const f = frame.frame ?? {};
    const sss = frame.spriteSourceSize ?? {};
    const ss = frame.sourceSize ?? {};
    if (frame.rotated) {
      [f.w, f.h] = [f.h, f.w];
      [sss.x, sss.y] = [sss.y, sss.x];
      [ss.w, ss.h] = [ss.h, ss.w];
    }
    addLine(`${indent2}rect ${f.x} ${f.y} ${f.w} ${f.h}`);
    if (ss.w && ss.h) addLine(`${indent2}min-bounds ${ss.w} ${ss.h}`);
    if (sss.x && sss.y) addLine(`${indent2}align ${sss.x} ${sss.y}`);
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

  addLine(`pack single`);
  addLine(`output "{{ sprite.id }}"`);
  addLine();
  if (json.textures) {
    for (const texture of json.textures) {
      addLine(`${indent}input "${resolve(texture.image)}"`);
      addFrames(texture.frames);
    }
  } else {
    addLine(`${indent}input "${resolve(json.meta?.image)}"`);
    addFrames(json.frames);
  }
  return snippet;
}

function importJSON(
  json: any,
  directory: vscode.Uri,
  toRelativePath: (uri: vscode.Uri) => string,
  indent: string
) {
  if (isSprightDescription(json))
    return importSprightDescription(json, directory, toRelativePath, indent);

  if (isPhaserJSON(json))
    return importPhaserJSON(json, directory, toRelativePath, indent);

  throw "Unknown format";
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
        snippet += importJSON(
          JSON.parse(await utils.readTextFile(uris[0].fsPath)),
          common.getDirectoryUri(uris[0]),
          toRelativePath,
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
