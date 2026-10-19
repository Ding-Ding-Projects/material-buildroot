import "./editor-transfer-panel";
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
type Feedback = { task: string; key: string; action: [string, string]; value: string };
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
const toolTasks=[['tool:local','Local tool setup','本機工具設定'],['tool:convert','Convert a file','轉換檔案'],['tool:pdf','PDF operations','PDF 操作'],['tool:queue','File/model queue','檔案／模型佇列'],['tool:server','Server management','伺服器管理']];
export class ToolsPanel extends LitElement {
  static properties = { language: { type: String }, revision: { state: true }, selectedTask:{state:true} };
  language = "bilingual";
  selectedTask='tool:local';
  private navigationEpoch=0;
  private pickerReturn?:{id:string;epoch:number};
  private taskLabel(id:string){const entry=toolTasks.find(([value])=>value===id);return entry?this.l(entry[1],entry[2],true):'';}
  /** Presentation-only navigation; no file picker or operation is invoked. */
  async openDestination(id:string){
    if(!toolTasks.some(([value])=>value===id))return false;
    this.pickerReturn=undefined;
    const epoch=++this.navigationEpoch;this.selectedTask=id;await this.updateComplete;
    if(epoch!==this.navigationEpoch||this.selectedTask!==id||!this.isConnected||!this.checkVisibility())return false;
    const heading=this.renderRoot.querySelector<HTMLElement>('#tool-heading-'+id.slice(5));heading?.focus();heading?.scrollIntoView({block:'start',behavior:'auto'});return true;
  }
  private chooseTask(event:Event){
    const select=event.currentTarget as HTMLElement&{value:string};
    const returnsFromPicker=!select.matches(':focus-within'),id=select.value;
    void this.openDestination(id);
    if(returnsFromPicker)this.pickerReturn={id,epoch:this.navigationEpoch};
  }
  private async taskPickerFocus(){
    const pending=this.pickerReturn;this.pickerReturn=undefined;
    if(!pending)return;await this.updateComplete;
    // The shared picker restores its trigger after its closed event and close promise.
    // Move focus once both restorations have settled, retaining the navigation epoch.
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    if(pending.epoch!==this.navigationEpoch||pending.id!==this.selectedTask||!this.isConnected||!this.checkVisibility())return;
    const heading=this.renderRoot.querySelector<HTMLElement>('#tool-heading-'+pending.id.slice(5));heading?.focus();heading?.scrollIntoView({block:'start',behavior:'auto'});
  }
  disconnectedCallback(){this.navigationEpoch++;this.pickerReturn=undefined;super.disconnectedCallback();}
  private get primaryAction(){
    if(this.selectedTask==='tool:local')return this.payloads.some(p=>!p.available)?'Choose executable':'Check tool availability';
    if(this.selectedTask==='tool:convert')return !this.categories.find(c=>c.category===this.category)?.formats.find(f=>f.format===this.format)?.available?'Load formats':!this.source?'Choose source':!this.destination?'Choose new output':'Convert now';
    if(this.selectedTask==='tool:pdf')return !this.pdfSources.length?'Add PDF source':this.pdfOperation!=='inspect'&&!this.pdfDestination?'Choose PDF output':'Run PDF operation';
    if(this.selectedTask==='tool:queue')return this.runningQueue?'Refresh queue':this.jobs.some(j=>j.state==='interrupted')?'Recover interrupted jobs':this.jobs.some(j=>j.state==='queued')?'Run queue':this.model.trim()?'Queue model download':'Refresh queue';
    return '';
  }
  revision = 0;
  private pending = false;
  private runningQueue = false;
  private feedback = new Map<string, Feedback>();
  private categories: Category[] = [];
  private visibleFormats: Record<string, string[]> = {};
  private category = "text";
  private format = "txt";
  private source?: Grant;
  private sourcePreview?: {bytes:number;detected:string;sampledBytes:number;complete:boolean};
  private destination?: Grant;
  private pdfSources: Grant[] = [];
  private pdfDestination?: Grant;
  private pdfOperation = "extract";
  private pdfOperations: {operation:string;attemptAvailable:boolean;reason?:string}[] = [];
  private visiblePdfOperations: string[] | undefined;
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
      [hidden]{display:none!important}
      .task-selector{max-width:640px}
      .columns {
        display: contents;
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
  private startFeedback(action: [string, string], task = this.selectedTask): Feedback {
    const record: Feedback = {task, key: crypto.randomUUID(), action, value: ""};
    this.feedback.set(task, record);
    return record;
  }
  private setFeedback(record: Feedback, render: (l: (en: string, zh: string) => string) => string) {
    record.value = captureOwnedStatus(record, record.key, this.l.bind(this), render);
  }
  private displayFeedback() {
    const record = this.feedback.get(this.selectedTask);
    return record ? displayOwnedStatus(record, record.key, record.value, this.language) : "";
  }
  private async run(work: (record: Feedback) => Promise<void>, action: [string, string]) {
    if (this.pending) return;
    this.pending = true;
    const record = this.startFeedback(action);
    this.changed();
    try {
      await work(record);
      if (!record.value) this.setFeedback(record, l => `${l(...record.action)}: ${l("Completed", "已完成")}`);
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : "OPERATION_FAILED";
      const partial=(error as {incompleteOutput?:{state:string;name?:string;publication:string}})?.incompleteOutput;
      this.setFeedback(record,l=>`${l("Operation not completed", "操作未完成")}: ${code} ${partial?.state==="retained"?l("Incomplete output retained; final output was not published.","已保留未完成輸出，最終輸出未發佈。")+" "+partial.name:partial?.state==="unknown"?l("Output publication could not be confirmed. Inspect the selected output folder before retrying.","未能確認輸出發佈狀態，重試前請檢查所選輸出資料夾。"):""}`);
    } finally {
      this.pending = false;
      this.changed();
    }
  }
  private button(
    en: string,
    zh: string,
    work: (record: Feedback) => Promise<void>,
    disabled = false,
    primary = this.primaryAction===en,
    trackPending = true,
  ) {
    const invoke=()=>trackPending?this.run(work,[en,zh]):work(this.startFeedback([en,zh]));
    if(primary)return html`<md-filled-button data-primary-action=${en} ?disabled=${this.pending||disabled} @click=${invoke}>${actionIcon(en)}${this.l(en,zh)}</md-filled-button>`;
    if (/^(Refresh|Remove|Move|Stop|Cancel|Revoke)\b/.test(en)) return html`<md-icon-button aria-label=${localizedCopy(en,zh,this.language,true,"accessible-name")} title=${this.l(en,zh)} ?disabled=${this.pending||disabled} @click=${invoke}>${materialIcon(actionSymbol(en))}</md-icon-button>`;
    return html`<md-outlined-button
      ?disabled=${this.pending || disabled}
      @click=${invoke}
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
  disconnectedCallback() { clearInterval(this.queuePoll); super.disconnectedCallback(); }
  private disclosure(category:string) {
    if(category==="video")return this.format==="mp4"
      ? this.l("Lossy fragmented MP4 uses H.264/yuv420p with optional first AAC audio. Only the first video and first audio stream are kept. Subtitles, data, metadata and chapters are omitted. Seek-dependent sources, unavailable codecs or resource limits may stop the attempt without publishing a final output. Keep the original.","有損分段 MP4 使用 H.264/yuv420p，並可將第一條音訊轉成 AAC。只保留第一條影片同音訊串流，字幕、資料、中繼資料同章節會略過。需要搜尋位置嘅來源、缺少編解碼器或資源限制可能令嘗試停止而唔發佈最終輸出，請保留原檔。",true)
      : this.l("Lossy WebM uses VP9 with optional first Opus audio. Only the first video and first audio stream are kept. Subtitles, data, metadata and chapters are omitted. Seek-dependent sources, unavailable codecs or resource limits may stop the attempt without publishing a final output. Keep the original.","有損 WebM 使用 VP9，並可將第一條音訊轉成 Opus。只保留第一條影片同音訊串流，字幕、資料、中繼資料同章節會略過。需要搜尋位置嘅來源、缺少編解碼器或資源限制可能令嘗試停止而唔發佈最終輸出，請保留原檔。",true);

    if(category==="binary")return this.l("Every input byte is encoded as text. This operation does not decode encoded text.","所有輸入位元組會編碼成文字，此操作唔會解碼已編碼文字。",true);
    if(category==="structured")return this.l("JSON and CSV tables only. CSV loses value types; nested values and spreadsheet formulas are rejected.","只支援 JSON 同 CSV 表格。CSV 唔會保留數值類型，巢狀值同試算表公式唔獲接受。",true);
    if(category==="text")return this.l("Strict UTF-8 only. Original line endings are preserved.","只支援有效 UTF-8，原有換行符號會保留。",true);
    return this.l("The target may omit metadata, fonts, layers, animation, transparency or precision. Keep the original file.","目標格式可能唔保留中繼資料、字體、圖層、動畫、透明度或精確度，請保留原檔。",true);
  }
  private unavailable(code?:string) {
    const reasons:Record<string,[string,string]>={BUNDLED_ADAPTER_REQUIRED:["Verified packaged adapter required","需要已驗證封裝工具"],MISSING_VERIFIED_PAYLOAD:["Packaged adapter is missing","缺少封裝工具"],ISOLATED_RUNTIME_REQUIRED:["Verified isolated execution unavailable","未有已驗證隔離執行環境"],PAYLOAD_HASH_MISMATCH:["Packaged adapter integrity mismatch","封裝工具完整性不符"],NATIVE_BROKER_UNAVAILABLE:["Native isolation broker unavailable","原生隔離程序未能使用"],NATIVE_FORMAT_NOT_SUPPORTED:["No native isolated operation for this format","此格式未有原生隔離操作"],NATIVE_PDF_OPERATION_UNAVAILABLE:["No native isolated protocol for this PDF operation","此 PDF 操作未有原生隔離協定"],ISOLATED_ATTEMPT_UNVERIFIED:["Packaged isolated attempt available; runtime acceptance unverified","可嘗試封裝隔離操作，實際執行驗收未驗證"]};
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
  private result(record: Feedback, result: {
    bytes?: number;
    pages?: number;
    pageCounts?: number[];
    validation?: string;
  }) {
    this.setFeedback(record,l=>[
      `${l(...record.action)}: ${l("Completed", "已完成")}`,
      result.bytes !== undefined ? `${result.bytes} bytes` : "",
      result.validation === "signature-and-decoder-roundtrip" ? l("This output passed signature and decoder round-trip checks", "此輸出已通過格式簽章同解碼往返檢查") : "",
      result.validation === "qpdf-structure-page-count-and-rotation" ? l("PDF structure, page count and effective rotations checked; visual equivalence is unverified", "已檢查 PDF 結構、頁數同實際旋轉角度，視覺等同性未經驗證") : "",
      result.validation === "qpdf-structure-page-count-and-metadata" ? l("PDF structure, page count and Info/XMP absence checked; other content is not sanitized", "已檢查 PDF 結構、頁數同 Info/XMP 不存在，其他內容未被清除") : "",
      result.validation === "qpdf-structure-and-page-count" ? l("PDF structure and page count checked; visual equivalence and page-order equivalence are unverified", "已檢查 PDF 結構同頁數，視覺等同性同頁序等同性未經驗證") : "",
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
  private pdfDisclosure(){
    if(this.pdfOperation==="merge")return this.l("Merge accepts 1–8 PDFs in the displayed order, at most 64 MiB of original bytes and 10,000 total pages. Each source digest and page count is bound to that order. Structure and total page count are checked; visual and page-order equivalence remain unverified.","合併按顯示次序接受 1 至 8 份 PDF，原始位元組總共最多 64 MiB，同最多 10,000 頁。每份來源嘅摘要同頁數會按此順序記錄。會檢查結構同總頁數，但視覺及頁序等同性仍未驗證。",true);
    if(this.pdfOperation==="rotate")return this.l("Rotate accepts one PDF and up to 1,000 distinct page numbers. Choose 90, 180 or 270 clockwise degrees. The broker compares every page's effective inherited rotation with the requested change and checks unchanged pages too. Visual equivalence remains unverified.","旋轉接受一份 PDF 同最多 1,000 個不重複頁碼，可選順時針 90、180 或 270 度。隔離程序會逐頁比較實際繼承旋轉角度同所選改動，亦會檢查冇改動嘅頁面。視覺等同性仍未驗證。",true);
    if(this.pdfOperation==="metadata")return this.l("Metadata removal accepts one PDF. The broker checks that trailer Info and catalog XMP Metadata are absent and that the page count is unchanged. Other metadata, document text, embedded files and active content are not sanitized. Visual equivalence remains unverified.","中繼資料移除接受一份 PDF。隔離程序會檢查 trailer Info 同 catalog XMP Metadata 已不存在，並確認頁數冇改變。其他中繼資料、文件文字、內嵌檔案同主動內容唔會被清除。視覺等同性仍未驗證。",true);
    return this.l("Extract and reorder accept one PDF and 1–1,000 explicit page numbers between 1 and 10,000. The broker checks source structure and resulting page count. Visual and page-order equivalence remain unverified. Encrypted or unsupported documents can fail; sources remain unchanged.","擷取同重排接受一份 PDF，同 1 至 1,000 個介乎 1 至 10,000 嘅明確頁碼。隔離程序會檢查來源結構同結果頁數，視覺及頁序等同性仍未驗證。加密或不支援文件可能失敗，來源保持不變。",true);
  }
  private pdfOperationName(operation:string){
    const names:Record<string,[string,string]>={inspect:["Inspect","檢視"],split:["Split","分割"],merge:["Merge","合併"],extract:["Extract selected pages","擷取所選頁面"],reorder:["Reorder pages","重排頁面"],rotate:["Rotate","旋轉"],metadata:["Metadata","中繼資料"]};
    const name=names[operation];return name?localizedCopy(name[0],name[1],this.language,true):operation;
  }
  private pdfReady() {
    return (
      this.pdfOperations.some(o=>o.operation===this.pdfOperation&&o.attemptAvailable) &&
      !!this.pdfSources.length &&
      (this.pdfOperation === "inspect" || !!this.pdfDestination) &&
      (["merge", "inspect"].includes(this.pdfOperation) ||
        this.pdfSources.length === 1)
    );
  }
  private async executePdf(queued: boolean, record: Feedback) {
    const requiresPages = ["split", "extract", "reorder", "rotate"].includes(
      this.pdfOperation,
    );
    if (requiresPages && !/^\s*[1-9]\d*(\s*,\s*[1-9]\d*)*\s*$/.test(this.pages))
      throw new Error("INVALID_PAGE_SELECTION");
    if(requiresPages&&(this.pages.split(",").length>1000||this.pages.split(",").some(p=>Number(p)>10000)))throw new Error("INVALID_PAGE_SELECTION");
    if(this.pdfOperation==="rotate"&&new Set(this.pages.split(",").map(Number)).size!==this.pages.split(",").length)throw new Error("INVALID_ROTATION");
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
    } else this.result(record, await this.tool(request));
    if(!queued)await this.release([...this.pdfSources.map(s=>s.id),...(this.pdfDestination?[this.pdfDestination.id]:[])]);
    this.pdfSources=[];
    this.pdfDestination = undefined;
  }
  private async runQueue(record: Feedback){
              this.runningQueue = true;
              this.queuePoll=setInterval(async()=>{if(this.refreshingQueue)return;this.refreshingQueue=true;try{await this.queuePage();this.changed();}catch{}finally{this.refreshingQueue=false;}},1500);
              this.changed();
              try {
                const r = await this.tool({ action: "queue.run" });
                this.setFeedback(record,l=>`${l("Queue finished", "佇列已完成")}: ${r.completed} / ${r.failed}`);
                await this.queuePage();
              } catch (e) {
                this.setFeedback(record,l=>l(
                  "Queue could not finish. Refresh its status.",
                  "佇列未能完成，請重新整理狀態。",
                ));
              } finally {
                clearInterval(this.queuePoll);
                this.runningQueue = false;
                this.changed();
              }
  }
  render() {
    const formats = this.categories.find(
      (c) => c.category === this.category,
    )?.formats;
    const requiresPages = ["split", "extract", "reorder", "rotate"].includes(
      this.pdfOperation,
    );
    return html`<div class="stack" aria-busy=${this.pending}>
      <md-outlined-select id="tool-task" class="task-selector" .label=${this.l('Choose a utility task','選擇工具工作',true)} .value=${this.selectedTask} .displayText=${this.taskLabel(this.selectedTask)} @change=${this.chooseTask} @focusin=${this.taskPickerFocus}>${toolTasks.map(([id,en,zh])=>html`<md-select-option value=${id}><div slot="headline">${this.l(en,zh,true)}</div></md-select-option>`)}</md-outlined-select>
      <editor-transfer-panel .language=${this.language}></editor-transfer-panel>
      ${this.pending || this.runningQueue
        ? html`<md-linear-progress
            indeterminate
            aria-label=${this.l("Operation in progress","操作進行中",true)}
          ></md-linear-progress>`
        : nothing}
      <div role="status" aria-live="polite">${this.displayFeedback()}</div>
      <section class="panel stack" data-destination="local" ?hidden=${this.selectedTask!=='tool:local'} ?inert=${this.selectedTask!=='tool:local'} aria-labelledby="tool-heading-local" data-experience-id="tools-section:local" tabindex="-1">
        <h2 id="tool-heading-local" tabindex="-1">${this.l("Local tools","本機工具",true)}</h2>
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
                },false,p===this.payloads.find(item=>!item.available),
              )}
            </div>`,
        )}
      </section>
      <div class="columns">
        <section class="panel stack" data-destination="convert" ?hidden=${this.selectedTask!=='tool:convert'} ?inert=${this.selectedTask!=='tool:convert'} aria-labelledby="tool-heading-convert" data-experience-id="tools-section:convert" tabindex="-1">
          <h2 id="tool-heading-convert" tabindex="-1">${this.l("Convert a file","轉換檔案",true)}</h2>
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
              async (record) => {
                this.result(record, await this.tool(this.conversion()));
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
        <section class="panel stack" data-destination="pdf" ?hidden=${this.selectedTask!=='tool:pdf'} ?inert=${this.selectedTask!=='tool:pdf'} aria-labelledby="tool-heading-pdf" data-experience-id="tools-section:pdf" tabindex="-1">
          <h2 id="tool-heading-pdf" tabindex="-1">${this.l("PDF workspace","PDF 工作區",true)}</h2>
          <p class="note">
            ${this.l("Only admitted native PDF operations can be attempted. Packaged readiness is separate from runtime acceptance. Page numbers start at 1.","只可嘗試已接入嘅原生 PDF 操作。封裝準備同實際執行驗收分開，頁碼由 1 開始。",true)}
          </p>
          ${this.button("Load PDF operations","載入 PDF 操作",async()=>{this.pdfOperations=(await this.tool({action:"pdf.catalog"})).operations;})}
          <settings-search .language=${this.language} .label=${this.l("Search PDF operations","搜尋 PDF 操作",true)}
            .entries=${this.pdfOperations.map(o=>({id:o.operation,text:`${o.operation} ${this.pdfOperationName(o.operation)} ${o.reason||""}`}))}
            @settings-filter=${(e:CustomEvent)=>{e.stopPropagation();const ids=e.detail as string[];if(JSON.stringify(this.visiblePdfOperations)!==JSON.stringify(ids)){this.visiblePdfOperations=ids;this.changed();}}}></settings-search>
          ${this.pdfOperations.filter(o=>!this.visiblePdfOperations||this.visiblePdfOperations.includes(o.operation)).map(o=>html`<div class="record">
            <md-outlined-button ?disabled=${!o.attemptAvailable||this.pending} aria-pressed=${this.pdfOperation===o.operation} @click=${()=>{this.pdfOperation=o.operation;this.changed();}}>${this.pdfOperationName(o.operation)}</md-outlined-button>
            <span>${this.unavailable(o.reason)}</span>
          </div>`)}
          <p>${this.pdfOperationName(this.pdfOperation)}</p>
          <p class="note">${this.pdfDisclosure()}</p>
          ${this.button(
            "Add PDF source",
            "加入 PDF 來源",
            async () => {
              this.pdfSources = [...this.pdfSources, await this.choose("read")];
            },
            this.pdfSources.length >= (this.pdfOperation==="merge"?8:1),
          )}
          ${this.pdfSources.map(
            (s, i) =>
              html`<div class="row">
                <span>${i + 1}. ${s.name}</span>${this.pdfOperation==="merge"?html`
                  ${this.button("Move PDF earlier","將 PDF 移前",async()=>{const next=[...this.pdfSources];[next[i-1],next[i]]=[next[i],next[i-1]];this.pdfSources=next;},i===0)}
                  ${this.button("Move PDF later","將 PDF 移後",async()=>{const next=[...this.pdfSources];[next[i],next[i+1]]=[next[i+1],next[i]];this.pdfSources=next;},i===this.pdfSources.length-1)}
                `:nothing}${this.button(
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
                ${this.l("Removes trailer Info and catalog XMP Metadata only. This is not complete sanitization of document content, embedded files or active content.","只移除 trailer Info 同 catalog XMP Metadata，唔代表已全面清除文件內容、內嵌檔案或主動內容。",true)}
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
              "Attempt isolated PDF operation",
              "嘗試隔離 PDF 操作",
              (record) => this.executePdf(false, record),
              !this.pdfReady(),
            )}${this.button(
              "Queue isolated PDF attempt",
              "排程隔離 PDF 嘗試",
              (record) => this.executePdf(true, record),
              !this.pdfReady(),
            )}
            <md-outlined-button ?disabled=${!this.pending&&!this.runningQueue} @click=${async()=>{
              try{const r=await this.tool({action:"pdf.cancel"});this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Cancellation requested for active isolated PDF operations","已要求取消目前隔離 PDF 操作")+`: ${r.requested}`);}
              catch{this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Cancellation could not be delivered","未能送出取消要求"));}this.changed();
            }}>${this.l("Cancel active isolated PDF operations","取消目前隔離 PDF 操作",true)}</md-outlined-button>
          </div>
        </section>
      </div>
      <section class="panel stack" data-destination="queue" ?hidden=${this.selectedTask!=='tool:queue'} ?inert=${this.selectedTask!=='tool:queue'} aria-labelledby="tool-heading-queue" data-experience-id="tools-section:queue" tabindex="-1">
        <h2 id="tool-heading-queue" tabindex="-1">${this.l("File and model queue","檔案同模型佇列",true)}</h2>
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
          )}${this.button('Run queue','執行佇列',(record)=>this.runQueue(record),this.runningQueue,this.primaryAction==='Run queue',false)}
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
      <section data-destination="server" ?hidden=${this.selectedTask!=='tool:server'} ?inert=${this.selectedTask!=='tool:server'} aria-labelledby="tool-heading-server" data-experience-id="tools-section:server" tabindex="-1"><h2 id="tool-heading-server" tabindex="-1">${this.taskLabel('tool:server')}</h2><minecraft-panel .language=${this.language}></minecraft-panel></section>
    </div>`;
  }
}
customElements.define("tools-panel", ToolsPanel);

