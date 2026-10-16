"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { createBuildScheduler } = require("./jobs/scheduler.cjs");
const { createBuildQuarantine } = require("./jobs/quarantine.cjs");
const { createBuildConfirmation } = require("./security/build-confirmation.cjs");
const { captureBuildIntent } = require("./jobs/build-intent.cjs");
const { ExecutionService, TARGETS } = require("./execution/index.cjs");
const { createJobManager } = require("./jobs/manager.cjs");
const { createConfigurationService } = require("./configuration/index.cjs");
const { createDefconfigWorkflows } = require("./configuration/defconfig-workflows.cjs");
const { resolveDomains } = require("./configuration/domains.cjs");
const { createConfigurationConsent } = require("./configuration/runtime-consent.cjs");
const { createKconfigInspection } = require("./execution/kconfig-inspection.cjs");
const { createDeploymentService } = require("./deployment/index.cjs");
const { OutputViewers } = require("./deployment/output-viewers.cjs");
const { createToolsService } = require("./tools/index.cjs");
const { createPayloadManager } = require("./tools/payload-manager.cjs");
const { createToolFiles } = require("./security/tool-files.cjs");
const {
  createCompanionController,
} = require("./security/companion-controller.cjs");
const { createUpdateService } = require("./updates/service.cjs");
const { createDocumentationService } = require("./documentation/service.cjs");
const { createFileGrants } = require("./security/file-grants.cjs");
const { createProjectStore } = require("./storage/project-store.cjs");
const {
  createProjectOptionsStore,
} = require("./storage/project-options-store.cjs");
const {
  createCanvasLayoutStore,
} = require("./storage/canvas-layout-store.cjs");
const { createKconfigAdapter } = require("./configuration/kconfig-adapter.cjs");
const { boundedProcess } = require("./execution/index.cjs");
const { createSourceOperations } = require("./source-operations.cjs");
const { WslSourceService } = require("./execution/wsl-source.cjs");
const {
  createPackageAuthoringService,
} = require("./configuration/package-authoring.cjs");
const {
  createPackageDiscoveryService,
} = require("./configuration/package-discovery.cjs");
const contract = require("./security/workspace-contract.cjs");
const portableProject = require("./storage/portable-project.cjs");

const { createWslRuntime } = require("./execution/wsl-runtime.cjs");
const owner = "desktop-owner";
const fields = {
  "documentation.list": [],
  "documentation.read": ["id"],
  "documentation.searchText": [],
  "documentation.open": ["id", "linkId"],
  "runtime.discover": [],
  "runtime.wsl": ["kind", "distribution"],
  "runtime.docker.prepare": ["workspaceId", "runtime"],
  "runtime.python.choose": [],
  "project.list": [],
  "project.open": ["workspaceId"],
  "project.portable.export": ["workspaceId"],
  "project.portable.choose": [],
  "project.portable.import": ["importId", "selectionId", "trust"],
  "project.portable.wslImport": ["importId", "trust"],
  "project.choose": [],
  "project.adopt": ["selectionId", "trust"],
  "project.runtime": ["workspaceId", "runtime"],
  "project.options": ["workspaceId"],
  "canvas.read": ["workspaceId", "canvasId"],
  "canvas.write": ["workspaceId", "canvasId", "expectedRevision", "layout"],
  "build.submit": ["workspaceId", "target", "runtime", "jobs"],
  "build.confirmation.challenge": ["request"],
  "build.confirmation.confirm": ["id", "firstKey", "secondKey", "slider", "rebuildConsent"],
  "build.confirmation.cancel": ["id"],
  "jobs.list": [],
  "scheduler.status": [],
  "jobs.pump": [],
  "jobs.reconcile": ["id"],
  "jobs.page": ["id", "after", "limit"],
  "jobs.cancel": ["id", "sequence"],
  "jobs.retry": ["id", "sequence"],
  "config.trustPreview": ["workspaceId"],
  "config.trustGrant": ["workspaceId", "challengeId", "trusted"],
  "config.trustRevoke": ["workspaceId"],
  "defconfig.catalog": ["workspaceId"],
  "defconfig.apply": ["workspaceId", "revision", "id"],
  "defconfig.save": ["workspaceId", "revision"],
  "config.inspect": ["workspaceId"],
  "config.defconfigs": ["workspaceId"],
  "config.apply": ["workspaceId", "revision", "changes"],
  "config.undo": ["workspaceId", "revision"],
  "config.defconfig": ["workspaceId", "revision", "path"],
  "artifacts.list": ["workspaceId"],
  "artifacts.inspect": ["workspaceId", "path"],
  "outputs.browse": ["workspaceId", "directoryId"],
  "outputs.inspect": ["workspaceId", "fileId"],
  "outputs.checksum": ["workspaceId", "fileId", "expected"],
  "artifacts.manifest": ["workspaceId", "paths"],
  tools: ["request"],
  "payload.list": [],
  "payload.choose": ["toolId"],
  "file.choose": ["access", "kind"],
  companion: ["request"],
  source: ["request"],
  "external.choose": ["workspaceId"],
  "external.activate": [
    "workspaceId",
    "externalTreeIds",
    "expectedRevision",
    "trust",
  ],
  "external.previewInitialize": ["workspaceId", "externalTreeId", "descriptor"],
  "external.initialize": [
    "workspaceId",
    "externalTreeId",
    "descriptor",
    "revision",
    "previewHash",
  ],
  "package.preview": ["workspaceId", "externalTreeId", "model"],
  "package.discover": ["workspaceId", "query", "offset", "limit"],
  "package.import": ["workspaceId", "packageId", "revision"],
  "package.editors": ["workspaceId"],
  "package.editor.open": ["workspaceId", "packageId", "revision", "file", "fileHash", "editorId"],
  "package.apply": [
    "workspaceId",
    "externalTreeId",
    "model",
    "revision",
    "previewHash",
  ],
  "guest.discover": ["workspaceId"],
  "guest.networks": ["workspaceId"],
  "guest.preview": ["workspaceId", "request"],
  "guest.disk.create": ["workspaceId", "request"],
  "guest.list": ["workspaceId"],
  "guest.create": ["workspaceId", "request"],
  "guest.import": ["workspaceId", "request"],
  "guest.edit": ["workspaceId", "request"],
  "guest.launch": ["workspaceId", "request"],
  "guest.stop": ["workspaceId", "request"],
  "guest.refresh": ["workspaceId", "request"],
  "conversion.preview": ["workspaceId", "request"],
  "conversion.execute": ["workspaceId", "request"],
  "updates.check": [],
  "updates.state": [],
  "updates.download": [],
  "updates.cancel": [],
  "updates.install": ["confirmUnsigned", "workSaved"],
  "updates.notes": [],
  "updates.later": [],
};
function reject(code) {
  throw Object.assign(new Error(code), { code });
}
function exact(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).some(
      (key) =>
        typeof key !== "string" ||
        !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"),
    ) ||
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    reject("INVALID_REQUEST");
}
function runtime(value) {
  if (value?.kind === "wsl") {
    exact(value, ["kind", "distribution"]);
    if (
      typeof value.distribution !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(value.distribution)
    )
      reject("INVALID_RUNTIME");
  } else if (value?.kind === "docker") {
    exact(value, ["kind", "image", "uid", "gid"]);
    if (
      typeof value.image !== "string" ||
      value.image.length > 512 ||
      !/^[a-z0-9][a-z0-9./:_-]*@sha256:[0-9a-f]{64}$/.test(value.image) ||
      !Number.isSafeInteger(value.uid) ||
      value.uid < 1 ||
      value.uid > 65535 ||
      !Number.isSafeInteger(value.gid) ||
      value.gid < 1 ||
      value.gid > 65535
    )
      reject("INVALID_RUNTIME");
  } else reject("INVALID_RUNTIME");
  return value;
}

