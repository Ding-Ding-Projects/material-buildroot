import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { open } from "./desktop-fixture.mjs";
const require = createRequire(import.meta.url),
  { renderMarkdown } = require("../../src/main/documentation/service.cjs");
const ids = ["doc-" + "a".repeat(64), "doc-" + "b".repeat(64)];
const articles = [
  {
    id: ids[0],
    source: "docs/start.md",
    title: "Build your first image",
    category: "Project workflows",
    language: "en",
    summary:
      "Choose a trusted project and inspect a runtime before starting a build.",
    anchors: ["build-your-first-image", "review"],
  },
  {
    id: ids[1],
    source: "docs/packages.md",
    title: "Author a package",
    category: "Project workflows",
    language: "en",
    summary: "Preview package files and explicitly approve applying them.",
    anchors: ["author-a-package"],
  },
];
const markdown = [
  "# Build your first image\n\nChoose a trusted project, then inspect the runtime.\n\n## Review\n\n[Package workflow](packages.md#author-a-package) · [Official reference](https://example.org/reference) · [Unavailable resource](missing.md)\n\n| Step | Result |\n| --- | --- |\n| Preview | Review exact files |\n\n```sh\nmake help\n```\n",
  " # Author a package\n\nPackage preview and external-tree activation are separate approvals.\n\n[Back to review](start.md#review)\n",
];
const metadata = articles.map(({ source, anchors, ...a }) => a),
  navigation = {
    categories: [
      {
        name: "Project workflows",
        articles: metadata.map(({ id, title }) => ({ id, title })),
      },
    ],
    headings: [],
  };
const documents = articles.map((a, i) => {
  const rendered = renderMarkdown(markdown[i], {
    source: a.source,
    documents: articles,
  });
  return {
    article: metadata[i],
    html: rendered.html,
    navigation: { ...navigation, headings: rendered.headings },
    issues: rendered.issues,
    complete: rendered.issues.length === 0,
  };
});
async function fixture(page, options = {}) {
  const f = await open(page, options);
  await page.evaluate(
    ({ metadata, navigation, documents }) => {
      const previous = window.studio.operations;
      window.__documentationRequests = [];
      window.studio.operations = async (r) => {
        window.__documentationRequests.push(r);
        if (r.action.startsWith("documentation.")) {
          if (window.__documentationUnavailable)
            return { ok: false, code: "CORRUPT_BUNDLE" };
          if (r.action === "documentation.list")
            return {
              ok: true,
              result: {
                articles: metadata,
                navigation,
                issues: [],
                complete: true,
              },
            };
          if (r.action === "documentation.read") {
            if (window.__delayDocumentation)
              await new Promise(
                (resolve) => (window.__releaseDocumentation = resolve),
              );
            return {
              ok: true,
              result: documents.find((d) => d.article.id === r.id),
            };
          }
          if (r.action === "documentation.searchText") {
            if (window.__searchTextUnavailable)
              return { ok: false, code: "CORRUPT_BUNDLE" };
            return {
              ok: true,
              result: {
                entries: documents.map((d) => ({
                  id: d.article.id,
                  text: d.html.replace(/<[^>]*>/g, " "),
                  truncated: false,
                })),
              },
            };
          }
          if (r.action === "documentation.open")
            return { ok: true, result: { opened: true } };
        }
        return previous(r);
      };
    },
    { metadata: options.bundle?.metadata || metadata, navigation, documents: options.bundle?.documents || documents },
  );
  await page
    .locator("operations-panel")
    .evaluate((p) => (p.tab = "documentation"));
  await expect(page.locator("documentation-panel .tasks")).toContainText(
    "Build your first image",
  );
  return f;
}

test("reference page location survives reader recreation and image links retain Markdown history", async ({ page }) => {
  const sourceId = (source) => "doc-" + createHash("sha256").update(source).digest("hex");
  const jsonId = sourceId("docs/data.json"), pageId = sourceId("docs/data.json\0page:1"), imageId = sourceId("docs/image.png");
  const reference = (id, title, html) => ({ article: { id, title, category: "Project workflows", language: "en", summary: "Bundled source reference" }, html, navigation, issues: [], complete: true });
  const link = (id, text) => `<a href="#" data-document-id="${id}">${text}</a>`;
  const extra = [
    reference(jsonId, "Data page 1", `<h1>Data page 1</h1>${link(pageId, "Next page")}`),
    reference(pageId, "Data page 2", `<h1>Data page 2</h1><pre>{"second":true}</pre>${link(jsonId, "Previous page")}${link(imageId, "View image")}`),
    reference(imageId, "Image reference", '<h1>Image reference</h1><img alt="Bundled diagram" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=">'),
  ];
  const bundleDocuments = [{ ...documents[0], html: documents[0].html + link(jsonId, "Read source data") }, documents[1], ...extra];
  const f = await fixture(page, { bundle: { metadata: bundleDocuments.map(d => d.article), documents: bundleDocuments } });
  try {
    let p = page.locator("documentation-panel");
    await p.locator(".topics").getByRole("button", { name: "Build your first image", exact: true }).click();
    await p.getByRole("link", { name: "Read source data", exact: true }).click();
    await p.getByRole("link", { name: "Next page", exact: true }).click();
    await expect(p.getByRole("heading", { name: "Data page 2", exact: true })).toBeVisible();
    await p.getByRole("link", { name: "View image", exact: true }).click();
    await expect(p.getByRole("img", { name: "Bundled diagram" })).toBeVisible();
    await p.getByRole("button", { name: "Back in documentation", exact: true }).click();
    await expect(p.locator("pre")).toHaveText('{"second":true}');
    await p.evaluate(el => {
      const replacement = document.createElement("documentation-panel");
      replacement.language = el.language;
      replacement.active = true;
      el.replaceWith(replacement);
    });
    p = page.locator("documentation-panel");
    await expect(p.getByRole("heading", { name: "Data page 2", exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("documentation-last-location")))).toEqual({ id: pageId, anchor: "" });
    expect(f.errors).toEqual([]);
  } finally { f.close(); }
});

