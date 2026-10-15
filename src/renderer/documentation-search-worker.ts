/// <reference lib="webworker" />
export {};
const context = self as unknown as DedicatedWorkerGlobalScope;
context.onmessage = (event: MessageEvent) => {
  try {
    const { pattern, flags, articles } = event.data;
    if (
      typeof pattern !== "string" ||
      pattern.length > 2000 ||
      typeof flags !== "string" ||
      !/^[imsu]*$/.test(flags) ||
      new Set(flags).size !== flags.length ||
      !Array.isArray(articles) ||
      articles.length > 1000
    )
      throw Error("INVALID_SEARCH");
    const expression = new RegExp(pattern, flags);
    const ids = articles
      .filter((a) => {
        if (
          typeof a.id !== "string" ||
          typeof a.text !== "string" ||
          a.text.length > 2000
        )
          throw Error("INVALID_SEARCH");
        return expression.test(a.text);
      })
      .map((a) => a.id);
    context.postMessage({ ok: true, ids });
  } catch {
    context.postMessage({ ok: false, code: "INVALID_EXPRESSION" });
  }
};
