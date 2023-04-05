import * as fs from "fs";
import * as vscode from "vscode";
import { Spright } from "./spright";
import * as util from "./util";

const platformSuffix = (() => {
  if (process.platform === "win32" && process.arch == "x64")
    return "win64";
    if (process.platform === "linux" && process.arch == "x64")
    return "Linux";
  return `${process.platform}-${process.arch}`;
})();

const sprightBinaryFilename = (process.platform === "win32" ? "spright.exe" : "spright");

export class SprightProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getDownloadURL(version: string) {
    return vscode.Uri.from({
      scheme: "https",
      authority: "github.com",
      path: `houmain/spright/releases/download/${version}/spright-${version}-${platformSuffix}.zip`,
    }).toString();
  }

  getStorageUri() {
    return this.context.storageUri
      ? this.context.storageUri
      : this.context.globalStorageUri;
  }

  getSprightDirectoryUri(version: string) {
    return vscode.Uri.joinPath(
      this.getStorageUri(),
      `spright-${version}-${platformSuffix}`
    );
  }

  getSprightBinaryPath(version: string) {
    return vscode.Uri.joinPath(
      this.getSprightDirectoryUri(version),
      sprightBinaryFilename
    ).fsPath;
  }

  async get(version: string): Promise<Spright> {
    const binaryPath = this.getSprightBinaryPath(version);
    if (!(await util.fileExists(binaryPath))) {
      await util.makeDirectory(this.getStorageUri().fsPath);
      const tempFilename = vscode.Uri.joinPath(this.getStorageUri(), ".temp").fsPath;
      await util.download(this.getDownloadURL(version), tempFilename);
      await util.extractZip(
        tempFilename,
        this.getStorageUri().fsPath
      );
    }
    return new Spright(binaryPath);
  }
}