test("documentation reads use effective language and language changes preserve location and history", async ({ page }) => {
  const f = await fixture(page);
  try {
    const p = page.locator("documentation-panel");
    await p.locator(".topics").getByRole("button", { name: "Build your first image", exact: true }).click();
    await p.getByRole("link", { name: "Package workflow", exact: true }).click();
    await expect(p.getByRole("heading", { name: "Author a package", exact: true })).toBeVisible();
    const before = await p.evaluate(el => ({ history: el.history, cursor: el.cursor, location: localStorage.getItem("documentation-last-location") }));
    for (const language of ["zh-HK", "bilingual", "en"]) {
      const count = await page.evaluate(() => window.__documentationRequests.filter(r => r.action === "documentation.read").length);
      await p.evaluate((el, language) => { el.language = language; }, language);
      await expect.poll(() => page.evaluate(() => window.__documentationRequests.filter(r => r.action === "documentation.read").length)).toBe(count + 1);
      await expect.poll(() => p.evaluate(el => el.loading)).toBe(false);
      expect(await page.evaluate(() => window.__documentationRequests.filter(r => r.action === "documentation.read").at(-1))).toEqual({ action: "documentation.read", id: ids[1], language });
      expect(await p.evaluate(el => ({ history: el.history, cursor: el.cursor, location: localStorage.getItem("documentation-last-location") }))).toEqual(before);
    }
    const count = await page.evaluate(() => window.__documentationRequests.filter(r => r.action === "documentation.read").length);
    await p.evaluate(el => { el.restricted = true; el.language = "zh-HK"; });
    await expect(p.getByRole("heading", { name: "Workspace help", exact: true })).toBeVisible();
    expect(await p.evaluate(el => el.effectiveLanguage())).toBe("en");
    await p.evaluate(el => el.openArticle("doc-" + "a".repeat(64)));
    expect(await page.evaluate(() => window.__documentationRequests.filter(r => r.action === "documentation.read").length)).toBe(count);
    expect(f.errors).toEqual([]);
  } finally { f.close(); }
});
test("offline reader uses host rendered articles, safe navigation, history and opaque external links", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const p = page.locator("documentation-panel");
    await p
      .locator(".topics")
      .getByRole("button", { name: "Build your first image", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "Build your first image", exact: true }),
    ).toBeVisible();
    await expect(p.locator("table")).toContainText("Preview");
    await p
      .getByRole("link", { name: "Package workflow", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "Author a package", exact: true }),
    ).toBeVisible();
    await p
      .getByRole("button", { name: "Back in documentation", exact: true })
      .click();
    await p
      .getByRole("link", { name: "Official reference", exact: true })
      .click();
    await expect(p).toContainText("External link opened through the desktop.");
    const request = await page.evaluate(() =>
      window.__documentationRequests.find(
        (r) => r.action === "documentation.open",
      ),
    );
    expect(request.id).toBe(ids[0]);
    expect(request.linkId).toMatch(/^link-[a-f0-9]{64}$/);
    expect(Object.keys(request).sort()).toEqual(["action", "id", "linkId"]);
    await p
      .getByRole("link", { name: "Unavailable resource", exact: true })
      .click({ force: true });
    await expect(p).toContainText(
      "This resource is not available in the offline bundle.",
    );
    expect(f.errors).toEqual([]);
  } finally {
    f.close();
  }
});
test("documentation regex builder stays anchored, isolates query and rejects invalid expressions", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const p = page.locator("documentation-panel");
    await p
      .getByRole("textbox", { name: "Search documentation", exact: true })
      .fill("image");
    await expect(p.locator(".topics .topic")).toHaveCount(1);
    await p
      .getByRole("button", { name: "Documentation regex builder", exact: true })
      .click();
    await p
      .getByRole("textbox", { name: "Documentation pattern", exact: true })
      .fill("^Author");
    await expect(p.locator(".topics .topic")).toHaveCount(1);
    await expect(p.locator(".topics")).toContainText("Author a package");
    await p
      .getByRole("textbox", { name: "Documentation pattern", exact: true })
      .fill("[");
    await expect(p).toContainText("Invalid expression.");
    await expect(p.locator(".topics .topic")).toHaveCount(0);
    await p.evaluate(
      (el) => (el.index.articles[0].summary = "a".repeat(100) + "!"),
    );
    await p
      .getByRole("textbox", { name: "Documentation pattern", exact: true })
      .fill("(a+)+$");
    await expect(p).toContainText("Expression timed out.");
    await p
      .getByRole("textbox", { name: "Documentation pattern", exact: true })
      .press("Escape");
    await expect(p.locator(".builder")).toHaveCount(0);
    await expect(
      p.getByRole("textbox", { name: "Search documentation", exact: true }),
    ).toHaveValue("image");
    await p
      .getByRole("textbox", { name: "Search documentation", exact: true })
      .fill("Build");
    await expect(p.locator(".topics .topic")).toHaveCount(1);
    expect(f.errors).toEqual([]);
  } finally {
    f.close();
  }
});
test("offline documentation reports corrupt bundle and recovers by reload", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const p = page.locator("documentation-panel");
    await page.evaluate(() => (window.__documentationUnavailable = true));
    await p
      .getByRole("button", { name: "Reload documentation", exact: true })
      .click();
    await expect(p).toContainText("CORRUPT_BUNDLE");
    await page.evaluate(() => (window.__documentationUnavailable = false));
    await p
      .getByRole("button", { name: "Reload documentation", exact: true })
      .click();
    await expect(p).not.toContainText("CORRUPT_BUNDLE");
    expect(f.errors).toEqual([]);
  } finally {
    f.close();
  }
});
for (const [language, theme, width] of [
  ["en", "light", 1440],
  ["zh-HK", "light", 960],
  ["bilingual", "dark", 960],
])
  test(`offline documentation capture ${language} ${theme} ${width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const f = await fixture(page, { language, theme });
    try {
      const p = page.locator("documentation-panel");
      await p
        .locator(".topics")
        .getByRole("button", { name: "Build your first image", exact: true })
        .click();
      await expect(p.locator("table")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await p.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
      ).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(
          `documentation-${language}-${theme}-${width}.png`,
        ),
      });
      expect(f.errors).toEqual([]);
    } finally {
      f.close();
    }
  });
test("command launcher opens help and a stale article cannot replace documentation home", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page.locator("operations-panel").evaluate((p) => (p.tab = "source"));
    await page
      .getByRole("button", {
        name: "Open actions, Control Shift F",
        exact: true,
      })
      .click();
    const ax = await page.context().newCDPSession(page);
    expect(
      (await ax.send("Accessibility.getFullAXTree")).nodes
        .filter((n) => n.role?.value === "dialog" && !n.ignored)
        .map((n) => n.name?.value),
    ).toContain("Workspace actions");
    await ax.detach();
    await page
      .locator("#actions-dialog")
      .getByRole("button", { name: "Help & documentation", exact: true })
      .click();
    const p = page.locator("documentation-panel");
    await expect(p).toBeVisible();
    await page.evaluate(() => (window.__delayDocumentation = true));
    await p
      .locator(".topics")
      .getByRole("button", { name: "Build your first image", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!window.__releaseDocumentation))
      .toBe(true);
    await p
      .getByRole("button", { name: "Documentation home", exact: true })
      .click();
    await page.evaluate(() => window.__releaseDocumentation());
    await expect(
      p.getByRole("heading", {
        name: "Work with your local project",
        exact: true,
      }),
    ).toBeVisible();
    await expect(p.locator("table")).toHaveCount(0);
    expect(f.errors).toEqual([]);
  } finally {
    f.close();
  }
});

test("documentation search matches article body text and reports a title-only fallback", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const p = page.locator("documentation-panel");
    await expect(p.locator(".notice")).toContainText("titles, summaries and article text");
    await p
      .getByRole("textbox", { name: "Search documentation", exact: true })
      .fill("external-tree activation");
    await expect(p.locator(".topics .topic")).toHaveCount(1);
    await expect(p.locator(".topics")).toContainText("Author a package");
    await p
      .getByRole("button", { name: "Documentation regex builder", exact: true })
      .click();
    await p
      .getByRole("textbox", { name: "Documentation pattern", exact: true })
      .fill("inspect the runtime\\.");
    await expect(p.locator(".topics .topic")).toHaveCount(1);
    await expect(p.locator(".topics")).toContainText("Build your first image");
    await p.evaluate(() => (window.__searchTextUnavailable = true));
    await p.evaluate((el) => el.refresh());
    await expect(p.locator(".notice")).toContainText("article text is unavailable");
    await p
      .getByRole("textbox", { name: "Documentation pattern", exact: true })
      .fill("external-tree");
    await expect(p.locator(".topics .topic")).toHaveCount(0);
    expect(f.errors).toEqual([]);
  } finally {
    f.close();
  }
});
