"use strict";
const { fail, text, token } = require("./runtime.cjs");
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const integer = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;
function object(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail("INVALID_REQUEST");
  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(value),
  ))
    if (descriptor.get || descriptor.set) fail("INVALID_REQUEST");
}
function keys(value, required, optional = []) {
  object(value);
  if (
    Object.keys(value).some(
      (key) => ![...required, ...optional].includes(key),
    ) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    fail("INVALID_REQUEST");
}
function string(value, max = 256) {
  text(value, max);
}
function one(value, values) {
  if (!values.includes(value)) fail("INVALID_REQUEST");
}
function admit(request, nested = false) {
  object(request);
  string(request.action, 80);
  const action = request.action;
  const simple = [
    "ollama.status",
    "ollama.conversations.list",
    "ollama.hardware",
    "ollama.catalogue.status",
    "ollama.catalogue.refresh",
    "ollama.catalogue.cancel",
    "ollama.tags",
    "ollama.running",
    "ollama.managed.status",
    "ollama.managed.cancel",
    "ollama.managed.start",
    "ollama.managed.stop",
    "converter.catalog",
    "minecraft.bedrock.discovery",
    "queue.run",
    "queue.recover",
  ];
  if (simple.includes(action)) keys(request, ["action"]);
  else
    switch (action) {
      case "ollama.install":
        keys(request, ["action"], ["acquire", "repair"]);
        for (const key of ["acquire", "repair"])
          if (request[key] !== undefined && typeof request[key] !== "boolean")
            fail("INVALID_REQUEST");
        break;
      case "ollama.catalogue.page":
        keys(request,["action"],["family","query","offset","limit"]);
        if(request.family!==undefined&&(typeof request.family!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(request.family)))fail("INVALID_REQUEST");
        if(request.query!==undefined)string(request.query,128);
        if(request.offset!==undefined&&!integer(request.offset,0,100000))fail("INVALID_REQUEST");
        if(request.limit!==undefined&&!integer(request.limit,1,100))fail("INVALID_REQUEST");
        break;
      case "ollama.fit":
        keys(request, ["action", "model"], ["contextTokens"]);
        token(request.model);
        if (
          request.contextTokens !== undefined &&
          !integer(request.contextTokens, 128, 1048576)
        )
          fail("INVALID_REQUEST");
        break;
      case "ollama.capabilities":
      case "ollama.show":
      case "ollama.pull":
        keys(request, ["action", "model"]);
        token(request.model);
        break;
      case "ollama.conversations.save":
        keys(request,["action","title","model","messages"]);
        string(request.title,120);
        admit({action:"ollama.chat",model:request.model,messages:request.messages});
        break;
      case "ollama.conversations.load":
      case "ollama.conversations.delete":
        keys(request,["action","id"]);
        if(!uuid(request.id))fail("INVALID_REQUEST");
        break;
      case "ollama.chat.read":
        keys(request,["action","id"],["offset"]);
        if(!uuid(request.id)||request.offset!==undefined&&!integer(request.offset,0,1048576))fail("INVALID_REQUEST");
        break;
      case "ollama.chat.cancel":
      case "ollama.chat.forget":
        keys(request,["action","id"]);
        if(!uuid(request.id))fail("INVALID_REQUEST");
        break;
      case "ollama.chat.start":
      case "ollama.chat":
        keys(request, ["action", "model", "messages"]);
        token(request.model);
        if (
          !Array.isArray(request.messages) ||
          !request.messages.length ||
          request.messages.length > 100
        )
          fail("INVALID_REQUEST");
        let size = 0;
        for (const message of request.messages) {
          keys(message, ["role", "content"]);
          one(message.role, ["user", "assistant", "system"]);
          if (typeof message.content !== "string" || !message.content.length || message.content.length > 65536 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(message.content)) fail("INVALID_REQUEST");
          size += message.content.length;
        }
        if (size > 262144) fail("REQUEST_LIMIT");
        break;
      case "converter.convert":
        keys(request, [
          "action",
          "category",
          "format",
          "sourceId",
          "destinationId",
        ]);
        one(request.category, [
          "images",
          "audio",
          "video",
          "documents",
          "archives",
          "structured",
          "text",
          "binary",
        ]);
        string(request.format, 16);
        string(request.sourceId);
        string(request.destinationId);
        break;
      case "pdf.execute": {
        keys(
          request,
          ["action", "operation"],
          [
            "sourceId",
            "sourceIds",
            "destinationId",
            "pages",
            "degrees",
            "mode",
          ],
        );
        one(request.operation, [
          "inspect",
          "merge",
          "split",
          "extract",
          "reorder",
          "rotate",
          "metadata",
        ]);
        if (
          Object.hasOwn(request, "sourceId") ===
          Object.hasOwn(request, "sourceIds")
        )
          fail("INVALID_REQUEST");
        if (request.sourceId !== undefined) string(request.sourceId);
        else {
          if (
            !Array.isArray(request.sourceIds) ||
            !request.sourceIds.length ||
            request.sourceIds.length > 100
          )
            fail("INPUT_LIMIT");
          request.sourceIds.forEach((id) => string(id));
        }
        if (request.operation !== "inspect") string(request.destinationId);
        else if (request.destinationId !== undefined) fail("INVALID_REQUEST");
        if (
          ["split", "extract", "reorder", "rotate"].includes(request.operation)
        ) {
          if (
            !Array.isArray(request.pages) ||
            !request.pages.length ||
            request.pages.length > 10000 ||
            request.pages.some((page) => !integer(page, 1, 10000))
          )
            fail("INVALID_PAGE_SELECTION");
        } else if (request.pages !== undefined) fail("INVALID_REQUEST");
        if (request.operation === "rotate")
          one(request.degrees, [90, 180, 270]);
        else if (request.degrees !== undefined) fail("INVALID_REQUEST");
        if (request.operation === "metadata") one(request.mode, ["remove"]);
        else if (request.mode !== undefined) fail("INVALID_REQUEST");
        break;
      }
      case "minecraft.versions":
        keys(request, ["action"], ["edition"]);
        if (request.edition !== undefined)
          one(request.edition, ["java", "bedrock"]);
        break;
      case "minecraft.install":
        keys(request, ["action", "edition", "version", "directoryId"]);
        one(request.edition, ["java", "bedrock"]);
        string(request.version, 80);
        string(request.directoryId);
        break;
      case "minecraft.configure":
        keys(request, ["action", "directoryId", "properties", "acceptEula"]);
        string(request.directoryId);
        object(request.properties);
        require("./minecraft.cjs").properties(request.properties);
        if (request.acceptEula !== true) fail("EULA_ACCEPTANCE_REQUIRED");
        break;
      case "minecraft.start":
        keys(
          request,
          ["action", "serverId", "directoryId", "target", "memoryMiB"],
          ["network", "port"],
        );
        string(request.serverId, 80);
        string(request.directoryId);
        one(request.target, ["local-process", "local-container"]);
        if (!integer(request.memoryMiB, 512, 32768)) fail("INVALID_REQUEST");
        if (
          request.target === "local-process" &&
          (request.network !== undefined || request.port !== undefined)
        )
          fail("INVALID_REQUEST");
        if (request.network !== undefined)
          one(request.network, ["none", "bridge"]);
        if (request.network === "bridge") {
          if (!integer(request.port, 1024, 65535)) fail("INVALID_SERVER_PORT");
        } else if (request.port !== undefined) fail("INVALID_REQUEST");
        break;
      case "minecraft.stop":
      case "minecraft.status":
        keys(request, ["action", "serverId"]);
        string(request.serverId, 80);
        break;
      case "minecraft.flavours":
        keys(request, ["action", "flavour"], ["version"]);
        one(request.flavour, ["paper", "fabric"]);
        if (request.version !== undefined) {
          if (request.flavour !== "paper") fail("INVALID_REQUEST");
          token(request.version);
        }
        break;
      case "minecraft.plugins":
        keys(request, ["action", "projectId"]);
        token(request.projectId);
        break;
      case "minecraft.plugin.install":
        keys(request, [
          "action",
          "versionId",
          "directoryId",
          "acceptPluginCode",
          "acceptLicense",
        ]);
        token(request.versionId);
        string(request.directoryId);
        if (request.acceptPluginCode !== true || request.acceptLicense !== true)
          fail("PLUGIN_CONSENT_REQUIRED");
        break;
      case "editor.open":
        keys(request, ["action", "editorId", "sourceId"]);
        string(request.editorId, 80);
        string(request.sourceId);
        break;
      case "forge.preview":
        keys(request, ["action", "provider", "repository", "sourceId"]);
        one(request.provider, ["github", "gitlab"]);
        if (
          typeof request.repository !== "string" ||
          request.repository.length > 200 ||
          !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(request.repository)
        )
          fail("INVALID_DESTINATION");
        string(request.sourceId);
        break;
      case "forge.publish":
        keys(request, ["action", "previewId", "confirmSha256"]);
        if (
          !uuid(request.previewId) ||
          typeof request.confirmSha256 !== "string" ||
          request.confirmSha256.length > 64
        )
          fail("INVALID_REQUEST");
        break;
      case "queue.add":
        keys(request, ["action", "job"]);
        if (
          nested ||
          !["converter.convert", "ollama.pull", "pdf.execute"].includes(
            request.job?.action,
          )
        )
          fail("INVALID_REQUEST");
        admit(request.job, true);
        if (Buffer.byteLength(JSON.stringify(request.job)) > 65536)
          fail("REQUEST_LIMIT");
        break;
      case "queue.page":
        keys(request, ["action"], ["after", "limit"]);
        if (
          request.after !== undefined &&
          request.after !== "" &&
          !uuid(request.after)
        )
          fail("INVALID_REQUEST");
        if (request.limit !== undefined && !integer(request.limit, 1, 100))
          fail("INVALID_REQUEST");
        break;
      case "queue.cancel":
      case "queue.resume":
        keys(request, ["action", "id"]);
        if (!uuid(request.id)) fail("INVALID_REQUEST");
        break;
      default:
        fail("INVALID_REQUEST");
    }
  return structuredClone(request);
}
module.exports = { admit };
