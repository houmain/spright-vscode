import * as vscode from "vscode";
import { SprightEditorProvider } from "./sprightEditorProvider";
import { SprightDocumentSymbolProvider } from "./sprightDocumentSymbolProvider";
import { SprightCompletionItemProvider } from "./sprightCompletionItemProvider";

const sprightVersion = "2.3.1";

export function activate(context: vscode.ExtensionContext) {
  const sprightEditor = new SprightEditorProvider(context, sprightVersion);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider("spright.editor", sprightEditor)
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      [
        { scheme: "untitled", language: "spright" },
        { scheme: "file", language: "spright" },
      ],
      new SprightDocumentSymbolProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "spright",
      new SprightCompletionItemProvider(context, sprightVersion)
    )
  );
}
