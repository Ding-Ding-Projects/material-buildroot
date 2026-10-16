import { LitElement, html, css, nothing } from "lit";
import { localizedCopy } from "./language-wording";
import { workspaceStyles } from "./workspace-styles";
import "@material/web/dialog/dialog.js";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/checkbox/checkbox.js";

type Selection = { id: string; name: string };
type Fingerprint = { sha256: string; bytes: number };
type Transfer = { id: string; state: string; request: { action: string; version: string }; progress?: { bytes: number; total: number | null; bytesPerSecond: number; etaSeconds: number | null }; result?: { code?: string; transfer?: { bytes: number; sha256: string; destination: string; receipt: string }; incompleteOutput?: { partial?: string; receipt?: string; bytes?: number; publication?: string } } };
export class EditorTransferPanel extends LitElement {
  static properties = { language: { type: String }, revision: { state: true } };
  language = "bilingual";
  revision = 0;
  private busy = false;
  private code = "";
  private editor?: { kind: string; sha256: string };
  private document?: Selection;
  private destination?: Selection;
  private handoff?: { id: string; name: string; before: Fingerprint };
  private handoffs: { id: string; name: string; before: Fingerprint; state: string; requiresReselection: boolean }[] = [];
  private comparison?: { changed: boolean; current: Fingerprint; acknowledged: boolean };
  private version = "";
  private sha256 = "";
  private foreground = false;
  private alwaysOnTop = false;
  private preview?: { source: string; name: string; maxBytes: number; sha256: string };
  private jobs: Transfer[] = [];
  private running = false;
  private timer?: ReturnType<typeof setInterval>;
  private progressOpen = false;
  private completion?: Transfer;
  private seen = new Set<string>();
  static styles = [workspaceStyles, css`:host{display:block;min-width:0} .stack{display:grid;gap:16px}.row{display:flex;flex-wrap:wrap;gap:12px;align-items:center} md-outlined-text-field{width:100%;min-width:0} code{overflow-wrap:anywhere} md-dialog{max-width:min(640px,calc(100vw - 24px))} .content{display:grid;gap:12px;overflow-wrap:anywhere} label{display:flex;gap:12px;align-items:center}`];
  private l(en: string, zh: string) { return localizedCopy(en, zh, this.language, true); }
  private async call(action: string, fields: Record<string, unknown> = {}): Promise<any> {
    if (!window.studio?.operations) throw Error("DESKTOP_REQUIRED");
    const reply = await window.studio.operations({ action, ...fields });
    if (!reply.ok) throw Error(reply.code);
    return reply.result;
  }
  private async tool(request: Record<string, unknown>): Promise<any> {
    const r = await this.call("tools", { request });
    if (r?.ok === false) throw Error(r.code);
    return r;
  }
  private async act(work: () => Promise<void>) {
    if (this.busy) return; this.busy = true; this.code = ""; this.revision++;
    try { await work(); } catch (e) { this.code = e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : "OPERATION_FAILED"; }
    finally { this.busy = false; this.revision++; }
  }
  disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.timer); this.timer = undefined; }
  private async refresh() {
    let after = "", all: Transfer[] = [];
    for (let page = 0; page < 10; page++) {
      const result = await this.tool({ action: "queue.page", after, limit: 100 });
      all.push(...result.items.filter((j: Transfer) => j.request.action === "transfer.download"));
      if (!result.next) break; after = result.next;
    }
    this.jobs = all;
    for (const job of all) if (job.state === "completed" && !this.seen.has(job.id)) { this.seen.add(job.id); this.completion = job; }
    this.revision++;
  }
  private request() { return { action: "transfer.download", version: this.version, sha256: this.sha256.trim().toLowerCase(), destinationId: this.destination!.id, accepted: true }; }
  private async start() {
    this.preview = undefined;
    await this.tool({ action: "queue.add", job: this.request() });
    await this.runQueue();
  }
  private async runQueue() {
    this.running = true; this.progressOpen = true;
    this.timer = setInterval(() => { void this.refresh().catch(() => { this.code = "TRANSFER_STATUS_UNAVAILABLE"; this.revision++; }); }, 1000);
    void this.tool({ action: "queue.run" }).then(() => this.refresh()).catch(e => { this.code = e instanceof Error ? e.message : "QUEUE_FAILED"; }).finally(() => { this.running = false; clearInterval(this.timer); this.timer = undefined; this.revision++; });
    await this.refresh();
  }
  private rows() { return this.jobs.map(job => html`<section><h4>${job.request.version}</h4><p>${job.state} · <code>${job.id}</code></p>${job.progress ? html`<md-linear-progress .value=${job.progress.total ? job.progress.bytes / job.progress.total : 0} ?indeterminate=${!job.progress.total} aria-label=${this.l("Downloaded bytes", "已下載位元組")}></md-linear-progress><p>${job.progress.bytes} / ${job.progress.total ?? this.l("Unknown", "未知道")} ${this.l("bytes", "位元組")} · ${job.progress.bytesPerSecond} B/s · ETA ${job.progress.etaSeconds ?? this.l("Unknown", "未知道")}</p>` : nothing}${job.result?.code ? html`<p>${job.result.code}</p>` : nothing}${job.result?.incompleteOutput ? html`<p>${this.l("Retained incomplete receipt", "保留未完成收據")}: ${job.result.incompleteOutput.receipt || this.l("Unavailable", "未提供")}</p><p>${job.result.incompleteOutput.partial} · ${job.result.incompleteOutput.bytes ?? 0} B</p>` : nothing}${["queued", "running"].includes(job.state) ? html`<md-text-button @click=${() => this.act(async () => { await this.tool({ action: "queue.cancel", id: job.id }); await this.refresh(); })}>${this.l("Cancel transfer", "取消傳輸")}</md-text-button>` : nothing}${["failed", "cancelled", "interrupted"].includes(job.state) ? html`<md-outlined-button ?disabled=${!this.destination || this.busy || this.running} @click=${() => this.act(async () => { await this.tool({ action: "queue.rebind", id: job.id, job: this.request() }); await this.refresh(); })}>${this.l("Rebind reviewed inputs and queue a fresh attempt", "重新綁定已檢視輸入並排入新嘗試")}</md-outlined-button>` : nothing}</section>`); }
  render() { return html`<section class="panel stack" aria-label=${this.l("Editor and browser transfers", "編輯器同瀏覽器傳輸")}>
    <h2>${this.l("Editor and browser transfers", "編輯器同瀏覽器傳輸")}</h2>
    <p role="status" aria-live="polite">${this.code}</p>
    <h3>${this.l("External document editor", "外部文件編輯器")}</h3>
    <p>${this.l("Choose a trusted Code, Code Insiders, Notepad++ or Notepad executable. Admission retains its hash locally. Each launch needs an explicit foreground choice; the editor may modify the selected document.", "選擇可信嘅 Code、Code Insiders、Notepad++ 或 Notepad 執行檔。接納記錄會喺本機保留摘要。每次啟動都要明確選擇前景顯示，編輯器可能修改所選文件。")}</p>
    <div class="row"><md-outlined-button ?disabled=${this.busy} @click=${() => this.act(async () => { this.editor = (await this.tool({ action: "editor.choose" })).editor; })}>${this.l("Choose and trust editor", "選擇並信任編輯器")}</md-outlined-button><md-text-button ?disabled=${this.busy} @click=${() => this.act(async () => { this.editor = (await this.tool({ action: "editor.status" })).editor; })}>${this.l("Read saved editor", "讀取已儲存編輯器")}</md-text-button><md-outlined-button ?disabled=${this.busy} @click=${() => this.act(async () => { this.document = await this.call("file.choose", { access: "read", kind: "file" }); this.handoff = undefined; this.comparison = undefined; })}>${this.l("Select document or exported file", "選擇文件或已匯出檔案")}</md-outlined-button></div>
    <p>${this.editor?.kind || this.l("No admitted editor", "未接納編輯器")} · ${this.document?.name || this.l("No document selected", "未選擇文件")}</p>
    <div class="row"><md-outlined-button ?disabled=${this.busy} @click=${() => this.act(async () => { this.document = await this.call("file.choose", { access: "read", kind: "directory" }); this.handoff = undefined; this.comparison = undefined; })}>${this.l("Select project folder for Code workspace", "選擇 Code 工作區專案資料夾")}</md-outlined-button><md-text-button ?disabled=${this.busy} @click=${() => this.act(async () => { this.handoffs = (await this.tool({ action: "editor.handoffs" })).handoffs; })}>${this.l("Load saved handoffs", "載入已儲存交接")}</md-text-button></div>
    <p>${this.l("Folder handoff requires Code and fingerprints at most 1,000 entries and 64 MiB. Saved handoffs never restore file permission or adopt an old editor process. Reselect the original file or folder before reconciling a recovered record.", "資料夾交接需要 Code，摘要最多涵蓋 1,000 項同 64 MiB。已儲存交接唔會還原檔案權限，亦唔會接管舊編輯器程序。核對復原記錄前，請重新選擇原本檔案或資料夾。")}</p>
    ${this.handoffs.map(record => html`<section><p>${record.name} · ${record.state}</p><code>${record.before.sha256}</code>${record.state !== "acknowledged" ? html`<md-text-button ?disabled=${this.busy || !this.document} @click=${() => this.act(async () => { this.handoff = (await this.tool({ action: "editor.rebind", id: record.id, sourceId: this.document!.id })).handoff; this.comparison = undefined; })}>${this.l("Bind freshly selected document to this handoff", "將新選文件綁定至此交接")}</md-text-button>` : nothing}</section>`)}
    <label><md-checkbox .checked=${this.foreground} @change=${(e: Event) => { this.foreground = (e.target as HTMLInputElement).checked; this.revision++; }}></md-checkbox>${this.l("Allow this explicit action to open an external foreground window", "允許此明確操作開啟外部前景視窗")}</label>
    <md-filled-button ?disabled=${this.busy || !this.foreground || !this.editor || !this.document} @click=${() => this.act(async () => { const result = await this.tool({ action: "editor.open", sourceId: this.document!.id, accepted: true, visibility: "foreground" }); this.handoff = result.handoff; this.comparison = undefined; this.foreground = false; })}>${this.l("Open selected document", "開啟所選文件")}</md-filled-button>
    ${this.handoff ? html`<p>${this.l("Before handoff SHA-256", "交接前 SHA-256")}: <code>${this.handoff.before.sha256}</code></p><md-outlined-button ?disabled=${this.busy} @click=${() => this.act(async () => { this.comparison = (await this.tool({ action: "editor.reconcile", id: this.handoff!.id })).reconciliation; })}>${this.l("Compare external changes", "比較外部變更")}</md-outlined-button>` : nothing}
    ${this.comparison ? html`<p>${this.comparison.changed ? this.l("Document changed externally. Reload it in the owning workflow before any further save. No content is overwritten here.", "文件已被外部修改。再次儲存前請喺所屬工作流程重新載入，呢度唔會覆寫內容。") : this.l("Document bytes are unchanged.", "文件位元組未有改變。")}</p><code>${this.comparison.current.sha256}</code><md-text-button ?disabled=${this.busy || this.comparison.acknowledged} @click=${() => this.act(async () => { this.comparison = (await this.tool({ action: "editor.acknowledge", id: this.handoff!.id, sha256: this.comparison!.current.sha256 })).reconciliation; })}>${this.l("Acknowledge this exact revision", "確認此確切版本")}</md-text-button>` : nothing}
    <h3>${this.l("Verified Buildroot release download", "核對 Buildroot 發行下載")}</h3>
    <md-outlined-button ?disabled=${this.busy} @click=${() => this.act(async () => { const result = await this.tool({ action: "transfer.visibility", accepted: true, alwaysOnTop: !this.alwaysOnTop }); this.alwaysOnTop = result.alwaysOnTop; })}>${this.alwaysOnTop ? this.l("Stop keeping this window above other applications", "停止將此視窗保持喺其他應用程式上方") : this.l("Explicitly keep this window above other applications", "明確選擇將此視窗保持喺其他應用程式上方")}</md-outlined-button>
    <p>${this.l("This optional window choice does not activate or focus the window. It remains enabled until you turn it off or close the application.", "此選擇唔會啟用視窗或轉移焦點，會維持至你關閉此選項或關閉應用程式。")}</p>
    <p>${this.l("Only official Buildroot release archives are accepted. Supply the independently obtained SHA-256. Transfers retain partial bytes and receipts, never overwrite a destination, and never extract or execute downloads. After interruption select a new destination and explicitly rebind; byte-range resume is unavailable.", "只接受官方 Buildroot 發行壓縮檔。請提供獨立取得嘅 SHA-256。傳輸會保留部分位元組同收據，唔會覆寫目的檔案，亦唔會解壓或執行下載。中斷後請選擇新目的地並明確重新綁定；唔支援位元組範圍續傳。")}</p>
    <md-outlined-text-field .label=${this.l("Buildroot version", "Buildroot 版本")} .value=${this.version} @input=${(e: Event) => { this.version = (e.target as HTMLInputElement).value; this.preview = undefined; }}></md-outlined-text-field>
    <md-outlined-text-field .label=${this.l("Expected SHA-256", "預期 SHA-256")} .value=${this.sha256} @input=${(e: Event) => { this.sha256 = (e.target as HTMLInputElement).value; this.preview = undefined; }}></md-outlined-text-field>
    <div class="row"><md-outlined-button ?disabled=${this.busy} @click=${() => this.act(async () => { this.destination = await this.call("file.choose", { access: "write", kind: "file" }); this.preview = undefined; })}>${this.l("Choose fresh destination", "選擇全新目的檔案")}</md-outlined-button><md-text-button ?disabled=${this.busy || !this.foreground} @click=${() => this.act(async () => { await this.tool({ action: "transfer.browser", version: this.version, accepted: true, visibility: "foreground" }); this.foreground = false; })}>${this.l("Open official download information in browser", "喺瀏覽器開啟官方下載資訊")}</md-text-button></div>
    <p>${this.destination?.name || this.l("No destination selected", "未選擇目的地")}</p>
    <md-filled-button ?disabled=${this.busy || this.running || !this.destination} @click=${() => this.act(async () => { this.preview = (await this.tool({ action: "transfer.preview", version: this.version, sha256: this.sha256.trim().toLowerCase(), destinationId: this.destination!.id })).preview; })}>${this.l("Review start download", "檢視開始下載")}</md-filled-button>
    <div class="row"><md-text-button ?disabled=${this.busy} @click=${() => this.act(() => this.refresh())}>${this.l("Read transfer history", "讀取傳輸歷史")}</md-text-button><md-text-button ?disabled=${this.busy || this.running} @click=${() => this.act(async () => { await this.tool({ action: "queue.recover" }); await this.refresh(); })}>${this.l("Mark interrupted queue records", "標示中斷佇列記錄")}</md-text-button><md-text-button @click=${() => { this.progressOpen = true; this.revision++; }}>${this.l("Show transfer progress", "顯示傳輸進度")}</md-text-button><md-outlined-button ?disabled=${this.busy || this.running} @click=${() => this.act(() => this.runQueue())}>${this.l("Run reviewed queue, including other queued tools", "執行已檢視佇列，包括其他已排入工具")}</md-outlined-button></div>
    ${this.rows()}
    <p>${this.l("These are in-window dialogs. Browser-extension capture is not connected in this build. Keeping the application above other windows requires the explicit choice above.", "呢啲係視窗內對話框。此版本未連接瀏覽器擴充擷取。要將應用程式保持喺其他視窗上方，必須明確選擇上面嘅選項。")}</p>
    <md-dialog ?open=${Boolean(this.preview)} @closed=${() => { this.preview = undefined; this.revision++; }}><div slot="headline">${this.l("Start download", "開始下載")}</div><div slot="content" class="content">${this.preview ? html`<p>${this.preview.source}</p><p>${this.preview.name}</p><code>${this.preview.sha256}</code><p>${this.preview.maxBytes} ${this.l("maximum bytes", "位元組上限")}</p><p>${this.l("Confirm queues this exact transfer and runs the existing tool queue. Other already-queued tools may also run.", "確認會排入此傳輸並執行現有工具佇列，其他已排入嘅工具亦可能執行。")}</p>` : nothing}</div><div slot="actions"><md-text-button @click=${() => { this.preview = undefined; this.revision++; }}>${this.l("Cancel", "取消")}</md-text-button><md-filled-button ?disabled=${this.busy} @click=${() => this.act(() => this.start())}>${this.l("Confirm and start", "確認並開始")}</md-filled-button></div></md-dialog>
    <md-dialog ?open=${this.progressOpen} @closed=${() => { this.progressOpen = false; this.revision++; }}><div slot="headline">${this.l("Downloading", "下載中")}</div><div slot="content" class="content">${this.rows()}</div><div slot="actions"><md-text-button @click=${() => { this.progressOpen = false; this.revision++; }}>${this.l("Hide progress, keep transfer running", "隱藏進度並繼續傳輸")}</md-text-button></div></md-dialog>
    ${this.completion ? html`<section role="status" aria-live="polite"><h3>${this.l("Download complete", "下載完成")}</h3><p>${this.completion.result?.transfer?.destination} · ${this.completion.result?.transfer?.bytes} B</p><code>${this.completion.result?.transfer?.sha256}</code><md-text-button @click=${() => { this.completion = undefined; this.revision++; }}>${this.l("Dismiss completion", "關閉完成通知")}</md-text-button></section>` : nothing}
  </section>`; }
}
customElements.define("editor-transfer-panel", EditorTransferPanel);
