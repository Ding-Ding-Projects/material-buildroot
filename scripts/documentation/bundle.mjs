import { execFileSync } from 'node:child_process';
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import { documentSources, categoryFor } from "../../website/inventory.mjs";
import {
  indexedSources,
  admittedSource,
  containedPath,
  resolveDocumentLink,
  sourceSnapshot,
} from "../../website/source-boundary.mjs";
const require = createRequire(import.meta.url);
const {
  createDocumentationService,
  renderMarkdown,
  headingMetadata,
  imageMime,
  jsonReferenceText,
  referencePages,
  MAX_ARTICLE,
  MAX_ASSET,
  MAX_TOTAL,
  FORMAT,
} = require("../../src/main/documentation/service.cjs");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function utf8(bytes) {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes))
    throw Error("Documentation source is not valid UTF-8.");
  return text;
}
function boundedRead(file, max) {
  const info = fs.lstatSync(file);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||
    info.size > max
  )
    throw Error("Documentation input is not a bounded regular file.");
  const bytes = fs.readFileSync(file);
  if (bytes.length > max)
    throw Error("Documentation input exceeds its size bound.");
  return bytes;
}
function normalizedText(value, max) {
  return value
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
/** Bundle only the indexed canonical public inventory. No input or asset is fetched. */
export async function bundleDocumentation({ root, output }) {
  root = path.resolve(root);
  output = path.resolve(output);
  if (output === root || root.startsWith(output + path.sep))
    throw Error("Documentation output must not replace source.");
  containedPath(path.dirname(output), path.basename(output));
  const index = indexedSources(root);
  const releases = JSON.parse(fs.readFileSync(path.join(root, 'src/main/documentation/releases.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (releases.version !== 1 || !Array.isArray(releases.entries)) throw Error('Release inventory is invalid.');
  for (const entry of releases.entries) {
    if (!/^[0-9a-f]{40}$/.test(entry.source)) throw Error('Release source is invalid.');
    execFileSync('git', ['cat-file', '-e', entry.source + '^{commit}'], {cwd:root,stdio:'pipe'});
  }
  const prefix = path.relative(root, output).split(path.sep).join("/");
  if (
    [...index].some(
      (source) => source === prefix || source.startsWith(prefix + "/"),
    )
  )
    throw Error("Documentation output contains indexed source.");
  if (fs.existsSync(output) && fs.readdirSync(output).length)
    throw Error(
      "Documentation output must be a new or empty staging directory.",
    );
  const sources = await documentSources(root, index);
  if (sources.length > 1000)
    throw Error("Documentation article limit exceeded.");
  const documents = [],
    contents = new Map(),
    parsed = new Map();
  const md = new MarkdownIt({ html: false, linkify: false });
  let total = 0, referenceViews = 0;
  for (const source of sources) {
    const bytes = boundedRead(admittedSource(root, source, index), MAX_ARTICLE);
    total += bytes.length;
    if (total > MAX_TOTAL)
      throw Error("Documentation bundle exceeds its total size limit.");
    const content = utf8(bytes),
      tokens = md.parse(content, {}),
      headings = headingMetadata(tokens);
    const summaryToken = tokens.find(
      (token, i) =>
        token.type === "inline" && tokens[i - 1]?.type === "paragraph_open",
    );
    const id = `doc-${hash(source)}`;
    documents.push({
      id,
      source,
      file: `articles/${id}.md`,
      title: normalizedText(headings[0]?.text || source, 240),
      category: categoryFor(source),
      language: /\.(?:zh|zh-HK)\.md$/i.test(source) ? "zh-HK" : "en",
      summary: normalizedText(summaryToken?.content || "", 500),
      sha256: hash(bytes),
      bytes: bytes.length,
      anchors: headings.map((item) => item.id),
    });
    contents.set(source, bytes);
    parsed.set(source, tokens);
  }
  const assets = [], references = [],
    assetSources = new Set(),
    referenceSources = new Set(),
    issues = [];
  function admitImage(selected) {
    if (!/\.(png|jpe?g|webp)$/i.test(selected)) throw Error("Unsupported image format");
    if (assetSources.has(selected)) return assets.find((asset) => asset.source === selected);
    const bytes = boundedRead(admittedSource(root, selected, index), MAX_ASSET);
    const extension = /\.jpe?g$/i.test(selected) ? "jpg" : selected.split(".").at(-1).toLowerCase();
    const mime = imageMime(bytes, extension);
    if (!mime) throw Error("Invalid image signature");
    total += bytes.length;
    if (total > MAX_TOTAL) throw Error("Documentation bundle exceeds its total size limit.");
    const sha256 = hash(bytes);
    const asset = { source: selected, file: `assets/${sha256}.${extension}`, sha256, bytes: bytes.length, mime };
    assetSources.add(selected);
    assets.push(asset);
    contents.set(selected, bytes);
    return asset;
  }
  for (const document of documents) {
    const walk = (tokens) => {
      for (const token of tokens) {
        if (token.type === "image") {
          const reference = token.attrGet("src") || "";
          let selected;
          try {
            selected = resolveDocumentLink(document.source, reference);
            admitImage(selected);
          } catch (error) {
            if (
              error.message ===
              "Documentation bundle exceeds its total size limit."
            )
              throw error;
            issues.push({
              source: document.source,
              reference: reference.slice(0, 4096),
              reason:
                "Image is missing, unindexed, unsafe or unsupported offline",
            });
          }
        }
        if (token.type === "link_open") {
          const reference = token.attrGet("href") || "";
          try {
            const selected = resolveDocumentLink(document.source, reference.split("#")[0]);
            if (!/\.(?:json|png|jpe?g|webp)$/i.test(selected) || referenceSources.has(selected)) continue;
            const id = `doc-${hash(selected)}`;
            let record;
            if (/\.json$/i.test(selected)) {
              const bytes = boundedRead(admittedSource(root, selected, index), MAX_ASSET);
              const pageCount = referencePages(jsonReferenceText(bytes)).length;
              referenceViews += pageCount;
              total += bytes.length;
              if (total > MAX_TOTAL) throw Error("Documentation bundle exceeds its total size limit.");
              record = { source: selected, file: `references/${id}.json`, sha256: hash(bytes), bytes: bytes.length, kind: "json" };
              contents.set(selected, bytes);
            } else {
              const asset = admitImage(selected);
              record = { source: selected, file: asset.file, sha256: asset.sha256, bytes: asset.bytes, kind: "image" };
              referenceViews++;
            }
            references.push({
              id, ...record,
              title: normalizedText(path.posix.basename(selected), 240),
              category: "Source references", language: "en",
              summary: record.kind === "json" ? "Bundled JSON source reference, shown in complete numbered pages." : "Bundled image source reference.",
            });
            referenceSources.add(selected);
          } catch (error) {
            if (error.message === "Documentation bundle exceeds its total size limit.") throw error;
            // The normal renderer records the unresolved link without admitting unsafe bytes.
          }
        }
        if (token.children) walk(token.children);
      }
    };
    walk(parsed.get(document.source));
  }
  if (assets.length > 1000) throw Error("Documentation image limit exceeded.");
  if (documents.length + references.length > 1000) throw Error("Documentation article limit exceeded.");
  if (documents.length + referenceViews > 1000) throw Error("Documentation reader page limit exceeded.");
  for (const document of documents) {
    const rendered = renderMarkdown(utf8(contents.get(document.source)), {
      source: document.source,
      documents,
      assets,
      references,
    });
    issues.push(...rendered.issues);
  }
  const uniqueIssues = [
    ...new Map(issues.map((issue) => [JSON.stringify(issue), issue])).values(),
  ];
  if (uniqueIssues.length > 10000)
    throw Error("Documentation issue limit exceeded.");
  const admitted = [...new Set([...sources, ...assetSources, ...referenceSources])].sort();
  const manifest = {
    format: FORMAT,
    version: 1,
    sourceSnapshot: sourceSnapshot(root, admitted, index),
    documents,
    assets,
    references,
    issues: uniqueIssues,
  };
  const captured = createHash("sha256");
  for (const source of admitted)
    captured
      .update(source + "\0")
      .update(contents.get(source))
      .update("\0");
  if (captured.digest("hex") !== manifest.sourceSnapshot)
    throw Error("Documentation source changed while bundling.");
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  if (
    manifestBytes.length > 1024 * 1024 ||
    total + manifestBytes.length > MAX_TOTAL
  )
    throw Error("Documentation manifest exceeds its size limit.");
  const staging = `${output}.${randomUUID()}.tmp`;
  try {
    fs.mkdirSync(staging, { recursive: true, mode: 0o700 });
    for (const record of [...documents, ...assets, ...references.filter((record) => record.kind === "json")]) {
      const destination = containedPath(staging, record.file);
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      fs.writeFileSync(destination, contents.get(record.source), {
        mode: 0o600,
      });
    }
    fs.writeFileSync(path.join(staging, "index.json"), manifestBytes, {
      mode: 0o600,
    });
    createDocumentationService({ directory: staging }).list();
    if (fs.existsSync(output)) fs.rmdirSync(output);
    fs.renameSync(staging, output);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return {
    documents: documents.length,
    assets: assets.length,
    references: references.length,
    issues: uniqueIssues.length,
    complete: uniqueIssues.length === 0,
    sourceSnapshot: manifest.sourceSnapshot,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--root" || args[2] !== "--output")
    throw Error(
      "Use --root <repository> --output <empty-generated-directory>.",
    );
  const result = await bundleDocumentation({ root: args[1], output: args[3] });
  process.stdout.write(JSON.stringify(result) + "\n");
}
