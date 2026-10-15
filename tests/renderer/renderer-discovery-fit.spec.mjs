import { test, expect } from "@playwright/test";
import { open } from "./desktop-fixture.mjs";
const draft = {
  name: "hello",
  version: "2.12",
  source: "https://example.org/hello-2.12.tar.gz",
  sourceFilename: "hello-2.12.tar.gz",
  homepage: "https://example.org",
  license: "GPL-3.0-or-later",
  licenseFiles: ["COPYING"],
  buildSystem: "autotools",
  dependencies: ["zlib"],
  configDependencies: [],
  help: "Greeting package.",
  hashes: [],
};
async function fixture(page) {
  const f = await open(page);
  await page.evaluate(
    ({ draft }) => {
      const prior = window.studio.operations;
      window.__evidenceRequests = [];
      const hardware = {
        observedAt: "2026-10-15T12:00:00Z",
        ram: {
          totalBytes: 16 * 1024 ** 3,
          availableBytes: 8 * 1024 ** 3,
          source: "fixture",
        },
        cpu: { architecture: "x64", logicalCores: 8, backendSupported: null },
        gpu: { state: "unknown", devices: [], reason: "GPU_PROBE_UNAVAILABLE" },
        storage: {
          state: "verified",
          availableBytes: 40 * 1024 ** 3,
          totalBytes: 100 * 1024 ** 3,
        },
      };
      window.studio.operations = async (r) => {
        window.__evidenceRequests.push(r);
        if (r.action === "package.discover")
          return {
            ok: true,
            result: {
              revision: "a".repeat(64),
              packages: [
                {
                  id: "b".repeat(64),
                  treeId: "source",
                  name: "hello",
                  path: "package/hello",
                  recipe: "package/hello/hello.mk",
                  symbols: [],
                  symbolCount: 0,
                  symbolsTruncated: false,
                },
                {
                  id: "c".repeat(64),
                  treeId: "source",
                  name: "manual",
                  path: "package/manual",
                  recipe: "package/manual/manual.mk",
                  symbols: [],
                  symbolCount: 0,
                  symbolsTruncated: false,
                },
              ],
              total: 2,
              offset: 0,
              limit: 50,
              nextOffset: 2,
              limits: {},
              warnings: [],
              semantics:
                "Static declarations; use Kconfig inspection for evaluated values.",
            },
          };
        if (r.action === "package.import") {
          if (window.__delayImport)
            await new Promise((resolve) => (window.__releaseImport = resolve));
          const supported = r.packageId === "b".repeat(64);
          return {
            ok: true,
            result: {
              packageId: r.packageId,
              treeId: "source",
              revision: "d".repeat(64),
              draft: supported ? draft : null,
              roundTripAllowed: supported,
              unsupportedReasons: supported
                ? []
                : ["Manual make functions require read-only review."],
              files: [
                {
                  path: "hello.mk",
                  sha256: "e".repeat(64),
                  bytesBase64: btoa("# Preserved fixture source\n"),
                },
              ],
              symbols: [
                {
                  name: "BR2_PACKAGE_HELLO",
                  type: "bool",
                  prompt: "hello",
                  help: "Greeting help from the source.",
                  location: { path: "package/hello/Config.in", line: 1 },
                },
              ],
              symbolsTruncated: false,
            },
          };
        }
        if (r.action === "tools") {
          const a = r.request.action;
          if (a === "ollama.tags")
            return {
              ok: true,
              result: { models: [{ name: "fixture:latest" }] },
            };
          if (window.__delayFit && a === "ollama.fit")
            await new Promise((resolve) => (window.__releaseFit = resolve));
          if (a === "ollama.hardware")
            return { ok: true, result: { hardware } };
          if (a === "ollama.fit")
            return {
              ok: true,
              result: {
                fit: {
                  verdict: "Unknown",
                  observedAt: hardware.observedAt,
                  reasons: ["GPU_EVIDENCE_UNAVAILABLE"],
                  limitations: [
                    "Planning estimate, not successful model-load proof.",
                  ],
                  hardware,
                  model: {
                    name: "fixture:latest",
                    digest: "f".repeat(64),
                    quantization: "Q4_K_M",
                    contextMaximum: 8192,
                  },
                  estimate: {
                    contextTokens: r.request.contextTokens,
                    contextSource: "requested",
                    weightsBytes: 2 * 1024 ** 3,
                    kvCacheBytes: 1024 ** 3,
                    runtimeOverheadBytes: 512 * 1024 ** 2,
                    safetyFactor: 1.2,
                    requiredMemoryBytes: 4.2 * 1024 ** 3,
                    kvFormula: "fixture",
                  },
                },
              },
            };
          if (a === "ollama.capabilities")
            return {
              ok: true,
              result: {
                observedAt: hardware.observedAt,
                model: "fixture:latest",
                digest: "f".repeat(64),
                capabilities: ["vision", "tools"],
                attachments: {
                  imageCapability: true,
                  transferEnabled: false,
                  reason: "VALIDATED_ATTACHMENT_TRANSPORT_NOT_IMPLEMENTED",
                },
                toolCalling: true,
              },
            };
        }
        return prior(r);
      };
    },
    { draft },
  );
  return f;
}
async function discovery(page) {
  await page
    .getByRole("tab", { name: "Package authoring", exact: true })
    .click();
  await page
    .locator("package-panel summary")
    .filter({ hasText: "Discover and import source packages" })
    .click();
  const p = page.locator("package-discovery-panel");
  await p
    .getByRole("button", { name: "Search package catalogue", exact: true })
    .click();
  return p;
}
test("package source discovery preserves unsupported files and imports only explicitly reviewed drafts", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const p = await discovery(page);
    await p.getByRole("button", { name: "manual", exact: true }).click();
    await expect(p).toContainText("Read-only review.");
    await expect(
      p.getByRole("button", { name: "Import reviewed draft", exact: true }),
    ).toHaveCount(0);
    await p.getByRole("button", { name: "hello", exact: true }).click();
    await expect(p).toContainText("Greeting help from the source.");
    await expect(
      p.getByRole("button", { name: "Import reviewed draft", exact: true }),
    ).toBeDisabled();
    await p
      .getByRole("checkbox", {
        name: "Replace current package draft with reviewed import",
        exact: true,
      })
      .check();
    await p
      .getByRole("button", { name: "Import reviewed draft", exact: true })
      .click();
    expect(
      await page.locator("package-panel").evaluate((p) => p.model.name),
    ).toBe("hello");
    expect(
      await page.locator("package-panel").evaluate((p) => p.external),
    ).toBeUndefined();
    const request = await page.evaluate(() =>
      window.__evidenceRequests.find((r) => r.action === "package.import"),
    );
    expect(request.revision).toBe("a".repeat(64));
    expect(f.errors).toEqual([]);
  } finally {
    f.close();
  }
});
test("package page regex is explicitly page scoped and pending imports cannot cross projects", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const p = await discovery(page);
    await p
      .getByRole("button", { name: "Package page regex builder", exact: true })
      .click();
    await p
      .getByRole("textbox", { name: "Package page pattern", exact: true })
      .fill("^hello");
    await expect(p.locator(".list md-text-button")).toHaveCount(1);
    await p
      .getByRole("textbox", { name: "Package page pattern", exact: true })
      .press("Escape");
    await page.evaluate(() => (window.__delayImport = true));
    await p.getByRole("button", { name: "hello", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => !!window.__releaseImport))
      .toBe(true);
    await page
      .locator("package-panel")
      .evaluate((p) => (p.workspaceId = "second-project"));
    await page.evaluate(() => window.__releaseImport());
    await expect(
      p.getByRole("button", { name: "Import reviewed draft", exact: true }),
    ).toHaveCount(0);
    expect(f.errors).toEqual([]);
  } finally {
    f.close();
  }
});
test("local model evidence keeps Unknown distinct from capability and attachment support", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page
      .locator("operations-panel")
      .evaluate((p) => (p.tab = "assistant"));
    await page
      .getByRole("button", { name: "Load installed models", exact: true })
      .click();
    const p = page.locator("ollama-evidence-panel");
    await p.locator("summary").click();
    await p
      .getByRole("button", { name: "Measure local hardware", exact: true })
      .click();
    await expect(p).toContainText("8.00 GiB / 16.00 GiB");
    await p
      .getByRole("spinbutton", { name: "Planning context tokens", exact: true })
      .fill("2048");
    await p
      .getByRole("button", { name: "Estimate selected model fit", exact: true })
      .click();
    await expect(p.locator(".verdict")).toHaveText("Unknown");
    await p
      .getByRole("button", { name: "Inspect model capabilities", exact: true })
      .click();
    await expect(p).toContainText("Attachment transfer is not implemented.");
    expect(
      await page.evaluate(
        () =>
          window.__evidenceRequests.find(
            (r) => r.request?.action === "ollama.fit",
          ).request,
      ),
    ).toEqual({
      action: "ollama.fit",
      model: "fixture:latest",
      contextTokens: 2048,
    });
    await page
      .locator("operations-panel")
      .evaluate((p) => (p.model = "changed:latest"));
    await expect(p.locator(".verdict")).toHaveCount(0);
    expect(f.errors).toEqual([]);
  } finally {
    f.close();
  }
});
