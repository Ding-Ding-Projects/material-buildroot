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
const formats = {
  images: { png: "imagemagick", jpg: "imagemagick", webp: "imagemagick" },
  audio: { mp3: "ffmpeg", wav: "ffmpeg", flac: "ffmpeg" },
  video: { mp4: "ffmpeg", webm: "ffmpeg" },
  documents: {
    pdf: "libreoffice",
    docx: "pandoc",
    html: "pandoc",
    epub: "pandoc",
  },
  archives: { zip: "archive" },
  structured: { json: "native", csv: "native" },
  text: { txt: "native" },
  binary: { base64: "native", hex: "native" },
};
function signature(bytes, format) {
  if (format === "png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (format === "jpg") return bytes[0] === 255 && bytes[1] === 216;
  if (format === "pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (format === "webp")
    return (
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP"
    );
  if (format === "zip" || format === "docx" || format === "epub")
    return bytes.subarray(0, 2).toString() === "PK";
  if (format === "mp4") return bytes.subarray(4, 8).toString() === "ftyp";
  if (format === "webm")
    return bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  if (format === "wav") return bytes.subarray(0, 4).toString() === "RIFF";
  if (format === "flac") return bytes.subarray(0, 4).toString() === "fLaC";
  if (format === "mp3")
    return (
      bytes.subarray(0, 3).toString() === "ID3" ||
      (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  return false;
}
function createConverter(options) {
  return {
    catalog: () =>
      Object.entries(formats).map(([category, targets]) => ({
        category,
        formats: Object.entries(targets).map(([format, adapter]) => ({
          format,
          adapter,
          available: adapter === "native",
          reason:
            adapter === "native"
              ? undefined
              : "Requires packaged adapter and isolated runtime verification",
        })),
      })),
    async convert(request, context) {
      const adapter = formats[request.category]?.[request.format];
      if (!adapter) fail("UNSUPPORTED_FORMAT");
      const source = await grant(options, request.sourceId, "read"),
        destination = await grant(options, request.destinationId, "write");
      if (source === destination) fail("INPUT_OVERWRITE_FORBIDDEN");
      const stat = await fs.stat(source);
      if (!stat.isFile() || stat.size > 64 * 1024 * 1024) fail("INPUT_LIMIT");
      const temporary = path.join(
        path.dirname(destination),
        ".conversion-" + randomUUID() + "." + request.format,
      );
      try {
        if (adapter === "native") {
          const bytes = await fs.readFile(source);
          if (context.signal?.aborted) fail("CANCELLED");
          let output;
          if (request.category === "binary")
            output = bytes.toString(request.format);
          else {
            const input = new TextDecoder("utf-8", { fatal: true }).decode(
              bytes,
            );
            if (request.format === "json")
              output = JSON.stringify(JSON.parse(input), null, 2);
            else if (request.format === "csv") {
              if (!input.includes(",") || input.includes("\0"))
                fail("UNSUPPORTED_SOURCE");
              output = input;
            } else output = input;
          }
          await fs.writeFile(temporary, output, { flag: "wx", mode: 0o600 });
        } else {
          const file = await executable(options, adapter);
          if (!options.isolationVerified) fail("ISOLATED_RUNTIME_REQUIRED");
          let args;
          if (adapter === "ffmpeg")
            args = [
              "-nostdin",
              "-n",
              "-i",
              source,
              "-map_metadata",
              "0",
              temporary,
            ];
          else if (adapter === "imagemagick")
            args = [
              source,
              "-limit",
              "memory",
              "128MiB",
              "-limit",
              "disk",
              "256MiB",
              temporary,
            ];
          else if (adapter === "pandoc")
            args = ["--sandbox", source, "-o", temporary];
          else fail("ADAPTER_RUNTIME_UNAVAILABLE");
          await processRun(file, args, context);
        }
        const out = await fs.stat(temporary);
        if (!out.isFile() || out.size === 0 || out.size > 128 * 1024 * 1024)
          fail("INVALID_OUTPUT");
        if (adapter !== "native") {
          const handle = await fs.open(temporary, "r");
          const bytes = Buffer.alloc(16);
          try {
            await handle.read(bytes, 0, 16, 0);
          } finally {
            await handle.close();
          }
          if (!signature(bytes, request.format)) fail("OUTPUT_TYPE_MISMATCH");
        }
        const sha256 = await digest(temporary);
        await fs.link(temporary, destination);
        return { bytes: out.size, sha256, format: request.format };
      } finally {
        await fs.rm(temporary, { force: true });
      }
    },
  };
}
module.exports = { createConverter, formats, signature };
