import * as vscode from "vscode";
import * as utils from "./utils";
import { Description } from "./web/Description";
import { ActiveDocument, ActiveDocumentChangeEvent } from "./ActiveDocument";

function getHtmlForWebview(
  extensionUri: vscode.Uri,
  webview: vscode.Webview
): string {
  const getWebviewPath = (path: string, file: string) => {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, path, file));
  };
  const scriptUri = getWebviewPath("out/web", "webView.js");
  const styleResetUri = getWebviewPath("media", "reset.css");
  const styleVSCodeUri = getWebviewPath("media", "vscode.css");
  const styleMainUri = getWebviewPath("media", "webView.css");

  // Use a nonce to whitelist which scripts can be run
  const nonce = utils.getNonce();
  return `
    <!DOCTYPE html>
    <html lang="en" data-vscode-context='{ "webviewSection": "html", "preventDefaultContextMenuItems": true }'>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="${styleResetUri}" rel="stylesheet" />
      <link href="${styleVSCodeUri}" rel="stylesheet" />
      <link href="${styleMainUri}" rel="stylesheet" />
      <title>Spright Configuration Editor</title>
    </head>
    <body>
      <div id="toolbar" data-vscode-context='{ "webviewSection": "toolbar" }'></div>
      <div id="content" data-vscode-context='{ "webviewSection": "content" }'></div>
      <div id="properties" data-vscode-context='{ "webviewSection": "properties" }'></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

export class EditorPanel {
  private static instance?: EditorPanel;

  private readonly webviewPanel: vscode.WebviewPanel;

  public static createOrShow(
    context: vscode.ExtensionContext,
    activeDocument: ActiveDocument
  ) {
    if (this.instance) {
      this.instance.webviewPanel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }
    this.instance = new this(context, activeDocument);
  }

  private constructor(
    context: vscode.ExtensionContext,
    private activeDocument: ActiveDocument
  ) {
    this.webviewPanel = vscode.window.createWebviewPanel(
      "spright.editor",
      "Spright Editor",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {
        enableScripts: true,
      }
    );
    this.webviewPanel.webview.html = getHtmlForWebview(
      context.extensionUri,
      this.webviewPanel.webview
    );

    this.webviewPanel.webview.onDidReceiveMessage(async (e) => {
      switch (e.type) {
        case "initialized":
          return this.onWebviewInitialized();

        case "refreshDescription":
          this.activeDocument.describeOnlyInput = e.describeOnlyInput;
          return this.activeDocument.validate();

        case "autocomplete":
          return this.activeDocument.autocompleteConfig(e.pattern);

        case "build":
          return this.activeDocument.buildOutput();

        case "updateConfig":
          return this.activeDocument.updateDocument(e.config);

        case "openDocument":
          return this.activeDocument.reveal();

        case "selectLine":
          return this.activeDocument.reveal(
            new vscode.Range(e.lineNo, e.columnNo || 0, e.lineNo, 1000000)
          );
      }
    });
  }

  onWebviewInitialized() {
    const activeDocumentChangedSubscription = this.activeDocument.onChanged(
      this.onActiveDocumentChanged.bind(this)
    );

    this.webviewPanel.onDidDispose(() => {
      activeDocumentChangedSubscription.dispose();
      EditorPanel.instance = undefined;
    });
  }

  onActiveDocumentChanged(event: ActiveDocumentChangeEvent) {
    this.updateWebview(event.document, event.description, event.config);
  }

  private async updateWebview(
    document: vscode.TextDocument,
    description: Description,
    config: string
  ) {
    const getUri = (path: string, filename: string) => {
      const uri = this.webviewPanel.webview.asWebviewUri(
        vscode.Uri.joinPath(document.uri, "/../", path, filename)
      );
      return `${uri}`;
    };
    for (const source of description.sources)
      source.uri = getUri(source.path, source.filename);

    this.webviewPanel.webview.postMessage({
      type: "setConfig",
      config,
      description,
    });
  }
}
