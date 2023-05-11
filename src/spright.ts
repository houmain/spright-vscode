import { spawn } from "child_process";
import { dirname } from "path";

export type Result = {
  code: number;
  stdout: string;
  stderr: string;
};

export class Spright {
  private readonly binaryPath: string;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
  }

  private async exec(workingDirectory: string, args: string[], input: string) {
    const begin = Date.now();
    return new Promise<Result>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      const child = spawn(this.binaryPath, args, {
        cwd: workingDirectory,
      });
      child.stdin.end(input);
      child.stdout.on("data", (chunk: string) => (stdout += chunk));
      child.stderr.on("data", (chunk: string) => (stderr += chunk));
      child.on("error", (err: any) => {
        return reject(err);
      });
      child.on("close", (code: number) => {
        const duration = (Date.now() - begin) / 1000.0;
        console.log("Executing spright", args, "took", duration, "seconds");
        return resolve({
          code,
          stdout,
          stderr,
        });
      });
    });
  }

  async autocompleteConfig(
    configFilename: string,
    config: string,
    pattern?: string
  ) {
    const args = ["-i", "stdin", "-o", "stdout", "-w", "-m", "complete"];
    if (pattern) args.push(pattern);
    return this.exec(dirname(configFilename), args, config);
  }

  async updateOutput(configFilename: string, config: string) {
    const args = ["-i", "stdin"];
    return this.exec(dirname(configFilename), args, config);
  }

  async getDescription(
    configFilename: string,
    config: string,
    describeOnlyInput: boolean
  ) {
    return this.exec(
      dirname(configFilename),
      [
        "-m",
        describeOnlyInput ? "describe-input" : "describe",
        "-i",
        "stdin",
        "-o",
        "stdout",
        "-w",
      ],
      config
    );
  }
}
