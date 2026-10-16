"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { createBudgetStore } = require("./jobs/budgets.cjs");
const { createBuildScheduler } = require("./jobs/scheduler.cjs");
const { createBuildQuarantine } = require("./jobs/quarantine.cjs");
const { createBuildConfirmation } = require("./security/build-confirmation.cjs");
const { captureBuildIntent } = require("./jobs/build-intent.cjs");
const targetActions = require("./build/target-actions.cjs");
const { ExecutionService, TARGETS } = require("./execution/index.cjs");
const { createJobManager } = require("./jobs/manager.cjs");
const { createConfigurationService } = require("./configuration/index.cjs");
const { createAccountProvisioning } = require("./configuration/account-provisioning.cjs");
const { createImagePresets } = require("./configuration/image-presets.cjs");
const { createDefconfigWorkflows } = require("./configuration/defconfig-workflows.cjs");
const { resolveDomains } = require("./configuration/domains.cjs");
const { createConfigurationConsent } = require("./configuration/runtime-consent.cjs");
const { createKconfigInspection } = require("./execution/kconfig-inspection.cjs");
const { createDeploymentService } = require("./deployment/index.cjs");
const { OutputViewers } = require("./deployment/output-viewers.cjs");
const { SdkExport } = require("./deployment/sdk-export.cjs");
const { CloudDestinations } = require("./deployment/cloud-destinations.cjs");
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
const { createBuildProvenance } = require("./deployment/build-provenance.cjs");
const {
  createPackageAuthoringService,
} = require("./configuration/package-authoring.cjs");
const {
  createPackageDiscoveryService,
} = require("./configuration/package-discovery.cjs");
const contract = require("./security/workspace-contract.cjs");
const portableProject = require("./storage/portable-project.cjs");
const { createExecutionJobs } = require("./execution/jobs-service.cjs");

