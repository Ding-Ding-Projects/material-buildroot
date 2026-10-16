"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRecord, readManifest, readBoundedText, compareRecords, parseLegalManifest } = require("./reproducibility.cjs");
function fail(message) {
  throw new Error(message);
}
function safePath(root, relative, directory = false) {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.isAbsolute(relative) ||
    /[\0\r\n]/.test(relative)
  )
    fail("invalid-artifact-path");
  const candidate = fs.realpathSync(path.resolve(root, relative));
  const rel = path.relative(root, candidate);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
    fail("artifact-outside-root");
  const stat = fs.statSync(candidate);
  if (directory ? !stat.isDirectory() : !stat.isFile())
    fail("invalid-artifact-type");
  return candidate;
}
async function hashFile(file) {
  const fd = fs.openSync(
    file,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
  );
  const before = fs.fstatSync(fd, { bigint: true });
  if (!before.isFile()) {
    fs.closeSync(fd);
    fail("artifact-not-regular");
  }
  const hash = crypto.createHash("sha256");
  try {
    for await (const chunk of fs.createReadStream(file, {
      fd,
      autoClose: false,
    }))
      hash.update(chunk);
    const after = fs.fstatSync(fd, { bigint: true });
    if (
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    )
      fail("artifact-changed-during-read");
    return hash.digest("hex");
  } finally {
    fs.closeSync(fd);
  }
}
function headerInfo(buffer, size) {
  const magic = buffer.subarray(0, 4).toString("hex");
  let format = "unknown";
  if (magic === "514649fb") format = "qcow2";
  else if (
    magic === "4b444d56" ||
    buffer.subarray(0, 21).toString() === "# Disk DescriptorFile"
  )
    format = "vmdk";
  else if (buffer.subarray(64, 68).toString("hex") === "7f10dabe")
    format = "vdi";
  else if (buffer.subarray(0, 2).toString("hex") === "1f8b") format = "gzip";
  else if (buffer.subarray(0, 6).toString("hex") === "fd377a585a00")
    format = "xz";
  else if (buffer.subarray(0, 4).toString("hex") === "504b0304") format = "zip";
  else if (buffer.subarray(257, 262).toString() === "ustar") format = "tar";
  if (buffer.subarray(32769, 32774).toString() === "CD001") format = "iso9660";
  const partitions = [];
  if (buffer.length >= 512 && buffer.readUInt16LE(510) === 0xaa55) {
    if (format === "unknown") format = "raw-disk";
    for (let i = 0; i < 4; i++) {
      const at = 446 + i * 16,
        type = buffer[at + 4],
        startLba = buffer.readUInt32LE(at + 8),
        sectors = buffer.readUInt32LE(at + 12);
      if (type && sectors)
        partitions.push({
          index: i + 1,
          type,
          startLba,
          sectors,
          offset: startLba * 512,
          bytes: sectors * 512,
          withinImage: (startLba + sectors) * 512 <= size,
        });
    }
  }
  if (buffer.subarray(512, 520).toString() === "EFI PART") {
    format = "gpt-disk";
    const entryLba = Number(buffer.readBigUInt64LE(584)),
      count = buffer.readUInt32LE(592),
      entrySize = buffer.readUInt32LE(596);
    if (
      Number.isSafeInteger(entryLba) &&
      count <= 4096 &&
      entrySize >= 128 &&
      entrySize <= 4096 &&
      entryLba * 512 + count * entrySize <= buffer.length
    ) {
      partitions.length = 0;
      for (let i = 0; i < count; i++) {
        const at = entryLba * 512 + i * entrySize;
        if (buffer.subarray(at, at + 16).every((x) => x === 0)) continue;
        const startLba = Number(buffer.readBigUInt64LE(at + 32)),
          endLba = Number(buffer.readBigUInt64LE(at + 40));
        partitions.push({
          index: i + 1,
          startLba,
          endLba,
          bytes: (endLba - startLba + 1) * 512,
          withinImage:
            Number.isSafeInteger(endLba) &&
            endLba >= startLba &&
            (endLba + 1) * 512 <= size,
          name: buffer
            .subarray(at + 56, at + 128)
            .toString("utf16le")
            .replace(/\0.*$/, ""),
        });
      }
    }
  }
  return { format, partitions, partitionSectorBytes: 512 };
}
class ArtifactStore {
  constructor(root) {
    this.root = fs.realpathSync(root);
    if (!fs.statSync(this.root).isDirectory()) fail("artifact-root-required");
  }
  async listArtifacts(directory = ".") {
    const base = safePath(this.root, directory, true),
      result = [];
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(base, entry.name),
        stat = fs.statSync(file);
      result.push({
        path: path.relative(this.root, file).split(path.sep).join("/"),
        kind: entry.isDirectory() ? "directory" : "file",
        size: stat.size,
      });
    }
    return result.sort((a, b) => a.path.localeCompare(b.path));
  }
  async inspectArtifact(relative) {
    const file = safePath(this.root, relative),
      stat = fs.statSync(file),
      fd = fs.openSync(file, "r"),
      header = Buffer.alloc(Math.min(stat.size, 1024 * 1024));
    try {
      fs.readSync(fd, header, 0, header.length, 0);
    } finally {
      fs.closeSync(fd);
    }
    const info = headerInfo(header, stat.size);
    return {
      path: relative,
      size: stat.size,
      sha256: await hashFile(file),
      ...info,
      preview:
        info.format === "unknown" && !header.subarray(0, 8192).includes(0)
          ? header.subarray(0, 8192).toString("utf8")
          : null,
      previewTruncated: stat.size > 8192,
      archivePolicy: "metadata-only-no-extraction",
    };
  }
  async createManifest({ paths, locks = {} }) {
    if (
      !Array.isArray(paths) ||
      paths.length > 10000 ||
      !paths.length ||
      new Set(paths).size !== paths.length
    )
      fail("invalid-manifest-paths");
    const entries = [];
    for (const relative of [...paths].sort()) {
      const file = safePath(this.root, relative),
        stat = fs.statSync(file);
      entries.push({
        path: relative,
        size: stat.size,
        sha256: await hashFile(file),
      });
    }
    const cleanLocks = {};
    for (const [key, value] of Object.entries(locks)) {
      if (
        ![
          "sourceRevision",
          "configurationSha256",
          "toolchainSha256",
          "buildrootRevision",
          "environmentSha256",
        ].includes(key) ||
        typeof value !== "string" ||
        !/^[a-fA-F0-9]{7,64}$/.test(value)
      )
        fail("invalid-source-lock");
      cleanLocks[key] = value;
    }
    const payload = {
      schemaVersion: 1,
      algorithm: "sha256",
      locks: cleanLocks,
      entries,
    };
    return createRecord(payload);
  }
  async compareManifestFiles(beforePath, afterPath, bind = null) {
    const before = readManifest(safePath(this.root, beforePath));
    const after = readManifest(safePath(this.root, afterPath));
    return compareRecords(before, after, bind ? [bind(before), bind(after)] : []);
  }
  async collectCompliance(directory = "legal-info") {
    const records = [],
      pending = [directory];
    let total = 0;
    while (pending.length) {
      const next = pending.pop();
      for (const entry of await this.listArtifacts(next)) {
        if (++total > 10000) fail("compliance-entry-limit");
        if (entry.kind === "directory") pending.push(entry.path);
        else records.push(await this.inspectArtifact(entry.path));
      }
    }
    const csv = records.filter((x) =>
      /(?:manifest|license).*\.csv$/i.test(x.path),
    );
    const packages = [], manifestErrors = [];
    let parsedBytes = 0;
    for (const record of csv) {
      try {
        if ((parsedBytes += record.size) > 16 * 1024 * 1024) fail("legal-manifest-total-limit");
        const text = readBoundedText(safePath(this.root, record.path), 2 * 1024 * 1024);
        if (crypto.createHash("sha256").update(text).digest("hex") !== record.sha256) fail("legal-manifest-changed");
        packages.push(...parseLegalManifest(text).map(item => ({ ...item, manifestPath: record.path, manifestSha256: record.sha256 })));
      } catch (error) {
        manifestErrors.push({ path: record.path, code: /^[a-z-]+$/.test(error.message) ? error.message : "legal-manifest-unavailable" });
      }
    }
    const collectionDigest = crypto.createHash("sha256").update(JSON.stringify(records.map(({ path, sha256 }) => ({ path, sha256 })))).digest("hex");
    return {
      schemaVersion: 1,
      source: "buildroot-legal-info",
      packages,
      manifestErrors,
      licenseAssessment: "Source declarations only; license compatibility, completeness and legal obligations have not been assessed.",
      files: records,
      manifests: csv.map((x) => ({
        path: x.path,
        content: x.preview,
        truncated: x.previewTruncated,
      })),
      completeness: manifestErrors.length ? "partial-manifest-parsing" : records.length ? "collected-not-legally-reviewed" : "empty",
      spdx: {
        spdxVersion: "SPDX-2.3",
        dataLicense: "CC0-1.0",
        SPDXID: "SPDXRef-DOCUMENT",
        name: "Buildroot legal-info collection",
        documentNamespace: `https://spdx.org/spdxdocs/buildroot-legal-info-${collectionDigest}`,
        creationInfo: { creators: ["Tool: Material Buildroot"], created: new Date().toISOString() },
        packages: packages.map((item, i) => ({
          SPDXID: `SPDXRef-Package-${i}`,
          name: item.name,
          ...(item.version ? { versionInfo: item.version } : {}),
          downloadLocation: "NOASSERTION",
          filesAnalyzed: false,
          licenseConcluded: "NOASSERTION",
          licenseDeclared: "NOASSERTION",
          copyrightText: "NOASSERTION",
          comment: `Source declaration: ${item.sourceLicenseDeclaration || "unavailable"}. Evidence: ${item.manifestPath} (SHA256 ${item.manifestSha256}). No SPDX-expression or legal validation is claimed.`,
        })),
        files: records.map((x, i) => ({
          SPDXID: `SPDXRef-File-${i}`,
          fileName: x.path,
          checksums: [{ algorithm: "SHA256", checksumValue: x.sha256 }],
          licenseConcluded: "NOASSERTION",
        })),
      },
    };
  }
}
function compareManifests(before, after) {
  return compareRecords(before, after);
}
module.exports = {
  ArtifactStore,
  safePath,
  hashFile,
  compareManifests,
  headerInfo,
};
