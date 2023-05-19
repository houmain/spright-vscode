import * as vscode from "vscode";
import { SprightProvider } from "./SprightProvider";
import { Settings, SettingsProvider } from "./SettingsProvider";

type EnumValue = {
  name: string;
  description: string;
};

type Definition = {
  subject: string;
  args: string;
  description: string;
  enumValues: EnumValue[];
};

function priorize(name: string): number | undefined {
  switch (name) {
    case "sprite":
      return 1;
    case "sheet":
    case "input":
      return 2;
  }
}

function findEnumValues(text: string) {
  // - _value_: description<br/>
  const values: EnumValue[] = [];
  for (const match of text.matchAll(/-\s*_([a-z-]+)_\s*:([^<]*)<br\/>/g))
    values.push({
      name: match[1],
      description: match[2],
    });
  return values;
}

function parseReadmeMarkdown(text: string) {
  text = text.replace(/[\n\r]+/g, "\n");
  const chapterOffset = text.search("## Input definition reference");
  const chapterEnd = text.indexOf("## Output description", chapterOffset);
  const tableOffset = text.indexOf("| **sheet**", chapterOffset);
  const lines = text.substring(tableOffset, chapterEnd).trim().split("\n");
  const definitions: { [k: string]: Definition } = {};
  for (const line of lines) {
    const c = line.split("|");
    c.shift();
    definitions[c[0].replace(/[*]/g, "").trim()] = {
      subject: c[1].trim(),
      args: c[2].trim().replace(/<br\/>/, " "),
      description: c[3].trim(),
      enumValues: findEnumValues(c[3]),
    };
  }
  return definitions;
}

function parseDocumentation(text: string) {
  const doc = new vscode.MarkdownString();
  doc.supportHtml = true;
  doc.appendMarkdown(text);
  return doc;
}

export class SprightCompletionItemProvider {
  private definitions?: { [k: string]: Definition };
  private definitionCompletions?: vscode.CompletionItem[];

  constructor(
    private sprightProvider: SprightProvider,
    settingsProvider: SettingsProvider
  ) {
    settingsProvider.onSettingsChanged(this.resetDefinitions.bind(this));
  }

  private resetDefinitions() {
    delete this.definitions;
  }

  private async lazyLoadDefinitions() {
    if (this.definitions) return;
    try {
      const readme = await this.sprightProvider.getReadme();
      this.definitions = parseReadmeMarkdown(readme);
    } catch (ex) {
      console.log("Loading definitions failed: ", ex);
      this.definitions = {};
    }
    this.definitionCompletions = this.createDefinitionCompeltions();
  }

  private createDefinitionCompeltions() {
    const items: vscode.CompletionItem[] = [];
    for (const name in this.definitions) {
      const definition = this.definitions[name];
      const c = new vscode.CompletionItem(name);
      c.detail = "Arguments: " + definition.args;
      c.documentation = parseDocumentation(definition.description);
      c.kind = vscode.CompletionItemKind.Field;
      const priority = priorize(name);
      if (priority) {
        c.sortText = priority.toString() + " " + name;
        c.preselect = true;
      }
      if (definition.args.length > 0) {
        c.insertText = name + " ";
        if (definition.enumValues.length > 0) {
          c.command = {
            command: "editor.action.triggerSuggest",
            title: "Complete arguments...",
          };
        }
      } else {
        c.insertText = name;
      }
      items.push(c);
    }
    return items;
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ) {
    await this.lazyLoadDefinitions();

    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character)
      .trimStart()
      .split(/\s+/);

    if (linePrefix.length == 1) {
      // complete definitions
      return this.definitionCompletions!;
    } else {
      // complete arguments
      const items: vscode.CompletionItem[] = [];
      const definition = this.definitions![linePrefix[0]];
      if (definition) {
        for (const value of definition.enumValues) {
          const c = new vscode.CompletionItem(value.name);
          c.kind = vscode.CompletionItemKind.Value;
          c.documentation = parseDocumentation(value.description);
          items.push(c);
        }
      }
      return items;
    }
  }
}
