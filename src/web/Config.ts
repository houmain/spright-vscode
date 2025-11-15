
import * as utils from './utils';

type ConfigLine = {
  line: string;
  level: number;
  definition: string;
};

export type Input = {
  lineNo: number;
  sprites: Sprite[];
};

export type Sprite = {
  lineNo: number;
};

export type Subject = Input | Sprite;

export type Parameter = string;
export type ParameterList = Array<Parameter>;

function splitLines(source: string) {
  function indexOfNonSpace(line: string) {
    for (let i = 0; i < line.length; ++i)
      if (line[i] != " " && line[i] != "\t") return i;
    return -1;
  }
  function indexOfSpace(line: string, pos: number) {
    let i = pos;
    for (pos; i < line.length; ++i)
      if (line[i] == " " || line[i] == "\t") return i;
    return i;
  }

  const lines: Array<ConfigLine> = [];
  let prevLevel = 0;
  for (const line of source.split("\n")) {
    let level = prevLevel;
    let definition = "";
    const begin = indexOfNonSpace(line);
    if (begin >= 0 && line[begin] !== "#") {
      const end = indexOfSpace(line, begin);
      definition = line.substring(begin, end);
      level = begin;
      prevLevel = level;
    }
    lines.push({
      line,
      level,
      definition,
    });
  }
  return lines;
}

function getLineIndent(line: ConfigLine) {
  return line.line.substring(0, line.level);
}


function formatParameterList(parameters: ParameterList): string {
  const values = Array<string>();
  for (const parameter of parameters)
    values.push(utils.conditionallyQuote(parameter));
  return values.join(' ');
}

function isWhiteSpace(c: string) {
  return (c.trim() === '');
}

function parseParameterList(line: string): ParameterList {
  let begin = 0;
  const end = line.length;
  let pos = 0;
  let inString: string | undefined;
  const parameters = Array<Parameter>();
  for (const c of line) {
    ++pos;
    if ((!inString && isWhiteSpace(c)) || inString == c || pos == end) {
      parameters.push(utils.stripQuotes(line.substring(begin, pos).trim()));
      begin = pos;
      inString = undefined;
    }
    else if (c == '"' || c == '"') {
      inString = c;
    }
  }
  return parameters;
}

function getLineParameters(line: ConfigLine): ParameterList {
  return parseParameterList(line.line.substring(line.level + line.definition.length).trim());
}

function setLineParameters(line: ConfigLine, parameters: ParameterList) {
  line.line =
    line.line.substring(0, line.level) + line.definition + " " + formatParameterList(parameters);
}

export class Config {
  private defaultIndent: string;
  private lines: ConfigLine[];
  public source: string;
  public inputs: Input[];

  constructor(source: string) {
    this.defaultIndent = "  ";
    this.lines = splitLines(source);
    this.source = source;
    this.inputs = [];

    for (let i = 0; i < this.lines.length; ++i) {
      const line = this.lines[i];
      if (line.definition === "input") {
        this.inputs.push({
          lineNo: i,
          sprites: [],
        });
      } else if (line.definition === "sprite") {
        if (this.inputs.length > 0)
          this.inputs[this.inputs.length - 1].sprites.push({
            lineNo: i,
          });
      }
    }
  }

  public updateSource() {
    this.source = this.lines.map((x) => x.line).join("\n");
  }

  public getSubjectParameters(subject: Subject): ParameterList {
    const line = this.lines[subject.lineNo];
    return getLineParameters(line);
  }

  public getSubjectParameter(subject: Subject, index: number): string {
    return this.getSubjectParameters(subject).at(index) || "";
  }

  public setSubjectParameters(subject: Subject, parameters: ParameterList) {
    const line = this.lines[subject.lineNo];
    return setLineParameters(line, parameters);
  }

  private findPropertyLineNo(subject: Subject, definition: string) {
    const line = this.lines[subject.lineNo];
    for (let i = subject.lineNo + 1; i < this.lines.length; ++i) {
      const child = this.lines[i];
      if (child.level <= line.level) break;
      if (child.definition == definition) return i;
    }
  }

