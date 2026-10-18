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
const ISO_SYMBOLS = Object.freeze(["BR2_TARGET_GRUB2", "BR2_TARGET_GRUB2_I386_PC", "BR2_TARGET_ROOTFS_ISO9660", "BR2_TARGET_ROOTFS_ISO9660_GRUB2", "BR2_TARGET_ROOTFS_ISO9660_INITRD"]);
const ISO_STRINGS = Object.freeze({ BR2_TARGET_ROOTFS_ISO9660_BOOT_MENU: "fs/iso9660/grub.cfg", BR2_TARGET_GRUB2_BUILTIN_CONFIG_PC: "", BR2_TARGET_GRUB2_BOOT_PARTITION: "cd", BR2_TARGET_GRUB2_BUILTIN_MODULES_PC: "boot linux iso9660 normal biosdisk" });
function fail(code) { throw Object.assign(new Error(code), { code }); }
function createImagePresets({ configuration }) {
  const approvedIso = new Map();
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
  function isoEffective(snapshot, changes) {
    const map = snapshot.semantics?.available ? symbols(snapshot) : new Map();
    return Object.entries(changes).every(([symbol, change]) => {
      const value = snapshot.values[symbol] ?? map.get(symbol)?.value;
      return value === change.value || (change.type === "bool" && value === (change.value ? "y" : "n"));
    });
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
  async function isoPlan(input) {
    const snapshot = await configuration.inspect({ workspaceId: input.workspaceId, domain: "buildroot" });
    if (snapshot.revision !== input.revision) fail("REVISION_CONFLICT");
    const map = symbols(snapshot);
    const enabled = symbol => map.get(symbol)?.value === true || map.get(symbol)?.value === "y";
    // These dependencies must already be configured. Related ISO choices are
    // reconciled together, so their current visibility is not a prerequisite.
    const requirements = ["BR2_x86_64", "BR2_LINUX_KERNEL", ...ISO_SYMBOLS, ...Object.keys(ISO_STRINGS)].map(symbol => {
      const present = map.has(symbol), prerequisite = ["BR2_x86_64", "BR2_LINUX_KERNEL"].includes(symbol);
      const selectable = present && map.get(symbol).type === (Object.hasOwn(ISO_STRINGS, symbol) ? "string" : "bool") && (!prerequisite || enabled(symbol));
      return { symbol, present, selectable, reason: !present ? "NOT_IN_SELECTED_SOURCE" : selectable ? null : prerequisite ? "ENABLE_X86_64_KERNEL_FIRST" : "UNSUPPORTED_SYMBOL_TYPE" };
    });
    const changes = Object.fromEntries(ISO_SYMBOLS.map(symbol => [symbol, { type: "bool", value: true }]));
    for (const [symbol, value] of Object.entries(ISO_STRINGS)) changes[symbol] = { type: "string", value };
    for (const symbol of ["BR2_TARGET_SYSLINUX", "BR2_TARGET_ROOTFS_ISO9660_ISOLINUX", "BR2_TARGET_GRUB2_I386_EFI", "BR2_TARGET_GRUB2_X86_64_EFI"]) if (map.has(symbol)) changes[symbol] = { type: "bool", value: false };
    return { revision: snapshot.revision, profile: "x86_64-bios-grub2-initrd", firmware: "bios", bootVerified: false,
      requirements, changes,
      applicable: requirements.every(row => row.selectable), previewKind: "configuration-plan", requiresBuild: true,
      defaults: { architecture: "x86_64", firmware: "bios", bootloader: "grub2", rootFilesystem: "initrd", output: "images/rootfs.iso9660" }, constraints: { requiresExistingKernel: true, requiresFullBuild: true, uefiConfigured: false, hybridConfigured: false }, output: "images/rootfs.iso9660", warning: "Configures a BIOS-only initrd ISO. Run a full build and inspect its output. Configuration and an El Torito catalog do not prove that the image boots. UEFI support is not configured." };
  }
  async function isoApply(input) {
    approvedIso.delete(input.workspaceId);
    const preview = await isoPlan(input);
    if (!preview.applicable) fail("PRESET_REQUIREMENTS_UNAVAILABLE");
    const result = await configuration.apply({ workspaceId: input.workspaceId, domain: "buildroot", revision: input.revision, changes: preview.changes });
    const effective = isoEffective(result, preview.changes);
    if (effective) approvedIso.set(input.workspaceId, { revision: result.revision, profile: preview.profile });
    return { ...result, profile: preview.profile, firmware: preview.firmware, bootVerified: false, requiresBuild: true, effective, output: preview.output };
  }
  async function assertIsoBuild(input) {
    const approved = approvedIso.get(input.workspaceId);
    if (!approved || approved.revision !== input.revision || approved.profile !== input.profile) fail("ISO_APPLY_REQUIRED");
    const preview = await isoPlan(input);
    if (!preview.applicable) fail("PRESET_REQUIREMENTS_UNAVAILABLE");
    const snapshot = await configuration.inspect({ workspaceId: input.workspaceId, domain: "buildroot" });
    if (snapshot.revision !== input.revision) fail("REVISION_CONFLICT");
    if (!isoEffective(snapshot, preview.changes)) fail("ISO_PROFILE_NOT_EFFECTIVE");
    return approved;
  }
  async function isoBuild(input, submit) {
    await assertIsoBuild(input);
    return submit();
  }
  return { catalog, plan, apply, isoPlan, isoApply, assertIsoBuild, isoBuild };
}
module.exports = { createImagePresets };
