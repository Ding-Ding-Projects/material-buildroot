"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { fail, digest, processRun } = require("./runtime.cjs");
const TOOLS = Object.freeze({
  vboxmanage: { names: ["vboxmanage"], args: ["--version"], version: /^([0-9]+\.[0-9]+[^\s]*)/m },
  vmrun: { names: ["vmrun"], args: ["-T", "ws", "list"], capability: /^Total running VMs:\s*\d+\s*$/m },
  "qemu-img": { names: ["qemu-img"], args: ["--version"], version: /qemu-img version\s+([^\s]+)/i },
  ffmpeg: {
    names: ["ffmpeg"],
    args: ["-version"],
    version: /ffmpeg version\s+([^\s]+)/i,
  },
  magick: {
    names: ["magick"],
    args: ["-version"],
    version: /ImageMagick\s+([^\s]+)/i,
  },
  pandoc: {
    names: ["pandoc"],
    args: ["--version"],
    version: /pandoc\s+([^\s]+)/i,
  },
  soffice: {
    names: ["soffice", "libreoffice"],
    args: ["--version"],
    version: /LibreOffice\s+([^\s]+)/i,
  },
  "ebook-convert": {
    names: ["ebook-convert"],
    args: ["--version"],
    version: /ebook-convert[^\r\n]*?([0-9]+\.[0-9]+[^\s)]*)/i,
  },
  qpdf: {
    names: ["qpdf"],
    args: ["--version"],
    version: /qpdf version\s+([^\s]+)/i,
  },
  ssh: { names: ["ssh"], args: ["-V"], version: /(OpenSSH[^\s,]*)/i },
  java: {
    names: ["java"],
    args: ["-version"],
    version: /(?:openjdk|java) version\s+"([^"]+)"/i,
  },
  docker: {
    names: ["docker"],
    args: ["--version"],
    version: /Docker version\s+([^\s,]+)/i,
  },
  tar: {
    names: ["tar", "bsdtar"],
    args: ["--version"],
    version: /(?:tar \([^\r\n]+\)|bsdtar)\s+([^\s]+)/i,
  },
  ollama: {
    names: ["ollama"],
    args: ["--version"],
    version: /ollama version(?: is)?\s+([^\s]+)/i,
  },
});
const ALIASES = { imagemagick: "magick", libreoffice: "soffice" };
function toolId(value) {
  const id = ALIASES[value] || value;
  if (!Object.hasOwn(TOOLS, id)) fail("UNKNOWN_TOOL");
  return id;
}
function canonical(file, id) {
  const name = path
    .basename(file)
    .toLowerCase()
    .replace(/\.exe$/, "");
  if (!TOOLS[id].names.includes(name)) fail("EXECUTABLE_NAME_MISMATCH");
}
function createPayloadManager({
  directory,
  bundledManifest = {},
  dialog,
  parentWindow,
} = {}) {
  if (!directory || !path.isAbsolute(directory))
    fail("INVALID_PAYLOAD_DIRECTORY");
  const receiptFile = path.join(directory, "executable-receipts.json");
  let tail = Promise.resolve();
  function locked(work) {
    const next = tail.then(work, work);
    tail = next.catch(() => {});
    return next;
  }
  async function read() {
    try {
      const stat = await fs.lstat(receiptFile);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 131072)
        fail("INVALID_ADMISSION_RECEIPT");
      const document = JSON.parse(await fs.readFile(receiptFile, "utf8"));
      if (
        document.version !== 1 ||
        !document.tools ||
        typeof document.tools !== "object" ||
        Array.isArray(document.tools)
      )
        fail("INVALID_ADMISSION_RECEIPT");
      for (const [id, record] of Object.entries(document.tools)) {
        if (
          toolId(id) !== id ||
          record.toolId !== id ||
          record.origin !== "user-selected" ||
          !path.isAbsolute(record.path) ||
          !/^\d{4}-/.test(record.admittedAt || "") ||
          !/^[a-f0-9]{64}$/.test(record.sha256 || "") ||
          typeof record.receiptId !== "string" ||
          typeof record.version !== "string"
        )
          fail("INVALID_ADMISSION_RECEIPT");
        canonical(record.path, id);
      }
      return document;
    } catch (error) {
      if (error.code === "ENOENT") return { version: 1, tools: {} };
      throw error;
    }
  }
  async function write(document) {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = path.join(directory, ".receipts-" + randomUUID());
    let handle;
    try {
      handle = await fs.open(temporary, "wx", 0o600);
      await handle.writeFile(JSON.stringify(document));
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(temporary, receiptFile);
    } finally {
      await handle?.close();
      await fs.rm(temporary, { force: true });
    }
  }
  async function validate(record, id) {
    canonical(record.path, id);
    const real = await fs.realpath(record.path);
    if (real !== record.path) fail("EXECUTABLE_PATH_CHANGED");
    const stat = await fs.lstat(real);
    if (!stat.isFile() || stat.size < 1 || stat.size > 1024 ** 3)
      fail("INVALID_EXECUTABLE");
    if ((await digest(real)) !== record.sha256) fail("PAYLOAD_HASH_MISMATCH");
    return record;
  }
  async function resolve(value) {
    const id = toolId(value),
      bundled = bundledManifest[id];
    if (bundled) {
      if (
        !path.isAbsolute(bundled.path || "") ||
        !/^[a-f0-9]{64}$/.test(bundled.sha256 || "")
      )
        fail("INVALID_BUNDLED_MANIFEST");
      return validate(
        { ...bundled, toolId: id, origin: "bundled", bundled: true },
        id,
      );
    }
    const document = await read(),
      record = document.tools[id];
    if (!record) fail("MISSING_VERIFIED_PAYLOAD");
    return validate({ ...record, bundled: false }, id);
  }
  async function list() {
    const result = [];
    for (const id of Object.keys(TOOLS)) {
      try {
        const record = await resolve(id);
        result.push({
          toolId: id,
          available: true,
          origin: record.origin,
          bundled: record.bundled,
          version: record.version || null,
          sha256: record.sha256,
        });
      } catch (error) {
        result.push({
          toolId: id,
          available: false,
          code: /^[A-Z_]+$/.test(error.code || "")
            ? error.code
            : "PAYLOAD_UNAVAILABLE",
        });
      }
    }
    return result;
  }
  async function choose(value) {
    const id = toolId(value);
    if (!dialog?.showOpenDialog || !dialog?.showMessageBox)
      fail("NATIVE_PICKER_UNAVAILABLE");
    const picker = {
      title: "Select " + id + " executable",
      properties: ["openFile"],
      filters:
        process.platform === "win32"
          ? [{ name: "Executable", extensions: ["exe"] }]
          : undefined,
    };
    const selected = parentWindow
      ? await dialog.showOpenDialog(parentWindow, picker)
      : await dialog.showOpenDialog(picker);
    if (selected.canceled || selected.filePaths?.length !== 1)
      return { cancelled: true };
    const selectedPath = selected.filePaths[0];
    if (!path.isAbsolute(selectedPath)) fail("INVALID_EXECUTABLE");
    canonical(selectedPath, id);
    const file = await fs.realpath(selectedPath);
    canonical(file, id);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size < 1 || stat.size > 1024 ** 3)
      fail("INVALID_EXECUTABLE");
    const sha256 = await digest(file);
    const notice = {
      type: "warning",
      title: "Trust selected tool",
      message: "Allow this " + id + " executable?",
      detail:
        "Selecting Allow executes its fixed version or availability probe now and allows later tool operations. This executable runs with your account permissions. Choose only a trusted installation. It is user-selected and is not an application-bundled dependency.\n\n" +
        file +
        "\nSHA-256: " +
        sha256,
      buttons: ["Cancel", "Allow selected tool"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    const consent = parentWindow
      ? await dialog.showMessageBox(parentWindow, notice)
      : await dialog.showMessageBox(notice);
    if (consent.response !== 1) return { cancelled: true };
    if ((await digest(file)) !== sha256) fail("PAYLOAD_HASH_MISMATCH");
    const output = await processRun(file, TOOLS[id].args, {
      timeout: 10000,
      maxBytes: 65536,
    });
    const match = (output.stdout + "\n" + (output.stderr || "")).match(
      TOOLS[id].version || TOOLS[id].capability,
    );
    if (!match) fail("VERSION_PROBE_MISMATCH");
    if ((await digest(file)) !== sha256) fail("PAYLOAD_HASH_MISMATCH");
    const record = {
      toolId: id,
      path: file,
      sha256,
      // A capability response is not a product version, and its paths are never persisted.
      version: TOOLS[id].version ? match[1].slice(0, 128) : "unverified",
      receiptId: randomUUID(),
      origin: "user-selected",
      admittedAt: new Date().toISOString(),
    };
    await locked(async () => {
      const document = await read();
      document.tools[id] = record;
      await write(document);
    });
    return {
      toolId: id,
      available: true,
      origin: record.origin,
      bundled: false,
      version: record.version,
      sha256,
    };
  }
  return { list, choose, resolve };
}
module.exports = { createPayloadManager, TOOLS };