/** All paths and executable authority originate in the host, never this request surface. */
function createOperationsService({
  directory,
  dialog,
  parentWindow,
  version,
  source,
  documentationDirectory,
  openDocumentationExternal,
  updateHostFactory,
  openWslPath,
  execution = new ExecutionService(),
  workspaceRead,
  schedulerLimits = {
    maxConcurrent: 4,
    cpuSlots: 32,
    memoryBytes: 32 * 1024 ** 3,
    storageBytes: 128 * 1024 ** 3,
  },
}) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const wslRuntime = createWslRuntime({ directory, dialog, parentWindow, openPath: openWslPath, run: (args, options) => boundedProcess(execution.executables.wsl, args, options).completion });
  const documentation = documentationDirectory
    ? createDocumentationService({
        directory: documentationDirectory,
        openExternal: openDocumentationExternal,
      })
    : null;
  const selections = new Map(),
    portableImports = new Map(),
    projects = new Map(),
    fileGrants = createFileGrants(),
    running = new Set();
  const projectStore = createProjectStore({
    filePath: path.join(directory, "projects.json"),
  });
  const canvasLayouts = createCanvasLayoutStore({
    directory: path.join(directory, "canvas-layouts"),
  });
  const projectOptions = createProjectOptionsStore({
    directory: path.join(directory, "project-options"),
  });
  let kconfigAdapter;
  let choosing = false,
    disposed = false;
  let disposal;
  const quarantine = createBuildQuarantine({
    directory: path.join(directory, "build-recovery"),
    validateReceipt: (receipt) => {
      if (typeof execution.validateOwnershipReceipt !== "function")
        reject("RECOVERY_UNAVAILABLE");
      execution.validateOwnershipReceipt(receipt);
    },
  });
  const activeRecovery = new Set();
  const buildConfirmation = createBuildConfirmation({ resolveWorkspace: project });
  let recoveryUnavailable = false;
  function project(id) {
    const item = projects.get(id);
    if (!item) reject("PROJECT_NOT_ADOPTED");
    for (const key of ["root", "source", "output"]) {
      const stat = fs.lstatSync(item[key]);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        fs.realpathSync(item[key]) !== item[key] ||
        `${stat.dev}:${stat.ino}` !== item.identities[key]
      )
        reject("PROJECT_PATH_CHANGED");
    }
    return item;
  }
  function registerProject(selected, wslGranted) {
    const granted = wslGranted || execution.grantProject({
      ...selected,
      trustedSource: true,
    });
    const workspaceId = projectStore.adopt({
      name: selected.name,
      root: selected.root,
      source: selected.source,
      output: selected.output,
      ...(selected.storage ? { storage: selected.storage } : {}),
    });
    const identities = Object.fromEntries(
      ["root", "source", "output"].map((key) => {
        const stat = fs.statSync(selected[key]);
        return [key, `${stat.dev}:${stat.ino}`];
      }),
    );
    const options = projectOptions.get({ workspaceId });
    projects.set(workspaceId, {
      ...selected,
      identities,
      grantId: granted.grantId,
      runtime: selected.storage ? { kind: "wsl", distribution: selected.storage.distribution } : options.runtime,
      externalTrees: [],
      externalTreeIds: [],
      externalStateVerified: options.externalTrees.length === 0,
    });
    return { workspaceId, name: selected.name };
  }
  const sources = createSourceOperations({
    chooseDirectory: async () => {
      if (choosing) reject("PICKER_BUSY");
      choosing = true;
      try {
        return await pick(
          "Select a workspace folder for a new source checkout",
        );
      } finally {
        choosing = false;
      }
    },
    resolveWorkspace: (id) => project(id),
    sourceServiceForWorkspace: (workspace) => {
      if (!workspace.storage) return undefined;
      const grant = execution.grants.get(workspace.grantId);
      if (!grant?.wslReceipt || grant.wslReceipt !== workspace.receipt) reject("WSL_SOURCE_OPERATION_UNAVAILABLE");
      return new WslSourceService({
        receipt: grant.wslReceipt,
        run: (args) => boundedProcess(execution.executables.wsl, args, {timeoutMs:600000,maxBytes:4*1024*1024}).completion,
        acquireSourceLock: () => {
          if (disposed) reject("SOURCE_BUSY");
          project([...projects].find(([,item])=>item===workspace)?.[0]);
          return acquirePathLeases([workspace.source,workspace.output]);
        },
      });
    },
    acquireSourceLock: (sourceRoot) => {
      if (disposed) reject("SOURCE_BUSY");
      let existing = sourceRoot;
      for (let depth = 0; !fs.existsSync(existing); depth++) {
        const parent = path.dirname(existing);
        if (depth >= 64 || parent === existing) reject("SOURCE_BUSY");
        existing = parent;
      }
      return acquirePathLeases([existing]);
    },
    onSourceAdopted: ({ root, source }) => {
      if (disposed) reject("SOURCE_SERVICE_CLOSED");
      const output = path.join(root, path.basename(source) + "-output");
      try {
        fs.mkdirSync(output, { mode: 0o700 });
      } catch (error) {
        if (error.code === "EEXIST") reject("ADOPTION_REQUIRED");
        throw error;
      }
      return registerProject({
        root,
        source,
        output,
        name: path.basename(source),
      });
    },
  });
  async function executeProject(input, log, signal, onOwnership) {
    let item;
    try {
      if (disposed || signal?.aborted) reject("BUILD_CANCELLED");
      item = project(input.workspaceId);
      authorizedExternalPaths(input.workspaceId, item);
    } catch (error) {
      error.code = "RUNTIME_NOT_STARTED";
      throw error;
    }
    const job = await execution.start(
      {
        grantId: item.grantId,
        target: input.target,
        runtime: runtime(input.runtime),
        jobs: input.jobs,
      },
      log,
      { onOwnership, signal },
    );
    const cancel = () => {
      void job.cancel().catch(() => {});
    };
    running.add(job);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    try {
      return await job.completion;
    } finally {
      running.delete(job);
      signal?.removeEventListener("abort", cancel);
    }
  }
  const jobs = createJobManager({
    directory: path.join(directory, "jobs"),
    adapters: {
      build: async (payload, context) => {
        try {
          validateBuildPayload(payload);
          if (disposed || context.signal.aborted) reject("BUILD_CANCELLED");
          await checkDispatchIntent(payload, context.signal);
          if (disposed || context.signal.aborted) reject("BUILD_CANCELLED");
        } catch (error) {
          const code =
            typeof error.code === "string" &&
            /^(?:BLOCKED_[A-Z_]+|BUILD_CANCELLED)$/.test(error.code)
              ? error.code
              : "BLOCKED_AUTHORIZATION_REQUIRED";
          context.log({
            stream: "stderr",
            text: `Build was not started: ${code}.`,
          });
          throw error;
        }
        quarantine.begin({
          jobId: context.jobId,
          workspaceId: payload.workspaceId,
        });
        activeRecovery.add(context.jobId);
        let result;
        try {
          result = await executeProject(
            payload,
            (event) => {
              for (let offset = 0; offset < event.text.length; offset += 4000)
                context.log({
                  stream: event.stream,
                  text: event.text.slice(offset, offset + 4000),
                });
            },
            context.signal,
            async (receipt) => {
              try {
                quarantine.checkpoint(context.jobId, receipt);
              } catch (error) {
                recoveryUnavailable = true;
                throw error;
              }
            },
          );
          if (result.state !== "runtime-cleanup-failed") {
            try {
              quarantine.clear(context.jobId);
            } catch (error) {
              recoveryUnavailable = true;
              throw error;
            }
          }
        } catch (error) {
          result = { state: "runtime-cleanup-failed", code: null };
          if (error.code === "RUNTIME_NOT_STARTED" && !recoveryUnavailable) {
            try {
              quarantine.clear(context.jobId);
              result = { state: "failed", code: null };
            } catch {
              recoveryUnavailable = true;
            }
          }
        } finally {
          activeRecovery.delete(context.jobId);
        }
        if (result.state === "runtime-cleanup-failed")
          return { state: result.state, code: result.code };
        context.item({ state: result.state, code: result.code });
        if (result.state !== "succeeded")
          reject("BUILD_" + result.state.toUpperCase().replaceAll("-", "_"));
        return { state: result.state, code: result.code };
      },
    },
  });
  if (!quarantine.initialized) {
    for (const job of jobs.list(owner))
      if (job.kind === "build" && job.state === "interrupted")
        quarantine.begin({
          jobId: job.id,
          workspaceId: job.payload.workspaceId,
        });
    quarantine.initialize();
  }
  function unknownRecovery() {
    return quarantine
      .list()
      .filter((record) => !activeRecovery.has(record.jobId));
  }
  const scheduler = createBuildScheduler({
    jobs: {
      list: (who) => jobs.list(who),
      get: (id, who) => jobs.get(id, who),
      run: (id, who, sequence) =>
        disposed ? Promise.resolve() : jobs.run(id, who, sequence),
    },
    ownerId: owner,
    limits: schedulerLimits,
    resolveAdmission: async (job) => {
      try {
        if (recoveryUnavailable || unknownRecovery().length)
          reject("BLOCKED_RUNTIME_RECOVERY_REQUIRED");
        const payload = validateBuildPayload(job.payload);
        const item = project(payload.workspaceId);
        if (!item.externalStateVerified)
          reject("BLOCKED_EXTERNAL_AUTHORIZATION_REQUIRED");
        const externalTrees = authorizedExternalPaths(
          payload.workspaceId,
          item,
        );
        const current = await captureBuildIntent({
          source: item.source,
          output: item.output,
          externalTrees,
        });
        project(payload.workspaceId);
        if (
          current.sourceRevision !== payload.intent.sourceRevision ||
          current.configRevision !== payload.intent.configRevision
        )
          reject("BLOCKED_INTENT_CHANGED");
        return {
          projectId: payload.workspaceId,
          source: item.source,
          output: item.output,
          externalTrees: [...item.externalTrees],
          resourceDomain: "local-build-runtime",
          storageDomain: `host-filesystem:${fs.statSync(item.output).dev}`,
          ...payload.resources,
          runtime: payload.runtime,
          intent: {
            sourceRevision: current.sourceRevision,
            configRevision: current.configRevision,
          },
        };
      } catch (error) {
        if (error.code === "PROJECT_NOT_ADOPTED")
          reject("BLOCKED_AUTHORIZATION_REQUIRED");
        if (error.code === "PROJECT_PATH_CHANGED")
          reject("BLOCKED_PATH_CHANGED");
        if (
          [
            "INVALID_REQUEST",
            "INVALID_RUNTIME",
            "INVALID_RESERVATION",
          ].includes(error.code)
        )
          reject("BLOCKED_INVALID_INTENT");
        if (
          [
            "EXTERNAL_TREES_NOT_AUTHORIZED",
            "EXTERNAL_TREE_NOT_GRANTED",
            "FILE_GRANT_REQUIRED",
            "UNSAFE_PATH",
            "GRANT_CHANGED",
            "GRANT_UNAVAILABLE",
          ].includes(error.code)
        )
          reject("BLOCKED_EXTERNAL_AUTHORIZATION_REQUIRED");
        if (
          typeof error.code === "string" &&
          /^BLOCKED_[A-Z_]+$/.test(error.code)
        )
          throw error;
        reject("BLOCKED_ADMISSION_UNAVAILABLE");
      }
    },
    observeResources: async (admission) => {
      const unknown = {
        resourceDomain: admission.resourceDomain,
        storageDomain: admission.storageDomain,
        cpuSlots: null,
        memoryAvailableBytes: null,
        storageAvailableBytes: null,
      };
      if (typeof execution.probeResources !== "function") return unknown;
      try {
        const item = project(admission.projectId);
        const observed = await execution.probeResources({
          grantId: item.grantId,
          runtime: admission.runtime,
        });
        project(admission.projectId);
        const time = Date.parse(observed?.observedAt);
        if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 15000)
          return unknown;
        return {
          resourceDomain: admission.resourceDomain,
          storageDomain: admission.storageDomain,
          cpuSlots: observed.cpuSlots,
          memoryAvailableBytes: observed.memoryAvailableBytes,
          storageAvailableBytes: observed.storageAvailableBytes,
        };
      } catch {
        return unknown;
      }
    },
  });
  function schedulerStatus() {
    const counts = {
      queued: 0,
      running: 0,
      cancelling: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      interrupted: 0,
    };
    for (const job of jobs.list(owner)) counts[job.state]++;
    return {
      ...scheduler.status(),
      counts,
      quarantine: {
        unavailable: recoveryUnavailable,
        records: unknownRecovery().map((record) => ({
          jobId: record.jobId,
          workspaceId: record.workspaceId,
          reason: record.receipt
            ? "RUNTIME_CLEANUP_UNVERIFIED"
            : "RUNTIME_IDENTITY_UNAVAILABLE",
        })),
      },
      quarantinedReservations: unknownRecovery().reduce(
        (total, record) => {
          const resource = jobs.get(record.jobId, owner).payload.resources;
          for (const key of Object.keys(total))
            total[key] += Number.isSafeInteger(resource?.[key])
              ? resource[key]
              : 0;
          return total;
        },
        { cpuSlots: 0, memoryBytes: 0, storageBytes: 0 },
      ),
      limits: { ...schedulerLimits },
      defaultReservations: {
        cpuSlots: 2,
        memoryBytes: 4 * 1024 ** 3,
        storageBytes: 8 * 1024 ** 3,
      },
    };
  }
  function acquirePathLeases(paths, { metadataOnly = false } = {}) {
    if (disposed) reject("SOURCE_BUSY");
    if (!metadataOnly) {
      if (recoveryUnavailable) reject("RUNTIME_RECOVERY_REQUIRED");
      for (const record of unknownRecovery()) {
        const descriptor = projectStore
          .list()
          .find((item) => item.id === record.workspaceId);
        if (!descriptor) reject("RUNTIME_RECOVERY_REQUIRED");
        const denied = [
          descriptor.source,
          descriptor.output,
          ...projectOptions
            .get({ workspaceId: record.workspaceId })
            .externalTrees.map((tree) => tree.path),
        ];
        if (
          paths.some((selected) =>
            denied.some(
              (root) => isInside(root, selected) || isInside(selected, root),
            ),
          )
        )
          reject("RUNTIME_RECOVERY_REQUIRED");
      }
    }
    const unique = [...new Set(paths)].sort();
    const selected = unique.filter(
      (candidate) =>
        !unique.some(
          (other) => other !== candidate && isInside(other, candidate),
        ),
    );
    const releases = [];
    try {
      for (const selectedPath of selected)
        releases.push(
          scheduler.acquireMutationLease({
            projectId: `mutation-${createHash("sha256").update(selectedPath).digest("hex")}`,
            source: selectedPath,
            output: selectedPath,
          }),
        );
    } catch (error) {
      for (const release of releases.reverse()) release();
      throw error;
    }
    return () => {
      for (const release of releases.reverse()) release();
    };
  }
  function isInside(root, selected) {
    const relative = path.relative(root, selected);
    return (
      relative === "" ||
      (!path.isAbsolute(relative) &&
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`))
    );
  }
  function authorizedExternalPaths(workspaceId, item = project(workspaceId)) {
    if (
      !item.externalStateVerified ||
      !Array.isArray(item.externalTreeIds) ||
      item.externalTreeIds.length !== item.externalTrees.length
    )
      reject("EXTERNAL_TREES_NOT_AUTHORIZED");
    for (let index = 0; index < item.externalTreeIds.length; index++) {
      const id = item.externalTreeIds[index];
      if (
        externalWorkspaces.get(id) !== workspaceId ||
        externalFiles.resolve(id, "write") !== item.externalTrees[index]
      )
        reject("EXTERNAL_TREE_NOT_GRANTED");
    }
    return [...item.externalTrees];
  }
  function projectPaths(workspaceId) {
    const item = project(workspaceId);
    return [item.source, item.output, ...item.externalTrees];
  }
  function recoverableProjectPaths(workspaceId) {
    const item = project(workspaceId);
    return [
      item.source,
      item.output,
      ...item.externalTrees.filter((selected) => {
        try {
          return (
            fs.lstatSync(selected).isDirectory() &&
            !fs.lstatSync(selected).isSymbolicLink() &&
            fs.realpathSync(selected) === selected
          );
        } catch {
          return false;
        }
      }),
    ];
  }
  function reservations(value, selectedRuntime, count) {
    const minimumCpu = selectedRuntime.kind === "docker" ? 2 : count;
    const minimumMemory =
      selectedRuntime.kind === "docker" ? 4 * 1024 ** 3 : 256 * 1024 ** 2;
    const chosen =
      value === undefined
        ? {
            cpuSlots: Math.max(2, minimumCpu),
            memoryBytes: 4 * 1024 ** 3,
            storageBytes: 8 * 1024 ** 3,
          }
        : value;
    exact(chosen, ["cpuSlots", "memoryBytes", "storageBytes"]);
    if (
      !Number.isSafeInteger(chosen.cpuSlots) ||
      chosen.cpuSlots < minimumCpu ||
      chosen.cpuSlots > 64 ||
      !Number.isSafeInteger(chosen.memoryBytes) ||
      chosen.memoryBytes < minimumMemory ||
      chosen.memoryBytes > 256 * 1024 ** 3 ||
      !Number.isSafeInteger(chosen.storageBytes) ||
      chosen.storageBytes < 0 ||
      chosen.storageBytes > 1024 ** 4
    )
      reject("INVALID_RESERVATION");
    return { ...chosen };
  }
  function validateBuildPayload(payload) {
    if (!payload?.intent) reject("BLOCKED_INTENT_UNAVAILABLE");
    exact(payload, [
      "workspaceId",
      "target",
      "runtime",
      "jobs",
      "resources",
      "intent",
      "snapshot",
    ]);
    if (
      typeof payload.workspaceId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(payload.workspaceId) ||
      !TARGETS.includes(payload.target) ||
      !Number.isSafeInteger(payload.jobs) ||
      payload.jobs < 1 ||
      payload.jobs > 32
    )
      reject("BLOCKED_INVALID_INTENT");
    const selectedRuntime = runtime(payload.runtime);
    exact(payload.intent, ["projectId", "sourceRevision", "configRevision"]);
    if (
      payload.intent.projectId !== payload.workspaceId ||
      !/^[a-f0-9]{64}$/.test(payload.intent.sourceRevision) ||
      !/^[a-f0-9]{64}$/.test(payload.intent.configRevision)
    )
      reject("BLOCKED_INVALID_INTENT");
    exact(payload.snapshot, [
      "version",
      "entries",
      "bytes",
      "excludesGitObjectHistory",
      "symlinkPolicy",
      "symlinks",
      "limitations",
    ]);
    if (
      payload.snapshot.version !== 2 ||
      payload.snapshot.excludesGitObjectHistory !== true ||
      payload.snapshot.symlinkPolicy !== "link-text-only" ||
      !Number.isSafeInteger(payload.snapshot.symlinks) ||
      payload.snapshot.symlinks < 0 ||
      payload.snapshot.symlinks > payload.snapshot.entries ||
      JSON.stringify(payload.snapshot.limitations) !==
        JSON.stringify([
          "SYMLINK_TARGETS_OUTSIDE_CAPTURED_FILE_NAMESPACE_ARE_NOT_BOUND",
        ]) ||
      !Number.isSafeInteger(payload.snapshot.entries) ||
      payload.snapshot.entries < 0 ||
      payload.snapshot.entries > 50000 ||
      !Number.isSafeInteger(payload.snapshot.bytes) ||
      payload.snapshot.bytes < 0 ||
      payload.snapshot.bytes > 512 * 1024 * 1024
    )
      reject("BLOCKED_INVALID_INTENT");
    return {
      ...payload,
      runtime: selectedRuntime,
      resources: reservations(payload.resources, selectedRuntime, payload.jobs),
    };
  }
  async function checkDispatchIntent(payload, signal) {
    const item = project(payload.workspaceId);
    if (!item.externalStateVerified) reject("EXTERNAL_TREES_NOT_AUTHORIZED");
    const current = await captureBuildIntent({
      source: item.source,
      output: item.output,
      externalTrees: authorizedExternalPaths(payload.workspaceId, item),
      signal,
    });
    if (
      current.sourceRevision !== payload.intent.sourceRevision ||
      current.configRevision !== payload.intent.configRevision
    )
      reject("BLOCKED_INTENT_CHANGED");
  }
  async function configurationDomains(id, item) {
    await configurationConsent.requireTrust(id);
    const result = await executeProject({ workspaceId: id, runtime: item.runtime, target: "material-config-domains", jobs: 1 });
    if (result.state !== "succeeded") reject("DOMAIN_DISCOVERY_FAILED");
    project(id);
    await configurationConsent.requireTrust(id);
    const domains = resolveDomains(item, result.stdout);
    for (const roots of Object.values(domains)) { roots.workspaceId = id; roots.kconfig.externalRoots = item.externalTrees; }
    return domains;
  }
  const configurationConsent = createConfigurationConsent({ resolveProject: project, discoverDomains: configurationDomains });
  async function inspectConfigurationSemantics(roots) {
    try { await configurationConsent.requireTrust(roots.workspaceId, roots.domain, roots); }
    catch (error) {
      if (!["KCONFIG_SOURCE_TRUST_REQUIRED", "KCONFIG_SOURCE_TRUST_CHANGED"].includes(error.code)) throw error;
      if (!kconfigAdapter) throw error;
      return kconfigAdapter(roots);
    }
    const context = async admissionId => {
      const current = await configurationConsent.requireTrust(roots.workspaceId, roots.domain, roots);
      if (current.admissionId !== admissionId) reject("KCONFIG_ADMISSION_CHANGED");
      return { grantId: current.grantId, runtime: current.runtime, sourceRoot: current.sourceRoot, outputRoot: current.outputRoot,
        binding: { admissionId, sourceRevision: current.sourceRevision, configRevision: current.configRevision } };
    };
    const adapter = createKconfigAdapter({
      executeInspection: async operation => {
        const controller = new AbortController(), jobId = randomUUID();
        const job = { cancel: async () => controller.abort() };
        let receipt, recorded = false;
        const cancel = () => controller.abort();
        operation.signal?.addEventListener("abort", cancel, { once: true });
        if (disposed || operation.signal?.aborted) controller.abort();
        running.add(job);
        activeRecovery.add(jobId);
        const executeInspection = createKconfigInspection({ execution, resolveContext: context,
          onOwnership: async current => {
            if (!recorded) { quarantine.begin({ jobId, workspaceId: roots.workspaceId }); recorded = true; }
            quarantine.checkpoint(jobId, current); receipt = current;
          },
        });
        try {
          const result = await executeInspection({ ...operation, signal: controller.signal });
          if (recorded) quarantine.clear(jobId);
          return result;
        } catch (error) {
          if (recorded && receipt) {
            try {
              const state = await execution.reconcileCleanup(receipt);
              if (state.state === "verified-stopped") quarantine.clear(jobId);
            } catch { recoveryUnavailable = true; }
          }
          throw error;
        } finally {
          activeRecovery.delete(jobId); running.delete(job);
          operation.signal?.removeEventListener("abort", cancel);
        }
      },
      resolveAdmission: async () => {
        const current = await configurationConsent.requireTrust(roots.workspaceId, roots.domain, roots);
        return { sourceTrusted: true, runtime: current.runtime.kind === "wsl" ? "wsl2" : "docker", admissionId: current.admissionId,
          sourceRevision: current.sourceRevision, configRevision: current.configRevision };
      },
    });
    return adapter(roots);
  }
  const config = createConfigurationService({
    authorize: roots => configurationConsent.requireTrust(roots.workspaceId, roots.domain, roots),
    semanticAdapter: inspectConfigurationSemantics,
    resolveWorkspace: async (id, domain = "buildroot") => {
      const item = project(id);
      if (!item.externalStateVerified) reject("EXTERNAL_TREES_NOT_AUTHORIZED");
      if (!item.runtime) reject("SELECT_RUNTIME");
      if (domain !== "buildroot") return { domains: await configurationDomains(id, item) };
      const environment = await execution.probeEnvironment({
        grantId: item.grantId,
        runtime: item.runtime,
      });
      const makefile = path.join(item.source, "Makefile");
      const info = fs.lstatSync(makefile);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024)
        reject("INVALID_BUILDROOT_SOURCE");
      const version = fs
        .readFileSync(makefile, "utf8")
        .match(
          /^(?:export[ \t]+)?BR2_VERSION[ \t]*:?=[ \t]*([0-9][A-Za-z0-9.+_-]*)[ \t]*$/m,
        )?.[1];
      if (!version) reject("BUILDROOT_VERSION_UNAVAILABLE");
      project(id);
      return {
        granted: true,
        sourceRoot: item.source,
        outputRoot: item.output,
        workspaceId: id,
        kconfig: {
          buildroot: true,
          externalRoots: item.externalTrees,
          environment: {
            HOSTARCH: environment.hostArchitecture,
            HOST_GCC_VERSION: environment.hostGccVersion.split(".")[0],
            BR2_VERSION_FULL: version,
          },
        },
      };
    },
    executor: async (input) => {
      const item = project(input.workspaceId);
      if (input.domain !== "buildroot") {
        const roots = (await configurationDomains(input.workspaceId, item))[input.domain];
        if (!roots || roots.sourceRoot !== input.sourceRoot || roots.outputRoot !== input.outputRoot || roots.binding !== input.binding || roots.reconcileTarget !== input.target) reject("DOMAIN_BINDING_CHANGED");
      }
      if (!item.runtime) reject("SELECT_RUNTIME");
      const result = await executeProject({
        workspaceId: input.workspaceId,
        runtime: item.runtime,
        target: input.target,
        jobs: 1,
      });
      return { ok: result.state === "succeeded", exitCode: result.code };
    },
  });
  const defconfigWorkflows = createDefconfigWorkflows({
    resolveProject: id => { const item = project(id); authorizedExternalPaths(id, item); return item; },
    authorize: id => configurationConsent.requireTrust(id),
    configuration: config,
    execute: id => { const item = project(id); return executeProject({ workspaceId: id, runtime: item.runtime, target: "material-save-defconfig", jobs: 1 }); },
  });
  const payloadManager = createPayloadManager({
    directory: path.join(directory, "payloads"),
    dialog,
    parentWindow,
  });
  const toolFiles = createToolFiles({ dialog, parentWindow });
  const externalFiles = createToolFiles({
    dialog,
    parentWindow,
    purpose: "external-tree",
  });
  const externalWorkspaces = new Map();
  const packageDiscovery = createPackageDiscoveryService({
    resolveRoots: (workspaceId) => {
      const item = project(workspaceId);
      const [dev, ino] = item.identities.source.split(":");
      return {
        granted: true,
        sourceRoot: item.source,
        sourceIdentity: { dev, ino },
        externalTrees: [...externalWorkspaces.entries()]
          .filter(([, id]) => id === workspaceId)
          .map(([id]) => {
            const root = externalFiles.resolve(id, "write");
            const stat = fs.lstatSync(root, { bigint: true });
            externalFiles.resolve(id, "write");
            return {
              id,
              root,
              identity: { dev: String(stat.dev), ino: String(stat.ino) },
            };
          }),
      };
    },
    withLock: (roots, work) => changeConfig(roots, work),
  });
  const packageAuthoring = createPackageAuthoringService({
    resolveExternalTree: (workspaceId, externalTreeId) => {
      project(workspaceId);
      if (externalWorkspaces.get(externalTreeId) !== workspaceId)
        reject("EXTERNAL_TREE_NOT_GRANTED");
      const root = externalFiles.resolve(externalTreeId, "write");
      const stat = fs.lstatSync(root, { bigint: true });
      externalFiles.resolve(externalTreeId, "write");
      return {
        granted: true,
        root,
        identity: { dev: String(stat.dev), ino: String(stat.ino) },
      };
    },
    withLock: async (root, work) =>
      changeConfig([root], async () => {
        const result = await work();
        if (result.applied) {
          for (const item of projects.values()) {
            if (
              !item.externalStateVerified ||
              !item.externalTrees.includes(root)
            )
              continue;
            try {
              const replacement = execution.grantProject({
                root: item.root,
                source: item.source,
                output: item.output,
                trustedSource: true,
                externalTrees: item.externalTrees,
                trustedExternalTrees: true,
              });
              execution.revoke?.(item.grantId);
              item.grantId = replacement.grantId;
            } catch {
              item.externalStateVerified = false;
              result.activationRequired = true;
            }
          }
        }
        return result;
      }),
  });
  const tools = createToolsService({
    queueDirectory: path.join(directory, "tool-queue"),
    ollamaManagedDirectory: path.join(directory, "ollama"),
    ollamaCatalogueDirectory: path.join(directory, "ollama-catalogue"),
    dialog,
    parentWindow,
    payloadManager,
    resolveGrant: (id, mode) => toolFiles.resolve(id, mode),
    authorizeServerExecution: (id) => toolFiles.serverAuthorized(id),
  });
  // Companion reads deliberately omit local paths, logs, notes, payloads and credentials.
  const companion =
    typeof dialog.showMessageBox === "function"
      ? createCompanionController({
          dialog,
          parentWindow,
          onAction: async (request, context) => {
            if (disposed || !context.isAuthorized()) reject("UNAUTHORIZED");
            const summarizeJob = (job) => ({
              id: job.id,
              kind: job.kind,
              state: job.state,
              sequence: job.sequence,
              createdAt: job.createdAt,
              updatedAt: job.updatedAt,
              logCount: job.logCount,
              itemCount: job.itemCount,
            });
            switch (request.action) {
              case "workspace.read": {
                const result = workspaceRead?.();
                if (!result?.ok) reject("WORKSPACE_UNAVAILABLE");
                return {
                  revision: result.state.revision,
                  onboardingCompleted: result.state.onboardingCompleted,
                  plans: result.state.plans.map(
                    ({ id, name, runtime, target, status, updatedAt }) => ({
                      id,
                      name,
                      runtime,
                      target,
                      status,
                      updatedAt,
                    }),
                  ),
                };
              }
              case "projects.list":
                return {
                  projects: projectStore.list().map(({ id, name }) => ({
                    id,
                    name,
                    authorized: projects.has(id),
                  })),
                };
              case "jobs.list":
                return {
                  jobs: jobs
                    .list()
                    .filter((job) => job.ownerId === owner)
                    .map(summarizeJob),
                };
              case "jobs.get":
                return { job: summarizeJob(ownJob(request.args.jobId)) };
              default:
                reject("ACTION_NOT_ADMITTED");
            }
          },
        })
      : null;
  let updateInstalling = false, activeRequests = 0;
  const updates = updateHostFactory ? updateHostFactory({ canInstall: () => !disposed && activeRequests <= 1 && running.size === 0 && !jobs.list(owner).some(job => ["queued", "running", "cancelling", "dispatching"].includes(job.state)) }) : createUpdateService({
    userData: directory,
    currentVersion: version,
    currentSource: source,
  });
  const deployments = new Map();
  const outputViewers = new Map();
  function outputViewer(id) {
    const item = project(id);
    if (!outputViewers.has(id)) outputViewers.set(id, new OutputViewers(item.output));
    return outputViewers.get(id);
  }
  function deployment(id) {
    const item = project(id);
    if (!deployments.has(id))
      deployments.set(
        id,
        createDeploymentService({
          root: item.output,
          managedDirectory: path.join(directory, "guests", id),
        }),
      );
    return deployments.get(id);
  }
  async function pick(title) {
    const result = await dialog.showOpenDialog(parentWindow, {
      title,
      properties: ["openDirectory", "dontAddToRecent"],
    });
    if (result.canceled || result.filePaths.length !== 1) reject("CANCELLED");
    return result.filePaths[0];
  }
  async function choose() {
    if (choosing) reject("PICKER_BUSY");
    choosing = true;
    try {
      const root = await pick("Select the project workspace folder");
      const selectedSource = await pick(
        "Select existing Buildroot source inside the workspace",
      );
      const output = await pick(
        "Select a separate existing output folder inside the workspace",
      );
      for (const folder of [selectedSource, output]) {
        const relative = path.relative(root, folder);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
          reject("FOLDER_OUTSIDE_WORKSPACE");
      }
      const capabilities = [root, selectedSource, output].map((folder) =>
        fileGrants.grant({
          path: folder,
          kind: "directory",
          access: "read-write",
          owner,
        }),
      );
      const selectionId = randomUUID(),
        name = path.basename(root);
      selections.set(selectionId, {
        root,
        source: selectedSource,
        output,
        name,
        capabilities,
      });
      return { selectionId, name, source: selectedSource, output };
    } finally {
      choosing = false;
    }
  }
  function ownJob(id) {
    const job = jobs.get(id);
    if (job.ownerId !== owner) reject("UNAUTHORIZED");
    return job;
  }
  function safeUpdateState(state) {
    const { installerPath, installer, ...visible } = state;
    return visible;
  }
  async function changeConfig(paths, work, options) {
    let release;
    try {
      release = acquirePathLeases(paths, options);
    } catch (error) {
      if (error.code === "SOURCE_BUSY") reject("PROJECT_BUSY");
      throw error;
    }
    try {
      return await work();
    } finally {
      release();
    }
  }
  async function perform(request) {
    const action = request?.action;
    if (typeof action !== "string" || !Object.hasOwn(fields, action))
      reject("INVALID_ACTION");
    const optional = action === "build.submit"
      ? ["resources", "confirmationToken"].filter(key => Object.hasOwn(request,key)) : [];
    exact(request, ["action", ...fields[action], ...optional, ...(action.startsWith("config.") ? ["domain"] : [])]);
    if (disposed) reject("UNAVAILABLE");
    if (updateInstalling && action !== "updates.state") reject("UPDATE_INSTALL_PENDING");
    const requestWorkspace = request.workspaceId || (action === "source" ? request.request?.workspaceId : null);
    const requestedProject = typeof requestWorkspace === "string" ? projects.get(requestWorkspace) : null;
    if (requestedProject?.storage) await execution.verifyWslGrant(execution.grants.get(requestedProject.grantId), request.runtime || requestedProject.runtime);
    switch (action) {
      case "documentation.list":
        if (!documentation) reject("DOCUMENTATION_UNAVAILABLE");
        return documentation.list();
      case "documentation.searchText":
        if (!documentation) reject("DOCUMENTATION_UNAVAILABLE");
        return documentation.searchText();
      case "documentation.read":
        if (!documentation) reject("DOCUMENTATION_UNAVAILABLE");
        return documentation.read({ id: request.id });
      case "documentation.open":
        if (!documentation) reject("DOCUMENTATION_UNAVAILABLE");
        return documentation.open({ id: request.id, linkId: request.linkId });
      case "runtime.wsl":
        if (!["discover", "inspect", "import", "install", "cloneSource", "chooseProject", "prerequisites", "storage", "browse", "export"].includes(request.kind) || typeof request.distribution !== "string") reject("INVALID_REQUEST");
        if (request.kind === "chooseProject") {
          const selected = await wslRuntime.chooseProject(request.distribution);
          if (!selected) return {state:"cancelled"};
          const granted = await execution.grantWslProject(selected.receipt);
          try { return { ...registerProject(selected, granted), state:"project-adopted", distribution:request.distribution }; }
          catch (error) { execution.revoke(granted.grantId); throw error; }
        }
        return wslRuntime.perform(request.kind, request.distribution);
      case "runtime.discover":
        return execution.discover();
      case "runtime.docker.prepare": {
        const item = project(request.workspaceId);
        const selected = runtime(request.runtime);
        if (selected.kind !== "docker") reject("INVALID_RUNTIME");
        try { return await execution.prepareDocker({ grantId: item.grantId, runtime: selected }); }
        catch (error) {
          const reasons = ["client-unavailable", "permission-denied", "daemon-unavailable", "runtime-unavailable", "runtime-namespace-changed", "runtime-identity-unavailable", "managed-volume-ownership-mismatch"];
          reject(reasons.includes(error.message) ? error.message.toUpperCase().replaceAll("-", "_") : "CONTAINER_PREPARATION_FAILED");
        }
      }
      case "runtime.python.choose": {
        if (choosing) reject("PICKER_BUSY");
        choosing = true;
        try {
          const choice = await dialog.showOpenDialog(parentWindow, {
            title:
              "Select a trusted Python interpreter to run the bundled Kconfig reader",
            properties: ["openFile", "dontAddToRecent"],
          });
          if (choice.canceled || choice.filePaths.length !== 1)
            reject("CANCELLED");
          const executable = fs.realpathSync(choice.filePaths[0]);
          if (
            !/^python(?:3(?:\.\d+)?)?(?:\.exe)?$/i.test(
              path.basename(executable),
            )
          )
            reject("PYTHON_NOT_ADMITTED");
          const probe = await boundedProcess(executable, ["-I", "--version"], {
            timeoutMs: 5000,
            maxBytes: 4096,
          }).completion;
          if (
            probe.state !== "succeeded" ||
            !/^Python 3\.(?:[8-9]|\d{2,})\./.test(probe.stdout.trim())
          )
            reject("PYTHON_NOT_ADMITTED");
          kconfigAdapter = createKconfigAdapter({
            pythonExecutable: executable,
            admitted: true,
          });
          return { available: true, version: probe.stdout.trim() };
        } finally {
          choosing = false;
        }
      }
      case "project.list":
        return projectStore
          .list()
          .map((item) => ({ ...item, authorized: projects.has(item.id) }));
      case "project.portable.export": {
        const item = project(request.workspaceId);
        const options = projectOptions.get({ workspaceId: request.workspaceId });
        const imported = portableProject.retained(directory, request.workspaceId);
        const snapshot = await sources.handle({action:"source.status",workspaceId:request.workspaceId});
        const source = imported?.source || (snapshot.ok ? {revision:snapshot.revision,branch:snapshot.branch,dirty:snapshot.dirty,observedAt:new Date().toISOString(),state:"observed"} : {revision:null,branch:null,dirty:null,observedAt:new Date().toISOString(),state:"unavailable"});
        const descriptor = portableProject.validate({format:"material-buildroot-project",version:1,name:item.name,options:{runtime:item.runtime,externalTrees:options.externalTrees},source});
        return {document:JSON.stringify(descriptor,null,2)};
      }
      case "project.portable.choose": {
        if(choosing)reject("PICKER_BUSY");
        choosing=true;
        try {
          const result=await dialog.showOpenDialog(parentWindow,{title:"Import portable project descriptor",properties:["openFile","dontAddToRecent"],filters:[{name:"Project descriptor",extensions:["json"]}]});
          if(result.canceled || result.filePaths.length!==1)reject("CANCELLED");
          const descriptor=portableProject.read(result.filePaths[0]);
          const importId=randomUUID();
          if(portableImports.size>=16)portableImports.delete(portableImports.keys().next().value);
          portableImports.set(importId,{descriptor,expires:Date.now()+15*60*1000});
          return {importId,...descriptor};
        } finally {choosing=false;}
      }
      case "project.portable.import":
      case "project.portable.wslImport": {
        const held=portableImports.get(request.importId);
        if(!held || held.expires<Date.now() || request.trust!==true)reject("IMPORT_CONSENT_REQUIRED");
        const descriptor=held.descriptor;
        let selected, granted;
        if(action==="project.portable.wslImport") {
          if(descriptor.options.runtime?.kind!=="wsl")reject("INVALID_RUNTIME");
          selected=await wslRuntime.chooseProject(descriptor.options.runtime.distribution);
          if(!selected)reject("CANCELLED");
        } else {
          if(descriptor.options.runtime?.kind==="wsl")reject("WSL_IMPORT_REQUIRED");
          selected=selections.get(request.selectionId);
          if(!selected)reject("SOURCE_CONSENT_REQUIRED");
          for(const id of selected.capabilities)fileGrants.resolve({id,owner});
        }
        if(!portableImports.delete(request.importId))reject("IMPORT_CONSENT_REQUIRED");
        const imported=await changeConfig([selected.source,selected.output],async()=>{
          if(projectStore.list().some(item=>item.root===selected.root && item.source===selected.source && item.output===selected.output))reject("IMPORT_REQUIRES_NEW_PROJECT_LOCATION");
          if(selected.storage)granted=await execution.grantWslProject(selected.receipt);
          let registered;
          try { registered=registerProject({...selected,name:descriptor.name},granted); }
          catch(error) { if(granted)execution.revoke(granted.grantId);throw error; }
          try {
          const options=projectOptions.get({workspaceId:registered.workspaceId});
          portableProject.retain(directory,registered.workspaceId,descriptor);
          projectOptions.save({workspaceId:registered.workspaceId,expectedRevision:options.revision,...descriptor.options});
          const item=project(registered.workspaceId);
          item.runtime=descriptor.options.runtime;
          item.externalStateVerified=descriptor.options.externalTrees.length===0;
          return {...registered,importedSource:descriptor.source};
          } catch(error) {
            const incomplete=projects.get(registered.workspaceId);
            if(incomplete)execution.revoke(incomplete.grantId);
            projects.delete(registered.workspaceId);
            throw error;
          }
        },{metadataOnly:true});
        portableImports.delete(request.importId);
        if(selected.capabilities){selections.delete(request.selectionId);for(const id of selected.capabilities)fileGrants.revoke({id,owner});}
        return imported;
      }
      case "project.open": {
        // Metadata is not authority. Only a live, identity-checked grant opens directly.
        const item = project(request.workspaceId);
        const options = projectOptions.get({ workspaceId: request.workspaceId });
        return { workspaceId: request.workspaceId, name: item.name, runtime: item.runtime || options.runtime };
      }
      case "project.choose":
        return choose();
      case "project.adopt": {
        const selected = selections.get(request.selectionId);
        if (!selected || request.trust !== true)
          reject("SOURCE_CONSENT_REQUIRED");
        for (const id of selected.capabilities)
          fileGrants.resolve({ id, owner });
        const registered = await changeConfig(
          [selected.source, selected.output],
          () => registerProject(selected),
          { metadataOnly: true },
        );
        selections.delete(request.selectionId);
        for (const id of selected.capabilities)
          fileGrants.revoke({ id, owner });
        void scheduler.pump().catch(() => {});
        return registered;
      }
      case "project.runtime":
        return changeConfig(projectPaths(request.workspaceId), () => {
          const item = project(request.workspaceId);
          const selectedRuntime = runtime(request.runtime);
          const previous = projectOptions.get({
            workspaceId: request.workspaceId,
          });
          const saved = projectOptions.save({
            workspaceId: request.workspaceId,
            expectedRevision: previous.revision,
            runtime: selectedRuntime,
            externalTrees: previous.externalTrees,
          });
          item.runtime = selectedRuntime;
          return { configured: true, revision: saved.revision };
        });
      case "project.options": {
        const item = project(request.workspaceId);
        return {
          ...projectOptions.get({ workspaceId: request.workspaceId }),
          runtime: item.runtime,
          externalTreesAuthorized: item.externalStateVerified,
          availableTrees: [...externalWorkspaces.entries()]
            .filter(([, id]) => id === request.workspaceId)
            .map(([externalTreeId]) => ({
              externalTreeId,
              name: path.basename(
                externalFiles.resolve(externalTreeId, "write"),
              ),
            })),
        };
      }
      case "canvas.read":
        project(request.workspaceId);
        return canvasLayouts.get({
          workspaceId: request.workspaceId,
          canvasId: request.canvasId,
        });
      case "canvas.write":
        project(request.workspaceId);
        return canvasLayouts.save({
          workspaceId: request.workspaceId,
          canvasId: request.canvasId,
          expectedRevision: request.expectedRevision,
          layout: request.layout,
        });
      case "build.confirmation.challenge": {
        const candidate=request.request;
        exact(candidate,["action",...fields["build.submit"],...(Object.hasOwn(candidate||{},"resources")?["resources"]:[])]);
        if(candidate.action!=="build.submit"||candidate.target!=="clean"||!Number.isSafeInteger(candidate.jobs)||candidate.jobs<1||candidate.jobs>32) reject("INVALID_TARGET");
        reservations(candidate.resources,runtime(candidate.runtime),candidate.jobs);
        return buildConfirmation.challenge(candidate);
      }
      case "build.confirmation.confirm":
        return buildConfirmation.confirm(request);
      case "build.confirmation.cancel":
        buildConfirmation.cancel(request.id);
        return {cancelled:true};
      case "build.submit": {
        const item = project(request.workspaceId);
        if (!item.externalStateVerified)
          reject("EXTERNAL_TREES_NOT_AUTHORIZED");
        if (
          !TARGETS.includes(request.target) ||
          !Number.isSafeInteger(request.jobs) ||
          request.jobs < 1 ||
          request.jobs > 32
        )
          reject("INVALID_TARGET");
        const selectedRuntime = runtime(request.runtime);
        item.runtime = selectedRuntime;
        const resources = reservations(
          request.resources,
          selectedRuntime,
          request.jobs,
        );
        const captured = await captureBuildIntent({
          source: item.source,
          output: item.output,
          externalTrees: authorizedExternalPaths(request.workspaceId, item),
        });
        project(request.workspaceId);
        if (disposed) reject("UNAVAILABLE");
    if (updateInstalling && action !== "updates.state") reject("UPDATE_INSTALL_PENDING");
        if (request.target === "clean") buildConfirmation.consume(request);
        else if (Object.hasOwn(request,"confirmationToken")) reject("INVALID_REQUEST");
        const job = jobs.enqueue({
          kind: "build",
          ownerId: owner,
          payload: {
            workspaceId: request.workspaceId,
            target: request.target,
            runtime: selectedRuntime,
            jobs: request.jobs,
            resources,
            intent: {
              projectId: request.workspaceId,
              sourceRevision: captured.sourceRevision,
              configRevision: captured.configRevision,
            },
            snapshot: {
              version: captured.snapshot.version,
              entries: captured.snapshot.entries,
              bytes: captured.snapshot.bytes,
              excludesGitObjectHistory: true,
              symlinkPolicy: captured.snapshot.symlinkPolicy,
              symlinks: captured.snapshot.symlinks,
              limitations: [...captured.snapshot.limitations],
            },
          },
        });
        void scheduler.pump().catch(() => {});
        return job;
      }
      case "scheduler.status":
        return schedulerStatus();
      case "jobs.pump":
        await scheduler.pump();
        return schedulerStatus();
      case "jobs.reconcile": {
        const job = ownJob(request.id);
        const record = unknownRecovery().find((item) => item.jobId === job.id);
        if (!record) reject("RECOVERY_NOT_REQUIRED");
        const item = project(record.workspaceId);
        authorizedExternalPaths(record.workspaceId, item);
        if (!record.receipt || typeof execution.reconcileCleanup !== "function")
          reject("RECOVERY_IDENTITY_UNAVAILABLE");
        const verdict = await execution.reconcileCleanup(record.receipt);
        if (verdict?.state !== "verified-stopped")
          reject("RECOVERY_UNVERIFIED");
        const observed = await execution.probeResources({
          grantId: item.grantId,
          runtime: runtime(job.payload.runtime),
        });
        project(record.workspaceId);
        authorizedExternalPaths(record.workspaceId, item);
        if (
          !Number.isFinite(Date.parse(observed?.observedAt)) ||
          Math.abs(Date.now() - Date.parse(observed.observedAt)) > 15000 ||
          ![
            observed.cpuSlots,
            observed.memoryAvailableBytes,
            observed.storageAvailableBytes,
          ].every((value) => Number.isSafeInteger(value) && value >= 0) ||
          observed.cpuSlots < 1
        )
          reject("RECOVERY_CAPACITY_UNKNOWN");
        quarantine.clear(job.id);
        quarantine.list();
        recoveryUnavailable = false;
        void scheduler.pump().catch(() => {});
        return { reconciled: true, jobId: job.id };
      }
      case "jobs.list":
        return jobs.list().filter((job) => job.ownerId === owner);
      case "jobs.page":
        ownJob(request.id);
        return jobs.page(request.id, "log", {
          after: request.after,
          limit: request.limit,
        });
      case "jobs.cancel":
        ownJob(request.id);
        {
          const result = jobs.cancel(request.id, owner, request.sequence);
          void scheduler.pump().catch(() => {});
          return result;
        }
      case "jobs.retry": {
        const previous = ownJob(request.id);
        if(previous.payload.target === "clean") reject("CONFIRMATION_REQUIRED");
        project(previous.payload.workspaceId);
        const job = jobs.retry(request.id, owner, request.sequence);
        void scheduler.pump().catch(() => {});
        return job;
      }
      case "config.trustPreview":
        return changeConfig(projectPaths(request.workspaceId), () => configurationConsent.preview(request));
      case "config.trustGrant":
        return changeConfig(projectPaths(request.workspaceId), () => configurationConsent.grant(request));
      case "config.trustRevoke":
        project(request.workspaceId);
        return configurationConsent.revoke(request);
      case "defconfig.catalog":
        return changeConfig(projectPaths(request.workspaceId), () => defconfigWorkflows.catalog(request));
      case "defconfig.apply":
        return changeConfig(projectPaths(request.workspaceId), () => defconfigWorkflows.apply(request));
      case "defconfig.save":
        return changeConfig(projectPaths(request.workspaceId), () => defconfigWorkflows.save(request));
      case "config.inspect":
        return changeConfig(projectPaths(request.workspaceId), () => config.inspect(request));
      case "config.defconfigs":
        return changeConfig(projectPaths(request.workspaceId), () => config.listDefconfigs(request));
      case "config.apply":
        return changeConfig(projectPaths(request.workspaceId), () =>
          config.apply(request),
        );
      case "config.undo":
        return changeConfig(projectPaths(request.workspaceId), () =>
          config.undo(request),
        );
      case "config.defconfig":
        return changeConfig(projectPaths(request.workspaceId), () =>
          config.applyDefconfig(request),
        );
      case "artifacts.list":
        return deployment(request.workspaceId).listArtifacts();
      case "outputs.browse":
        if (typeof request.directoryId !== "string" || request.directoryId.length > 36) reject("INVALID_REQUEST");
        return outputViewer(request.workspaceId).browse(request.directoryId);
      case "outputs.inspect":
        if (typeof request.fileId !== "string" || request.fileId.length !== 36) reject("INVALID_REQUEST");
        return outputViewer(request.workspaceId).inspect(request.fileId);
      case "outputs.checksum":
        if (typeof request.fileId !== "string" || request.fileId.length !== 36 || typeof request.expected !== "string") reject("INVALID_REQUEST");
        return outputViewer(request.workspaceId).checksum(request.fileId, request.expected);
      case "artifacts.inspect":
        return deployment(request.workspaceId).inspectArtifact(request.path);
      case "artifacts.manifest":
        return deployment(request.workspaceId).createManifest({
          paths: request.paths,
        });
      case "guest.discover":
        return deployment(request.workspaceId).discoverHypervisors();
      case "guest.networks":
        return deployment(request.workspaceId).discoverNetworks();
      case "guest.preview":
        return deployment(request.workspaceId).previewGuestEdit(
          request.request,
        );
      case "guest.disk.create":
        return changeConfig(projectPaths(request.workspaceId), () =>
          deployment(request.workspaceId).createDiskArtifact(request.request),
        );
      case "guest.list":
        return deployment(request.workspaceId).listGuests();
      case "guest.create":
        return changeConfig(projectPaths(request.workspaceId), () =>
          deployment(request.workspaceId).createGuest(request.request),
        );
      case "guest.import":
        return changeConfig(projectPaths(request.workspaceId), () =>
          deployment(request.workspaceId).importGuest(request.request),
        );
      case "guest.edit":
        return changeConfig(projectPaths(request.workspaceId), () =>
          deployment(request.workspaceId).editGuest(request.request),
        );
      case "guest.launch":
        return changeConfig(projectPaths(request.workspaceId), () =>
          deployment(request.workspaceId).launchGuest(request.request),
        );
      case "guest.stop":
        return changeConfig(projectPaths(request.workspaceId), () =>
          deployment(request.workspaceId).stopGuest(request.request),
        );
      case "guest.refresh":
        return deployment(request.workspaceId).refreshGuest(request.request);
      case "conversion.preview":
        return deployment(request.workspaceId).previewConversion(
          request.request,
        );
      case "conversion.execute":
        return changeConfig(projectPaths(request.workspaceId), () =>
          deployment(request.workspaceId).executeConversion(request.request),
        );
      case "tools": {
        if (
          ![
            "ollama.status",
            "ollama.catalogue.status",
            "ollama.catalogue.page",
            "ollama.catalogue.refresh",
            "ollama.catalogue.cancel",
            "ollama.hardware",
            "ollama.fit",
            "ollama.capabilities",
            "ollama.managed.status",
            "ollama.install",
            "ollama.managed.start",
            "ollama.managed.stop",
            "ollama.managed.cancel",
            "ollama.tags",
            "ollama.running",
            "ollama.show",
            "ollama.chat",
            "converter.catalog",
            "minecraft.versions",
            "minecraft.flavours",
            "minecraft.plugins",
            "minecraft.bedrock.discovery",
            "minecraft.plugin.install",
            "minecraft.install",
            "minecraft.configure",
            "minecraft.start",
            "minecraft.stop",
            "minecraft.status",
            "ollama.pull",
            "converter.convert",
            "pdf.execute",
            "queue.add",
            "queue.page",
            "queue.run",
            "queue.cancel",
            "queue.resume",
            "queue.recover",
          ].includes(request.request?.action)
        )
          reject("ACTION_NOT_ADMITTED");
        const result = await tools.execute(request.request);
        if (result?.ok === false) reject(result.code || "TOOL_UNAVAILABLE");
        return result;
      }
      case "payload.list":
        return payloadManager.list();
      case "external.choose": {
        project(request.workspaceId);
        const choice = await externalFiles.choose({
          access: "write",
          kind: "directory",
        });
        if (disposed) reject("UNAVAILABLE");
    if (updateInstalling && action !== "updates.state") reject("UPDATE_INSTALL_PENDING");
        project(request.workspaceId);
        externalWorkspaces.set(choice.id, request.workspaceId);
        return { externalTreeId: choice.id, name: choice.name };
      }
      case "external.activate": {
        if (
          !Array.isArray(request.externalTreeIds) ||
          request.externalTreeIds.length > 32
        )
          reject("INVALID_REQUEST");
        const selectedPaths = request.externalTreeIds.map((id) => {
          if (externalWorkspaces.get(id) !== request.workspaceId)
            reject("EXTERNAL_TREE_NOT_GRANTED");
          return externalFiles.resolve(id, "write");
        });
        if (
          unknownRecovery().some(
            (record) => record.workspaceId === request.workspaceId,
          )
        ) {
          const old = projectOptions
            .get({ workspaceId: request.workspaceId })
            .externalTrees.map((tree) => tree.path);
          if (JSON.stringify(old) !== JSON.stringify(selectedPaths))
            reject("RUNTIME_RECOVERY_REQUIRED");
        }
        return changeConfig(
          [...recoverableProjectPaths(request.workspaceId), ...selectedPaths],
          () => {
            const item = project(request.workspaceId);
            if (request.trust !== true) reject("SOURCE_CONSENT_REQUIRED");
            if (
              !Array.isArray(request.externalTreeIds) ||
              request.externalTreeIds.length > 32 ||
              new Set(request.externalTreeIds).size !==
                request.externalTreeIds.length
            )
              reject("INVALID_REQUEST");
            const externalTrees = request.externalTreeIds.map((id) => {
              if (externalWorkspaces.get(id) !== request.workspaceId)
                reject("EXTERNAL_TREE_NOT_GRANTED");
              const root = externalFiles.resolve(id, "write");
              const file = path.join(root, "external.desc");
              const info = fs.lstatSync(file);
              if (!info.isFile() || info.isSymbolicLink() || info.size > 65536)
                reject("INVALID_EXTERNAL_DESCRIPTOR");
              const names = [
                ...fs
                  .readFileSync(file, "utf8")
                  .matchAll(
                    /^name:[ \t]*([A-Za-z][A-Za-z0-9_]{0,63})[ \t]*\r?$/gm,
                  ),
              ];
              if (names.length !== 1) reject("INVALID_EXTERNAL_DESCRIPTOR");
              return { path: root, name: names[0][1] };
            });
            const replacement = execution.grantProject({
              root: item.root,
              source: item.source,
              output: item.output,
              trustedSource: true,
              externalTrees: externalTrees.map((tree) => tree.path),
              trustedExternalTrees: true,
            });
            try {
              const previous = projectOptions.get({
                workspaceId: request.workspaceId,
              });
              const saved = projectOptions.save({
                workspaceId: request.workspaceId,
                expectedRevision: request.expectedRevision,
                runtime: previous.runtime,
                externalTrees,
              });
              execution.revoke?.(item.grantId);
              item.grantId = replacement.grantId;
              item.externalTrees = externalTrees.map((tree) => tree.path);
              item.externalTreeIds = [...request.externalTreeIds];
              item.externalStateVerified = true;
              return { ...saved, externalTreesAuthorized: true };
            } catch (error) {
              execution.revoke?.(replacement.grantId);
              throw error;
            }
          },
          { metadataOnly: true },
        );
      }
      case "package.preview":
        return packageAuthoring.preview(request);
      case "package.editors":
        return require("./configuration/package-editor.cjs").discoverEditors();
      case "package.editor.open":
        return packageDiscovery.openEditor(request);
      case "package.discover":
        return packageDiscovery.discover({
          workspaceId: request.workspaceId,
          query: request.query,
          offset: request.offset,
          limit: request.limit,
        });
      case "package.import":
        return packageDiscovery.importPackage({
          workspaceId: request.workspaceId,
          packageId: request.packageId,
          revision: request.revision,
        });
      case "external.previewInitialize":
        return packageAuthoring.previewInitialize(request);
      case "external.initialize":
        return packageAuthoring.applyInitialize(request);
      case "package.apply":
        return packageAuthoring.apply(request);
      case "source":
        {
        const result = await sources.handle(request.request);
        if (!result.ok) reject(result.code);
        return result;
      }
      case "payload.choose":
        return payloadManager.choose(request.toolId);
      case "file.choose":
        return toolFiles.choose(request);
      case "companion":
        exact(request.request, ["action", "args"]);
        if (!companion) reject("COMPANION_UNAVAILABLE");
        return companion.request(request.request.action, request.request.args);
      case "updates.install":
        if (request.confirmUnsigned !== true || request.workSaved !== true || !updateHostFactory) reject("UPDATE_CONSENT_REQUIRED");
        updateInstalling = true;
        try { return safeUpdateState(await updates.requestInstall({ confirmUnsigned: true, workSaved: true })); }
        finally { updateInstalling = false; }
      case "updates.notes":
        if (!updates.notes) reject("UNAVAILABLE");
        return safeUpdateState(await updates.notes());
      case "updates.later":
        if (!updates.later) reject("UNAVAILABLE");
        return safeUpdateState(updates.later());
      case "updates.check":
        return safeUpdateState(await updates.check());
      case "updates.state":
        return safeUpdateState(updates.getState());
      case "updates.download":
        void updates.download().catch(() => {});
        return safeUpdateState(updates.getState());
      case "updates.cancel":
        updates.cancel();
        return safeUpdateState(updates.getState());
      default:
        reject("INVALID_ACTION");
    }
  }
  return {
    async request(serialized) {
      activeRequests++;
      try {
        return { ok: true, result: await perform(contract.parse(serialized)) };
      } catch (error) {
        const deploymentCode =
          typeof error.message === "string" &&
          /^(?:guest|artifact|conversion|hypervisor|network|storage|legacy-storage|disk|new-disk|invalid|owned-media|vmware|unsupported|dependent-or|appliance|conflicting|unexpected|vmdk)-[a-z0-9-]{1,48}$/.test(
            error.message,
          )
            ? error.message.toUpperCase().replaceAll("-", "_")
            : undefined;
        const code =
          typeof error.code === "string" &&
          /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
            ? error.code
            : deploymentCode || "OPERATION_FAILED";
        return { ok: false, code };
      } finally { activeRequests--; }
    },
    dispose() {
      if (disposal) return disposal;
      disposed = true;
      buildConfirmation.dispose();
      scheduler.close();
      for (const job of jobs.list(owner))
        if (["running", "cancelling"].includes(job.state)) {
          if (job.state === "running") {
            try {
              jobs.cancel(job.id, owner, job.sequence);
            } catch {}
          }
        }
      fileGrants.clear();
      updates.close?.();
      updates.cancel();
      toolFiles.dispose();
      externalFiles.dispose();
      externalWorkspaces.clear();
      sources.dispose();
      disposal = Promise.allSettled([
        scheduler.awaitIdle(),
        tools.dispose?.(),
        companion?.request("companion.stop", {}),
        ...[...running].map((job) => job.cancel()),
      ]);
      return disposal;
    },
  };
}
module.exports = { createOperationsService };



