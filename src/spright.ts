import { spawn } from "child_process";
import { dirname } from "path";

let sprightBinaryPath = "";

export type Result = {
  code: number;
  stdout: string;
  stderr: string;
};

async function execSpright(
  workingDirectory: string,
  args: string[],
  input: string
) {
  return new Promise<Result>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(sprightBinaryPath, args, {
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

export function setBinaryPath(path: string) {
  sprightBinaryPath = path;
}

export async function autocompleteConfig(
  configFilename: string,
  config: string
) {
  return execSpright(
    dirname(configFilename),
    ["-i", "stdin", "-o", "stdout", "-a", "-w"],
    config
  );
}

export async function getOutputDescription(
  configFilename: string,
  config: string
) {
  return execSpright(
    dirname(configFilename),
    ["-i", "stdin", "-o", "stdout", "-d", "-w"],
    config
  );
}
