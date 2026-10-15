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
    !["nat", "none", "hostonly"].includes(network)
  )
    throw new Error("invalid-guest-hardware");
  return { memoryMiB, cpus, firmware, network };
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
        };
      } catch {
        result[provider] = { available: false, nativeAcceptance: "unverified" };
      }
    }
    return result;
  }
  listGuests() {
    return [...this.guests.values()].map(
      ({ vmx, directory, ...guest }) => guest,
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
    const h = guest.hardware;
    const content = [
      '.encoding = "UTF-8"',
      'config.version = "8"',
      'virtualHW.version = "19"',
      'guestOS = "otherlinux-64"',
      `displayName = "Material Buildroot ${guest.id}"`,
      `memsize = "${h.memoryMiB}"`,
      `numvcpus = "${h.cpus}"`,
      `firmware = "${h.firmware === "efi" ? "efi" : "bios"}"`,
      `ethernet0.present = "${h.network === "none" ? "FALSE" : "TRUE"}"`,
      `ethernet0.connectionType = "${h.network === "hostonly" ? "hostonly" : "nat"}"`,
      'ethernet0.virtualDev = "e1000"',
    ];
    if (guest.diskName)
      content.push(
        'scsi0.present = "TRUE"',
        'scsi0.virtualDev = "lsilogic"',
        'scsi0:0.present = "TRUE"',
        `scsi0:0.fileName = "${guest.diskName}"`,
      );
    fs.writeFileSync(guest.vmx, content.join("\n") + "\n", { mode: 0o600 });
  }
  async createGuest({ provider, hardware = {}, disk } = {}) {
    if (!["virtualbox", "vmware"].includes(provider))
      throw new Error("invalid-hypervisor");
    const h = validateHardware(hardware),
      id = crypto.randomUUID(),
      directory = path.join(this.managedDirectory, id),
      guest = {
        id,
        provider,
        hardware: h,
        directory,
        vmx: path.join(directory, "guest.vmx"),
        state: "provisioning",
      };
    let diskFile;
    if (disk) {
      diskFile = safePath(this.store.root, disk);
      const extension = path.extname(diskFile).toLowerCase();
      if (
        !(
          provider === "vmware" ? [".vmdk"] : [".vdi", ".vmdk", ".vhd"]
        ).includes(extension)
      )
        throw new Error("unsupported-guest-disk");
      if (
        extension === ".vmdk" &&
        this.convertedDisks.get(diskFile) !== (await hashFile(diskFile))
      )
        throw new Error("vmdk-requires-owned-conversion");
      guest.diskName = `disk${extension}`;
    }
    fs.mkdirSync(directory);
    this.guests.set(id, guest);
    this.save();
    try {
      if (diskFile) {
        const destination = path.join(directory, guest.diskName);
        fs.copyFileSync(diskFile, destination, fs.constants.COPYFILE_EXCL);
        if ((await hashFile(diskFile)) !== (await hashFile(destination)))
          throw new Error("guest-disk-copy-verification-failed");
      }
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
        if (guest.diskName) {
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
          await this.run(provider, [
            "storageattach",
            id,
            "--storagectl",
            "SATA",
            "--port",
            "0",
            "--device",
            "0",
            "--type",
            "hdd",
            "--medium",
            path.join(directory, guest.diskName),
          ]);
        }
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
    await this.run("virtualbox", [
      "modifyvm",
      guest.id,
      "--memory",
      String(h.memoryMiB),
      "--cpus",
      String(h.cpus),
      "--firmware",
      h.firmware,
      "--nic1",
      h.network === "hostonly" ? "hostonly" : h.network,
      "--boot1",
      "disk",
      "--boot2",
      "dvd",
    ]);
  }
  async importGuest({ provider, artifact, hardware }) {
    const file = safePath(this.store.root, artifact);
    if ([".ova", ".ovf"].includes(path.extname(file).toLowerCase()))
      throw new Error("appliance-import-review-unavailable-use-validated-disk");
    return this.createGuest({ provider, disk: artifact, hardware });
  }
  async editGuest({ id, hardware }) {
    const guest = this.owned(id);
    if (guest.state !== "stopped") throw new Error("guest-must-be-stopped");
    const previous = guest.hardware;
    guest.hardware = validateHardware(hardware);
    try {
      if (guest.provider === "virtualbox")
        await this.configureVirtualBox(guest);
      else this.writeVmx(guest);
      this.save();
    } catch (error) {
      guest.hardware = previous;
      throw error;
    }
    return this.listGuests().find((x) => x.id === id);
  }
  async launchGuest({ id }) {
    const g = this.owned(id);
    if (g.state !== "stopped") throw new Error("guest-must-be-stopped");
    await this.run(
      g.provider,
      g.provider === "virtualbox"
        ? ["startvm", id, "--type", "gui"]
        : ["-T", "ws", "start", g.vmx, "gui"],
    );
    g.state = "running";
    this.save();
    return { id, state: g.state, bootVerified: false };
  }
  async stopGuest({ id }) {
    const g = this.owned(id);
    if (g.state !== "running") throw new Error("guest-not-running");
    await this.run(
      g.provider,
      g.provider === "virtualbox"
        ? ["controlvm", id, "acpipowerbutton"]
        : ["-T", "ws", "stop", g.vmx, "soft"],
    );
    g.state = "shutdown-requested";
    this.save();
    return { id, state: g.state, shutdownVerified: false };
  }
  async refreshGuest({ id }) {
    const g = this.owned(id);
    const output = await this.run(
      g.provider,
      g.provider === "virtualbox"
        ? ["showvminfo", id, "--machinereadable"]
        : ["-T", "ws", "list"],
    );
    const running =
      g.provider === "virtualbox"
        ? /VMState="running"/.test(output)
        : output.split(/\r?\n/).includes(g.vmx);
    const stopped =
      g.provider === "virtualbox"
        ? /VMState="poweroff"/.test(output)
        : !running;
    g.state = running ? "running" : stopped ? "stopped" : "unknown";
    this.save();
    return { id, state: g.state };
  }
  async previewConversion({ artifact, format, outputName }) {
    if (
      !["raw", "vmdk", "vdi", "qcow2"].includes(format) ||
      typeof outputName !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(outputName)
    )
      throw new Error("invalid-conversion");
    const file = safePath(this.store.root, artifact),
      info = await this.store.inspectArtifact(artifact);
    if (!["raw-disk", "gpt-disk", "vdi", "qcow2"].includes(info.format))
      throw new Error("unsupported-source-format");
    const metadata = JSON.parse(
      await this.run("qemu", [
        "info",
        "--output=json",
        "-f",
        ["raw-disk", "gpt-disk"].includes(info.format) ? "raw" : info.format,
        file,
      ]),
    );
    if (
      metadata["backing-filename"] ||
      metadata["full-backing-filename"] ||
      metadata.encrypted ||
      metadata.snapshots?.length
    )
      throw new Error("dependent-or-encrypted-image-not-admitted");
    const output = path.join(this.store.root, outputName);
    if (fs.existsSync(output)) throw new Error("conversion-output-exists");
    const id = crypto.randomUUID();
    const plan = {
      id,
      artifact,
      sha256: info.sha256,
      format,
      outputName,
      file,
      output,
      inputFormat: ["raw-disk", "gpt-disk"].includes(info.format)
        ? "raw"
        : info.format,
    };
    this.plans.set(id, plan);
    return {
      id,
      artifact,
      sha256: info.sha256,
      format,
      outputName,
      destructive: false,
      command: [
        "qemu-img",
        "convert",
        "-f",
        plan.inputFormat,
        "-O",
        format,
        artifact,
        outputName,
      ],
    };
  }
  async executeConversion({ id }) {
    const p = this.plans.get(id);
    if (!p) throw new Error("conversion-preview-required");
    this.plans.delete(id);
    if (
      (await hashFile(safePath(this.store.root, p.artifact))) !== p.sha256 ||
      fs.existsSync(p.output)
    )
      throw new Error("conversion-preview-stale");
    // Reserve a unique output in a private directory so qemu cannot overwrite an existing file.
    const temporary = fs.mkdtempSync(
      path.join(this.store.root, ".conversion-"),
    );
    const output = path.join(temporary, "output");
    try {
      await this.run(
        "qemu",
        ["convert", "-f", p.inputFormat, "-O", p.format, p.file, output],
        600000,
      );
      fs.linkSync(output, p.output);
      const inspected = await this.store.inspectArtifact(p.outputName);
      this.convertedDisks.set(p.output, inspected.sha256);
      return inspected;
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
}
module.exports = { Virtualization, validateHardware, defaultExecutor };
