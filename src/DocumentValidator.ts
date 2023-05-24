import * as vscode from "vscode";
import * as utils from "./utils";
import { Spright } from "./Spright";
import { Description } from "./web/Description";
import { Settings } from "./SettingsProvider";

const emptyDescription: Description = {
  inputs: [],
  sources: [],
  sprites: [],
};

function parseErrorOutput(document: vscode.TextDocument, output: string) {
  const diagnostics: vscode.Diagnostic[] = [];
  for (const line of output.split(/[\n\r]+/)) {
    // "message in line N"
    const match = line.split(" in line ");
    const message = match[0];
    let range: vscode.Range;
    if (match.length > 1) {
      const lineNo = Number.parseInt(match[1]) - 1;
      const configLine = document.lineAt(lineNo);
      const sc = configLine.firstNonWhitespaceCharacterIndex;
      range = new vscode.Range(lineNo, sc, lineNo, configLine.text.length);
    } else {
      range = new vscode.Range(0, 0, 0, 0);
    }
    diagnostics.push({
      message,
      range: range,
      severity: vscode.DiagnosticSeverity.Error,
      source: "",
    });
  }
  return diagnostics;
}

async function updateDocument(document: vscode.TextDocument, config: string) {
  const current = document.getText();
  const lineSeparator = utils.getLineSeparator(current);
  const currentLines = current.split(lineSeparator);
  const configLines = utils.splitLines(config);
  const range = utils.getDifferingRange(currentLines, configLines);
  if (!range) return;
  const edit = new vscode.WorkspaceEdit();

  const prependNewline =
    !current.endsWith(lineSeparator) && range.first == currentLines.length;
  const appendNewline = range.last != currentLines.length;
  edit.replace(
    document.uri,
    new vscode.Range(range.first, 0, range.last, 0),
    (prependNewline ? lineSeparator : "") +
      range.diff.join(lineSeparator) +
      (appendNewline ? lineSeparator : "")
  );
  return vscode.workspace.applyEdit(edit);
}

export class DocumentValidator {
  config = "";
  description = emptyDescription;
  diagnostics: vscode.Diagnostic[] = [];
  describeOnlyInput = false;

  constructor(public document: vscode.TextDocument) {}

  async getDescription(spright: Spright, describeOnlyInput: boolean) {
    const config = utils.toNewLineSeparators(this.document.getText());
    if (this.config != config || this.describeOnlyInput != describeOnlyInput) {
      this.config = config;
      this.describeOnlyInput = describeOnlyInput;
      const result = await spright.getDescription(
        this.document.fileName,
        this.config,
        describeOnlyInput
      );
      this.diagnostics = parseErrorOutput(this.document, result.stderr);
      if (result.stdout.length > 0) {
        this.description = JSON.parse(result.stdout);
      }
    }
  }

  async autocompleteConfig(spright: Spright, pattern?: string) {
    const result = await spright.autocompleteConfig(
      this.document.fileName,
      this.document.getText(),
      pattern
    );
    this.diagnostics = parseErrorOutput(this.document, result.stderr);
    if (result.stdout.length > 0) {
      return updateDocument(this.document, result.stdout);
    }
  }

  async buildOutput(spright: Spright, settings: Settings) {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Updating spright output",
        cancellable: true,
      },
      (progress, _token) => {
        progress.report({ message: "In progress" });

        return new Promise<void>((resolve) => {
          spright
            .buildOutput(
              this.document.fileName,
              this.document.getText(),
              settings.output,
              settings.template,
              settings.path
            )
            .then((result: utils.ExecResult) => {
              this.diagnostics = parseErrorOutput(this.document, result.stderr);
              switch (result.code) {
                case 0:
                  progress.report({ increment: 100, message: "Completed" });
                  setTimeout(resolve, 1000);
                  break;
                case 1:
                  progress.report({
                    increment: 100,
                    message: result.stderr,
                  });
                  break;
                case 2:
                  progress.report({
                    increment: 100,
                    message: "Completed with warnings",
                  });
                  setTimeout(resolve, 4000);
                  break;
              }
            });
        });
      }
    );
  }
}
