import * as vscode from "vscode";
import { SettingsProvider, Settings } from "./SettingsProvider";
import { SprightProvider } from "./SprightProvider";
import { Spright } from "./Spright";
import { DocumentValidator } from "./DocumentValidator";
import { Description } from "./web/Description";

export type ActiveDocumentChangeEvent = {
  document: vscode.TextDocument;
  description: Description;
  config: string;
};

export class ActiveDocument {
  private onChangedEmitter =
    new vscode.EventEmitter<ActiveDocumentChangeEvent>();
  private lastChangeEvent?: ActiveDocumentChangeEvent;
  private spright?: Spright;
  private settings: Settings;
  private diagnosticsCollection: vscode.DiagnosticCollection;
  private documentValidators = new Map<vscode.Uri, DocumentValidator>();
  private validating = false;
  private validateOnceMore = false;
  private viewColumn?: vscode.ViewColumn;

  document?: vscode.TextDocument;
  describeOnlyInput = true;

  constructor(
    private sprightProvider: SprightProvider,
    settingsProvider: SettingsProvider
  ) {
    this.diagnosticsCollection =
      vscode.languages.createDiagnosticCollection("spright");

    this.settings = settingsProvider.get();
    settingsProvider.onSettingsChanged(this.updateSettings.bind(this));

    vscode.window.onDidChangeActiveTextEditor(
      this.onActiveTextEditorChanged.bind(this)
    );
    this.onActiveTextEditorChanged(vscode.window.activeTextEditor);

    vscode.workspace.onDidChangeTextDocument(
      (event: vscode.TextDocumentChangeEvent) => {
        if (event.document && event.document == this.document) {
          this.validateDebounced();
        }
      }
    );
  }

  private onActiveTextEditorChanged(editor?: vscode.TextEditor) {
    if (editor?.document.languageId == "spright") {
      this.viewColumn = editor.viewColumn;
      this.document = editor.document;
      this.validate();
    }
  }

  private async updateSettings(settings: Settings) {
    try {
      this.spright = await this.sprightProvider.getSpright();
    } catch {
      if (settings.sprightPath) {
        vscode.window.showErrorMessage(
          `Loading spright from '${settings.sprightPath}' failed.`
        );
      } else {
        vscode.window.showErrorMessage(
          `Downloading spright ${settings.sprightVersion} for ${process.platform}/${process.arch} failed.`
        );
      }
    }
    this.validateDebounced();
  }

  onChanged(listener: (event: ActiveDocumentChangeEvent) => void) {
    if (this.lastChangeEvent) {
      listener(this.lastChangeEvent);
    }
    return this.onChangedEmitter.event(listener);
  }

  validateDebounced() {
    if (this.validating) {
      this.validateOnceMore = true;
      return;
    }
    this.validating = true;
    setTimeout(async () => {
      await this.validate();
      this.validating = false;
      if (this.validateOnceMore) {
        this.validateOnceMore = false;
        this.validateDebounced();
      }
    }, 450);
  }

  private cleanupValidators() {
    const keys = this.documentValidators.keys();
    for (const key of keys) {
      if (this.documentValidators.get(key)?.document.isClosed)
        this.documentValidators.delete(key);
    }
  }

  private getValidator(document: vscode.TextDocument) {
    let validator = this.documentValidators.get(document.uri);
    if (!validator) {
      validator = new DocumentValidator(document);
      this.documentValidators.set(document.uri, validator);
    }
    return validator;
  }

  async validate() {
    if (this.spright && this.document) {
      const validator = this.getValidator(this.document);
      await validator.getDescription(this.spright, this.describeOnlyInput);
      this.updateDiagnostics(validator);
      this.fireChange(this.document);
    }
    this.cleanupValidators();
  }

  private updateDiagnostics(validator: DocumentValidator) {
    this.diagnosticsCollection.clear();
    this.diagnosticsCollection.set(
      validator.document.uri,
      validator.diagnostics
    );
  }

  private fireChange(document: vscode.TextDocument) {
    const validator = this.getValidator(document);
    this.lastChangeEvent = {
      document,
      description: validator.description,
      config: validator.config,
    };
    this.onChangedEmitter.fire(this.lastChangeEvent);
  }

  async autocompleteConfig(pattern?: string) {
    if (this.document && this.spright) {
      const validator = this.getValidator(this.document);
      await validator.autocompleteConfig(this.spright, pattern);
      this.updateDiagnostics(validator);
    }
  }

  async updateOutput() {
    if (this.document && this.spright) {
      const validator = this.getValidator(this.document);
      await validator.updateOutput(this.spright, this.settings);
      this.updateDiagnostics(validator);
    }
  }

  async reveal(range?: vscode.Range) {
    if (!this.document) return;
    const selection = range
      ? new vscode.Selection(range.start, range.end)
      : undefined;
    return vscode.window.showTextDocument(this.document, {
      selection: selection,
      viewColumn: this.viewColumn,
    });
  }
}
