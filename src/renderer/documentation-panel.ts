import "./regex-workbench";
import { LitElement, html, css, nothing, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { materialIcon } from "./material-icons";
import { workspaceStyles } from "./workspace-styles";
type Article = {
  id: string;
  title: string;
  category: string;
  language: string;
  summary: string;
};
type Navigation = {
  categories: { name: string; articles: { id: string; title: string }[] }[];
  headings: { id: string; text: string; level: number }[];
};
type Issue = { source: string; reference: string; reason: string };
type Index = {
  articles: Article[];
  navigation: Navigation;
  issues: Issue[];
  complete: boolean;
};
type Document = {
  article: Article;
  html: string;
  navigation: Navigation;
  issues: Issue[];
  complete: boolean;
};
type Location = { id: string; anchor: string };
/** Reads only host-admitted HTML. Navigation never accepts renderer-provided URLs. */
export class DocumentationPanel extends LitElement {
  static properties = {
    restricted:{type:Boolean},
    language: { type: String },
    active: { type: Boolean },
    revision: { state: true },
  };
  restricted=false;
  language = "bilingual";
  active = false;
  revision = 0;
  private index?: Index;
  private document?: Document;
  private loading = false;
  private feedback = "";
  private serial = 0;
  private history: Location[] = [{ id: "", anchor: "" }];
  private cursor = 0;
  private query = "";
  private pattern = "";
  private flags = "i";
  private mode = "literal";
  private builder = false;
  private literal = "";
  private construct = "contains";
  private matchedIds?: Set<string>;
  private searchFeedback = "";
  private searching = false;
  private worker?: Worker;
  private timer?: ReturnType<typeof setTimeout>;
  /** Plain article text from the host, used only for local matching. */
  private bodies?: Map<string, string>;
  private bodyState: "idle" | "loading" | "ready" | "unavailable" = "idle";
  static styles = [
    workspaceStyles,
    css`
      :host {
        display: block;
        height: 100%;
        min-height: 0;
        color: inherit;
        font: inherit;
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
      }
      .reader {
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
        padding: 4px;
      }
      .bar strong {
        flex: 1;
        font-size: 13px;
      }
      .layout {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        flex: 1;
        min-height: 0;
      }
      .topics {
        display: block;
        width: auto;
        min-width: 0;
        background: var(--md-sys-color-surface-container-low);
        overflow: auto;
        border-right: 1px solid var(--md-sys-color-outline-variant);
        padding: 10px;
      }
      .topics h3 {
        font-size: 12px;
        margin: 16px 0 6px;
      }
      .topic {
        display: block;
        width: 100%;
        text-align: left;
        --md-text-button-container-shape: 4px;
        --md-text-button-label-text-size: 12px;
      }
      .topic[aria-current="page"] {
        background: var(--md-sys-color-secondary-container);
      }
      .article {
        overflow: auto;
        padding: 18px 24px;
        line-height: 1.65;
        font-size: 14px;
        overflow-wrap: anywhere;
        min-width: 0;
      }
      .article h1 {
        font-size: 25px;
        line-height: 1.3;
      }
      .article h2 {
        font-size: 21px;
        line-height: 1.4;
      }
      .article h3 {
        font-size: 17px;
      }
      .article img {
        max-width: 100%;
        height: auto;
      }
      .article pre {
        padding: 12px;
        background: var(--md-sys-color-surface-container);
        overflow: auto;
        max-width: 100%;
        font-size: 12px;
      }
      .article table {
        display: block;
        max-width: 100%;
        overflow: auto;
        border-collapse: collapse;
      }
      .article th,
      .article td {
        padding: 8px;
        border: 1px solid var(--md-sys-color-outline-variant);
        text-align: left;
      }
      .article a {
        color: var(--md-sys-color-primary);
      }
      .article a:focus-visible {
        outline: 2px solid var(--md-sys-color-primary);
        outline-offset: 3px;
      }
      .article a[aria-disabled="true"] {
        text-decoration-style: dashed;
        color: var(--md-sys-color-on-surface-variant);
      }
      .article blockquote {
        border-left: 3px solid var(--md-sys-color-primary);
        padding-left: 14px;
        margin-left: 0;
      }
      .notice {
        border: 0;
        border-radius: 0;
        background: transparent;
        font-size: 12px;
        padding: 6px 10px;
        margin: 0;
      }
      .search {
        position: relative;
        display: flex;
        gap: 4px;
        align-items: center;
        max-width: 600px;
        padding: 6px;
      }
      .search md-outlined-text-field {
        flex: 1;
        min-width: 0;
      }
      .builder {
        position: absolute;
        z-index: 20;
        top: 100%;
        left: 6px;
        max-height: 65vh;
        overflow: auto;
        width: min(490px, calc(100vw - 100px));
        padding: 14px;
        background: var(--md-sys-color-surface-container-high);
        border: 1px solid var(--md-sys-color-outline);
        box-shadow: 0 8px 24px #0004;
        display: grid;
        gap: 10px;
      }
      .builder md-outlined-text-field,
      .builder md-outlined-select {
        width: 100%;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .flags label {
        display: flex;
        align-items: center;
      }
      .intro {
        max-width: 760px;
      }
      .tasks {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }
      .task {
        padding: 12px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
      }
      .task p {
        font-size: 12px;
        margin: 4px 0;
      }
      .issues {
        font-size: 12px;
        background: var(--md-sys-color-surface-container);
        padding: 8px;
        margin: 10px 0;
      }
      .outline {
        margin: 0 0 20px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
        padding-bottom: 8px;
      }
      .outline a {
        display: block;
        font-size: 12px;
      }
      .empty {
        padding: 16px;
      }
      md-icon-button {
        width: 48px;
        height: 48px;
      }
      @media (max-width: 1100px) {
        .layout {
          grid-template-columns: 190px minmax(0, 1fr);
        }
        .article {
          padding: 12px;
        }
        .topics {
          padding: 6px;
        }
      }
      @media (max-width: 760px) {
        .layout {
          display: flex;
          flex-direction: column;
        }
        .topics {
          max-height: 160px;
          flex-shrink: 0;
          border-bottom: 1px solid var(--md-sys-color-outline-variant);
        }
        .article {
          flex: 1;
        }
        .builder {
          width: min(440px, calc(100vw - 70px));
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
  protected updated(changed: PropertyValues) {
    if(changed.has("restricted")){if(this.restricted)this.stopSearch();else if(this.index)this.search();}
    if ((changed.has("active")||changed.has("restricted")) && this.active && !this.restricted && !this.index && !this.loading)
      void this.refresh();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.serial++;
    this.stopSearch();
  }
  private async call<T>(
    action: string,
    fields: Record<string, unknown> = {},
  ): Promise<T> {
    if (!window.studio?.operations) throw Error("DESKTOP_REQUIRED");
    const r = await window.studio.operations({ action, ...fields });
    if (!r.ok) throw Error(r.code);
    return r.result as T;
  }
  private error(e: unknown) {
    return (
      this.l(
        "Offline resource unavailable. Retry loading the bundled documentation.",
        "離線資源未能使用，請重試載入內附文件。",
      ) +
      " " +
      (e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : "")
    );
  }
  private async refresh() {
    const token = ++this.serial;
    this.loading = true;
    this.feedback = "";
    this.revision++;
    try {
      const index = await this.call<Index>("documentation.list");
      if (token !== this.serial) return;
      this.index = index;
      this.bodies = undefined;
      this.bodyState = "idle";
      this.search();
      void this.loadBodies(index);
    } catch (e) {
      if (token === this.serial) this.feedback = this.error(e);
    } finally {
      if (token === this.serial) {
        this.loading = false;
        this.revision++;
      }
    }
  }
  private async open(id: string, anchor = "", historyIndex?: number) {
    const token = ++this.serial;
    this.loading = true;
    this.feedback = "";
    this.builder = false;
    this.revision++;
    try {
      const document = await this.call<Document>("documentation.read", { id });
      if (token !== this.serial) return;
      this.document = document;
      if (historyIndex === undefined) {
        this.history = this.history.slice(0, this.cursor + 1);
        this.history.push({ id, anchor });
        this.cursor = this.history.length - 1;
      } else this.cursor = historyIndex;
      this.revision++;
      await this.updateComplete;
      this.anchor(anchor);
    } catch (e) {
      if (token === this.serial) this.feedback = this.error(e);
    } finally {
      if (token === this.serial) {
        this.loading = false;
        this.revision++;
      }
    }
  }
  private anchor(id: string) {
    const body = this.renderRoot.querySelector<HTMLElement>(".article");
    const target = id
      ? this.renderRoot.querySelector<HTMLElement>("#" + CSS.escape(id))
      : body;
    if (!target) {
      this.feedback = this.l(
        "This section is unavailable in the bundled article.",
        "內附文章未有此章節。",
      );
      this.revision++;
      return;
    }
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if (body) {
      if (target === body) body.scrollTop = 0;
      else
        body.scrollTop +=
          target.getBoundingClientRect().top -
          body.getBoundingClientRect().top -
          12;
    }
  }
  private followAnchor(anchor: string) {
    if (this.document) {
      this.history = this.history.slice(0, this.cursor + 1);
      this.history.push({ id: this.document.article.id, anchor });
      this.cursor = this.history.length - 1;
      this.revision++;
    }
    this.anchor(anchor);
  }
  private home(record = true) {
    this.serial++;
    this.loading = false;
    this.document = undefined;
    if (record) {
      this.history = this.history.slice(0, this.cursor + 1);
      this.history.push({ id: "", anchor: "" });
      this.cursor = this.history.length - 1;
    }
    this.revision++;
  }
  private back(delta: number) {
    const cursor = this.cursor + delta,
      location = this.history[cursor];
    if (!location) return;
    if (location.id) void this.open(location.id, location.anchor, cursor);
    else {
      this.cursor = cursor;
      this.home(false);
    }
  }
  private async link(e: MouseEvent) {
    const link = (e.target as Element).closest("a");
    if (!link) return;
    e.preventDefault();
    if (link.dataset.documentId) {
      if (link.dataset.documentId === this.document?.article.id)
        this.followAnchor(link.dataset.documentAnchor || "");
      else
        void this.open(
          link.dataset.documentId,
          link.dataset.documentAnchor || "",
        );
    } else if (link.dataset.documentLinkId && this.document) {
      const id = this.document.article.id;
      try {
        const result = await this.call<{ opened: boolean }>(
          "documentation.open",
          { id, linkId: link.dataset.documentLinkId },
        );
        if (!result.opened) throw Error("EXTERNAL_UNAVAILABLE");
        if (this.document?.article.id === id)
          this.feedback = this.l(
            "External link opened through the desktop.",
            "已透過桌面開啟外部連結。",
          );
      } catch (err) {
        if (this.document?.article.id === id) this.feedback = this.error(err);
      }
      this.revision++;
    } else {
      this.feedback = this.l(
        "This resource is not available in the offline bundle.",
        "離線文件未提供此資源。",
      );
      this.revision++;
    }
  }
  private async loadBodies(index: Index) {
    this.bodyState = "loading";
    this.revision++;
    try {
      const reply = await this.call<{
        entries: { id: string; text: string; truncated: boolean }[];
      }>("documentation.searchText");
      if (this.index !== index) return;
      const known = new Set(index.articles.map((a) => a.id));
      if (
        !reply ||
        !Array.isArray(reply.entries) ||
        reply.entries.length > 1000
      )
        throw Error("INVALID_SEARCH_TEXT");
      const bodies = new Map<string, string>();
      for (const entry of reply.entries) {
        if (
          !entry ||
          typeof entry.id !== "string" ||
          !known.has(entry.id) ||
          bodies.has(entry.id) ||
          typeof entry.text !== "string" ||
          entry.text.length > 65536 ||
          typeof entry.truncated !== "boolean"
        )
          throw Error("INVALID_SEARCH_TEXT");
        bodies.set(entry.id, entry.text);
      }
      this.bodies = bodies;
      this.bodyState = "ready";
    } catch {
      if (this.index !== index) return;
      this.bodies = undefined;
      this.bodyState = "unavailable";
    }
    if (!this.restricted) this.search();
    else this.revision++;
  }
  private searchable(a: Article) {
    return [a.title, a.category, a.summary, this.bodies?.get(a.id) || ""]
      .join(" ")
      .slice(0, 70000);
  }
  private scopeNotice() {
    return this.bodyState === "ready"
      ? this.l("titles, summaries and article text", "標題、摘要及文章內容")
      : this.bodyState === "loading"
        ? this.l(
            "titles and summaries while article text loads",
            "標題及摘要（文章內容載入中）",
          )
        : this.l(
            "titles and summaries only; article text is unavailable",
            "只限標題及摘要；文章內容未能使用",
          );
  }
  private stopSearch() {
    this.worker?.terminate();
    this.worker = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.searching = false;
  }
  private search() {
    this.stopSearch();
    this.searchFeedback = "";
    const articles = this.index?.articles || [];
    if (this.mode === "literal") {
      const query = this.query.toLocaleLowerCase();
      this.matchedIds = new Set(
        articles
          .filter((a) => this.searchable(a).toLocaleLowerCase().includes(query))
          .map((a) => a.id),
      );
      this.revision++;
      return;
    }
    this.matchedIds = new Set();
    this.searching = true;
    this.revision++;
    const worker = new Worker(
      new URL("./documentation-search-worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker = worker;
    const done = (message: string, ids: string[] = []) => {
      if (this.worker !== worker) return;
      this.stopSearch();
      this.searchFeedback = message;
      this.matchedIds = new Set(ids);
      this.revision++;
    };
    worker.onmessage = (e) =>
      e.data.ok
        ? done("", e.data.ids)
        : done(
            this.l(
              "Invalid expression. Correct the pattern or flags.",
              "表達式無效，請修正模式或旗標。",
            ),
          );
    worker.onerror = () =>
      done(this.l("Search worker unavailable.", "搜尋工作程序未能使用。"));
    this.timer = setTimeout(
      () =>
        done(
          this.l(
            "Expression timed out. Simplify it or use literal search.",
            "表達式逾時，請簡化或使用文字搜尋。",
          ),
        ),
      600,
    );
    worker.postMessage({
      pattern: this.pattern,
      flags: this.flags,
      articles: articles.map((a) => ({
        id: a.id,
        text: this.searchable(a),
      })),
    });
  }
  private build() {
    const literal = this.literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    this.pattern =
      this.construct === "start"
        ? "^" + literal
        : this.construct === "end"
          ? literal + "$"
          : this.construct === "exact"
            ? "^" + literal + "$"
            : literal;
    this.mode = "regex";
    this.search();
  }
  private icon(
    en: string,
    zh: string,
    name: string,
    work: () => void,
    disabled = false,
  ) {
    return html`<md-icon-button
      aria-label=${this.l(en, zh)}
      title=${this.l(en, zh)}
      ?disabled=${disabled}
      @click=${work}
      >${materialIcon(name)}</md-icon-button
    >`;
  }
  render() {
    if(this.restricted)return html`<section class="panel"><h1>Workspace help</h1><p>The full built-in article reader is unavailable while the shared preference is active or its status is unconfirmed. This limited guide does not expose the article index, history or search.</p><h2>Project workflow</h2><ol><li>Use Projects &amp; runtime to choose trusted source and output folders.</li><li>Use Source to inspect a revision before applying changes.</li><li>Review Configuration and build settings before starting a build.</li><li>Inspect returned jobs and output. An empty job list does not establish success.</li></ol><h2>Shared preference recovery</h2><p>Open Settings or use the Shared preference action to refresh the host state, verify exit or read manual recovery instructions. Your project records remain unchanged.</p></section>`;
    const articles = (this.index?.articles || []).filter(
      (a) => !this.matchedIds || this.matchedIds.has(a.id),
    );
    return html`<div class="reader">
      <div class="bar">
        ${this.icon(
          "Back in documentation",
          "返回上一份文件",
          "arrow_back",
          () => this.back(-1),
          this.cursor <= 0 || this.loading,
        )}${this.icon(
          "Forward in documentation",
          "前往下一份文件",
          "arrow_forward",
          () => this.back(1),
          this.cursor >= this.history.length - 1 || this.loading,
        )}${this.icon("Documentation home", "文件首頁", "dashboard", () =>
          this.home(),
        )}<strong>${this.l("Offline help", "離線說明")}</strong>${this.icon(
          "Reload documentation",
          "重新載入文件",
          "refresh",
          () => void this.refresh(),
          this.loading,
        )}
      </div>
      <div class="search">
        <md-outlined-text-field
          .label=${this.l("Search documentation", "搜尋文件")}
          .value=${this.mode === "regex" ? this.pattern : this.query}
          .supportingText=${this.l(
            "Titles, topics and summaries; local only.",
            "只喺本機搜尋標題、主題同摘要。",
          )}
          @input=${(e: Event) => {
            this.query = (e.target as HTMLInputElement).value;
            if (this.mode === "regex") this.pattern=this.query;
            this.search();
          }}
        ></md-outlined-text-field
        ><md-icon-button
          aria-label=${this.l(
            "Documentation regex builder",
            "文件正規表達式建構器",
          )}
          title=${this.l("Documentation regex builder", "文件正規表達式建構器")}
          aria-expanded=${this.builder}
          aria-controls="documentation-regex"
          @click=${() => {
            this.builder = !this.builder;
            if(this.mode === "literal") this.pattern=this.query;
            this.revision++;
          }}
          >${materialIcon("code")}</md-icon-button
        >
        ${this.builder
          ? html`<section
              class="builder" style="display:block;max-height:65vh;overflow:auto;width:min(760px,calc(100vw - 48px))"
              id="documentation-regex"
              role="region"
              aria-label=${this.l(
                "Documentation regex builder",
                "文件正規表達式建構器",
              )}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  this.builder = false;
                  this.revision++;
                  this.renderRoot
                    .querySelector<HTMLElement>(
                      '[aria-controls="documentation-regex"]',
                    )
                    ?.focus();
                }
              }}
            >
              <div class="row">
                <strong
                  >${this.l(
                    "Local ECMAScript filter",
                    "本機 ECMAScript 篩選",
                  )}</strong
                >${this.icon(
                  "Close regex builder",
                  "關閉表達式建構器",
                  "close",
                  () => {
                    this.builder = false;
                    this.revision++;
                  },
                )}
              </div>
              <regex-workbench .language=${this.language} .pattern=${this.pattern} .flags=${this.flags}
                @pattern-change=${(e:CustomEvent)=>{e.stopPropagation();this.pattern=e.detail.pattern;this.query=this.pattern;this.flags=e.detail.flags;this.mode="regex";this.search();}}
              ></regex-workbench>
              <md-text-button
                @click=${() => {
                  this.mode = "literal";
                  this.search();
                }}
                >${this.l("Use literal query", "使用文字查詢")}</md-text-button
              >
            </section>`
          : nothing}
      </div>
      <p class="notice" role="status">
        ${this.feedback ||
        this.searchFeedback ||
        this.l(
          `${articles.length} articles · ${this.mode} search`,
          `${articles.length} 篇文章 · ${this.mode === "regex" ? "表達式" : "文字"}搜尋`,
        )}
        · ${this.l("Searching", "搜尋範圍")}: ${this.scopeNotice()}
      </p>
      ${this.loading || this.searching
        ? html`<md-linear-progress
            indeterminate
            aria-label=${this.l("Loading documentation", "載入文件")}
          ></md-linear-progress>`
        : nothing}
      <div class="layout">
        <nav
          class="topics"
          aria-label=${this.l("Documentation topics", "文件主題")}
        >
          ${this.index?.navigation.categories.map((category) => {
            const items = articles.filter((a) => a.category === category.name);
            return items.length
              ? html`<h3>${category.name}</h3>
                  ${items.map(
                    (a) =>
                      html`<md-text-button
                        class="topic"
                        title=${a.title}
                        aria-current=${this.document?.article.id === a.id
                          ? "page"
                          : "false"}
                        @click=${() => void this.open(a.id)}
                        >${materialIcon(
                          "description",
                          "icon",
                        )}${a.title}</md-text-button
                      >`,
                  )}`
              : nothing;
          })}${this.index && !articles.length
            ? html`<p>${this.l("No matching articles.", "無符合文章。")}</p>`
            : nothing}
        </nav>
        <section
          class="article"
          aria-label=${this.l("Documentation article", "文件文章")}
          tabindex="0"
          @click=${this.link}
        >
          ${this.document
            ? html`<div class="notice">
                  ${this.document.article.category} ·
                  ${this.document.article.language}
                </div>
                ${this.document.navigation.headings.length
                  ? html`<details class="outline">
                      <summary>${this.l("On this page", "本頁內容")}</summary>
                      ${this.document.navigation.headings.map(
                        (h) =>
                          html`<a
                            href="#"
                            @click=${(e: Event) => {
                              e.preventDefault();
                              e.stopPropagation();
                              this.followAnchor(h.id);
                            }}
                            >${h.text}</a
                          >`,
                      )}
                    </details>`
                  : nothing}${unsafeHTML(this.document.html)}`
            : html`<div class="intro">
                <h1>
                  ${this.l("Work with your local project", "使用本機專案")}
                </h1>
                <p>
                  ${this.l(
                    "Choose a task to read the bundled guide. Reading never starts a build, changes a project or downloads a runtime.",
                    "選擇工作以閱讀內附指引，閱讀唔會開始建置、更改專案或下載執行環境。",
                  )}
                </p>
                <div class="tasks">
                  ${articles.map(
                    (a) =>
                      html`<section class="task">
                        <md-text-button @click=${() => void this.open(a.id)}
                          >${materialIcon(
                            "description",
                            "icon",
                          )}${a.title}</md-text-button
                        >
                        <p>${a.summary}</p>
                      </section>`,
                  )}
                </div>
                ${!this.index
                  ? html`<p>
                      ${this.l(
                        "Load the bundled documentation using Reload documentation.",
                        "請使用重新載入文件以載入內附說明。",
                      )}
                    </p>`
                  : nothing}
              </div>`}${(this.document?.issues || this.index?.issues)?.length
            ? html`<details class="issues">
                <summary>
                  ${this.l(
                    "Unavailable offline resources",
                    "未能離線使用嘅資源",
                  )}
                  (${(this.document?.issues || this.index?.issues)?.length})
                </summary>
                <ul>
                  ${(this.document?.issues || this.index?.issues)?.map(
                    (issue) =>
                      html`<li>${issue.reason} — ${issue.reference}</li>`,
                  )}
                </ul>
              </details>`
            : nothing}
        </section>
      </div>
    </div>`;
  }
}
customElements.define("documentation-panel", DocumentationPanel);
