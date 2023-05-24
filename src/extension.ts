import * as vscode from "vscode";
import { DocumentSymbolProvider } from "./DocumentSymbolProvider";
import { SprightCompletionItemProvider } from "./CompletionItemProvider";
import { DocumentDropEditProvider } from "./DocumentDropEditProvider";
import { SettingsProvider } from "./SettingsProvider";
import { SprightProvider } from "./SprightProvider";
import { EditorPanel } from "./EditorPanel";
import { ActiveDocument } from "./ActiveDocument";

export function activate(context: vscode.ExtensionContext) {
  const selector = [
    { scheme: "untitled", language: "spright" },
    { scheme: "file", language: "spright" },
  ];

  const settingsProvider = new SettingsProvider();
  const sprightProvider = new SprightProvider(context, settingsProvider);
  const activeDocument = new ActiveDocument(sprightProvider, settingsProvider);

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      selector,
      new DocumentSymbolProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "spright",
      new SprightCompletionItemProvider(sprightProvider, settingsProvider)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(
      selector,
      new DocumentDropEditProvider()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("spright.build", () => {
      return activeDocument.buildOutput();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("spright.complete", () => {
      return activeDocument.autocompleteConfig();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("spright.editor", () => {
      return EditorPanel.createOrShow(context, activeDocument);
    })
  );
}
