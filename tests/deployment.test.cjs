"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDeploymentService } = require("../src/main/deployment/index.cjs");
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "notes.txt"), "hello\n");
  return {
    root,
    service: createDeploymentService({
      root,
      managedDirectory: path.join(root, ".test-guests"),
      ...options,
    }),
  };
}
function disk(root) {
  const b = Buffer.alloc(4096);
  b.writeUInt16LE(0xaa55, 510);
  b[450] = 0x83;
  b.writeUInt32LE(1, 454);
  b.writeUInt32LE(7, 458);
  fs.writeFileSync(path.join(root, "disk.img"), b);
}
test("artifact paths, binary metadata, manifests and repeat-build differences", async (t) => {
  const { root, service: s } = fixture(t);
  disk(root);
  const a = await s.inspectArtifact("disk.img");
  assert.equal(a.format, "raw-disk");
  assert.equal(a.partitions[0].withinImage, true);
  assert.equal(a.sha256.length, 64);
  await assert.rejects(s.inspectArtifact("../outside"), /ENOENT|outside/);
  fs.symlinkSync("/etc/passwd", path.join(root, "escape"));
  await assert.rejects(s.inspectArtifact("escape"), /outside/);
  const first = await s.createManifest({
    paths: ["notes.txt"],
    locks: { sourceRevision: "abcdef123" },
  });
  assert.equal(s.compareManifests(first, first).reproducible, true);
  fs.appendFileSync(path.join(root, "notes.txt"), "changed");
  const second = await s.createManifest({ paths: ["notes.txt"] });
  assert.equal(
    s.compareManifests(first, second).differences[0].kind,
    "content-changed",
  );
  fs.mkdirSync(path.join(root, "legal-info"));
  fs.writeFileSync(
    path.join(root, "legal-info", "licenses.csv"),
    "package,license\nbusybox,GPL-2.0\n",
  );
  assert.equal((await s.collectCompliance()).spdx.files.length, 1);
});
test("VirtualBox lifecycle passes fixed argv and scopes identifiers to managed guests", async (t) => {
  const calls = [];
  let running = false;
  const { service: s } = fixture(t, {
    executor: async (file, args) => {
      calls.push({ file, args });
      if (args[0] === "startvm") running = true;
      if (args[0] === "controlvm") running = false;
      return {
        state: "succeeded",
        stdout:
          args[0] === "showvminfo"
            ? `VMState="${running ? "running" : "poweroff"}"`
            : "7.1.0",
      };
    },
  });
  const guest = await s.createGuest({
    provider: "virtualbox",
    hardware: { memoryMiB: 2048, firmware: "efi" },
  });
  assert.equal(calls[0].args[0], "createvm");
  assert.ok(calls[1].args.includes("nat"));
  await assert.rejects(s.launchGuest({ id: "unowned" }), /not-owned/);
  await s.launchGuest({ id: guest.id });
  assert.equal(
    (await s.stopGuest({ id: guest.id })).state,
    "shutdown-requested",
  );
  assert.deepEqual(calls.at(-1).args, [
    "controlvm",
    guest.id,
    "acpipowerbutton",
  ]);
  await s.refreshGuest({ id: guest.id });
  await s.editGuest({ id: guest.id, hardware: { cpus: 2 } });
  assert.ok(calls.at(-1).args.includes("2"));
});
test("conversion binds hash, rejects backing files and writes only absent output", async (t) => {
  let root;
  const calls = [];
  const f = fixture(t, {
    executor: async (file, args) => {
      calls.push(args);
      if (args[0] === "info")
        return { state: "succeeded", stdout: '{"format":"raw"}' };
      fs.writeFileSync(args.at(-1), "converted");
      return { state: "succeeded", stdout: "" };
    },
  });
  root = f.root;
  disk(root);
  const p = await f.service.previewConversion({
    artifact: "disk.img",
    format: "vdi",
    outputName: "result.vdi",
  });
  await f.service.executeConversion({ id: p.id });
  assert.equal(
    fs.readFileSync(path.join(root, "result.vdi"), "utf8"),
    "converted",
  );
  assert.deepEqual(calls[1].slice(0, 5), ["convert", "-f", "raw", "-O", "vdi"]);
  await assert.rejects(
    f.service.executeConversion({ id: p.id }),
    /preview-required/,
  );
});
test("cloud upload uses host-enrolled endpoints and verifies downloaded bytes", async (t) => {
  const calls = [];
  const { service: s } = fixture(t, {
    cloudDestinations: [
      {
        id: "bucket",
        provider: "azure",
        uploadUrl: "https://store.example/bucket/image?sig=secret",
        readUrl: "https://store.example/bucket/image?sig=secret",
        allowedHosts: ["store.example"],
      },
    ],
    http: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "PUT") {
        let text = "";
        for await (const chunk of options.body) text += chunk;
        assert.equal(text, "hello\n");
        return new Response(null, { status: 201 });
      }
      return new Response("hello\n");
    },
  });
  const p = await s.previewUpload({
    artifact: "notes.txt",
    destinationId: "bucket",
  });
  assert.equal(JSON.stringify(p).includes("secret"), false);
  assert.equal((await s.upload({ id: p.id })).state, "verified");
  assert.equal(calls[0].options.headers["x-ms-blob-type"], "BlockBlob");
  assert.equal(calls[1].options.redirect, "error");
  await assert.rejects(
    s.previewUpload({ artifact: "notes.txt", destinationId: "https://evil" }),
    /not-enrolled/,
  );
});
test("flash confirmations bind device identity, image hash and one use", async (t) => {
  let writes = 0,
    identity = "serial-1";
  const { root, service: s } = fixture(t, {
    flashAdapter: {
      inspect: async (id) => ({
        id,
        identity,
        bytes: 10000,
        removable: true,
        system: false,
        mounted: false,
      }),
      writeAndVerify: async (p) => {
        writes++;
        return { identity, bytes: p.bytes, sha256: p.sha256 };
      },
    },
  });
  disk(root);
  const p = await s.previewFlash({ artifact: "disk.img", deviceId: "usb1" });
  identity = "serial-2";
  await assert.rejects(
    s.confirmFlash({ token: p.token, reviewedIdentity: p.identity }),
    /stale/,
  );
  assert.equal(writes, 0);
  const valid = await s.previewFlash({
    artifact: "disk.img",
    deviceId: "usb1",
  });
  assert.equal(
    (await s.confirmFlash({ token: valid.token, reviewedIdentity: identity }))
      .state,
    "verified",
  );
  assert.equal(writes, 1);
  await assert.rejects(
    s.confirmFlash({ token: valid.token, reviewedIdentity: identity }),
    /preview-required/,
  );
});
test("remote protocol validates pinned host and owned jobs without accepting shell text", async (t) => {
  const key = "SHA256:" + "a".repeat(43),
    requests = [];
  const { service: s } = fixture(t, {
    remoteTargets: [
      {
        id: "builder",
        kind: "linux-process",
        host: "build.example",
        port: 22,
        hostKey: key,
      },
    ],
    remoteTransport: async (p) => {
      requests.push(p);
      return {
        protocol: 1,
        hostKey: key,
        uid: 1000,
        kinds: ["linux-process"],
        id: p.request.id,
        state: p.request.operation === "cancel" ? "cancelled" : "running",
      };
    },
  });
  assert.equal((await s.enrollRemote({ targetId: "builder" })).enrolled, true);
  const j = await s.startRemote({
    targetId: "builder",
    manifest: "a".repeat(64),
  });
  assert.equal((await s.cancelRemote({ id: j.id })).state, "cancelled");
  assert.equal(requests[0].subsystem, "material-buildroot-v1");
  await assert.rejects(s.cancelRemote({ id: "foreign" }), /not-owned/);
  await assert.rejects(
    s.startRemote({
      targetId: "builder",
      manifest: "a".repeat(64),
      target: "; rm",
    }),
    /invalid/,
  );
});
test("conversion rejects dependent images and existing outputs before execution", async (t) => {
  const { root, service: s } = fixture(t, {
    executor: async () => ({
      state: "succeeded",
      stdout: '{"format":"raw","backing-filename":"outside.img"}',
    }),
  });
  disk(root);
  await assert.rejects(
    s.previewConversion({
      artifact: "disk.img",
      format: "vdi",
      outputName: "disk.vdi",
    }),
    /dependent/,
  );
  assert.equal(fs.existsSync(path.join(root, "disk.vdi")), false);
});
test("cloud mismatch and remote identity failure never report verified success", async (t) => {
  const key = "SHA256:" + "a".repeat(43);
  const { service: s } = fixture(t, {
    cloudDestinations: [
      {
        id: "object",
        provider: "s3",
        uploadUrl: "https://store.example/key",
        readUrl: "https://store.example/key",
        allowedHosts: ["store.example"],
      },
    ],
    http: async (_url, options) =>
      options.method === "PUT"
        ? (await (async () => {
            for await (const _ of options.body) {
            }
          })(),
          new Response(null, { status: 200 }))
        : new Response("wrong\n"),
    remoteTargets: [
      {
        id: "host",
        kind: "linux-process",
        host: "build.example",
        port: 22,
        hostKey: key,
      },
    ],
    remoteTransport: async () => ({ protocol: 1, hostKey: "SHA256:wrong" }),
  });
  const p = await s.previewUpload({
    artifact: "notes.txt",
    destinationId: "object",
  });
  await assert.rejects(s.upload({ id: p.id }), /checksum-mismatch/);
  await assert.rejects(s.enrollRemote({ targetId: "host" }), /identity/);
});
test("VMware fixed managed VMX lifecycle and persistent registry preserve ownership", async (t) => {
  const commands = [];
  let activeVmx;
  const { root } = fixture(t);
  const managedDirectory = path.join(root, "owned-guests");
  const options = {
    root,
    managedDirectory,
    executor: async (_file, args) => {
      commands.push(args);
      if (args[2] === "start") activeVmx = args[3];
      if (args[2] === "stop") activeVmx = undefined;
      return {
        state: "succeeded",
        stdout: `Total running VMs: ${activeVmx ? 1 : 0}\n${activeVmx || ""}\n`,
      };
    },
  };
  const service = createDeploymentService(options),
    guest = await service.createGuest({
      provider: "vmware",
      hardware: { cpus: 2, firmware: "efi", network: "none" },
    });
  const vmx = path.join(managedDirectory, guest.id, "guest.vmx");
  assert.match(fs.readFileSync(vmx, "utf8"), /firmware = "efi"/);
  const recovered = createDeploymentService(options);
  assert.equal(recovered.listGuests()[0].id, guest.id);
  await recovered.launchGuest({ id: guest.id });
  assert.deepEqual(commands.at(-1), ["-T", "ws", "start", vmx, "gui"]);
  await recovered.stopGuest({ id: guest.id });
  assert.deepEqual(commands.at(-1), ["-T", "ws", "stop", vmx, "soft"]);
  assert.equal(
    (await recovered.refreshGuest({ id: guest.id })).state,
    "stopped",
  );
});
test("VirtualBox topology preview applies discovered NICs, copied media and explicit detach", async (t) => {
  const calls = [];
  let power = "poweroff";
  const { root, service: s } = fixture(t, {
    executor: async (_file, args) => {
      calls.push(args);
      const stdout =
        args[0] === "showvminfo"
          ? `VMState="${power}"`
          : args[0] === "info"
            ? '{"format":"vdi"}'
            : args[1] === "bridgedifs"
              ? "Name: Ethernet Adapter\nStatus: Up\n"
              : args[1] === "hostonlyifs"
                ? "Name: VirtualBox Host-Only Adapter\n"
                : "";
      return { state: "succeeded", stdout };
    },
  });
  const vdi = Buffer.alloc(512);
  Buffer.from("7f10dabe", "hex").copy(vdi, 64);
  fs.writeFileSync(path.join(root, "root.vdi"), vdi);
  const iso = Buffer.alloc(32774);
  iso.write("CD001", 32769);
  fs.writeFileSync(path.join(root, "install.iso"), iso);
  const guest = await s.createGuest({
    provider: "virtualbox",
    storage: [{ slot: 0, kind: "disk", artifact: "root.vdi" }],
  });
  const unchanged = fs.readFileSync(path.join(root, "root.vdi"));
  const preview = await s.previewGuestEdit({
    id: guest.id,
    expectedRevision: guest.revision,
    hardware: { cpus: 4 },
    networks: [
      { slot: 1, mode: "bridged", interface: "Ethernet Adapter" },
      { slot: 2, mode: "hostonly", interface: "VirtualBox Host-Only Adapter" },
    ],
    storage: [
      { slot: 0, kind: "disk", artifact: "root.vdi" },
      { slot: 1, kind: "iso", artifact: "install.iso" },
    ],
  });
  assert.equal(preview.storage[1].kind, "iso");
  assert.equal(preview.hostConfiguration, undefined);
  const edited = await s.editGuest({
    id: guest.id,
    expectedRevision: guest.revision,
    previewId: preview.previewId,
  });
  assert.equal(edited.revision, guest.revision + 1);
  assert.equal(edited.hardware.memoryMiB, 1024);
  assert.ok(
    calls.some(
      (a) => a.includes("--bridgeadapter1") && a.includes("Ethernet Adapter"),
    ),
  );
  assert.ok(
    calls.some(
      (a) =>
        a.includes("--hostonlyadapter2") &&
        a.includes("VirtualBox Host-Only Adapter"),
    ),
  );
  assert.ok(
    calls.some((a) => a.includes("dvddrive") && a.at(-1).endsWith(".iso")),
  );
  assert.deepEqual(fs.readFileSync(path.join(root, "root.vdi")), unchanged);
  const detached = await s.editGuest({
    id: guest.id,
    expectedRevision: edited.revision,
    storage: [],
    networks: [],
  });
  assert.equal(detached.storage.length, 0);
  assert.equal(detached.networks.length, 0);
  assert.ok(calls.some((a) => a[0] === "storageattach" && a.at(-1) === "none"));
  assert.equal(
    fs.existsSync(
      path.join(root, ".test-guests", guest.id, edited.storage[1].fileName),
    ),
    true,
  );
  await assert.rejects(
    s.editGuest({
      id: guest.id,
      expectedRevision: guest.revision,
      hardware: { cpus: 3 },
    }),
    /revision-conflict/,
  );
  await assert.rejects(
    s.previewGuestEdit({
      id: guest.id,
      networks: [{ slot: 1, mode: "bridged", interface: "Unknown Adapter" }],
    }),
    /interface-unavailable/,
  );
  power = "running";
  await assert.rejects(
    s.previewGuestEdit({ id: guest.id, hardware: { cpus: 2 } }),
    /must-be-stopped/,
  );
});
test("guest edit previews reject host drift and competing operations; partial failures remain explicit", async (t) => {
  let signature = "first",
    failModify = false,
    hold,
    release;
  const { service: s } = fixture(t, {
    executor: async (_file, args) => {
      if (args[0] === "showvminfo") {
        if (hold) {
          const waiting = hold;
          hold = undefined;
          await waiting;
        }
        return {
          state: "succeeded",
          stdout: `VMState="poweroff"\nname="${signature}"`,
        };
      }
      if (failModify && args[0] === "modifyvm")
        return { state: "failed", stdout: "" };
      return { state: "succeeded", stdout: "" };
    },
  });
  const guest = await s.createGuest({ provider: "virtualbox" });
  const preview = await s.previewGuestEdit({
    id: guest.id,
    hardware: { cpus: 2 },
  });
  signature = "externally-edited";
  await assert.rejects(
    s.editGuest({ id: guest.id, previewId: preview.previewId }),
    /host-configuration-changed/,
  );
  hold = new Promise((resolve) => {
    release = resolve;
  });
  const pending = s.refreshGuest({ id: guest.id });
  await assert.rejects(s.previewGuestEdit({ id: guest.id }), /guest-busy/);
  release();
  await pending;
  failModify = true;
  await assert.rejects(
    s.editGuest({ id: guest.id, hardware: { cpus: 3 } }),
    /command-failed/,
  );
  assert.equal(s.listGuests()[0].state, "configuration-unknown");
  assert.equal(
    (await s.refreshGuest({ id: guest.id })).state,
    "configuration-unknown",
  );
  await assert.rejects(s.launchGuest({ id: guest.id }), /state-unverified/);
  failModify = false;
  assert.equal(
    (await s.editGuest({ id: guest.id, hardware: { cpus: 3 } })).state,
    "stopped",
  );
});
test("VMware topology writes typed NIC and ISO fields without arbitrary VMX values", async (t) => {
  const { root, service: s } = fixture(t, {
    executor: async () => ({
      state: "succeeded",
      stdout: "Total running VMs: 0\n",
    }),
  });
  const iso = Buffer.alloc(32774);
  iso.write("CD001", 32769);
  fs.writeFileSync(path.join(root, "install.iso"), iso);
  const guest = await s.createGuest({
    provider: "vmware",
    networks: [
      { slot: 1, mode: "bridged" },
      { slot: 2, mode: "hostonly" },
    ],
    storage: [{ slot: 1, kind: "iso", artifact: "install.iso" }],
  });
  const vmx = fs.readFileSync(
    path.join(root, ".test-guests", guest.id, "guest.vmx"),
    "utf8",
  );
  assert.match(vmx, /ethernet0.connectionType = "bridged"/);
  assert.match(vmx, /ethernet1.connectionType = "hostonly"/);
  assert.match(vmx, /sata0:1.deviceType = "cdrom-image"/);
  await assert.rejects(
    s.previewGuestEdit({
      id: guest.id,
      networks: [{ slot: 1, mode: "bridged", interface: "arbitrary" }],
    }),
    /interface-selection-unavailable/,
  );
  await assert.rejects(
    s.previewGuestEdit({
      id: guest.id,
      storage: [{ slot: 1, kind: "iso", artifact: "notes.txt" }],
    }),
    /invalid-installation-iso/,
  );
});
test("new disk creation admits typed capacity and never replaces existing artifacts", async (t) => {
  const calls = [];
  const { root, service: s } = fixture(t, {
    executor: async (_file, args) => {
      calls.push(args);
      if (args[0] === "create") fs.writeFileSync(args[3], "owned-vmdk");
      return { state: "succeeded", stdout: "" };
    },
  });
  const created = await s.createDiskArtifact({
    outputName: "guest.vmdk",
    format: "vmdk",
    capacityMiB: 2048,
  });
  assert.equal(created.state, "created");
  assert.deepEqual(calls[0].slice(0, 3), ["create", "-f", "vmdk"]);
  assert.equal(calls[0].at(-1), "2048M");
  assert.equal(
    fs.readFileSync(path.join(root, "guest.vmdk"), "utf8"),
    "owned-vmdk",
  );
  await assert.rejects(
    s.createDiskArtifact({
      outputName: "guest.vmdk",
      format: "vmdk",
      capacityMiB: 4096,
    }),
    /output-exists/,
  );
  await assert.rejects(
    s.createDiskArtifact({
      outputName: "../outside.vmdk",
      format: "vmdk",
      capacityMiB: 4096,
    }),
    /invalid-new-disk/,
  );
  await assert.rejects(
    s.createDiskArtifact({
      outputName: "huge.vmdk",
      format: "vmdk",
      capacityMiB: 1048577,
    }),
    /invalid-new-disk/,
  );
});
