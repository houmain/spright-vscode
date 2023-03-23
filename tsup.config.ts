import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts", "src/web/webView.ts"],
  clean: true,
  format: ["cjs", "esm"],
  sourcemap: true,
  minify: false,
  outDir: "out",
});
