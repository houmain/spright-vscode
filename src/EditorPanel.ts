import * as vscode from "vscode";
import * as utils from "./utils";
import { Description } from "./web/Description";
import { ActiveDocument, ActiveDocumentChangeEvent } from "./ActiveDocument";
import { getPreviewStorageUri } from "./extension";

function getHtmlForWebview(
  editorType: EditorType,
  extensionUri: vscode.Uri,
  webview: vscode.Webview
): string {
  const getWebviewPath = (path: string, file: string) => {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, path, file));
  };
  const scriptUri = getWebviewPath("out/web", "EditorWebview.js");
  const styleResetUri = getWebviewPath("media", "reset.css");
  const styleVSCodeUri = getWebviewPath("media", "vscode.css");
  const styleWebviewUri = getWebviewPath("media", "EditorWebview.css");

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
      <link href="${styleWebviewUri}" rel="stylesheet" />
      <title>Spright Configuration Editor</title>
    </head>
    <body data-editor-type="${editorType}">
      <div id="toolbar" data-vscode-context='{ "webviewSection": "toolbar" }'></div>
      <div id="content" data-vscode-context='{ "webviewSection": "content" }'></div>
      <div id="properties" data-vscode-context='{ "webviewSection": "properties" }'></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

export enum EditorType {
  Input,
  Output,
}

export class EditorPanel {
  private static instances: any = [];

  private readonly webviewPanel: vscode.WebviewPanel;
  private activeDocumentChangedSubscription: vscode.Disposable | undefined;

  public static createOrShow(
    context: vscode.ExtensionContext,
    activeDocument: ActiveDocument,
    editorType: EditorType,
  ) {
    if (EditorPanel.instances[editorType]) {
      EditorPanel.instances[editorType].webviewPanel.reveal(undefined, true);
      return;
    }
    EditorPanel.instances[editorType] = new this(context, activeDocument, editorType);
  }

  private constructor(
    private context: vscode.ExtensionContext,
    private activeDocument: ActiveDocument,
    private editorType: EditorType
  ) {
    const resourceRoots: vscode.Uri[] = [
      context.extensionUri,
      getPreviewStorageUri(context)
    ];
    if (vscode.workspace.workspaceFolders)
      for (const folder of vscode.workspace.workspaceFolders)
        resourceRoots.push(folder.uri);

    this.webviewPanel = vscode.window.createWebviewPanel(
      (editorType == EditorType.Input ? "spright.input" : "spright.output"),
      (editorType == EditorType.Input ? "Spright Input" : "Spright Output"),
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {
        enableScripts: true,
        localResourceRoots: resourceRoots
      }
    );

    this.webviewPanel.onDidDispose(async () => {
      EditorPanel.instances[this.editorType] = undefined;

      if (this.activeDocumentChangedSubscription)
        this.activeDocumentChangedSubscription.dispose();

      return this.onWebviewDisposed();
    });

    this.webviewPanel.webview.onDidReceiveMessage(async (e) => {
      switch (e.type) {
        case "initialized":
          return this.onWebviewInitialized();

        case "refreshDescription":
          this.activeDocument.sheetDescriptionNeeded = e.sheetDescriptionNeeded;
          return this.activeDocument.validate();

        case "complete":
          return this.activeDocument.completeConfig(e.pattern);

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

    this.webviewPanel.webview.html = getHtmlForWebview(
      this.editorType,
      context.extensionUri,
      this.webviewPanel.webview
    );
  }

  async onWebviewInitialized() {
    if (this.editorType == EditorType.Output) {
      await utils.makeDirectory(getPreviewStorageUri(this.context).fsPath);
      await this.activeDocument.requestPreview(true);
    }
    this.activeDocumentChangedSubscription = this.activeDocument.onChanged(
      this.onActiveDocumentChanged.bind(this)
    );
  }

  async onWebviewDisposed() {
    if (this.editorType == EditorType.Output) {
      await this.activeDocument.requestPreview(false);
      await utils.removeDirectory(getPreviewStorageUri(this.context).fsPath);
    }
  }

  onActiveDocumentChanged(event: ActiveDocumentChangeEvent) {
    this.updateWebview(event.document, event.description, event.config);
  }

  private async updateWebview(
    document: vscode.TextDocument,
    description: Description,
    config: string
  ) {
    const getWebviewUriString = (path: vscode.Uri) => {
      return this.webviewPanel.webview.asWebviewUri(path).toString();
    };

    for (const source of description.sources)
      source.uri = getWebviewUriString(vscode.Uri.joinPath(
        document.uri, "/../", source.path, source.filename));

    for (const texture of description.textures)
      texture.uri = getWebviewUriString(vscode.Uri.joinPath(
        vscode.Uri.file(texture.path), texture.filename));

    this.webviewPanel.webview.postMessage({
      type: "setConfig",
      config,
      description,
    });
  }
}
