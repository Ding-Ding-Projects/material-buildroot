import "./settings-search";
import {localizedCopy} from './language-wording';
import "./minecraft-panel";
import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
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
  formats: { format: string; adapter: string; available: boolean; attemptAvailable?: boolean; reason?: string; disclosure?: string }[];
};
type QueueItem = {
  id: string;
  state: string;
  request: { action: string; sourceIds?: string[]; sourceId?: string; destinationId?: string; [key: string]: unknown };
  result?: { code?: string; bytes?: number; incompleteOutput?: {state:string;name?:string;publication:string} };
  startedAt?: string; finishedAt?: string;
  previousOutcomes?: {state:string;finishedAt?:string;result?:{code?:string;incompleteOutput?:{state:string;name?:string;publication:string}}}[];
};
export class ToolsPanel extends LitElement {
  static properties = { language: { type: String }, revision: { state: true } };
  language = "bilingual";
  revision = 0;
  private pending = false;
  private runningQueue = false;
  private feedback = "";
  private categories: Category[] = [];
  private visibleFormats: Record<string, string[]> = {};
  private category = "text";
  private format = "txt";
  private source?: Grant;
  private sourcePreview?: {bytes:number;detected:string;sampledBytes:number;complete:boolean};
  private destination?: Grant;
  private pdfSources: Grant[] = [];
  private pdfDestination?: Grant;
  private pdfOperation = "inspect";
  private pages = "1";
  private degrees = "90";
  private jobs: QueueItem[] = [];
  private queuePoll?: ReturnType<typeof setInterval>;
  private refreshingQueue = false;
  private batch: {source:Grant;destination:Grant}[] = [];
  private selectedBatch = new Set<string>();
  private batchCategory = "text";
  private batchFormat = "txt";
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
  private l(en:string,zh:string,authored=false) {return localizedCopy(en,zh,this.language,authored);}
  private changed() {
    this.revision++;
  }
  private async call(action: string, fields: Record<string, unknown> = {}) {
    if (!window.studio?.operations) throw new Error("DESKTOP_REQUIRED");
    const reply: { ok: boolean; code?: string; result?: any } =
      await window.studio.operations({ action, ...fields });
    if (!reply.ok) throw new Error(reply.code);
    if (reply.result?.ok === false) throw Object.assign(new Error(reply.result.code),{incompleteOutput:reply.result.incompleteOutput});
    if (reply.result?.cancelled) throw new Error("CANCELLED");
    return reply.result;
  }
  private tool(request: Record<string, unknown>) {
    return this.call("tools", { request });
  }
  private async run(work: () => Promise<void>) {
    if (this.pending) return;
    this.pending = true;
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
    this.changed();
    try {
      await work();
      this.feedback ||= captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Completed.", "已完成。"));
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : "OPERATION_FAILED";
      const partial=(error as {incompleteOutput?:{state:string;name?:string;publication:string}})?.incompleteOutput;
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>`${l("Operation not completed", "操作未完成")}: ${code} ${partial?.state==="retained"?l("Incomplete output retained; final output was not published.","已保留未完成輸出，最終輸出未發佈。")+" "+partial.name:partial?.state==="unknown"?l("Output publication could not be confirmed. Inspect the selected output folder before retrying.","未能確認輸出發佈狀態，重試前請檢查所選輸出資料夾。"):""}`);
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
    if (/^(Refresh|Remove|Move|Stop|Cancel|Revoke)\b/.test(en)) return html`<md-icon-button aria-label=${localizedCopy(en,zh,this.language,true,"accessible-name")} title=${this.l(en,zh,true)} ?disabled=${this.pending||disabled} @click=${()=>this.run(work)}>${materialIcon(actionSymbol(en))}</md-icon-button>`;
    return html`<md-outlined-button
      ?disabled=${this.pending || disabled}
      @click=${() => this.run(work)}
      >${actionIcon(en)}${this.l(en, zh,true)}</md-outlined-button
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
  disconnectedCallback() { clearInterval(this.queuePoll); super.disconnectedCallback(); }
  private disclosure(category:string) {
    if(category==="binary")return this.l("Every input byte is encoded as text. This operation does not decode encoded text.","所有輸入位元組會編碼成文字，此操作唔會解碼已編碼文字。",true);
    if(category==="structured")return this.l("JSON and CSV tables only. CSV loses value types; nested values and spreadsheet formulas are rejected.","只支援 JSON 同 CSV 表格。CSV 唔會保留數值類型，巢狀值同試算表公式唔獲接受。",true);
    if(category==="text")return this.l("Strict UTF-8 only. Original line endings are preserved.","只支援有效 UTF-8，原有換行符號會保留。",true);
    return this.l("The target may omit metadata, fonts, layers, animation, transparency or precision. Keep the original file.","目標格式可能唔保留中繼資料、字體、圖層、動畫、透明度或精確度，請保留原檔。",true);
  }
  private unavailable(code?:string) {
    const reasons:Record<string,[string,string]>={BUNDLED_ADAPTER_REQUIRED:["Verified packaged adapter required","需要已驗證封裝工具"],MISSING_VERIFIED_PAYLOAD:["Packaged adapter is missing","缺少封裝工具"],ISOLATED_RUNTIME_REQUIRED:["Verified isolated execution unavailable","未有已驗證隔離執行環境"],PAYLOAD_HASH_MISMATCH:["Packaged adapter integrity mismatch","封裝工具完整性不符"],NATIVE_BROKER_UNAVAILABLE:["Native isolation broker unavailable","原生隔離程序未能使用"],NATIVE_FORMAT_NOT_SUPPORTED:["No native isolated operation for this format","此格式未有原生隔離操作"],ISOLATED_ATTEMPT_UNVERIFIED:["Packaged isolated attempt available; runtime acceptance unverified","可嘗試封裝隔離操作，實際執行驗收未驗證"]};
    const reason=code&&reasons[code];return reason?localizedCopy(reason[0],reason[1],this.language,true):code||this.l("Unavailable","未能使用",true);
  }
  private async release(ids:string[]) { if(ids.length) await this.call("file.release",{ids}); }
  private async reauthorize(j:QueueItem) {
    const request={...j.request}, added:string[]=[];
    try {
      if(request.sourceIds) {const ids=[];for(const _ of request.sourceIds){const id=(await this.choose("read")).id;ids.push(id);added.push(id);}request.sourceIds=ids;}
      else {request.sourceId=(await this.choose("read")).id;added.push(request.sourceId);}
      if(request.destinationId){request.destinationId=(await this.choose("write")).id;added.push(request.destinationId);}
      await this.tool({action:"queue.rebind",id:j.id,job:request});
    } catch(error) {await this.release(added);throw error;}
    await this.queuePage();
  }
  private categoryName(id:string) {
    const names:Record<string,[string,string]>={images:["Images","圖片"],audio:["Audio","音訊"],video:["Video","影片"],documents:["Documents / PDF","文件 / PDF"],archives:["Archives","壓縮檔"],structured:["Structured data / spreadsheets","結構化資料 / 試算表"],text:["Code / text","程式碼 / 文字"],binary:["Binary encodings","二進制編碼"]};
    const n=names[id];return n?localizedCopy(n[0],n[1],this.language,true):id;
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
    this.jobs = result.items;
    this.next = result.next;
  }
  private result(result: {
    bytes?: number;
    pages?: number;
    pageCounts?: number[];
    validation?: string;
  }) {
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>[
      l("Completed", "已完成"),
      result.bytes !== undefined ? `${result.bytes} bytes` : "",
      result.validation === "signature-and-decoder-roundtrip" ? l("This output passed signature and decoder round-trip checks", "此輸出已通過格式簽章同解碼往返檢查") : "",
      result.pageCounts
        ? `${l("Pages", "頁數")}: ${result.pageCounts.join(", ")}`
        : "",
      result.pages !== undefined
        ? `${result.pages} ${l("pages", "頁")}`
        : "",
    ]
      .filter(Boolean)
      .join(" · "));
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
    if(!queued)await this.release([...this.pdfSources.map(s=>s.id),...(this.pdfDestination?[this.pdfDestination.id]:[])]);
    this.pdfSources=[];
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
            aria-label=${this.l("Operation in progress","操作進行中",true)}
          ></md-linear-progress>`
        : nothing}
      <div role="status" aria-live="polite">${displayOwnedStatus(this,"feedback",this.feedback,this.language)}</div>
      <section class="panel stack" data-destination="local" data-experience-id="tools-section:local" tabindex="-1">
        <h2>${this.l("Local tools","本機工具",true)}</h2>
        <p class="note">
          ${this.l("Choose trusted executables through the desktop review. Files are selected with native dialogs; outputs must be new files.","透過桌面審核選擇可信執行檔。請用原生對話框選擇檔案，輸出必須係新檔案。",true)}
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
                  ? this.l("Available","可用",true)
                  : p.code || this.l("Unavailable","未能使用",true)}</span
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
        <section class="panel stack" data-destination="convert" data-experience-id="tools-section:convert" tabindex="-1">
          <h2>${this.l("Convert a file","轉換檔案",true)}</h2>
          ${this.button("Load formats", "載入格式", async () => {
            this.categories = (
              await this.tool({ action: "converter.catalog" })
            ).categories;
          })}
          ${this.categories.map(c => html`<details ?open=${c.category === this.category}>
            <summary>${this.categoryName(c.category)}</summary>
            <settings-search .language=${this.language} .label=${this.l("Search formats","搜尋格式",true)}
              .entries=${c.formats.map(f=>({id:f.format,text:`${f.format} ${f.adapter} ${f.reason||""}`}))}
              @settings-filter=${(e:CustomEvent)=>{e.stopPropagation();const ids=e.detail as string[];if(JSON.stringify(this.visibleFormats[c.category])!==JSON.stringify(ids)){this.visibleFormats[c.category]=ids;this.changed();}}}></settings-search>
            ${c.formats.filter(f=>!this.visibleFormats[c.category]||this.visibleFormats[c.category].includes(f.format)).map(f=>html`<div class="record">
              <md-outlined-button ?disabled=${(!f.available&&!f.attemptAvailable)||this.pending} aria-pressed=${this.category===c.category&&this.format===f.format}
                @click=${()=>{this.category=c.category;this.format=f.format;this.changed();}}>${f.format.toUpperCase()}</md-outlined-button>
              <span>${f.adapter} · ${f.available?this.l("Available","可用",true):this.unavailable(f.reason)}</span>
            </div>`)}
          </details>`)}
          <p>${this.categoryName(this.category)} · ${this.format.toUpperCase()}</p>
          <p class="note">${this.disclosure(this.category)}</p>
          <p class="note">${this.l("Choose a new output name with the selected format extension. Sources remain unchanged. Conversion may change metadata or encoding as described above.","請為新輸出選擇符合格式嘅副檔名。來源保持不變，轉換可能按上述說明改變中繼資料或編碼。",true)}</p>
          <div class="row">
            ${this.button("Choose source", "選擇來源", async () => {
              const chosen=await this.choose("read");
              if(this.source)await this.release([this.source.id]);
              this.source = chosen;
              this.sourcePreview=undefined;
              this.sourcePreview=await this.tool({action:"converter.inspect",sourceId:chosen.id});
            })}<span>${this.source?.name}</span>
            ${this.sourcePreview?html`<p>${this.l("Detected from bytes","按位元組偵測",true)}: ${this.sourcePreview.detected} · ${this.sourcePreview.bytes} bytes · ${this.sourcePreview.sampledBytes} ${this.l("bytes inspected","已檢視位元組",true)}. ${this.l("Preview is not conversion validation.","預覽唔代表轉換驗證。",true)}</p>`:nothing}
          </div>
          <div class="row">
            ${this.button("Choose new output", "選擇新輸出", async () => {
              const chosen=await this.choose("write");
              if(this.destination)await this.release([this.destination.id]);
              this.destination = chosen;
            })}<span>${this.destination?.name}</span>
          </div>
          <div class="row">
            ${this.button(
              formats?.find(f=>f.format===this.format)?.attemptAvailable?"Attempt isolated conversion":"Convert now",
              formats?.find(f=>f.format===this.format)?.attemptAvailable?"嘗試隔離轉換":"立即轉換",
              async () => {
                this.result(await this.tool(this.conversion()));
                await this.release([this.source!.id,this.destination!.id]);
                this.source=undefined;this.sourcePreview=undefined;this.destination = undefined;
              },
              !this.source || !this.destination || !formats?.find(f=>f.format===this.format&&(f.available||f.attemptAvailable)),
            )}${this.button(
              "Add to queue",
              "加入佇列",
              async () => {
                await this.tool({
                  action: "queue.add",
                  job: this.conversion(),
                });
                this.source=undefined;this.sourcePreview=undefined;this.destination = undefined;
                await this.queuePage();
              },
              !this.source || !this.destination || !formats?.find(f=>f.format===this.format&&(f.available||f.attemptAvailable)),
            )}
          </div>
          <md-outlined-button ?disabled=${!this.pending&&!this.runningQueue} @click=${async()=>{
            try{const r=await this.tool({action:"converter.cancel"});this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Cancellation requested for active isolated conversions","已要求取消目前隔離轉換")+`: ${r.requested}`);}
            catch{this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Cancellation could not be delivered","未能送出取消要求"));}this.changed();
          }}>${this.l("Cancel active isolated conversions","取消目前隔離轉換",true)}</md-outlined-button>
          <h3>${this.l("Batch conversion","批次轉換",true)}</h3>
          <p>${this.l("Choose up to 100 files per selection. Queue storage has no total-file limit. Process or release a page before selecting another; live permissions stay bounded.","每次選擇最多 100 個檔案，儲存佇列冇總檔案上限。選取下一批前請處理或釋放目前批次，以限制即時權限數量。",true)}</p>
          ${this.button("Choose batch and output folder","選擇批次同輸出資料夾",async()=>{
            const r=await this.call("file.chooseBatch",{format:this.format});
            await this.release(this.batch.flatMap(i=>[i.source.id,i.destination.id]));
            this.batchCategory=this.category;this.batchFormat=this.format;
            this.batch=r.items;this.selectedBatch=new Set(this.batch.map(i=>i.source.id));
          },!formats?.find(f=>f.format===this.format&&(f.available||f.attemptAvailable)))}
          ${this.batch.length?html`<div class="row">
            ${this.button("Select all","全選",async()=>{this.selectedBatch=new Set(this.batch.map(i=>i.source.id));})}
            ${this.button("Select none","全部取消選取",async()=>{this.selectedBatch.clear();})}
            ${this.button("Queue selected files","加入所選檔案",async()=>{
              const remaining=[];
              for(let index=0;index<this.batch.length;index++){
                const item=this.batch[index];
                if(!this.selectedBatch.has(item.source.id)){remaining.push(item);continue;}
                try{await this.tool({action:"queue.add",job:{action:"converter.convert",category:this.batchCategory,format:this.batchFormat,sourceId:item.source.id,destinationId:item.destination.id}});this.selectedBatch.delete(item.source.id);}
                catch(error){this.batch=[...remaining,...this.batch.slice(index)];throw error;}
              }
              this.batch=remaining;await this.queuePage();
            },!this.selectedBatch.size)}
            ${this.button("Release batch permissions","釋放批次權限",async()=>{await this.release(this.batch.flatMap(i=>[i.source.id,i.destination.id]));this.batch=[];this.selectedBatch.clear();})}
          </div>${this.batch.map(i=>html`<label class="row"><md-checkbox aria-label=${i.source.name} ?checked=${this.selectedBatch.has(i.source.id)} @change=${(e:Event)=>{if((e.target as HTMLInputElement).checked)this.selectedBatch.add(i.source.id);else this.selectedBatch.delete(i.source.id);this.changed();}}></md-checkbox><span>${i.source.name} → ${i.destination.name}</span></label>`)}`:nothing}
        </section>
        <section class="panel stack" data-destination="pdf" data-experience-id="tools-section:pdf" tabindex="-1">
          <h2>${this.l("PDF workspace","PDF 工作區",true)}</h2>
          <p class="note">
            ${this.l("PDF operations require qpdf and verified isolation. Add sources in merge order. Page numbers start at 1.","PDF 操作需要 qpdf 同已驗證隔離環境。請按合併次序加入來源，頁碼由 1 開始。",true)}
          </p>
          ${this.select(
            this.l("Operation","操作",true),
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
                    await this.release([s.id]);
                    this.pdfSources = this.pdfSources.filter((_, j) => j !== i);
                  },
                )}
              </div>`,
          )}
          ${requiresPages
            ? this.field(
                this.l("Pages in order (for example 3,1,2)","頁碼次序（例如 3,1,2）",true),
                this.pages,
                (v) => (this.pages = v),
              )
            : nothing}
          ${this.pdfOperation === "rotate"
            ? this.select(
                this.l("Clockwise degrees","順時針角度",true),
                this.degrees,
                ["90", "180", "270"],
                (v) => (this.degrees = v),
              )
            : nothing}
          ${this.pdfOperation === "metadata"
            ? html`<p>
                ${this.l("Removes document information and metadata.","移除文件資訊同中繼資料。",true)}
              </p>`
            : nothing}
          ${this.pdfOperation !== "inspect"
            ? html`<div class="row">
                ${this.button(
                  "Choose PDF output",
                  "選擇 PDF 輸出",
                  async () => {
                    const chosen=await this.choose("write");
                    if(this.pdfDestination)await this.release([this.pdfDestination.id]);
                    this.pdfDestination = chosen;
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
      <section class="panel stack" data-destination="queue" data-experience-id="tools-section:queue" tabindex="-1">
        <h2>${this.l("File and model queue","檔案同模型佇列",true)}</h2>
        <p class="note">
          ${this.l("Jobs run when you choose Run queue. Completed permissions are released. Retry and restart require native file reauthorization.","選擇執行佇列先會開始工作，已完成權限會釋放，重試同重啟後需要重新用原生選擇器授權檔案。",true)}
        </p>
        <div class="row">
          ${this.field(
            this.l("Ollama model name","Ollama 模型名稱",true),
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
          <md-outlined-button ?disabled=${!this.runningQueue} @click=${async()=>{try {await this.tool({action:"queue.pause"});this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Pause requested. The current file finishes first.","已要求暫停，會先完成目前檔案。"));}catch {this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Pause was not accepted.","未能暫停。"));}this.changed();}}>${this.l("Pause after current file","完成目前檔案後暫停",true)}</md-outlined-button>
          ${this.button("Export queue history", "匯出佇列記錄",async()=>{const destination=await this.choose("write");try{this.result(await this.tool({action:"queue.export",destinationId:destination.id}));}finally{await this.release([destination.id]);}})}
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
              this.queuePoll=setInterval(async()=>{if(this.refreshingQueue)return;this.refreshingQueue=true;try{await this.queuePage();this.changed();}catch{}finally{this.refreshingQueue=false;}},1500);
              this.changed();
              try {
                const r = await this.tool({ action: "queue.run" });
                this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>`${l("Queue finished", "佇列已完成")}: ${r.completed} / ${r.failed}`);
                await this.queuePage();
              } catch (e) {
                this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
                  "Queue could not finish. Refresh its status.",
                  "佇列未能完成，請重新整理狀態。",
                ));
              } finally {
                clearInterval(this.queuePoll);
                this.runningQueue = false;
                this.changed();
              }
            }}
            >${actionIcon('Run queue')}${this.l("Run queue","執行佇列",true)}</md-outlined-button
          >
        </div>
        ${this.jobs.map(
          (j) =>
            html`<div class="row record">
              <span>${j.request.action} ${j.request.category||""} ${j.request.format||""}</span>${j.request.action==="converter.convert"&&!["structured","text","binary"].includes(String(j.request.category))?html`<span>${this.l("Isolated attempt","隔離轉換嘗試",true)}</span>`:nothing}<strong>${j.state}</strong
              >${j.request.action!=="ollama.pull"&&!["running","completed"].includes(j.state)?this.button("Reauthorize files", "重新授權檔案",()=>this.reauthorize(j),this.runningQueue):nothing}<span>${j.result?.code}</span>${j.result?.incompleteOutput?html`<span>${j.result.incompleteOutput.state==="retained"?this.l("Incomplete output retained; final output not published","已保留未完成輸出，最終輸出未發佈",true):this.l("Output publication unconfirmed; inspect destination before retrying","未能確認輸出發佈，重試前請檢查目的地",true)} ${j.result.incompleteOutput.name||""}</span>`:nothing}<span>${j.result?.bytes!==undefined?`${j.result.bytes} bytes`:""}</span><span>${j.finishedAt||j.startedAt||""}</span>${[
                "queued",
                "running",
                "interrupted",
              ].includes(j.state)
                ? this.button("Cancel job", "取消工作", async () => {
                    await this.tool({ action: "queue.cancel", id: j.id });
                    await this.queuePage();
                  })
                : nothing}${j.previousOutcomes?.length?html`<details><summary>${this.l("Earlier attempt outcomes","較早嘗試結果",true)}</summary><ul>${j.previousOutcomes.map(outcome=>html`<li>${outcome.state} · ${outcome.finishedAt||""} · ${outcome.result?.code||""} · ${outcome.result?.incompleteOutput?.state||""} ${outcome.result?.incompleteOutput?.publication||""} ${outcome.result?.incompleteOutput?.name||""}</li>`)}</ul></details>`:nothing}${["interrupted", "failed", "cancelled"].includes(
                j.state,
              )
                && !(j.request.action==="ollama.pull"&&(j.state==="interrupted"||j.result?.incompleteOutput?.state==="unknown")) ? this.button("Retry job", "重試工作", async () => {
                    if(j.request.action!=="ollama.pull") {await this.reauthorize(j);return;}
                  await this.tool({ action: "queue.resume", id: j.id });
                    await this.queuePage();
                  })
                : nothing}
            </div>`,
        )}${!this.jobs.length
          ? html`<p>
              ${this.l("No jobs loaded. Refresh to check saved jobs.","未載入工作，請重新整理以檢查已儲存工作。",true)}
            </p>`
          : nothing}${this.next
          ? this.button("Next page", "下一頁", () =>
              this.queuePage(this.next!),
            )
          : nothing}
      </section>
      <section data-destination="server" data-experience-id="tools-section:server" tabindex="-1"><minecraft-panel .language=${this.language}></minecraft-panel></section>
    </div>`;
  }
}
customElements.define("tools-panel", ToolsPanel);
