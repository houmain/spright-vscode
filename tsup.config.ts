import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/web/webView.ts"],
  clean: false,
  sourcemap: true,
  minify: false,
  bundle: true,
  outDir: "out/web",
});
