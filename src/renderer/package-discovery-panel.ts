import {localizedCopy} from './language-wording';
import "./regex-workbench";
import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
import { LitElement, html, css, nothing, type PropertyValues } from "lit";
import { materialIcon } from "./material-icons";
type SymbolDetail = {
  name: string;
  type: string | null;
  prompt: string | null;
  help?: string;
  location: { path: string; line: number };
};
type Package = {
  id: string;
  treeId: string;
  name: string;
  path: string;
  recipe: string;
  symbols: SymbolDetail[];
  symbolCount: number;
  symbolsTruncated: boolean;
};
type Catalogue = {
  symbolStats?: {
    retainedCount: number;
    declaredCount: number;
    truncated: boolean;
  };
  revision: string;
  packages: Package[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number;
  warnings: { treeId: string; path: string; reason: string }[];
  semantics: string;
};
type Imported = {
  packageId: string;
  treeId: string;
  revision: string;
  draft: Record<string, unknown> | null;
  roundTripAllowed: boolean;
  unsupportedReasons: string[];
  files: { path: string; sha256: string; bytesBase64?: string }[];
  symbols: SymbolDetail[];
  symbolsTruncated: boolean;
};
export class PackageDiscoveryPanel extends LitElement {
  static properties = {
    workspaceId: { type: String },
    language: { type: String },
    locked: { type: Boolean },
    revision: { state: true },
  };
  workspaceId = "";
  language = "bilingual";
  locked = false;
  revision = 0;
  private serial = 0;
  private pending = false;
  private query = "";
  private catalogue?: Catalogue;
  private imported?: Imported;
  private selected?: Package;
  private consent = false;
  private feedback = "";
  private editors: {id:string;label:string}[] = [];
  private editorId = "";
  private builder = false;
  private pattern = "";
  private flags = "i";
  private literal = "";
  private matched?: Set<string>;
  private worker?: Worker;
  private timer?: ReturnType<typeof setTimeout>;
  private filterMessage = "";
  static styles = css`
    :host {
      display: block;
      color: inherit;
      font: inherit;
    }
    .stack {
      display: grid;
      gap: 10px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .row md-outlined-text-field {
      flex: 1;
      min-width: 180px;
    }
    .search {
      position: relative;
    }
    .builder {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 10;
      width: min(430px, 90%);
      padding: 12px;
      background: var(--md-sys-color-surface-container-high);
      border: 1px solid var(--md-sys-color-outline);
      box-shadow: 0 6px 24px #0004;
    }
    .builder md-outlined-text-field {
      width: 100%;
    }
    .items {
      display: grid;
      grid-template-columns: minmax(150px, 220px) minmax(0, 1fr);
      border: 1px solid var(--md-sys-color-outline-variant);
      max-height: 440px;
    }
    .list,
    .review {
      overflow: auto;
      padding: 10px;
      min-width: 0;
    }
    .list {
      border-right: 1px solid var(--md-sys-color-outline-variant);
    }
    .list md-text-button {
      display: block;
      width: 100%;
    }
    .list [aria-current="true"] {
      background: var(--md-sys-color-secondary-container);
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: 12px/1.5 monospace;
      max-height: 240px;
      overflow: auto;
      background: var(--md-sys-color-surface-container);
      padding: 10px;
    }
    p {
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
    }
    h3 {
      font-size: 14px;
      margin: 0;
    }
    .hash {
      overflow-wrap: anywhere;
      font-size: 11px;
    }
    md-icon-button {
      width: 48px;
      height: 48px;
    }
    .flags label {
      display: flex;
      align-items: center;
    }
    @media (max-width: 760px) {
      .items {
        grid-template-columns: 1fr;
        max-height: 600px;
      }
      .list {
        max-height: 160px;
      }
    }
  `;
  private l(en: string, zh: string) {return localizedCopy(en,zh,this.language);}
  protected updated(changed: PropertyValues) {
    if (changed.has("workspaceId")) {
      this.serial++;
      this.catalogue = undefined;
      this.imported = undefined;
      this.selected = undefined;
      this.consent = false;
      this.pending = false;
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
      this.stop();
      this.matched = undefined;
      this.revision++;
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.serial++;
    this.stop();
  }
  private stop() {
    this.worker?.terminate();
    this.worker = undefined;
    if (this.timer) clearTimeout(this.timer);
  }
  private async call<T>(
    action: string,
    fields: Record<string, unknown>,
  ): Promise<T> {
    if (!window.studio?.operations) throw Error("DESKTOP_REQUIRED");
    const reply = await window.studio.operations({
      action,
      workspaceId: this.workspaceId,
      ...fields,
    });
    if (!reply.ok) throw Error(reply.code);
    return reply.result as T;
  }
  private async run(work: (current: () => boolean) => Promise<void>) {
    if (this.pending || this.locked || !this.workspaceId) return;
    const token = ++this.serial;
    this.pending = true;
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
    this.revision++;
    try {
      await work(() => token === this.serial);
    } catch (e) {
      if (token === this.serial) {
        this.imported = undefined;
        this.consent = false;
        this.feedback =
          captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
            "Package inspection unavailable. Refresh the catalogue before retrying.",
            "未能檢視套件，重試前請重新整理目錄。",
          ) +
          " " +
          (e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : ""));
      }
    } finally {
      if (token === this.serial) {
        this.pending = false;
        this.revision++;
      }
    }
  }
  private discover(offset = 0) {
    void this.run(async (current) => {
      const result = await this.call<Catalogue>("package.discover", {
        query: this.query,
        offset,
        limit: 50,
      });
      if (current()) {
        this.catalogue = result;
        this.imported = undefined;
        this.selected = undefined;
        this.consent = false;
        this.filter();
      }
    });
  }
  private inspect(item: Package) {
    void this.run(async (current) => {
      const result = await this.call<Imported>("package.import", {
        packageId: item.id,
        revision: this.catalogue!.revision,
      });
      if (current()) {
        this.imported = result;
        this.selected = item;
        this.consent = false;
      }
    });
  }
  private filter() {
    this.stop();
    this.filterMessage = captureOwnedStatus(this,"filterMessage",this.l.bind(this),l=>"");
    if (!this.pattern) {
      this.matched = undefined;
      this.revision++;
      return;
    }
    this.matched = new Set();
    const worker = new Worker(
      new URL("./documentation-search-worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker = worker;
    const done = (ids: string[], error = "") => {
      if (this.worker !== worker) return;
      this.stop();
      this.matched = new Set(ids);
      this.filterMessage = captureOwnedStatus(this,"filterMessage",this.l.bind(this),l=>error==="invalid"?l("Invalid page expression.","頁面表達式無效。"):error==="unavailable"?l("Page filter unavailable.","頁面篩選未能使用。"):error==="timeout"?l("Page expression timed out; simplify it.","頁面表達式逾時，請簡化。"):"");
      this.revision++;
    };
    worker.onmessage = (e) =>
      e.data.ok
        ? done(e.data.ids)
        : done([], "invalid");
    worker.onerror = () =>
      done([], "unavailable");
    this.timer = setTimeout(
      () =>
        done(
          [],
          "timeout",
        ),
      600,
    );
    worker.postMessage({
      pattern: this.pattern,
      flags: this.flags,
      articles: (this.catalogue?.packages || []).map((p) => ({
        id: p.id,
        text: [p.name, p.path, ...p.symbols.map((s) => s.name)]
          .join(" ")
          .slice(0, 2000),
      })),
    });
    this.revision++;
  }
  private bytes(value?: string) {
    if (value === undefined)
      return this.l(
        "Bytes omitted by the host limit; inspect the original file without replacing it.",
        "內容因主機限制而省略，請檢查原檔案，唔好取代。 ",
      );
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
      );
    } catch {
      return this.l(
        "Binary or non-UTF-8 file; original bytes are preserved.",
        "二進位或非 UTF-8 檔案，原始位元組已保留。",
      );
    }
  }
  private discoverEditors(){
    void this.run(async current=>{
      const editors=await this.call<{id:string;label:string}[]>("package.editors",{});
      if(current()){this.editors=editors;this.editorId=editors[0]?.id||"";this.revision++;}
    });
  }
  private openEditor(file:Imported["files"][number]){
    const imported=this.imported;if(!imported||!this.editorId)return;
    void this.run(async current=>{
      const result=await this.call<{launched:boolean}>("package.editor.open",{packageId:imported.packageId,revision:imported.revision,file:file.path,fileHash:file.sha256,editorId:this.editorId});
      if(!result.launched)throw Error("EDITOR_LAUNCH_FAILED");
      if(current())this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Editor launched for the current source file. Refresh discovery after saving external changes; no build was started.","已為目前來源檔案啟動編輯器。儲存外部變更後請重新探索，未有開始建置。"));
    });
  }
  render() {
    const c = this.catalogue,
      p = this.imported,
      disabled = this.pending || this.locked || !this.workspaceId;
    return html`<div class="stack">
      <p>
        ${this.l(
          "Discover packages in the adopted source and session-authorized external trees. This reads declarations; it does not evaluate make recipes or activate trees.",
          "探索已接入來源同今次工作階段已授權外部樹嘅套件。只讀取宣告，唔會執行 make 配方或啟用外部樹。",
        )}
      </p>
      <div class="row">
        <md-outlined-button ?disabled=${disabled} @click=${()=>this.discoverEditors()}>${this.l("Discover installed editors","探索已安裝編輯器")}</md-outlined-button>
        ${this.editors.length?html`<md-outlined-select .label=${this.l("Source editor","來源編輯器")} .value=${this.editorId} ?disabled=${disabled} @change=${(e:Event)=>{this.editorId=(e.target as HTMLSelectElement).value;this.revision++;}}>${this.editors.map(editor=>html`<md-select-option .value=${editor.id}><div slot="headline">${editor.label}</div></md-select-option>`)}</md-outlined-select>`:html`<span>${this.l("No editor discovered yet.","尚未探索到編輯器。")}</span>`}
      </div>
      <div class="row search">
        <md-outlined-text-field
          .label=${this.l("Search source packages", "搜尋來源套件")}
          .value=${this.query}
          maxlength="128"
          .supportingText=${this.l(
            "Host substring search across names, paths and declared symbols.",
            "主機文字搜尋名稱、路徑同已宣告符號。",
          )}
          ?disabled=${disabled}
          @input=${(e: Event) => {
            this.query = (e.target as HTMLInputElement).value;
            this.consent = false;
            this.revision++;
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter") this.discover();
          }}
        ></md-outlined-text-field
        ><md-icon-button
          aria-label=${this.l("Search package catalogue", "搜尋套件目錄")}
          title=${this.l("Search package catalogue", "搜尋套件目錄")}
          ?disabled=${disabled}
          @click=${() => this.discover()}
          >${materialIcon("search")}</md-icon-button
        ><md-icon-button
          aria-label=${this.l(
            "Package page regex builder",
            "套件頁面表達式建構器",
          )}
          title=${this.l("Package page regex builder", "套件頁面表達式建構器")}
          aria-expanded=${this.builder}
          aria-controls="package-regex"
          @click=${() => {
            this.builder = !this.builder;
            this.revision++;
          }}
          >${materialIcon("code")}</md-icon-button
        >${this.builder
          ? html`<section
              id="package-regex" style="display:block;max-height:65vh;overflow:auto;width:min(760px,calc(100vw - 48px))"
              class="builder stack"
              role="region"
              aria-label=${this.l(
                "Package page regex builder",
                "套件頁面表達式建構器",
              )}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  this.builder = false;
                  this.revision++;
                  this.renderRoot
                    .querySelector<HTMLElement>(
                      '[aria-controls="package-regex"]',
                    )
                    ?.focus();
                }
              }}
            >
              <h3>
                ${this.l("Filter the loaded page only", "只篩選已載入頁面")}
              </h3>
              <p>
                ${this.l(
                  "ECMAScript regex; not a full-catalogue query. Clear to show the complete loaded page.",
                  "ECMAScript 表達式，唔係完整目錄搜尋。清除以顯示整個已載入頁面。",
                )}
              </p>
              <regex-workbench .language=${this.language} .pattern=${this.pattern} .flags=${this.flags}
                @pattern-change=${(e:CustomEvent)=>{e.stopPropagation();this.pattern=e.detail.pattern;this.flags=e.detail.flags;this.filter();}}
              ></regex-workbench>
              <md-text-button
                @click=${() => {
                  this.pattern = "";
                  this.filter();
                }}
                >${this.l("Clear page filter", "清除頁面篩選")}</md-text-button
              >
            </section>`
          : nothing}
      </div>
      <p role="status">${displayOwnedStatus(this,"feedback",this.feedback,this.language) || displayOwnedStatus(this,"filterMessage",this.filterMessage,this.language)}</p>
      ${this.pending
        ? html`<md-linear-progress
            indeterminate
            aria-label=${this.l("Inspecting source packages", "檢視來源套件")}
          ></md-linear-progress>`
        : nothing}${c
        ? html`<p>
              ${c.total} ${this.l("catalogue matches", "目錄符合項目")} ·
              ${c.packages.length ? c.offset + 1 : 0}–${c.offset +
              c.packages.length}.
              ${c.semantics}
            </p>
            ${c.symbolStats?.truncated
              ? html`<p>
                  ${this.l(
                    "Symbol declarations were truncated by host limits; search and static help are incomplete.",
                    "符號宣告因主機限制而截短，搜尋同靜態說明並唔完整。",
                  )}
                  ${c.symbolStats.retainedCount} /
                  ${c.symbolStats.declaredCount}
                </p>`
              : nothing}${c.warnings.map(
              (w) => html`<p>${w.reason} · ${w.path}</p>`,
            )}
            <div class="row">
              <md-icon-button
                title=${this.l("Previous package page", "上一頁套件")}
                aria-label=${this.l("Previous package page", "上一頁套件")}
                ?disabled=${disabled || c.offset === 0}
                @click=${() => this.discover(Math.max(0, c.offset - c.limit))}
                >${materialIcon("arrow_back")}</md-icon-button
              ><md-icon-button
                title=${this.l("Next package page", "下一頁套件")}
                aria-label=${this.l("Next package page", "下一頁套件")}
                ?disabled=${disabled ||
                c.nextOffset >= c.total ||
                c.nextOffset <= c.offset}
                @click=${() => this.discover(c.nextOffset)}
                >${materialIcon("arrow_forward")}</md-icon-button
              ><span
                >${this.pattern
                  ? this.l(
                      "Regex applies to this page only.",
                      "表達式只套用到此頁。",
                    )
                  : ""}</span
              >
            </div>
            <div class="items">
              <div class="list">
                ${c.packages
                  .filter((item) => !this.matched || this.matched.has(item.id))
                  .map(
                    (item) =>
                      html`<md-text-button
                        aria-current=${this.selected?.id === item.id}
                        title=${item.path}
                        ?disabled=${disabled}
                        @click=${() => this.inspect(item)}
                        >${materialIcon(
                          "inventory_2",
                          "icon",
                        )}${item.name}</md-text-button
                      >`,
                  )}
              </div>
              <div class="review stack">
                ${p
                  ? html`<h3>${this.selected?.name}</h3>
                      <p>
                        ${p.treeId === "source"
                          ? this.l(
                              "Source package: import as an external-tree draft; source files stay read-only.",
                              "來源套件：匯入為外部樹草稿，來源檔案保持唯讀。",
                            )
                          : this.l(
                              "Authorized external-tree package.",
                              "已授權外部樹套件。",
                            )}
                      </p>
                      ${p.symbols.map(
                        (symbol) =>
                          html`<section>
                            <strong>${symbol.name}</strong>
                            <p>
                              ${symbol.prompt || ""} ·
                              ${symbol.type ||
                              this.l("Unknown type", "類型未知")}
                            </p>
                            <p>
                              ${symbol.help ||
                              this.l(
                                "No static help declaration.",
                                "無靜態說明宣告。",
                              )}
                            </p>
                            <small
                              >${symbol.location.path}:${symbol.location
                                .line}</small
                            >
                          </section>`,
                      )}${p.symbolsTruncated
                        ? html`<p>
                            ${this.l(
                              "Some symbols were omitted by the host limit.",
                              "部分符號因主機限制而省略。",
                            )}
                          </p>`
                        : nothing}${p.unsupportedReasons.map(
                        (reason) => html`<p>${reason}</p>`,
                      )}${!p.roundTripAllowed || !p.draft
                        ? html`<p>
                            ${this.l(
                              "Read-only review. This recipe cannot be safely round-tripped by the typed editor.",
                              "唯讀審核，此配方未能安全地由類型化編輯器來回轉換。",
                            )}
                          </p>`
                        : html`<label class="row"
                              ><md-checkbox
                                aria-label=${this.l(
                                  "Replace current package draft with reviewed import",
                                  "用已審核匯入內容取代目前套件草稿",
                                )}
                                ?disabled=${disabled}
                                ?checked=${this.consent}
                                @change=${(e: Event) => {
                                  this.consent = (
                                    e.target as HTMLInputElement
                                  ).checked;
                                  this.revision++;
                                }}
                              ></md-checkbox
                              >${this.l(
                                "Replace the current editor draft. Files are written only after a separate preview and Apply.",
                                "取代目前編輯器草稿，只會喺獨立預覽同套用後寫入檔案。",
                              )}</label
                            ><md-outlined-button
                              ?disabled=${disabled || !this.consent}
                              @click=${() => {
                                this.dispatchEvent(
                                  new CustomEvent("package-draft-imported", {
                                    bubbles: true,
                                    composed: true,
                                    detail: {
                                      workspaceId: this.workspaceId,
                                      draft: p.draft,
                                      treeId: p.treeId,
                                      name: this.selected!.name,
                                    },
                                  }),
                                );
                                this.consent = false;
                                this.revision++;
                              }}
                              >${materialIcon("download", "icon")}${this.l(
                                "Import reviewed draft",
                                "匯入已審核草稿",
                              )}</md-outlined-button
                            >`}${p.files.map(
                        (file) =>
                          html`<details>
                            <summary>${file.path}</summary>
                            <p class="hash">SHA-256 ${file.sha256}</p>
                            <md-outlined-button ?disabled=${disabled||!this.editorId||!/[.](mk|in|hash|patch|json|txt|sh|conf)$/i.test(file.path)} @click=${()=>this.openEditor(file)}>${this.l("Open current source in editor","用編輯器開啟目前來源")}</md-outlined-button>
                            <pre tabindex="0">
${this.bytes(file.bytesBase64)}</pre
                            >
                          </details>`,
                      )}`
                  : html`<p>
                      ${this.l(
                        "Select a package to inspect its source declarations and original files.",
                        "選擇套件以檢視來源宣告同原始檔案。",
                      )}
                    </p>`}
              </div>
            </div>`
        : nothing}
    </div>`;
  }
}
customElements.define("package-discovery-panel", PackageDiscoveryPanel);
