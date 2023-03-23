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
    return i - 1;
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

function getLineParameters(line: ConfigLine) {
  return line.line.substring(line.level + line.definition.length).trim();
}

function setLineParameters(line: ConfigLine, parameters: string) {
  line.line =
    line.line.substring(0, line.level) + line.definition + " " + parameters;
}

export class Config {
  private defaultIndent: string;
  private lines: ConfigLine[];
  public inputs: Input[];

  constructor(source: string) {
    this.defaultIndent = "  ";
    this.lines = splitLines(source);
    this.inputs = [];

    for (let i = 0; i < this.lines.length; ++i) {
      const line = this.lines[i];
      if (line.definition === "input") {
        const sprites: Sprite[] = [];
        this.inputs.push({
          lineNo: i,
          sprites,
        });
      } else if (line.definition === "sprite") {
        if (this.inputs.length > 0)
          this.inputs[this.inputs.length - 1].sprites.push({
            lineNo: i,
          });
      }
    }
  }

  public toString(): string {
    return this.lines.map((x) => x.line).join("\n");
  }

  private findPropertyLineDirect(subject: Subject, definition: string) {
    const line = this.lines[subject.lineNo];
    for (let i = subject.lineNo + 1; i < this.lines.length; ++i) {
      const child = this.lines[i];
      if (child.level <= line.level) break;
      if (child.definition == child.definition) return child;
    }
  }

  private findPropertyLineCommon(subject: Subject, definition: string) {
    const line = this.lines[subject.lineNo];
    let belowLevel = line.level;
    for (let i = subject.lineNo - 1; i >= 0; --i) {
      const parent = this.lines[i];
      if (parent.level < belowLevel) {
        if (parent.definition == definition) return parent;
        belowLevel = parent.level + 1;
      }
    }
  }

  public getSubjectParameters(subject: Subject) {
    const line = this.lines[subject.lineNo];
    return getLineParameters(line);
  }

  public getProperty(subject: Subject, definition: string) {
    const direct = this.findPropertyLineDirect(subject, definition);
    if (direct) return getLineParameters(direct);
    const common = this.findPropertyLineCommon(subject, definition);
    if (common) return getLineParameters(common);
  }

  public setPropertyDirect(
    subject: Subject,
    definition: string,
    parameters: string
  ) {
    const line = this.findPropertyLineDirect(subject, definition);
    if (line) setLineParameters(line, parameters);
    else this.insertPropertyDirect(subject, definition, parameters);
  }

  private getChildIndent(subject: Subject) {
    const line = this.lines[subject.lineNo];
    if (subject.lineNo < this.lines.length) {
      const child = this.lines[subject.lineNo - 1];
      if (child.level > line.level) return getLineIndent(child);
    }
    return getLineIndent(line) + this.defaultIndent;
  }

  private insertPropertyDirect(
    subject: Subject,
    definition: string,
    parameters: string
  ) {
    const line = this.lines[subject.lineNo];
    const indent = this.getChildIndent(subject);
    const newLine = indent + definition + " " + parameters;
    this.lines.splice(subject.lineNo + 1, 0, {
      line: newLine,
      level: indent.length,
      definition,
    });
    this.fixupLineNumbers(subject.lineNo, +1);
  }

  private fixupLineNumbers(start: number, delta: number) {
    for (const input of this.inputs) {
      if (input.lineNo > start) input.lineNo += delta;
      for (const sprite of input.sprites) {
        if (sprite.lineNo > start) sprite.lineNo += delta;
      }
    }
  }

  public getSpriteId(sprite: Sprite) {
    const id = this.getSubjectParameters(sprite);
    if (id.length > 0) return id;
    const id2 = this.getProperty(sprite, "id");
    if (id2) return id2;
    return "sprite";
  }
}
