import * as vscode from "vscode";
import * as util from "./util";
import { SprightProvider } from "./sprightProvider";
import { Spright, Result } from "./spright";
import { Description } from "./web/Description";

async function openInTextEditor(filename: vscode.Uri, range?: vscode.Range) {
  const document = await vscode.workspace.openTextDocument(filename);
  return vscode.window.showTextDocument(document, {
    viewColumn:
      vscode.window.activeTextEditor?.document == document
        ? vscode.ViewColumn.Active
        : vscode.ViewColumn.Beside,
    selection: range ? new vscode.Selection(range.start, range.end) : undefined,
  });
}

class SprightEditor {
  private readonly context: vscode.ExtensionContext;
  private readonly webview: vscode.Webview;
  private readonly document: vscode.TextDocument;
  private readonly spright: Spright;
  private diagnosticsCollection?: vscode.DiagnosticCollection;
  private diagnostics: vscode.Diagnostic[] = [];
  private updatingWebview = false;
  private updateWebviewOnceMore = false;
  private describeOnlyInput = true;

  constructor(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    spright: Spright
  ) {
    this.context = context;
    this.document = document;
    this.webview = webviewPanel.webview;
    this.spright = spright;

    this.webview.options = {
      enableScripts: true,
    };
    this.webview.html = this.getHtmlForWebview();

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          this.updateWebviewDebounced();
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    this.webview.onDidReceiveMessage(async (e) => {
      switch (e.type) {
        case "refreshDescription":
          this.describeOnlyInput = e.describeOnlyInput;
          return this.updateWebview();

        case "autocomplete":
          return this.updateConfig(
            await this.getAutocompletedConfig(e.filename)
          );

        case "update":
          return this.updateOutput();

        case "openDocument":
          return openInTextEditor(this.document.uri);

        case "selectLine":
          return openInTextEditor(
            this.document.uri,
            new vscode.Range(e.lineNo, e.columnNo || 0, e.lineNo, 1000000)
          );
      }
    });

    if (vscode.window.activeTextEditor?.document == document) {
      this.showDiagnostics();
    }

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document == document) this.showDiagnostics();
      else this.hideDiagnostics();
    });
  }

  private updateWebviewDebounced() {
    if (this.updatingWebview) {
      this.updateWebviewOnceMore = true;
      return;
    }
    this.updatingWebview = true;
    setTimeout(async () => {
      await this.updateWebview();
      this.updatingWebview = false;
      if (this.updateWebviewOnceMore) {
        this.updateWebviewOnceMore = false;
        this.updateWebviewDebounced();
      }
    }, 450);
  }

  public async initialize() {
    await this.updateWebview();
  }

  private async getAutocompletedConfig(pattern?: string): Promise<string> {
    const result = await this.spright.autocompleteConfig(
      this.document.fileName,
      this.document.getText(),
      pattern
    );
    this.parseErrorOutput(result.stderr);
    return result.stdout;
  }

  private async updateOutput() {

    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Updating spright output"
    }, (progress, _token) => {
      progress.report({ message: "In progress" });

      return new Promise<void>(resolve => {
        this.spright.updateOutput(
          this.document.fileName,
          this.document.getText()
        ).then((result: Result) => {
          this.parseErrorOutput(result.stderr);
          switch (result.code) {
            case 0: progress.report({ increment: 100, message: "Succeeded" }); break;
            case 2: progress.report({ increment: 100, message: "Failed" }); break;
            case 1: progress.report({ increment: 100, message: "Completed with warnings" }); break;
          }
          setTimeout(() => {
            resolve();
          }, 4000);
        });
      });
    });
  }

  private async getDescription(config: string): Promise<Description> {
    const result = await this.spright.getDescription(
      this.document.fileName,
      config,
      this.describeOnlyInput
    );
    this.parseErrorOutput(result.stderr);
    if (result.stdout.length == 0)
      return {
        inputs: [],
        sources: [],
        sprites: [],
      };
    return JSON.parse(result.stdout);
  }

  private async updateWebview() {
    const config = util.toNewLineSeparators(this.document.getText());
    const description = await this.getDescription(config);

    const getUri = (path: string, filename: string) => {
      const uri = this.webview.asWebviewUri(
        vscode.Uri.joinPath(this.document.uri, "/../", path, filename)
      );
      return `${uri}`;
    };
    for (const source of description.sources)
      source.uri = getUri(source.path, source.filename);

    this.webview.postMessage({
      type: "setConfig",
      config,
      description,
    });
  }

  private parseErrorOutput(output: string) {
    this.diagnostics = [];
    for (const line of output.split(/[\n\r]+/)) {
      // "message in line N"
      const match = line.split(" in line ");
      const message = match[0];
      let range: vscode.Range;
      if (match.length > 1) {
        const lineNo = Number.parseInt(match[1]) - 1;
        const configLine = this.document.lineAt(lineNo);
        const sc = configLine.firstNonWhitespaceCharacterIndex;
        range = new vscode.Range(lineNo, sc, lineNo, configLine.text.length);
      } else {
        range = new vscode.Range(0, 0, 0, 0);
      }
      this.diagnostics.push({
        message,
        range: range,
        severity: vscode.DiagnosticSeverity.Error,
        source: "",
      });
    }
    this.updateDiagnostics();
  }

  private showDiagnostics() {
    if (!this.diagnosticsCollection)
      this.diagnosticsCollection =
        vscode.languages.createDiagnosticCollection("spright");
    this.updateDiagnostics();
  }

  private updateDiagnostics() {
    if (this.diagnosticsCollection)
      this.diagnosticsCollection.set(this.document.uri, this.diagnostics);
  }

  private hideDiagnostics() {
    if (this.diagnosticsCollection) {
      this.diagnosticsCollection.clear();
      delete this.diagnosticsCollection;
    }
  }

  private getHtmlForWebview(): string {
    const getWebviewPath = (path: string, file: string) => {
      return this.webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, path, file)
      );
    };
    const scriptUri = getWebviewPath("out/web", "webView.js");
    const styleResetUri = getWebviewPath("media", "reset.css");
    const styleVSCodeUri = getWebviewPath("media", "vscode.css");
    const styleMainUri = getWebviewPath("media", "webView.css");

    // Use a nonce to whitelist which scripts can be run
    const nonce = util.getNonce();
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.webview.cspSource}; style-src ${this.webview.cspSource}; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet" />
        <link href="${styleVSCodeUri}" rel="stylesheet" />
        <link href="${styleMainUri}" rel="stylesheet" />
        <title>Spright Configuration Editor</title>
      </head>
      <body>
        <div id="toolbar"></div>
        <div id="content"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  private updateConfig(config: string) {
    const current = this.document.getText();
    const lineSeparator = util.getLineSeparator(current);
    const currentLines = current.split(lineSeparator);
    const configLines = util.splitLines(config);
    const range = util.getDifferingRange(currentLines, configLines);
    if (!range) return;
    const edit = new vscode.WorkspaceEdit();

    const prependNewline =
      !current.endsWith(lineSeparator) && range.first == currentLines.length;
    const appendNewline = range.last != currentLines.length;
    edit.replace(
      this.document.uri,
      new vscode.Range(range.first, 0, range.last, 0),
      (prependNewline ? lineSeparator : "") +
        range.diff.join(lineSeparator) +
        (appendNewline ? lineSeparator : "")
    );
    return vscode.workspace.applyEdit(edit);
  }
}

export class SprightEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly sprightVersion: string
  ) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    try {
      const sprightProvider = new SprightProvider(this.context);
      const spright = await sprightProvider.getSpright(this.sprightVersion);
      return new SprightEditor(
        this.context,
        document,
        webviewPanel,
        spright
      ).initialize();
    } catch {
      webviewPanel.webview.html = `Downloading spright ${this.sprightVersion} for ${process.platform}/${process.arch} failed.`;
    }
  }
}
