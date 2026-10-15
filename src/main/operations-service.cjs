"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { ExecutionService, TARGETS } = require("./execution/index.cjs");
const { createJobManager } = require("./jobs/manager.cjs");
const { createConfigurationService } = require("./configuration/index.cjs");
const { createDeploymentService } = require("./deployment/index.cjs");
const { createToolsService } = require("./tools/index.cjs");
const { createPayloadManager } = require("./tools/payload-manager.cjs");
const { createToolFiles } = require("./security/tool-files.cjs");
const {
  createCompanionController,
} = require("./security/companion-controller.cjs");
const { createUpdateService } = require("./updates/service.cjs");
const { createFileGrants } = require("./security/file-grants.cjs");
const { createProjectStore } = require("./storage/project-store.cjs");
const {
  createCanvasLayoutStore,
} = require("./storage/canvas-layout-store.cjs");
const { createKconfigAdapter } = require("./configuration/kconfig-adapter.cjs");
const { boundedProcess } = require("./execution/index.cjs");
const { createSourceOperations } = require("./source-operations.cjs");
const {
  createPackageAuthoringService,
} = require("./configuration/package-authoring.cjs");
const contract = require("./security/workspace-contract.cjs");

const owner = "desktop-owner";
const fields = {
  "runtime.discover": [],
  "runtime.python.choose": [],
  "project.list": [],
  "project.choose": [],
  "project.adopt": ["selectionId", "trust"],
  "project.runtime": ["workspaceId", "runtime"],
  "canvas.read": ["workspaceId", "canvasId"],
  "canvas.write": ["workspaceId", "canvasId", "expectedRevision", "layout"],
  "build.submit": ["workspaceId", "target", "runtime", "jobs"],
  "jobs.list": [],
  "jobs.page": ["id", "after", "limit"],
  "jobs.cancel": ["id", "sequence"],
  "jobs.retry": ["id", "sequence"],
  "config.inspect": ["workspaceId"],
  "config.defconfigs": ["workspaceId"],
  "config.apply": ["workspaceId", "revision", "changes"],
  "config.undo": ["workspaceId", "revision"],
  "config.defconfig": ["workspaceId", "revision", "path"],
  "artifacts.list": ["workspaceId"],
  "artifacts.inspect": ["workspaceId", "path"],
  "artifacts.manifest": ["workspaceId", "paths"],
  tools: ["request"],
  "payload.list": [],
  "payload.choose": ["toolId"],
  "file.choose": ["access", "kind"],
  companion: ["request"],
  source: ["request"],
  "external.choose": ["workspaceId"],
  "package.preview": ["workspaceId", "externalTreeId", "model"],
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
};
function reject(code) {
  throw Object.assign(new Error(code), { code });
}
function exact(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
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
  execution = new ExecutionService(),
  workspaceRead,
}) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const selections = new Map(),
    projects = new Map(),
    fileGrants = createFileGrants(),
    running = new Set();
  const projectStore = createProjectStore({
    filePath: path.join(directory, "projects.json"),
  });
  const canvasLayouts = createCanvasLayoutStore({
    directory: path.join(directory, "canvas-layouts"),
  });
  let kconfigAdapter;
  let choosing = false,
    disposed = false,
    configurationBusy = false;
  let disposal;
  const sourceLocks = new Set();
  const activeBuild = () =>
    jobs
      .list()
      .some((job) => ["queued", "running", "cancelling"].includes(job.state));
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
  function registerProject(selected) {
    const granted = execution.grantProject({
      ...selected,
      trustedSource: true,
    });
    const workspaceId = projectStore.adopt({
      name: selected.name,
      root: selected.root,
      source: selected.source,
      output: selected.output,
    });
    const identities = Object.fromEntries(
      ["root", "source", "output"].map((key) => {
        const stat = fs.statSync(selected[key]);
        return [key, `${stat.dev}:${stat.ino}`];
      }),
    );
    projects.set(workspaceId, {
      ...selected,
      identities,
      grantId: granted.grantId,
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
    acquireSourceLock: (sourceRoot) => {
      if (
        disposed ||
        configurationBusy ||
        activeBuild() ||
        sourceLocks.has(sourceRoot)
      )
        reject("SOURCE_BUSY");
      sourceLocks.add(sourceRoot);
      return () => sourceLocks.delete(sourceRoot);
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
  async function executeProject(input, log, signal) {
    const item = project(input.workspaceId);
    const job = await execution.start(
      {
        grantId: item.grantId,
        target: input.target,
        runtime: runtime(input.runtime),
        jobs: input.jobs,
      },
      log,
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
        const result = await executeProject(
          payload,
          (event) => {
            for (let offset = 0; offset < event.text.length; offset += 4000)
              context.log({
                stream: event.stream,
                text: event.text.slice(offset, offset + 4000),
              });
          },
          context.signal,
        );
        context.item({ state: result.state, code: result.code });
        if (result.state !== "succeeded")
          reject("BUILD_" + result.state.toUpperCase().replaceAll("-", "_"));
        return { state: result.state, code: result.code };
      },
    },
  });
  const config = createConfigurationService({
    semanticAdapter: async (roots) => {
      if (!kconfigAdapter) reject("PYTHON_NOT_ADMITTED");
      return kconfigAdapter(roots);
    },
    resolveWorkspace: (id) => {
      const item = project(id);
      return {
        granted: true,
        sourceRoot: item.source,
        outputRoot: item.output,
      };
    },
    executor: async (input) => {
      const item = project(input.workspaceId);
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
  const packageAuthoring = createPackageAuthoringService({
    resolveExternalTree: (workspaceId, externalTreeId) => {
      project(workspaceId);
      if (externalWorkspaces.get(externalTreeId) !== workspaceId)
        reject("EXTERNAL_TREE_NOT_GRANTED");
      return {
        granted: true,
        root: externalFiles.resolve(externalTreeId, "write"),
      };
    },
    withLock: async (_root, work) => changeConfig(work),
  });
  const tools = createToolsService({
    queueDirectory: path.join(directory, "tool-queue"),
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
  const updates = createUpdateService({
    userData: directory,
    currentVersion: version,
    currentSource: source,
  });
  const deployments = new Map();
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
  function start(job) {
    void jobs.run(job.id, owner, job.sequence).catch(() => {
      /* Durable job state remains available for recovery. */
    });
    return jobs.get(job.id);
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
  async function changeConfig(work) {
    if (configurationBusy || activeBuild() || sourceLocks.size)
      reject("PROJECT_BUSY");
    configurationBusy = true;
    try {
      return await work();
    } finally {
      configurationBusy = false;
    }
  }
  async function perform(request) {
    const action = request?.action;
    if (typeof action !== "string" || !Object.hasOwn(fields, action))
      reject("INVALID_ACTION");
    exact(request, ["action", ...fields[action]]);
    if (disposed) reject("UNAVAILABLE");
    switch (action) {
      case "runtime.discover":
        return execution.discover();
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
      case "project.choose":
        return choose();
      case "project.adopt": {
        const selected = selections.get(request.selectionId);
        if (!selected || request.trust !== true)
          reject("SOURCE_CONSENT_REQUIRED");
        for (const id of selected.capabilities)
          fileGrants.resolve({ id, owner });
        const registered = registerProject(selected);
        selections.delete(request.selectionId);
        for (const id of selected.capabilities)
          fileGrants.revoke({ id, owner });
        return registered;
      }
      case "project.runtime":
        project(request.workspaceId).runtime = runtime(request.runtime);
        return { configured: true };
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
      case "build.submit": {
        const item = project(request.workspaceId);
        if (
          !TARGETS.includes(request.target) ||
          !Number.isSafeInteger(request.jobs) ||
          request.jobs < 1 ||
          request.jobs > 32
        )
          reject("INVALID_TARGET");
        item.runtime = runtime(request.runtime);
        if (configurationBusy || activeBuild() || sourceLocks.size)
          reject("BUILD_BUSY");
        return start(
          jobs.enqueue({
            kind: "build",
            ownerId: owner,
            payload: {
              workspaceId: request.workspaceId,
              target: request.target,
              runtime: item.runtime,
              jobs: request.jobs,
            },
          }),
        );
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
        return jobs.cancel(request.id, owner, request.sequence);
      case "jobs.retry": {
        const previous = ownJob(request.id);
        project(previous.payload.workspaceId);
        if (configurationBusy || activeBuild() || sourceLocks.size)
          reject("BUILD_BUSY");
        return start(jobs.retry(request.id, owner, request.sequence));
      }
      case "config.inspect":
        return config.inspect(request);
      case "config.defconfigs":
        return config.listDefconfigs(request);
      case "config.apply":
        return changeConfig(() => config.apply(request));
      case "config.undo":
        return changeConfig(() => config.undo(request));
      case "config.defconfig":
        return changeConfig(() => config.applyDefconfig(request));
      case "artifacts.list":
        return deployment(request.workspaceId).listArtifacts();
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
        return deployment(request.workspaceId).createDiskArtifact(
          request.request,
        );
      case "guest.list":
        return deployment(request.workspaceId).listGuests();
      case "guest.create":
        return deployment(request.workspaceId).createGuest(request.request);
      case "guest.import":
        return deployment(request.workspaceId).importGuest(request.request);
      case "guest.edit":
        return deployment(request.workspaceId).editGuest(request.request);
      case "guest.launch":
        return deployment(request.workspaceId).launchGuest(request.request);
      case "guest.stop":
        return deployment(request.workspaceId).stopGuest(request.request);
      case "guest.refresh":
        return deployment(request.workspaceId).refreshGuest(request.request);
      case "conversion.preview":
        return deployment(request.workspaceId).previewConversion(
          request.request,
        );
      case "conversion.execute":
        return deployment(request.workspaceId).executeConversion(
          request.request,
        );
      case "tools": {
        if (
          ![
            "ollama.status",
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
        project(request.workspaceId);
        externalWorkspaces.set(choice.id, request.workspaceId);
        return { externalTreeId: choice.id, name: choice.name };
      }
      case "package.preview":
        return packageAuthoring.preview(request);
      case "package.apply":
        return packageAuthoring.apply(request);
      case "source": {
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
      }
    },
    dispose() {
      if (disposal) return disposal;
      disposed = true;
      fileGrants.clear();
      updates.cancel();
      toolFiles.dispose();
      externalFiles.dispose();
      externalWorkspaces.clear();
      sources.dispose();
      disposal = Promise.allSettled([
        tools.dispose?.(),
        companion?.request("companion.stop", {}),
        ...[...running].map((job) => job.cancel()),
      ]);
      return disposal;
    },
  };
}
module.exports = { createOperationsService };
