import * as vscode from "vscode";
import * as utils from "./utils";
import { Description } from "./web/Description";
import { ActiveDocument, ActiveDocumentChangeEvent } from "./ActiveDocument";
import { getPreviewStorageUri } from "./extension";

function getHtmlForWebview(
  extensionUri: vscode.Uri,
  webview: vscode.Webview
): string {
  const getWebviewPath = (path: string, file: string) => {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, path, file));
  };
  const scriptUri = getWebviewPath("out/web", "PreviewWebview.js");
  const styleResetUri = getWebviewPath("media", "reset.css");
  const styleVSCodeUri = getWebviewPath("media", "vscode.css");
  const styleWebviewUri = getWebviewPath("media", "Webview.css");
  const stylePanelUri = getWebviewPath("media", "PreviewWebview.css");

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
	  <link href="${stylePanelUri}" rel="stylesheet" />
	  <title>Spright Output Preview</title>
	</head>
	<body>
	  <div id="toolbar" data-vscode-context='{ "webviewSection": "toolbar" }'></div>
	  <div id="content" data-vscode-context='{ "webviewSection": "content" }'></div>
	  <div id="properties" data-vscode-context='{ "webviewSection": "properties" }'></div>
	  <script nonce="${nonce}" src="${scriptUri}"></script>
	</body>
	</html>`;
}

export class PreviewPanel {
  private static instance?: PreviewPanel;

  private readonly webviewPanel: vscode.WebviewPanel;

  public static createOrShow(
    context: vscode.ExtensionContext,
    activeDocument: ActiveDocument
  ) {
    if (this.instance) {
      this.instance.webviewPanel.reveal(undefined, true);
      return;
    }
    this.instance = new this(context, activeDocument);
  }

  private constructor(
    private context: vscode.ExtensionContext,
    private activeDocument: ActiveDocument
  ) {
    this.webviewPanel = vscode.window.createWebviewPanel(
      "spright.preview",
      "Spright Output",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {
        enableScripts: true,
        localResourceRoots: [
          context.extensionUri,
          getPreviewStorageUri(context)
        ]
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

        case "openDocument":
          return this.activeDocument.reveal();
      }
    });
  }

  async onWebviewInitialized() {
    await utils.makeDirectory(getPreviewStorageUri(this.context).fsPath);
    await this.activeDocument.requestPreview(true);

    const activeDocumentChangedSubscription = this.activeDocument.onChanged(
      this.onActiveDocumentChanged.bind(this)
    );

    this.webviewPanel.onDidDispose(async () => {
      activeDocumentChangedSubscription.dispose();
      PreviewPanel.instance = undefined;
      await this.activeDocument.requestPreview(false);
      await utils.removeDirectory(getPreviewStorageUri(this.context).fsPath);
    });
  }

  onActiveDocumentChanged(event: ActiveDocumentChangeEvent) {
    this.updateWebview(event.description);
  }

  private async updateWebview(description: Description) {
    const getUri = (path: string, filename: string) => {
      const uri = this.webviewPanel.webview.asWebviewUri(
        vscode.Uri.joinPath(vscode.Uri.file(path), filename)
      );
      return `${uri}`;
    };
    for (const texture of description.textures)
      texture.uri = getUri(texture.path, texture.filename);

    this.webviewPanel.webview.postMessage({
      type: "setDescription",
      description,
    });
  }
}
