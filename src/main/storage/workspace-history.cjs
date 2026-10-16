"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// A bare, app-owned repository has no working tree, remotes or user hooks.
function createWorkspaceHistory(filePath) {
  const root = `${filePath}.history.git`;
  const env = {};
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "PATHEXT"])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_TERMINAL_PROMPT: "0", GIT_AUTHOR_NAME: "Material Buildroot", GIT_AUTHOR_EMAIL: "history@localhost",
    GIT_COMMITTER_NAME: "Material Buildroot", GIT_COMMITTER_EMAIL: "history@localhost" });
  function git(args, input, allowMissing = false) {
    const result = spawnSync("git", ["--no-pager", "-c", "core.hooksPath=", "-c", "commit.gpgSign=false", "--git-dir", root, ...args],
      { shell: false, windowsHide: true, env, input, encoding: "utf8", timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      if (allowMissing && !result.error && result.status === 1) return "";
      throw new Error("Local history repository unavailable");
    }
    return result.stdout;
  }
  function ready() {
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    const info = fs.lstatSync(root);
    if (!info.isDirectory() || info.isSymbolicLink() || fs.realpathSync.native(root) !== root)
      throw new Error("Invalid local history repository");
    if (!fs.existsSync(path.join(root, "HEAD"))) git(["init", "--bare", "--initial-branch=main", root]);
    if (git(["rev-parse", "--is-bare-repository"]).trim() !== "true") throw new Error("Invalid local history repository");
  }
  function head() { return git(["rev-parse", "--verify", "--quiet", "refs/heads/main"], undefined, true).trim(); }
  function read(revision) {
    ready();
    return git(["show", `refs/heads/main:revision-${revision}.json`]);
  }
  function append(name, text, message) {
    ready();
    const previous = head();
    const entries = previous ? git(["ls-tree", previous]).trimEnd().split("\n").filter(Boolean) : [];
    if (entries.some(entry => entry.endsWith(`\t${name}`))) {
      if (git(["show", `${previous}:${name}`]) !== text) throw new Error("Conflicting local history record");
      return;
    }
    const blob = git(["hash-object", "-w", "--stdin"], text).trim();
    entries.push(`100644 blob ${blob}\t${name}`);
    const tree = git(["mktree"], entries.sort().join("\n") + "\n").trim();
    const commit = git(["commit-tree", tree, ...(previous ? ["-p", previous] : [])], message + "\n").trim();
    git(["update-ref", "refs/heads/main", commit, previous || "0".repeat(40)]);
  }
  function revisions() {
    ready();
    const current = head();
    return current ? git(["ls-tree", "--name-only", current]).split("\n")
      .filter(name => /^revision-(0|[1-9][0-9]*)\.json$/.test(name)).map(name => Number(name.slice(9, -5))) : [];
  }
  function label(revision, label) {
    const timestamp = new Date().toISOString();
    const name = `label-${require("node:crypto").randomUUID()}.json`;
    append(name, JSON.stringify({ revision, label, timestamp }), `Label workspace revision ${revision}`);
  }
  function labels() {
    ready(); const current = head();
    if (!current) return [];
    return git(["ls-tree", "--name-only", current]).split("\n").filter(name => /^label-[a-f0-9-]+\.json$/.test(name))
      .map(name => JSON.parse(git(["show", `${current}:${name}`])));
  }
  return { read, revisions, label, labels, preserve: state => append(`revision-${state.revision}.json`, JSON.stringify(state), `Record workspace revision ${state.revision}`) };
}
module.exports = { createWorkspaceHistory };
