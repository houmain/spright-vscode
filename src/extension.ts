import * as vscode from "vscode";
import { SprightEditorProvider } from "./sprightEditorProvider";
import { SprightDocumentSymbolProvider } from "./sprightDocumentSymbolProvider";
import { SprightCompletionItemProvider } from "./sprightCompletionItemProvider";
import { SprightDocumentDropEditProvider } from "./sprightDocumentDropEditProvider";

const sprightVersion = "3.0.0";

export function activate(context: vscode.ExtensionContext) {
  const selector = [
    { scheme: "untitled", language: "spright" },
    { scheme: "file", language: "spright" },
  ];

  const sprightEditor = new SprightEditorProvider(context, sprightVersion);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider("spright.editor", sprightEditor)
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      selector,
      new SprightDocumentSymbolProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "spright",
      new SprightCompletionItemProvider(context, sprightVersion)
    )
  );

	context.subscriptions.push(vscode.languages.registerDocumentDropEditProvider(
    selector, new SprightDocumentDropEditProvider()));
}
