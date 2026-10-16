"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const {
  extractZip,
  zipInventory,
} = require("../src/main/tools/zip-payload.cjs");
const {
  createManagedOllamaController,
} = require("../src/main/tools/ollama-managed.cjs");
const { admit } = require("../src/main/tools/request-contract.cjs");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function zip(members) {
  const local = [],
    central = [];
  let offset = 0;
  for (const [name, bytes] of members) {
    const filename = Buffer.from(name),
      header = Buffer.alloc(30),
      record = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc(bytes), 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt32LE(crc(bytes), 16);
    record.writeUInt32LE(bytes.length, 20);
    record.writeUInt32LE(bytes.length, 24);
    record.writeUInt16LE(filename.length, 28);
    record.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes);
    central.push(record, filename);
    offset += 30 + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
async function fixture(work) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "managed-ollama-"));
  try {
    await work(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
function payload(bytes, members) {
  return {
    version: "1.2.3",
    platform: process.platform,
    arch: process.arch,
    kind: "zip",
    url: "https://github.com/ollama/ollama/releases/download/v1.2.3/fixture.zip",
    length: bytes.length,
    sha256: sha(bytes),
    executablePath: "ollama",
    members: members.map(([name, data]) => ({
      path: name,
      length: data.length,
      sha256: sha(data),
    })),
  };
}
test("ZIP extraction validates complete inventory, hashes, traversal and Windows path aliases", () =>
  fixture(async (directory) => {
    const members = [
        ["ollama", Buffer.from("fixture executable bytes")],
        ["lib/license", Buffer.from("fixture licence")],
      ],
      bytes = zip(members),
      file = path.join(directory, "fixture.zip"),
      out = path.join(directory, "out");
    await fs.writeFile(file, bytes);
    await fs.mkdir(out);
    assert.equal((await zipInventory(file)).length, 2);
    await extractZip(file, out, payload(bytes, members).members);
    assert.equal(
      await fs.readFile(path.join(out, "lib/license"), "utf8"),
      "fixture licence",
    );
    for (const name of [
      "../escape",
      "CON.txt",
      "lib/../escape",
      "C:/escape",
      "lib/name.",
    ]) {
      await fs.writeFile(file, zip([[name, Buffer.from("x")]]));
      await assert.rejects(zipInventory(file), {
        code: "UNSUPPORTED_ZIP_MEMBER",
      });
    }
    await fs.writeFile(file, bytes);
    await assert.rejects(extractZip(file, out, []), {
      code: "ARCHIVE_MEMBER_NOT_ADMITTED",
    });
  }));
test("managed cached installation owns version/cache/model roots and never starts runtime", () =>
  fixture(async (directory) => {
    const members = [["ollama", Buffer.from("fixture bytes")]],
      bytes = zip(members),
      cached = path.join(directory, "bundled.zip"),
      root = path.join(directory, "owned");
    await fs.writeFile(cached, bytes);
    const manifest = payload(bytes, members),
      progress = [];
    const controller = createManagedOllamaController({
      directory: root,
      manifest,
      bundledPayload: cached,
      confirmInstall: async (review) => {
        assert.equal(review.acquire, false);
        return true;
      },
    });
    const result = await controller.execute(
      { action: "ollama.install" },
      { onProgress: (event) => progress.push(event.phase) },
    );
    assert.equal(result.installed, true);
    assert.equal(result.started, false);
    assert.equal((await controller.status()).running, false);
    assert.equal((await controller.status()).installed, true);
    assert.equal((await fs.readdir(path.join(root, "cache"))).length, 1);
    assert.equal(
      JSON.parse(
        await fs.readFile(path.join(root, "installation.json"), "utf8"),
      ).nativeRuntimeVerified,
      false,
    );
    await assert.rejects(controller.start(), {
      // The non-executable fixture cannot establish runtime ownership on either platform.
      code: process.platform === "win32" ? "NATIVE_OWNERSHIP_FAILED" : "OWNED_RUNTIME_VERIFICATION_UNAVAILABLE",
    });
    assert.ok(progress.includes("verify"));
    await controller.dispose();
  }));
test("managed confirmation cancellation and corrupted recovery preserve earlier bytes and models", () =>
  fixture(async (directory) => {
    const members = [["ollama", Buffer.from("fixture bytes")]],
      bytes = zip(members),
      cached = path.join(directory, "bundled.zip"),
      root = path.join(directory, "owned"),
      manifest = payload(bytes, members);
    await fs.writeFile(cached, bytes);
    const denied = createManagedOllamaController({
      directory: root,
      manifest,
      bundledPayload: cached,
      confirmInstall: async () => false,
    });
    assert.equal(
      (await denied.execute({ action: "ollama.install" })).cancelled,
      true,
    );
    await assert.rejects(fs.stat(root), { code: "ENOENT" });
    const controller = createManagedOllamaController({
      directory: root,
      manifest,
      bundledPayload: cached,
      confirmInstall: async () => true,
    });
    await controller.execute({ action: "ollama.install" });
    await fs.mkdir(path.join(root, "models"));
    await fs.writeFile(path.join(root, "models", "existing"), "preserved");
    const installed = path.join(
      root,
      "versions",
      "1.2.3-" + process.platform + "-" + process.arch,
      "ollama",
    );
    await fs.writeFile(installed, "damaged");
    await assert.rejects(controller.execute({ action: "ollama.install" }), {
      code: "PAYLOAD_HASH_MISMATCH",
    });
    assert.equal(
      (await controller.execute({ action: "ollama.install", repair: true }))
        .installed,
      true,
    );
    assert.equal(
      await fs.readFile(path.join(root, "models", "existing"), "utf8"),
      "preserved",
    );
    const retained = (await fs.readdir(path.join(root, "versions"))).find(
      (name) => name.startsWith(".retained-"),
    );
    assert.equal(
      await fs.readFile(
        path.join(root, "versions", retained, "ollama"),
        "utf8",
      ),
      "damaged",
    );
  }));
test("managed acquisition is opt-in, pinned, cancellable and never accepts renderer URLs", () =>
  fixture(async (directory) => {
    assert.throws(
      () => admit({ action: "ollama.install", url: "https://example.com" }),
      { code: "INVALID_REQUEST" },
    );
    const members = [["ollama", Buffer.from("fixture bytes")]],
      bytes = zip(members),
      manifest = payload(bytes, members);
    let calls = 0;
    const controller = createManagedOllamaController({
      directory: path.join(directory, "owned"),
      manifest,
      confirmInstall: async () => true,
      fetchImpl: async (url) => {
        calls++;
        assert.equal(url, manifest.url);
        return new Response(bytes);
      },
    });
    await assert.rejects(controller.execute({ action: "ollama.install" }), {
      code: "OFFLINE_PAYLOAD_MISSING",
    });
    assert.equal(calls, 0);
    assert.equal(
      (await controller.execute({ action: "ollama.install", acquire: true }))
        .installed,
      true,
    );
    assert.equal(calls, 1);
    const cancelled = createManagedOllamaController({
      directory: path.join(directory, "cancelled"),
      manifest,
      confirmInstall: async () => true,
      fetchImpl: async () => new Response(bytes),
    });
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(
      cancelled.execute(
        { action: "ollama.install", acquire: true },
        { signal: abort.signal },
      ),
      { code: "CANCELLED" },
    );
  }));
test("active download cancellation closes real HTTP transport and removes incomplete staging", () =>
  fixture(async (directory) => {
    const http = require("node:http");
    const members = [["ollama", Buffer.alloc(1024 * 1024, 65)]],
      bytes = zip(members),
      manifest = payload(bytes, members),
      root = path.join(directory, "owned");
    const server = http.createServer((_request, response) => {
      response.writeHead(200);
      response.write(bytes.subarray(0, 64));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const abort = new AbortController();
      const controller = createManagedOllamaController({
        directory: root,
        manifest,
        confirmInstall: async () => true,
        fetchImpl: (_url, init) =>
          fetch("http://127.0.0.1:" + server.address().port, init),
      });
      await assert.rejects(
        controller.execute(
          { action: "ollama.install", acquire: true },
          {
            signal: abort.signal,
            onProgress: (event) => {
              if (event.phase === "download") abort.abort();
            },
          },
        ),
        { name: "AbortError" },
      );
      assert.equal((await controller.status()).installed, false);
      assert.deepEqual(await fs.readdir(path.join(root, "versions")), []);
      assert.equal((await controller.status()).phase, "cancelled");
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }));
test("active extraction cancellation preserves verified cache and removes partial installed files", () =>
  fixture(async (directory) => {
    const members = [["ollama", Buffer.alloc(1024 * 1024, 65)]],
      bytes = zip(members),
      manifest = payload(bytes, members),
      root = path.join(directory, "owned"),
      bundled = path.join(directory, "bundle.zip");
    await fs.writeFile(bundled, bytes);
    const abort = new AbortController();
    const controller = createManagedOllamaController({
      directory: root,
      manifest,
      bundledPayload: bundled,
      confirmInstall: async () => true,
    });
    await assert.rejects(
      controller.execute(
        { action: "ollama.install" },
        {
          signal: abort.signal,
          onProgress: (event) => {
            if (event.phase === "extract" && event.completed > 0) abort.abort();
          },
        },
      ),
    );
    assert.equal((await controller.status()).installed, false);
    assert.deepEqual(await fs.readdir(path.join(root, "versions")), []);
    assert.equal((await fs.readdir(path.join(root, "cache"))).length, 1);
  }));
test("typed managed cancellation interrupts pending download while status stays available", () =>
  fixture(async (directory) => {
    const http = require("node:http");
    const members = [["ollama", Buffer.alloc(1024 * 1024, 65)]],
      bytes = zip(members),
      manifest = payload(bytes, members);
    let resolveReady;
    const ready = new Promise((resolve) => (resolveReady = resolve));
    const server = http.createServer((_request, response) => {
      response.writeHead(200);
      response.write(bytes.subarray(0, 64));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const controller = createManagedOllamaController({
        directory: path.join(directory, "owned"),
        manifest,
        confirmInstall: async () => true,
        fetchImpl: (_url, init) =>
          fetch("http://127.0.0.1:" + server.address().port, init),
      });
      const pending = controller.execute(
        { action: "ollama.install", acquire: true },
        {
          onProgress: (event) => {
            if (event.phase === "download") resolveReady();
          },
        },
      );
      const rejection = assert.rejects(pending, { name: "AbortError" });
      await ready;
      assert.equal(
        (await controller.execute({ action: "ollama.managed.status" })).phase,
        "download",
      );
      assert.equal(
        (await controller.execute({ action: "ollama.managed.cancel" }))
          .cancelling,
        true,
      );
      await rejection;
      assert.equal(
        (await controller.execute({ action: "ollama.managed.status" })).phase,
        "cancelled",
      );
      assert.throws(() => admit({ action: "ollama.managed.cancel", pid: 1 }), {
        code: "INVALID_REQUEST",
      });
      await controller.dispose();
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }));
