import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts", "src/web/EditorWebview.ts", "src/web/PreviewWebview.ts"],
  clean: true,
  format: ["cjs"],
  sourcemap: true,
  minify: false,
  bundle: true,
  outDir: "out",
  platform: "node",
  external: ["vscode"],
});
