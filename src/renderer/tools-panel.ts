import {materialIcon, actionIcon, actionSymbol} from "./material-icons";
import { LitElement, html, css, nothing } from "lit";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/progress/linear-progress.js";
import { workspaceStyles } from "./workspace-styles";
type Grant = { id: string; name: string; kind: string };
type Category = {
  category: string;
  formats: { format: string; adapter: string; available: boolean }[];
};
type QueueItem = {
  id: string;
  state: string;
  request: { action: string };
  result?: { code?: string };
};
export class ToolsPanel extends LitElement {
  static properties = { language: { type: String }, revision: { state: true } };
  language = "bilingual";
  revision = 0;
  private pending = false;
  private runningQueue = false;
  private feedback = "";
  private categories: Category[] = [];
  private category = "text";
  private format = "txt";
  private source?: Grant;
  private destination?: Grant;
  private pdfSources: Grant[] = [];
  private pdfDestination?: Grant;
  private pdfOperation = "inspect";
  private pages = "1";
  private degrees = "90";
  private jobs: QueueItem[] = [];
  private next: string | null = null;
  private payloads: {
    toolId: string;
    available: boolean;
    version?: string;
    code?: string;
  }[] = [];
  private model = "";
  private versions: { id: string; type: string }[] = [];
  private version = "";
  private directory?: Grant;
  private readDirectory?: Grant;
  private serverId = "local-server";
  private memory = "2048";
  private port = "25565";
  private players = "20";
  private difficulty = "normal";
  private mode = "survival";
  private eula = false;
  private serverRunning: boolean | undefined;
  static styles = [
    workspaceStyles,
    css`
      :host {
        display: block;
        height: auto;
        color: inherit;
        font-family: inherit;
      }
      :host {
        --md-sys-color-primary: inherit;
        --md-sys-color-on-primary: inherit;
        --md-sys-color-primary-container: inherit;
        --md-sys-color-on-primary-container: inherit;
        --md-sys-color-surface: inherit;
        --md-sys-color-surface-container: inherit;
        --md-sys-color-surface-container-low: inherit;
        --md-sys-color-surface-container-high: inherit;
        --md-sys-color-on-surface: inherit;
        --md-sys-color-on-surface-variant: inherit;
        --md-sys-color-outline: inherit;
        --md-sys-color-outline-variant: inherit;
        --md-sys-color-secondary-container: inherit;
        --md-sys-color-on-secondary-container: inherit;
        --md-sys-color-error: inherit;
      }
      :host([hidden]) {
        display: none;
      }
      .stack {
        display: grid;
        gap: 16px;
      }
      .columns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .record {
        padding: 12px 0;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
        overflow-wrap: anywhere;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .row > * {
        min-width: 0;
      }
      md-outlined-text-field,
      md-outlined-select {
        max-width: 100%;
        width: 100%;
      }
      .row md-outlined-text-field {
        flex: 1;
        min-width: 160px;
      }
      h2,
      h3,
      p {
        margin: 0;
      }
      a { color: var(--md-sys-color-primary); text-underline-offset: 3px; }
      a:focus-visible { outline: 3px solid var(--md-sys-color-primary); outline-offset: 4px; border-radius: 2px; }
      .note {
        color: var(--md-sys-color-on-surface-variant);
      }
      @media (max-width: 1000px) {
        .columns {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];
  private l(en: string, zh: string) {
    return this.language === "en"
      ? en
      : this.language === "zh-HK"
        ? zh
        : `${en} · ${zh}`;
  }
  private changed() {
    this.revision++;
  }
  private async call(action: string, fields: Record<string, unknown> = {}) {
    if (!window.studio?.operations) throw new Error("DESKTOP_REQUIRED");
    const reply: { ok: boolean; code?: string; result?: any } =
      await window.studio.operations({ action, ...fields });
    if (!reply.ok) throw new Error(reply.code);
    if (reply.result?.ok === false) throw new Error(reply.result.code);
    if (reply.result?.cancelled) throw new Error("CANCELLED");
    return reply.result;
  }
  private tool(request: Record<string, unknown>) {
    return this.call("tools", { request });
  }
  private async run(work: () => Promise<void>) {
    if (this.pending) return;
    this.pending = true;
    this.feedback = "";
    this.changed();
    try {
      await work();
      this.feedback ||= this.l("Completed.", "已完成。");
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : "OPERATION_FAILED";
      this.feedback = `${this.l("Operation not completed", "操作未完成")}: ${code}`;
    } finally {
      this.pending = false;
      this.changed();
    }
  }
  private button(
    en: string,
    zh: string,
    work: () => Promise<void>,
    disabled = false,
  ) {
    if (/^(Refresh|Remove|Move|Stop|Cancel|Revoke)\b/.test(en)) return html`<md-icon-button aria-label=${this.l(en,zh)} title=${this.l(en,zh)} ?disabled=${this.pending||disabled} @click=${()=>this.run(work)}>${materialIcon(actionSymbol(en))}</md-icon-button>`;
    return html`<md-outlined-button
      ?disabled=${this.pending || disabled}
      @click=${() => this.run(work)}
      >${actionIcon(en)}${this.l(en, zh)}</md-outlined-button
    >`;
  }
  private field(
    label: string,
    value: string,
    set: (value: string) => void,
    type = "text",
  ) {
    return html`<md-outlined-text-field
      .label=${label}
      .value=${value}
      .type=${type}
      ?disabled=${this.pending}
      @input=${(e: Event) => {
        set((e.target as HTMLInputElement).value);
        this.changed();
      }}
    ></md-outlined-text-field>`;
  }
  private select(
    label: string,
    value: string,
    values: string[],
    set: (value: string) => void,
  ) {
    return html`<md-outlined-select
      .label=${label}
      .value=${value}
      .displayText=${value}
      ?disabled=${this.pending}
      @change=${(e: Event) => {
        set((e.target as HTMLSelectElement).value);
        this.changed();
      }}
      >${values.map(
        (v) =>
          html`<md-select-option .value=${v}
            ><div slot="headline">${v}</div></md-select-option
          >`,
      )}</md-outlined-select
    >`;
  }
  private async choose(
    access: "read" | "write",
    kind: "file" | "directory" = "file",
  ): Promise<Grant> {
    return this.call("file.choose", { access, kind });
  }
  private conversion() {
    return {
      action: "converter.convert",
      category: this.category,
      format: this.format,
      sourceId: this.source?.id,
      destinationId: this.destination?.id,
    };
  }
  private async queuePage(after = "") {
    const result = await this.tool({ action: "queue.page", after, limit: 25 });
    this.jobs = after ? [...this.jobs, ...result.items] : result.items;
    this.next = result.next;
  }
  private result(result: {
    bytes?: number;
    pages?: number;
    pageCounts?: number[];
  }) {
    this.feedback = [
      this.l("Completed", "已完成"),
      result.bytes !== undefined ? `${result.bytes} bytes` : "",
      result.pageCounts
        ? `${this.l("Pages", "頁數")}: ${result.pageCounts.join(", ")}`
        : "",
      result.pages !== undefined
        ? `${result.pages} ${this.l("pages", "頁")}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  private pdfReady() {
    return (
      !!this.pdfSources.length &&
      (this.pdfOperation === "inspect" || !!this.pdfDestination) &&
      (["merge", "inspect"].includes(this.pdfOperation) ||
        this.pdfSources.length === 1)
    );
  }
  private async executePdf(queued: boolean) {
    const requiresPages = ["split", "extract", "reorder", "rotate"].includes(
      this.pdfOperation,
    );
    if (requiresPages && !/^\s*[1-9]\d*(\s*,\s*[1-9]\d*)*\s*$/.test(this.pages))
      throw new Error("INVALID_PAGE_SELECTION");
    const request = {
      action: "pdf.execute",
      operation: this.pdfOperation,
      sourceIds: this.pdfSources.map((s) => s.id),
      ...(this.pdfOperation !== "inspect"
        ? { destinationId: this.pdfDestination?.id }
        : {}),
      ...(requiresPages ? { pages: this.pages.split(",").map(Number) } : {}),
      ...(this.pdfOperation === "rotate"
        ? { degrees: Number(this.degrees) }
        : {}),
      ...(this.pdfOperation === "metadata" ? { mode: "remove" } : {}),
    };
    if (queued) {
      await this.tool({ action: "queue.add", job: request });
      await this.queuePage();
    } else this.result(await this.tool(request));
    this.pdfDestination = undefined;
  }
  render() {
    const formats = this.categories.find(
      (c) => c.category === this.category,
    )?.formats;
    const requiresPages = ["split", "extract", "reorder", "rotate"].includes(
      this.pdfOperation,
    );
    return html`<div class="stack" aria-busy=${this.pending}>
      ${this.pending || this.runningQueue
        ? html`<md-linear-progress
            indeterminate
            aria-label=${this.l("Operation in progress", "操作進行中")}
          ></md-linear-progress>`
        : nothing}
      <div role="status" aria-live="polite">${this.feedback}</div>
      <section class="panel stack">
        <h2>${this.l("Local tools", "本機工具")}</h2>
        <p class="note">
          ${this.l(
            "Choose trusted executables through the desktop review. Files are selected with native dialogs; outputs must be new files.",
            "透過桌面審核選擇可信執行檔。請用原生對話框選擇檔案，輸出必須係新檔案。",
          )}
        </p>
        ${this.button("Check tool availability", "檢查工具可用性", async () => {
          const r = await this.call("payload.list");
          this.payloads = Array.isArray(r) ? r : r.tools;
        })}
        ${this.payloads.map(
          (p) =>
            html`<div class="row record">
              <strong>${p.toolId}</strong
              ><span
                >${p.available
                  ? this.l("Available", "可用")
                  : p.code || this.l("Unavailable", "未能使用")}</span
              >${p.version
                ? html`<span>${p.version}</span>`
                : nothing}${this.button(
                "Choose executable",
                "選擇執行檔",
                async () => {
                  await this.call("payload.choose", { toolId: p.toolId });
                  const r = await this.call("payload.list");
                  this.payloads = Array.isArray(r) ? r : r.tools;
                },
              )}
            </div>`,
        )}
      </section>
      <div class="columns">
        <section class="panel stack">
          <h2>${this.l("Convert a file", "轉換檔案")}</h2>
          ${this.button("Load formats", "載入格式", async () => {
            this.categories = (
              await this.tool({ action: "converter.catalog" })
            ).categories;
          })}
          ${this.categories.length
            ? html`${this.select(
                  this.l("Category", "類別"),
                  this.category,
                  this.categories.map((c) => c.category),
                  (v) => {
                    this.category = v;
                    this.format = this.categories.find(
                      (c) => c.category === v,
                    )!.formats[0].format;
                  },
                )}${this.select(
                  this.l("Output format", "輸出格式"),
                  this.format,
                  formats?.map((f) => f.format) || [],
                  (v) => (this.format = v),
                )}
                <p class="note">
                  ${formats?.find((f) => f.format === this.format)?.available
                    ? this.l(
                        "Built-in conversion is available.",
                        "內置轉換可用。",
                      )
                    : this.l(
                        "Requires a verified adapter and an isolated runtime. Admission alone does not enable conversion.",
                        "需要已驗證轉換工具同隔離執行環境，單靠接入工具唔會啟用轉換。",
                      )}
                </p>`
            : nothing}
          <div class="row">
            ${this.button("Choose source", "選擇來源", async () => {
              this.source = await this.choose("read");
            })}<span>${this.source?.name}</span>
          </div>
          <div class="row">
            ${this.button("Choose new output", "選擇新輸出", async () => {
              this.destination = await this.choose("write");
            })}<span>${this.destination?.name}</span>
          </div>
          <div class="row">
            ${this.button(
              "Convert now",
              "立即轉換",
              async () => {
                this.result(await this.tool(this.conversion()));
                this.destination = undefined;
              },
              !this.source || !this.destination || !this.categories.length,
            )}${this.button(
              "Add to queue",
              "加入佇列",
              async () => {
                await this.tool({
                  action: "queue.add",
                  job: this.conversion(),
                });
                this.destination = undefined;
                await this.queuePage();
              },
              !this.source || !this.destination || !this.categories.length,
            )}
          </div>
        </section>
        <section class="panel stack">
          <h2>${this.l("PDF workspace", "PDF 工作區")}</h2>
          <p class="note">
            ${this.l(
              "PDF operations require qpdf and verified isolation. Add sources in merge order. Page numbers start at 1.",
              "PDF 操作需要 qpdf 同已驗證隔離環境。請按合併次序加入來源，頁碼由 1 開始。",
            )}
          </p>
          ${this.select(
            this.l("Operation", "操作"),
            this.pdfOperation,
            [
              "inspect",
              "merge",
              "split",
              "extract",
              "reorder",
              "rotate",
              "metadata",
            ],
            (v) => (this.pdfOperation = v),
          )}
          ${this.button(
            "Add PDF source",
            "加入 PDF 來源",
            async () => {
              this.pdfSources = [...this.pdfSources, await this.choose("read")];
            },
            this.pdfSources.length >= 100,
          )}
          ${this.pdfSources.map(
            (s, i) =>
              html`<div class="row">
                <span>${i + 1}. ${s.name}</span>${this.button(
                  "Remove",
                  "移除",
                  async () => {
                    this.pdfSources = this.pdfSources.filter((_, j) => j !== i);
                  },
                )}
              </div>`,
          )}
          ${requiresPages
            ? this.field(
                this.l(
                  "Pages in order (for example 3,1,2)",
                  "頁碼次序（例如 3,1,2）",
                ),
                this.pages,
                (v) => (this.pages = v),
              )
            : nothing}
          ${this.pdfOperation === "rotate"
            ? this.select(
                this.l("Clockwise degrees", "順時針角度"),
                this.degrees,
                ["90", "180", "270"],
                (v) => (this.degrees = v),
              )
            : nothing}
          ${this.pdfOperation === "metadata"
            ? html`<p>
                ${this.l(
                  "Removes document information and metadata.",
                  "移除文件資訊同中繼資料。",
                )}
              </p>`
            : nothing}
          ${this.pdfOperation !== "inspect"
            ? html`<div class="row">
                ${this.button(
                  "Choose PDF output",
                  "選擇 PDF 輸出",
                  async () => {
                    this.pdfDestination = await this.choose("write");
                  },
                )}<span>${this.pdfDestination?.name}</span>
              </div>`
            : nothing}
          <div class="row">
            ${this.button(
              "Run PDF operation",
              "執行 PDF 操作",
              () => this.executePdf(false),
              !this.pdfReady(),
            )}${this.button(
              "Queue PDF operation",
              "排程 PDF 操作",
              () => this.executePdf(true),
              !this.pdfReady(),
            )}
          </div>
        </section>
      </div>
      <section class="panel stack">
        <h2>${this.l("File and model queue", "檔案同模型佇列")}</h2>
        <p class="note">
          ${this.l(
            "Jobs run when you choose Run queue. File permissions must be selected again after restarting the app.",
            "選擇執行佇列先會開始工作，重新啟動應用程式後需要重新選擇檔案權限。",
          )}
        </p>
        <div class="row">
          ${this.field(
            this.l("Ollama model name", "Ollama 模型名稱"),
            this.model,
            (v) => (this.model = v),
          )}${this.button(
            "Queue model download",
            "排程模型下載",
            async () => {
              await this.tool({
                action: "queue.add",
                job: { action: "ollama.pull", model: this.model.trim() },
              });
              await this.queuePage();
            },
            !this.model.trim(),
          )}
        </div>
        <div class="row">
          ${this.button("Refresh queue", "重新整理佇列", () =>
            this.queuePage(),
          )}${this.button(
            "Recover interrupted jobs",
            "復原中斷工作",
            async () => {
              await this.tool({ action: "queue.recover" });
              await this.queuePage();
            },
            this.runningQueue,
          )}<md-outlined-button
            ?disabled=${this.runningQueue || this.pending}
            @click=${async () => {
              this.runningQueue = true;
              this.changed();
              try {
                const r = await this.tool({ action: "queue.run" });
                this.feedback = `${this.l("Queue finished", "佇列已完成")}: ${r.completed} / ${r.failed}`;
                await this.queuePage();
              } catch (e) {
                this.feedback = this.l(
                  "Queue could not finish. Refresh its status.",
                  "佇列未能完成，請重新整理狀態。",
                );
              } finally {
                this.runningQueue = false;
                this.changed();
              }
            }}
            >${actionIcon('Run queue')}${this.l("Run queue", "執行佇列")}</md-outlined-button
          >
        </div>
        ${this.jobs.map(
          (j) =>
            html`<div class="row record">
              <span>${j.request.action}</span><strong>${j.state}</strong
              ><span>${j.result?.code}</span>${[
                "queued",
                "running",
                "interrupted",
              ].includes(j.state)
                ? this.button("Cancel job", "取消工作", async () => {
                    await this.tool({ action: "queue.cancel", id: j.id });
                    await this.queuePage();
                  })
                : nothing}${["interrupted", "failed", "cancelled"].includes(
                j.state,
              )
                ? this.button("Retry job", "重試工作", async () => {
                    await this.tool({ action: "queue.resume", id: j.id });
                    await this.queuePage();
                  })
                : nothing}
            </div>`,
        )}${!this.jobs.length
          ? html`<p>
              ${this.l(
                "No jobs loaded. Refresh to check saved jobs.",
                "未載入工作，請重新整理以檢查已儲存工作。",
              )}
            </p>`
          : nothing}${this.next
          ? this.button("Load more jobs", "載入更多工作", () =>
              this.queuePage(this.next!),
            )
          : nothing}
      </section>
      <section class="panel stack">
        <h2>${this.l("Minecraft Java server", "Minecraft Java 伺服器")}</h2>
        <p class="note">
          ${this.l(
            "Manage a local vanilla Java server in a dedicated folder. Existing server files are preserved. Other editions, plugins, SSH and container setup remain unavailable here.",
            "喺專用資料夾管理本機原版 Java 伺服器，保留現有伺服器檔案。此處未提供其他版本、插件、SSH 同容器設定。",
          )}
        </p>
        ${this.button(
          "Discover official versions",
          "探索官方版本",
          async () => {
            this.versions = (
              await this.tool({ action: "minecraft.versions", edition: "java" })
            ).versions;
            this.version = this.versions[0]?.id || "";
          },
        )}
        ${this.versions.length
          ? this.select(
              this.l("Version", "版本"),
              this.version,
              this.versions.map((v) => v.id),
              (v) => (this.version = v),
            )
          : nothing}
        <div class="row">
          ${this.button(
            "Choose installation folder",
            "選擇安裝資料夾",
            async () => {
              this.directory = await this.choose("write", "directory");
            },
          )}<span>${this.directory?.name}</span>${this.button(
            "Install selected version",
            "安裝所選版本",
            async () => {
              await this.tool({
                action: "minecraft.install",
                edition: "java",
                version: this.version,
                directoryId: this.directory?.id,
              });
            },
            !this.directory || !this.version,
          )}
        </div>
        <div class="columns">
          ${this.field(
            this.l("Server port", "伺服器連接埠"),
            this.port,
            (v) => (this.port = v),
            "number",
          )}${this.field(
            this.l("Maximum players", "玩家上限"),
            this.players,
            (v) => (this.players = v),
            "number",
          )}${this.select(
            this.l("Difficulty", "難度"),
            this.difficulty,
            ["peaceful", "easy", "normal", "hard"],
            (v) => (this.difficulty = v),
          )}${this.select(
            this.l("Game mode", "遊戲模式"),
            this.mode,
            ["survival", "creative", "adventure", "spectator"],
            (v) => (this.mode = v),
          )}
        </div>
        <label class="row"
          ><md-checkbox
            aria-label=${this.l("I have read and accept the Minecraft EULA.", "我已閱讀並接受 Minecraft EULA。")}
            ?checked=${this.eula}
            ?disabled=${this.pending}
            @change=${(e: Event) => {
              this.eula = (e.target as HTMLInputElement).checked;
              this.changed();
            }}
          ></md-checkbox
          ><span
            >${this.l(
              "I have read and accept the Minecraft EULA.",
              "我已閱讀並接受 Minecraft EULA。",
            )}</span
          ><a
            href="https://www.minecraft.net/eula"
            target="_blank"
            rel="noreferrer"
            >Minecraft EULA</a
          ></label
        >
        ${this.button(
          "Create initial configuration",
          "建立初始設定",
          async () => {
            await this.tool({
              action: "minecraft.configure",
              directoryId: this.directory?.id,
              acceptEula: this.eula,
              properties: {
                "server-port": Number(this.port),
                "max-players": Number(this.players),
                "online-mode": true,
                "white-list": true,
                difficulty: this.difficulty,
                gamemode: this.mode,
              },
            });
          },
          !this.directory || !this.eula,
        )}
        <p class="note">
          ${this.l(
            "Online authentication and the allowlist are enabled. Existing configuration is never replaced.",
            "已啟用線上驗證同允許清單，唔會取代現有設定。",
          )}
        </p>
        <div class="row">
          ${this.button(
            "Choose existing server folder",
            "選擇現有伺服器資料夾",
            async () => {
              this.readDirectory = await this.choose("write", "directory");
            },
          )}<span>${this.readDirectory?.name}</span>
        </div>
        <div class="columns">
          ${this.field(
            this.l("Server identifier", "伺服器識別碼"),
            this.serverId,
            (v) => {
              this.serverId = v;
              this.serverRunning = undefined;
            },
          )}${this.field(
            this.l("Memory (MiB)", "記憶體（MiB）"),
            this.memory,
            (v) => (this.memory = v),
            "number",
          )}
        </div>
        <div class="row">
          ${this.button(
            "Start server",
            "啟動伺服器",
            async () => {
              await this.tool({
                action: "minecraft.start",
                serverId: this.serverId,
                directoryId: this.readDirectory?.id,
                target: "local-process",
                memoryMiB: Number(this.memory),
              });
              this.serverRunning = true;
            },
            !this.readDirectory ||
              !this.serverId.trim() ||
              this.serverRunning === true,
          )}${this.button(
            "Check server status",
            "檢查伺服器狀態",
            async () => {
              this.serverRunning = (
                await this.tool({
                  action: "minecraft.status",
                  serverId: this.serverId,
                })
              ).running;
            },
            !this.serverId.trim(),
          )}${this.button(
            "Stop server",
            "停止伺服器",
            async () => {
              await this.tool({
                action: "minecraft.stop",
                serverId: this.serverId,
              });
              this.serverRunning = undefined;
              this.feedback = this.l(
                "Stop requested. Check status to confirm exit.",
                "已要求停止，請檢查狀態以確認結束。",
              );
            },
            this.serverRunning !== true,
          )}<span
            >${this.serverRunning === undefined
              ? this.l("Status not checked", "未檢查狀態")
              : this.serverRunning
                ? this.l("Running", "執行中")
                : this.l("Stopped", "已停止")}</span
          >
        </div>
      </section>
    </div>`;
  }
}
customElements.define("tools-panel", ToolsPanel);
