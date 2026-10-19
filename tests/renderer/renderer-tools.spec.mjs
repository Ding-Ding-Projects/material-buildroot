import { test, expect } from "@playwright/test";
// Browser fixture: validates renderer contracts, not native execution or TLS.
async function open(page, language = "en") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("http://127.0.0.1:5197/", route => route.fulfill({contentType:"text/html",body:"<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>"}));
  await page.goto("/");
  await page.evaluate(async (language) => {
    await import("/src/renderer/operations-panel.ts");
    const {vocabulary}=await import("/src/renderer/owned-copy.ts");
    await vocabulary.setSchool("inactive");
    let count = 0,
      jobs = [],
      configured = false,
      enabled = false,
      sessions = [];
    const state = () => ({
      configured,
      enabled,
      allowedScopes: ["workspace:read", "projects:read", "jobs:read"],
      availableBindings: ["127.0.0.1"],
      binding: enabled ? { origin: "https://127.0.0.1:8443" } : null,
      sessions,
    });
    window.__requests = [];
    window.studio={sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),
      operations: async (input) => {
        window.__requests.push(input);
        let result = {};
        const r = input.request;
        if (input.action === "file.release") result={released:input.ids?.length||0};
        else if (input.action === "file.choose")
          result = {
            id: `grant-${++count}`,
            name: input.access === "write" ? "output.txt" : "example.txt",
            kind: input.kind,
          };
        else if (input.action === "payload.list")
          result = [
            {
              toolId: "qpdf",
              available: false,
              code: "MISSING_VERIFIED_PAYLOAD",
            },
          ];
        else if (input.action === "tools") {
          if (r.action === "converter.inspect") result = {name:"example.txt",bytes:3,mime:"text/plain"};
          else if (r.action === "pdf.catalog") result = {operations:[{operation:"extract",available:false,attemptAvailable:true}]};
          else if (r.action === "converter.catalog")
            result = {
              categories: [
                {
                  category: "text",
                  formats: [
                    { format: "txt", adapter: "native", available: true },
                  ],
                },
              ],
            };
          else if (r.action === "queue.add") {
            const job = {
              id: `job-${++count}`,
              state: "queued",
              request: r.job,
            };
            jobs.push(job);
            result = { job };
          } else if (r.action === "queue.page")
            result = { items: jobs, next: null };
          else if (r.action === "queue.cancel") {
            jobs.find((j) => j.id === r.id).state = "cancelled";
          } else if (r.action === "queue.run") {
            jobs.forEach((j) => {
              if (j.state === "queued") j.state = "completed";
            });
            result = {
              completed: jobs.filter((j) => j.state === "completed").length,
              failed: 0,
            };
          } else if (r.action === "pdf.execute")
            result = { ok: false, code: "ISOLATED_RUNTIME_REQUIRED" };
          else if (r.action === "converter.convert") result = { bytes: 42 };
        } else if (input.action === "companion") {
          if (r.action === "companion.configure") configured = true;
          if (r.action === "companion.start") enabled = true;
          if (r.action === "companion.stop") {
            enabled = false;
            sessions = [];
          }
          if (r.action === "companion.createPairing")
            return {
              ok: true,
              result: {
                challenge: "fixture-not-a-real-code",
                origin: r.args.origin,
                expiresAt: Date.now() + 300000,
              },
            };
          if (r.action === "companion.revoke") {
            sessions = sessions.map((s) => ({ ...s, status: "revoked" }));
            return { ok: true, result: { revoked: true } };
          }
          result = state();
        }
        return { ok: true, result };
      },
    };
    document.body.innerHTML = "";
    const panel = document.createElement("operations-panel");
    panel.language = language;
    panel.style.height = "calc(100vh - 48px)";
    document.body.append(panel);
    document.documentElement.style.cssText = "height:auto;overflow:auto";
    document.body.style.cssText =
      "height:auto;overflow:visible;margin:24px;font-family:Arial;background:#f7f8fc;color:#181c22";
  }, language);
  return errors;
}
const button = (page, name) => page.getByRole("button", { name, exact: true });
test("typed converter and PDF forms submit grants, queue transitions and honest isolation error", async ({
  page,
}) => {
  const errors = await open(page);
  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await page.locator("tools-panel").evaluate(el=>el.openDestination("tool:convert"));
  await button(page, "Load formats").click();
  await page.locator('tools-panel [data-destination="convert"]').getByRole("button",{name:"TXT",exact:true}).click();
  await expect(page.locator("tools-panel")).toHaveJSProperty("category","text");
  await expect(page.locator("tools-panel")).toHaveJSProperty("format","txt");
  await button(page, "Choose source").click();
  await button(page, "Choose new output").click();
  await button(page, "Add to queue").click();
  await page.locator("tools-panel").evaluate(el=>el.openDestination("tool:queue"));
  await expect(page.locator("tools-panel")).toContainText("queued");
  await button(page, "Run queue").click();
  await expect(page.locator("tools-panel")).toContainText("completed");
  await page.locator("tools-panel").evaluate(el=>el.openDestination("tool:pdf"));
  await button(page, "Load PDF operations").click();
  await button(page, "Add PDF source").click();
  await button(page, "Choose PDF output").click();
  await button(page, "Attempt isolated PDF operation").click();
  await expect(page.locator("tools-panel div[role=status][aria-live=polite]:visible")).toContainText(
    "ISOLATED_RUNTIME_REQUIRED",
  );
  const requests = await page.evaluate(() => window.__requests);
  expect(
    requests.find((r) => r.request?.action === "queue.add").request.job,
  ).toMatchObject({
    action: "converter.convert",
    sourceId: "grant-1",
    destinationId: "grant-2",
    format: "txt",
  });
  expect(errors).toEqual([]);
});
test("companion configuration, explicit start, pairing concealment and stop", async ({
  page,
}) => {
  const errors = await open(page);
  await page
    .getByRole("tab", { name: "Browser companion", exact: true })
    .click();
  await button(page, "Refresh companion status").click();
  await expect(button(page, "Start companion")).toBeDisabled();
  await button(page, "Choose TLS certificate and key").click();
  await button(page, "Start companion").click();
  await page
    .getByRole("textbox", { name: "Browser origin (HTTPS)", exact: true })
    .fill("https://example.com");
  await page.getByRole("textbox",{name:"Device label (for your approval)",exact:true}).fill("Fixture browser");
  await button(page, "Create five-minute pairing code").click();
  await expect(
    page.locator("companion-panel md-outlined-text-field").last(),
  ).toHaveJSProperty("type", "password");
  await button(page, "Reveal code").click();
  await expect(
    page.getByRole("textbox", { name: "Pairing code", exact: true }),
  ).toHaveValue("fixture-not-a-real-code");
  await button(page, "Stop and revoke sessions").click();
  await expect(page.locator("companion-panel")).toContainText(
    "listener stopped",
  );
  await expect(button(page, "Reveal code")).toHaveCount(0);
  expect(errors).toEqual([]);
});
for (const width of [960, 1440])
  for (const theme of ["light", "dark"])
    test(`tools and companion fixture capture bilingual ${theme} ${width}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const errors = await open(page, "bilingual");
      if (theme === "dark")
        await page.evaluate(
          () =>
            (document.body.style.cssText +=
              ";background:#181c22;color:#e0e3ea;--md-sys-color-primary:#d0bcff;--md-sys-color-on-primary:#381e72;--md-sys-color-surface:#181c22;--md-sys-color-on-surface:#e0e3ea;--md-sys-color-on-surface-variant:#c3c7d0;--md-sys-color-surface-container:#252a32;--md-sys-color-outline:#8d9199;"),
        );
      await page
        .getByRole("tab", { name: "Tools · 工具", exact: true })
        .click();
      await page.locator('tools-panel').evaluate(el=>el.openDestination('tool:convert'));
      await page
        .getByRole("button", { name: "Load formats · 載入格式", exact: true })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(`tools-fixture-${theme}-${width}.png`),
        fullPage: true,
      });
      await page
        .getByRole("tab", {
          name: "Browser companion · 瀏覽器配對",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Refresh companion status · 重新整理配對狀態",
          exact: true,
        })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(`companion-fixture-${theme}-${width}.png`),
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
