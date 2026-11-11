#!/usr/bin/env node
"use strict";
// Builds one Home Assistant OS style image from a repository that contains an
// `operating-system/` Buildroot external tree, using that tree's own builder.
//
//   node scripts/haos/build-haos.cjs --source <repository> --defconfig ova --output <folder>
//       [--commit HEAD] [--version-json <file>] [--keep-volume]
//
// The output folder receives the haos_* images, build.log and receipt.json.
const fs = require("node:fs"), path = require("node:path");
const { runHaosImageBuild } = require("../../src/main/execution/haos-runner.cjs");

function parseArgs(argv) {
  const options = { commit: "HEAD", keepVolume: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i], next = () => { if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`); return argv[++i]; };
    if (flag === "--source") options.source = path.resolve(next());
    else if (flag === "--defconfig") options.defconfig = next();
    else if (flag === "--output") options.output = path.resolve(next());
    else if (flag === "--commit") options.commit = next();
    else if (flag === "--version-json") options.versionJson = fs.readFileSync(path.resolve(next()), "utf8");
    else if (flag === "--keep-volume") options.keepVolume = true;
    else throw new Error(`Unknown option ${flag}`);
  }
  for (const key of ["source", "defconfig", "output"]) if (!options[key]) throw new Error(`--${key} is required`);
  return options;
}

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
runHaosImageBuild({ ...parseArgs(process.argv.slice(2)), onLine: line => process.stdout.write(line.endsWith("\n") ? line : line + "\n"), signal: controller.signal })
  .then(receipt => console.log(`Images: ${receipt.artifacts.map(a => a.name).join(", ")}`))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
