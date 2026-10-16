"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const SETTINGS = ["BR2_ROOTFS_USERS_TABLES", "BR2_ROOTFS_OVERLAY", "BR2_ROOTFS_DEVICE_TABLE"];
async function read(file, limit = 1024 * 1024) {
  const info = await fs.lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > limit || await fs.realpath(file) !== file) fail("UNSAFE_PROVISIONING_INPUT");
  return fs.readFile(file, "utf8");
}
async function exists(file) { return fs.lstat(file).then(() => true, error => { if (error.code === "ENOENT") return false; throw error; }); }
function publicKey(text) {
  // Deliberately narrow: one Ed25519 public key, no options, comments or private data.
  if (typeof text !== "string" || text.length > 2048 || /PRIVATE|BEGIN|END/.test(text)) fail("INVALID_PUBLIC_KEY");
  const match = text.trim().match(/^ssh-ed25519 ([A-Za-z0-9+/]+={0,2})(?: [^\r\n]*)?$/);
  if (!match) fail("INVALID_PUBLIC_KEY");
  const raw = Buffer.from(match[1], "base64");
  if (raw.length !== 51 || raw.readUInt32BE(0) !== 11 || raw.subarray(4, 15).toString() !== "ssh-ed25519" || raw.readUInt32BE(15) !== 32 || raw.toString("base64") !== match[1]) fail("INVALID_PUBLIC_KEY");
  return `ssh-ed25519 ${match[1]}\n`;
}
function createAccountProvisioning({ resolveProject, authorize, configuration, dialog, parentWindow }) {
  const keys = new Map(), plans = new Map();
  let choosing = false;
  function prune() { const now = Date.now(); for (const map of [keys, plans]) for (const [id, value] of map) if (value.expires < now) map.delete(id); }
  async function choose({ workspaceId }) {
    resolveProject(workspaceId); prune();
    if (choosing || keys.size >= 32) fail("PUBLIC_KEY_PICKER_BUSY");
    choosing = true;
    try {
      const result = await dialog.showOpenDialog(parentWindow, { title: "Select one Ed25519 public key", properties: ["openFile", "dontAddToRecent"], filters: [{ name: "Public key", extensions: ["pub"] }] });
      if (result.canceled || result.filePaths?.length !== 1) fail("CANCELLED");
      let key;
      try { key = publicKey(await read(result.filePaths[0], 2048)); } catch { fail("INVALID_PUBLIC_KEY"); }
      resolveProject(workspaceId);
      const id = randomUUID(); keys.set(id, { workspaceId, key, expires: Date.now() + 15 * 60 * 1000 });
      return { keyId: id, type: "ssh-ed25519", expiresInSeconds: 900 };
    } finally { choosing = false; }
  }
  async function context(workspaceId, username, uid) {
    const item = resolveProject(workspaceId), trust = await authorize(workspaceId);
    if (!/^[a-z][a-z0-9_-]{0,30}$/.test(username) || ["root", "nobody", "daemon"].includes(username) || !Number.isInteger(uid) || uid < 2000 || uid > 60000) fail("INVALID_ACCOUNT");
    const mappings = item.runtime?.kind === "docker" ? [["/source", item.source], ["/output", item.output], ...item.externalTrees.map((root, i) => [`/external/${i}`, root])] : item.runtime?.kind === "wsl" && item.storage?.sourceLinux && item.storage?.outputLinux ? [[item.storage.sourceLinux, item.source], [item.storage.outputLinux, item.output]] : null;
    if (!mappings || mappings.some(([linux]) => !/^\/[A-Za-z0-9_./-]+$/.test(linux))) fail("PROVISIONING_RUNTIME_UNSUPPORTED");
    const locate = value => {
      if (/[\s$`\\]/.test(value)) fail("PROVISIONING_PATH_UNSUPPORTED");
      const absolute = path.posix.resolve(mappings[0][0], value);
      const mapping = [...mappings].sort((a,b) => b[0].length-a[0].length).find(([root]) => absolute === root || absolute.startsWith(root + "/"));
      if (!mapping) fail("PROVISIONING_PATH_NOT_GRANTED");
      return path.join(mapping[1], path.posix.relative(mapping[0], absolute));
    };
    const snapshot = await configuration.inspect({ workspaceId, domain: "buildroot" });
    const symbols = new Map(); const walk = node => { if (node.symbol) symbols.set(node.symbol, node); for (const child of node.children || []) walk(child); };
    if (!snapshot.semantics?.available) fail("KCONFIG_SEMANTICS_UNAVAILABLE"); walk(snapshot.semantics.tree);
    for (const name of SETTINGS) if (symbols.get(name)?.type !== "string" || symbols.get(name)?.visibility === 0) fail("PROVISIONING_SYMBOL_UNAVAILABLE");
    if (snapshot.values.BR2_PACKAGE_DROPBEAR !== true && snapshot.values.BR2_PACKAGE_OPENSSH !== true) fail("SELECT_SSH_SERVER_FIRST");
    const inputs = [];
    for (const relative of ["support/scripts/mkusers", "package/makedevs/makedevs.c", "docs/manual/makeusers-syntax.adoc", "docs/manual/makedev-syntax.adoc", "system/Config.in", "fs/common.mk"]) {
      const text = await read(path.join(item.source, ...relative.split("/")));
      inputs.push([relative, hash(text)]);
      if (relative.endsWith("makeusers-syntax.adoc") && (!text.includes("password") || !text.includes("crypt") || !text.includes("shell"))) fail("PROVISIONING_SOURCE_UNSUPPORTED");
    }
    const lists = {};
    for (const name of SETTINGS) {
      const value = snapshot.values[name] ?? ""; if (typeof value !== "string" || value.length > 16384) fail("PROVISIONING_PATH_UNSUPPORTED");
      lists[name] = value;
      for (const valuePath of value.trim().split(/\s+/).filter(Boolean)) {
        const file = locate(valuePath);
        if (name === "BR2_ROOTFS_OVERLAY") {
          if (await fs.realpath(file) !== file || !(await fs.lstat(file)).isDirectory()) fail("UNSAFE_PROVISIONING_INPUT");
          if (await exists(path.join(file, "home", username))) fail("ACCOUNT_OVERLAY_EXISTS");
          // Identity files could replace all users and invalidate the account plan.
          if (await exists(path.join(file, "etc", "passwd")) || await exists(path.join(file, "etc", "group")) || await exists(path.join(file, "etc", "shadow"))) fail("ACCOUNT_IDENTITY_OVERLAY_UNSUPPORTED");
          inputs.push([valuePath, "overlay-without-account-path"]);
        } else {
          const text = await read(file); inputs.push([valuePath, hash(text)]);
          for (const line of text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#"))) {
            const fields = line.trim().split(/\s+/);
            if (name === "BR2_ROOTFS_USERS_TABLES" && (fields[0] === username || fields[2] === username || fields[1] === String(uid) || fields[3] === String(uid))) fail("ACCOUNT_ALREADY_DEFINED");
            if (name === "BR2_ROOTFS_DEVICE_TABLE" && (fields[0] === `/home/${username}` || fields[0].startsWith(`/home/${username}/`))) fail("ACCOUNT_PERMISSION_EXISTS");
          }
        }
      }
    }
    if (snapshot.values.BR2_ROOTFS_SKELETON_CUSTOM === true) fail("CUSTOM_SKELETON_ACCOUNT_UNSUPPORTED");
    for (const kind of ["passwd", "group"]) {
      const text = await read(path.join(item.source, "system", "skeleton", "etc", kind)); inputs.push([kind, hash(text)]);
      if (text.split(/\r?\n/).some(line => { const fields = line.split(":"); return fields[0] === username || fields[2] === String(uid); })) fail("ACCOUNT_ALREADY_DEFINED");
    }
    resolveProject(workspaceId); await authorize(workspaceId);
    return { item, snapshot, lists, outputLinux: mappings[1][0], binding: hash(JSON.stringify([trust, snapshot.revision, inputs, mappings, username, uid])) };
  }
  async function preview({ workspaceId, username, uid, keyId }) {
    prune(); if (plans.size >= 32) fail("PROVISIONING_PLAN_LIMIT"); const key = keys.get(keyId); if (!key || key.workspaceId !== workspaceId) fail("PUBLIC_KEY_SELECTION_EXPIRED");
    const c = await context(workspaceId, username, uid), id = randomUUID(), directory = `material-account-${id}`;
    plans.set(id, { workspaceId, username, uid, keyId, binding: c.binding, directory, expires: Date.now() + 10 * 60 * 1000 });
    return { planId: id, username, uid, gid: uid, password: "locked", keyType: "ssh-ed25519", home: `/home/${username}`, shell: "/bin/sh", outputDirectory: directory, preservedSettings: SETTINGS, files: ["users.txt", "permissions.txt", `overlay/home/${username}/.ssh/authorized_keys`], previewKind: "configuration-plan", authenticationVerified: false };
  }
  async function apply({ workspaceId, planId }) {
    prune(); const plan = plans.get(planId); if (!plan || plan.workspaceId !== workspaceId) fail("PROVISIONING_PLAN_EXPIRED");
    const key = keys.get(plan.keyId); if (!key || key.workspaceId !== workspaceId) fail("PUBLIC_KEY_SELECTION_EXPIRED");
    const c = await context(workspaceId, plan.username, plan.uid);
    if (c.binding !== plan.binding) fail("PROVISIONING_SOURCE_CHANGED");
    plans.delete(planId);
    if (await fs.realpath(c.item.output) !== c.item.output) fail("UNSAFE_PROVISIONING_OUTPUT");
    const destination = path.join(c.item.output, plan.directory);
    await fs.mkdir(destination, { mode: 0o700 });
    const home = `/home/${plan.username}`, overlay = path.join(destination, "overlay"), ssh = path.join(overlay, "home", plan.username, ".ssh");
    await fs.mkdir(ssh, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(destination, "users.txt"), `${plan.username} ${plan.uid} ${plan.username} ${plan.uid} ! ${home} /bin/sh -\n`, { flag: "wx", mode: 0o600 });
    await fs.writeFile(path.join(ssh, "authorized_keys"), key.key, { flag: "wx", mode: 0o600 });
    const permissions = `${home} d 700 ${plan.uid} ${plan.uid} - - - - -\n${home}/.ssh d 700 ${plan.uid} ${plan.uid} - - - - -\n${home}/.ssh/authorized_keys f 600 ${plan.uid} ${plan.uid} - - - - -\n`;
    await fs.writeFile(path.join(destination, "permissions.txt"), permissions, { flag: "wx", mode: 0o600 });
    const base = c.outputLinux + "/" + plan.directory;
    const additions = [base + "/users.txt", base + "/overlay", base + "/permissions.txt"];
    const changes = Object.fromEntries(SETTINGS.map((name, i) => [name, { type: "string", value: [c.lists[name], additions[i]].filter(Boolean).join(" ") }]));
    let result;
    try { result = await configuration.apply({ workspaceId, domain: "buildroot", revision: c.snapshot.revision, changes }); }
    catch { fail("ACCOUNT_FILES_RETAINED_CONFIGURATION_NOT_CONFIRMED"); }
    keys.delete(plan.keyId);
    return { revision: result.revision, outputDirectory: plan.directory, username: plan.username, uid: plan.uid, password: "locked", effectiveSettings: Object.fromEntries(SETTINGS.map(name => [name, result.values[name]])), configurationMatched: SETTINGS.every(name => result.values[name] === changes[name].value), authenticationVerified: false, buildRequired: true };
  }
  return { choose, preview, apply };
}
module.exports = { createAccountProvisioning };
