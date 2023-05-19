import * as vscode from "vscode";
import { Settings, SettingsProvider } from "./SettingsProvider";
import { Spright } from "./Spright";
import * as utils from "./utils";

const platformSuffix = (() => {
  if (process.platform === "win32" && process.arch == "x64") return "win64";
  if (process.platform === "linux" && process.arch == "x64") return "Linux";
  return `${process.platform}-${process.arch}`;
})();

const sprightBinaryFilename =
  process.platform === "win32" ? "spright.exe" : "spright";
const sprightReadmeFilename = "README.md";

export class SprightProvider {
  constructor(
    readonly context: vscode.ExtensionContext,
    readonly settingsProvider: SettingsProvider
  ) {}

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

  private getSprightDirectoryUri(settings: Settings) {
    if (settings.sprightPath) {
      return vscode.Uri.file(settings.sprightPath);
    }
    return vscode.Uri.joinPath(
      this.getStorageUri(),
      `spright-${settings.sprightVersion}-${platformSuffix}`
    );
  }

  private getSprightFilename(settings: Settings, filename: string) {
    return vscode.Uri.joinPath(this.getSprightDirectoryUri(settings), filename)
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

  async getSpright(): Promise<Spright> {
    const settings = this.settingsProvider.get();
    const binaryPath = this.getSprightFilename(settings, sprightBinaryFilename);
    if (!(await utils.fileExists(binaryPath))) {
      await this.installSpright(settings.sprightVersion);
    }
    return new Spright(binaryPath);
  }

  async getReadme(): Promise<string> {
    const settings = this.settingsProvider.get();
    const readmePath = this.getSprightFilename(settings, sprightReadmeFilename);
    if (!(await utils.fileExists(readmePath))) {
      await this.installSpright(settings.sprightVersion);
    }
    return utils.readTextFile(readmePath);
  }
}
