/// <reference lib="webworker" />
export {};
const context = self as unknown as DedicatedWorkerGlobalScope;
context.postMessage({ ready: true });
context.onmessage = (event: MessageEvent) => {
  const start = performance.now();
  const { pattern, flags, sample, replacement, tests } = event.data ?? {};
  try {
    if (
      typeof pattern !== "string" ||
      pattern.length > 2000 ||
      typeof sample !== "string" ||
      sample.length > 65536 ||
      typeof flags !== "string" ||
      !/^[dgimsuvy]*$/.test(flags) ||
      new Set(flags).size !== flags.length ||
      typeof replacement !== "string" ||
      replacement.length > 2000 ||
      !Array.isArray(tests) ||
      tests.length > 20
    )
      throw new Error("Input exceeds supported limits.");
    const regex = new RegExp(
      pattern,
      flags.includes("g") ? flags : flags + "g",
    );
    const matches = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sample)) !== null && matches.length < 500) {
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
        text: match[0],
        captures: Array.from(match).slice(1),
        groups: match.groups ?? {},
        indices: match.indices ?? null,
      });
      if (match[0] === "") {
        const at = regex.lastIndex;
        regex.lastIndex =
          at +
          (regex.unicode || flags.includes("v")
            ? (sample.codePointAt(at) ?? 0) > 0xffff
              ? 2
              : 1
            : 1);
      }
    }
    const replaced = sample.replace(new RegExp(pattern, flags), replacement);
    if (replaced.length > 131072)
      throw new Error("Replacement exceeds output limit.");
    const outcomes = tests.map((test) => {
      if (
        typeof test.text !== "string" ||
        test.text.length > 4096 ||
        typeof test.expected !== "boolean"
      )
        throw new Error("Invalid test case.");
      const actual = new RegExp(pattern, flags).test(test.text);
      return {
        actual,
        expected: test.expected,
        passed: actual === test.expected,
      };
    });
    context.postMessage({
      ok: true,
      matches,
      truncated: matches.length === 500,
      replaced,
      outcomes,
      milliseconds: performance.now() - start,
    });
  } catch (error) {
    context.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : "Invalid expression.",
      milliseconds: performance.now() - start,
    });
  }
};
