import {expressiveComponentStyles} from './shell-expressive-components';
import "./workspace-section";
import "./settings-search";
import {localizedCopy} from './language-wording';
import {vocabulary} from './owned-copy';
import "./regex-workbench";
import { LitElement, html, css, nothing, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { materialIcon } from "./material-icons";
import { workspaceStyles } from "./workspace-styles";
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/button/outlined-button.js';
const workflowGuides=[
  ['doc-8597af462ad4f61246ee5b44c5fedec05a6fe57509913d7a33ca1be885fc4a47','Create or resume an image','建立或繼續映像'],
  ['doc-d062af14460c354dcc54c30429bd5b47a6e12a331de5af5535c5015196c43428','Prepare a BIOS ISO','準備 BIOS ISO'],
  ['doc-8766f36206e92967ff9231c3c8b0b4337eb57f6b7b766a273e74a007cad2ac33','Choose a container runtime','選擇容器執行環境'],
  ['doc-47ca4da807be3ad8723b190bf73ac8dae0c4befdfe43efc8e770845827ae2878','Review component configuration','核對元件設定'],
  ['doc-723ffe21f773334cdf4d51e9a585edd7671244dfebd64ce4b99440869727790f','Manage build queues','管理建置佇列'],
  ['doc-36250245eca0e206e5d824fe16595f480a5dd24d4566ae094ea730be6e9f6215','Author a package','編寫套件'],
];
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
    guidedShortFlow:{type:Boolean,attribute:'guided-short-flow',reflect:true},
    restricted:{type:Boolean},
    language: { type: String },
    active: { type: Boolean },
    revision: { state: true },
    articlePage:{state:true},
    category:{state:true},
    topicsOpen:{state:true},
    articleLanguage:{state:true},
  };
  restricted=false;
  guidedShortFlow=false;
  language = "bilingual";
  active = false;
  revision = 0;
  private articlePage=0;
  private category='';
  private topicsOpen=true;
  private articleLanguage:'en'|'zh-HK'|'bilingual'|null=null;
  private readonly pageSize=24;
  private index?: Index;
  private document?: Document;
  private requestedLanguage?: "en" | "zh-HK" | "bilingual";
  private loading = false;
  private feedback = "";
  private serial = 0;
  private history: Location[] = [{ id: "", anchor: "" }];
  private cursor = 0;
  private matchedIds?: Set<string>;
  /** Plain article text from the host, used only for local matching. */
  private bodies?: Map<string, string>;
  private bodyState: "idle" | "loading" | "ready" | "unavailable" = "idle";
  static styles = [
    workspaceStyles,
    expressiveComponentStyles,
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
      .topic-row small{display:block;padding:0 8px 8px;overflow-wrap:anywhere}
      .topic,.pagination md-outlined-button,.task md-text-button{white-space:normal;text-wrap:wrap;overflow-wrap:anywhere;text-overflow:clip;height:auto;min-height:48px}
      .topic-filter{width:100%;min-width:0;margin-bottom:8px}
      .pagination{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}
      .pagination p{margin:0;width:100%;font-size:12px}
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
      .row {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
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
      }
      @media (max-height:500px) {
        :host([guided-short-flow]) {height:auto;overflow:visible}
        :host([guided-short-flow]) .reader {height:auto;min-height:0;display:block}
        :host([guided-short-flow]) .layout {display:block;flex:none;height:auto;min-height:0}
        :host([guided-short-flow]) .topics,:host([guided-short-flow]) .article {height:auto;max-height:none;flex:none;overflow:visible}
      }
    `,
    css`
      :host{container-type:inline-size}.reader{background:var(--md-sys-color-surface-container);padding:16px;gap:12px;box-sizing:border-box}.bar{border-radius:28px}.layout{gap:16px}.topics,.article{border-radius:28px;background:var(--md-sys-color-surface);border:0}
      .bar{padding:8px 16px;background:var(--md-sys-color-surface-container-low);gap:8px}.bar strong{font-size:18px;font-weight:500}
      .help-search{padding:12px 20px;max-width:900px;flex-shrink:0;position:relative;z-index:2}.help-search settings-search{display:block}
      .layout{grid-template-columns:minmax(210px,270px) minmax(0,1fr)}.layout[data-topics-open=false]{grid-template-columns:minmax(0,1fr)}
      .topics{padding:16px 12px}.topics[hidden]{display:none}.topics h2{font-size:18px;margin:0 8px 16px}.topic{--md-text-button-container-shape:24px;--md-text-button-label-text-size:14px;padding:4px 8px}.topic-row{margin-bottom:6px}.topic-row small{padding-left:20px;color:var(--md-sys-color-on-surface-variant)}
      .article{padding:28px 32px;font-size:16px;line-height:1.7}.article h1{font-size:32px;font-weight:500}.article h2{font-size:24px;font-weight:500}.article-document{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}.article-copy{min-width:0;max-width:78ch}.reader-outline{border-top:1px solid var(--md-sys-color-outline-variant);padding-top:12px}.reader-outline h2{font-size:14px}.reader-outline md-text-button{display:block;width:100%;min-height:44px;text-align:left;white-space:normal}
      .task{border:1px solid var(--md-sys-color-outline-variant);border-radius:20px;padding:16px;background:var(--md-sys-color-surface-container-low)}.task p{font-size:14px}.notice{padding:8px 20px;color:var(--md-sys-color-on-surface-variant)}
      @container(min-width:1100px){.article-document{grid-template-columns:minmax(0,1fr) 190px}.reader-outline{border-top:0;border-left:1px solid var(--md-sys-color-outline-variant);padding:0 0 0 16px;align-self:start;position:sticky;top:0}}
      @container(max-width:760px){.layout{display:flex;flex-direction:column}.topics{max-height:220px;flex-shrink:0}.article{padding:16px;min-height:180px}.help-search{padding:8px 12px}.tasks{grid-template-columns:minmax(0,1fr)}}
    `,
  ];
  private l(en:string,zh:string,authored=false) {return localizedCopy(en,zh,this.language,authored);}
  private effectiveLanguage(): "en" | "zh-HK" | "bilingual" {
    return this.restricted || vocabulary.school() !== "inactive" ? "en"
      : this.articleLanguage??(this.language === "en" || this.language === "zh-HK" ? this.language : "bilingual");
  }
  protected updated(changed: PropertyValues) {
    if(changed.has("restricted")&&!this.restricted&&this.index)this.search();
    if ((changed.has("active")||changed.has("restricted")) && this.active && !this.restricted && !this.index && !this.loading)
      void this.refresh();
    if (this.active && !this.restricted && !this.loading && this.document && this.requestedLanguage !== this.effectiveLanguage()) {
      const location = this.history[this.cursor];
      void this.open(location.id, location.anchor, this.cursor, true);
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.serial++;
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
      this.l("Offline resource unavailable. Retry loading the bundled documentation.","離線資源未能使用，請重試載入內附文件。",true) +
      " " +
      (e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : "")
    );
  }
  private async refresh() {
    if (this.restricted) return;
    const token = ++this.serial;
    this.loading = true;
    this.feedback = "";
    this.revision++;
    try {
      const index = await this.call<Index>("documentation.list");
      if (token !== this.serial) return;
      this.index = index;
      if (!this.document && this.history.length === 1) {
        try {
          const saved = JSON.parse(localStorage.getItem('documentation-last-location') || 'null');
          if (saved && typeof saved.id === 'string' && typeof saved.anchor === 'string' && saved.anchor.length <= 512 && index.articles.some(a => a.id === saved.id)) {
            this.loading = false;
            void this.open(saved.id, saved.anchor);
          }
        } catch { /* A missing local preference never prevents reading. */ }
      }
      this.bodies = undefined;
      this.bodyState = "idle";
      this.search();
    } catch (e) {
      if (token === this.serial) this.feedback = this.error(e);
    } finally {
      if (token === this.serial) {
        this.loading = false;
        this.revision++;
      }
    }
  }
  /** Context help accepts only a host-issued article identity. */
  async openArticle(id: string) {
    if (this.restricted) return;
    if (!/^doc-[a-f0-9]{64}$/.test(id)) return;
    await this.refresh();
    if (!this.index?.articles.some(article => article.id === id)) return;
    await this.open(id);
  }
  private async open(id: string, anchor = "", historyIndex?: number, preserveScroll = false) {
    if (this.restricted) return;
    const language = this.effectiveLanguage();
    this.requestedLanguage = language;
    const scrollTop = this.renderRoot.querySelector<HTMLElement>(".article")?.scrollTop;
    const token = ++this.serial;
    this.loading = true;
    this.feedback = "";
    this.revision++;
    try {
      const document = await this.call<Document>("documentation.read", { id, language });
      if (token !== this.serial) return;
      if (this.restricted) return;
      if (language !== this.effectiveLanguage()) {
        await this.open(id, anchor, historyIndex, preserveScroll);
        return;
      }
      this.document = document;
      try { localStorage.setItem('documentation-last-location', JSON.stringify({id,anchor})); } catch { /* Reading remains available without preference storage. */ }
      if (historyIndex === undefined) {
        this.history = this.history.slice(0, this.cursor + 1);
        this.history.push({ id, anchor });
        this.cursor = this.history.length - 1;
      } else this.cursor = historyIndex;
      this.revision++;
      await this.updateComplete;
      if (token !== this.serial) return;
      if (preserveScroll) {
        const body = this.renderRoot.querySelector<HTMLElement>(".article");
        if (body && scrollTop !== undefined) body.scrollTop = scrollTop;
      } else this.anchor(anchor);
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
      this.feedback = this.l("This section is unavailable in the bundled article.","內附文章未有此章節。",true);
      this.revision++;
      return;
    }
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if(this.guidedShortFlow&&matchMedia('(max-height:500px)').matches){target.scrollIntoView({block:'start',behavior:'auto'});return;}
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
    try { if(this.document) localStorage.setItem('documentation-last-location',JSON.stringify({id:this.document.article.id,anchor})); } catch {}
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
    try { localStorage.removeItem('documentation-last-location'); } catch {}
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
          this.feedback = this.l("External link opened through the desktop.","已透過桌面開啟外部連結。",true);
      } catch (err) {
        if (this.document?.article.id === id) this.feedback = this.error(err);
      }
      this.revision++;
    } else {
      this.feedback = this.l("This resource is not available in the offline bundle.","離線文件未提供此資源。",true);
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
      ? this.l("titles, summaries and article text","標題、摘要及文章內容",true)
      : this.bodyState === "loading"
        ? this.l("titles and summaries while article text loads","標題及摘要（文章內容載入中）",true)
        : this.bodyState==='idle'
          ? this.l('titles and summaries; article text loads when you search','標題及摘要；搜尋時才載入文章內容',true)
          : this.l("titles and summaries only; article text is unavailable","只限標題及摘要；文章內容未能使用",true);
  }
  /** Matching and expression validation belong to this reader's independent search control. */
  private search() {
    this.revision++;
    if(this.index&&this.bodyState==='idle'&&!this.restricted)void this.loadBodies(this.index);
  }
  private matchingArticles(){return (this.index?.articles??[]).filter(article=>!this.matchedIds||this.matchedIds.has(article.id));}
  private browseArticles(){return this.matchingArticles().filter(article=>!this.category||article.category===this.category);}
  private categoryLabel(value:string){return value?`${value} (${this.matchingArticles().filter(article=>article.category===value).length})`:`${this.l('All topics','所有主題',true)} (${this.matchingArticles().length})`;}
  private pageFor(articles:Article[]){return Math.min(this.articlePage,Math.max(0,Math.ceil(articles.length/this.pageSize)-1));}
  private async turnPage(delta:number){const articles=this.browseArticles();this.articlePage=Math.max(0,Math.min(this.pageFor(articles)+delta,Math.max(0,Math.ceil(articles.length/this.pageSize)-1)));await this.updateComplete;const heading=this.renderRoot.querySelector<HTMLElement>('#article-list-heading');heading?.focus();heading?.scrollIntoView({block:'nearest'});}
  private homeTasks(){
    const articles=this.index?.articles??[];
    const chosen=workflowGuides.flatMap(([id,en,zh])=>{const article=articles.find(item=>item.id===id);return article?[{article,label:this.l(en,zh,true)}]:[];});
    return chosen.length?chosen:articles.slice(0,6).map(article=>({article,label:article.title}));
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
    const articles=this.browseArticles(),page=this.pageFor(articles),pageCount=Math.max(1,Math.ceil(articles.length/this.pageSize));
    const pageArticles=articles.slice(page*this.pageSize,(page+1)*this.pageSize);
    const browsing=!!this.category||!!(this.matchedIds&&this.matchedIds.size!==(this.index?.articles.length??0));
    return html`<div class="reader">
      <div class="bar"><div class="article-languages expressive-connected" role="group" aria-label=${this.l('Article language','文章語言')}>${([['en','English'],['zh-HK','廣東話'],['bilingual','English + 廣東話']] as const).map(([language,label])=>html`<md-outlined-button aria-pressed=${this.effectiveLanguage()===language} @click=${()=>{this.articleLanguage=language;}}>${label}</md-outlined-button>`)}</div>
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
        )}<strong>${this.l("Offline help","離線說明",true)}</strong><md-text-button aria-expanded=${this.topicsOpen} aria-controls="help-topics" @click=${()=>this.topicsOpen=!this.topicsOpen}>${materialIcon('menu','icon')}${this.l('Topics','主題')}</md-text-button>${this.icon(
          "Reload documentation",
          "重新載入文件",
          "refresh",
          () => void this.refresh(),
          this.loading,
        )}
      </div>
      <div class="help-search"><settings-search .language=${this.language} .label=${this.l('Search help offline','搜尋離線說明')}
        .entries=${(this.index?.articles??[]).map(article=>({id:article.id,text:this.searchable(article)}))}
        @settings-filter=${(event:CustomEvent<string[]>)=>{event.stopPropagation();const ids=event.detail;if(JSON.stringify([...(this.matchedIds??[])])!==JSON.stringify(ids)){this.matchedIds=new Set(ids);this.articlePage=0;this.revision++;}}}></settings-search></div>
      <p class="notice" role="status">
        ${this.feedback ||
        this.l(
          `${articles.length} articles`,
          `${articles.length} 篇文章`,
        )}
        · ${this.l("Searching","搜尋範圍",true)}: ${this.scopeNotice()}
      </p>
      ${this.loading
        ? html`<md-linear-progress
            indeterminate
            aria-label=${this.l("Loading documentation","載入文件",true)}
          ></md-linear-progress>`
        : nothing}
      <div class="layout" data-topics-open=${this.topicsOpen}>
        <nav
          class="topics" id="help-topics" ?hidden=${!this.topicsOpen}
          aria-label=${this.l("Documentation topics","文件主題",true)}
        >
          <h2 id="article-list-heading" tabindex="-1">${this.l('Browse articles','瀏覽文章',true)}</h2>
          <md-outlined-select id="documentation-category" class="topic-filter" .label=${this.l('Topic','主題',true)} .value=${this.category} .displayText=${this.categoryLabel(this.category)} @change=${(event:Event)=>{const value=(event.target as HTMLSelectElement).value;if(!value||this.index?.navigation.categories.some(item=>item.name===value)){this.category=value;this.articlePage=0;this.revision++;}}}>
            <md-select-option value=""><div slot="headline">${this.categoryLabel('')}</div></md-select-option>
            ${(this.index?.navigation.categories??[]).map(item=>html`<md-select-option value=${item.name}><div slot="headline">${this.categoryLabel(item.name)}</div></md-select-option>`)}
          </md-outlined-select>
          <div class="pagination" role="group" aria-label=${this.l('Article pages','文章頁面',true)}>
            <p role="status" aria-live="polite">${this.l(`Page ${page+1} of ${pageCount}; ${articles.length} articles`,`${page+1}／${pageCount} 頁；${articles.length} 篇文章`)}</p>
            <md-outlined-button data-article-page="previous" ?disabled=${page===0} @click=${()=>this.turnPage(-1)}>${this.l('Previous page','上一頁',true)}</md-outlined-button>
            <md-outlined-button data-article-page="next" ?disabled=${page+1>=pageCount} @click=${()=>this.turnPage(1)}>${this.l('Next page','下一頁',true)}</md-outlined-button>
          </div>
          ${pageArticles.map(article=>html`<div class="topic-row"><md-text-button class="topic" data-article-id=${article.id} title=${article.title} aria-current=${this.document?.article.id===article.id?'page':'false'} @click=${()=>void this.open(article.id)}>${materialIcon('description','icon')}${article.title}</md-text-button><small>${article.category}</small></div>`)}
          ${this.index&&!articles.length?html`<p>${this.l('No matching articles.','無符合文章。',true)}</p>`:nothing}
        </nav>
        <section
          class="article"
          aria-label=${this.l("Documentation article","文件文章",true)}
          tabindex="0"
          @click=${this.link}
        >
          ${this.document
            ? html`<div class="notice">
                  ${this.document.article.category} ·
                  ${this.document.article.language}
                </div>
                <div class="article-document"><div class="article-copy">${unsafeHTML(this.document.html)}</div>
                ${this.document.navigation.headings.length?html`<nav class="reader-outline" aria-label=${this.l('On this page','本頁內容')}><h2>${this.l('On this page','本頁內容')}</h2>${this.document.navigation.headings.map(h=>html`<md-text-button @click=${(e:Event)=>{e.stopPropagation();this.followAnchor(h.id);}}>${h.text}</md-text-button>`)}</nav>`:nothing}</div>`
            : html`<div class="intro">
                <h1>${browsing?this.l('Find a guide','尋找指南',true):this.l('Work with your local project','使用本機專案',true)}</h1>
                <p>${browsing?this.l('Choose a result from the paged article list. Search covers the full admitted index, not only this page.','請從分頁文章清單選擇結果。搜尋涵蓋完整已接納目錄，唔只目前頁面。',true):this.l('Choose a workflow below, or browse every admitted article by topic and page. Reading never starts a build or changes a project.','選擇下方流程，或按主題同頁面瀏覽全部已接納文章。閱讀唔會開始建置或更改專案。',true)}</p>
                ${!browsing?html`<div class="tasks">${this.homeTasks().map(({article,label})=>html`<section class="task"><md-text-button data-home-article-id=${article.id} title=${article.title} @click=${()=>void this.open(article.id)}>${materialIcon('description','icon')}${label}</md-text-button><p>${article.summary}</p></section>`)}</div>${this.index&&workflowGuides.some(([id])=>!this.index?.articles.some(article=>article.id===id))?html`<p class="notice">${this.l('Some recommended workflow guides are unavailable in this bundle. The article list still includes every admitted guide.','此文件包未提供部分建議流程指南。文章清單仍包含全部已接納指南。',true)}</p>`:nothing}`:nothing}
                ${!this.index
                  ? html`<p>
                      ${this.l("Load the bundled documentation using Reload documentation.","請使用重新載入文件以載入內附說明。",true)}
                    </p>`
                  : nothing}
              </div>`}${(this.document?.issues || this.index?.issues)?.length
            ? html`<workspace-section class="issues">
                <span slot="heading">
                  ${this.l("Unavailable offline resources","未能離線使用嘅資源",true)}
                  (${(this.document?.issues || this.index?.issues)?.length})
                </span>
                <ul>
                  ${(this.document?.issues || this.index?.issues)?.map(
                    (issue) =>
                      html`<li>${issue.reason} — ${issue.reference}</li>`,
                  )}
                </ul>
              </workspace-section>`
            : nothing}
        </section>
      </div>
    </div>`;
  }
}
customElements.define("documentation-panel", DocumentationPanel);
