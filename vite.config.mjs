import path from "node:path";
import { defineConfig } from "vite";
import { bundleDocumentation } from "./scripts/documentation/bundle.mjs";

export default defineConfig({
  base: "./",
  build: { outDir: "dist", sourcemap: false },
  server: { strictPort: true, port: 5173 },
  plugins: [
    {
      name: "bundled-offline-documentation",
      apply: "build",
      async writeBundle(options) {
        if (!options.dir)
          throw new Error("A renderer output directory is required.");
        await bundleDocumentation({
          root: import.meta.dirname,
          output: path.resolve(options.dir, "documentation"),
        });
      },
    },
  ],
});
