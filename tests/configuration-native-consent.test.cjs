"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { createConfigurationConsent } = require("../src/main/configuration/runtime-consent.cjs");
test("configuration consent admits bound native links and invalidates changed source or cache intent", async () => {
  const project = { source: "/fixture/source", output: "/fixture/output", grantId: "grant", runtime: { kind: "wsl", distribution: "fixture" }, externalStateVerified: true, externalTrees: [], identities: {} };
  let revision = "a", policy = "internal-content-and-missing-targets", limitations = [];
  const consent = createConfigurationConsent({ resolveProject: () => project, discoverDomains: async () => ({}), captureIntent: async (_project, roots) => {
    assert.equal(roots.sourceRoot, project.source);
    return { sourceRevision: revision.repeat(64), configRevision: "b".repeat(64), snapshot: { version: 3, symlinks: 2, symlinkPolicy: policy, limitations, entries: 10, bytes: 100 } };
  } });
  const preview = await consent.preview({ workspaceId: "w" }); assert.equal(preview.contentEvidence.symlinks, 2);
  await consent.grant({ workspaceId: "w", challengeId: preview.id, trusted: true }); assert.equal((await consent.requireTrust("w")).sourceTrusted, true);
  revision = "c"; await assert.rejects(consent.requireTrust("w"), { code: "KCONFIG_SOURCE_TRUST_CHANGED" });
  policy = "link-text-only"; await assert.rejects(consent.preview({ workspaceId: "w" }), { code: "KCONFIG_UNBOUND_SYMLINK_SOURCE" });
  policy = "internal-content-and-missing-targets"; limitations = ["unbound"];
  await assert.rejects(consent.preview({ workspaceId: "w" }), { code: "KCONFIG_UNBOUND_SYMLINK_SOURCE" });
});
