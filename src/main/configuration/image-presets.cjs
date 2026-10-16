"use strict";

// Presets are additive requests against the selected source's live Kconfig tree.
// They never claim that a compositor has been rendered or that an image booted.
const PRESETS = Object.freeze([
  { id: "minimal", symbols: ["BR2_PACKAGE_BUSYBOX"] },
  { id: "desktop", symbols: ["BR2_PACKAGE_BUSYBOX"] },
  { id: "server", symbols: ["BR2_PACKAGE_BUSYBOX", "BR2_PACKAGE_DROPBEAR"] },
  { id: "appliance", symbols: ["BR2_PACKAGE_BUSYBOX", "BR2_TARGET_ROOTFS_SQUASHFS"] },
]);
const DESKTOPS = Object.freeze([
  { id: "weston", symbol: "BR2_PACKAGE_WESTON", label: "Weston (Wayland)" },
  { id: "cage", symbol: "BR2_PACKAGE_CAGE", label: "Cage kiosk (Wayland)" },
  { id: "xorg", symbol: "BR2_PACKAGE_XSERVER_XORG_SERVER", label: "X.Org server (no desktop shell)" },
]);
function fail(code) { throw Object.assign(new Error(code), { code }); }
function createImagePresets({ configuration }) {
  function symbols(snapshot) {
    if (!snapshot.semantics?.available || !snapshot.semantics.tree) fail("KCONFIG_SEMANTICS_UNAVAILABLE");
    const map = new Map();
    const walk = node => { if (node.symbol) map.set(node.symbol, node); for (const child of node.children || []) walk(child); };
    walk(snapshot.semantics.tree);
    return map;
  }
  function capability(map, symbol) {
    const spec = map.get(symbol);
    return { symbol, present: !!spec, selectable: !!spec && spec.type === "bool" && (spec.value === true || spec.value === "y" || spec.assignable?.includes(2)), reason: !spec ? "NOT_IN_SELECTED_SOURCE" : spec.type !== "bool" ? "UNSUPPORTED_SYMBOL_TYPE" : spec.value === true || spec.value === "y" || spec.assignable?.includes(2) ? null : "DEPENDENCIES_NOT_SATISFIED" };
  }
  async function catalog({ workspaceId }) {
    const snapshot = await configuration.inspect({ workspaceId, domain: "buildroot" });
    const map = symbols(snapshot);
    return { revision: snapshot.revision, presets: PRESETS.map(preset => ({ id: preset.id, requirements: preset.symbols.map(symbol => capability(map, symbol)) })), desktops: DESKTOPS.map(desktop => ({ ...desktop, ...capability(map, desktop.symbol) })), provisioning: { accountWorkflow: "separate-source-bound-plan", passwordEnrollmentAvailable: false }, previewKind: "configuration-plan" };
  }
  async function plan(input) {
    const preset = PRESETS.find(p => p.id === input.preset);
    if (!preset || !["none", ...DESKTOPS.map(d => d.id)].includes(input.desktop) || typeof input.ssh !== "boolean") fail("INVALID_IMAGE_PRESET");
    if (preset.id !== "desktop" && input.desktop !== "none") fail("DESKTOP_PRESET_REQUIRED");
    if (preset.id === "desktop" && input.desktop === "none") fail("SELECT_DESKTOP");
    const snapshot = await configuration.inspect({ workspaceId: input.workspaceId, domain: "buildroot" });
    if (snapshot.revision !== input.revision) fail("REVISION_CONFLICT");
    const map = symbols(snapshot), selected = [...preset.symbols];
    if (input.desktop !== "none") selected.push(DESKTOPS.find(d => d.id === input.desktop).symbol);
    if (input.ssh) selected.push("BR2_PACKAGE_DROPBEAR");
    const requirements = [...new Set(selected)].map(symbol => capability(map, symbol));
    const changes = Object.fromEntries(requirements.map(row => [row.symbol, { type: "bool", value: true }]));
    return { revision: snapshot.revision, preset: preset.id, desktop: input.desktop, requirements, changes, applicable: requirements.every(r => r.selectable), previewKind: "configuration-plan", additive: true, accountProvisioning: "separate-source-bound-plan", sshSelected: selected.includes("BR2_PACKAGE_DROPBEAR") };
  }
  async function apply(input) {
    const preview = await plan(input);
    if (!preview.applicable) fail("PRESET_REQUIREMENTS_UNAVAILABLE");
    const result = await configuration.apply({ workspaceId: input.workspaceId, domain: "buildroot", revision: input.revision, changes: preview.changes });
    return { ...result, preset: preview.preset, previewKind: "configuration-plan", requestedSymbols: Object.keys(preview.changes), accountProvisioning: "separate-source-bound-plan" };
  }
  return { catalog, plan, apply };
}
module.exports = { createImagePresets };
