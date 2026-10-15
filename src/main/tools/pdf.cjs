"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  fail,
  grant,
  executable,
  processRun,
  digest,
} = require("./runtime.cjs");
function pageSelection(value, count) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 10000 ||
    value.some((page) => !Number.isInteger(page) || page < 1 || page > count)
  )
    fail("INVALID_PAGE_SELECTION");
  return value.join(",");
}
async function pdfService(options, request, context) {
  const command = await executable(options, "qpdf");
  if (!options.isolationVerified) fail("ISOLATED_RUNTIME_REQUIRED");
  const ids = request.sourceIds || [request.sourceId];
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100)
    fail("INPUT_LIMIT");
  const sources = await Promise.all(
    ids.map((id) => grant(options, id, "read")),
  );
  if (!sources.length || sources.length > 100) fail("INPUT_LIMIT");
  const counts = [];
  for (const source of sources) {
    const stat = await fs.stat(source);
    if (!stat.isFile() || stat.size > 128 * 1024 * 1024) fail("INPUT_LIMIT");
    const handle = await fs.open(source, "r");
    const signature = Buffer.alloc(5);
    try {
      await handle.read(signature, 0, 5, 0);
    } finally {
      await handle.close();
    }
    if (signature.toString() !== "%PDF-") fail("UNSUPPORTED_SOURCE");
    await processRun(command, ["--check", source], context);
    const info = await processRun(command, ["--show-npages", source], context);
    const pages = Number(info.stdout.trim());
    if (!Number.isInteger(pages) || pages < 1 || pages > 10000)
      fail("PDF_PAGE_LIMIT");
    counts.push(pages);
  }
  if (request.operation === "inspect")
    return { pageCounts: counts, encryptedOrInvalid: false };
  const destination = await grant(options, request.destinationId, "write");
  if (sources.includes(destination)) fail("INPUT_OVERWRITE_FORBIDDEN");
  const temporary = path.join(
    path.dirname(destination),
    ".pdf-" + randomUUID() + ".pdf",
  );
  let args,
    expected = counts[0];
  switch (request.operation) {
    case "merge":
      args = [
        "--empty",
        "--pages",
        ...sources.flatMap((source) => [source, "1-z"]),
        "--",
        temporary,
      ];
      expected = counts.reduce((a, b) => a + b, 0);
      break;
    case "split":
    case "extract":
    case "reorder":
      if (sources.length !== 1) fail("INVALID_REQUEST");
      {
        const pages = pageSelection(request.pages, counts[0]);
        args = [sources[0], "--pages", ".", pages, "--", temporary];
        expected = request.pages.length;
      }
      break;
    case "rotate":
      if (![90, 180, 270].includes(request.degrees)) fail("INVALID_ROTATION");
      args = [
        sources[0],
        "--rotate=+" +
          request.degrees +
          ":" +
          pageSelection(request.pages, counts[0]),
        temporary,
      ];
      break;
    case "metadata":
      if (request.mode !== "remove") fail("UNSUPPORTED_METADATA_MODE");
      args = [sources[0], "--remove-info", "--remove-metadata", temporary];
      break;
    default:
      fail("UNSUPPORTED_PDF_OPERATION");
  }
  try {
    await processRun(command, args, context);
    await processRun(command, ["--check", temporary], context);
    const actual = await processRun(
      command,
      ["--show-npages", temporary],
      context,
    );
    if (Number(actual.stdout.trim()) !== expected)
      fail("PDF_OUTPUT_PAGE_MISMATCH");
    const stat = await fs.stat(temporary);
    if (stat.size > 256 * 1024 * 1024) fail("OUTPUT_LIMIT");
    const sha256 = await digest(temporary);
    await fs.link(temporary, destination);
    return {
      pages: expected,
      bytes: stat.size,
      sha256,
      operation: request.operation,
    };
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
module.exports = { pdfService, pageSelection };
