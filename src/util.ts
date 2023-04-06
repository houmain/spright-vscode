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
      reject();
    });
  });
}

export function extractZip(filename: string, directory: string) {
  console.log(`Extracting '${filename}' to '${directory}'`);
  return extract.default(filename, { dir: directory });
}
