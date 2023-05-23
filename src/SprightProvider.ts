import * as vscode from "vscode";
import { Settings, SettingsProvider } from "./SettingsProvider";
import { Spright } from "./Spright";
import * as utils from "./utils";

const platformSuffix = (() => {
  if (process.platform === "win32" && process.arch == "x64") return "win64";
  if (process.platform === "linux" && process.arch == "x64") return "Linux";
  if (process.platform === "darwin" && process.arch == "x64") return "Darwin";
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

  private async resolveSprightFilename(settings: Settings, filename: string) {
    const resolved = vscode.Uri.joinPath(
      this.getSprightDirectoryUri(settings),
      filename
    ).fsPath;
    if (!(await utils.fileExists(resolved))) {
      if (!settings.path) {
        await this.installSpright(settings.sprightVersion);
      }
      if (!(await utils.fileExists(resolved))) {
        throw "file not found";
      }
    }
    return resolved;
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
    const binaryPath = await this.resolveSprightFilename(
      settings,
      sprightBinaryFilename
    );
    return new Spright(binaryPath);
  }

  async getReadme(): Promise<string> {
    const settings = this.settingsProvider.get();
    const readmePath = await this.resolveSprightFilename(
      settings,
      sprightReadmeFilename
    );
    return utils.readTextFile(readmePath);
  }
}
