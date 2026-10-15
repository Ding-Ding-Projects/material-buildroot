"use strict";
const { fail, text, token, fetchBounded } = require("./runtime.cjs");
function createOllama(options = {}) {
  const base = "http://127.0.0.1:11434";
  return async function execute(request, context = {}) {
    const common = { signal: context.signal, fetchImpl: options.fetchImpl };
    switch (request.action) {
      case "ollama.status":
        return fetchBounded(base + "/api/version", common);
      case "ollama.tags":
        return fetchBounded(base + "/api/tags", common);
      case "ollama.running":
        return fetchBounded(base + "/api/ps", common);
      case "ollama.show":
        return fetchBounded(base + "/api/show", {
          ...common,
          method: "POST",
          body: { model: token(request.model) },
        });
      case "ollama.pull": {
        let complete = false;
        await fetchBounded(base + "/api/pull", {
          ...common,
          method: "POST",
          maxBytes: 64 * 1024 * 1024,
          body: { model: token(request.model), stream: true },
          onLine: (item) => {
            if (item.error) fail("MODEL_PULL_FAILED");
            if (item.status === "success") complete = true;
            context.onProgress?.({ type: "model-pull", ...item });
          },
        });
        if (!complete) fail("INCOMPLETE_MODEL_PULL");
        return { completed: true };
      }
      case "ollama.chat": {
        if (!Array.isArray(request.messages) || request.messages.length > 100)
          fail("INVALID_REQUEST");
        let total = 0;
        const messages = request.messages.map((message) => {
          if (!["user", "assistant", "system"].includes(message.role))
            fail("INVALID_REQUEST");
          const content = text(message.content, 65536);
          total += content.length;
          if (total > 262144) fail("REQUEST_LIMIT");
          return { role: message.role, content };
        });
        let complete = false,
          content = "",
          terminal;
        await fetchBounded(base + "/api/chat", {
          ...common,
          method: "POST",
          maxBytes: 16 * 1024 * 1024,
          body: { model: token(request.model), messages, stream: true },
          onLine: (item) => {
            if (item.error) fail("MODEL_CHAT_FAILED");
            if (item.message?.content) {
              if (typeof item.message.content !== "string")
                fail("INVALID_CHAT_RESPONSE");
              content += item.message.content;
              if (content.length > 1048576) fail("RESPONSE_LIMIT");
            }
            if (item.done === true) {
              complete = true;
              terminal = item;
            }
            context.onProgress?.({ type: "chat-token", ...item });
          },
        });
        if (!complete) fail("INCOMPLETE_MODEL_CHAT");
        return {
          completed: true,
          message: { role: "assistant", content },
          doneReason: terminal.done_reason,
          metrics: {
            totalDuration: terminal.total_duration,
            promptTokens: terminal.prompt_eval_count,
            outputTokens: terminal.eval_count,
          },
        };
      }
      case "ollama.install":
        return require("./installer.cjs").installOllama(options, context);
      default:
        fail("INVALID_REQUEST");
    }
  };
}
module.exports = { createOllama };
