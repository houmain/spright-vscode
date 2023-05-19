import * as vscode from "vscode";
import { Spright } from "./Spright";
import * as utils from "./utils";

export type SprightLocator = {
  version: string;
  path?: string;
};

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

  private getSprightDirectoryUri(locator: SprightLocator) {
    if (locator.path) {
      return vscode.Uri.file(locator.path);
    }
    return vscode.Uri.joinPath(
      this.getStorageUri(),
      `spright-${locator.version}-${platformSuffix}`
    );
  }

  private getSprightFilename(locator: SprightLocator, filename: string) {
    return vscode.Uri.joinPath(this.getSprightDirectoryUri(locator), filename)
      .fsPath;
  }

  private async installSpright(version: string) {
    await utils.makeDirectory(this.getStorageUri().fsPath);
    const tempFilename = vscode.Uri.joinPath(
      this.getStorageUri(),
      ".temp"
    ).fsPath;
    await utils.download(this.getDownloadURL(version), tempFilename);
    await utils.extractZip(tempFilename, this.getStorageUri().fsPath);
  }

  async getSpright(locator: SprightLocator): Promise<Spright> {
    const binaryPath = this.getSprightFilename(locator, sprightBinaryFilename);
    if (!(await utils.fileExists(binaryPath))) {
      await this.installSpright(locator.version);
    }
    return new Spright(binaryPath);
  }

  async getReadme(locator: SprightLocator): Promise<string> {
    const readmePath = this.getSprightFilename(locator, sprightReadmeFilename);
    if (!(await utils.fileExists(readmePath))) {
      await this.installSpright(locator.version);
    }
    return utils.readTextFile(readmePath);
  }
}
