"use strict";
const os = require("node:os");
const fs = require("node:fs/promises");
const path = require("node:path");
const { fail, fetchBounded } = require("./runtime.cjs");
const MiB = 1024 ** 2;
const identityLimitation =
  "The show response is queried by mutable tag. Matching tag digest and size before/after detect observed net changes, but cannot prove an atomic snapshot, ABA tag stability, or an immutable digest-bound show receipt.";
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const nonnegative = (value) => Number.isSafeInteger(value) && value >= 0;
const metadataText = (value, maximum = 128) =>
  typeof value === "string" &&
  value.length <= maximum &&
  !/[\x00-\x1f]/.test(value)
    ? value
    : null;
async function diskEvidence(directory) {
  if (!directory || !path.isAbsolute(directory))
    return { state: "unknown", reason: "MODEL_STORAGE_UNAVAILABLE" };
  let current = directory;
  while (true) {
    try {
      const stat = await fs.statfs(current);
      const availableBytes = Math.floor(stat.bavail * stat.bsize);
      const totalBytes = Math.floor(stat.blocks * stat.bsize);
      if (!nonnegative(availableBytes) || !positive(totalBytes))
        return { state: "unknown", reason: "STORAGE_METRICS_UNAVAILABLE" };
      return {
        state: "verified",
        availableBytes,
        totalBytes,
        source: "host-statfs",
      };
    } catch (error) {
      if (error.code !== "ENOENT" || path.dirname(current) === current)
        return { state: "unknown", reason: "STORAGE_METRICS_UNAVAILABLE" };
      current = path.dirname(current);
    }
  }
}
function admittedProbe(probe, timestamp) {
  const unknown = {
    state: "unknown",
    devices: [],
    reason: "GPU_PROBE_INVALID",
  };
  if (!probe || typeof probe !== "object")
    return { gpu: unknown, cpuBackendSupported: null };
  const supported =
    typeof probe.cpuBackendSupported === "boolean"
      ? probe.cpuBackendSupported
      : null;
  const gpu = probe.gpu;
  const observed = Date.parse(gpu?.observedAt);
  if (
    gpu?.state !== "verified" ||
    !Number.isFinite(observed) ||
    observed > timestamp + 5000 ||
    timestamp - observed > 300000 ||
    !Array.isArray(gpu.devices) ||
    gpu.devices.length > 16
  )
    return {
      gpu: { ...unknown, reason: "GPU_PROBE_UNVERIFIED_OR_STALE" },
      cpuBackendSupported: supported,
    };
  const devices = [];
  for (const device of gpu.devices) {
    if (
      !device ||
      !positive(device.totalBytes) ||
      !nonnegative(device.availableBytes) ||
      device.availableBytes > device.totalBytes ||
      !["cuda", "rocm", "vulkan", "metal"].includes(device.backend) ||
      typeof device.driverSupported !== "boolean"
    )
      return { gpu: unknown, cpuBackendSupported: supported };
    devices.push({
      backend: device.backend,
      driverSupported: device.driverSupported,
      totalBytes: device.totalBytes,
      availableBytes: device.availableBytes,
    });
  }
  return {
    gpu: {
      state: "verified",
      devices,
      observedAt: new Date(observed).toISOString(),
      source: "trusted-host-probe",
    },
    cpuBackendSupported: supported,
  };
}
async function hardwareSnapshot(options = {}, context = {}) {
  if (context.signal?.aborted) fail("CANCELLED");
  const timestamp = Date.now();
  const result = {
    observedAt: new Date(timestamp).toISOString(),
    ram: {
      totalBytes: os.totalmem(),
      availableBytes: os.freemem(),
      source: "host-os-physical-memory",
    },
    cpu: {
      architecture: os.arch(),
      logicalCores: os.availableParallelism?.() || os.cpus().length,
      backendSupported: null,
    },
    gpu: { state: "unknown", devices: [], reason: "GPU_PROBE_UNAVAILABLE" },
    adapterInventory: await require("./ollama-hardware.cjs").observeAdapters({signal:context.signal}),
    storage: await diskEvidence(
      options.ollamaModelDirectory ||
        (options.ollamaManagedDirectory
          ? path.join(options.ollamaManagedDirectory, "models")
          : null),
    ),
  };
  if (typeof options.ollamaHardwareProbe === "function") {
    try {
      let timer;
      let raw;
      try {
        raw = await Promise.race([
          options.ollamaHardwareProbe({ signal: context.signal }),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("GPU_PROBE_TIMEOUT")),
              3000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      const probe = admittedProbe(raw, timestamp);
      result.gpu = probe.gpu;
      result.cpu.backendSupported = probe.cpuBackendSupported;
    } catch {
      result.gpu = {
        state: "unknown",
        devices: [],
        reason: "GPU_PROBE_FAILED",
      };
    }
  }
  if (context.signal?.aborted) fail("CANCELLED");
  return result;
}
function modelEvidence(tag, show) {
  if (!show || typeof show !== "object" || Array.isArray(show))
    fail("INVALID_MODEL_METADATA");
  const info = show.model_info || {};
  const architecture = metadataText(info["general.architecture"], 64);
  const read = (key) =>
    positive(info[architecture + "." + key])
      ? info[architecture + "." + key]
      : null;
  const capabilities =
    Array.isArray(show.capabilities) &&
    show.capabilities.length <= 32 &&
    show.capabilities.every((value) => metadataText(value, 64) !== null)
      ? [
          ...new Set(
            show.capabilities.filter(
              (value) => metadataText(value, 64) !== null,
            ),
          ),
        ]
      : null;
  return {
    name: tag.name,
    digest: tag.digest,
    weightsBytes: positive(tag.size) ? tag.size : null,
    architecture,
    parameterCount: positive(info["general.parameter_count"])
      ? info["general.parameter_count"]
      : null,
    quantization: metadataText(show.details?.quantization_level, 64),
    contextMaximum: read("context_length"),
    layers: read("block_count"),
    embeddingWidth: read("embedding_length"),
    attentionHeads: read("attention.head_count"),
    kvHeads: read("attention.head_count_kv"),
    keyWidth: read("attention.key_length"),
    valueWidth: read("attention.value_length"),
    capabilities,
    source: "ollama-local-tags-and-show",
    identityConsistency: "unverified-tag-show-association",
    identityLimitations: [identityLimitation],
  };
}
function evaluateFit(hardware, model, contextTokens) {
  const result = {
    verdict: "Unknown",
    identityConsistency: model.identityConsistency || "unverified-tag-show-association",
    identityLimitations: [identityLimitation],
    observedAt: new Date().toISOString(),
    reasons: [],
    model,
    hardware,
    estimate: null,
    limitations: [
      identityLimitation,
      "Memory planning estimate, not a benchmark or successful model-load proof.",
      "Single-device GPU fit only; no assumed aggregation or GPU offload.",
      "Actual runtime context and cache settings must match the planning assumptions.",
      "Text-only planning; attachment/encoder working memory is not estimated.",
    ],
  };
  if (!positive(model.weightsBytes) || !positive(model.contextMaximum)) {
    result.reasons.push("MODEL_SIZE_OR_CONTEXT_UNAVAILABLE");
    return result;
  }
  const context =
    contextTokens === undefined
      ? Math.min(4096, model.contextMaximum)
      : contextTokens;
  if (!positive(context) || context > model.contextMaximum) {
    result.reasons.push("CONTEXT_EXCEEDS_MODEL_LIMIT");
    return result;
  }
  if (
    !["llama", "qwen2", "qwen3", "gemma", "gemma2", "phi3"].includes(
      model.architecture,
    ) ||
    ![
      model.layers,
      model.embeddingWidth,
      model.attentionHeads,
      model.kvHeads,
    ].every(positive) ||
    model.kvHeads > model.attentionHeads ||
    model.embeddingWidth % model.attentionHeads !== 0
  ) {
    result.reasons.push("KV_CACHE_METADATA_UNSUPPORTED_OR_INCOMPLETE");
    return result;
  }
  const headWidth = model.embeddingWidth / model.attentionHeads;
  const keyWidth = model.keyWidth || headWidth;
  const valueWidth = model.valueWidth || headWidth;
  const kvCacheBytes =
    context * model.layers * model.kvHeads * (keyWidth + valueWidth) * 2;
  const runtimeOverheadBytes = Math.max(
    512 * MiB,
    Math.ceil(model.weightsBytes * 0.1),
  );
  const requiredMemoryBytes = Math.ceil(
    (model.weightsBytes + kvCacheBytes + runtimeOverheadBytes) * 1.2,
  );
  if (
    ![kvCacheBytes, runtimeOverheadBytes, requiredMemoryBytes].every(positive)
  ) {
    result.reasons.push("MEMORY_ESTIMATE_OUT_OF_RANGE");
    return result;
  }
  result.estimate = {
    contextTokens: context,
    contextSource:
      contextTokens === undefined ? "planning-default" : "requested",
    weightsBytes: model.weightsBytes,
    kvCacheBytes,
    runtimeOverheadBytes,
    safetyFactor: 1.2,
    requiredMemoryBytes,
    kvElementBytes: 2,
    kvFormula: "context * layers * kvHeads * (keyWidth + valueWidth) * 2",
    widthSource:
      model.keyWidth && model.valueWidth
        ? "declared-key-and-value-widths"
        : "declared-widths-and-derived-standard-head-widths",
  };
  if (
    !positive(hardware.ram?.totalBytes) ||
    !nonnegative(hardware.ram?.availableBytes) ||
    hardware.ram.availableBytes > hardware.ram.totalBytes
  ) {
    result.reasons.push("AVAILABLE_RAM_UNVERIFIED");
    return result;
  }
  const gpu = hardware.gpu;
  if (gpu?.state !== "verified") {
    result.reasons.push("GPU_EVIDENCE_UNAVAILABLE");
    return result;
  }
  const candidates = gpu.devices.filter(
    (device) => device.driverSupported === true,
  );
  const fitsGpu = candidates.some(
    (device) => device.availableBytes >= requiredMemoryBytes,
  );
  const fitsRam = hardware.ram.availableBytes >= requiredMemoryBytes;
  if (fitsGpu && fitsRam) {
    result.verdict = "Runs well";
    result.reasons.push("VERIFIED_SINGLE_GPU_AND_AVAILABLE_RAM_FIT");
  } else if (fitsRam && hardware.cpu?.backendSupported === true) {
    result.verdict = "Runs with limits";
    result.reasons.push("CPU_MEMORY_FIT_GPU_OFFLOAD_NOT_ASSUMED");
  } else if (
    hardware.cpu?.backendSupported === true &&
    !fitsRam &&
    hardware.ram.availableBytes +
      Math.max(0, ...candidates.map((device) => device.availableBytes)) <
      requiredMemoryBytes
  ) {
    result.verdict = "Unlikely";
    result.reasons.push(
      hardware.ram.totalBytes >= requiredMemoryBytes
        ? "INSUFFICIENT_CURRENT_AVAILABLE_MEMORY"
        : "INSUFFICIENT_MEMORY_CAPACITY",
    );
  } else result.reasons.push("RUNTIME_BACKEND_OR_AVAILABLE_MEMORY_UNVERIFIED");
  return result;
}
async function exactModel(options, request, context = {}) {
  const common = {
    signal: context.signal,
    fetchImpl: options.fetchImpl,
    maxBytes: 2 * 1024 * 1024,
  };
  const tags = await fetchBounded("http://127.0.0.1:11434/api/tags", common);
  if (!Array.isArray(tags.models) || tags.models.length > 10000)
    fail("INVALID_TAG_INVENTORY");
  const matches = tags.models.filter(
    (tag) => tag && [tag.name, tag.model, tag.digest].includes(request.model),
  );
  if (!matches.length) fail("MODEL_NOT_INSTALLED");
  if (matches.length > 1) {
    if (
      !matches.every(
        (tag) => tag.digest === request.model && tag.size === matches[0].size,
      )
    )
      fail("AMBIGUOUS_MODEL_REFERENCE");
    matches.sort((left, right) =>
      String(left.name).localeCompare(String(right.name)),
    );
  }
  if (
    !metadataText(matches[0].name, 256) ||
    !/^(?:sha256:)?[a-f0-9]{64}$/.test(matches[0].digest || "")
  )
    fail("INVALID_TAG_INVENTORY");
  const show = await fetchBounded("http://127.0.0.1:11434/api/show", {
    ...common,
    method: "POST",
    body: { model: matches[0].name },
  });
  const after = await fetchBounded("http://127.0.0.1:11434/api/tags", common);
  if (!Array.isArray(after.models) || after.models.length > 10000)
    fail("INVALID_TAG_INVENTORY");
  const retained = after.models.filter((tag) => tag?.name === matches[0].name);
  if (
    retained.length !== 1 ||
    retained[0].digest !== matches[0].digest ||
    retained[0].size !== matches[0].size
  )
    fail("MODEL_CHANGED_DURING_INSPECTION");
  return {
    ...modelEvidence(matches[0], show),
    identityConsistency: "matching-tag-before-and-after",
  };
}
async function executeFit(options, request, context = {}) {
  if (request.action === "ollama.hardware")
    return { hardware: await hardwareSnapshot(options, context) };
  const model = await exactModel(options, request, context);
  if (request.action === "ollama.capabilities")
    return {
      observedAt: new Date().toISOString(),
      model: model.name,
      digest: model.digest,
      source: "ollama-local-show",
      identityConsistency: model.identityConsistency,
      limitations: model.identityLimitations,
      capabilities: model.capabilities,
      attachments: {
        imageCapability: model.capabilities?.includes("vision") ?? null,
        transferEnabled: false,
        reason: "VALIDATED_ATTACHMENT_TRANSPORT_NOT_IMPLEMENTED",
      },
      toolCalling: model.capabilities?.includes("tools") ?? null,
    };
  if (request.action !== "ollama.fit") fail("INVALID_REQUEST");
  return {
    fit: evaluateFit(
      await hardwareSnapshot(options, context),
      model,
      request.contextTokens,
    ),
  };
}
module.exports = { hardwareSnapshot, modelEvidence, evaluateFit, executeFit };
