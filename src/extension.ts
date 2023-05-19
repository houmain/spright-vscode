import * as vscode from "vscode";
import { EditorProvider } from "./EditorProvider";
import { DocumentSymbolProvider } from "./DocumentSymbolProvider";
import { SprightCompletionItemProvider } from "./CompletionItemProvider";
import { DocumentDropEditProvider } from "./DocumentDropEditProvider";
import { SettingsProvider } from "./SettingsProvider";
import { SprightProvider } from "./SprightProvider";

export function activate(context: vscode.ExtensionContext) {
  const selector = [
    { scheme: "untitled", language: "spright" },
    { scheme: "file", language: "spright" },
  ];

  const settingsProvider = new SettingsProvider();

  const sprightProvider = new SprightProvider(context);

  const sprightEditorProvider = new EditorProvider(
    context,
    sprightProvider,
    settingsProvider
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
      new DocumentSymbolProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "spright",
      new SprightCompletionItemProvider(
        context,
        sprightProvider,
        settingsProvider
      )
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(
      selector,
      new DocumentDropEditProvider()
    )
  );
}
