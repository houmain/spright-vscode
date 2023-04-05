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
        return resolve({
          code,
          stdout,
          stderr,
        });
      });
    });
  }

  async autocompleteConfig(configFilename: string, config: string) {
    return this.exec(
      dirname(configFilename),
      ["-i", "stdin", "-o", "stdout", "-a", "-w"],
      config
    );
  }

  async getOutputDescription(configFilename: string, config: string) {
    return this.exec(
      dirname(configFilename),
      ["-i", "stdin", "-o", "stdout", "-d", "-w"],
      config
    );
  }
}
