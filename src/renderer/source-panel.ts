import {materialIcon, actionIcon, actionSymbol} from "./material-icons";
import { LitElement, html, css, nothing } from "lit";
import "@material/web/button/outlined-button.js";
import "@material/web/button/filled-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/progress/linear-progress.js";
import { workspaceStyles } from "./workspace-styles";
import type { SourceOperation, SourceOperationSuccess } from "../main/source-operations.cjs";

type Snapshot = Required<Pick<SourceOperationSuccess, "revision" | "branch" | "dirty" | "changes">>;
type Preview = Required<Pick<SourceOperationSuccess, "previewId" | "kind" | "fromRevision" | "toRevision" | "diff" | "dirty">>;

/** Source changes require a host-generated preview bound to the active workspace. */
export class SourcePanel extends LitElement {
  static properties = {
    language: { type: String },
    workspaceId: { type: String, noAccessor: true },
    revision: { state: true },
  };
  language = "bilingual";
  revision = 0;
  private activeWorkspace = "";
  private generation = 0;
  private pending = false;
  private feedback = "";
  private status?: Snapshot;
  private preview?: Preview;
  private selection?: { selectionId: string; name: string };
  private url = "https://gitlab.com/buildroot.org/buildroot.git";
  private directory = "buildroot";
  private cloneRef = "HEAD";
  private trust = false;
  private ref = "HEAD";
  private targetRevision = "";
  private consent = false;
  private adopted?: { workspaceId: string; name: string };
  private rollback?: { id: string; revision: string };

  get workspaceId() { return this.activeWorkspace; }
  set workspaceId(value: string) {
    const previous = this.activeWorkspace;
    if (value === previous) return;
    this.activeWorkspace = value;
    this.generation++;
    this.status = undefined;
    this.preview = undefined;
    this.rollback = undefined;
    this.targetRevision = "";
    this.consent = false;
    this.feedback = "";
    this.requestUpdate("workspaceId", previous);
  }

  static styles = [workspaceStyles, css`
    :host {
      display: block; height: auto; color: inherit; font-family: inherit;
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
    :host([hidden]) { display: none; }
    .stack { display: grid; gap: 16px; align-content: start; }
    .columns { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; }
    .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    h2,h3,p { margin: 0; }
    md-outlined-text-field { width: 100%; min-width: 0; }
    .note { color: var(--md-sys-color-on-surface-variant); }
    .hash { font-family: monospace; overflow-wrap: anywhere; }
    .diff { white-space: pre-wrap; overflow-wrap: anywhere; overflow: auto; max-height: 360px;
      padding: 16px; margin: 0; border-radius: 12px; background: var(--md-sys-color-surface-container-high); }
    .consent span { flex: 1; min-width: 160px; }
    @media(max-width:1000px) { .columns { grid-template-columns: 1fr; } }
  `];

