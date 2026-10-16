"use strict";
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { SourceService } = require("./execution/source.cjs");
const fields = {
  "source.choose": [],
  "source.clone": ["selectionId", "directory", "url", "ref", "trust"],
  "source.clone.official": ["selectionId", "directory", "ref", "trust"],
  "source.status": ["workspaceId"],
  "source.snapshot": ["workspaceId", "expectedRevision", "consent"],
  "source.ref": ["workspaceId", "ref"],
  "source.upgrade.preview": ["workspaceId", "revision"],
  "source.upgrade.apply": [
    "workspaceId",
    "previewId",
    "expectedRevision",
    "consent",
  ],
  "source.rollback.preview": ["workspaceId", "rollbackId"],
  "source.rollback.apply": [
    "workspaceId",
    "previewId",
    "expectedRevision",
    "consent",
  ],
};
function fail(code) {
  throw Object.assign(Error(code), { code });
}
function exact(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail("INVALID_REQUEST");
}
const id = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const revision = (value) =>
  typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const errorCodes = {
  "invalid-source-grant": "INVALID_SOURCE_DIRECTORY",
  "ordinary-git-worktree-required": "SOURCE_REPOSITORY_REQUIRED",
  "unsafe-source-url": "UNSAFE_SOURCE_URL",
  "invalid-source-ref": "INVALID_SOURCE_REF",
  "destination-not-empty": "DESTINATION_NOT_EMPTY",
  "source-path-alias": "SOURCE_PATH_CHANGED",
  "source-grant-changed": "SOURCE_PATH_CHANGED",
  "source-project-unavailable": "SOURCE_PATH_CHANGED",
  "source-busy": "SOURCE_BUSY",
  "source-lock-unavailable": "SOURCE_LOCK_UNAVAILABLE",
  "upgrade-source-changed-or-dirty": "SOURCE_CHANGED_OR_DIRTY",
  "git-unavailable": "GIT_UNAVAILABLE",
  "git-timed-out": "SOURCE_TIMEOUT",
  "git-output-limit": "SOURCE_OUTPUT_LIMIT",
  "git-failed": "SOURCE_GIT_FAILED",
  "snapshot-unavailable": "ROLLBACK_UNAVAILABLE",
  "upgrade-consent-or-preview-invalid": "PREVIEW_UNAVAILABLE",
};
/** Host callbacks carry all filesystem and workspace authority. Never pass renderer paths to them. */
function createSourceOperations({
  chooseDirectory,
  resolveWorkspace,
  onSourceAdopted,
  acquireSourceLock,
  sourceOptions = {},
  sourceService,
  sourceServiceForWorkspace,
} = {}) {
  const service =
    sourceService || new SourceService({ ...sourceOptions, acquireSourceLock });
  const selections = new Map(),
    projects = new Map(),
    previews = new Map(),
    rollbacks = new Map(),
    adopting = new Map();
  const ownedServices = new Set();
  let disposed = false;
  async function project(workspaceId) {
    if (!id(workspaceId)) fail("INVALID_REQUEST");
    if (typeof resolveWorkspace !== "function") fail("WORKSPACE_UNAVAILABLE");
    const workspace = await resolveWorkspace(workspaceId);
    if (
      !workspace ||
      typeof workspace.source !== "string" ||
      !path.isAbsolute(workspace.source)
    )
      fail("WORKSPACE_UNAVAILABLE");
    const cached = projects.get(workspaceId);
    if (cached) {
      if (cached.source !== workspace.source) fail("SOURCE_PATH_CHANGED");
      return cached;
    }
    if (adopting.has(workspaceId)) return adopting.get(workspaceId);
    const pending = (async () => {
      const selectedService = sourceServiceForWorkspace?.(workspace) || service;
      if (selectedService !== service) ownedServices.add(selectedService);
      const grant = selectedService.adoptWorkspace ? null : selectedService.grantRoot(path.dirname(workspace.source));
      const adopted = selectedService.adoptWorkspace ? await selectedService.adoptWorkspace(workspace) : await selectedService.adopt({
        grantId: grant.grantId,
        directory: path.basename(workspace.source),
        trustedSource: true,
      });
      // Existing workspace trust must have been admitted by the host's resolveWorkspace callback.
      const item = { projectId: adopted.projectId, source: adopted.source, service: selectedService };
      projects.set(workspaceId, item);
      return item;
    })();
    adopting.set(workspaceId, pending);
    try {
      return await pending;
    } finally {
      adopting.delete(workspaceId);
    }
  }
  async function handle(request) {
    try {
      if (disposed) fail("SOURCE_SERVICE_CLOSED");
      if (!request || !Object.hasOwn(fields, request.action))
        fail("INVALID_REQUEST");
      exact(request, ["action", ...fields[request.action]]);
      if (request.action === "source.choose") {
        if (typeof chooseDirectory !== "function")
          fail("SOURCE_PICKER_UNAVAILABLE");
        const root = await chooseDirectory();
        if (!root) return { ok: true, cancelled: true };
        const grant = service.grantRoot(root),
          selectionId = randomUUID();
        selections.set(selectionId, grant.grantId);
        return { ok: true, selectionId, name: path.basename(grant.root) };
      }
      if (request.action === "source.clone" || request.action === "source.clone.official") {
        const url = request.action === "source.clone.official" ? "https://gitlab.com/buildroot.org/buildroot.git" : request.url;
        if (request.trust !== true) fail("SOURCE_TRUST_REQUIRED");
        if (
          !id(request.selectionId) ||
          typeof request.directory !== "string" ||
          typeof url !== "string" ||
          typeof request.ref !== "string"
        )
          fail("INVALID_REQUEST");
        const grantId = selections.get(request.selectionId);
        if (!grantId) fail("SOURCE_SELECTION_UNAVAILABLE");
        if (typeof onSourceAdopted !== "function")
          fail("WORKSPACE_REGISTRATION_UNAVAILABLE");
        const cloned = await service.clone({
          grantId,
          directory: request.directory,
          url,
          ref: request.ref,
          trustedSource: true,
        });
        selections.delete(request.selectionId);
        // Registration failures retain the cloned tree; callers can adopt it explicitly afterwards.
        const registered = await onSourceAdopted({
          root: path.dirname(cloned.source),
          source: cloned.source,
          revision: cloned.revision,
          branch: cloned.branch,
        });
        if (!registered || !id(registered.workspaceId))
          fail("WORKSPACE_REGISTRATION_FAILED");
        projects.set(registered.workspaceId, {
          projectId: cloned.projectId,
          source: cloned.source,
        });
        return {
          ok: true,
          workspaceId: registered.workspaceId,
          revision: cloned.revision,
          branch: cloned.branch,
          dirty: cloned.dirty,
        };
      }
      const item = await project(request.workspaceId);
      const activeService = item.service || service;
      if (request.action === "source.status")
        return { ok: true, ...(await activeService.status(item.projectId)) };
      if (request.action === "source.snapshot") {
        if (request.consent !== true) fail("SOURCE_APPLY_CONSENT_REQUIRED");
        if (!revision(request.expectedRevision)) fail("INVALID_REVISION");
        return { ok: true, ...(await activeService.snapshot({projectId:item.projectId, expectedRevision:request.expectedRevision})) };
      }
      if (request.action === "source.ref") {
        if (typeof request.ref !== "string") fail("INVALID_REQUEST");
        if (
          typeof acquireSourceLock !== "function" &&
          !activeService.acquireSourceLock
        )
          fail("SOURCE_LOCK_UNAVAILABLE");
        return {
          ok: true,
          ...(await activeService.acquireRef({
            projectId: item.projectId,
            ref: request.ref,
          })),
        };
      }
      if (request.action.endsWith(".preview")) {
        let target = request.revision,
          kind = "upgrade";
        if (request.action === "source.rollback.preview") {
          const rollback = rollbacks.get(request.rollbackId);
          if (rollback && rollback.workspaceId === request.workspaceId) target = rollback.revision;
          else target = await activeService.snapshotRevision(item.projectId, request.rollbackId);
          kind = "rollback";
        }
        if (!revision(target)) fail("INVALID_REVISION");
        const preview = await activeService.previewUpgrade({
          projectId: item.projectId,
          revision: target,
        });
        previews.set(preview.previewId, {
          workspaceId: request.workspaceId,
          kind,
          fromRevision: preview.fromRevision,
        });
        return { ok: true, kind, ...preview };
      }
      if (request.consent !== true) fail("SOURCE_APPLY_CONSENT_REQUIRED");
      if (!revision(request.expectedRevision) || !id(request.previewId))
        fail("INVALID_REQUEST");
      const preview = previews.get(request.previewId),
        kind =
          request.action === "source.rollback.apply" ? "rollback" : "upgrade";
      if (
        !preview ||
        preview.workspaceId !== request.workspaceId ||
        preview.kind !== kind
      )
        fail("PREVIEW_UNAVAILABLE");
      if (preview.fromRevision !== request.expectedRevision)
        fail("REVISION_CONFLICT");
      const applied = await activeService.applyUpgrade({
        previewId: request.previewId,
        expectedRevision: request.expectedRevision,
        consent: true,
      });
      previews.delete(request.previewId);
      const rollbackId = applied.snapshot?.id || randomUUID();
      rollbacks.set(rollbackId, {
        workspaceId: request.workspaceId,
        revision: applied.rollbackRevision,
      });
      return { ok: true, ...applied, rollbackId };
    } catch (error) {
      const known = new Set([
        "INVALID_REQUEST",
        "SOURCE_SERVICE_CLOSED",
        "WORKSPACE_UNAVAILABLE",
        "SOURCE_PATH_CHANGED",
        "SOURCE_PICKER_UNAVAILABLE",
        "SOURCE_TRUST_REQUIRED",
        "SOURCE_SELECTION_UNAVAILABLE",
        "WORKSPACE_REGISTRATION_UNAVAILABLE",
        "WORKSPACE_REGISTRATION_FAILED",
        "SOURCE_LOCK_UNAVAILABLE",
        "ROLLBACK_UNAVAILABLE",
        "INVALID_REVISION",
        "SOURCE_APPLY_CONSENT_REQUIRED",
        "PREVIEW_UNAVAILABLE",
        "SOURCE_BUSY",
        "REVISION_CONFLICT",
        "ADOPTION_REQUIRED",
      ]);
      return {
        ok: false,
        code: known.has(error.code)
          ? error.code
          : errorCodes[error.message] || "SOURCE_UNAVAILABLE",
      };
    }
  }
  return {
    handle,
    dispose() {
      disposed = true;
      selections.clear();
      projects.clear();
      previews.clear();
      rollbacks.clear();
      for (const selectedService of ownedServices) selectedService.dispose();
      ownedServices.clear();
      if (!sourceService) service.dispose();
    },
  };
}
module.exports = { createSourceOperations };
