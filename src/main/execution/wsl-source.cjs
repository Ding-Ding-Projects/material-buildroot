"use strict";
const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");
const { SourceService } = require("./source.cjs");
const { isWslReceipt, verifyWslProject, wrapBuild } = require("./wsl-project.cjs");

/** Source authority stays in the host. No renderer command or filesystem path is accepted. */
class WslSourceService extends SourceService {
  constructor({ receipt, run, acquireSourceLock }) {
    if (!isWslReceipt(receipt) || typeof run !== "function" || typeof acquireSourceLock !== "function") throw Error("wsl-project-authority-required");
    super({ acquireSourceLock });
    this.receipt = receipt;
    this.execute = run;
    this.context = new AsyncLocalStorage();
    this.ownedProjectId = randomUUID();
    this.projects.set(this.ownedProjectId, { source: receipt.storage.sourceLinux });
    this.leased = false;
  }
  async adoptWorkspace() {
    await verifyWslProject(this.receipt, this.execute);
    return {projectId:this.ownedProjectId, source:this.receipt.paths.source, ...(await this.status(this.ownedProjectId))};
  }
  project(projectId) {
    if (projectId !== this.ownedProjectId || !isWslReceipt(this.receipt)) throw Error("source-project-unavailable");
    return this.projects.get(projectId);
  }
  async withLease(action) {
    if (this.context.getStore() === this) return action();
    if (this.leased) throw Error("source-busy");
    this.leased = true;
    let release;
    try {
      release = await this.acquireSourceLock(this.receipt.paths.source);
      if (typeof release !== "function") throw Error("source-lock-unavailable");
      return await this.context.run(this, action);
    } finally {
      try { release?.(); } finally { this.leased = false; }
    }
  }
  exclusive(_source, action) { return this.withLease(action); }
  status(projectId) { return this.withLease(() => super.status(projectId)); }
  snapshots(projectId) { return this.withLease(() => super.snapshots(projectId)); }
  snapshotRevision(projectId, id) { return this.withLease(() => super.snapshotRevision(projectId, id)); }
  previewUpgrade(request) { return this.withLease(() => super.previewUpgrade(request)); }
  async run(cwd, args) {
    if (this.context.getStore() !== this || cwd !== this.receipt.storage.sourceLinux) throw Error("wsl-project-authority-required");
    if (!Array.isArray(args) || !["rev-parse","status","branch","for-each-ref","update-ref","remote","fetch","diff","checkout"].includes(args[0])) throw Error("wsl-source-operation-unavailable");
    await verifyWslProject(this.receipt, this.execute);
    // The fixed identity preamble checks again inside the very process that invokes Git.
    const script = wrapBuild('source="$1"; shift 2; test -d "$source/.git" && test ! -L "$source/.git" || exit 78; exec env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 GIT_LFS_SKIP_SMUDGE=1 git -c core.hooksPath=/dev/null -c credential.helper= -c protocol.allow=never -c protocol.https.allow=always -c protocol.file.allow=never -C "$source" "$@"');
    const s = this.receipt.storage;
    const result = await this.execute(["--distribution",s.distribution,"--exec","/bin/sh","-c",script,"source",s.rootLinux,this.receipt.proof,s.sourceLinux,s.outputLinux,...args]);
    if (result.state !== "succeeded") throw Error(`git-${result.state}`);
    return result.stdout;
  }
}
module.exports = { WslSourceService };