const { createWslRuntime } = require("./execution/wsl-runtime.cjs");
const { createExecutionSetup } = require('./execution/setup.cjs');
const { createWorkflowService } = require('./execution/workflow-service.cjs');
const owner = "desktop-owner";
const fields = {
  'execution.cli': ['kind'],
  'execution.inspect': ['sourceRepository','executionRepository','mode'],
  'execution.discover': ['selectionId'],
  'execution.selectRunner': ['selectionId','kind','runnerId','billingConsent'],
  'execution.revoke': ['selectionId'],
  "execution.workflowPreview": ["selectionId", "model", "text"],
  "execution.workflowPublish": ["previewId", "sha256", "consent"],
  "execution.workflowAdmission": ["selectionId"],
  "execution.jobs.list": [],
  "execution.jobs.dispatch": ["selectionId", "consent"],
  "execution.jobs.observe": ["id"],
  "execution.jobs.reconnect": ["id", "selectionId", "consent"],
  "execution.jobs.cancel": ["id", "consent"],
  "execution.jobs.outputs": ["id"],
  "execution.jobs.download": ["id", "artifactId", "consent"],
  "execution.jobs.cancelDownload": ["id"],
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
  "build.targets": ["workspaceId"],
  "build.submit": ["workspaceId", "target", "runtime", "jobs"],
  "build.confirmation.challenge": ["request"],
  "build.confirmation.confirm": ["id", "firstKey", "secondKey", "slider", "rebuildConsent"],
  "build.confirmation.cancel": ["id"],
  "jobs.list": [],
  "scheduler.status": [],
  "scheduler.configure": ["limits"],
  "jobs.project": ["workspaceId"],
  "jobs.projectPage": ["workspaceId", "id", "after", "limit"],
  "jobs.projectCancel": ["workspaceId", "id", "sequence"],
  "jobs.pump": [],
  "jobs.reconcile": ["id"],
  "jobs.page": ["id", "after", "limit"],
  "jobs.cancel": ["id", "sequence"],
  "jobs.retry": ["id", "sequence"],
  "config.trustPreview": ["workspaceId"],
  "config.trustGrant": ["workspaceId", "challengeId", "trusted"],
  "config.trustRevoke": ["workspaceId"],
  "accountProvisioning.choose": ["workspaceId"],
  "accountProvisioning.preview": ["workspaceId", "username", "uid", "keyId"],
  "accountProvisioning.apply": ["workspaceId", "planId"],
  "imagePreset.catalog": ["workspaceId"],
  "imagePreset.plan": ["workspaceId", "revision", "preset", "desktop", "ssh"],
  "imagePreset.apply": ["workspaceId", "revision", "preset", "desktop", "ssh"],
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
  "outputs.manifest": ["workspaceId", "fileIds"],
  "outputs.compare": ["workspaceId", "beforeId", "afterId"],
  "sdk.preview": ["workspaceId", "fileId"],
  "sdk.export": ["workspaceId", "id"],
  "cloud.list": ["workspaceId"],
  "cloud.import": ["workspaceId"],
  "cloud.remove": ["workspaceId", "id"],
  "cloud.preview": ["workspaceId", "fileId", "destinationId"],
  "cloud.start": ["workspaceId", "id", "consent"],
  "cloud.cancel": ["workspaceId", "id"],
  "cloud.retry": ["workspaceId", "id", "consent"],
  "artifacts.manifest": ["workspaceId", "paths"],
  "artifacts.compare": ["workspaceId", "beforePath", "afterPath"],
  "artifacts.compliance": ["workspaceId"],
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
  notificationTransition = () => {},
  documentationDirectory,
  openDocumentationExternal,
  updateHostFactory,
  openWslPath,
  cloudVault,
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
  const executionSetup = createExecutionSetup({directory,dialog,parentWindow,openExternal:openDocumentationExternal});
  const executionWorkflows = createWorkflowService({setup:executionSetup});
  const documentation = documentationDirectory
    ? createDocumentationService({
        directory: documentationDirectory,
        openExternal: openDocumentationExternal,
      })
    : null;
  let executionJobs;
  function hostedJobs() {
    return executionJobs ??= createExecutionJobs({
      setup: executionSetup, workflows: executionWorkflows, directory,
      chooseDirectory: async () => {
        if (choosing) reject("PICKER_BUSY");
        choosing = true;
        try {
          const selected = await dialog.showOpenDialog(parentWindow, {
            title: "Choose folder for verified Buildroot outputs",
            properties: ["openDirectory", "dontAddToRecent"],
          });
          return selected.canceled ? null : selected.filePaths[0] || null;
        } finally { choosing = false; }
      },
    });
  }
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
  const provenance = createBuildProvenance({
    directory: path.join(directory, "reproducibility"),
    getJob: id => jobs.get(id, owner),
    listJobs: () => jobs.list(owner),
  });
  const jobs = createJobManager({
    onTransition: notificationTransition,
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
        const buildLineage = provenance.begin(project(payload.workspaceId), payload);
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
        let reproducibility;
        try {
          reproducibility = await provenance.complete({ item: project(payload.workspaceId), payload, jobId: context.jobId, signal: context.signal, lineage: buildLineage });
        } catch (error) {
          reproducibility = { state: "unbound", reason: typeof error.code === "string" && /^(?:PROVENANCE|BLOCKED)_[A-Z_]+$/.test(error.code) ? error.code : "PROVENANCE_UNAVAILABLE" };
        }
        context.item({ kind: "reproducibility", ...reproducibility });
        return { state: result.state, code: result.code, reproducibility };
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
  const budgetStore = createBudgetStore(path.join(directory, "scheduler-budgets.json"), schedulerLimits);
  schedulerLimits = budgetStore.read();
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
      !targetActions.isBuildTarget(payload.target, TARGETS) ||
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
  const accountProvisioning = createAccountProvisioning({ resolveProject: id => { const item = project(id); authorizedExternalPaths(id, item); return item; }, authorize: id => configurationConsent.requireTrust(id), configuration: config, dialog, parentWindow });
  const imagePresets = createImagePresets({ configuration: config });
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
    minecraftManagedDirectory: path.join(directory, "minecraft-manager"),
    ollamaManagedDirectory: path.join(directory, "ollama"),
    ollamaCatalogueDirectory: path.join(directory, "ollama-catalogue"),
    dialog,
    parentWindow,
    payloadManager,
    resolveGrant: (id, mode) => toolFiles.resolve(id, mode),
    authorizeServerExecution: (id) => toolFiles.serverAuthorized(id),
  });
  const companionQueueAuthorities=new Map();let companionQueueRunning=false;
  function companionServerInstallRequest(payload){switch(payload.distribution){case 'paper':return {action:'minecraft.paper.install',directoryId:payload.directoryId,version:payload.version,build:payload.build,acceptLicense:true};case 'fabric':return {action:'minecraft.fabric.install',directoryId:payload.directoryId,version:payload.version,loader:payload.loader,installer:payload.installer,acceptLicense:true,acceptRuntimeDownloads:true};case 'plugin':return {action:'minecraft.plugin.install',directoryId:payload.directoryId,versionId:payload.versionId,gameVersion:payload.gameVersion,loader:payload.loader,acceptPluginCode:true,acceptLicense:true};case 'vanilla':return {action:'minecraft.install',edition:'java',version:payload.version,directoryId:payload.directoryId};default:reject('SERVER_INSTALL_NOT_ADMITTED');}}
  function companionToolGrants(kind,payload){if(['server-install','server-transfer'].includes(kind)){toolFiles.resolve(payload.directoryId,'write');if(!toolFiles.serverAuthorized(payload.directoryId))reject('SERVER_EXECUTION_CONSENT_REQUIRED');}else{for(const id of payload.sourceIds||[payload.sourceId])toolFiles.resolve(id,'read');if(payload.destinationId)toolFiles.resolve(payload.destinationId,'write');}}
  async function executeCompanionTool(kind,payload,context){const authorize=companionQueueAuthorities.get(context.jobId);if(!authorize)reject('CURRENT_NATIVE_GRANTS_REQUIRED');authorize();companionToolGrants(kind,payload);const observer=setInterval(()=>{try{authorize();if(disposed)throw Error('closed');}catch{try{const current=companionToolQueue.get(context.jobId);if(['queued','running'].includes(current.state))companionToolQueue.cancel(current.id,current.ownerId,current.sequence);}catch{}}},250);observer.unref?.();try{const result=await tools.execute(kind==='server-transfer'?{action:'minecraft.remote.execute',previewId:payload.previewId,confirmSha256:payload.confirmSha256}:kind==='server-install'?companionServerInstallRequest(payload):{action:kind==='conversion'?'converter.convert':'pdf.execute',...payload},{signal:context.signal});if(result.ok===false){context.checkpoint({state:'failed',code:result.code||'TOOL_UNAVAILABLE'});reject('TOOL_UNAVAILABLE');}const projection=kind==='server-transfer'?{state:result.state||'unknown',completed:result.completed||0,total:result.total||0,bytesCompleted:result.bytesCompleted||0,bytesTotal:result.bytesTotal||0,hostIdentityVerified:result.hostIdentityVerified===true,remoteDestinationMayExist:result.remoteDestinationMayExist===true}:kind==='server-install'?{installed:result.installed===true,version:result.version||payload.version||payload.gameVersion||null,bytes:result.bytes||0,sha1:result.sha1||null,sha256:result.sha256||null,sha512:result.sha512||null,runtimeVerified:result.runtimeVerified===true,bootstrapOnly:result.bootstrapOnly===true,completeRuntimeInstalled:result.completeRuntimeInstalled===true,publishedDigestVerified:result.publishedDigestVerified===true}:kind==='conversion'?{bytes:result.bytes,sha256:result.sha256,format:result.format}:payload.operation==='inspect'?{pageCounts:result.pageCounts,encryptedOrInvalid:result.encryptedOrInvalid}:{pages:result.pages,bytes:result.bytes,sha256:result.sha256,operation:result.operation};context.item({state:'completed',result:projection});return projection;}finally{clearInterval(observer);}}
  const companionToolQueue=createJobManager({directory:path.join(directory,'companion-tools'),adapters:{'server-transfer':(payload,context)=>executeCompanionTool('server-transfer',payload,context),'server-install':(payload,context)=>executeCompanionTool('server-install',payload,context),conversion:(payload,context)=>executeCompanionTool('conversion',payload,context),pdf:(payload,context)=>executeCompanionTool('pdf',payload,context)}});
  async function pumpCompanionTools(){if(companionQueueRunning||disposed)return;companionQueueRunning=true;try{for(;;){const next=companionToolQueue.list().find(job=>job.state==='queued'&&companionQueueAuthorities.has(job.id));if(!next||disposed)break;try{await companionToolQueue.run(next.id,next.ownerId,next.sequence);}catch{}finally{companionQueueAuthorities.delete(next.id);}}}finally{companionQueueRunning=false;}}
  function enqueueCompanionTool(kind,payload,sessionId,operationId,authorize){authorize();companionToolGrants(kind,payload);const job=companionToolQueue.enqueue({kind,payload,ownerId:sessionId,operationId});companionQueueAuthorities.set(job.id,authorize);void pumpCompanionTools();return job;}
  const {createCompanionConsumers, actionContracts} = require('./security/companion-consumers.cjs');
  const consumers = createCompanionConsumers({
    authorizeProject: id => project(id),
    chooseSource: () => sources.handle({action:'source.choose'}),
    previewSource: request => sources.handle({action:'source.upgrade.preview',...request}),
    previewRollback: request => sources.handle({action:'source.rollback.preview',...request}),
    applySourceRollback: request => sources.handle({action:'source.rollback.apply',...request,consent:true}),
    applySourceUpgrade: request => sources.handle({action:'source.upgrade.apply',...request,consent:true}),
    confirmSourceUpgrade: async (preview,context,authorize) => {authorize();if(typeof preview.patch!=='string'||preview.patch.length>16000)reject('NATIVE_SOURCE_REVIEW_REQUIRED');const answer=await dialog.showMessageBox(parentWindow,{type:'warning',title:'Review source revision change',message:`Apply source revision ${preview.toRevision}?`,detail:`Origin: ${context.origin}\nDevice: ${context.deviceName}\nCurrent revision: ${preview.fromRevision}\nDirty source: ${preview.dirty}\n\n${preview.patch}\n\nThe existing source workflow creates its rollback snapshot and rejects changed or dirty source.`,buttons:['Cancel','Apply reviewed source'],defaultId:0,cancelId:0,noLink:true});authorize();return answer.response===1;},
    cloneOfficial: request => sources.handle({action:'source.clone.official',...request,trust:true}),
    confirmSource: async (request,context,authorize) => {authorize();const answer=await dialog.showMessageBox(parentWindow,{type:'warning',title:'Approve source clone',message:'Clone official Buildroot source into the selected folder?',detail:`Origin: ${context.origin}\nDevice: ${context.deviceName}\nDirectory: ${request.directory}\nRef: ${request.ref}\nSource: https://gitlab.com/buildroot.org/buildroot.git\n\nThis approves source trust and project adoption for this one clone. Existing directories are preserved.`,buttons:['Cancel','Approve clone'],defaultId:0,cancelId:0,noLink:true});authorize();return answer.response===1;},
    modelStatus: () => tools.execute({action:'ollama.status'}),
    listServers: () => tools.execute({action:'minecraft.records.list'}),
    serverVersions: edition => tools.execute({action:edition==='java'?'minecraft.versions':'minecraft.bedrock.discovery',...edition==='java'?{edition}:{}}),
    serverFlavours: flavour => tools.execute({action:'minecraft.flavours',flavour}),
    paperBuilds: version => tools.execute({action:'minecraft.paper.builds',version}),
    previewRemoteServer: request => tools.execute({action:'minecraft.remote.preview',kind:'server',...request,confirmStopped:true,acceptEula:true}),
    queueRemoteServer: (request,context,authorize) => enqueueCompanionTool('server-transfer',request,context.sessionId,context.operationId,authorize),
    remoteServerStatus: previewId => tools.execute({action:'minecraft.remote.status',previewId}),
    fabricOptions: version => tools.execute({action:'minecraft.fabric.options',version}),
    installPaper: (request,context,authorize) => enqueueCompanionTool('server-install',{distribution:'paper',...request},context.sessionId,context.operationId,authorize),
    installFabric: (request,context,authorize) => enqueueCompanionTool('server-install',{distribution:'fabric',...request},context.sessionId,context.operationId,authorize),
    installPlugin: (request,context,authorize) => enqueueCompanionTool('server-install',{distribution:'plugin',...request},context.sessionId,context.operationId,authorize),
    serverPlugins: projectId => tools.execute({action:'minecraft.plugins',projectId}),
    chooseServerDirectory: () => toolFiles.choose({access:'write',kind:'directory'}),
    readServerConfiguration: request => tools.execute({action:'minecraft.configuration.read',...request}),
    saveServerConfiguration: request => tools.execute({action:'minecraft.configuration.save',...request,acceptEula:true}),
    installVanillaServer: (request,context,authorize) => enqueueCompanionTool('server-install',{distribution:'vanilla',directoryId:request.directoryId,version:request.version},context.sessionId,context.operationId,authorize),
    confirmServerMutation: async (action,request,context,authorize) => {authorize();const selected=toolFiles.resolve(request.directoryId,'write');const answer=await dialog.showMessageBox(parentWindow,{type:'warning',title:'Approve exact server operation',message:`Approve ${action}?`,detail:`Directory: ${selected}\nOrigin: ${context.origin}\nDevice: ${context.deviceName}\n${JSON.stringify(request,null,2)}\n\nReview the Minecraft EULA at https://www.minecraft.net/eula and the selected distribution or plugin license. Plugin installation approves downloaded code execution; Fabric may provide a bootstrap launcher with later runtime downloads, not a complete verified runtime. Approval accepts the EULA for this operation, allows the shown configuration or download, and for start authorizes execution of server code with your account. For SSH operations, review the exact host alias and destination above. The source must be stopped before transfer. Existing SSH authentication and strict known-host checks are retained; no credentials or automatic host-key acceptance are supplied. No other directory or server is approved.`,buttons:['Cancel','Approve exact operation'],defaultId:0,cancelId:0,noLink:true});authorize();toolFiles.resolve(request.directoryId,'write');return answer.response===1;},
    startManagedServer: async (request,authorize) => {authorize();const value=await tools.execute({action:'minecraft.managed.start',...request,acceptExecution:true,acceptEula:true});if(value.ok===false)return value;let checking=false;const observer=setInterval(async()=>{if(checking)return;checking=true;try{try{authorize();if(disposed)throw Error('closed');}catch{await tools.execute({action:'minecraft.managed.stop',serverId:request.serverId});clearInterval(observer);return;}const current=await tools.execute({action:'minecraft.managed.status',serverId:request.serverId});if(current.ok===false||['stopped','exited','start-failed','not-managed','ownership-unverified','connection-lost'].includes(current.state))clearInterval(observer);}finally{checking=false;}},500);observer.unref?.();return value;},
    serverStatus: serverId => tools.execute({action:'minecraft.managed.status',serverId}),
    stopServer: serverId => tools.execute({action:'minecraft.managed.stop',serverId}),
    confirmServerStop: async (serverId,target,context,authorize) => {authorize();const answer=await dialog.showMessageBox(parentWindow,{type:'warning',title:'Review managed server stop',message:`Stop managed server ${serverId}?`,detail:`Target: ${target}\nBrowser origin: ${context.origin}\nDevice: ${context.deviceName}\n\nOnly the existing server manager can determine ownership and whether the process actually stopped. Saved metadata does not grant execution authority.`,buttons:['Cancel','Request server stop'],defaultId:0,cancelId:0,noLink:true});authorize();return answer.response===1;},
    chooseConversionFile: access => toolFiles.choose({access,kind:'file'}),
    conversionCatalog: () => tools.execute({action:'converter.catalog'}),
    queueConversion: (request,context,authorize) => enqueueCompanionTool('conversion',request,context.sessionId,context.operationId,authorize),
    queuePdf: (request,context,authorize) => enqueueCompanionTool('pdf',request,context.sessionId,context.operationId,authorize),
    toolQueuePage: (sessionId,after) => {const jobs=companionToolQueue.list(sessionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));const start=after?jobs.findIndex(item=>item.id===after)+1:0;if(after&&start===0)reject('INVALID_CURSOR');const page=jobs.slice(start,start+50);return {jobs:page,next:start+50<jobs.length?page.at(-1).id:null};},
    toolQueueGet: (sessionId,id) => companionToolQueue.get(id,sessionId),
    toolQueueCancel: (sessionId,id,sequence) => companionToolQueue.cancel(id,sessionId,sequence),
    toolQueueHistory: after => {const jobs=companionToolQueue.list().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));const start=after?jobs.findIndex(item=>item.id===after)+1:0;if(after&&start===0)reject('INVALID_CURSOR');const page=jobs.slice(start,start+50);return {jobs:page,next:start+50<jobs.length?page.at(-1).id:null};},
    runConversion: async (request,authorize) => {authorize();toolFiles.resolve(request.sourceId,'read');toolFiles.resolve(request.destinationId,'write');const controller=new AbortController();const observer=setInterval(()=>{try{authorize();if(disposed)throw Error('closed');}catch{controller.abort();}},250);observer.unref?.();try{return await tools.execute({action:'converter.convert',...request},{signal:controller.signal});}finally{clearInterval(observer);}},
    startModelChat: async (request,authorize) => {
      authorize();const value=await tools.execute({action:'ollama.chat.start',model:request.model,messages:[{role:'user',content:request.prompt}]});
      if(value.ok===false)return value;
      let checking=false;
      const observer=setInterval(async()=>{if(checking)return;checking=true;try{try{authorize();if(disposed)throw Error('closed');}catch{await tools.execute({action:'ollama.chat.cancel',id:value.id});clearInterval(observer);return;}const current=await tools.execute({action:'ollama.chat.read',id:value.id,offset:0});if(current.ok===false||current.state!=='running')clearInterval(observer);}finally{checking=false;}},500);observer.unref?.();
      try{authorize();}catch{await tools.execute({action:'ollama.chat.cancel',id:value.id});clearInterval(observer);throw Object.assign(Error('Chat authority expired.'),{code:'UNAUTHORIZED'});}return value;
    },
    readModelChat: (id,offset) => tools.execute({action:'ollama.chat.read',id,offset}),
    cancelModelChat: id => tools.execute({action:'ollama.chat.cancel',id}),
    modelList: () => tools.execute({action:'ollama.tags'}),
    cloudList: workspaceId => cloudDestination(workspaceId).list(),
    cancelCloud: (workspaceId,id) => cloudDestination(workspaceId).cancel(id),
    startCloud: (workspaceId,id,authorize) => cloudDestination(workspaceId).start({id,consent:true},authorize),
    previewCloud: (workspaceId,viewer,fileId,destinationId) => {const selected=viewer.resolve(fileId,'file');const admitted=outputViewer(workspaceId).admit(selected.grant.relative,'file');return cloudDestination(workspaceId).preview({fileId:admitted,destinationId});},
    confirmMutation: async (request,authorize) => {
      authorize();project(request.args.workspaceId);
      const result=await dialog.showMessageBox(parentWindow,{type:'warning',title:'Review companion change',
        message:`Approve ${request.action} for the selected project?`,
        detail:`Browser origin: ${request.origin}\nDevice: ${request.deviceName}\nProject: ${request.args.workspaceId}\nRevision: ${request.args.revision}\n${request.args.symbol ? `Symbol: ${request.args.symbol}\nRequested value: ${String(request.args.change.value)}` : `Configuration: ${request.args.id||request.args.domain}`}\n\nThis uses the existing project trust and configuration transaction. No new filesystem or execution grant is created.`,
        buttons:['Cancel','Approve this change'],defaultId:0,cancelId:0,noLink:true});
      authorize();project(request.args.workspaceId);return result.response===1;
    },
    inspectConfiguration: request => changeConfig(projectPaths(request.workspaceId),()=>config.inspect(request)),
    applyConfiguration: request => changeConfig(projectPaths(request.workspaceId),()=>config.apply({workspaceId:request.workspaceId,domain:request.domain,revision:request.revision,changes:{[request.symbol]:request.change}})),
    undoConfiguration: request => changeConfig(projectPaths(request.workspaceId),()=>config.undo(request)),
    applyDefconfig: request => changeConfig(projectPaths(request.workspaceId),()=>defconfigWorkflows.apply(request)),
    readWorkspace: () => {
      const result=workspaceRead?.();
      if(!result?.ok) reject('WORKSPACE_UNAVAILABLE');
      return {revision:result.state.revision,onboardingCompleted:result.state.onboardingCompleted,
        plans:result.state.plans.map(({id,name,runtime,target,status,updatedAt})=>({id,name,runtime,target,status,updatedAt}))};
    },
    listProjects: () => projectStore.list().map(({id,name})=>({id,name,authorized:projects.has(id)})),
    listJobs: () => jobs.list().filter(job=>job.ownerId===owner),
    getJob: id => ownJob(id),
    cancelJob: (id,sequence) => {ownJob(id);const result=jobs.cancel(id,owner,sequence);void scheduler.pump().catch(()=>{});return result;},
    sourceStatus: workspaceId => sources.handle({action:'source.status',workspaceId}),
    projectOptions: workspaceId => {const item=project(workspaceId);return {...projectOptions.get({workspaceId}),runtime:item.runtime,externalTreesAuthorized:item.externalStateVerified,availableTrees:[...externalWorkspaces.entries()].filter(([,id])=>id===workspaceId)};},
    defconfigCatalog: workspaceId => changeConfig(projectPaths(workspaceId),()=>defconfigWorkflows.catalog({workspaceId})),
    submitBuild: async (request,authorize) => {
      authorize();
      const item=project(request.workspaceId);
      if(disposed||updateInstalling)reject('UNAVAILABLE');
      if(!item.externalStateVerified)reject('EXTERNAL_TREES_NOT_AUTHORIZED');
      const selectedRuntime=runtime(item.runtime);
      const resources=reservations(undefined,selectedRuntime,request.jobs);
      const captured=await captureBuildIntent({source:item.source,output:item.output,externalTrees:authorizedExternalPaths(request.workspaceId,item)});
      // Recheck at the enqueue boundary after every asynchronous preparation step.
      authorize();project(request.workspaceId);
      if(disposed||updateInstalling)reject('UNAVAILABLE');
      const job=jobs.enqueue({kind:'build',ownerId:owner,payload:{workspaceId:request.workspaceId,target:request.target,runtime:selectedRuntime,jobs:request.jobs,resources,
        intent:{projectId:request.workspaceId,sourceRevision:captured.sourceRevision,configRevision:captured.configRevision},
        snapshot:{version:captured.snapshot.version,entries:captured.snapshot.entries,bytes:captured.snapshot.bytes,excludesGitObjectHistory:true,symlinkPolicy:captured.snapshot.symlinkPolicy,symlinks:captured.snapshot.symlinks,limitations:[...captured.snapshot.limitations]}}});
      const observer=setInterval(()=>{try{const current=ownJob(job.id);if(!['queued','running','dispatching','cancelling'].includes(current.state)){clearInterval(observer);return;}try{authorize();if(disposed)throw Error('closed');}catch{if(current.state!=='cancelling')jobs.cancel(current.id,owner,current.sequence);void scheduler.pump().catch(()=>{});clearInterval(observer);}}catch{clearInterval(observer);}},250);observer.unref?.();
      void scheduler.pump().catch(()=>{});return job;
    },
    buildTargets: workspaceId => targetActions.catalog(project(workspaceId)),
    openOutputs: workspaceId => new OutputViewers(project(workspaceId).output),


  });
  const companion = typeof dialog.showMessageBox === 'function'
    ? createCompanionController({dialog,parentWindow,actionContracts,
        allowedScopes:[...new Set(Object.values(actionContracts).map(value=>value.scope))],
        onAction:(request,context)=>{if(disposed)reject('UNAUTHORIZED');return consumers.dispatch(request,context);}})
    : null;
  let updateInstalling = false, activeRequests = 0;
  const updates = updateHostFactory ? updateHostFactory({ canInstall: () => !disposed && activeRequests <= 1 && running.size === 0 && !jobs.list(owner).some(job => ["queued", "running", "cancelling", "dispatching"].includes(job.state)) }) : createUpdateService({
    userData: directory,
    currentVersion: version,
    currentSource: source,
  });
  const deployments = new Map();
  const outputViewers = new Map();
  const sdkExports = new Map();
  const cloudDestinations = new Map();
  function cloudDestination(id) {
    project(id);
    if (!cloudDestinations.has(id)) cloudDestinations.set(id, new CloudDestinations({
      directory: path.join(directory, "cloud-destinations", id), vault: cloudVault,
      viewer: outputViewer(id), dialog, parentWindow,
      resolveGh: () => executionSetup.host.executable(),
    }));
    return cloudDestinations.get(id);
  }
  function sdkExport(id) {
    project(id);
    if (!sdkExports.has(id)) sdkExports.set(id, new SdkExport({ viewer: outputViewer(id), manifest: relative => perform({ action: "artifacts.manifest", workspaceId: id, paths: [relative] }) }));
    return sdkExports.get(id);
  }
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
          resolveExecutable: (toolId) => payloadManager.resolve(toolId),
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
    if (action.startsWith("cloud.")) {
      const cloud = cloudDestination(request.workspaceId);
      switch (action) {
        case "cloud.list": return cloud.list();
        case "cloud.import": return cloud.importProfile();
        case "cloud.remove": return cloud.remove(request.id);
        case "cloud.preview": return cloud.preview(request);
        case "cloud.start": return cloud.start(request);
        case "cloud.cancel": return cloud.cancel(request.id);
        case "cloud.retry": return cloud.retry(request);
      }
    }
    if (action.startsWith("execution.jobs.")) {
      const method = action.slice("execution.jobs.".length);
      const { action: _action, ...args } = request;
      return hostedJobs()[method](args);
    }
    const requestWorkspace = request.workspaceId || (action === "source" ? request.request?.workspaceId : null);
    const requestedProject = typeof requestWorkspace === "string" ? projects.get(requestWorkspace) : null;
    if (requestedProject?.storage) await execution.verifyWslGrant(execution.grants.get(requestedProject.grantId), request.runtime || requestedProject.runtime);
    switch (action) {
      case 'execution.cli': {
        if(!['status','choose','acquire','login','openLogin','cancel'].includes(request.kind)) reject('INVALID_REQUEST');
        return executionSetup.host[request.kind]();
      }
      case 'execution.inspect': return executionSetup.inspect(request);
      case 'execution.discover': return executionSetup.discover(request.selectionId);
      case 'execution.selectRunner': return executionSetup.selectRunner(request);
      case 'execution.revoke': return {revoked:executionSetup.revoke(request.selectionId)};
      case "execution.workflowPreview": return executionWorkflows.preview(request);
      case "execution.workflowPublish": return executionWorkflows.publish(request);
      case "execution.workflowAdmission": return executionWorkflows.admission(request);
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
      case "build.targets": return targetActions.catalog(project(request.workspaceId));
      case "build.confirmation.challenge": {
        const candidate=request.request;
        exact(candidate,["action",...fields["build.submit"],...(Object.hasOwn(candidate||{},"resources")?["resources"]:[])]);
        if(candidate.action!=="build.submit"||!targetActions.isDestructiveTarget(candidate.target)||!Number.isSafeInteger(candidate.jobs)||candidate.jobs<1||candidate.jobs>32) reject("INVALID_TARGET");
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
          !targetActions.isBuildTarget(request.target, TARGETS) ||
          !Number.isSafeInteger(request.jobs) ||
          request.jobs < 1 ||
          request.jobs > 32
        )
          reject("INVALID_TARGET");
        targetActions.assertPackage(item, request.target);
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
        if (targetActions.isDestructiveTarget(request.target)) buildConfirmation.consume(request);
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
      case "scheduler.configure": {
        schedulerLimits = budgetStore.write(request.limits);
        scheduler.setLimits(schedulerLimits);
        void scheduler.pump().catch(() => {});
        return schedulerStatus();
      }
      case "jobs.project":
        project(request.workspaceId);
        return jobs.list(owner).filter(job => job.payload.workspaceId === request.workspaceId);
      case "jobs.projectPage": {
        project(request.workspaceId);
        const job = ownJob(request.id);
        if (job.payload.workspaceId !== request.workspaceId) reject("UNAUTHORIZED");
        return jobs.page(request.id, "log", { after: request.after, limit: request.limit }, owner);
      }
      case "jobs.projectCancel": {
        project(request.workspaceId);
        const job = ownJob(request.id);
        if (job.payload.workspaceId !== request.workspaceId) reject("UNAUTHORIZED");
        const result = jobs.cancel(request.id, owner, request.sequence);
        void scheduler.pump().catch(() => {});
        return result;
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
        if(targetActions.isDestructiveTarget(previous.payload.target)) reject("CONFIRMATION_REQUIRED");
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
      case "accountProvisioning.choose":
        return accountProvisioning.choose(request);
      case "accountProvisioning.preview":
        return changeConfig(projectPaths(request.workspaceId), () => accountProvisioning.preview(request));
      case "accountProvisioning.apply":
        return changeConfig(projectPaths(request.workspaceId), () => accountProvisioning.apply(request));
      case "imagePreset.catalog":
        return changeConfig(projectPaths(request.workspaceId), () => imagePresets.catalog(request));
      case "imagePreset.plan":
        return changeConfig(projectPaths(request.workspaceId), () => imagePresets.plan(request));
      case "imagePreset.apply":
        return changeConfig(projectPaths(request.workspaceId), () => imagePresets.apply(request));
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
      case "sdk.preview":
        if (typeof request.fileId !== "string" || request.fileId.length !== 36) reject("INVALID_REQUEST");
        return changeConfig(projectPaths(request.workspaceId), () => sdkExport(request.workspaceId).preview(request.fileId));
      case "sdk.export":
        if (typeof request.id !== "string" || request.id.length !== 36) reject("INVALID_REQUEST");
        return changeConfig(projectPaths(request.workspaceId), () => sdkExport(request.workspaceId).execute(request.id));
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
      case "outputs.manifest": {
        if (!Array.isArray(request.fileIds) || !request.fileIds.length || request.fileIds.length > 1000 || new Set(request.fileIds).size !== request.fileIds.length || request.fileIds.some(id => typeof id !== "string" || id.length !== 36)) reject("INVALID_REQUEST");
        return changeConfig(projectPaths(request.workspaceId), async () => {
          const viewer = outputViewer(request.workspaceId);
          const paths = request.fileIds.map(id => viewer.resolve(id, "file").grant.relative.split(path.sep).join("/"));
          const manifest = await perform({ action: "artifacts.manifest", workspaceId: request.workspaceId, paths });
          const content = JSON.stringify(manifest, null, 2) + "\n";
          if (Buffer.byteLength(content) > 4 * 1024 * 1024) reject("MANIFEST_SIZE_LIMIT");
          const name = `manifest-${randomUUID()}.json`;
          fs.writeFileSync(path.join(project(request.workspaceId).output, name), content, {flag:"wx", mode:0o600});
          return {manifest, name, fileId:viewer.admit(name,"file")};
        });
      }
      case "outputs.compare": {
        if (typeof request.beforeId !== "string" || typeof request.afterId !== "string" || request.beforeId.length !== 36 || request.afterId.length !== 36) reject("INVALID_REQUEST");
        const viewer = outputViewer(request.workspaceId);
        return perform({ action:"artifacts.compare", workspaceId:request.workspaceId,
          beforePath:viewer.resolve(request.beforeId,"file").grant.relative,
          afterPath:viewer.resolve(request.afterId,"file").grant.relative });
      }
      case "artifacts.manifest": {
        const item = project(request.workspaceId);
        const hasConfiguration = fs.existsSync(path.join(item.output, ".config"));
        const before = await captureBuildIntent({ source: item.source, output: item.output, externalTrees: item.externalTrees });
        const manifest = await deployment(request.workspaceId).createManifest({
          paths: request.paths,
          locks: { sourceRevision: before.sourceRevision, ...(hasConfiguration ? { configurationSha256: before.configRevision } : {}) },
        });
        const after = await captureBuildIntent({ source: item.source, output: item.output, externalTrees: item.externalTrees });
        if (hasConfiguration !== fs.existsSync(path.join(item.output, ".config")) || before.sourceRevision !== after.sourceRevision || before.configRevision !== after.configRevision) reject("REPRODUCIBILITY_INPUTS_CHANGED");
        return { ...manifest, provenance: { ...provenance.bind(manifest, item, request.workspaceId), limitations: before.snapshot.limitations } };
      }
      case "artifacts.compare":
        return deployment(request.workspaceId).compareManifestFiles(request.beforePath, request.afterPath, manifest => provenance.bind(manifest, project(request.workspaceId), request.workspaceId, manifest.provenance?.buildTimeBinding ? manifest.provenance : null));
      case "artifacts.compliance":
        return deployment(request.workspaceId).collectCompliance();
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
        exact(request.request, ["fileId", "format", "outputName"]);
        if (typeof request.request.fileId !== "string" || request.request.fileId.length !== 36) reject("INVALID_REQUEST");
        return deployment(request.workspaceId).previewConversion({
          artifact: outputViewer(request.workspaceId).resolve(request.request.fileId, "file").grant.relative,
          format: request.request.format,
          outputName: request.request.outputName,
        });
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
            "ollama.conversations.list",
            "ollama.conversations.save",
            "ollama.conversations.load",
            "ollama.conversations.delete",
            "ollama.chat.start",
            "ollama.chat.read",
            "ollama.chat.cancel",
            "ollama.chat.forget",
            "converter.catalog",
            "minecraft.remote.list",
            "minecraft.remote.preview",
            "minecraft.remote.execute",
            "minecraft.remote.cancel",
            "minecraft.remote.status",
            "minecraft.world.list",
            "minecraft.world.preview",
            "minecraft.world.execute",
            "minecraft.records.list",
            "minecraft.records.save",
            "minecraft.records.import",
            "minecraft.records.export",
            "minecraft.players.read",
            "minecraft.players.write",
            "minecraft.command",
            "minecraft.schedule.add",
            "minecraft.schedule.cancel",
            "minecraft.schedule.list",
            "minecraft.managed.reconnect",
            "minecraft.fabric.options",
            "minecraft.fabric.install",
            "minecraft.paper.builds",
            "minecraft.paper.install",
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
            "minecraft.managed.start",
            "minecraft.managed.stop",
            "minecraft.managed.status",
            "minecraft.configuration.read",
            "minecraft.configuration.save",
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
      executionSetup.dispose();
      executionJobs?.dispose();
      for (const cloud of cloudDestinations.values()) cloud.dispose();
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




















