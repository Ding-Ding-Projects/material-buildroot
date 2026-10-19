import path from "node:path";
import { execFileSync } from "node:child_process";
import { writeFontInventory } from "./website/presentation-provenance.mjs";
import { sourceSnapshot, indexedSources } from "./website/source-boundary.mjs";
import { defineConfig } from "vite";
import { bundleDocumentation } from "./scripts/documentation/bundle.mjs";

export default defineConfig({
  base: "./",
  build: { outDir: "dist", sourcemap: false, rollupOptions: { input: { main: path.resolve(import.meta.dirname, "index.html"), transferProgress: path.resolve(import.meta.dirname, "transfer-progress.html") } }, assetsInlineLimit: (file) => /\.woff2?$/.test(file) ? false : undefined },
  server: { strictPort: true, port: 5173 },
  plugins: [
    {
      name: "bundled-offline-documentation",
      apply: "build",
      async writeBundle(options) {
        if (!options.dir)
          throw new Error("A renderer output directory is required.");
        const fontInputs = ["package.json", "package-lock.json", "vite.config.mjs", "website/presentation-provenance.mjs", "src/renderer/fonts.css", "src/renderer/workspace-styles.ts", "src/renderer/appearance-panel.ts", "src/renderer/diagram-workbench.ts"];
        await writeFontInventory({
          assets: path.resolve(options.dir, "assets"),
          packagesRoot: path.join(import.meta.dirname, "node_modules"),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: import.meta.dirname, encoding: "utf8" }).trim(),
          snapshot: sourceSnapshot(import.meta.dirname, fontInputs, indexedSources(import.meta.dirname)),
        });
        await bundleDocumentation({
          root: import.meta.dirname,
          output: path.resolve(options.dir, "documentation"),
        });
      },
    },
  ],
});
