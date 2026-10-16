import {localizedCopy} from './language-wording';
import { LitElement, html, css, nothing } from "lit";
import "@material/web/button/outlined-button.js";
import "@material/web/button/filled-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/progress/linear-progress.js";
import { workspaceStyles } from "./workspace-styles";
import { actionIcon } from "./material-icons";

/** Project files are selected by the host. Saved metadata never grants access. */
export class ProjectWorkflowPanel extends LitElement {
  static properties = { language: { type: String }, workspaceId: { type: String }, revision: { state: true } };
  language = "bilingual";
  workspaceId = "";
  revision = 0;
  private mode = "open";
  private pending = false;
  private code = "";
  private projects: any[] = [];
  private selection: any;
  private portable: any;
  private trust = false;
  private url = "https://gitlab.com/buildroot.org/buildroot.git";
  private directory = "buildroot";
  private ref = "2025.02.18";
  private status: any;
  private statusWorkspace = "";
  static styles = [workspaceStyles, css`
    :host{display:block} .stack{display:grid;gap:16px} .row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
    .record{border-bottom:1px solid var(--md-sys-color-outline-variant);padding:12px 0}
    h2,h3,p{margin:0} md-outlined-text-field{width:100%;min-width:0} dd,code{overflow-wrap:anywhere} dd{margin-inline-start:16px}
  `];
  private l(en:string,zh:string,authored=false) {return localizedCopy(en,zh,this.language,authored);}
  private changed() { this.revision++; }
  private async request(action: string, fields: Record<string, unknown> = {}) {
    if (!window.studio?.operations) throw Error("DESKTOP_REQUIRED");
    const outer = await window.studio.operations({ action, ...fields });
    if (!outer.ok) throw Error(outer.code);
    if (action === "source") {
      if (!outer.result?.ok) throw Error(outer.result?.code || "SOURCE_UNAVAILABLE");
      if (outer.result.cancelled) throw Error("CANCELLED");
    }
    return outer.result;
  }
  private async run(work: () => Promise<void>) {
    if (this.pending) return;
    this.pending = true; this.code = ""; this.changed();
    try { await work(); }
    catch (error) { this.code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "OPERATION_UNAVAILABLE"; }
    finally { this.pending = false; this.changed(); }
  }
  private async refresh() { this.projects = await this.request("project.list"); }
  private async adopt(result: any) {
    this.selection = undefined; this.trust = false; this.status = undefined;
    const options = await this.request("project.options", { workspaceId: result.workspaceId });
    this.dispatchEvent(new CustomEvent("project-opened", { bubbles: true, composed: true, detail: { ...result, runtime: options.runtime } }));
  }
  private button(en: string, zh: string, action: () => Promise<void>, disabled = false) {
    return html`<md-outlined-button ?disabled=${this.pending || disabled} @click=${() => this.run(action)}>${actionIcon(en)}${this.l(en, zh)}</md-outlined-button>`;
  }
  private field(en: string, zh: string, value: string, set: (value: string) => void) {
    return html`<md-outlined-text-field .label=${this.l(en, zh)} .value=${value} ?disabled=${this.pending} @input=${(e: Event) => { set((e.target as HTMLInputElement).value); this.trust = false; this.changed(); }}></md-outlined-text-field>`;
  }
  render() {
    const cloning = this.mode === "create" || this.mode === "clone";
    const current = this.projects.find(item => item.id === this.workspaceId);
    return html`<section class="panel stack" aria-busy=${this.pending}>
      <h2>${this.l("Project workflows","專案流程",true)}</h2>
      <div class="row" role="group" aria-label=${this.l("Project action","專案操作",true)}>
        ${[["open","Open","開啟"],["create","Create","建立"],["adopt","Adopt","接入"],["import","Import descriptor","匯入描述檔"],["extracted","Import extracted source","匯入已解壓來源"],["clone","Clone","複製"]].map(([mode,en,zh])=>html`<md-outlined-button ?disabled=${this.pending} aria-pressed=${this.mode===mode} @click=${()=>{this.mode=mode;this.selection=undefined;this.portable=undefined;this.trust=false;this.code="";if(mode==="create"){this.url="https://gitlab.com/buildroot.org/buildroot.git";this.ref="2025.02.18";}this.changed();if(mode==="open")void this.run(()=>this.refresh());}}>${actionIcon(en)}${this.l(en,zh)}</md-outlined-button>`)}
      </div>
      ${this.pending?html`<md-linear-progress indeterminate aria-label=${this.l("Project operation in progress","專案操作進行中",true)}></md-linear-progress>`:nothing}
      ${this.code?html`<p role="status">${this.l("Operation not completed","操作未完成",true)}: ${this.code}. ${this.l("Existing files are retained. Renew folder access before retrying if authorization expired.","現有檔案會保留；如授權過期，重試前請重新選擇資料夾。",true)}</p>`:nothing}
      ${this.mode==="open"?html`
        <p>${this.l("Open an authorized project in this session. After restart, select its folders again to renew access; stored paths alone cannot authorize execution.","開啟本次工作階段已授權嘅專案。重新啟動後要再選資料夾以更新存取權；已儲存路徑本身唔會授權執行。",true)}</p>
        ${this.button("Refresh projects","重新整理專案",()=>this.refresh())}
        ${this.projects.map(item=>html`<div class="record stack"><strong>${item.name}</strong><code>${item.source}</code><p>${item.authorized?this.l("Authorized this session","本次工作階段已授權",true):this.l("Folder access renewal required","需要重新授權資料夾",true)}</p>
          ${this.button("Open project","開啟專案",async()=>this.adopt(await this.request("project.open",{workspaceId:item.id})),!item.authorized)}
          ${!item.authorized?this.button("Renew folder access","更新資料夾存取權",async()=>{this.mode="adopt";this.selection=await this.request("project.choose");this.trust=false;}):nothing}</div>`)}
      `:this.mode==="import"?html`
        <p>${this.l("Import a version 1 project descriptor exported below. Runtime choices, ordered external-tree metadata and the recorded source snapshot are retained. Credentials and execution authority are never imported. Select fresh local folders; an existing registered project cannot be replaced.","匯入以下功能匯出嘅版本 1 專案描述檔，保留執行環境選擇、有序外部樹記錄同來源快照。唔會匯入憑證或執行授權。請重新選擇本機資料夾，唔可以取代已登記專案。",true)}</p>
        ${this.button("Choose project descriptor","選擇專案描述檔",async()=>{this.portable=await this.request("project.portable.choose");this.selection=undefined;this.trust=false;})}
        ${this.portable?html`<h3>${this.portable.name}</h3><dl><dt>${this.l("Recorded source revision","記錄中來源修訂",true)}</dt><dd>${this.portable.source.revision||this.l("Unavailable","未能取得",true)}</dd><dt>${this.l("Recorded at","記錄時間",true)}</dt><dd>${this.portable.source.observedAt}</dd><dt>${this.l("Imported runtime","匯入執行環境",true)}</dt><dd>${this.portable.options.runtime?.kind||this.l("Not selected","未選擇",true)}</dd><dt>${this.l("External trees requiring fresh authorization","需要重新授權嘅外部樹",true)}</dt><dd>${this.portable.options.externalTrees.map((tree:any)=>tree.name).join(", ")||this.l("None","無",true)}</dd></dl>
          <p>${this.l("This imported snapshot is historical metadata, not verification of the selected source files. Refresh actual provenance after import. External-tree access must be renewed separately.","匯入快照只係歷史記錄，唔係所選來源檔案嘅驗證。匯入後請重新整理實際來源記錄，外部樹存取權要另外更新。",true)}</p>
          ${this.portable.options.runtime?.kind!=="wsl"?this.button("Choose new local project folders","選擇新本機專案資料夾",async()=>{this.selection=await this.request("project.choose");this.trust=false;}):html`<p>${this.l("The next action opens native folder selectors in the recorded WSL distribution","下一步會喺記錄中 WSL 發行版開啟原生資料夾選擇器",true)}: ${this.portable.options.runtime.distribution}</p>`}
          ${this.selection?html`<code>${this.selection.source}</code><code>${this.selection.output}</code>`:nothing}
          <label class="row"><md-checkbox ?disabled=${this.pending} .checked=${this.trust} @change=${(e:Event)=>{this.trust=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox>${this.l("I trust this descriptor and the source selected through the native pickers.","我信任呢個描述檔同原生選擇器所選來源。",true)}</label>
          ${this.button("Import as new local project","匯入為新本機專案",async()=>{const wsl=this.portable.options.runtime?.kind==="wsl";const result=await this.request(wsl?"project.portable.wslImport":"project.portable.import",{importId:this.portable.importId,trust:true,...(wsl?{}:{selectionId:this.selection.selectionId})});await this.adopt(result);this.portable=undefined;this.mode="open";await this.refresh();},!this.trust || (this.portable.options.runtime?.kind!=="wsl"&&!this.selection))}
        `:nothing}
      `:cloning?html`
        <p>${this.l("Create a project by cloning trusted Buildroot source into a new child folder. A separate output directory is created. Existing destinations are never replaced.","將可信 Buildroot 來源複製到新子資料夾以建立專案，並建立獨立輸出目錄。唔會取代現有目的地。",true)}</p>
        <p>${this.l("Maintained LTS recommendation: 2025.02.18, verified 2026-10-16 against buildroot.org/download.html; series support ends March 2028. This dated recommendation is not a live latest-version claim.","維護中 LTS 建議：2025.02.18，於 2026-10-16 對照 buildroot.org/download.html 核實；系列支援至 2028 年 3 月。呢個係有日期嘅建議，唔代表即時最新版本。",true)}</p>
        ${this.field("HTTPS source repository","HTTPS 來源儲存庫",this.url,v=>this.url=v)}
        ${this.field("Initial branch or tag","初始分支或標籤",this.ref,v=>this.ref=v)}
        ${this.field("New source folder name","新來源資料夾名稱",this.directory,v=>this.directory=v)}
        ${this.button("Choose destination parent","選擇目的地上層資料夾",async()=>{this.selection=await this.request("source",{request:{action:"source.choose"}});this.trust=false;})}
      `:html`
        <p>${this.mode==="extracted"?this.l("Import an already extracted Buildroot tree with its existing output directory. Archive extraction is not performed. No source or output file is copied, deleted or overwritten.","匯入已解壓 Buildroot 來源樹同現有輸出目錄。此處唔會解壓封存檔，亦唔會複製、刪除或覆寫來源同輸出檔案。",true):this.l("Adopt a trusted existing Buildroot tree and separate output directory inside a chosen workspace. Existing contents remain in place.","接入所選工作區入面可信嘅現有 Buildroot 來源樹同獨立輸出目錄，現有內容會原位保留。",true)}</p>
        ${this.button("Choose existing project folders","選擇現有專案資料夾",async()=>{this.selection=await this.request("project.choose");this.trust=false;})}
      `}
      ${this.selection&&this.mode!=="import"?html`<div class="stack"><strong>${this.selection.name}</strong>${this.selection.source?html`<code>${this.selection.source}</code><code>${this.selection.output}</code>`:nothing}
        <label class="row"><md-checkbox ?disabled=${this.pending} .checked=${this.trust} @change=${(e:Event)=>{this.trust=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox>${this.l("I trust the selected source. Building can execute its code with the chosen runtime permissions.","我信任所選來源；建置可以使用所選執行環境權限執行其程式碼。",true)}</label>
        ${this.button(cloning?"Clone and create project":"Adopt selected project",cloning?"複製並建立專案":"接入所選專案",async()=>{
          const result=cloning?await this.request("source",{request:{action:"source.clone",selectionId:this.selection.selectionId,directory:this.directory,url:this.url,ref:this.ref,trust:true}}):await this.request("project.adopt",{selectionId:this.selection.selectionId,trust:true});
          await this.adopt({...result,name:result.name||this.directory});await this.refresh();
        },!this.trust || (cloning && (!this.url.trim() || !this.ref.trim() || !this.directory.trim())))}
      </div>`:nothing}
      ${this.workspaceId?html`<h3>${this.l("Actual project provenance","實際專案來源記錄",true)}</h3>
        <p>${this.l("Portable export contains runtime choices, external-tree paths and recorded provenance. Keep this local file private when its paths or source details are sensitive. It excludes credentials, source files, outputs and execution grants.","可攜匯出包含執行環境選擇、外部樹路徑同來源記錄。如路徑或來源資料敏感，請保密保存本機檔案。匯出唔包含憑證、來源檔案、輸出或執行授權。",true)}</p>
        ${this.button("Export project descriptor","匯出專案描述檔",async()=>{const result=await this.request("project.portable.export",{workspaceId:this.workspaceId});const url=URL.createObjectURL(new Blob([result.document],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="buildroot-project.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);})}
        ${this.button("Refresh project provenance","重新整理專案來源記錄",async()=>{const id=this.workspaceId;this.status=undefined;await this.refresh();const status=await this.request("source",{request:{action:"source.status",workspaceId:id}});if(this.workspaceId===id){this.status=status;this.statusWorkspace=id;}})}
        ${current?html`<dl><dt>${this.l("Source path","來源路徑",true)}</dt><dd>${current.source}</dd><dt>${this.l("Output path","輸出路徑",true)}</dt><dd>${current.output}</dd></dl>`:nothing}
        ${this.status&&this.statusWorkspace===this.workspaceId?html`<dl><dt>${this.l("Resolved revision","實際修訂版本",true)}</dt><dd><code>${this.status.revision}</code></dd><dt>${this.l("Branch","分支",true)}</dt><dd>${this.status.branch||this.l("Detached revision","獨立修訂版本",true)}</dd><dt>${this.l("Working tree status","工作樹狀態",true)}</dt><dd>${this.status.dirty?this.l("Local modifications present","有本機修改",true):this.l("Clean","乾淨",true)}</dd></dl>`:html`<p>${this.l("Revision provenance has not been refreshed for this project. A requested tag is not proof of the checked-out revision.","尚未重新整理呢個專案嘅修訂來源記錄。要求嘅標籤唔代表實際已取出嘅修訂版本。",true)}</p>`}
      `:nothing}
    </section>`;
  }
}
customElements.define("project-workflow-panel", ProjectWorkflowPanel);

