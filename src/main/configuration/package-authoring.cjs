"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};
const NAME = /^[a-z][a-z0-9-]{0,63}$/;
function token(value, code, pattern = /^[A-Za-z0-9_.+:/@%=-]+$/) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 4096 ||
    !pattern.test(value)
  )
    fail(code);
  return value;
}
function filename(value) {
  token(value, "INVALID_PACKAGE_FILE", /^[A-Za-z0-9][A-Za-z0-9_.+-]*$/);
  if (value === "." || value === "..") fail("INVALID_PACKAGE_FILE");
  return value;
}
function list(value, validate) {
  if (!Array.isArray(value) || value.length > 256) fail("INVALID_PACKAGE_LIST");
  value.forEach(validate);
  if (new Set(value).size !== value.length) fail("DUPLICATE_PACKAGE_ITEM");
  return value;
}
function validateAuthoringModel(model) {
  if (!model || typeof model !== "object" || Array.isArray(model))
    fail("INVALID_PACKAGE");
  const allowed = [
    "name",
    "version",
    "source",
    "sourceFilename",
    "license",
    "licenseFiles",
    "buildSystem",
    "dependencies",
    "configDependencies",
    "help",
    "homepage",
    "hashes",
    "pythonSetupType",
  ];
  if (Object.keys(model).some((key) => !allowed.includes(key)))
    fail("UNSUPPORTED_PACKAGE_FIELD");
  token(model.name, "INVALID_PACKAGE_NAME", NAME);
  token(
    model.version,
    "INVALID_PACKAGE_VERSION",
    /^[A-Za-z0-9][A-Za-z0-9_.+-]*$/,
  );
  for (const key of ["source", "homepage"]) {
    token(
      model[key],
      "INVALID_PACKAGE_URL",
      /^https?:\/\/[A-Za-z0-9._~:/@%+=-]+$/,
    );
    const url = new URL(model[key]);
    if (url.username || url.password || !url.hostname)
      fail("INVALID_PACKAGE_URL");
  }
  filename(model.sourceFilename);
  token(
    model.license,
    "INVALID_PACKAGE_LICENSE",
    /^[A-Za-z0-9][A-Za-z0-9_.+() -]*$/,
  );
  list(model.licenseFiles, filename);
  if (!model.licenseFiles.length) fail("LICENSE_FILES_REQUIRED");
  if (
    ![
      "generic",
      "autotools",
      "cmake",
      "meson",
      "cargo",
      "go",
      "python",
    ].includes(model.buildSystem)
  )
    fail("INVALID_BUILD_SYSTEM");
  if (
    model.buildSystem === "python" &&
    ![
      "setuptools",
      "pep517",
      "flit",
      "hatch",
      "poetry",
      "setuptools-rust",
      "maturin",
    ].includes(model.pythonSetupType)
  )
    fail("INVALID_PYTHON_SETUP_TYPE");
  if (model.buildSystem !== "python" && model.pythonSetupType !== undefined)
    fail("INVALID_PYTHON_SETUP_TYPE");
  list(model.dependencies, (value) =>
    token(value, "INVALID_PACKAGE_DEPENDENCY", NAME),
  );
  if (model.dependencies.includes(model.name)) fail("PACKAGE_SELF_DEPENDENCY");
  list(model.configDependencies, (value) =>
    token(value, "INVALID_CONFIG_DEPENDENCY", /^BR2_[A-Z0-9_]+$/),
  );
  if (
    typeof model.help !== "string" ||
    !model.help.trim() ||
    model.help.length > 16384 ||
    /[\x00-\x08\x0b-\x1f\x7f]/.test(model.help)
  )
    fail("INVALID_PACKAGE_HELP");
  if (!Array.isArray(model.hashes) || model.hashes.length > 256)
    fail("INVALID_HASH");
  const hashFiles = new Set();
  for (const item of model.hashes) {
    if (
      !item ||
      Object.keys(item).some(
        (key) => !["algorithm", "digest", "file"].includes(key),
      ) ||
      !["sha256", "sha512"].includes(item.algorithm) ||
      !new RegExp(
        `^[a-fA-F0-9]{${item.algorithm === "sha256" ? 64 : 128}}$`,
      ).test(item.digest)
    )
      fail("INVALID_HASH");
    filename(item.file);
    if (hashFiles.has(item.file)) fail("DUPLICATE_PACKAGE_HASH");
    hashFiles.add(item.file);
  }
  if (
    ![model.sourceFilename, ...model.licenseFiles].every((file) =>
      hashFiles.has(file),
    )
  )
    fail("PACKAGE_HASH_REQUIRED");
  return model;
}
function renderPackage(model, externalName) {
  validateAuthoringModel(model);
  const prefix = model.name.toUpperCase().replace(/-/g, "_");
  const base = `package/${model.name}`;
  const sourceURL = new URL(model.source);
  if (!sourceURL.pathname.endsWith("/" + model.sourceFilename))
    fail("SOURCE_FILENAME_MISMATCH");
  const site = model.source.slice(0, -model.sourceFilename.length - 1);
  const config = [
    `config BR2_PACKAGE_${prefix}`,
    `\tbool "${model.name}"`,
    ...model.configDependencies.map((dep) => `\tdepends on ${dep}`),
    "\thelp",
    ...model.help.split("\n").map((line) => `\t  ${line}`),
    "\t",
    `\t  ${model.homepage}`,
    "",
  ].join("\n");
  const make = [
    `${prefix}_VERSION = ${model.version}`,
    `${prefix}_SOURCE = ${model.sourceFilename}`,
    `${prefix}_SITE = ${site}`,
    `${prefix}_LICENSE = ${model.license}`,
    `${prefix}_LICENSE_FILES = ${model.licenseFiles.join(" ")}`,
  ];
  if (model.dependencies.length)
    make.push(`${prefix}_DEPENDENCIES = ${model.dependencies.join(" ")}`);
  if (model.buildSystem === "python")
    make.push(`${prefix}_SETUP_TYPE = ${model.pythonSetupType}`);
  const infrastructure =
    model.buildSystem === "go" ? "golang" : model.buildSystem;
  make.push("", `$(eval $(${infrastructure}-package))`, "");
  const hash =
    model.hashes
      .map(
        (item) =>
          `${item.algorithm}  ${item.digest.toLowerCase()}  ${item.file}`,
      )
      .join("\n") + "\n";
  return {
    files: {
      [`${base}/Config.in`]: config,
      [`${base}/${model.name}.mk`]: make.join("\n"),
      [`${base}/${model.name}.hash`]: hash,
    },
    configLine: `source "$BR2_EXTERNAL_${externalName}_PATH/${base}/Config.in"`,
    makeLine: `include $(BR2_EXTERNAL_${externalName}_PATH)/${base}/${model.name}.mk`,
  };
}
async function safePath(root, relative) {
  const parts = relative.split("/");
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const stat = await fs.lstat(current).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (
      stat &&
      (stat.isSymbolicLink() ||
        (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))
    )
      fail("UNSAFE_PACKAGE_PATH");
  }
  return current;
}
async function readFile(root, relative) {
  await safePath(root, relative);
  const { readSafe } = require("./package-discovery.cjs");
  const bytes = await readSafe(root, relative).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  const before = bytes ? bytes.toString("utf8") : null;
  if (bytes && !Buffer.from(before, "utf8").equals(bytes))
    fail("PACKAGE_FILE_NOT_UTF8");
  return {
    path: relative,
    before,
    mode: bytes ? bytes.receipt.mode : 0o644,
    identity: bytes ? bytes.receipt.identity : null,
  };
}
async function assertBefore(root, expected) {
  const current = await readFile(root, expected.path);
  if (
    current.before !== expected.before ||
    current.mode !== expected.mode ||
    current.identity !== expected.identity
  )
    fail("REVISION_CONFLICT");
}
const append = (before, line) =>
  (before || "").split("\n").includes(line)
    ? before
    : (before || "") +
      (before && !before.endsWith("\n") ? "\n" : "") +
      line +
      "\n";
