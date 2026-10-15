"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { ExecutionService, TARGETS } = require("./execution/index.cjs");
const { createJobManager } = require("./jobs/manager.cjs");
const { createConfigurationService } = require("./configuration/index.cjs");
const { createDeploymentService } = require("./deployment/index.cjs");
const { createToolsService } = require("./tools/index.cjs");
const { createUpdateService } = require("./updates/service.cjs");
const { createFileGrants } = require("./security/file-grants.cjs");
const { createProjectStore } = require("./storage/project-store.cjs");
const { createKconfigAdapter } = require("./configuration/kconfig-adapter.cjs");
const { boundedProcess } = require("./execution/index.cjs");
const contract = require("./security/workspace-contract.cjs");

const owner = "desktop-owner";
const fields = {
  "runtime.discover": [],
  "runtime.python.choose": [],
  "project.list": [],
  "project.choose": [],
  "project.adopt": ["selectionId", "trust"],
  "project.runtime": ["workspaceId", "runtime"],
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
  "guest.discover": ["workspaceId"],
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
}) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const selections = new Map(),
    projects = new Map(),
    fileGrants = createFileGrants(),
    running = new Set();
  const projectStore = createProjectStore({
    filePath: path.join(directory, "projects.json"),
  });
  let kconfigAdapter;
  let choosing = false,
    disposed = false,
    configurationBusy = false;
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
  const tools = createToolsService({
    queueDirectory: path.join(directory, "tool-queue"),
  });
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
    if (configurationBusy || activeBuild()) reject("PROJECT_BUSY");
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
        selections.delete(request.selectionId);
        for (const id of selected.capabilities)
          fileGrants.revoke({ id, owner });
        return { workspaceId, name: selected.name };
      }
      case "project.runtime":
        project(request.workspaceId).runtime = runtime(request.runtime);
        return { configured: true };
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
        if (configurationBusy || activeBuild()) reject("BUILD_BUSY");
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
        if (configurationBusy || activeBuild()) reject("BUILD_BUSY");
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
          ].includes(request.request?.action)
        )
          reject("ACTION_NOT_ADMITTED");
        const result = await tools.execute(request.request);
        if (result?.ok === false) reject(result.code || "TOOL_UNAVAILABLE");
        return result;
      }
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
        const code =
          typeof error.code === "string" &&
          /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
            ? error.code
            : "OPERATION_FAILED";
        return { ok: false, code };
      }
    },
    dispose() {
      disposed = true;
      fileGrants.clear();
      updates.cancel();
      for (const job of running) void job.cancel().catch(() => {});
    },
  };
}
module.exports = { createOperationsService };