  private findPropertyLine(subject: Subject, definition: string) {
    const lineNo = this.findPropertyLineNo(subject, definition);
    if (lineNo) return this.lines[lineNo];
  }

  public hasProperty(subject: Subject, definition: string) {
    return this.findPropertyLine(subject, definition) !== undefined;
  }

  public getPropertyParameters(subject: Subject, definition: string) {
    const line = this.findPropertyLine(subject, definition);
    if (line) return getLineParameters(line);
  }

  private findCommonPropertyLineNo(subject: Subject, definition: string) {
    const line = this.lines[subject.lineNo];
    let belowLevel = line.level;
    for (let i = subject.lineNo - 1; i >= 0; --i) {
      const parent = this.lines[i];
      if (parent.level < belowLevel) {
        if (parent.definition == definition) return i;
        belowLevel = parent.level + 1;
      }
    }
  }

  private findCommonPropertyLine(subject: Subject, definition: string) {
    const lineNo = this.findCommonPropertyLineNo(subject, definition);
    if (lineNo) return this.lines[lineNo];
  }

  public hasCommonProperty(subject: Subject, definition: string) {
    return this.findCommonPropertyLine(subject, definition) !== undefined;
  }

  public getCommonPropertyParameters(subject: Subject, definition: string) {
    const line = this.findCommonPropertyLine(subject, definition);
    if (line) return getLineParameters(line);
  }

  public setProperty(
    subject: Subject,
    definition: string,
    parameters: ParameterList
  ) {
    const line = this.findPropertyLine(subject, definition);
    if (line) setLineParameters(line, parameters);
    else this.insertProperty(subject, definition, parameters);
  }

  private getChildIndent(subject: Subject) {
    const line = this.lines[subject.lineNo];
    if (subject.lineNo < this.lines.length) {
      const child = this.lines[subject.lineNo + 1];
      if (child.level > line.level) return getLineIndent(child);
    }
    return getLineIndent(line) + this.defaultIndent;
  }

  private insertProperty(
    subject: Subject,
    definition: string,
    parameters: ParameterList
  ) {
    const indent = this.getChildIndent(subject);
    const newLine = indent + definition + " " + formatParameterList(parameters);
    this.lines.splice(subject.lineNo + 1, 0, {
      line: newLine,
      level: indent.length,
      definition,
    });
    this.fixupLineNumbers(subject.lineNo, +1);
  }

  public removeProperty(subject: Subject, definition: string) {
    const lineNo = this.findPropertyLineNo(subject, definition);
    if (lineNo) {
      this.lines.splice(lineNo, 1);
      this.fixupLineNumbers(lineNo, -1);
    }
  }

  private fixupLineNumbers(start: number, delta: number) {
    for (const input of this.inputs) {
      if (input.lineNo > start) input.lineNo += delta;
      for (const sprite of input.sprites) {
        if (sprite.lineNo > start) sprite.lineNo += delta;
      }
    }
  }

  public getParameterColumn(item: Subject) {
    const line = this.lines[item.lineNo];
    return line.level + line.definition.length + 1;
  }

  public getInputType(input: Input) {
    const types = ["atlas", "grid", "grid-cells"];
    for (const type of types)
      if (this.hasProperty(input, type))
        return type;
    for (const type of types)
      if (this.hasCommonProperty(input, type))
        return type;
    return "sprite";
  }

  public replaceInputType(configInput: Input, newType: string) {
    const type = this.getInputType(configInput);
    if (type == newType)
      return;

    if (newType !== "sprite" || configInput.sprites.length == 0) {
      let parameters: ParameterList = [];
      if (newType == "grid" || newType == "grid-cells")
        parameters = ["16", "16"];
      this.setProperty(configInput, newType, parameters);
    }
    if (type !== "sprite" || configInput.sprites.length == 1)
      this.removeProperty(configInput, type);
  }

  public replaceSpriteId(sprite: Sprite, id: string) {
    this.setSubjectParameters(sprite, [id]);
  }
}