function createPackageAuthoringService({ resolveExternalTree, withLock }) {
  const admittedRoots = new Map();
  const samePath = (a, b) =>
    process.platform === "win32"
      ? path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase()
      : a === b;
  const rootIdentity = (stat) =>
    [stat.dev, stat.ino, stat.birthtimeNs].map(String).join(":");
  if (
    typeof resolveExternalTree !== "function" ||
    typeof withLock !== "function"
  )
    fail("INVALID_PACKAGE_ADAPTER");
  async function context(input, work) {
    const grant = await resolveExternalTree(
      input.workspaceId,
      input.externalTreeId,
    );
    if (grant?.granted !== true) fail("ROOT_NOT_GRANTED");
    if (typeof grant.root !== "string" || !path.isAbsolute(grant.root))
      fail("ROOT_NOT_GRANTED");
    const root = await fs.realpath(grant.root);
    if (!samePath(root, grant.root)) fail("ROOT_NOT_GRANTED");
    const stat = await fs.lstat(root, { bigint: true });
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (grant.identity &&
        (String(grant.identity.dev) !== String(stat.dev) ||
          String(grant.identity.ino) !== String(stat.ino)))
    )
      fail("ROOT_NOT_GRANTED");
    const fingerprint = rootIdentity(stat),
      key = JSON.stringify([input.workspaceId, input.externalTreeId, root]);
    if (admittedRoots.has(key) && admittedRoots.get(key) !== fingerprint)
      fail("ROOT_NOT_GRANTED");
    admittedRoots.set(key, fingerprint);
    const verify = async () => {
      const current = await fs.lstat(root, { bigint: true });
      if (
        !current.isDirectory() ||
        current.isSymbolicLink() ||
        rootIdentity(current) !== fingerprint ||
        !samePath(await fs.realpath(root), root)
      )
        fail("ROOT_NOT_GRANTED");
    };
    return withLock(root, async () => {
      await verify();
      const result = await work(root);
      await verify();
      return result;
    });
  }
  async function previewAt(root, model) {
    const desc = await readFile(root, "external.desc");
    if (desc.before === null) fail("EXTERNAL_TREE_REQUIRED");
    const matches = [...desc.before.matchAll(/^name:\s*([A-Za-z0-9_]+)\s*$/gm)];
    if (matches.length !== 1) fail("INVALID_EXTERNAL_DESCRIPTOR");
    const generated = renderPackage(model, matches[0][1]);
    const files = [];
    for (const [relative, after] of Object.entries(generated.files))
      files.push({ ...(await readFile(root, relative)), after });
    for (const [relative, line] of [
      ["Config.in", generated.configLine],
      ["external.mk", generated.makeLine],
    ]) {
      const before = await readFile(root, relative);
      if (before.before === null) fail("EXTERNAL_TREE_REQUIRED");
      const wildcard = `include $(sort $(wildcard $(BR2_EXTERNAL_${matches[0][1]}_PATH)/package/*/*.mk))`;
      files.push({
        ...before,
        after:
          relative === "external.mk" &&
          before.before
            .split("\n")
            .some((existing) => existing.trim() === wildcard)
            ? before.before
            : append(before.before, line),
      });
    }
    const packageDirectory = path.join(root, "package", model.name);
    const packageStat = await fs.lstat(packageDirectory).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (packageStat) {
      if (!packageStat.isDirectory() || packageStat.isSymbolicLink())
        fail("UNSAFE_PACKAGE_PATH");
      const {
        snapshotPackage,
        interpretRecipe,
      } = require("./package-discovery.cjs");
      const existing = await snapshotPackage(root, `package/${model.name}`);
      for (const file of files.filter((file) =>
        file.path.startsWith(`package/${model.name}/`),
      )) {
        const saved = existing.find(
          (item) => item.path === file.path.split("/").at(-1),
        );
        if (
          (file.before === null) !== !saved ||
          (saved &&
            (saved.sha256 !== digest(Buffer.from(file.before, "utf8")) ||
              saved.identity !== file.identity ||
              saved.mode !== file.mode))
        )
          fail("REVISION_CONFLICT");
      }
      if (
        existing.length &&
        !interpretRecipe(model.name, existing).roundTripAllowed
      )
        fail("PACKAGE_MANUAL_EDIT_REQUIRED");
    }
    for (const file of [desc, ...files]) await assertBefore(root, file);
    const revision = digest(
      JSON.stringify([
        desc,
        ...files.map(({ path, before, mode, identity }) => ({
          path,
          before,
          mode,
          identity,
        })),
      ]),
    );
    return {
      revision,
      previewHash: digest(JSON.stringify({ revision, files })),
      files,
      warnings: [
        "Generated recipes require review and actual Buildroot validation; dependency toolchain constraints are not inferred.",
        ...(model.buildSystem === "generic"
          ? [
              "Generic recipes contain metadata only; custom build/install commands require a separate reviewed workflow.",
            ]
          : []),
      ],
    };
  }
  async function previewInitializeAt(root, descriptor) {
    if (
      !descriptor ||
      typeof descriptor !== "object" ||
      Array.isArray(descriptor) ||
      Object.keys(descriptor).some(
        (key) => !["name", "description"].includes(key),
      )
    )
      fail("INVALID_EXTERNAL_DESCRIPTOR");
    token(
      descriptor.name,
      "INVALID_EXTERNAL_NAME",
      /^[A-Za-z][A-Za-z0-9_]{0,63}$/,
    );
    token(
      descriptor.description,
      "INVALID_EXTERNAL_DESCRIPTION",
      /^[A-Za-z0-9][A-Za-z0-9 .,_()+-]{0,79}$/,
    );
    const stat = await fs.stat(root, { bigint: true });
    const entries = await fs.readdir(root);
    if (entries.length) fail("EXTERNAL_DIRECTORY_NOT_EMPTY");
    const files = [
      {
        path: "external.desc",
        before: null,
        after: `name: ${descriptor.name}\ndesc: ${descriptor.description}\n`,
        mode: 0o644,
      },
      {
        path: "Config.in",
        before: null,
        after: "# External package configuration\n",
        mode: 0o644,
      },
      {
        path: "external.mk",
        before: null,
        after: `include $(sort $(wildcard $(BR2_EXTERNAL_${descriptor.name}_PATH)/package/*/*.mk))\n`,
        mode: 0o644,
      },
    ];
    const revision = digest(
      JSON.stringify({
        root,
        device: String(stat.dev),
        inode: String(stat.ino),
        birthtime: String(stat.birthtimeNs),
        entries,
      }),
    );
    return {
      revision,
      previewHash: digest(JSON.stringify({ revision, files })),
      externalName: descriptor.name,
      files,
      warnings: [
        "Creates an external tree skeleton; Buildroot runtime compatibility remains unverified.",
      ],
    };
  }
  async function atomic(
    root,
    relative,
    text,
    mode,
    noReplace = false,
    onPublished,
    beforePublish,
  ) {
    const file = await safePath(root, relative),
      temp = file + "." + randomUUID() + ".tmp";
    try {
      await fs.writeFile(temp, text, { flag: "wx", mode });
      await fs.chmod(temp, mode);
      if (beforePublish) await beforePublish();
      if (noReplace) {
        await fs.link(temp, file);
        await fs.rm(temp);
      } else await fs.rename(temp, file);
      if (onPublished) await onPublished();
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
  return {
    previewInitialize: (input) =>
      context(input, (root) => previewInitializeAt(root, input.descriptor)),
    applyInitialize: (input) =>
      context(input, async (root) => {
        const preview = await previewInitializeAt(root, input.descriptor);
        if (preview.revision !== input.revision) fail("REVISION_CONFLICT");
        if (preview.previewHash !== input.previewHash)
          fail("PACKAGE_PREVIEW_CONFLICT");
        const written = [];
        try {
          for (const file of preview.files) {
            await atomic(root, file.path, file.after, file.mode, true);
            written.push(file);
          }
        } catch (error) {
          let rollbackFailed = false;
          for (const file of written.reverse()) {
            try {
              const current = await readFile(root, file.path);
              if (current.before !== file.after) fail("REVISION_CONFLICT");
              const destination = await safePath(root, file.path);
              await assertBefore(root, current);
              await fs.rm(destination);
            } catch {
              rollbackFailed = true;
            }
          }
          if (rollbackFailed) fail("PACKAGE_ROLLBACK_FAILED");
          throw error;
        }
        return {
          initialized: true,
          externalName: preview.externalName,
          files: preview.files,
        };
      }),
    preview: (input) => context(input, (root) => previewAt(root, input.model)),
    apply: (input) =>
      context(input, async (root) => {
        const preview = await previewAt(root, input.model);
        if (input.revision !== preview.revision) fail("REVISION_CONFLICT");
        if (input.previewHash !== preview.previewHash)
          fail("PACKAGE_PREVIEW_CONFLICT");
        const created = [],
          written = [];
        try {
          for (const relative of ["package", `package/${input.model.name}`]) {
            const dir = path.join(root, relative);
            try {
              await fs.mkdir(dir);
              created.push(dir);
            } catch (error) {
              if (error.code !== "EEXIST") throw error;
            }
            await safePath(root, relative + "/Config.in");
          }
          for (const file of preview.files) {
            await assertBefore(root, file);
            await atomic(
              root,
              file.path,
              file.after,
              file.mode,
              file.before === null,
              async () => {
                written.push(file);
                const current = await readFile(root, file.path);
                if (current.before !== file.after)
                  fail("PACKAGE_SOURCE_CHANGED");
                file.publishedIdentity = current.identity;
              },
              () => assertBefore(root, file),
            );
          }
        } catch (error) {
          let rollbackFailed = false;
          for (const file of written.reverse())
            try {
              const current = await readFile(root, file.path);
              if (
                current.before !== file.after ||
                (file.publishedIdentity &&
                  current.identity !== file.publishedIdentity)
              )
                fail("REVISION_CONFLICT");
              if (file.before === null) {
                const destination = await safePath(root, file.path);
                await assertBefore(root, current);
                await fs.rm(destination);
              } else
                await atomic(
                  root,
                  file.path,
                  file.before,
                  file.mode,
                  false,
                  undefined,
                  () => assertBefore(root, current),
                );
            } catch {
              rollbackFailed = true;
            }
          for (const dir of created.reverse())
            try {
              await fs.rmdir(dir);
            } catch {
              rollbackFailed = true;
            }
          if (rollbackFailed) fail("PACKAGE_ROLLBACK_FAILED");
          throw error;
        }
        return { applied: true, ...(await previewAt(root, input.model)) };
      }),
  };
}
module.exports = {
  validateAuthoringModel,
  renderPackage,
  createPackageAuthoringService,
};
