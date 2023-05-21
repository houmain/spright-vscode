import * as vscode from "vscode";

export type Settings = {
  sprightVersion: string;
  sprightPath?: string;
  output?: string;
  template?: string;
  path?: string;
};

function emptyToUndefined(value?: string) {
  if (value && value.length > 0) return value;
  return undefined;
}

export class SettingsProvider {
  private settings: Settings = {
    sprightVersion: "",
  };
  private onChangedEmitter = new vscode.EventEmitter<Settings>();

  constructor() {
    this.reload();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("spright")) this.reload();
    });
  }

  reload() {
    const config = vscode.workspace.getConfiguration("spright");
    this.settings.sprightVersion = config.get("sprightVersion") ?? "";
    this.settings.sprightPath = emptyToUndefined(config.get("sprightPath"));
    this.settings.output = emptyToUndefined(config.get("output"));
    this.settings.template = emptyToUndefined(config.get("template"));
    this.settings.path = emptyToUndefined(config.get("path"));
    this.onChangedEmitter.fire(this.settings);
  }

  get() {
    return this.settings;
  }

  onSettingsChanged(listener: (settings: Settings) => void) {
    listener(this.settings);
    return this.onChangedEmitter.event(listener);
  }
}
