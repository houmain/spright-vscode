import * as vscode from "vscode";
import { Spright } from "./spright";
import * as util from "./util";

const platformSuffix = (() => {
  if (process.platform === "win32" && process.arch == "x64") return "win64";
  if (process.platform === "linux" && process.arch == "x64") return "Linux";
  return `${process.platform}-${process.arch}`;
})();

const sprightBinaryFilename =
  process.platform === "win32" ? "spright.exe" : "spright";
const sprightReadmeFilename = "README.md";

export class SprightProvider {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  private getDownloadURL(version: string) {
    return vscode.Uri.from({
      scheme: "https",
      authority: "github.com",
      path: `houmain/spright/releases/download/${version}/spright-${version}-${platformSuffix}.zip`,
    }).toString();
  }

  private getStorageUri() {
    return this.context.storageUri
      ? this.context.storageUri
      : this.context.globalStorageUri;
  }

  private getSprightDirectoryUri(version: string) {
    return vscode.Uri.joinPath(
      this.getStorageUri(),
      `spright-${version}-${platformSuffix}`
    );
  }

  private getSprightFilename(version: string, filename: string) {
    return vscode.Uri.joinPath(this.getSprightDirectoryUri(version), filename)
      .fsPath;
  }

  private async installSpright(version: string) {
    await util.makeDirectory(this.getStorageUri().fsPath);
    const tempFilename = vscode.Uri.joinPath(
      this.getStorageUri(),
      ".temp"
    ).fsPath;
    await util.download(this.getDownloadURL(version), tempFilename);
    await util.extractZip(tempFilename, this.getStorageUri().fsPath);
  }

  async getSpright(version: string): Promise<Spright> {
    const binaryPath = this.getSprightFilename(version, sprightBinaryFilename);
    if (!(await util.fileExists(binaryPath))) {
      await this.installSpright(version);
    }
    return new Spright(binaryPath);
  }

  async getReadme(version: string): Promise<string> {
    const readmePath = this.getSprightFilename(version, sprightReadmeFilename);
    if (!(await util.fileExists(readmePath))) {
      await this.installSpright(version);
    }
    return util.readTextFile(readmePath);
  }
}
