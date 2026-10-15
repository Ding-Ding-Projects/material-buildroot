"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const MarkdownIt = require("markdown-it");
const { parse } = require("../security/workspace-contract.cjs");
const FORMAT = "material-buildroot-documentation";
const HASH = /^[0-9a-f]{64}$/;
const DOC = /^doc-[0-9a-f]{64}$/;
const MAX_ARTICLE = 512 * 1024,
  MAX_ASSET = 8 * 1024 * 1024,
  MAX_TOTAL = 64 * 1024 * 1024;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fail(code) {
  const error = new Error("Offline documentation is unavailable.");
  error.code = code;
  throw error;
}
function exact(value, keys) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail("INVALID_REQUEST");
  for (const key of Reflect.ownKeys(value))
    if (
      !keys.includes(key) ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")
    )
      fail("INVALID_REQUEST");
}
function text(value, max = 4096) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    Buffer.from(value).toString("utf8") !== value ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    fail("INVALID_BUNDLE");
  return value;
}
function sourcePath(value) {
  text(value);
  if (
    !value ||
    /[\\:]/.test(value) ||
    path.posix.isAbsolute(value) ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  )
    fail("INVALID_BUNDLE");
  return value;
}
function resolveReference(source, reference) {
  const decoded = decodeURIComponent(reference);
  if (
    !decoded ||
    /[\\:\x00-\x1f\x7f?]/.test(decoded) ||
    path.posix.isAbsolute(decoded)
  )
    throw Error("Unsafe reference");
  const selected = path.posix.normalize(
    path.posix.join(path.posix.dirname(source), decoded),
  );
  if (selected === ".." || selected.startsWith("../"))
    throw Error("Escaping reference");
  return selected;
}
function safeHttps(reference) {
  try {
    if (
      typeof reference !== "string" ||
      reference.length > 4096 ||
      /[\x00-\x20\x7f\\]/.test(reference)
    )
      return null;
    const url = new URL(reference);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function slug(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "heading"
  );
}
function headingMetadata(tokens) {
  const used = new Map(),
    headings = [];
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type !== "heading_open") continue;
    const label = tokens[index + 1]?.content || "";
    const base = slug(label),
      count = used.get(base) || 0;
    used.set(base, count + 1);
    const id = base + (count ? `-${count}` : "");
    tokens[index].attrSet("id", id);
    headings.push({
      id,
      text: label,
      level: Number(tokens[index].tag.slice(1)),
    });
  }
  return headings;
}
/** Shared renderer for admitted prose. Raw HTML and all automatic network loads are disabled. */
function renderMarkdown(
  markdown,
  { source = "README.md", documents = [], assets = [] } = {},
) {
  if (typeof markdown !== "string" || Buffer.byteLength(markdown) > MAX_ARTICLE)
    fail("INVALID_REQUEST");
  sourcePath(source);
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
    breaks: false,
  });
  const tokens = md.parse(markdown, {});
  const headings = headingMetadata(tokens);
  const bySource = new Map(documents.map((item) => [item.source, item]));
  if (!bySource.has(source))
    bySource.set(source, {
      id: `doc-${digest(source)}`,
      source,
      anchors: headings.map((item) => item.id),
    });
  const byAsset = new Map(assets.map((item) => [item.source, item]));
  const issues = [],
    links = [];
  const esc = md.utils.escapeHtml;
  function issue(reference, reason) {
    issues.push({
      source,
      reference: String(reference).slice(0, 4096),
      reason,
    });
  }
  const defaultLink =
    md.renderer.rules.link_open ||
    ((all, index, options, env, self) => self.renderToken(all, index, options));
  md.renderer.rules.link_open = (all, index, options, env, self) => {
    const token = all[index],
      reference = token.attrGet("href") || "";
    const external = safeHttps(reference);
    token.attrs = [];
    token.attrSet("href", "#");
    if (external) {
      const id = `link-${digest(source + "\0" + external)}`;
      if (!links.some((item) => item.id === id))
        links.push({ id, url: external });
      token.attrSet("data-document-link-id", id);
      token.attrSet(
        "title",
        `External HTTPS link on ${new URL(external).hostname}`,
      );
      return defaultLink(all, index, options, env, self);
    }
    try {
      const hash = reference.indexOf("#");
      const file = hash < 0 ? reference : reference.slice(0, hash),
        anchor = hash < 0 ? "" : decodeURIComponent(reference.slice(hash + 1));
      const selected = file ? resolveReference(source, file) : source;
      const target = bySource.get(selected);
      if (
        !target ||
        !Array.isArray(target.anchors) ||
        (anchor && !target.anchors.includes(anchor))
      )
        throw Error("Missing target");
      token.attrSet("data-document-id", target.id);
      if (anchor) token.attrSet("data-document-anchor", anchor);
    } catch {
      issue(reference, "Unresolved or unsafe documentation link");
      token.attrSet("aria-disabled", "true");
      token.attrSet("data-document-unavailable", "true");
    }
    return defaultLink(all, index, options, env, self);
  };
  md.renderer.rules.image = (all, index, options, env, self) => {
    const token = all[index],
      reference = token.attrGet("src") || "",
      alt = self.renderInlineAsText(token.children || [], options, env);
    try {
      const selected = resolveReference(source, reference);
      const asset = byAsset.get(selected);
      if (
        !asset ||
        !/^assets\/[0-9a-f]{64}\.(?:png|jpg|webp)$/.test(asset.file)
      )
        throw Error("Missing image");
      return `<img src="documentation/${esc(asset.file)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
    } catch {
      issue(
        reference,
        "Image is unavailable offline or uses an unsupported format",
      );
      return `<span class="documentation-image-unavailable" role="img" aria-label="${esc(alt || "Unavailable image")}">[Image unavailable: ${esc(alt || reference)}]</span>`;
    }
  };
  const html = md.renderer.render(tokens, md.options, {});
  return { html, headings, links, issues };
}
function imageMime(bytes, extension) {
  if (
    extension === "png" &&
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    extension === "jpg" &&
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    extension === "webp" &&
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}
function createDocumentationService({ directory, openExternal } = {}) {
  if (
    typeof directory !== "string" ||
    !path.isAbsolute(directory) ||
    path.resolve(directory) !== directory ||
    (openExternal !== undefined && typeof openExternal !== "function")
  )
    throw new TypeError("A host-owned documentation directory is required.");
  function bytes(relative, max) {
    sourcePath(relative);
    let cursor = directory;
    for (const part of [".", ...relative.split("/")]) {
      if (part !== ".") cursor = path.join(cursor, part);
      const info = fs.lstatSync(cursor);
      if (info.isSymbolicLink() || fs.realpathSync.native(cursor) !== cursor)
        fail("INVALID_BUNDLE");
    }
    const info = fs.lstatSync(cursor);
    if (!info.isFile() || info.nlink !== 1 || info.size > max)
      fail("INVALID_BUNDLE");
    const fd = fs.openSync(
      cursor,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    try {
      const opened = fs.fstatSync(fd);
      if (
        opened.dev !== info.dev ||
        opened.ino !== info.ino ||
        opened.nlink !== 1 ||
        opened.size > max
      )
        fail("INVALID_BUNDLE");
      const data = fs.readFileSync(fd);
      if (data.length > max) fail("INVALID_BUNDLE");
      return data;
    } finally {
      fs.closeSync(fd);
    }
  }
  function manifest() {
    const raw = bytes("index.json", 1024 * 1024);
    if (!Buffer.from(raw.toString("utf8")).equals(raw)) fail("INVALID_BUNDLE");
    const value = parse(raw.toString("utf8"));
    exact(value, [
      "format",
      "version",
      "sourceSnapshot",
      "documents",
      "assets",
      "issues",
    ]);
    if (
      value.format !== FORMAT ||
      value.version !== 1 ||
      !HASH.test(value.sourceSnapshot) ||
      !Array.isArray(value.documents) ||
      value.documents.length > 1000 ||
      !Array.isArray(value.assets) ||
      value.assets.length > 1000 ||
      !Array.isArray(value.issues) ||
      value.issues.length > 10000
    )
      fail("INVALID_BUNDLE");
    const ids = new Set(),
      sources = new Set(),
      files = new Set();
    let total = raw.length;
    for (const article of value.documents) {
      exact(article, [
        "id",
        "source",
        "file",
        "title",
        "category",
        "language",
        "summary",
        "sha256",
        "bytes",
        "anchors",
      ]);
      sourcePath(article.source);
      if (
        !DOC.test(article.id) ||
        article.id !== `doc-${digest(article.source)}` ||
        article.file !== `articles/${article.id}.md` ||
        !HASH.test(article.sha256) ||
        !Number.isSafeInteger(article.bytes) ||
        article.bytes < 0 ||
        article.bytes > MAX_ARTICLE ||
        !Array.isArray(article.anchors) ||
        article.anchors.length > 5000 ||
        new Set(article.anchors).size !== article.anchors.length ||
        ids.has(article.id) ||
        sources.has(article.source) ||
        files.has(article.file)
      )
        fail("INVALID_BUNDLE");
      for (const key of ["title", "category", "language", "summary"])
        text(article[key], key === "summary" ? 500 : 240);
      for (const anchor of article.anchors)
        if (
          typeof anchor !== "string" ||
          !/^[\p{L}\p{N}_-]{1,512}$/u.test(anchor)
        )
          fail("INVALID_BUNDLE");
      ids.add(article.id);
      sources.add(article.source);
      files.add(article.file);
      total += article.bytes;
    }
    const assetSources = new Set();
    for (const asset of value.assets) {
      exact(asset, ["source", "file", "sha256", "bytes", "mime"]);
      sourcePath(asset.source);
      const match = /^assets\/([0-9a-f]{64})\.(png|jpg|webp)$/.exec(asset.file);
      if (
        !match ||
        match[1] !== asset.sha256 ||
        !Number.isSafeInteger(asset.bytes) ||
        asset.bytes < 1 ||
        asset.bytes > MAX_ASSET ||
        !["image/png", "image/jpeg", "image/webp"].includes(asset.mime) ||
        assetSources.has(asset.source) ||
        sources.has(asset.source)
      )
        fail("INVALID_BUNDLE");
      assetSources.add(asset.source);
      total += asset.bytes;
    }
    if (total > MAX_TOTAL) fail("INVALID_BUNDLE");
    for (const item of value.issues) {
      exact(item, ["source", "reference", "reason"]);
      sourcePath(item.source);
      text(item.reference);
      text(item.reason, 240);
    }
    return value;
  }
  function verify(record, max) {
    const value = bytes(record.file, max);
    if (value.length !== record.bytes || digest(value) !== record.sha256)
      fail("CORRUPT_BUNDLE");
    return value;
  }
  function articleText(article) {
    const value = verify(article, MAX_ARTICLE);
    const selected = value.toString("utf8");
    if (!Buffer.from(selected).equals(value)) fail("CORRUPT_BUNDLE");
    return selected;
  }
  function verifySnapshot(index) {
    const entries = [];
    for (const article of index.documents) {
      const value = verify(article, MAX_ARTICLE);
      const selected = value.toString("utf8");
      if (!Buffer.from(selected).equals(value)) fail("CORRUPT_BUNDLE");
      entries.push([article.source, value]);
    }
    for (const asset of index.assets) {
      const value = verify(asset, MAX_ASSET);
      if (imageMime(value, asset.file.split(".").at(-1)) !== asset.mime)
        fail("CORRUPT_BUNDLE");
      entries.push([asset.source, value]);
    }
    const aggregate = createHash("sha256");
    for (const [source, value] of entries.sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    )) {
      aggregate
        .update(source + "\0")
        .update(value)
        .update("\0");
    }
    if (aggregate.digest("hex") !== index.sourceSnapshot)
      fail("CORRUPT_BUNDLE");
  }
  function metadata(article) {
    return {
      id: article.id,
      title: article.title,
      category: article.category,
      language: article.language,
      summary: article.summary,
    };
  }
  function navigation(index, headings = []) {
    const categories = [];
    for (const article of index.documents) {
      let category = categories.find((item) => item.name === article.category);
      if (!category) {
        category = { name: article.category, articles: [] };
        categories.push(category);
      }
      category.articles.push({ id: article.id, title: article.title });
    }
    return { categories, headings };
  }
  function readInternal(input) {
    exact(input, ["id"]);
    if (typeof input.id !== "string" || !DOC.test(input.id))
      fail("INVALID_REQUEST");
    const index = manifest();
    verifySnapshot(index);
    const article = index.documents.find((item) => item.id === input.id);
    if (!article) fail("NOT_FOUND");
    const rendered = renderMarkdown(articleText(article), {
      source: article.source,
      documents: index.documents,
      assets: index.assets,
    });
    if (
      JSON.stringify(rendered.headings.map((item) => item.id)) !==
      JSON.stringify(article.anchors)
    )
      fail("CORRUPT_BUNDLE");
    return { index, article, rendered };
  }
  function safe(method) {
    return (...args) => {
      try {
        return method(...args);
      } catch (error) {
        if (error.message === "Offline documentation is unavailable.")
          throw error;
        fail("INVALID_BUNDLE");
      }
    };
  }
  return Object.freeze({
    list: safe(() => {
      const index = manifest();
      verifySnapshot(index);
      return {
        articles: index.documents.map(metadata),
        navigation: navigation(index),
        issues: index.issues,
        complete: index.issues.length === 0,
      };
    }),
    read: safe((input) => {
      const { index, article, rendered } = readInternal(input);
      const issues = [...index.issues, ...rendered.issues];
      return {
        article: metadata(article),
        html: rendered.html,
        navigation: navigation(index, rendered.headings),
        issues,
        complete: issues.length === 0,
      };
    }),
    async open(input) {
      try {
        exact(input, ["id", "linkId"]);
        if (
          typeof input.linkId !== "string" ||
          !/^link-[0-9a-f]{64}$/.test(input.linkId)
        )
          fail("INVALID_REQUEST");
        const { rendered } = readInternal({ id: input.id });
        const link = rendered.links.find((item) => item.id === input.linkId);
        if (!link || !safeHttps(link.url)) fail("LINK_NOT_ALLOWED");
        if (!openExternal) fail("EXTERNAL_UNAVAILABLE");
        await openExternal(link.url);
        return { opened: true };
      } catch (error) {
        if (error.message === "Offline documentation is unavailable.")
          throw error;
        fail("EXTERNAL_UNAVAILABLE");
      }
    },
  });
}
module.exports = {
  createDocumentationService,
  renderMarkdown,
  headingMetadata,
  imageMime,
  MAX_ARTICLE,
  MAX_ASSET,
  MAX_TOTAL,
  FORMAT,
};
