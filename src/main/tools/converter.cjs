"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  fail,
  grant,
  digest,
} = require("./runtime.cjs");
const { isNativeFileBroker } = require("../security/native-file-broker.cjs");
const isolatedFormats = {images:["png","jpg","webp"],audio:["wav","mp3","flac"]};
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
  archives: { zip: "tar" },
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
  if (format === "html") return /<(?:!doctype|html|head|body|p|h[1-6])/i.test(bytes.toString());
  return false;
}
function createConverter(options) {
  const active = new Set();
  async function isolatedRun(broker,request,context) {
    const controller=new AbortController();
    const abort=()=>controller.abort();
    context.signal?.addEventListener("abort",abort,{once:true});
    if(context.signal?.aborted)controller.abort();
    active.add(controller);
    try {return await broker.run(request,{...context,signal:controller.signal});}
    finally {active.delete(controller);context.signal?.removeEventListener("abort",abort);}
  }
  return {
    cancel() {const count=active.size;for(const controller of active)controller.abort();return {requested:count};},
    async catalog() {
      const categories = [];
      const admissionCache = new Map();
      for (const [category, targets] of Object.entries(formats)) {
        const entries = [];
        for (const [format, adapter] of Object.entries(targets)) {
          const available = adapter === "native";
          let attemptAvailable = false, reason;
          if (!available) {
            try {
              if (!isolatedFormats[category]?.includes(format)) fail("NATIVE_FORMAT_NOT_SUPPORTED");
              let admission=admissionCache.get(adapter);
              if(!admission){
                admission=(async()=>{
                  const record=await options.payloadManager?.resolve(adapter);
                  if(!record?.bundled)fail("BUNDLED_ADAPTER_REQUIRED");
                  if(!isNativeFileBroker(options.nativeFileBroker)||typeof options.nativeFileBroker.describe!=="function")fail(options.nativeFileBrokerError||"NATIVE_BROKER_UNAVAILABLE");
                  return options.nativeFileBroker.describe(adapter);
                })();
                admissionCache.set(adapter,admission);
              }
              const description=await admission;
              attemptAvailable = description?.attemptAvailable === true && description.formats?.includes(format) && description.runtimeAcceptance === "unverified" && description.mechanism === "appcontainer-handle-job";
              reason = attemptAvailable ? "ISOLATED_ATTEMPT_UNVERIFIED" : description?.reason || "NATIVE_BROKER_UNAVAILABLE";
            } catch (error) { reason = /^[A-Z_]+$/.test(error.code || "") ? error.code : "BUNDLED_ADAPTER_REQUIRED"; }
          }
          entries.push({format, adapter, available, attemptAvailable, runtimeVerified:false, reason,
            disclosure: category === "binary" ? "Encodes every input byte as text."
              : category === "structured" ? "JSON and CSV tables only. CSV loses value types. Nested values and spreadsheet formulas are rejected."
              : category === "text" ? "Strict UTF-8 only. Line endings are preserved."
              : "The target may omit metadata, fonts, layers, animation, transparency or precision."});
        }
        categories.push({category, formats: entries});
      }
      return categories;
    },
    async inspect(request) {
      const source = await grant(options,request.sourceId,"read"), stat = await fs.stat(source);
      if (!stat.isFile() || stat.size > 64 * 1024 * 1024) fail("INPUT_LIMIT");
      const handle=await fs.open(source,"r"), sample=Buffer.alloc(Math.min(stat.size,65536));
      try {await handle.read(sample,0,sample.length,0);} finally {await handle.close();}
      let detected=["png","jpg","pdf","webp","zip","mp4","webm","wav","flac","mp3"].find(f=>signature(sample,f));
      let text=false;
      if(!detected)try{new TextDecoder("utf-8",{fatal:true}).decode(sample,{stream:stat.size>sample.length});text=!sample.includes(0);}catch{}
      detected ||= text?"utf8-text":"binary";
      return {bytes:stat.size,detected,sampledBytes:sample.length,complete:stat.size===sample.length,
        nativeCategories:text?["structured","text","binary"]:["binary"]};
    },
    async convert(request, context) {
      const adapter = formats[request.category]?.[request.format];
      if (!adapter) fail("UNSUPPORTED_FORMAT");
      const source = await grant(options, request.sourceId, "read"),
        destination = await grant(options, request.destinationId, "write");
      if (source === destination) fail("INPUT_OVERWRITE_FORBIDDEN");
      const stat = await fs.stat(source);
      if (!stat.isFile() || stat.size > 64 * 1024 * 1024) fail("INPUT_LIMIT");
      const capacity = await fs.statfs(path.dirname(destination));
      if (capacity.bavail * capacity.bsize < 256 * 1024 * 1024) fail("DESTINATION_STORAGE_LIMIT");
      if (adapter !== "native") {
        if (!isolatedFormats[request.category]?.includes(request.format)) fail("NATIVE_FORMAT_NOT_SUPPORTED");
        const record=await options.payloadManager?.resolve(adapter);
        if(!record?.bundled)fail("BUNDLED_ADAPTER_REQUIRED");
        const broker=options.nativeFileBroker;
        if(!isNativeFileBroker(broker) || typeof broker.describe!=="function")fail(options.nativeFileBrokerError||"NATIVE_BROKER_UNAVAILABLE");
        const description=await broker.describe(adapter);
        if(description?.attemptAvailable!==true || !description.formats?.includes(request.format) || description.mechanism!=="appcontainer-handle-job")fail(description?.reason||"NATIVE_BROKER_UNAVAILABLE");
        // run performs actual OS admission before resuming the isolated decoder.
        const receipt=await isolatedRun(broker,{adapterId:adapter,sourceId:request.sourceId,destinationId:request.destinationId,format:request.format},context);
        if(receipt.protocol!==1 || receipt.state!=="completed" || receipt.mechanism!=="appcontainer-handle-job" ||
          receipt.operation!==adapter+"-"+request.format || receipt.validation!=="signature-and-decoder-roundtrip" ||
          receipt.publication!=="atomic-no-replace" || !Number.isSafeInteger(receipt.outputBytes) || receipt.outputBytes<1 || receipt.outputBytes>128*1024*1024 ||
          !/^[a-f0-9]{64}$/.test(receipt.outputSha256||"") || !/^[a-f0-9]{64}$/.test(receipt.sourceSha256||"") || receipt.admission?.lpac!==true || receipt.admission?.appContainer!==true || receipt.admission?.capabilityCount!==0 ||
          receipt.admission?.jobAssigned!==true || receipt.admission?.handleList!==true || receipt.destinationId!==request.destinationId || receipt.outputCreated!==true)
          throw Object.assign(new Error("CONVERSION_OUTPUT_UNVERIFIED"),{code:"CONVERSION_OUTPUT_UNVERIFIED",incompleteOutput:{state:"unknown",publication:"unconfirmed"}});
        return {bytes:receipt.outputBytes,sha256:receipt.outputSha256,sourceSha256:receipt.sourceSha256,format:request.format,validation:receipt.validation,mechanism:receipt.mechanism,publication:receipt.publication};
      }
      const temporary = path.join(
        path.dirname(destination),
        ".conversion-" + randomUUID() + "." + request.format,
      );
      try {
        if (adapter === "native") {
          const bytes = await fs.readFile(source);
          if (context.signal?.aborted) fail("CANCELLED");
          const output = require("./converter-native.cjs").convertNative(bytes, request.category, request.format);
          await fs.writeFile(temporary, output, { flag: "wx", mode: 0o600 });
        }
        const out = await fs.stat(temporary);
        if (!out.isFile() || out.size === 0 || out.size > 128 * 1024 * 1024)
          fail("INVALID_OUTPUT");
        const sha256 = await digest(temporary);
        if (context.signal?.aborted) fail("CANCELLED");
        await grant(options, request.sourceId, "read");
        await grant(options, request.destinationId, "write");
        await fs.link(temporary, destination);
        return { bytes: out.size, sha256, format: request.format };
      } finally {
        await fs.rm(temporary, { force: true });
      }
    },
  };
}
module.exports = { createConverter, formats, signature };
