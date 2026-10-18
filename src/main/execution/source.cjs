"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { boundedProcess } = require("./index.cjs");
const safeName = (value) =>
  typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value) &&
  value !== "." &&
  value !== "..";
function safeRef(value) {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    /^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(value) &&
    !value.includes("..") &&
    !value.includes("//") &&
    !value.endsWith("/") &&
    !value.endsWith(".lock")
  );
}
function directory(value) {
  if (
    typeof value !== "string" ||
    !path.isAbsolute(value) ||
    /[\0\r\n]/.test(value)
  )
    throw Error("invalid-root");
  const real = fs.realpathSync(value);
  if (!fs.statSync(real).isDirectory()) throw Error("invalid-root");
  return real;
}
function identity(value) {
  const stat = fs.statSync(value);
  return `${stat.dev}:${stat.ino}`;
}
function configIdentity(info) {
  return [info.dev, info.ino, info.mode, info.nlink, info.size, info.mtimeNs, info.ctimeNs].map(String).join(":");
}
class SourceService {
  constructor({
    git = "git",
    allowLocalFixture = false,
    acquireSourceLock = null,
  } = {}) {
    if (git !== "git" && !path.isAbsolute(git))
      throw Error("invalid-git-executable");
    this.git = git;
    this.allowLocalFixture = allowLocalFixture;
    this.acquireSourceLock = acquireSourceLock;
    this.grants = new Map();
    this.projects = new Map();
    this.previews = new Map();
    this.busy = new Set();
    this.hooks = fs.mkdtempSync(
      path.join(os.tmpdir(), "material-empty-hooks-"),
    );
    this.hooks = fs.realpathSync(this.hooks);
    this.hooksIdentity = identity(this.hooks);
    this.globalConfig = path.join(this.hooks, "empty-global-config");
    fs.writeFileSync(this.globalConfig, "", { flag: "wx", mode: 0o600 });
    this.globalConfigIdentity = configIdentity(fs.lstatSync(this.globalConfig, { bigint: true }));
  }
  dispose() {
    if (!fs.existsSync(this.hooks)) return;
    if (fs.lstatSync(this.hooks).isSymbolicLink() || fs.realpathSync(this.hooks) !== this.hooks || identity(this.hooks) !== this.hooksIdentity) throw Error("source-global-config-changed");
    fs.rmSync(this.hooks, { recursive: true, force: true });
  }
  verifyGlobalConfig() {
    let descriptor;
    try {
      if (fs.lstatSync(this.hooks).isSymbolicLink() || fs.realpathSync(this.hooks) !== this.hooks || identity(this.hooks) !== this.hooksIdentity) throw Error();
      const info = fs.lstatSync(this.globalConfig, { bigint: true });
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n || info.size !== 0n || configIdentity(info) !== this.globalConfigIdentity) throw Error();
      descriptor = fs.openSync(this.globalConfig, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      if (configIdentity(fs.fstatSync(descriptor, { bigint: true })) !== this.globalConfigIdentity || fs.readSync(descriptor, Buffer.alloc(1), 0, 1, 0) !== 0 || configIdentity(fs.lstatSync(this.globalConfig, { bigint: true })) !== this.globalConfigIdentity) throw Error();
    } catch { throw Object.assign(Error("source-global-config-changed"), { code: "SOURCE_GLOBAL_CONFIG_CHANGED" }); }
    finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
  }
  grantRoot(root) {
    root = directory(root);
    const grantId = crypto.randomUUID();
    this.grants.set(grantId, { root, identity: identity(root) });
    return { grantId, root };
  }
  revoke(grantId) {
    this.grants.delete(grantId);
  }
  destination(grantId, name) {
    const grant = this.grants.get(grantId);
    if (!grant || !safeName(name)) throw Error("invalid-source-grant");
    if (
      directory(grant.root) !== grant.root ||
      identity(grant.root) !== grant.identity
    )
      throw Error("source-grant-changed");
    const dest = path.join(grant.root, name);
    if (
      fs.existsSync(dest) &&
      (fs.lstatSync(dest).isSymbolicLink() || directory(dest) !== dest)
    )
      throw Error("source-path-alias");
    return dest;
  }
  url(value) {
    if (
      this.allowLocalFixture &&
      typeof value === "string" &&
      path.isAbsolute(value) &&
      !/[\0\r\n]/.test(value)
    )
      return directory(value);
    let url;
    try {
      url = new URL(value);
    } catch {
      throw Error("unsafe-source-url");
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      /[\s\x00-\x1f\x7f]/.test(value)
    )
      throw Error("unsafe-source-url");
    return url.href;
  }
  async run(cwd, args) {
    this.verifyGlobalConfig();
    const result = await boundedProcess(
      this.git,
      [
        "-c",
        `core.hooksPath=${this.hooks}`,
        "-c",
        "credential.helper=",
        "-c",
        "protocol.allow=never",
        "-c",
        "protocol.https.allow=always",
        "-c",
        `protocol.file.allow=${this.allowLocalFixture ? "always" : "never"}`,
        ...(cwd ? ["-C", cwd] : []),
        ...args,
      ],
      {
        timeoutMs: 600000,
        maxBytes: 4 * 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: this.globalConfig,
          GIT_TERMINAL_PROMPT: "0",
          GIT_LFS_SKIP_SMUDGE: "1",
        },
      },
    ).completion;
    this.verifyGlobalConfig();
    if (result.state !== "succeeded") {
      const error = Error(`git-${result.state}`);
      error.result = { state: result.state, code: result.code };
      throw error;
    }
    return result.stdout;
  }
  project(projectId) {
    const project = this.projects.get(projectId);
    if (
      !project ||
      this.destination(project.grantId, project.directory) !== project.source ||
      identity(project.source) !== project.identity ||
      fs.lstatSync(path.join(project.source, ".git")).isSymbolicLink()
    )
      throw Error("source-project-unavailable");
    return project;
  }
  async exclusive(source, action, requireExternal = false) {
    if (this.busy.has(source)) throw Error("source-busy");
    this.busy.add(source);
    let release;
    try {
      if (requireExternal && typeof this.acquireSourceLock !== "function")
        throw Error("source-lock-unavailable");
      release = this.acquireSourceLock
        ? await this.acquireSourceLock(source)
        : () => {};
      if (typeof release !== "function") throw Error("source-lock-unavailable");
      return await action();
    } finally {
      try {
        release?.();
      } finally {
        this.busy.delete(source);
      }
    }
  }
  async adopt({ grantId, directory: name, trustedSource }) {
    if (trustedSource !== true) throw Error("source-trust-consent-required");
    const source = this.destination(grantId, name);
    if (
      !fs.statSync(path.join(source, ".git")).isDirectory() ||
      fs.lstatSync(path.join(source, ".git")).isSymbolicLink()
    )
      throw Error("ordinary-git-worktree-required");
    const top = (
      await this.run(source, ["rev-parse", "--show-toplevel"])
    ).trim();
    if (directory(top) !== source) throw Error("source-repository-boundary");
    const projectId = crypto.randomUUID();
    this.projects.set(projectId, {
      grantId,
      directory: name,
      source,
      identity: identity(source),
    });
    return { projectId, source, ...(await this.status(projectId)) };
  }
  async clone({ grantId, directory: name, url, ref = "HEAD", trustedSource }) {
    if (trustedSource !== true) throw Error("source-trust-consent-required");
    if (!safeRef(ref)) throw Error("invalid-source-ref");
    url = this.url(url);
    const destination = this.destination(grantId, name);
    if (fs.existsSync(destination) && fs.readdirSync(destination).length)
      throw Error("destination-not-empty");
    return this.exclusive(destination, async () => {
      this.destination(grantId, name);
      await this.run(null, [
        "clone",
        "--no-local",
        "--no-checkout",
        "--no-recurse-submodules",
        "--",
        url,
        destination,
      ]);
      const revision = await this.resolve(destination, ref);
      await this.run(destination, ["checkout", "--detach", revision]);
      return this.adopt({ grantId, directory: name, trustedSource });
    });
  }
  async resolve(source, ref) {
    if (!safeRef(ref)) throw Error("invalid-source-ref");
    const revision = (
      await this.run(source, [
        "rev-parse",
        "--verify",
        "--end-of-options",
        `${ref}^{commit}`,
      ])
    ).trim();
    if (!/^[a-f0-9]{40,64}$/.test(revision))
      throw Error("invalid-source-revision");
    return revision;
  }
  async status(projectId) {
    const project = this.project(projectId);
    const revision = await this.resolve(project.source, "HEAD");
    const changes = await this.run(project.source, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]);
    const branch = (
      await this.run(project.source, ["branch", "--show-current"])
    ).trim();
    return {
      revision,
      branch: branch || null,
      dirty: changes.length > 0,
      changes,
      snapshots: await this.snapshots(projectId),
    };
  }
  async snapshots(projectId) {
    const project = this.project(projectId);
    const text = await this.run(project.source, ["for-each-ref", "--sort=-refname", "--count=100", "--format=%(refname) %(objectname)", "refs/material-buildroot/snapshots/"]);
    return text.trim().split("\n").filter(Boolean).map(line => {
      const match = /^refs\/material-buildroot\/snapshots\/(\d{13}-[a-f0-9-]{36}) ([a-f0-9]{40}|[a-f0-9]{64})$/.exec(line.trim());
      return match ? { id: match[1], revision: match[2], createdAt: new Date(Number(match[1].slice(0, 13))).toISOString() } : null;
    }).filter(Boolean);
  }
  async snapshotRevision(projectId, snapshotId) {
    if (!/^\d{13}-[a-f0-9-]{36}$/.test(snapshotId || "")) throw Error("snapshot-unavailable");
    const project = this.project(projectId);
    return this.resolve(project.source, `refs/material-buildroot/snapshots/${snapshotId}`);
  }
  async retainRevision(projectId, revision) {
    const project = this.project(projectId);
    const id = `${Date.now()}-${crypto.randomUUID()}`;
    // A separate immutable ref retains the exact prior commit without altering user branches.
    await this.run(project.source, ["update-ref", `refs/material-buildroot/snapshots/${id}`, revision, "0".repeat(revision.length)]);
    return { id, revision, createdAt: new Date(Number(id.slice(0, 13))).toISOString() };
  }
  async snapshot({ projectId, expectedRevision }) {
    const project = this.project(projectId);
    return this.exclusive(project.source, async () => {
      const current = await this.status(projectId);
      if (current.dirty || current.revision !== expectedRevision) throw Error("upgrade-source-changed-or-dirty");
      const snapshot = await this.retainRevision(projectId, current.revision);
      return { ...(await this.status(projectId)), snapshot };
    }, true);
  }
  async acquireRef({ projectId, ref }) {
    if (!safeRef(ref)) throw Error("invalid-source-ref");
    const project = this.project(projectId);
    return this.exclusive(project.source, async () => {
      const origin = (
        await this.run(project.source, ["remote", "get-url", "origin"])
      ).trim();
      this.url(origin);
      // Explicit refspec prevents option interpretation and never updates the current branch.
      await this.run(project.source, [
        "fetch",
        "--no-tags",
        "--no-recurse-submodules",
        "--",
        origin,
        ref,
      ]);
      return {
        fetchedRevision: await this.resolve(project.source, "FETCH_HEAD"),
        ...(await this.status(projectId)),
      };
    }, true);
  }
  async previewUpgrade({ projectId, revision }) {
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision || ""))
      throw Error("immutable-revision-required");
    const project = this.project(projectId);
    const before = await this.status(projectId);
    const target = await this.resolve(project.source, revision);
    const diff = await this.run(project.source, [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--stat",
      before.revision,
      target,
      "--",
    ]);
    const files = (await this.run(project.source, ["diff", "--no-ext-diff", "--no-textconv", "--name-only", "-z", before.revision, target, "--"])).split("\0").filter(Boolean);
    const patch = await this.run(project.source, ["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=3", before.revision, target, "--"]);
    const compatibilityAreas = [
      ["toolchain", /^(toolchain|arch)\//], ["configuration", /(^|\/)(Config\.in[^/]*|.*_defconfig)$|^configs\//],
      ["packages", /^package\//], ["kernel", /^(linux|boot)\//], ["build-system", /^(Makefile|support\/|system\/|fs\/)/],
    ].filter(([, pattern]) => files.some(file => pattern.test(file))).map(([area]) => area);
    const previewId = crypto.randomUUID();
    this.previews.set(previewId, { projectId, before, target, expiresAt: Date.now() + 10 * 60 * 1000 });
    return {
      previewId,
      fromRevision: before.revision,
      toRevision: target,
      dirty: before.dirty,
      diff,
      patch,
      changedFiles: files,
      compatibilityAreas,
      outputCompatibility: "unknown",
      outputPreserved: true,
    };
  }
  async applyUpgrade({ previewId, expectedRevision, consent }) {
    const preview = this.previews.get(previewId);
    if (
      !preview ||
      preview.expiresAt < Date.now() ||
      consent !== true ||
      preview.before.revision !== expectedRevision
    )
      throw Error("upgrade-consent-or-preview-invalid");
    const project = this.project(preview.projectId);
    return this.exclusive(
      project.source,
      async () => {
        this.project(preview.projectId);
        const current = await this.status(preview.projectId);
        if (
          current.revision !== expectedRevision ||
          current.dirty ||
          preview.before.dirty
        )
          throw Error("upgrade-source-changed-or-dirty");
        const snapshot = await this.retainRevision(preview.projectId, expectedRevision);
        await this.run(project.source, [
          "checkout",
          "--detach",
          "--no-overwrite-ignore",
          preview.target,
        ]);
        this.previews.delete(previewId);
        return {
          ...(await this.status(preview.projectId)),
          rollbackRevision: expectedRevision,
          snapshot,
          outputPreserved: true,
          outputCompatibility: "unknown",
        };
      },
      true,
    );
  }
}
module.exports = { SourceService };
