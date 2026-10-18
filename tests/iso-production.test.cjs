"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { inspectIso } = require("../src/main/deployment/iso-inspection.cjs");
const { createImagePresets } = require("../src/main/configuration/image-presets.cjs");
function image() {
  const data = Buffer.alloc(25 * 2048);
  const descriptor = (sector, type) => { const b = data.subarray(sector * 2048, (sector + 1) * 2048); b[0] = type; b.write("CD001", 1); b[6] = 1; return b; };
  const p = descriptor(16, 1); p.writeUInt32LE(25, 80); p.writeUInt32BE(25, 84); p.writeUInt16LE(2048, 128); p.writeUInt16BE(2048, 130);
  const b = descriptor(17, 0); b.write("EL TORITO SPECIFICATION", 7); b.writeUInt32LE(20, 71); descriptor(18, 255);
  const c = data.subarray(20 * 2048); c[0] = 1; c[30] = 0x55; c[31] = 0xaa; c.writeUInt16LE((-0xaa56) & 0xffff, 28); c[32] = 0x88; c.writeUInt32LE(21, 40);
  return data;
}
test("ISO inspection rejects malformed descriptors and invalid boot catalogs without claiming boot", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "iso-inspect-")); t.after(() => fs.rmSync(root, { recursive: true })); const file = path.join(root, "test.iso");
  const data = image(); fs.writeFileSync(file, data); const valid = inspectIso(file, data.length);
  assert.equal(valid.descriptorValid, true); assert.equal(valid.elTorito.bootEntryValid, true); assert.equal(valid.bootVerified, false);
  data[20 * 2048 + 28] ^= 1; fs.writeFileSync(file, data); assert.equal(inspectIso(file, data.length).elTorito.bootEntryValid, false);
  data.writeUInt32LE(9999, 17 * 2048 + 71); fs.writeFileSync(file, data); assert.equal(inspectIso(file, data.length).elTorito.validationChecksumValid, false);
  data[16 * 2048 + 84] ^= 1; fs.writeFileSync(file, data); assert.equal(inspectIso(file, data.length).descriptorValid, false);
  assert.equal(inspectIso(file, 2048), null);
});
test("ISO plan is revision-bound, requires an x86 kernel and reports dropped Kconfig requests", async () => {
  const symbols = ["BR2_x86_64", "BR2_LINUX_KERNEL", "BR2_TARGET_SYSLINUX", "BR2_TARGET_SYSLINUX_ISOLINUX", "BR2_TARGET_ROOTFS_ISO9660", "BR2_TARGET_ROOTFS_ISO9660_ISOLINUX", "BR2_TARGET_ROOTFS_ISO9660_INITRD"];
  let revision = "one", kernel = true, applied;
  const service = createImagePresets({ configuration: {
    inspect: async () => ({ revision, semantics: { available: true, tree: { children: symbols.map(symbol => ({ symbol, type: "bool", value: symbol === "BR2_x86_64" || (symbol === "BR2_LINUX_KERNEL" && kernel) })) } } }),
    apply: async input => { applied = input; return { revision: "two", values: { BR2_TARGET_SYSLINUX: true } }; }
  } });
  assert.equal((await service.isoPlan({ workspaceId: "w", revision })).applicable, true);
  await assert.rejects(service.isoPlan({ workspaceId: "w", revision: "stale" }), { code: "REVISION_CONFLICT" });
  const result = await service.isoApply({ workspaceId: "w", revision }); assert.equal(result.effective, false); assert.equal(result.bootVerified, false); assert.equal(Object.keys(applied.changes).length, 5);
  kernel = false; assert.equal((await service.isoPlan({ workspaceId: "w", revision })).applicable, false); await assert.rejects(service.isoApply({ workspaceId: "w", revision }), { code: "PRESET_REQUIREMENTS_UNAVAILABLE" });
});
test("ISO export preserves exact bytes and rejects existing destinations, stale input and raw disks", async t => {
  const { ArtifactStore } = require("../src/main/deployment/artifacts.cjs");
  const { Virtualization } = require("../src/main/deployment/virtualization.cjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "iso-export-")); t.after(() => fs.rmSync(root, { recursive: true }));
  fs.writeFileSync(path.join(root, "rootfs.iso9660"), image()); fs.writeFileSync(path.join(root, "disk.raw"), Buffer.alloc(1024));
  const virtual = new Virtualization({ store: new ArtifactStore(root), managedDirectory: path.join(root, "managed"), executor: async () => { throw Error("No converter should run for an ISO copy"); } });
  const plan = await virtual.previewConversion({ artifact: "rootfs.iso9660", format: "iso", outputName: "export.iso" });
  const result = await virtual.executeConversion({ id: plan.id }); assert.equal(result.sha256, plan.sha256); assert.equal(result.bootVerified, false); assert.equal(result.contentVerified, true);
  assert.deepEqual(fs.readFileSync(path.join(root, "export.iso")), image());
  await assert.rejects(virtual.previewConversion({ artifact: "rootfs.iso9660", format: "iso", outputName: "export.iso" }), /conversion-output-exists/);
  await assert.rejects(virtual.previewConversion({ artifact: "disk.raw", format: "iso", outputName: "raw.iso" }), /conversion-iso-requires-existing-iso/);
  const stale = await virtual.previewConversion({ artifact: "rootfs.iso9660", format: "iso", outputName: "stale.iso" }); fs.appendFileSync(path.join(root, "rootfs.iso9660"), "changed");
  await assert.rejects(virtual.executeConversion({ id: stale.id }), /conversion-preview-stale/); assert.equal(fs.existsSync(path.join(root, "stale.iso")), false);
});
