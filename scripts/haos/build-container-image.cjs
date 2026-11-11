#!/usr/bin/env node
"use strict";
// Builds the Home Assistant Material container image locally from a commit of
// its repository, without writing to that repository.
//
//   node scripts/haos/build-container-image.cjs --source <repository> --work <folder>
//       [--commit HEAD] [--tag home-assistant-material:local] [--save <file.tar>] [--keep-stage]
//
// The work folder receives a staged clone, build.log and receipt.json.
const path = require("node:path");
const { runContainerImageBuild } = require("../../src/main/execution/haos-runner.cjs");

function parseArgs(argv) {
  const options = { commit: "HEAD", tag: "home-assistant-material:local", keepStage: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i], next = () => { if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`); return argv[++i]; };
    if (flag === "--source") options.source = path.resolve(next());
    else if (flag === "--work") options.work = path.resolve(next());
    else if (flag === "--commit") options.commit = next();
    else if (flag === "--tag") options.tag = next();
    else if (flag === "--save") options.save = path.resolve(next());
    else if (flag === "--keep-stage") options.keepStage = true;
    else throw new Error(`Unknown option ${flag}`);
  }
  for (const key of ["source", "work"]) if (!options[key]) throw new Error(`--${key} is required`);
  return options;
}

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
runContainerImageBuild({ ...parseArgs(process.argv.slice(2)), onLine: line => process.stdout.write(line.endsWith("\n") ? line : line + "\n"), signal: controller.signal })
  .then(receipt => console.log(`Image ${receipt.tag}: ${receipt.image?.id}`))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
