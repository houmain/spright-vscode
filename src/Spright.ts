import { dirname } from "path";
import * as utils from "./utils";

export type Parameters = {
  workingDirectory?: string;
  input?: string;
  output?: string;
  stdin?: string;
  mode?: string;
  modeArg?: string;
  path?: string;
  template?: string;
  verbose?: boolean;
};

export class Spright {
  private readonly binaryPath: string;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
  }

  async execute(params: Parameters): Promise<utils.ExecResult> {
    const args: string[] = [];
    if (params.input) args.push("-i", params.input);
    if (params.output) args.push("-o", params.output);
    if (params.path) args.push("-p", params.path);
    if (params.template) args.push("-t", params.template);
    if (params.verbose) args.push("-v");
    if (params.mode) {
      args.push("-m", params.mode);
      if (params.modeArg) args.push(params.modeArg);
    }
    const workingDirectory = params.workingDirectory
      ? params.workingDirectory
      : params.input
        ? dirname(params.input)
        : ".";

    const begin = Date.now();
    const result = await utils.exec(
      this.binaryPath,
      workingDirectory,
      args,
      params.stdin
    );
    const duration = (Date.now() - begin) / 1000.0;
    console.log("Executing spright", args, "took", duration, "seconds");
    return result;
  }

  async completeConfig(
    configFilename: string,
    config: string,
    pattern?: string
  ) {
    return this.execute({
      workingDirectory: dirname(configFilename),
      input: "stdin",
      output: "stdout",
      mode: "complete",
      modeArg: pattern,
      stdin: config,
    });
  }

  async getDescription(
    configFilename: string,
    config: string,
    describeOnlyInput: boolean
  ) {
    return this.execute({
      workingDirectory: dirname(configFilename),
      mode: describeOnlyInput ? "describe-input" : "describe",
      input: "stdin",
      output: "stdout",
      stdin: config,
    });
  }

  async buildOutput(
    configFilename: string,
    config: string,
    output?: string,
    template?: string,
    path?: string
  ) {
    return this.execute({
      workingDirectory: dirname(configFilename),
      input: "stdin",
      output: output,
      stdin: config,
      template,
      path,
    });
  }
}
