import * as vscode from "vscode";
import { SprightEditorProvider } from "./sprightEditorProvider";
import { SprightDocumentSymbolProvider } from "./sprightDocumentSymbolProvider";
import { SprightCompletionItemProvider } from "./sprightCompletionItemProvider";
import { SprightDocumentDropEditProvider } from "./sprightDocumentDropEditProvider";
import { SprightSettingsProvider } from "./sprightSettingsProvider";
import { SprightProvider } from "./sprightProvider";

export function activate(context: vscode.ExtensionContext) {
  const selector = [
    { scheme: "untitled", language: "spright" },
    { scheme: "file", language: "spright" },
  ];

  const sprightSettingsProvider = new SprightSettingsProvider();

  const sprightProvider = new SprightProvider(context);

  const sprightEditorProvider = new SprightEditorProvider(
    context,
    sprightProvider,
    sprightSettingsProvider
  );
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "spright.editor",
      sprightEditorProvider
    )
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
      new SprightCompletionItemProvider(
        context,
        sprightProvider,
        sprightSettingsProvider
      )
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(
      selector,
      new SprightDocumentDropEditProvider()
    )
  );
}
