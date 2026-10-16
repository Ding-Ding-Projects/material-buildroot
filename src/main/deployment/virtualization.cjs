"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { safePath, hashFile } = require("./artifacts.cjs");
const { boundedProcess } = require("../execution/index.cjs");
const defaultExecutor = async (file, args, options) =>
  boundedProcess(file, args, options).completion;
function validateHardware(input = {}) {
  const {
    memoryMiB = 1024,
    cpus = 1,
    firmware = "bios",
    network = "nat",
  } = input;
  if (
    Object.keys(input).some(
      (k) => !["memoryMiB", "cpus", "firmware", "network"].includes(k),
    ) ||
    !Number.isInteger(memoryMiB) ||
    memoryMiB < 128 ||
    memoryMiB > 65536 ||
    !Number.isInteger(cpus) ||
    cpus < 1 ||
    cpus > 32 ||
    !["bios", "efi"].includes(firmware) ||
    !["nat", "none", "hostonly", "bridged"].includes(network)
  )
    throw new Error("invalid-guest-hardware");
  return { memoryMiB, cpus, firmware, network };
}
function validateNetworks(input, provider, fallback = "nat") {
  const networks = input === undefined ? [{ slot: 1, mode: fallback }] : input;
  if (!Array.isArray(networks) || networks.length > 4)
    throw new Error("invalid-guest-networks");
  const slots = new Set();
  return networks
    .map((item) => {
      if (
        !item ||
        Object.keys(item).some(
          (k) => !["slot", "mode", "interface"].includes(k),
        ) ||
        !Number.isInteger(item.slot) ||
        item.slot < 1 ||
        item.slot > 4 ||
        slots.has(item.slot) ||
        !["nat", "none", "bridged", "hostonly"].includes(item.mode)
      )
        throw new Error("invalid-guest-networks");
      slots.add(item.slot);
      if (
        item.interface !== undefined &&
        (typeof item.interface !== "string" ||
          !item.interface ||
          item.interface.length > 240 ||
          /[\0\r\n"]/.test(item.interface))
      )
        throw new Error("invalid-network-interface");
      if (
        provider === "virtualbox" &&
        ["bridged", "hostonly"].includes(item.mode) &&
        !item.interface
      )
        throw new Error("network-interface-required");
      if (provider === "vmware" && item.interface !== undefined)
        throw new Error("vmware-interface-selection-unavailable");
      if (["nat", "none"].includes(item.mode) && item.interface !== undefined)
        throw new Error("unexpected-network-interface");
      return {
        slot: item.slot,
        mode: item.mode,
        ...(item.interface ? { interface: item.interface } : {}),
      };
    })
    .sort((a, b) => a.slot - b.slot);
}
function validateStorage(input) {
  if (!Array.isArray(input) || input.length > 4)
    throw new Error("invalid-guest-storage");
  const slots = new Set();
  return input
    .map((item) => {
      if (
        !item ||
        Object.keys(item).some(
          (k) => !["slot", "kind", "artifact"].includes(k),
        ) ||
        !Number.isInteger(item.slot) ||
        item.slot < 0 ||
        item.slot > 3 ||
        slots.has(item.slot) ||
        !["disk", "iso"].includes(item.kind) ||
        typeof item.artifact !== "string"
      )
        throw new Error("invalid-guest-storage");
      slots.add(item.slot);
      return { slot: item.slot, kind: item.kind, artifact: item.artifact };
    })
    .sort((a, b) => a.slot - b.slot);
}
class Virtualization {
  constructor({
    store,
    managedDirectory,
    executor = defaultExecutor,
    executables = {},
  }) {
    this.store = store;
    this.executor = executor;
    this.executables = {
      virtualbox: "VBoxManage",
      vmware: "vmrun",
      qemu: "qemu-img",
      ...executables,
    };
    this.guests = new Map();
    this.plans = new Map();
    this.convertedDisks = new Map();
    this.guestPlans = new Map();
    this.guestLocks = new Set();
    this.managedDirectory =
      managedDirectory ||
      fs.mkdtempSync(path.join(os.tmpdir(), "material-buildroot-guests-"));
    fs.mkdirSync(this.managedDirectory, { recursive: true });
    this.managedDirectory = fs.realpathSync(this.managedDirectory);
    const registry = path.join(this.managedDirectory, "registry.json");
    if (fs.existsSync(registry)) {
      const saved = JSON.parse(fs.readFileSync(registry, "utf8"));
      if (!Array.isArray(saved) || saved.length > 1000)
        throw new Error("invalid-guest-registry");
      for (const guest of saved) {
        if (
          !/^[a-f0-9-]{36}$/.test(guest.id) ||
          !["virtualbox", "vmware"].includes(guest.provider)
        )
          throw new Error("invalid-guest-registry");
        guest.directory = path.join(this.managedDirectory, guest.id);
        guest.vmx = path.join(guest.directory, "guest.vmx");
        guest.hardware = validateHardware(guest.hardware);
        guest.revision = Number.isInteger(guest.revision) ? guest.revision : 1;
        guest.networks = guest.networks || [
          { slot: 1, mode: guest.hardware.network },
        ];
        guest.networks = validateNetworks(
          guest.networks,
          guest.provider,
          guest.hardware.network,
        );
        guest.storage = guest.storage || [];
        if (
          !Array.isArray(guest.storage) ||
          guest.storage.length > 4 ||
          guest.storage.some(
            (x) =>
              !/^media-[0-3]-[a-f0-9]{16}\.(?:iso|vdi|vhd|vmdk)$/.test(
                x.fileName || "",
              ) ||
              !/^[a-f0-9]{64}$/.test(x.sha256 || "") ||
              !Number.isInteger(x.slot) ||
              x.slot < 0 ||
              x.slot > 3 ||
              !["disk", "iso"].includes(x.kind),
          )
        )
          throw new Error("invalid-guest-registry");
        this.guests.set(guest.id, guest);
      }
    }
  }
  save() {
    const file = path.join(this.managedDirectory, "registry.json");
    fs.writeFileSync(
      `${file}.tmp`,
      JSON.stringify([...this.guests.values()], null, 2),
      { mode: 0o600 },
    );
    fs.renameSync(`${file}.tmp`, file);
  }
  async run(provider, args, timeoutMs = 30000) {
    const result = await this.executor(this.executables[provider], args, {
      timeoutMs,
      maxBytes: 1024 * 1024,
    });
    if (result.state !== "succeeded")
      throw new Error(`${provider}-command-${result.state}`);
    return result.stdout || "";
  }
  async discoverHypervisors() {
    const result = {};
    for (const [provider, args] of [
      ["virtualbox", ["--version"]],
      ["vmware", ["-T", "ws", "list"]],
    ]) {
      try {
        const output = await this.run(provider, args);
        result[provider] = {
          available: true,
          output,
          versionVerified: provider === "virtualbox",
          nativeAcceptance: "unverified",
          capabilities: {
            hardware: ["memoryMiB", "cpus", "firmware"],
            nicSlots: 4,
            storageSlots: 4,
            networkModes: ["nat", "none", "bridged", "hostonly"],
            selectableInterfaces: provider === "virtualbox",
            diskFormats:
              provider === "virtualbox"
                ? ["vdi", "vhd", "owned-vmdk"]
                : ["owned-vmdk"],
            installationIso: true,
            nativeBootVerified: false,
          },
        };
      } catch {
        result[provider] = { available: false, nativeAcceptance: "unverified" };
      }
    }
    return result;
  }
  listGuests() {
    return [...this.guests.values()].map(({ vmx, directory, ...guest }) =>
      structuredClone(guest),
    );
  }
  owned(id) {
    const guest = this.guests.get(id);
    if (!guest) throw new Error("guest-not-owned");
    const real = fs.realpathSync(guest.directory);
    if (
      real !== guest.directory ||
      path.dirname(real) !== this.managedDirectory
    )
      throw new Error("guest-path-changed");
    return guest;
  }
  writeVmx(guest) {
    if (fs.readdirSync(guest.directory).some((name) => name.endsWith(".lck")))
      throw new Error("vmware-guest-locked");
    const h = guest.hardware;
    const content = [
      '.encoding = "UTF-8"',
      'config.version = "8"',
      'virtualHW.version = "19"',
      'guestOS = "otherlinux-64"',
      `displayName = "Material Buildroot ${guest.id}"`,
      `memsize = "${h.memoryMiB}"`,
      `numvcpus = "${h.cpus}"`,
      `firmware = "${h.firmware}"`,
    ];
    for (let slot = 1; slot <= 4; slot++) {
      const nic = guest.networks.find((x) => x.slot === slot),
        prefix = `ethernet${slot - 1}`;
      content.push(
        `${prefix}.present = "${nic && nic.mode !== "none" ? "TRUE" : "FALSE"}"`,
      );
      if (nic && nic.mode !== "none")
        content.push(
          `${prefix}.connectionType = "${nic.mode}"`,
          `${prefix}.virtualDev = "e1000"`,
        );
    }
    content.push('scsi0.present = "TRUE"', 'scsi0.virtualDev = "lsilogic"');
    for (const media of guest.storage) {
      const prefix =
        media.kind === "iso" ? `sata0:${media.slot}` : `scsi0:${media.slot}`;
      if (media.kind === "iso") content.push('sata0.present = "TRUE"');
      content.push(
        `${prefix}.present = "TRUE"`,
        `${prefix}.fileName = "${media.fileName}"`,
      );
      if (media.kind === "iso")
        content.push(`${prefix}.deviceType = "cdrom-image"`);
    }
    const temporary = `${guest.vmx}.tmp`;
    fs.writeFileSync(temporary, content.join("\n") + "\n", { mode: 0o600 });
    fs.renameSync(temporary, guest.vmx);
  }
  async discoverNetworks() {
    const result = { bridged: [], hostonly: [] };
    for (const [kind, command] of [
      ["bridged", "bridgedifs"],
      ["hostonly", "hostonlyifs"],
    ]) {
      const output = await this.run("virtualbox", ["list", command]);
      result[kind] = [...output.matchAll(/^Name:\s*(.+)$/gm)]
        .map((x) => x[1].trim())
        .filter((x) => x && !/[\0\r\n"]/.test(x));
    }
    return result;
  }
  async checkNetworks(provider, networks) {
    if (
      provider !== "virtualbox" ||
      !networks.some((x) => ["bridged", "hostonly"].includes(x.mode))
    )
      return;
    const available = await this.discoverNetworks();
    for (const nic of networks)
      if (
        ["bridged", "hostonly"].includes(nic.mode) &&
        !available[nic.mode].includes(nic.interface)
      )
        throw new Error("network-interface-unavailable");
  }
  async prepareStorage(provider, request) {
    const result = [];
    for (const item of validateStorage(request)) {
      const file = safePath(this.store.root, item.artifact),
        info = await this.store.inspectArtifact(item.artifact),
        extension = path.extname(file).toLowerCase();
      if (item.kind === "iso") {
        if (info.format !== "iso9660")
          throw new Error("invalid-installation-iso");
      } else {
        if (
          !(
            provider === "vmware" ? [".vmdk"] : [".vdi", ".vmdk", ".vhd"]
          ).includes(extension)
        )
          throw new Error("unsupported-guest-disk");
        if (
          extension === ".vmdk" &&
          this.convertedDisks.get(file) !== info.sha256
        )
          throw new Error("vmdk-requires-owned-conversion");
        if (extension !== ".vmdk") {
          const metadata = JSON.parse(
            await this.run("qemu", ["info", "--output=json", file]),
          );
          if (
            metadata["backing-filename"] ||
            metadata["full-backing-filename"] ||
            metadata.encrypted ||
            metadata.snapshots?.length
          )
            throw new Error("dependent-or-encrypted-image-not-admitted");
        }
      }
      result.push({
        ...item,
        sha256: info.sha256,
        size: info.size,
        fileName: `media-${item.slot}-${info.sha256.slice(0, 16)}${item.kind === "iso" ? ".iso" : extension}`,
      });
    }
    return result;
  }
  async copyStorage(guest, storage) {
    for (const item of storage) {
      const destination = path.join(guest.directory, item.fileName);
      if (fs.existsSync(destination)) {
        if ((await hashFile(destination)) !== item.sha256)
          throw new Error("owned-media-changed");
        continue;
      }
      const source = safePath(this.store.root, item.artifact);
      if ((await hashFile(source)) !== item.sha256)
        throw new Error("guest-storage-preview-stale");
      if (!fs.existsSync(destination))
        fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
      if ((await hashFile(destination)) !== item.sha256)
        throw new Error("guest-disk-copy-verification-failed");
    }
  }
  async locked(id, operation) {
    if (this.guestLocks.has(id)) throw new Error("guest-busy");
    this.guestLocks.add(id);
    try {
      return await operation(this.owned(id));
    } finally {
      this.guestLocks.delete(id);
    }
  }
  async observedState(guest) {
    const output = await this.run(
      guest.provider,
      guest.provider === "virtualbox"
        ? ["showvminfo", guest.id, "--machinereadable"]
        : ["-T", "ws", "list"],
    );
    if (guest.provider === "virtualbox")
      return /VMState="running"/.test(output)
        ? "running"
        : /VMState="poweroff"/.test(output)
          ? "stopped"
          : "unknown";
    if (!/^Total running VMs: \d+/m.test(output))
      throw new Error("invalid-vmware-inventory");
    return output.split(/\r?\n/).includes(guest.vmx) ? "running" : "stopped";
  }
  async requireStopped(guest) {
    if ((await this.observedState(guest)) !== "stopped")
      throw new Error("guest-must-be-stopped");
  }
  async configurationFingerprint(guest) {
    return guest.provider === "vmware"
      ? hashFile(guest.vmx)
      : crypto
          .createHash("sha256")
          .update(
            await this.run("virtualbox", [
              "showvminfo",
              guest.id,
              "--machinereadable",
            ]),
          )
          .digest("hex");
  }
  async createGuest({ provider, hardware = {}, disk, networks, storage } = {}) {
    if (!["virtualbox", "vmware"].includes(provider))
      throw new Error("invalid-hypervisor");
    if (disk && storage) throw new Error("conflicting-guest-storage");
    const h = validateHardware(hardware),
      n = validateNetworks(networks, provider, h.network);
    await this.checkNetworks(provider, n);
    h.network = n.find((x) => x.slot === 1)?.mode || "none";
    const media = await this.prepareStorage(
      provider,
      storage || (disk ? [{ slot: 0, kind: "disk", artifact: disk }] : []),
    );
    const id = crypto.randomUUID(),
      directory = path.join(this.managedDirectory, id),
      guest = {
        id,
        provider,
        hardware: h,
        networks: n,
        storage: media,
        revision: 1,
        directory,
        vmx: path.join(directory, "guest.vmx"),
        state: "provisioning",
      };
    fs.mkdirSync(directory);
    this.guests.set(id, guest);
    this.save();
    try {
      await this.copyStorage(guest, media);
      if (provider === "virtualbox") {
        await this.run(provider, [
          "createvm",
          "--name",
          `Material Buildroot ${id}`,
          "--uuid",
          id,
          "--basefolder",
          directory,
          "--ostype",
          "Linux_64",
          "--register",
        ]);
        await this.configureVirtualBox(guest);
        await this.run(provider, [
          "storagectl",
          id,
          "--name",
          "SATA",
          "--add",
          "sata",
          "--controller",
          "IntelAhci",
        ]);
        await this.configureStorage(guest, []);
      } else this.writeVmx(guest);
      guest.state = "stopped";
      this.save();
      return this.listGuests().find((x) => x.id === id);
    } catch (error) {
      guest.state = "provisioning-failed";
      this.save();
      throw error;
    }
  }
  async configureVirtualBox(guest) {
    const h = guest.hardware;
    const args = [
      "modifyvm",
      guest.id,
      "--memory",
      String(h.memoryMiB),
      "--cpus",
      String(h.cpus),
      "--firmware",
      h.firmware,
      "--boot1",
      "disk",
      "--boot2",
      "dvd",
    ];
    for (let slot = 1; slot <= 4; slot++) {
      const nic = guest.networks.find((x) => x.slot === slot);
      args.push(`--nic${slot}`, nic?.mode || "none");
      if (nic?.interface)
        args.push(
          `--${nic.mode === "bridged" ? "bridgeadapter" : "hostonlyadapter"}${slot}`,
          nic.interface,
        );
    }
    await this.run("virtualbox", args);
  }
  async configureStorage(guest, previous) {
    for (const item of previous)
      if (
        !guest.storage.some(
          (x) =>
            x.slot === item.slot &&
            x.kind === item.kind &&
            x.sha256 === item.sha256,
        )
      )
        await this.run("virtualbox", [
          "storageattach",
          guest.id,
          "--storagectl",
          "SATA",
          "--port",
          String(item.slot),
          "--device",
          "0",
          "--type",
          item.kind === "iso" ? "dvddrive" : "hdd",
          "--medium",
          "none",
        ]);
    for (const item of guest.storage)
      await this.run("virtualbox", [
        "storageattach",
        guest.id,
        "--storagectl",
        "SATA",
        "--port",
        String(item.slot),
        "--device",
        "0",
        "--type",
        item.kind === "iso" ? "dvddrive" : "hdd",
        "--medium",
        path.join(guest.directory, item.fileName),
      ]);
  }
  async importGuest({ provider, artifact, hardware }) {
    const file = safePath(this.store.root, artifact);
    if ([".ova", ".ovf"].includes(path.extname(file).toLowerCase()))
      throw new Error("appliance-import-review-unavailable-use-validated-disk");
    return this.createGuest({ provider, disk: artifact, hardware });
  }
  async previewGuestEdit({
    id,
    expectedRevision,
    hardware,
    networks,
    storage,
  }) {
    return this.locked(id, async (guest) => {
      if (expectedRevision !== undefined && expectedRevision !== guest.revision)
        throw new Error("guest-revision-conflict");
      if (guest.diskName && guest.storage.length === 0)
        throw new Error("legacy-storage-reimport-required");
      await this.requireStopped(guest);
      const nextHardware = validateHardware({ ...guest.hardware, ...hardware });
      const nextNetworks = validateNetworks(
        networks === undefined
          ? hardware?.network !== undefined
            ? undefined
            : guest.networks
          : networks,
        guest.provider,
        nextHardware.network,
      );
      await this.checkNetworks(guest.provider, nextNetworks);
      nextHardware.network =
        nextNetworks.find((x) => x.slot === 1)?.mode || "none";
      const nextStorage =
        storage === undefined
          ? structuredClone(guest.storage)
          : await this.prepareStorage(guest.provider, storage);
      const previewId = crypto.randomUUID(),
        expiresAt = Date.now() + 120000,
        hostConfiguration = await this.configurationFingerprint(guest);
      const plan = {
        previewId,
        id,
        revision: guest.revision,
        hardware: nextHardware,
        networks: nextNetworks,
        storage: nextStorage,
        expiresAt,
        hostConfiguration,
      };
      this.guestPlans.set(previewId, plan);
      const { hostConfiguration: _hostConfiguration, ...publicPlan } = plan;
      return structuredClone({
        ...publicPlan,
        warning:
          "Changes apply only to this stopped managed guest; detached media copies are retained.",
      });
    });
  }
  async editGuest(request) {
    let previewId = request.previewId;
    if (!previewId)
      previewId = (await this.previewGuestEdit(request)).previewId;
    const plan = this.guestPlans.get(previewId);
    if (!plan || plan.id !== request.id)
      throw new Error("guest-edit-preview-required");
    return this.locked(request.id, async (guest) => {
      this.guestPlans.delete(previewId);
      if (
        Date.now() > plan.expiresAt ||
        plan.revision !== guest.revision ||
        (request.expectedRevision !== undefined &&
          request.expectedRevision !== guest.revision)
      )
        throw new Error("guest-revision-conflict");
      await this.requireStopped(guest);
      if (
        (await this.configurationFingerprint(guest)) !== plan.hostConfiguration
      )
        throw new Error("guest-host-configuration-changed");
      await this.checkNetworks(guest.provider, plan.networks);
      await this.copyStorage(guest, plan.storage);
      const previous = structuredClone(guest);
      Object.assign(guest, {
        hardware: plan.hardware,
        networks: plan.networks,
        storage: plan.storage,
      });
      try {
        if (guest.provider === "virtualbox") {
          await this.configureVirtualBox(guest);
          await this.configureStorage(guest, previous.storage);
        } else this.writeVmx(guest);
        guest.revision++;
        guest.state = "stopped";
        this.save();
      } catch (error) {
        Object.assign(guest, previous);
        guest.state = "configuration-unknown";
        guest.revision++;
        this.save();
        throw error;
      }
      return this.listGuests().find((x) => x.id === guest.id);
    });
  }
  async launchGuest({ id, expectedRevision }) {
    return this.locked(id, async (g) => {
      if (expectedRevision !== undefined && expectedRevision !== g.revision)
        throw new Error("guest-revision-conflict");
      if (!["stopped", "running", "shutdown-requested"].includes(g.state))
        throw new Error("guest-state-unverified");
      await this.requireStopped(g);
      await this.run(
        g.provider,
        g.provider === "virtualbox"
          ? ["startvm", id, "--type", "gui"]
          : ["-T", "ws", "start", g.vmx, "gui"],
      );
      g.state = "running";
      g.revision++;
      this.save();
      return { id, state: g.state, revision: g.revision, bootVerified: false };
    });
  }
  async stopGuest({ id, expectedRevision }) {
    return this.locked(id, async (g) => {
      if (expectedRevision !== undefined && expectedRevision !== g.revision)
        throw new Error("guest-revision-conflict");
      if ((await this.observedState(g)) !== "running")
        throw new Error("guest-not-running");
      await this.run(
        g.provider,
        g.provider === "virtualbox"
          ? ["controlvm", id, "acpipowerbutton"]
          : ["-T", "ws", "stop", g.vmx, "soft"],
      );
      g.state = "shutdown-requested";
      g.revision++;
      this.save();
      return {
        id,
        state: g.state,
        revision: g.revision,
        shutdownVerified: false,
      };
    });
  }
  async refreshGuest({ id }) {
    return this.locked(id, async (g) => {
      const state = await this.observedState(g);
      if (
        !["configuration-unknown", "provisioning-failed"].includes(g.state) &&
        state !== g.state
      ) {
        g.state = state;
        g.revision++;
        this.save();
      }
      return { id, state: g.state, observedState: state, revision: g.revision };
    });
  }
  async createDiskArtifact({ outputName, format, capacityMiB }) {
    if (
      !["vdi", "vmdk"].includes(format) ||
      !Number.isInteger(capacityMiB) ||
      capacityMiB < 64 ||
      capacityMiB > 1048576 ||
      typeof outputName !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(outputName) ||
      !outputName.endsWith(`.${format}`)
    )
      throw new Error("invalid-new-disk");
    const destination = path.join(this.store.root, outputName);
    if (fs.existsSync(destination)) throw new Error("disk-output-exists");
    const temporary = fs.mkdtempSync(
        path.join(this.managedDirectory, "new-disk-"),
      ),
      output = path.join(temporary, `disk.${format}`);
    try {
      await this.run(
        "qemu",
        ["create", "-f", format, output, `${capacityMiB}M`],
        120000,
      );
      const sha256 = await hashFile(output);
      // An exclusive copy supports artifact roots on another volume and preserves existing outputs.
      fs.copyFileSync(output, destination, fs.constants.COPYFILE_EXCL);
      if ((await hashFile(destination)) !== sha256)
        throw new Error("new-disk-copy-verification-failed");
      this.convertedDisks.set(destination, sha256);
      return {
        artifact: outputName,
        format,
        capacityMiB,
        sha256,
        state: "created",
        overwritten: false,
      };
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  async previewConversion(request) {
    return require("./conversion-exports.cjs").previewConversion.call(this, request);
  }
  async executeConversion(request) {
    return require("./conversion-exports.cjs").executeConversion.call(this, request);
  }
}
module.exports = {
  Virtualization,
  validateHardware,
  validateNetworks,
  validateStorage,
  defaultExecutor,
};
