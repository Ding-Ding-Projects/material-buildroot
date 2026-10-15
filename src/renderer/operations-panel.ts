import { LitElement, html, nothing, css } from "lit";
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/switch/switch.js";
import "@material/web/progress/linear-progress.js";
import "./regex-workbench";
import "./guest-panel";
import "./tools-panel";
import "./companion-panel";
import "./source-panel";
import "./package-panel";
import { workspaceStyles } from "./workspace-styles";
type Reply = { ok: true; result: any } | { ok: false; code: string };
type Job = {
  id: string;
  kind: string;
  state: string;
  sequence: number;
  createdAt: string;
  logCount: number;
};
/** Typed task controls. Host operations remain the authority for paths and execution. */
export class OperationsPanel extends LitElement {
  static properties = {
    language: { type: String },
    tab: { state: true },
    pending: { state: true },
    feedback: { state: true },
    runtime: { state: true },
    selection: { state: true },
    workspace: { state: true },
    jobs: { state: true },
    logs: { state: true },
    selectedJob: { state: true },
    config: { state: true },
    changes: { state: true },
    defconfigs: { state: true },
    artifacts: { state: true },
    artifact: { state: true },
    models: { state: true },
    messages: { state: true },
    updateState: { state: true },
    runtimeKind: { state: true },
    distribution: { state: true },
    image: { state: true },
    parallelism: { state: true },
    target: { state: true },
    trust: { state: true },
    model: { state: true },
    prompt: { state: true },
    configPage: { state: true },
    dockHeight: { state: true },
    dockOpen: { state: true },
  };
  language = "bilingual";
  tab = "runtime";
  pending = false;
  feedback = "";
  runtime: any;
  selection: any;
  workspace: any;
  jobs: Job[] = [];
  logs: any[] = [];
  selectedJob = "";
  config: any;
  changes: Record<string, { type: string; value: unknown }> = {};
  defconfigs: any[] = [];
  artifacts: any[] = [];
  artifact: any;
  models: any[] = [];
  messages: { role: "user" | "assistant"; content: string }[] = [];
  updateState: any;
  runtimeKind = "docker";
  distribution = "";
  image = "";
  parallelism = 2;
  target = "all";
  trust = false;
  model = "";
  prompt = "";
  configPage = 0;
  dockHeight = 140;
  dockOpen = true;
  private logCursor = 0;
  private logMore = false;
  static styles = [
    workspaceStyles,
    css`
      :host {
        height: auto;
        min-height: 0;
        font-family: inherit;
        color: inherit;
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
      .guest-host[hidden],
      .regex-host[hidden] {
        display: none;
      }
      .ide { display:flex; height:100%; min-height:0; overflow:hidden; border:1px solid var(--md-sys-color-outline-variant); }
      .explorer { width:180px; flex-shrink:0; overflow:auto; background:var(--md-sys-color-surface-container-low); border-right:1px solid var(--md-sys-color-outline-variant);padding:8px; }
      .explorer h2 {font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:8px 4px;}
      .explorer .project-name{font-size:12px;font-weight:600;padding:8px 4px;overflow-wrap:anywhere}
      .explorer md-text-button{display:flex;width:100%;justify-content:flex-start;--md-text-button-container-height:32px;--md-text-button-container-shape:4px;font-size:12px}
      .explorer .active{background:var(--md-sys-color-secondary-container)}
      .editor-frame{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
      .document-toolbar{display:flex;gap:8px;align-items:center;padding:4px 8px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:12px;min-height:36px}
      .document-toolbar strong{margin-right:auto}.document-toolbar md-text-button{--md-text-button-container-height:28px}
      .dock{flex-shrink:0;display:flex;flex-direction:column;border-top:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low);overflow:hidden}
      .dock-resizer{height:5px;cursor:ns-resize;flex-shrink:0;background:var(--md-sys-color-outline-variant)}
      .dock-content{display:flex;min-height:0;flex:1;overflow:hidden}.dock-jobs{width:220px;overflow:auto;border-right:1px solid var(--md-sys-color-outline-variant)}
      .dock-jobs md-text-button{width:100%;--md-text-button-container-height:30px;font-size:11px}.dock-log{flex:1;min-width:0;overflow:auto;white-space:pre-wrap;font:12px/1.5 monospace;padding:8px}
      .dock-empty{font:12px/1.5 inherit;padding:8px;color:var(--md-sys-color-on-surface-variant)}
      .operations > .content{overflow:auto;flex:1;min-height:0;padding:12px;gap:8px}
      .operations > [hidden]{display:none!important}
      .operations > guest-panel,.operations > source-panel,.operations > package-panel,.operations > tools-panel,.operations > companion-panel,.operations > regex-workbench{flex:1;min-height:0;overflow:auto;padding:8px}
      .operations > md-tabs{min-height:38px;--md-primary-tab-container-height:38px}
      .panel{border-radius:0;padding:12px;background:transparent;border-bottom:1px solid var(--md-sys-color-outline-variant)}
      .operations {
        display: flex;
        flex-direction: column;
        gap: 0;
        flex:1;min-height:0;overflow:hidden;
      }
      md-tabs {
        --md-primary-tab-container-color: var(--md-sys-color-surface);
        flex-shrink: 0;
      }
      md-primary-tab {
        flex: 0 0 auto;
        min-width: max-content;
      }
      .content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .split {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .record {
        padding: 12px 0;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
      }
      .log {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        max-height: 360px;
        overflow: auto;
        padding: 16px;
        background: var(--md-sys-color-surface-container-high);
        border-radius: 12px;
        font: 13px/1.5 monospace;
      }
      .symbol {
        font-family: monospace;
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .config-row {
        display: grid;
        grid-template-columns: minmax(160px, 1fr) minmax(120px, 1fr);
        gap: 12px;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
      }
      .consent {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .message {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        padding: 12px;
        border-radius: 12px;
        background: var(--md-sys-color-surface-container);
      }
      .message strong {
        display: block;
        margin-bottom: 8px;
      }
      .status {
        border-radius: 12px;
      }
      md-primary-tab {
        min-width: 100px;
      }
      md-tabs {
        max-width: 100%;
        overflow: auto;
      }
      @media (max-width:1100px){.explorer{width:140px}.explorer md-text-button{font-size:11px}.dock-jobs{width:160px}}
      @media (max-width:750px){.explorer{display:none}}
      @media (max-width: 850px) {
        .split {
          grid-template-columns: 1fr;
        }
        .config-row {
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
  private get api() {
    return (
      window.studio as unknown as {
        operations?: (request: Record<string, unknown>) => Promise<Reply>;
      }
    )?.operations;
  }
  private async run(action: string, fields: Record<string, unknown> = {}) {
    if (!this.api) {
      this.feedback = this.l(
        "Desktop operations are unavailable. Restart with a connected desktop host.",
        "未能使用桌面操作，請喺已連接嘅桌面主機重新啟動。",
      );
      return undefined;
    }
    if (this.pending) return undefined;
    this.pending = true;
    this.feedback = "";
    try {
      const reply = await this.api({ action, ...fields });
      if (!reply.ok) {
        this.feedback =
          this.l("Operation was not completed", "未完成操作") +
          `: ${reply.code}` +
          (reply.code === "PROJECT_NOT_ADOPTED"
            ? this.l(
                ". Choose the same project folders again to renew access before retrying.",
                "。請重新選擇相同專案資料夾，更新存取授權後再試。",
              )
            : "");
        return undefined;
      }
      return reply.result;
    } catch {
      this.feedback = this.l(
        "Operation outcome unavailable. Refresh the relevant records before retrying.",
        "未能確認操作結果，請先重新整理相關記錄再試。",
      );
      return undefined;
    } finally {
      this.pending = false;
    }
  }
  private async choosePython() {
    const result = await this.run("runtime.python.choose");
    if (result !== undefined)
      this.feedback = result.available
        ? this.l(
            "Python admitted for Kconfig inspection",
            "已授權 Python 用於 Kconfig 檢視",
          ) + `: ${result.version}`
        : this.l("Python could not be admitted.", "未能授權 Python。");
  }
  private configEntries() {
    if (!this.config?.semantics?.available)
      return (this.config?.entries ?? []).filter((entry: any) => entry.symbol);
    const entries: any[] = [];
    const seen = new Set<string>();
    const visit = (node: any, path: string[]) => {
      const next =
        node.kind === "menu" && node.prompt ? [...path, node.prompt] : path;
      if (node.symbol && !seen.has(node.symbol)) {
        seen.add(node.symbol);
        entries.push({
          ...node,
          menu: next.join(" / "),
          value: node.type === "bool" ? node.value === "y" : node.value,
        });
      }
      for (const child of node.children ?? []) visit(child, next);
    };
    visit(this.config.semantics.tree, []);
    return entries;
  }
  private async discover() {
    const result = await this.run("runtime.discover");
    if (result !== undefined) this.runtime = result;
  }
  private async choose() {
    const result = await this.run("project.choose");
    if (result !== undefined) {
      this.selection = result;
      this.trust = false;
    }
  }
  private async adopt() {
    if (!this.selection || !this.trust) return;
    const result = await this.run("project.adopt", {
      selectionId: this.selection.selectionId,
      trust: true,
    });
    if (result !== undefined) {
      this.workspace = result;
      this.config = undefined;
      this.artifacts = [];
      this.feedback = this.l(
        "Project adopted. Choose a runtime before requesting a build.",
        "專案已接入，要求建置前請先選擇執行環境。",
      );
      this.tab = "builds";
    }
  }
  private async refreshJobs() {
    const result = await this.run("jobs.list");
    if (Array.isArray(result)) this.jobs = result;
  }
  private currentRuntime() {
    return this.runtimeKind === "wsl"
      ? { kind: "wsl", distribution: this.distribution }
      : { kind: "docker", image: this.image, uid: 1000, gid: 1000 };
  }
  private async selectRuntime() {
    if (!this.workspace) return;
    const result = await this.run("project.runtime", {
      workspaceId: this.workspace.workspaceId,
      runtime: this.currentRuntime(),
    });
    if (result !== undefined)
      this.feedback = this.l(
        "Runtime selected for this project.",
        "已為呢個專案選擇執行環境。",
      );
  }
  private async submit() {
    if (!this.workspace) return;
    const runtime =
      this.runtimeKind === "wsl"
        ? { kind: "wsl", distribution: this.distribution }
        : { kind: "docker", image: this.image, uid: 1000, gid: 1000 };
    const result = await this.run("build.submit", {
      workspaceId: this.workspace.workspaceId,
      target: this.target,
      runtime,
      jobs: this.parallelism,
    });
    if (result !== undefined) {
      this.feedback = this.l(
        "Build request accepted. Job records determine its outcome.",
        "建置要求已接受，結果以工作記錄為準。",
      );
      await this.refreshJobs();
    }
  }
  private async jobAction(action: string, job: Job) {
    const result = await this.run("jobs." + action, {
      id: job.id,
      sequence: job.sequence,
    });
    if (result !== undefined) await this.refreshJobs();
  }
  private async readLogs(job: Job, more = false) {
    const result = await this.run("jobs.page", {
      id: job.id,
      after: more ? this.logCursor : 0,
      limit: 50,
    });
    if (result !== undefined) {
      this.selectedJob = job.id;
      this.logs = more
        ? [...this.logs, ...result.records].slice(-500)
        : result.records;
      this.logCursor = result.next;
      this.logMore = result.hasMore;
    }
  }
  private async inspectConfig() {
    if (!this.workspace) return;
    const result = await this.run("config.inspect", {
      workspaceId: this.workspace.workspaceId,
    });
    if (result !== undefined) {
      this.config = result;
      this.changes = {};
      this.configPage = 0;
    }
  }
  private async applyConfig() {
    if (!this.config || !Object.keys(this.changes).length) return;
    const result = await this.run("config.apply", {
      workspaceId: this.workspace.workspaceId,
      revision: this.config.revision,
      changes: this.changes,
    });
    if (result !== undefined) {
      this.feedback = this.l(
        "Configuration reconciled. Inspect effective values before building.",
        "設定已協調完成，建置前請檢視實際值。",
      );
      await this.inspectConfig();
    }
  }
  private async listDefconfigs() {
    const result = await this.run("config.defconfigs", {
      workspaceId: this.workspace.workspaceId,
    });
    if (Array.isArray(result)) this.defconfigs = result;
  }
  private async applyDefconfig(path: string) {
    if (!this.config) return;
    const result = await this.run("config.defconfig", {
      workspaceId: this.workspace.workspaceId,
      revision: this.config.revision,
      path,
    });
    if (result !== undefined) await this.inspectConfig();
  }
  private async undoConfig() {
    const result = await this.run("config.undo", {
      workspaceId: this.workspace.workspaceId,
      revision: this.config.revision,
    });
    if (result !== undefined) await this.inspectConfig();
  }
  private async listArtifacts() {
    const result = await this.run("artifacts.list", {
      workspaceId: this.workspace.workspaceId,
    });
    if (Array.isArray(result)) this.artifacts = result;
  }
  private async inspectArtifact(path: string) {
    const result = await this.run("artifacts.inspect", {
      workspaceId: this.workspace.workspaceId,
      path,
    });
    if (result !== undefined) this.artifact = result;
  }
  private async loadModels() {
    const result = await this.run("tools", {
      request: { action: "ollama.tags" },
    });
    if (result !== undefined) {
      this.models = result.models ?? [];
      this.model = this.models[0]?.name ?? "";
    }
  }
  private async sendMessage() {
    if (!this.prompt.trim() || !this.model) return;
    const conversation = [
      ...this.messages,
      { role: "user" as const, content: this.prompt.trim() },
    ];
    const result = await this.run("tools", {
      request: {
        action: "ollama.chat",
        model: this.model,
        messages: conversation,
      },
    });
    if (result !== undefined) {
      this.messages = conversation;
      const content = result.message?.content ?? result.content;
      if (typeof content === "string")
        this.messages = [...this.messages, { role: "assistant", content }];
      else
        this.feedback = this.l(
          "The local model request completed without a displayable response.",
          "本機模型要求已完成，但未有可顯示嘅回覆。",
        );
      this.prompt = "";
    }
  }
  private async updateAction(action: string) {
    const result = await this.run("updates." + action);
    if (result !== undefined) this.updateState = result;
  }
  private options(items: [string, string][]) {
    return items.map(
      ([value, label]) =>
        html`<md-select-option value=${value}
          ><div slot="headline">${label}</div></md-select-option
        >`,
    );
  }
  private label(tab: string) {
    const labels: Record<string, [string, string]> = {
      runtime: ["Projects & runtime", "專案同執行環境"],
      builds: ["Builds", "建置"],
      config: ["Configuration", "設定選項"],
      artifacts: ["Artifacts", "輸出檔案"],
      assistant: ["Local assistant", "本機助理"],
      updates: ["Updates", "更新"],
      regex: ["Regex workbench", "正規表達式"],
      source: ["Source", "來源"],
      package: ["Package authoring", "套件編寫"],
      tools: ["Tools", "工具"],
      companion: ["Browser companion", "瀏覽器配對"],
      guests: ["Virtual machines", "虛擬機"],
    };
    return this.l(...labels[tab]);
  }
  private noProject() {
    return html`<section class="panel">
      <h2>${this.l("Adopt a project first", "請先接入專案")}</h2>
      <p>
        ${this.l(
          "Choose an existing trusted Buildroot source and a separate output directory in Projects & runtime.",
          "請喺專案同執行環境揀選現有可信嘅 Buildroot 來源同獨立輸出目錄。",
        )}
      </p>
      <md-filled-button @click=${() => (this.tab = "runtime")}
        >${this.l("Choose project", "選擇專案")}</md-filled-button
      >
    </section>`;
  }
  private runtimeView() {
    return html`<div class="split">
      <section class="panel stack">
        <h2>${this.l("Runtime discovery", "探索執行環境")}</h2>
        <p>
          ${this.l(
            "Inspect installed WSL distributions and Docker availability. Discovery does not install or start a runtime.",
            "檢視已安裝嘅 WSL 發行版同 Docker 可用狀態，探索唔會安裝或啟動執行環境。",
          )}
        </p>
        <md-outlined-button ?disabled=${this.pending} @click=${this.discover}
          >${this.l("Discover runtimes", "探索執行環境")}</md-outlined-button
        >
        <p>
          ${this.l(
            "Kconfig inspection executes a Python interpreter you select. Choose only an interpreter you trust.",
            "Kconfig 檢視會執行你揀選嘅 Python 解譯器，請只揀選可信嘅解譯器。",
          )}
        </p>
        <md-outlined-button
          ?disabled=${this.pending}
          @click=${this.choosePython}
          >${this.l(
            "Choose trusted Python",
            "揀選可信 Python",
          )}</md-outlined-button
        >${this.runtime
          ? html`<dl>
              <dt>Docker</dt>
              <dd>
                ${this.runtime.docker?.available
                  ? this.l("Available", "可使用")
                  : this.l("Unavailable", "未能使用")}
              </dd>
              <dt>WSL</dt>
              <dd>
                ${(this.runtime.wsl?.distributions ?? []).map(
                  (d: any) =>
                    html`<p>
                      ${typeof d === "string" ? d : d.name} ${d.version ?? ""}
                    </p>`,
                )}
              </dd>
            </dl>`
          : nothing}
      </section>
      <section class="panel stack">
        <h2>${this.l("Existing Buildroot project", "現有 Buildroot 專案")}</h2>
        <p>
          ${this.l(
            "The native picker grants access to the source and output directories you choose. Existing files are preserved during adoption.",
            "原生選擇器會授權存取你揀選嘅來源同輸出目錄，接入專案時會保留現有檔案。",
          )}
        </p>
        <md-filled-button ?disabled=${this.pending} @click=${this.choose}
          >${this.l(
            "Choose source and output",
            "選擇來源同輸出",
          )}</md-filled-button
        >${this.selection
          ? html`<dl>
                <dt>${this.l("Project", "專案")}</dt>
                <dd>${this.selection.name}</dd>
                <dt>${this.l("Source", "來源")}</dt>
                <dd>${this.selection.source}</dd>
                <dt>${this.l("Output", "輸出")}</dt>
                <dd>${this.selection.output}</dd>
              </dl>
              <label class="consent"
                ><md-checkbox
                  aria-label=${this.l(
                    "I trust this source. Build steps execute code from it.",
                    "我信任呢個來源，建置步驟會執行當中嘅程式碼。",
                  )}
                  .checked=${this.trust}
                  @change=${(e: Event) =>
                    (this.trust = (e.target as HTMLInputElement).checked)}
                ></md-checkbox
                ><span
                  >${this.l(
                    "I trust this source. Build steps execute code from it.",
                    "我信任呢個來源，建置步驟會執行當中嘅程式碼。",
                  )}</span
                ></label
              ><md-filled-tonal-button
                ?disabled=${this.pending || !this.trust}
                @click=${this.adopt}
                >${this.l(
                  "Adopt trusted project",
                  "接入可信專案",
                )}</md-filled-tonal-button
              >`
          : nothing}${this.workspace
          ? html`<p class="badge">
              ${this.l("Active project", "目前專案")}: ${this.workspace.name}
            </p>`
          : nothing}
      </section>
    </div>`;
  }
  private buildsView() {
    return html`${this.workspace
        ? html`<section class="panel stack">
            <h2>${this.workspace.name}</h2>
            <div class="fields">
              <md-outlined-select
                label=${this.l("Runtime", "執行環境")}
                id="build-runtime"
                .value=${this.runtimeKind}
                .displayText=${this.runtimeKind === "wsl" ? "WSL 2" : "Docker"}
                @change=${(e: Event) =>
                  (this.runtimeKind = (e.target as HTMLSelectElement).value)}
                >${this.options([
                  ["docker", "Docker"],
                  ["wsl", "WSL 2"],
                ])}</md-outlined-select
              >${this.runtimeKind === "wsl"
                ? html`<md-outlined-text-field
                    label=${this.l("WSL distribution", "WSL 發行版")}
                    .value=${this.distribution}
                    @input=${(e: Event) =>
                      (this.distribution = (
                        e.composedPath()[0] as HTMLInputElement
                      ).value)}
                  ></md-outlined-text-field>`
                : html`<md-outlined-text-field
                    label=${this.l(
                      "Container image with SHA-256 digest",
                      "包含 SHA-256 摘要嘅容器映像",
                    )}
                    .value=${this.image}
                    @input=${(e: Event) =>
                      (this.image = (
                        e.composedPath()[0] as HTMLInputElement
                      ).value)}
                  ></md-outlined-text-field>`}<md-outlined-select
                label=${this.l("Build target", "建置目標")}
                id="build-target"
                .value=${this.target}
                .displayText=${this.target}
                @change=${(e: Event) =>
                  (this.target = (e.target as HTMLSelectElement).value)}
                >${this.options(
                  [
                    "all",
                    "olddefconfig",
                    "savedefconfig",
                    "legal-info",
                    "source",
                    "show-info",
                    "graph-depends",
                  ].map((target) => [target, target]),
                )}</md-outlined-select
              ><md-outlined-text-field
                type="number"
                min="1"
                max="32"
                label=${this.l("Parallel jobs", "並行工作數")}
                .value=${String(this.parallelism)}
                @input=${(e: Event) =>
                  (this.parallelism = Number(
                    (e.composedPath()[0] as HTMLInputElement).value,
                  ))}
              ></md-outlined-text-field>
            </div>
            <p>
              ${this.l(
                "The build runs trusted project code and writes to its chosen output directory. Docker runs as UID/GID 1000.",
                "建置會執行可信專案程式碼，並寫入所選輸出目錄。Docker 會以 UID/GID 1000 執行。",
              )}
            </p>
            <md-outlined-button
              ?disabled=${this.pending ||
              (this.runtimeKind === "wsl"
                ? !this.distribution
                : !/^.+@sha256:[a-f0-9]{64}$/.test(this.image))}
              @click=${this.selectRuntime}
              >${this.l(
                "Use runtime for configuration",
                "設定使用呢個執行環境",
              )}</md-outlined-button
            ><md-filled-button
              ?disabled=${this.pending ||
              !Number.isInteger(this.parallelism) ||
              this.parallelism < 1 ||
              this.parallelism > 32 ||
              (this.runtimeKind === "wsl"
                ? !this.distribution
                : !/^.+@sha256:[a-f0-9]{64}$/.test(this.image))}
              @click=${this.submit}
              >${this.l("Start build", "開始建置")}</md-filled-button
            >
          </section>`
        : this.noProject()}
      <section class="panel">
        <div class="row">
          <h2>${this.l("Build jobs", "建置工作")}</h2>
          <md-text-button ?disabled=${this.pending} @click=${this.refreshJobs}
            >${this.l("Refresh", "重新整理")}</md-text-button
          >
        </div>
        ${this.jobs.length
          ? this.jobs.map(
              (job) =>
                html`<div class="record">
                  <strong>${job.kind}</strong>
                  <span class="badge">${job.state}</span>
                  <p class="muted">${job.id}</p>
                  <div class="row">
                    <md-text-button
                      ?disabled=${this.pending}
                      @click=${() => this.readLogs(job)}
                      >${this.l("Read logs", "檢視記錄")}</md-text-button
                    >${["queued", "running"].includes(job.state)
                      ? html`<md-outlined-button
                          ?disabled=${this.pending}
                          @click=${() => this.jobAction("cancel", job)}
                          >${this.l(
                            "Request cancellation",
                            "要求取消",
                          )}</md-outlined-button
                        >`
                      : nothing}${[
                      "failed",
                      "interrupted",
                      "cancelled",
                    ].includes(job.state)
                      ? html`<md-outlined-button
                          ?disabled=${this.pending}
                          @click=${() => this.jobAction("retry", job)}
                          >${this.l(
                            "New attempt",
                            "新增嘗試",
                          )}</md-outlined-button
                        >`
                      : nothing}
                  </div>
                </div>`,
            )
          : html`<p>
              ${this.l(
                "Refresh to load recorded jobs. No success is inferred from an empty list.",
                "重新整理以載入工作記錄，空白清單唔代表建置成功。",
              )}
            </p>`}${this.selectedJob
          ? html`<h3>${this.l("Job logs", "工作記錄")}</h3>
              <div
                class="log"
                role="region"
                tabindex="0"
                aria-label=${this.l("Job logs", "工作記錄")}
              >
                ${this.logs.map(
                  (record) =>
                    html`<div>
                      ${typeof record.value === "string"
                        ? record.value
                        : (record.value?.text ??
                          record.value?.message ??
                          this.l("Structured job event", "結構化工作事件"))}
                    </div>`,
                )}
              </div>
              ${this.logMore
                ? html`<md-text-button
                    @click=${() => {
                      const job = this.jobs.find(
                        (j) => j.id === this.selectedJob,
                      );
                      if (job) void this.readLogs(job, true);
                    }}
                    >${this.l(
                      "Load next records",
                      "載入下一批記錄",
                    )}</md-text-button
                  >`
                : nothing}`
          : nothing}
      </section>`;
  }
  private configView() {
    if (!this.workspace) return this.noProject();
    const entries = this.configEntries();
    return html`<section class="panel stack">
      <div class="row">
        <h2>${this.l("Buildroot configuration", "Buildroot 設定")}</h2>
        <md-outlined-button
          ?disabled=${this.pending || !!Object.keys(this.changes).length}
          @click=${this.inspectConfig}
          >${this.l("Inspect configuration", "檢視設定")}</md-outlined-button
        ><md-text-button ?disabled=${this.pending} @click=${this.listDefconfigs}
          >${this.l("List defconfigs", "列出預設設定")}</md-text-button
        >
      </div>
      ${this.config
        ? html`<p class="notice">
              ${this.config.semantics?.available
                ? this.l(
                    "Kconfig menus, effective values, dependencies and help are provided by the admitted parser. Changes are reconciled by the selected runtime.",
                    "已授權解析器提供 Kconfig 選單、實際值、相依關係同說明，變更會由所選執行環境協調。",
                  )
                : this.l(
                    "Full Kconfig semantics are unavailable. Choose a trusted Python interpreter, then inspect again.",
                    "未能使用完整 Kconfig 語意。請揀選可信 Python 解譯器，再重新檢視。",
                  ) +
                  " " +
                  (this.config.semantics?.reason ?? "")}
            </p>
            ${entries
              .slice(this.configPage * 30, this.configPage * 30 + 30)
              .map((entry: any) => {
                const value = this.changes[entry.symbol]?.value ?? entry.value;
                return html`<div class="config-row">
                  <div>
                    <label class="symbol">${entry.symbol}</label>${entry.prompt
                      ? html`<p>${entry.prompt}</p>`
                      : nothing}${entry.menu
                      ? html`<small>${entry.menu}</small>`
                      : nothing}${entry.dependency || entry.help
                      ? html`<details>
                          <summary>
                            ${this.l("Help and dependencies", "說明同相依關係")}
                          </summary>
                          <p>
                            ${entry.help ||
                            this.l(
                              "No help text supplied by this source.",
                              "呢個來源未提供說明文字。",
                            )}
                          </p>
                          <p class="symbol">${entry.dependency}</p>
                          ${entry.ranges?.map(
                            (range: any) =>
                              html`<p>
                                ${range.min} … ${range.max} (${range.condition})
                              </p>`,
                          )}
                        </details>`
                      : nothing}
                  </div>
                  ${entry.type === "bool"
                    ? html`<md-switch
                        ?disabled=${entry.visibility === 0 ||
                        entry.assignable?.length === 1}
                        aria-label=${entry.symbol}
                        .selected=${value === true}
                        @change=${(e: Event) =>
                          (this.changes = {
                            ...this.changes,
                            [entry.symbol]: {
                              type: "bool",
                              value: (e.target as any).selected,
                            },
                          })}
                      ></md-switch>`
                    : entry.type === "tristate"
                      ? html`<md-outlined-select
                          ?disabled=${entry.visibility === 0 ||
                          entry.assignable?.length === 1}
                          label=${entry.symbol}
                          .value=${String(value)}
                          .displayText=${String(value)}
                          @change=${(e: Event) =>
                            (this.changes = {
                              ...this.changes,
                              [entry.symbol]: {
                                type: "tristate",
                                value: (e.target as HTMLSelectElement).value,
                              },
                            })}
                          >${this.options([
                            ["y", "y"],
                            ["m", "m"],
                            ["n", "n"],
                          ])}</md-outlined-select
                        >`
                      : entry.type === "raw"
                        ? html`<span>${String(value)}</span>`
                        : html`<md-outlined-text-field
                            ?disabled=${entry.visibility === 0}
                            label=${entry.symbol}
                            .value=${String(value)}
                            @input=${(e: Event) =>
                              (this.changes = {
                                ...this.changes,
                                [entry.symbol]: {
                                  type: entry.type,
                                  value: (
                                    e.composedPath()[0] as HTMLInputElement
                                  ).value,
                                },
                              })}
                          ></md-outlined-text-field>`}
                </div>`;
              })}
            <div class="row">
              <md-text-button
                ?disabled=${this.configPage === 0}
                @click=${() => this.configPage--}
                >${this.l("Previous", "上一頁")}</md-text-button
              ><span
                >${this.configPage + 1} /
                ${Math.max(1, Math.ceil(entries.length / 30))}</span
              ><md-text-button
                ?disabled=${(this.configPage + 1) * 30 >= entries.length}
                @click=${() => this.configPage++}
                >${this.l("Next", "下一頁")}</md-text-button
              >
            </div>
            <div class="row">
              <md-filled-button
                ?disabled=${this.pending || !Object.keys(this.changes).length}
                @click=${this.applyConfig}
                >${this.l(
                  "Apply and reconcile",
                  "套用並協調",
                )}</md-filled-button
              ><md-text-button
                ?disabled=${this.pending || !Object.keys(this.changes).length}
                @click=${() => (this.changes = {})}
                >${this.l("Discard changes", "放棄變更")}</md-text-button
              ><md-outlined-button
                ?disabled=${this.pending || !!Object.keys(this.changes).length}
                @click=${this.undoConfig}
                >${this.l(
                  "Undo last application",
                  "復原上次套用",
                )}</md-outlined-button
              >
            </div>`
        : html`<p>
            ${this.l(
              "Inspect the active output configuration before editing.",
              "編輯之前，請先檢視目前輸出設定。",
            )}
          </p>`}${this.defconfigs.length
        ? html`<h3>${this.l("Available defconfigs", "可用預設設定")}</h3>
            <p>
              ${this.l(
                "Applying a defconfig replaces the current configuration and reconciles it.",
                "套用預設設定會取代目前設定，並進行協調。",
              )}
            </p>
            ${this.defconfigs
              .slice(0, 100)
              .map(
                (item) =>
                  html`<div class="row">
                    <span class="symbol">${item.name}</span
                    ><md-outlined-button
                      ?disabled=${this.pending ||
                      !this.config ||
                      !!Object.keys(this.changes).length}
                      @click=${() => this.applyDefconfig(item.path)}
                      >${this.l("Apply", "套用")}</md-outlined-button
                    >
                  </div>`,
              )}${this.defconfigs.length > 100
              ? html`<p>
                  ${this.l("Showing the first 100 entries.", "顯示首 100 項。")}
                </p>`
              : nothing}`
        : nothing}
    </section>`;
  }
  private artifactsView() {
    if (!this.workspace) return this.noProject();
    return html`<section class="panel stack">
      <div class="row">
        <h2>${this.l("Output artifacts", "輸出檔案")}</h2>
        <md-outlined-button
          ?disabled=${this.pending}
          @click=${this.listArtifacts}
          >${this.l("List artifacts", "列出輸出檔案")}</md-outlined-button
        >
      </div>
      ${this.artifacts.map(
        (item) =>
          html`<div class="row record">
            <span class="symbol">${item.path}</span
            ><span>${item.size} ${this.l("bytes", "位元組")}</span
            >${item.kind === "file"
              ? html`<md-text-button
                  ?disabled=${this.pending}
                  @click=${() => this.inspectArtifact(item.path)}
                  >${this.l("Inspect", "檢視")}</md-text-button
                >`
              : html`<span>${this.l("Directory", "目錄")}</span>`}
          </div>`,
      )}${this.artifact
        ? html`<dl>
              <dt>${this.l("File", "檔案")}</dt>
              <dd>${this.artifact.path}</dd>
              <dt>${this.l("Format", "格式")}</dt>
              <dd>${this.artifact.format}</dd>
              <dt>SHA-256</dt>
              <dd class="symbol">${this.artifact.sha256}</dd>
              <dt>${this.l("Size", "大小")}</dt>
              <dd>${this.artifact.size}</dd>
            </dl>
            ${this.artifact.preview
              ? html`<div
                    class="log"
                    role="region"
                    tabindex="0"
                    aria-label=${this.l("Text preview", "文字預覽")}
                  >
                    ${this.artifact.preview}
                  </div>
                  <p>
                    ${this.artifact.previewTruncated
                      ? this.l(
                          "Preview truncated to the supported limit.",
                          "預覽已按支援上限截短。",
                        )
                      : this.l("Text preview", "文字預覽")}
                  </p>`
              : nothing}
            <p>
              ${this.l(
                "Inspection reads metadata and hashes; archives are not extracted.",
                "檢視只會讀取中繼資料同計算摘要，唔會解壓縮封存檔。",
              )}
            </p>`
        : nothing}
    </section>`;
  }
  private assistantView() {
    return html`<section class="panel stack">
      <h2>${this.l("Local Ollama assistant", "本機 Ollama 助理")}</h2>
      <p>
        ${this.l(
          "Messages are sent only to Ollama on this computer. No project files or logs are attached automatically. Model installation is not performed here.",
          "訊息只會傳送到呢部電腦嘅 Ollama，唔會自動附加專案檔案或記錄，呢度唔會安裝模型。",
        )}
      </p>
      <md-outlined-button ?disabled=${this.pending} @click=${this.loadModels}
        >${this.l(
          "Load installed models",
          "載入已安裝模型",
        )}</md-outlined-button
      >${this.models.length
        ? html`<md-outlined-select
            label=${this.l("Model", "模型")}
            id="assistant-model"
            .value=${this.model}
            .displayText=${this.model}
            @change=${(e: Event) =>
              (this.model = (e.target as HTMLSelectElement).value)}
            >${this.options(
              this.models.map((model) => [model.name, model.name]),
            )}</md-outlined-select
          >`
        : nothing}${this.messages.map(
        (message) =>
          html`<div class="message">
            <strong
              >${message.role === "user"
                ? this.l("You", "你")
                : this.l("Local model", "本機模型")}</strong
            >${message.content}
          </div>`,
      )}<md-outlined-text-field
        type="textarea"
        rows="3"
        maxlength="4000"
        label=${this.l("Message to local model", "傳送到本機模型嘅訊息")}
        .value=${this.prompt}
        @input=${(e: Event) =>
          (this.prompt = (e.composedPath()[0] as HTMLInputElement).value)}
      ></md-outlined-text-field
      ><md-filled-button
        ?disabled=${this.pending ||
        !this.model ||
        !this.prompt.trim() ||
        this.messages.length >= 98}
        @click=${this.sendMessage}
        >${this.l("Send message", "傳送訊息")}</md-filled-button
      >
    </section>`;
  }
  private updatesView() {
    return html`<section class="panel stack">
      <h2>${this.l("Application updates", "應用程式更新")}</h2>
      <p>
        ${this.l(
          "Check published releases and verify installer size, source and checksum. Installers are unsigned; downloading does not install an update.",
          "檢查已發佈版本，並驗證安裝程式大小、來源同摘要。安裝程式未經簽署，下載唔會安裝更新。",
        )}
      </p>
      <div class="row">
        <md-filled-button
          ?disabled=${this.pending}
          @click=${() => this.updateAction("check")}
          >${this.l("Check for updates", "檢查更新")}</md-filled-button
        ><md-outlined-button
          ?disabled=${this.pending}
          @click=${() => this.updateAction("state")}
          >${this.l("Refresh status", "重新整理狀態")}</md-outlined-button
        >${this.updateState?.status === "available"
          ? html`<md-outlined-button
              ?disabled=${this.pending}
              @click=${() => this.updateAction("download")}
              >${this.l(
                "Download verified installer",
                "下載已驗證安裝程式",
              )}</md-outlined-button
            >`
          : nothing}
      </div>
      ${this.updateState
        ? html`<dl>
            <dt>${this.l("Status", "狀態")}</dt>
            <dd>${this.updateState.status}</dd>
            ${this.updateState.release
              ? html`<dt>${this.l("Version", "版本")}</dt>
                  <dd>${this.updateState.release.version}</dd>
                  <dt>${this.l("Source", "來源")}</dt>
                  <dd class="symbol">${this.updateState.release.source}</dd>`
              : nothing}${this.updateState.total
              ? html`<dt>${this.l("Downloaded", "已下載")}</dt>
                  <dd>
                    ${this.updateState.received} / ${this.updateState.total}
                    ${this.l("bytes", "位元組")}
                  </dd>`
              : nothing}
          </dl>`
        : nothing}
    </section>`;
  }
  private resizeDock(event: PointerEvent) {
    const separator = event.currentTarget as HTMLElement;
    const start = event.clientY, original = this.dockHeight;
    separator.setPointerCapture(event.pointerId);
    const move = (e:PointerEvent) => this.dockHeight = Math.max(80,Math.min(400,original+start-e.clientY));
    const end = () => { separator.removeEventListener("pointermove",move); separator.removeEventListener("pointerup",end); separator.removeEventListener("pointercancel",end); };
    separator.addEventListener("pointermove",move); separator.addEventListener("pointerup",end); separator.addEventListener("pointercancel",end);
  }
  render() {
    return html`<div class="ide"><aside class="explorer" aria-label=${this.l("Project explorer","專案總管")}><h2>${this.l("Explorer","總管")}</h2><div class="project-name">${this.workspace?.name||this.l("No adopted project","未接入專案")}</div>${["runtime","source","config","package","builds","artifacts","guests","tools","assistant","regex","companion","updates"].map(tab=>html`<md-text-button class=${this.tab===tab?"active":""} aria-current=${this.tab===tab?"page":"false"} @click=${()=>this.tab=tab}>${this.label(tab)}</md-text-button>`)}</aside><div class="editor-frame"><div class="document-toolbar"><strong>${this.label(this.tab)}</strong><span>${this.workspace?this.l("Trusted project","可信專案"):this.l("No execution context","無執行內容")}</span><md-text-button @click=${()=>this.dockOpen=!this.dockOpen}>${this.dockOpen?this.l("Hide jobs","隱藏工作"):this.l("Show jobs","顯示工作")}</md-text-button></div><div class="operations">
      <md-tabs
        aria-label=${this.l("Project operations", "專案操作")}
        .activeTabIndex=${[
          "runtime",
          "source",
          "package",
          "builds",
          "config",
          "artifacts",
          "guests",
          "assistant",
          "updates",
          "regex",
          "tools",
          "companion",
        ].indexOf(this.tab)}
        @change=${(e: Event) => {
          const index = (e.target as any).activeTabIndex;
          this.tab =
            [
              "runtime",
          "source",
          "package",
              "builds",
              "config",
              "artifacts",
              "guests",
              "assistant",
              "updates",
              "regex",
              "tools",
              "companion",
            ][index] ?? "runtime";
        }}
        >${[
          "runtime",
          "source",
          "package",
          "builds",
          "config",
          "artifacts",
          "guests",
          "assistant",
          "updates",
          "regex",
          "tools",
          "companion",
        ].map(
          (tab) =>
            html`<md-primary-tab
              role="tab"
              aria-label=${this.label(tab)}
              id=${"operation-tab-" + tab}
              aria-controls="operation-content"
              >${this.label(tab)}</md-primary-tab
            >`,
        )}</md-tabs
      >${this.pending
        ? html`<md-linear-progress
            indeterminate
            aria-label=${this.l("Operation in progress", "操作進行中")}
          ></md-linear-progress>`
        : nothing}
      <div
        class="content view"
        ?hidden=${["guests","regex","tools","companion","source","package"].includes(this.tab)}
        id="operation-content"
        role="tabpanel"
        aria-labelledby=${"operation-tab-" + this.tab}
      >
        ${this.tab === "runtime"
          ? this.runtimeView()
          : this.tab === "builds"
            ? this.buildsView()
            : this.tab === "config"
              ? this.configView()
              : this.tab === "artifacts"
                ? this.artifactsView()
                : this.tab === "guests"
                  ? nothing
                  : this.tab === "assistant"
                    ? this.assistantView()
                    : ["regex", "tools", "companion", "source", "package"].includes(this.tab)
                      ? nothing
                      : this.updatesView()}
      </div>
      <guest-panel
        class="guest-host"
        ?hidden=${this.tab !== "guests"}
        .workspaceId=${this.workspace?.workspaceId ?? ""}
        .language=${this.language}
      ></guest-panel
      ><regex-workbench
        class="regex-host"
        ?hidden=${this.tab !== "regex"}
        .language=${this.language}
      ></regex-workbench
      ><package-panel
        ?hidden=${this.tab !== "package"}
        .workspaceId=${this.workspace?.workspaceId ?? ""}
        .language=${this.language}
      ></package-panel
      ><source-panel
        ?hidden=${this.tab !== "source"}
        .workspaceId=${this.workspace?.workspaceId ?? ""}
        .language=${this.language}
        @source-adopted=${(event: CustomEvent) => {
          this.workspace = event.detail;
          this.config = undefined;
          this.artifacts = [];
          this.artifact = undefined;
          this.changes = {};
        }}
        @source-applied=${(event: CustomEvent) => {
          if (event.detail.workspaceId !== this.workspace?.workspaceId) return;
          this.config = undefined;
          this.artifacts = [];
          this.artifact = undefined;
          this.changes = {};
        }}
      ></source-panel
      ><tools-panel
        ?hidden=${this.tab !== "tools"}
        .language=${this.language}
      ></tools-panel
      ><companion-panel
        ?hidden=${this.tab !== "companion"}
        .language=${this.language}
      ></companion-panel
      >${this.feedback
        ? html`<div class="status" role="status">${this.feedback}</div>`
        : nothing}
    </div>${this.dockOpen?html`<section class="dock" style=${`height:${this.dockHeight}px`} aria-label=${this.l("Jobs and output dock","工作同輸出面板")}><div class="dock-resizer" role="separator" tabindex="0" aria-label=${this.l("Resize jobs dock","調整工作面板大小")} aria-orientation="horizontal" aria-valuenow=${this.dockHeight} aria-valuemin="80" aria-valuemax="400" @pointerdown=${this.resizeDock} @keydown=${(e:KeyboardEvent)=>{if(["ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();this.dockHeight=Math.max(80,Math.min(400,this.dockHeight+(e.key==="ArrowUp"?20:-20)));}}}></div><div class="document-toolbar"><strong>${this.l("Jobs / output","工作／輸出")}</strong><span>${this.jobs.length} ${this.l("loaded","已載入")}</span><md-text-button ?disabled=${this.pending} @click=${this.refreshJobs}>${this.l("Refresh jobs","重新整理工作")}</md-text-button></div><div class="dock-content"><div class="dock-jobs">${this.jobs.map(job=>html`<md-text-button ?disabled=${this.pending} @click=${()=>this.readLogs(job)}>${job.kind} · ${job.state}</md-text-button>`)}</div><div class="dock-log" role="log" tabindex="0" aria-label=${this.l("Selected job output","所選工作輸出")}>${this.selectedJob?this.logs.map(record=>html`<div>${typeof record.value==="string"?record.value:record.value?.text??record.value?.message??this.l("Structured job event","結構化工作事件")}</div>`):html`<span class="dock-empty">${this.l("Refresh recorded jobs, then select one to read its output. No job is running by implication.","重新整理工作記錄，再選擇工作以讀取輸出。唔會假設有工作執行中。")}</span>`}</div></div></section>`:nothing}</div></div>`;
  }
}
customElements.define("operations-panel", OperationsPanel);