  private l(en: string, zh: string) {
    return this.language === "en" ? en : this.language === "zh-HK" ? zh : `${en} · ${zh}`;
  }
  private changed() { this.revision++; }
  private async request(request: SourceOperation): Promise<SourceOperationSuccess> {
    if (!window.studio?.operations) throw new Error("DESKTOP_REQUIRED");
    const outer = await window.studio.operations({ action: "source", request });
    if (!outer.ok) throw new Error(outer.code);
    const result = outer.result as SourceOperationSuccess | { ok: false; code: string };
    if (!result || !result.ok) throw new Error(result?.code || "SOURCE_UNAVAILABLE");
    if (result.cancelled) throw new Error("CANCELLED");
    return result;
  }
  private async run(work: (current: () => boolean) => Promise<void>) {
    if (this.pending) return;
    const generation = this.generation;
    const current = () => generation === this.generation;
    this.pending = true;
    this.feedback = "";
    this.changed();
    try { await work(current); }
    catch (error) {
      if (current()) {
        const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "OUTCOME_UNAVAILABLE";
        this.feedback = `${this.l("Source operation not completed", "來源操作未完成")}: ${code}. ${this.l("Refresh source status before retrying. A failed registration can leave a cloned tree; adopt that tree through Projects & runtime.", "重試前請重新整理來源狀態。註冊失敗可能保留已複製來源樹，請透過專案同執行環境接入。")}`;
        this.preview = undefined;
        this.consent = false;
      }
    } finally {
      const adopted = current() ? this.adopted : undefined;
      this.adopted = undefined;
      this.pending = false;
      if (!current()) this.feedback = this.l("The active project changed. The previous operation may have completed; refresh its source status when you return to that project.", "目前專案已更改。先前操作可能已完成，返回該專案時請重新整理來源狀態。");
      this.changed();
      if (adopted) this.dispatchEvent(new CustomEvent("source-adopted",{bubbles:true,composed:true,detail:adopted}));
    }
  }
  private button(en: string, zh: string, work: (current: () => boolean) => Promise<void>, disabled = false) {
    if (/^(Refresh|Remove|Move|Stop|Cancel)\b/.test(en)) return html`<md-icon-button aria-label=${this.l(en,zh)} title=${this.l(en,zh)} ?disabled=${this.pending||disabled} @click=${()=>this.run(work)}>${materialIcon(actionSymbol(en))}</md-icon-button>`;
    return html`<md-outlined-button ?disabled=${this.pending || disabled} @click=${() => this.run(work)}>${actionIcon(en)}${this.l(en,zh)}</md-outlined-button>`;
  }
  private field(label: string, value: string, set: (value:string)=>void, type="text") {
    return html`<md-outlined-text-field .label=${label} .value=${value} .type=${type} ?disabled=${this.pending} @input=${(event:Event)=>{set((event.target as HTMLInputElement).value);this.changed();}}></md-outlined-text-field>`;
  }
  private invalidatePreview() { this.preview = undefined; this.consent = false; }
  private async refresh(current: () => boolean) {
    const result = await this.request({action:"source.status",workspaceId:this.workspaceId});
    if (!current()) return;
    this.status = result as Snapshot;
    this.invalidatePreview();
    this.feedback = this.l("Source status refreshed.","已重新整理來源狀態。");
  }
  private async clone(current: () => boolean) {
    if (!this.selection || !this.trust) return;
    const result = await this.request({action:"source.clone",selectionId:this.selection.selectionId,directory:this.directory,url:this.url,ref:this.cloneRef,trust:true});
    if (!current()) return;
    if (!result.workspaceId) throw new Error("WORKSPACE_REGISTRATION_FAILED");
    this.selection = undefined;
    this.trust = false;
    this.adopted = {workspaceId:result.workspaceId,name:this.directory};
    this.feedback = this.l("Source cloned and adopted. Choose a runtime in Projects & runtime before building.","來源已複製並接入。建置前請喺專案同執行環境選擇執行環境。");
  }
  private async acquire(current: () => boolean) {
    this.invalidatePreview();
    const result = await this.request({action:"source.ref",workspaceId:this.workspaceId,ref:this.ref});
    if (!current()) return;
    this.status = result as Snapshot;
    this.targetRevision = result.fetchedRevision || "";
    this.feedback = this.l("Reference acquired. Review the exact revision before applying it.","已取得參照，套用前請審核確切修訂版本。");
  }
  private async review(current: () => boolean, rollback = false) {
    this.invalidatePreview();
    const result = await this.request(rollback
      ? {action:"source.rollback.preview",workspaceId:this.workspaceId,rollbackId:this.rollback!.id}
      : {action:"source.upgrade.preview",workspaceId:this.workspaceId,revision:this.targetRevision});
    if (current()) this.preview = result as Preview;
  }
  private async apply(current: () => boolean) {
    const preview = this.preview;
    if (!preview || !this.consent || preview.dirty) return;
    const result = await this.request({action:preview.kind === "rollback" ? "source.rollback.apply" : "source.upgrade.apply",workspaceId:this.workspaceId,previewId:preview.previewId,expectedRevision:preview.fromRevision,consent:true});
    if (!current()) return;
    this.status = result as Snapshot;
    this.rollback = result.rollbackId && result.rollbackRevision ? {id:result.rollbackId,revision:result.rollbackRevision} : undefined;
    this.invalidatePreview();
    this.targetRevision = "";
    this.feedback = this.l("Source revision applied. Output files were preserved; their compatibility is unknown. Inspect configuration before the next build.","來源修訂版本已套用，輸出檔案已保留，但相容性仍未確認。下次建置前請檢視設定。");
    this.dispatchEvent(new CustomEvent("source-applied",{bubbles:true,composed:true,detail:{workspaceId:this.workspaceId}}));
  }

