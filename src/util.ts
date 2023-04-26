import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as extract from "extract-zip";

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// https://stackoverflow.com/questions/27483090/how-to-download-a-file-with-node-js-using-https
export function download(url: string, filename: string) {
  console.log(`Downloading '${url}' to '${filename}'`);
  return new Promise<void>((resolve, reject) => {
    const request = https.get(url, (response: http.IncomingMessage) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filename);
        file.on("finish", () => resolve());
        file.on("error", (err: Error) => {
          file.close();
          fs.unlink(filename, () => reject(err.message));
        });
        response.pipe(file);
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // recursively follow redirects
        download(response.headers.location!, filename).then(() => resolve());
      } else {
        reject(
          `Server responded with ${response.statusCode}: ${response.statusMessage}`
        );
      }
    });

    request.on("error", (err) => {
      reject(err.message);
    });
  });
}

export function fileExists(filename: string) {
  return new Promise<boolean>((resolve, reject) => {
    fs.access(filename, fs.constants.F_OK, (err) => {
      if (err === null) return resolve(true);
      resolve(false);
    });
  });
}

export function makeDirectory(directory: string) {
  return new Promise<boolean>((resolve, reject) => {
    fs.mkdir(directory, { recursive: true }, (err) => {
      if (err === null) return resolve(true);
      resolve(false);
    });
  });
}

export function readTextFile(filename: string) {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(filename, (err, buffer) => {
      if (err === null) return resolve(buffer.toString());
      reject("file not found");
    });
  });
}

export function extractZip(filename: string, directory: string) {
  console.log(`Extracting '${filename}' to '${directory}'`);
  return extract.default(filename, { dir: directory });
}

export function getLineSeparator(text: string) {
  const firstNewLine = text.indexOf("\n");
  const firstReturn = text.indexOf("\r");
  if (firstNewLine >= 0 && firstReturn >= 0)
    return firstNewLine < firstReturn ? "\n\r" : "\r\n";
  return firstReturn >= 0 ? "\r" : "\n";
}

export function splitLines(text: string) {
  return text.split(getLineSeparator(text));
}

export function toNewLineSeparators(text: string) {
  const lineSeparator = getLineSeparator(text);
  if (lineSeparator == "\n") return text;
  return text.split(lineSeparator).join("\n");
}

export function getDifferingRange(current: string[], source: string[]) {
  const firstDiff = (() => {
    const n = Math.min(source.length, current.length);
    for (let i = 0; i < n; i++) {
      if (source[i] != current[i]) {
        return i;
      }
    }
    return n;
  })();

  if (firstDiff != source.length || firstDiff != current.length) {
    const [lastDiffSource, lastDiffCurrent] = (() => {
      for (let i = source.length - 1, j = current.length - 1; ; --i, --j)
        if (i < firstDiff || j < firstDiff || source[i] != current[j])
          return [i + 1, j + 1];
    })();
    return {
      first: firstDiff,
      last: lastDiffCurrent,
      diff: source.splice(firstDiff, lastDiffSource - firstDiff),
    };
  }
}
