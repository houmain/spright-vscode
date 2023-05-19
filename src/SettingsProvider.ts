import * as util from "./util";
import * as vscode from "vscode";

export type Settings = {
  sprightVersion: string;
  sprightPath?: string;
  template?: string;
};

export class SettingsProvider {
  private settings: Settings = {
    sprightVersion: "",
  };
  private filename = ".vscode/spright.json";
  private onChanged = new vscode.EventEmitter<Settings>();

  constructor() {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("spright")) this.reload();
    });
    this.reload();
  }

  async reload() {
    const config = vscode.workspace.getConfiguration("spright");
    this.settings.sprightVersion = (await config.get("sprightVersion")) ?? "";
    this.settings.sprightPath = await config.get("sprightPath");
    if (this.settings.sprightPath && this.settings.sprightPath.length == 0)
      delete this.settings.sprightPath;
    this.onChanged.fire(this.settings);
  }

  async replace(settings: Settings) {
    this.settings = settings;
    const json = JSON.stringify(this.settings, undefined, 2);
    return util.writeTextFile(this.filename, json);
  }

  onSettingsChanged(listener: (settings: Settings) => void) {
    listener(this.settings);
    return this.onChanged.event(listener);
  }
}