  render() {
    return html`<div class="stack" aria-busy=${this.pending}>
      ${this.pending ? html`<md-linear-progress indeterminate aria-label=${this.l("Source operation in progress","來源操作進行中")}></md-linear-progress>` : nothing}
      <div role="status" aria-live="polite">${this.feedback}</div>
      <div class="columns">
        <section class="panel stack"><h2>${this.l("Clone Buildroot source","複製 Buildroot 來源")}</h2>
          <p class="note">${this.l("Choose a parent folder and a new child folder name. The source is cloned from HTTPS; a separate output folder is created beside it. Existing directories are preserved.","選擇上層資料夾同新子資料夾名稱。來源會從 HTTPS 複製，並喺旁邊建立獨立輸出資料夾，保留現有目錄。")}</p>
          ${this.button("Choose parent folder","選擇上層資料夾",async current=>{const result=await this.request({action:"source.choose"});if(current()){this.selection={selectionId:result.selectionId!,name:result.name!};this.trust=false;}})}
          ${this.selection ? html`<p>${this.l("Selected folder","已選資料夾")}: ${this.selection.name}</p>` : nothing}
          ${this.field(this.l("HTTPS repository URL","HTTPS 儲存庫網址"),this.url,v=>{this.url=v;this.trust=false;},"url")}
          ${this.field(this.l("New source folder name","新來源資料夾名稱"),this.directory,v=>{this.directory=v;this.trust=false;})}
          ${this.field(this.l("Initial branch or tag","初始分支或標籤"),this.cloneRef,v=>{this.cloneRef=v;this.trust=false;})}
          <label class="row consent"><md-checkbox aria-label=${this.l("I trust this source. Its build scripts may execute with my selected runtime permissions.","我信任呢個來源，其建置指令碼可能會以所選執行環境權限執行。")} ?checked=${this.trust} ?disabled=${this.pending} @change=${(e:Event)=>{this.trust=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox><span>${this.l("I trust this source. Its build scripts may execute with my selected runtime permissions.","我信任呢個來源，其建置指令碼可能會以所選執行環境權限執行。")}</span></label>
          ${this.button("Clone and adopt source","複製並接入來源",current=>this.clone(current),!this.selection||!this.trust||!this.url.trim()||!this.directory.trim()||!this.cloneRef.trim())}
        </section>
        <section class="panel stack"><h2>${this.l("Active source revision","目前來源修訂版本")}</h2>
          ${!this.workspaceId ? html`<p>${this.l("Adopt an existing project in Projects & runtime, or clone a source here to inspect revisions.","請喺專案同執行環境接入現有專案，或喺呢度複製來源以檢視修訂版本。")}</p>` : html`
            ${this.button("Refresh source status","重新整理來源狀態",current=>this.refresh(current))}
            ${this.status ? html`<dl><dt>${this.l("Revision","修訂版本")}</dt><dd class="hash">${this.status.revision}</dd><dt>${this.l("Branch","分支")}</dt><dd>${this.status.branch || this.l("Detached revision","獨立修訂版本")}</dd><dt>${this.l("Working tree","工作樹")}</dt><dd>${this.status.dirty?this.l("Local changes present","有本機變更"):this.l("Clean","乾淨")}</dd></dl>${this.status.changes?html`<pre class="diff" tabindex="0" role="region" aria-label=${this.l("Working tree changes","工作樹變更")}>${this.status.changes}</pre>`:nothing}` : html`<p>${this.l("Refresh to inspect the current source before changing revisions.","更改修訂版本前，請先重新整理以檢視目前來源。")}</p>`}
            <h3>${this.l("Acquire and review a revision","取得並審核修訂版本")}</h3>
            <p class="note">${this.l("Fetching a branch or tag does not change the working tree. Preview and apply are separate steps. Local changes block applying a revision.","取得分支或標籤唔會改變工作樹。預覽同套用係獨立步驟，有本機變更時唔可以套用修訂版本。")}</p>
            ${this.field(this.l("Branch or tag to fetch","要取得嘅分支或標籤"),this.ref,v=>{this.ref=v;this.targetRevision="";this.invalidatePreview();})}
            ${this.button("Fetch reference","取得參照",current=>this.acquire(current),!this.ref.trim())}
            ${this.field(this.l("Exact target revision","確切目標修訂版本"),this.targetRevision,v=>{this.targetRevision=v;this.invalidatePreview();})}
            ${this.button("Review source changes","審核來源變更",current=>this.review(current),!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(this.targetRevision))}
            ${this.rollback ? html`<h3>${this.l("Rollback available","可復原修訂版本")}</h3><p class="hash">${this.rollback.revision}</p>${this.button("Review rollback","審核復原",current=>this.review(current,true))}` : nothing}
          `}
        </section>
      </div>
      ${this.preview ? html`<section class="panel stack"><h2>${this.preview.kind==="rollback"?this.l("Review rollback","審核復原"):this.l("Review source update","審核來源更新")}</h2>
        <dl><dt>${this.l("Current revision","目前修訂版本")}</dt><dd class="hash">${this.preview.fromRevision}</dd><dt>${this.l("Proposed revision","建議修訂版本")}</dt><dd class="hash">${this.preview.toRevision}</dd></dl>
        <p>${this.l("Unsaved configuration edits will be cleared. Output files will be preserved. Compatibility with this revision has not been verified. The preview reports changed files and counts; inspect the source before accepting unfamiliar changes.","未儲存嘅設定編輯會被清除。會保留輸出檔案，但尚未驗證同呢個修訂版本嘅相容性。預覽列出變更檔案同數量，接受唔熟悉嘅變更前請先檢視來源。")}</p>
        <pre class="diff" tabindex="0" role="region" aria-label=${this.l("Source change summary","來源變更摘要")}>${this.preview.diff||this.l("No file differences reported.","未報告檔案差異。")}</pre>
        ${this.preview.dirty?html`<p role="alert">${this.l("Local changes block this operation. Preserve them outside this workflow and refresh source status before reviewing again.","本機變更阻止呢個操作。請喺此流程以外保存變更，再重新整理來源狀態同審核。")}</p>`:nothing}
        <label class="row consent"><md-checkbox aria-label=${this.l("I reviewed these revisions and accept changing the source working tree.","我已審核以上修訂版本，並接受更改來源工作樹。")} ?checked=${this.consent} ?disabled=${this.pending||this.preview.dirty} @change=${(e:Event)=>{this.consent=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox><span>${this.l("I reviewed these revisions and accept changing the source working tree.","我已審核以上修訂版本，並接受更改來源工作樹。")}</span></label>
        <div class="row">${this.button(this.preview.kind==="rollback"?"Apply reviewed rollback":"Apply reviewed source update",this.preview.kind==="rollback"?"套用已審核復原":"套用已審核來源更新",current=>this.apply(current),!this.consent||this.preview.dirty)}${this.button("Discard preview","放棄預覽",async()=>this.invalidatePreview())}</div>
      </section>` : nothing}
    </div>`;
  }
}
customElements.define("source-panel",SourcePanel);
