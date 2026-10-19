"use strict";
const { createOllama } = require("./ollama.cjs");
const { createConverter } = require("./converter.cjs");
const { createMinecraft } = require("./minecraft.cjs");
const {
  fail,
  text,
  grant,
  executable,
  processRun,
  digest,
} = require("./runtime.cjs");
function createToolsService(options = {}) {
  const ollama = createOllama(options),
    converter = createConverter(options),
    pdf = require("./pdf.cjs").createPdfService(options),
    minecraft = createMinecraft(options);
  const editorTransfer = require("./editor-transfer.cjs").createEditorTransfer(options);
  let disposed = false;
  const active = new Set();
  const inFlight = new Set();
  const previews = new Map();
  const queue = require("./queue.cjs").createToolQueue(
    options.queueDirectory,
    (request, context) => execute(request, context),
    options,
  );
  async function execute(request, context = {}) {
    let settled;
    const completion = new Promise((resolve) => {
      settled = resolve;
    });
    inFlight.add(completion);
    const controller = new AbortController();
    if (context.signal?.aborted) controller.abort();
    const abort = () => controller.abort();
    context.signal?.addEventListener("abort", abort, { once: true });
    const originalSignal = context.signal;
    context = { ...context, signal: controller.signal };
    active.add(controller);
    try {
      if (disposed) fail("SERVICE_DISPOSED");
      request = require("./request-contract.cjs").admit(request);
      if (!request || typeof request !== "object" || Array.isArray(request))
        fail("INVALID_REQUEST");
      text(request.action, 80);
      let result;
      if (request.action.startsWith("queue."))
        result = await queue.dispatch(request, context);
      else if (request.action.startsWith("ollama."))
        result = await ollama(request, context);
      else if (request.action === "pdf.execute") result = await pdf.execute(request,context);
      else if (request.action === "pdf.catalog") result = await pdf.catalog();
      else if (request.action === "pdf.cancel") result = pdf.cancel();
      else if (request.action === "converter.catalog")
        result = { categories: await converter.catalog() };
      else if (request.action === "converter.cancel")
        result = converter.cancel();
      else if (request.action === "converter.inspect")
        result = await converter.inspect(request);
      else if (request.action === "converter.convert")
        result = await converter.convert(request, context);
      else if (request.action.startsWith("minecraft."))
        result = await minecraft(request, context);
      else if (request.action.startsWith("editor.") || request.action.startsWith("transfer."))
        result = await editorTransfer(request, context);
      else if (request.action === "forge.preview") {
        if (
          !["github", "gitlab"].includes(request.provider) ||
          !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(request.repository || "")
        )
          fail("INVALID_DESTINATION");
        const source = await grant(options, request.sourceId, "read");
        const sha256 = await digest(source);
        const id = require("node:crypto").randomUUID();
        const preview = {
          id,
          provider: request.provider,
          repository: request.repository,
          sourceId: request.sourceId,
          sha256,
        };
        if (previews.size >= 100) fail("PREVIEW_LIMIT");
        previews.set(id, preview);
        result = { preview };
      } else if (request.action === "forge.publish") {
        const preview = previews.get(request.previewId);
        if (!preview || request.confirmSha256 !== preview.sha256)
          fail("REVIEW_REQUIRED");
        if (!options.forgePublish || !options.getCredential)
          fail("FORGE_TRANSPORT_UNAVAILABLE");
        const source = await grant(options, preview.sourceId, "read");
        if ((await digest(source)) !== preview.sha256) fail("SOURCE_CHANGED");
        const credential = await options.getCredential(
          preview.provider,
          preview.repository,
        );
        if (!credential) fail("CREDENTIAL_REQUIRED");
        result = await options.forgePublish({
          preview,
          source,
          credential,
          signal: context.signal,
        });
        if (!result?.readbackVerified) fail("PUBLICATION_READBACK_REQUIRED");
        previews.delete(preview.id);
      } else fail("INVALID_REQUEST");
      return { ok: true, ...result };
    } catch (error) {
      const partial=error.incompleteOutput;
      const incompleteOutput=partial?.state==="retained" && partial.publication==="not-published" && /^\.material-incomplete-[0-9a-fA-F-]{36}\.tmp$/.test(partial.name||"")
        ? {state:"retained",name:partial.name,publication:"not-published"}
        : partial?.state==="unknown"&&partial.publication==="unconfirmed" ? {state:"unknown",publication:"unconfirmed"} : undefined;
      return {
        ...(incompleteOutput?{incompleteOutput}:{}),
        ok: false,
        code:
          error.name === "AbortError"
            ? "CANCELLED"
            : /^[A-Z_]+$/.test(error.code || "")
              ? error.code
              : "TOOL_FAILED",
      };
    } finally {
      active.delete(controller);
      originalSignal?.removeEventListener("abort", abort);
      inFlight.delete(completion);
      settled();
    }
  }
  let disposal;
  function dispose() {
    if (disposal) return disposal;
    disposed = true;
    for (const controller of active) controller.abort();
    previews.clear();
    disposal = (async () => {
      let timer;
      try {
        await Promise.race([
          Promise.all([
            queue.dispose(),
            minecraft.dispose(),
            ollama.dispose?.(),
            Promise.all([...inFlight]),
          ]),
          new Promise((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  Object.assign(new Error("SERVICE_SHUTDOWN_UNVERIFIED"), {
                    code: "SERVICE_SHUTDOWN_UNVERIFIED",
                  }),
                ),
              15000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    })();
    return disposal;
  }
  return { execute, dispose };
}
module.exports = { createToolsService };

