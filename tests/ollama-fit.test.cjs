"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createToolsService } = require("../src/main/tools/index.cjs");
const {
  evaluateFit,
  modelEvidence,
  hardwareSnapshot,
} = require("../src/main/tools/ollama-fit.cjs");
const GiB = 1024 ** 3;
const tag = { name: "fixture:latest", digest: "a".repeat(64), size: 4 * GiB };
const show = {
  capabilities: ["completion", "vision", "tools"],
  details: { quantization_level: "Q4_K_M" },
  model_info: {
    "general.architecture": "llama",
    "general.parameter_count": 8000000000,
    "llama.context_length": 8192,
    "llama.block_count": 32,
    "llama.embedding_length": 4096,
    "llama.attention.head_count": 32,
    "llama.attention.head_count_kv": 8,
  },
};
function hardware({
  available = 24 * GiB,
  gpuAvailable = 16 * GiB,
  gpuState = "verified",
  devices,
} = {}) {
  return {
    observedAt: new Date().toISOString(),
    ram: { totalBytes: 32 * GiB, availableBytes: available },
    cpu: { backendSupported: true },
    gpu: {
      state: gpuState,
      devices: devices || [
        {
          backend: "cuda",
          driverSupported: true,
          totalBytes: 16 * GiB,
          availableBytes: gpuAvailable,
        },
      ],
    },
  };
}
test("fit distinguishes current available RAM from capacity and requires verified GPU evidence", () => {
  const model = modelEvidence(tag, show);
  assert.equal(evaluateFit(hardware(), model, 4096).verdict, "Runs well");
  assert.equal(
    evaluateFit(hardware({ devices: [] }), model, 4096).verdict,
    "Runs with limits",
  );
  const limited = evaluateFit(
    hardware({ available: GiB, devices: [] }),
    model,
    4096,
  );
  assert.equal(limited.verdict, "Unlikely");
  assert.ok(limited.reasons.includes("INSUFFICIENT_CURRENT_AVAILABLE_MEMORY"));
  assert.equal(
    evaluateFit(hardware({ gpuState: "unknown" }), model, 4096).verdict,
    "Unknown",
  );
  assert.equal(
    evaluateFit(
      hardware({ available: 4 * GiB, gpuAvailable: 4 * GiB }),
      model,
      4096,
    ).verdict,
    "Unknown",
  );
});
test("fit derives bounded KV memory from metadata and never from model-name or quantization guesses", () => {
  const model = modelEvidence(tag, show);
  const small = evaluateFit(hardware(), model, 4096);
  const large = evaluateFit(hardware(), model, 8192);
  assert.equal(large.estimate.kvCacheBytes, small.estimate.kvCacheBytes * 2);
  assert.equal(small.estimate.kvCacheBytes, 512 * 1024 ** 2);
  const misleading = {
    ...model,
    name: "tiny-1b-fast-q2",
    quantization: "Q2_K",
  };
  assert.equal(
    evaluateFit(hardware(), misleading, 4096).estimate.requiredMemoryBytes,
    small.estimate.requiredMemoryBytes,
  );
  assert.equal(
    evaluateFit(hardware(), { ...model, layers: null }, 4096).verdict,
    "Unknown",
  );
  assert.equal(
    evaluateFit(
      hardware(),
      { ...model, architecture: "unsupported-new-architecture" },
      4096,
    ).estimate,
    null,
  );
  assert.ok(
    evaluateFit(hardware(), model, 16384).reasons.includes(
      "CONTEXT_EXCEEDS_MODEL_LIMIT",
    ),
  );
});
test("hardware snapshot uses actual RAM/disk evidence and leaves unavailable GPU unknown", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "ollama-hardware-"),
  );
  try {
    const result = await hardwareSnapshot({ ollamaModelDirectory: directory });
    assert.equal(result.ram.totalBytes, os.totalmem());
    assert.ok(result.ram.availableBytes <= result.ram.totalBytes);
    assert.equal(result.storage.state, "verified");
    assert.ok(result.storage.availableBytes > 0);
    assert.equal(result.gpu.state, "unknown");
    assert.equal(JSON.stringify(result).includes(directory), false);
    const stale = await hardwareSnapshot({
      ollamaHardwareProbe: async () => ({
        cpuBackendSupported: true,
        gpu: {
          state: "verified",
          observedAt: "2000-01-01T00:00:00Z",
          devices: [],
        },
      }),
    });
    assert.equal(stale.gpu.state, "unknown");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("typed fit resolves exact installed digest, uses fixed endpoints and refuses tag races", async () => {
  const calls = [];
  const service = createToolsService({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json(
        url.endsWith("/api/tags") ? { models: [tag] } : show,
      );
    },
  });
  const result = await service.execute({
    action: "ollama.fit",
    model: tag.digest,
    contextTokens: 4096,
  });
  assert.equal(result.ok, true);
  assert.equal(result.fit.model.digest, tag.digest);
  assert.equal(result.fit.identityConsistency, "matching-tag-before-and-after");
  assert.equal(result.fit.model.identityConsistency, "matching-tag-before-and-after");
  assert.match(result.fit.identityLimitations[0], /ABA tag stability/);
  assert.equal(result.fit.verdict, "Unknown");
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, "http://127.0.0.1:11434/api/show");
  assert.deepEqual(JSON.parse(calls[1].init.body), { model: tag.name });
  assert.equal(
    (await service.execute({ action: "ollama.fit", model: "fixture" })).code,
    "MODEL_NOT_INSTALLED",
  );
  let reads = 0;
  const racing = createToolsService({
    fetchImpl: async (url) =>
      Response.json(
        url.endsWith("/api/show")
          ? show
          : {
              models: [
                { ...tag, digest: reads++ ? "b".repeat(64) : tag.digest },
              ],
            },
      ),
  });
  assert.equal(
    (await racing.execute({ action: "ollama.capabilities", model: tag.name }))
      .code,
    "MODEL_CHANGED_DURING_INSPECTION",
  );
  await service.dispose();
  await racing.dispose();
});
test("capability reporting follows show metadata and keeps attachment transport disabled", async () => {
  const service = createToolsService({
    fetchImpl: async (url) =>
      Response.json(
        url.endsWith("/api/tags")
          ? { models: [{ ...tag, name: "vision-tools:latest" }] }
          : { ...show, capabilities: [] },
      ),
  });
  const result = await service.execute({
    action: "ollama.capabilities",
    model: "vision-tools:latest",
  });
  assert.equal(result.attachments.imageCapability, false);
  assert.equal(result.identityConsistency, "matching-tag-before-and-after");
  assert.match(result.limitations[0], /cannot prove an atomic snapshot/);
  assert.equal(result.attachments.transferEnabled, false);
  assert.equal(result.toolCalling, false);
  assert.equal(
    (
      await service.execute({
        action: "ollama.fit",
        model: tag.name,
        contextTokens: 0,
      })
    ).code,
    "INVALID_REQUEST",
  );
  assert.equal(
    (
      await service.execute({
        action: "ollama.hardware",
        gpu: { state: "verified" },
      })
    ).code,
    "INVALID_REQUEST",
  );
  await service.dispose();
});
test("trusted probe records are bounded and capability absence stays unknown", async () => {
  const timestamp = new Date().toISOString();
  const verified = await hardwareSnapshot({
    ollamaHardwareProbe: async () => ({
      cpuBackendSupported: true,
      gpu: {
        state: "verified",
        observedAt: timestamp,
        devices: [
          {
            backend: "cuda",
            driverSupported: true,
            totalBytes: 16 * GiB,
            availableBytes: 12 * GiB,
          },
        ],
      },
    }),
  });
  assert.equal(verified.gpu.state, "verified");
  assert.equal(verified.cpu.backendSupported, true);
  const invalid = await hardwareSnapshot({
    ollamaHardwareProbe: async () => ({
      gpu: {
        state: "verified",
        observedAt: timestamp,
        devices: [
          {
            backend: "cuda",
            driverSupported: true,
            totalBytes: GiB,
            availableBytes: 2 * GiB,
          },
        ],
      },
    }),
  });
  assert.equal(invalid.gpu.state, "unknown");
  const service = createToolsService({
    fetchImpl: async (url) =>
      Response.json(
        url.endsWith("/api/tags")
          ? { models: [tag] }
          : { ...show, capabilities: undefined },
      ),
  });
  const result = await service.execute({
    action: "ollama.capabilities",
    model: tag.name,
  });
  assert.equal(result.attachments.imageCapability, null);
  assert.equal(result.toolCalling, null);
  assert.equal(result.attachments.transferEnabled, false);
  await service.dispose();
});
