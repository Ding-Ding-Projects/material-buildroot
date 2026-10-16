"use strict";
const { createHash, randomUUID } = require("node:crypto");
const { captureBuildIntent } = require("../jobs/build-intent.cjs");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const DOMAINS = new Set(["buildroot", "linux", "busybox", "uboot"]);
/** Session-only consent binds source bytes, configuration, native roots and runtime. */
function createConfigurationConsent({ resolveProject, discoverDomains, now = Date.now }) {
  const challenges = new Map(), grants = new Map();
  function prune() {
    for (const [id, item] of challenges) if (item.expires <= now()) challenges.delete(id);
    for (const [id, item] of grants) if (item.expires <= now()) grants.delete(id);
  }
  async function snapshot(workspaceId, domain, roots) {
    const project = resolveProject(workspaceId);
    if (!project.runtime || !project.externalStateVerified) fail("KCONFIG_RUNTIME_UNAVAILABLE");
    const parent = await captureBuildIntent({ source: project.source, output: project.output, externalTrees: project.externalTrees });
    if (!roots) roots = { sourceRoot: project.source, outputRoot: project.output };
    const component = domain === "buildroot" ? parent : await captureBuildIntent({ source: roots.sourceRoot, output: roots.outputRoot, externalTrees: project.externalTrees });
    if (parent.snapshot.symlinks || component.snapshot.symlinks) fail("KCONFIG_UNBOUND_SYMLINK_SOURCE");
    resolveProject(workspaceId);
    const value = {
      workspaceId, domain, grantId: project.grantId, runtime: project.runtime,
      identities: project.identities, sourceRoot: roots.sourceRoot, outputRoot: roots.outputRoot,
      externalTrees: project.externalTrees,
      sourceRevision: digest({ parent: parent.sourceRevision, component: component.sourceRevision, roots: [roots.sourceRoot, roots.outputRoot] }),
      configRevision: digest({ parent: parent.configRevision, component: component.configRevision }),
    };
    return { ...structuredClone(value), revision: digest(value) };
  }
  async function requireTrust(workspaceId, domain = "buildroot", roots) {
    prune();
    const grant = grants.get(`${workspaceId}:${domain}`);
    if (!grant) fail("KCONFIG_SOURCE_TRUST_REQUIRED");
    const current = await snapshot(workspaceId, domain, roots || grant.snapshot);
    if (current.revision !== grant.snapshot.revision) {
      grants.delete(`${workspaceId}:${domain}`);
      fail("KCONFIG_SOURCE_TRUST_CHANGED");
    }
    return { ...current, admissionId: grant.id, sourceTrusted: true };
  }
  return {
    requireTrust,
    async preview({ workspaceId, domain = "buildroot" }) {
      prune();
      if (!DOMAINS.has(domain)) fail("INVALID_CONFIGURATION_DOMAIN");
      let actualDomain = domain, roots;
      if (domain !== "buildroot") {
        try { await requireTrust(workspaceId); }
        catch (error) {
          if (!["KCONFIG_SOURCE_TRUST_REQUIRED", "KCONFIG_SOURCE_TRUST_CHANGED"].includes(error.code)) throw error;
          actualDomain = "buildroot";
        }
        if (actualDomain === domain) {
          roots = (await discoverDomains(workspaceId, resolveProject(workspaceId)))[domain];
          if (!roots) fail("DOMAIN_NOT_PREPARED");
        }
      }
      const current = await snapshot(workspaceId, actualDomain, roots);
      if (challenges.size >= 64) fail("KCONFIG_CONSENT_LIMIT");
      const id = randomUUID(), expires = now() + 5 * 60 * 1000;
      challenges.set(id, { snapshot: current, expires });
      return { id, expires, domain: actualDomain, requestedDomain: domain, sourceRoot: current.sourceRoot,
        outputRoot: current.outputRoot, sourceRevision: current.sourceRevision, configRevision: current.configRevision,
        runtime: current.runtime, externalRoots: current.externalTrees, discoveryOnly: actualDomain !== domain };
    },
    async grant({ workspaceId, challengeId, trusted }, authority = null) {
      if (authority !== null && typeof authority !== "function") fail("KCONFIG_AUTHORITY_INVALID");
      authority?.();
      prune();
      const challenge = challenges.get(challengeId);
      challenges.delete(challengeId);
      if (!challenge || trusted !== true || challenge.snapshot.workspaceId !== workspaceId) fail("KCONFIG_SOURCE_TRUST_REQUIRED");
      const previous = challenge.snapshot;
      const current = await snapshot(workspaceId, previous.domain, previous);
      authority?.();
      if (current.revision !== previous.revision) fail("KCONFIG_SOURCE_TRUST_CHANGED");
      if (grants.size >= 64 && !grants.has(`${workspaceId}:${previous.domain}`)) fail("KCONFIG_CONSENT_LIMIT");
      authority?.();
      grants.set(`${workspaceId}:${previous.domain}`, { id: randomUUID(), snapshot: current, expires: now() + 15 * 60 * 1000 });
      return { domain: previous.domain, trusted: true };
    },
    revoke({ workspaceId }) {
      for (const [key, value] of grants) if (value.snapshot.workspaceId === workspaceId) grants.delete(key);
      for (const [key, value] of challenges) if (value.snapshot.workspaceId === workspaceId) challenges.delete(key);
      return { revoked: true };
    },
  };
}
module.exports = { createConfigurationConsent };

