import {localizedCopy} from './language-wording';
import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
import "./package-discovery-panel";
import {materialIcon, actionIcon, actionSymbol} from "./material-icons";
import { LitElement, html, css, nothing } from "lit";
import "@material/web/button/outlined-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/chips/chip-set.js";
import "@material/web/chips/input-chip.js";
import "@material/web/progress/linear-progress.js";
import "./diagram-workbench";
import {DraftHistory} from "./guided-forms";
import "./external-tree-panel";
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/secondary-tab.js";
import { workspaceStyles } from "./workspace-styles";

type BuildSystem = "generic" | "autotools" | "cmake" | "meson" | "cargo" | "go" | "python";
type Hash = { algorithm: "sha256" | "sha512"; digest: string; file: string };
type PackageModel = {
  name: string; version: string; source: string; sourceFilename: string;
  homepage: string; license: string; licenseFiles: string[];
  buildSystem: BuildSystem; dependencies: string[]; configDependencies: string[];
  help: string; hashes: Hash[];
  patches?: string[]; buildOptions?: string[];
  hooks?: {stage:string;operation:string;source:string;destination:string;mode:string}[];
  overlays?: {source:string;destination:string;mode:string}[];
  pythonSetupType?: "setuptools" | "pep517" | "flit" | "hatch" | "poetry" | "setuptools-rust" | "maturin";
};
type Preview = { revision: string; previewHash: string; files: {path:string;before:string|null;after:string;mode:number}[]; warnings: string[] };
const emptyModel = (): PackageModel => ({name:"",version:"",source:"",sourceFilename:"",homepage:"",license:"",licenseFiles:["COPYING"],buildSystem:"autotools",dependencies:[],configDependencies:[],help:"",hashes:[]});
const namePattern = /^[a-z][a-z0-9-]{0,63}$/;
const filenamePattern = /^[A-Za-z0-9][A-Za-z0-9_.+-]*$/;

/** Structured package recipes are generated and revision-checked by the desktop host. */
export class PackagePanel extends LitElement {
  static properties = { language:{type:String}, workspaceId:{type:String,noAccessor:true}, revision:{state:true},editorTab:{state:true} };
  language = "bilingual";
  revision = 0;
  editorTab = "identity";
  private activeWorkspace = "";
  private generation = 0;
  private pending = false;
  private feedback = "";
  private validation: string[] = [];
  private model: PackageModel = emptyModel();
  private draftHistory = new DraftHistory(this.model);
  private replaceExample = false;
  private draftStorageRevision:number|undefined;
  private draftRecords:{revision:number;timestamp:string|null}[]=[];
  private selectedDraftRevision="";
  private restoreDraftApproved=false;
  private external?: {externalTreeId:string;name:string};
  private preview?: Preview;
  private reviewedModel?: PackageModel;
  private consent = false;
  private uncertain = false;
  private dependency = "";
  private configDependency = "";
  private selectedFile = 0;

  get workspaceId() { return this.activeWorkspace; }
  set workspaceId(value:string) {
    const previous=this.activeWorkspace;
    if(previous===value)return;
    this.activeWorkspace=value;this.generation++;
    this.external=undefined;this.preview=undefined;this.reviewedModel=undefined;this.consent=false;
    this.draftStorageRevision=undefined;this.draftRecords=[];this.selectedDraftRevision="";this.restoreDraftApproved=false;
    this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");this.validation=[];this.uncertain=false;
    this.requestUpdate("workspaceId",previous);
  }
  static styles = [workspaceStyles,css`
    :host { display:block;height:auto;font-family:inherit;color:inherit;
      --md-sys-color-primary:inherit;--md-sys-color-on-primary:inherit;
      --md-sys-color-primary-container:inherit;--md-sys-color-on-primary-container:inherit;
      --md-sys-color-surface:inherit;--md-sys-color-surface-container:inherit;
      --md-sys-color-surface-container-low:inherit;--md-sys-color-surface-container-high:inherit;
      --md-sys-color-on-surface:inherit;--md-sys-color-on-surface-variant:inherit;
      --md-sys-color-outline:inherit;--md-sys-color-outline-variant:inherit;
      --md-sys-color-secondary-container:inherit;--md-sys-color-on-secondary-container:inherit;
      --md-sys-color-error:inherit;
    }
    :host([hidden]){display:none}
    .stack{display:grid;gap:16px;align-content:start}
    .columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
    .row md-outlined-text-field{flex:1;min-width:180px}
    h2,h3,p{margin:0} .note{color:var(--md-sys-color-on-surface-variant)}
    md-outlined-text-field,md-outlined-select{width:100%;min-width:0}
    .hash-row{padding:16px;border:1px solid var(--md-sys-color-outline-variant);border-radius:12px}
    .hash{font-family:monospace;overflow-wrap:anywhere}
    pre{white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;max-height:400px;margin:0;padding:16px;border-radius:12px;background:var(--md-sys-color-surface-container-high)}
    .consent span{flex:1;min-width:160px}.validation{color:var(--md-sys-color-error)}
    md-chip-set{max-width:100%}
    .package-context{padding:16px 20px;gap:10px;border-radius:16px;background:var(--md-sys-color-surface-container-low)}
    .package-context>h2{display:none}.package-context>p{font-size:13px;line-height:18px;margin:0}
    .context-actions{display:flex;flex-wrap:wrap;gap:8px}.package-context details{font-size:13px;min-width:0}.package-context details[open]{flex-basis:100%}
    .package-context summary{width:fit-content;max-width:100%;padding:6px 12px;border:1px solid var(--md-sys-color-outline-variant);border-radius:8px;cursor:pointer;font-weight:500}
    .package-context details[open] summary{margin-bottom:12px;background:var(--md-sys-color-secondary-container)}
    .package-context details>p{margin:8px 0}
    .package-context .external-tree-row{align-items:stretch}
    .external-tree-name{flex:1;min-width:180px;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:8px 16px;border:1px solid var(--md-sys-color-outline);border-radius:4px;background:var(--md-sys-color-surface);overflow-wrap:anywhere}
    .external-tree-name small{font-size:12px;color:var(--md-sys-color-on-surface-variant)}
    .external-tree-row md-outlined-button{--md-outlined-button-container-height:56px;--md-outlined-button-container-shape:28px}
    .package-workbench{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,360px);gap:16px;min-height:380px;height:clamp(380px,52vh,560px)}
    .canvas-pane,.package-inspector{min-width:0;min-height:0;border:1px solid var(--md-sys-color-outline-variant);border-radius:16px;background:var(--md-sys-color-surface);overflow:hidden}
    .package-inspector{overflow:auto}
    .package-inspector>.columns{display:contents}.package-inspector .panel{padding:16px 20px;border-radius:0;background:transparent}
    .package-inspector .panel[hidden]{display:none}.package-inspector>.row{padding:12px 20px}
    .package-inspector md-tabs{position:sticky;top:0;z-index:2;background:var(--md-sys-color-surface);--md-secondary-tab-container-height:48px}
    .package-inspector md-secondary-tab{flex:0 0 auto;min-width:max-content}
    .package-inspector .columns{grid-template-columns:1fr}
    :host{container-type:inline-size;--md-outlined-field-top-space:16px;--md-outlined-field-bottom-space:16px;--md-outlined-field-content-size:16px}
    :host>.stack{gap:16px}.stack>[role=status]:empty{display:none}
    @container(max-width:700px){.package-workbench{display:flex;flex-direction:column;height:auto}.canvas-pane{height:380px;flex-shrink:0}.package-inspector{max-height:500px}.package-context{padding:16px}.external-tree-name{min-width:0;flex-basis:100%}}
    @media(max-width:1000px){.columns{grid-template-columns:1fr}}
  `];
  private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
  private changed(){this.revision++;}
  private edit(){this.draftHistory.record(this.model);this.replaceExample=false;this.restoreDraftApproved=false;this.generation++;this.preview=undefined;this.reviewedModel=undefined;this.consent=false;this.validation=[];this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");this.changed();}
  private resetDraftStorage(){this.draftStorageRevision=undefined;this.draftRecords=[];this.selectedDraftRevision="";this.restoreDraftApproved=false;}
  private async draftStorage(action:"history"|"save"|"restore"){
    if(!this.workspaceId||!this.external||this.pending)return;
    if(action!=="history"&&this.draftStorageRevision===undefined)return;
    if(action==="restore"&&(!this.restoreDraftApproved||!this.selectedDraftRevision))return;
    let confirmed=false;
    await this.run(async current=>{
      const reply=await this.request<{revision:number;records?:{revision:number;timestamp:string|null}[];historyWarning?:boolean;draft?:{model:PackageModel;undo:PackageModel[];redo:PackageModel[]}}>("package.draft."+action,{
        workspaceId:this.workspaceId,externalTreeId:this.external!.externalTreeId,
        ...(action==="history"?{}:{expectedRevision:this.draftStorageRevision}),
        ...(action==="save"?{draft:this.draftHistory.snapshot()}:{}),
        ...(action==="restore"?{revision:Number(this.selectedDraftRevision)}:{})
      });
      if(!current())return;
      confirmed=true;
      this.draftStorageRevision=reply.revision;this.restoreDraftApproved=false;
      if(action==="history"){this.draftRecords=reply.records||[];this.selectedDraftRevision="";}
      if(action==="save"){this.draftRecords=[];this.selectedDraftRevision="";}
      if(action==="restore"&&reply.draft){
        const old=structuredClone(this.model);this.model=this.draftHistory.recover(reply.draft);
        if(JSON.stringify(old)!==JSON.stringify(this.model))this.draftHistory.preserveBeforeRestore(old);
        this.preview=undefined;this.reviewedModel=undefined;this.consent=false;this.validation=[];this.replaceExample=false;
        this.dependency="";this.configDependency="";this.editorTab="identity";
      }
      this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>action==="save"?l("Draft and bounded undo history saved locally. Package files are unchanged. Refresh history to restore a saved revision.","草稿同有限復原歷史已喺本機儲存，套件檔案保持不變。重新整理歷史可還原已儲存修訂版本。",true):action==="restore"?l("Saved draft restored in the editor only. The previous draft is available through Undo draft. Preview and approve again before writing files.","只喺編輯器還原已儲存草稿。可用復原草稿返回之前草稿，寫入檔案前須重新預覽同批准。",true):l("History loaded for the currently authorized project, source and external tree. Choose a revision and explicitly approve editor replacement.","已載入目前授權專案、來源同外部樹嘅歷史。請選擇修訂版本並明確批准取代編輯器草稿。",true));
      if(reply.historyWarning)this.feedback+=this.l(" Earlier history is unavailable; the latest saved draft remains available."," 較早歷史不可用，最新已儲存草稿仍然可用。",true);
    });
    if(!confirmed){this.resetDraftStorage();this.changed();}
  }
  private fieldGuide(label:string,hint:string){
    const matches=(en:string,zh:string)=>label.includes(this.l(en,zh,true));
    let example="hello", purpose=hint, valid=(v:string)=>!!v.trim();
    if(matches("Package name","套件名稱")||matches("Package dependency","套件相依項目")){example="hello";purpose=this.l("Use the Buildroot package identifier, not its display title. Names begin with a lowercase letter and allow digits and hyphens, up to 64 characters. Dependencies build before this package.","使用 Buildroot 套件識別碼，唔係顯示標題。以小寫字母開頭，可含數字同連字號，最多 64 字元。相依項目會先建置。",true);valid=v=>namePattern.test(v);}
    else if(matches("Version","版本")){example="2.12.1";purpose=hint;valid=v=>filenamePattern.test(v);}
    else if(matches("Source archive URL","來源封存網址")||matches("Homepage URL","首頁網址")||label.includes("Patch URL")||label.includes("修補網址")){example="https://example.org/hello-1.0.tar.gz";purpose=this.l("Use a source URL without credentials, query strings or fragments. The archive URL must end with the exact source filename. Patch URLs are consumed later by Buildroot in their displayed order.","使用無憑證、查詢字串或片段嘅來源網址。封存網址須以確切來源檔名結尾。Buildroot 之後會按顯示次序使用修補網址。",true);valid=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}};}
    else if(matches("Source filename","來源檔名")||label.includes("License file")||label.includes("授權條款檔案")||label.includes("Hash file")||label.includes("摘要檔案")){example="COPYING";purpose=this.l("Enter a file basename only. Archive and license filenames must match the corresponding verified hash rows; directory separators are not accepted.","只輸入基本檔名。封存同授權條款檔名須對應已驗證摘要列，唔接受目錄分隔符。",true);valid=v=>filenamePattern.test(v);}
    else if(matches("Configuration dependency","設定相依項目")){example="BR2_USE_MMU";purpose=hint;valid=v=>/^BR2_[A-Z0-9_]+$/.test(v);}
    else if(matches("License expression","授權條款表達式")){example="MIT";purpose=hint;valid=v=>/^[A-Za-z0-9][A-Za-z0-9_.+() -]*$/.test(v);}
    else if(label.includes("Verified digest")||label.includes("已驗證摘要")){example="0".repeat(64);purpose=this.l("This all-zero practice digest demonstrates length only and is not a real checksum. In the live field, verify the actual file and use 64 hexadecimal digits for SHA-256 or 128 for SHA-512.","全零練習摘要只示範長度，唔係真實校驗值。真實欄位須驗證實際檔案，SHA-256 使用 64 位、SHA-512 使用 128 位十六進位數字。",true);valid=v=>/^(?:[a-fA-F0-9]{64}|[a-fA-F0-9]{128})$/.test(v);}
    else if(matches("Octal permissions","八進位權限")){example="644";purpose=this.l("Set target-file mode using three octal digits. This does not change permissions on the host.","用三位八進位數字設定目標檔案模式，唔會更改主機權限。",true);valid=v=>/^[0-7]{3}$/.test(v);}
    else if(matches("Package help","套件說明")){example="Print a greeting.";purpose=hint;valid=v=>!!v.trim()&&v.length<=16384&&!/[\x00-\x08\x0b-\x1f\x7f]/.test(v);}
    else if(matches("One literal option per line","每行一個字面選項")){example="--enable-shared";purpose=hint;valid=v=>v.split(/\r?\n/).every(line=>/^[-A-Za-z0-9_./=+:]+$/.test(line));}
    else {example="assets/config.ini";purpose=this.l("Use a relative path inside the owning package or external tree, according to this field. Parent traversal, absolute paths and spaces are not allowed. Preview checks the actual source before writing.","根據此欄位，使用所屬套件或外部樹內嘅相對路徑。唔接受父目錄越界、絕對路徑同空格。預覽會先檢查實際來源。",true);valid=v=>!!v&&!/^[\\/]|^[A-Za-z]:|\s/.test(v)&&!v.split(/[\\/]/).includes('..');}
    return {title:label,purpose,steps:[this.l("Try the sample and correct any validation message. The sample never uses your live values.","試用範例並修正驗證訊息，範例唔會使用真實值。",true),this.l("Return to the field below, edit the draft and preview generated files. Applying still requires the existing host checks and approval.","返回下方欄位，編輯草稿並預覽產生檔案。套用仍須通過現有主機檢查同批准。",true)],example,expected:this.l("A valid practice value advances the guide. No package file is written.","有效練習值會推進說明，唔會寫入套件檔案。",true),validate:(value:string)=>valid(value)?"":this.l("This sample does not meet the field constraints above. Correct it and retry.","此範例唔符合上方欄位限制，請修正再試。",true)};
  }
  private field(label:string,value:string,set:(value:string)=>void,hint="",textarea=false){
    return html`<guided-forms .language=${this.language} .guide=${this.fieldGuide(label,hint)}></guided-forms><md-outlined-text-field .label=${label} .value=${value} .supportingText=${hint} .type=${textarea?"textarea":"text"} rows="4" ?disabled=${this.pending} @input=${(e:Event)=>{set((e.target as HTMLInputElement).value);this.edit();}}><md-icon-button slot="trailing-icon" aria-label=${this.l("Clear field:","清除欄位：",true)+" "+label} title=${this.l("Clear field:","清除欄位：",true)+" "+label} ?disabled=${this.pending||!value} @click=${(e:Event)=>{set("");this.edit();(e.currentTarget as HTMLElement).closest("md-outlined-text-field")?.focus();}}>${materialIcon("close")}</md-icon-button></md-outlined-text-field>`;
  }
  private select(label:string,value:string,options:string[],set:(value:string)=>void){
    return html`<guided-forms .language=${this.language} .guide=${{title:label,purpose:this.l("Choose the exact recipe option. It changes generated metadata but does not run a build.","選擇確切配方選項，會改變產生嘅中繼資料，但唔會執行建置。",true),steps:[this.l("Try an isolated choice, then use the real selector below.","試用獨立選項，再使用下方真實選單。",true)],example:options[0],options,expected:this.l("Only the practice selection changes.","只會改變練習選項。",true)}}></guided-forms><md-outlined-select .label=${label} .value=${value} .displayText=${value} ?disabled=${this.pending} @change=${(e:Event)=>{set((e.target as HTMLSelectElement).value);this.edit();}}>${options.map(option=>html`<md-select-option .value=${option}><div slot="headline">${option}</div></md-select-option>`)}</md-outlined-select>`;
  }
  private button(en:string,zh:string,work:()=>void,disabled=false){
    const title=this.l(en,zh,true),actual=/^(Refresh|Remove|Move|Stop|Cancel)\b/.test(en)?html`<md-icon-button aria-label=${title} title=${title} ?disabled=${this.pending||disabled} @click=${work}>${materialIcon(actionSymbol(en))}</md-icon-button>`:html`<md-outlined-button ?disabled=${this.pending||disabled} @click=${work}>${actionIcon(en)}${title}</md-outlined-button>`;
    const copy=en.startsWith('Undo')||en.startsWith('Redo')?this.l("Moves through recipe draft history, including field and dependency edits. It invalidates file previews and cannot reverse already applied files.","切換配方草稿歷史，包括欄位同相依項目編輯。會令檔案預覽失效，唔會還原已套用檔案。",true):en.startsWith('Save draft')?this.l("Saves incomplete recipe data and bounded undo/redo locally for the currently granted project and external tree. Refresh history first. No package file is written.","為目前授權專案同外部樹喺本機儲存未完成配方同有限復原／重做。請先重新整理歷史，唔會寫入套件檔案。",true):en.startsWith('Restore selected')?this.l("Requires a real saved revision and editor-replacement approval. Restores the editor only, retaining its previous draft in Undo. Fresh preview and approval are still required for files.","需要真實已儲存修訂版本同編輯器取代批准。只還原編輯器，之前草稿會保留喺復原。寫入檔案仍須新預覽同批准。",true):en.startsWith('Refresh saved')?this.l("Lists up to 25 locally saved revisions after validating current project and external-folder authority. No draft is applied automatically.","驗證目前專案同外部資料夾授權後，列出最多 25 個本機修訂版本。唔會自動套用草稿。",true):en.startsWith('Apply')?this.l("Writes only reviewed generated files through the host after explicit approval. Revision and content checks reject stale previews. Inspect the external tree after an uncertain outcome before retrying.","明確批准後，主機只會寫入已審核產生檔案。修訂版本同內容檢查會拒絕過時預覽。結果未確認時，重試前請檢查外部樹。",true):en.startsWith('Preview')?this.l("Validates the complete recipe and selected external tree, then shows before/after file content. This creates no package files and does not run a build.","驗證完整配方同所選外部樹，再顯示變更前後檔案內容。唔會建立套件檔案或執行建置。",true):en.startsWith('Use GNU')?this.l("Loads example metadata only after explicit choice, with extra approval for a populated draft. Hashes stay empty. Undo restores the prior draft.","明確選擇後先載入範例中繼資料，有內容草稿需要額外批准。摘要保持空白，復原可還原之前草稿。",true):en.startsWith('Choose')?this.l("Opens a native folder picker for a prepared external tree. Selection grants current-session access, not permission to apply files. Cancel preserves the draft.","開啟原生資料夾選擇器以選取已準備好外部樹。選擇會授予本次存取，唔代表批准套用檔案。取消會保留草稿。",true):en.startsWith('Remove')?this.l("Removes this row from the recipe draft only. Undo draft restores it; existing external-tree files remain unchanged until a reviewed apply.","只會從配方草稿移除此列，復原草稿可還原。審核套用之前，外部樹檔案保持不變。",true):en.startsWith('Move')?this.l("Reorders this row by one position. Recipe order is meaningful for patches and hooks; Undo draft restores the previous order.","將此列移動一個位置。修補同掛鈎嘅配方次序會影響結果，復原草稿可還原之前次序。",true):this.l("Adds the named recipe entry to the editable draft. Fill its required fields before preview. Empty rows are not treated as valid package data, and Undo draft removes the addition.","將指定配方項目加入可編輯草稿。預覽前請填寫必要欄位，空白列唔會當成有效套件資料，復原草稿可移除新增項目。",true);
    return html`<div style="display:inline-flex;flex-direction:column;max-width:100%"><guided-forms .language=${this.language} .guide=${{title,purpose:copy,steps:[copy],example:"preview",options:["preview","cancel"],expected:this.l("This synthetic choice does not run the named action. Use the actual control below when its requirements are met.","此模擬選擇唔會執行指定操作。符合條件後，請使用下方真實控制項。",true)}}></guided-forms>${actual}</div>`;
  }
  private async request<T>(action:string,fields:Record<string,unknown>):Promise<T>{
    if(!window.studio?.operations)throw new Error("DESKTOP_REQUIRED");
    const result=await window.studio.operations({action,...fields});
    if(!result.ok)throw new Error(result.code);
    return result.result as T;
  }
  private async run(work:(current:()=>boolean)=>Promise<void>,applying=false){
    if(this.pending)return;
    const generation=this.generation,current=()=>this.generation===generation;
    this.pending=true;this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");this.changed();
    try{await work(current);}
    catch(error){if(current()){
      const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:"OUTCOME_UNAVAILABLE";
      this.preview=undefined;this.reviewedModel=undefined;this.consent=false;
      this.uncertain=applying;
      this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>`${l("Package operation not completed","套件操作未完成")}: ${code}. ${applying?l("The write outcome is unconfirmed. Inspect the external tree and create a fresh preview before retrying.","未能確認寫入結果，請檢查外部樹，並重新建立預覽後再試。"):l("Check the form and selected external tree, then retry.","請檢查表單同所選外部樹，再重試。")}`);
    }}finally{this.pending=false;if(!current())this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Project or draft changed while the operation was pending. Its result was not attached to this draft. Inspect the previous external tree before retrying a write.","操作期間專案或草稿已更改，結果未附加到此草稿。重試寫入前請檢查先前外部樹。"));this.changed();}
  }
  private errors(l=this.l.bind(this)):string[]{
    const m=this.model,errors:string[]=[];
    const add=(condition:boolean,en:string,zh:string)=>{if(condition)errors.push(l(en,zh));};
    add(!namePattern.test(m.name),"Package name must start with a lowercase letter and contain only lowercase letters, digits or hyphens (64 characters maximum).","套件名稱須以小寫字母開頭，只可包含小寫字母、數字或連字號，最多 64 個字元。");
    add(!filenamePattern.test(m.version),"Provide a literal version using letters, digits, dots, hyphens, plus signs or underscores.","請提供字面版本，只用字母、數字、點、連字號、加號或底線。");
    const validURL=(value:string)=>{try{const u=new URL(value);return /^https?:\/\/[A-Za-z0-9._~:/@%+=-]+$/.test(value)&&!!u.hostname&&!u.username&&!u.password&&value.length<=4096;}catch{return false;}};
    add(!validURL(m.source),"Provide a direct HTTP(S) source archive URL without credentials, query strings or fragments.","請提供直接 HTTP(S) 來源封存網址，唔可以含憑證、查詢字串或片段。");
    add(!validURL(m.homepage),"Provide an HTTP(S) homepage without credentials, query strings or fragments.","請提供 HTTP(S) 首頁，唔可以含憑證、查詢字串或片段。");
    add(!filenamePattern.test(m.sourceFilename),"Source filename must be a basename, with no directory separators.","來源檔名必須係基本檔名，唔可以含目錄分隔符。");
    if(validURL(m.source))add(!new URL(m.source).pathname.endsWith("/"+m.sourceFilename),"The source URL must end with / followed by the exact source filename.","來源網址必須以 / 加上確切來源檔名結尾。");
    add(!/^[A-Za-z0-9][A-Za-z0-9_.+() -]*$/.test(m.license),"Provide a single-line license expression, for example GPL-3.0+ or MIT.","請提供單行授權條款表達式，例如 GPL-3.0+ 或 MIT。");
    add(!m.licenseFiles.length||m.licenseFiles.some(f=>!filenamePattern.test(f)),"Add at least one license file basename.","請加入至少一個授權條款基本檔名。");
    add(new Set(m.licenseFiles).size!==m.licenseFiles.length,"License filenames must be unique.","授權條款檔名唔可以重複。");
    add(m.dependencies.some(d=>!namePattern.test(d)||d===m.name),"Dependencies must be valid package names and cannot include this package itself.","相依項目必須係有效套件名稱，唔可以包含套件本身。");
    add(m.configDependencies.some(d=>!/^BR2_[A-Z0-9_]+$/.test(d)),"Configuration dependencies must be BR2_ symbols using uppercase letters, digits and underscores.","設定相依項目必須係 BR2_ 符號，只用大寫字母、數字同底線。");
    add(!m.help.trim()||m.help.length>16384||/[\x00-\x08\x0b-\x1f\x7f]/.test(m.help),"Provide plain-text package help, up to 16,384 characters.","請提供純文字套件說明，最多 16,384 個字元。");
    for(const [index,h]of m.hashes.entries())add(!filenamePattern.test(h.file)||!new RegExp(`^[a-fA-F0-9]{${h.algorithm==="sha256"?64:128}}$`).test(h.digest),`Hash ${index+1} needs a basename and an exact ${h.algorithm==="sha256"?64:128}-digit hexadecimal digest.`,`摘要 ${index+1} 需要基本檔名同確切 ${h.algorithm==="sha256"?64:128} 位十六進位摘要。`);
    add(new Set(m.hashes.map(h=>h.file)).size!==m.hashes.length,"Each file must have exactly one hash entry.","每個檔案必須只有一項摘要。");
    add(![m.sourceFilename,...m.licenseFiles].every(file=>m.hashes.some(h=>h.file===file)),"Provide verified hashes for the source archive and every license file.","請為來源封存檔同每個授權條款檔提供已驗證摘要。");
    add(m.licenseFiles.length>256||m.hashes.length>256||m.dependencies.length>256||m.configDependencies.length>256,"Lists are limited to 256 entries.","清單最多 256 項。");
    add([m.name,m.version,m.sourceFilename,m.license,...m.licenseFiles].some(v=>v.length>4096),"Metadata fields must not exceed 4,096 characters.","中繼資料欄位唔可以超過 4,096 個字元。");
    return errors;
  }
  private restoreDraft(redo=false){
    if(this.pending)return;const restored=this.draftHistory.restore(redo);if(!restored)return;
    this.model=restored;this.edit();
    this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Draft restored. Applied files are unchanged; preview again before writing.","草稿已還原，已套用檔案保持不變，寫入前請重新預覽。",true));
  }
  private example(){
    if(this.pending||(JSON.stringify(this.model)!==JSON.stringify(emptyModel())&&!this.replaceExample))return;
    this.model={...emptyModel(),name:"hello",version:"2.12.1",source:"https://ftp.gnu.org/gnu/hello/hello-2.12.1.tar.gz",sourceFilename:"hello-2.12.1.tar.gz",homepage:"https://www.gnu.org/software/hello/",license:"GPL-3.0+",help:"GNU Hello prints a greeting and demonstrates standard GNU build conventions.",hashes:[{algorithm:"sha256",file:"hello-2.12.1.tar.gz",digest:""},{algorithm:"sha256",file:"COPYING",digest:""}]};
    this.dependency="";this.configDependency="";this.edit();
  }
  private addDependency(config=false){
    const value=(config?this.configDependency:this.dependency).trim();
    const list=config?this.model.configDependencies:this.model.dependencies;
    if(!value||list.includes(value))return;
    if(!(config?/^BR2_[A-Z0-9_]+$/:namePattern).test(value)||(!config&&value===this.model.name)){
      this.validation=captureOwnedStatus(this,"validation",this.l.bind(this),l=>[l("Enter a valid dependency before adding it.","加入之前，請輸入有效相依項目。")]);this.changed();return;
    }
    if(config){this.model.configDependencies=[...list,value];this.configDependency="";}else{this.model.dependencies=[...list,value];this.dependency="";}
    this.edit();
  }
  private async choose(){await this.run(async current=>{
    const result=await this.request<{externalTreeId:string;name:string}>("external.choose",{workspaceId:this.workspaceId});
    if(current()){this.external=result;this.resetDraftStorage();this.preview=undefined;this.reviewedModel=undefined;this.consent=false;this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("External tree selected. Preview the generated files before applying.","已選擇外部樹，套用前請預覽產生嘅檔案。"));}
  });}
  private async createPreview(){
    this.validation=captureOwnedStatus(this,"validation",this.l.bind(this),l=>this.errors(l));this.changed();if(this.validation.length||!this.external)return;
    await this.run(async current=>{
      const model=structuredClone(this.model);
      const result=await this.request<Preview>("package.preview",{workspaceId:this.workspaceId,externalTreeId:this.external!.externalTreeId,model});
      if(current()){this.preview=result;this.reviewedModel=model;this.selectedFile=0;this.editorTab="review";this.consent=false;this.uncertain=false;this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Preview ready. Review every changed file before applying.","預覽已準備好，套用前請審核每個變更檔案。"));}
    });
  }
  private async apply(){
    if(!this.preview||!this.reviewedModel||!this.external||!this.consent||this.uncertain)return;
    const reviewed=this.preview,model=this.reviewedModel;
    await this.run(async current=>{
      const result=await this.request<{applied:boolean}>("package.apply",{workspaceId:this.workspaceId,externalTreeId:this.external!.externalTreeId,model,revision:reviewed.revision,previewHash:reviewed.previewHash});
      if(!result.applied)throw new Error("OUTCOME_UNAVAILABLE");
      if(current()){this.preview=undefined;this.reviewedModel=undefined;this.consent=false;this.uncertain=false;this.feedback=captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Reviewed files applied to the selected external tree. Actual Buildroot configuration and build validation are still required.","已將審核檔案套用到所選外部樹，仍需要實際 Buildroot 設定同建置驗證。"));}
    },true);
  }

  private move<T>(list:T[], index:number, delta:number){if(index+delta<0||index+delta>=list.length)return;[list[index],list[index+delta]]=[list[index+delta],list[index]];this.edit();}
  private renderFiles(){
    const m=this.model, patches=m.patches||[], hooks=m.hooks||[], overlays=m.overlays||[];
    return html`<section class="panel stack" ?hidden=${this.editorTab!=="files"}>
      <h3>${this.l("Ordered patches","有序修補",true)}</h3>
      <p>${this.l("HTTPS patch URLs are applied in the displayed order by Buildroot. No patch is downloaded or executed by this editor.","Buildroot 會按顯示次序套用 HTTPS 修補網址。編輯器唔會下載或執行修補。",true)}</p>
      ${patches.map((value,i)=>html`<div class="stack hash-row">${this.field(this.l(`Patch URL ${i+1}`,`修補網址 ${i+1}`),value,v=>patches[i]=v)}<div class="row">${this.button("Move patch up","上移修補",()=>this.move(patches,i,-1),i===0)}${this.button("Move patch down","下移修補",()=>this.move(patches,i,1),i===patches.length-1)}${this.button("Remove patch","移除修補",()=>{m.patches=patches.filter((_,n)=>n!==i);this.edit();})}</div></div>`)}
      ${this.button("Add patch","加入修補",()=>{m.patches=[...patches,""];this.edit();},patches.length>=64)}
      <h3>${this.l("Configure options","設定選項",true)}</h3>
      ${this.field(this.l("One literal option per line","每行一個字面選項",true),(m.buildOptions||[]).join("\n"),v=>m.buildOptions=v.split(/\r?\n/).filter(Boolean),this.l("Autotools, CMake and Meson only. No shell expressions or spaces inside an option.","只適用於 Autotools、CMake 同 Meson。選項內唔可以有 shell 表達式或空格。",true),true)}
      <h3>${this.l("Ordered file-operation hooks","有序檔案操作掛鈎",true)}</h3>
      <p>${this.l("Copy and directory operations only. Source paths are relative to the extracted package. Post-install destinations are relative to the target filesystem; other destinations are relative to the package build directory.","只提供複製同建立目錄。來源路徑相對於解壓後套件，安裝後目的地相對於目標檔案系統，其餘目的地相對於套件建置目錄。",true)}</p>
      ${hooks.map((h,i)=>html`<div class="stack hash-row"><h4>${this.l(`Hook ${i+1}`,`掛鈎 ${i+1}`)}</h4>${this.select(this.l("Stage","階段",true),h.stage,["PRE_CONFIGURE","POST_CONFIGURE","PRE_BUILD","POST_BUILD","POST_INSTALL_TARGET"],v=>h.stage=v)}${this.select(this.l("Operation","操作",true),h.operation,["copy","mkdir"],v=>h.operation=v)}${h.operation==="copy"?this.field(this.l("Package source path","套件來源路徑",true),h.source,v=>h.source=v):nothing}${this.field(this.l("Destination path","目的地路徑",true),h.destination,v=>h.destination=v)}${this.field(this.l("Octal permissions","八進位權限",true),h.mode,v=>h.mode=v,"000–777")}<div class="row">${this.button("Move hook up","上移掛鈎",()=>this.move(hooks,i,-1),i===0)}${this.button("Move hook down","下移掛鈎",()=>this.move(hooks,i,1),i===hooks.length-1)}${this.button("Remove hook","移除掛鈎",()=>{m.hooks=hooks.filter((_,n)=>n!==i);this.edit();})}</div></div>`)}
      ${this.button("Add hook","加入掛鈎",()=>{m.hooks=[...hooks,{stage:"POST_BUILD",operation:"copy",source:"",destination:"",mode:"644"}];this.edit();},hooks.length>=64)}
      <h3>${this.l("Overlay file mappings","覆蓋檔案對應",true)}</h3>
      <p>${this.l("Copy existing files from the selected external tree into the target filesystem after package installation. Paths must be relative and cannot contain spaces or traversal components. Source existence is checked before preview; no host file permissions are changed.","套件安裝後，會將所選外部樹現有檔案複製到目標檔案系統。路徑必須相對，唔可以包含空格或越界部分。預覽前會檢查來源存在，唔會更改主機檔案權限。",true)}</p>
      ${overlays.map((o,i)=>html`<div class="stack hash-row">${this.field(this.l("External-tree source","外部樹來源",true),o.source,v=>o.source=v)}${this.field(this.l("Target destination","目標目的地",true),o.destination,v=>o.destination=v)}${this.field(this.l("Octal permissions","八進位權限",true),o.mode,v=>o.mode=v,"000–777")}${this.button("Remove mapping","移除對應",()=>{m.overlays=overlays.filter((_,n)=>n!==i);this.edit();})}</div>`)}
      ${this.button("Add overlay mapping","加入覆蓋對應",()=>{m.overlays=[...overlays,{source:"",destination:"",mode:"644"}];this.edit();},overlays.length>=64)}
    </section>`;
  }
  render(){
    const m=this.model,file=this.preview?.files[this.selectedFile];
    return html`<div class="stack" aria-busy=${this.pending}>
      ${this.pending?html`<md-linear-progress indeterminate aria-label=${this.l("Package operation in progress","套件操作進行中",true)}></md-linear-progress>`:nothing}
      <div role="status" aria-live="polite">${displayOwnedStatus(this,"feedback",this.feedback,this.language)}</div>
      <section class="panel stack package-context"><h2>${this.l("Author a Buildroot package","編寫 Buildroot 套件",true)}</h2>
        <p>${this.l("Choose a prepared BR2_EXTERNAL tree, or initialize an empty folder below. Package file review and build activation are separate approvals.","選擇已準備好嘅 BR2_EXTERNAL 樹，或喺下面初始化空白資料夾。套件檔案審核同建置啟用需要獨立批准。",true)}</p>
        ${!this.workspaceId?html`<p>${this.l("Adopt a project in Projects & runtime first. Your draft stays here while you select one.","請先喺專案同執行環境接入專案，選擇期間會保留草稿。",true)}</p>`:nothing}
        <div class="row external-tree-row"><div class="external-tree-name"><small>BR2_EXTERNAL</small><span>${this.external?.name||this.l("No external tree selected","未選擇外部樹",true)}</span></div>${this.button("Choose prepared external tree","選擇已準備好外部樹",()=>this.choose(),!this.workspaceId)}</div>
        <div class="context-actions"><details><summary>${this.l("Discover and import source packages","探索同匯入來源套件",true)}</summary><package-discovery-panel .workspaceId=${this.workspaceId} .language=${this.language} .locked=${this.pending} @package-draft-imported=${(e:CustomEvent)=>{if(this.pending||e.detail.workspaceId!==this.workspaceId)return;this.model=structuredClone(e.detail.draft);this.resetDraftStorage();if(e.detail.treeId!=="source")this.external={externalTreeId:e.detail.treeId,name:e.detail.name};this.editorTab="identity";this.edit();}}></package-discovery-panel></details>
        <details><summary>${this.l("Start from example metadata","由範例中繼資料開始",true)}</summary><p class="note">${this.l("Replaces this draft with GNU Hello metadata. Hashes are deliberately empty; obtain and verify real source and license-file digests before previewing.","用 GNU Hello 中繼資料取代此草稿。摘要會保持空白，預覽前請取得並驗證真實來源同授權條款檔摘要。",true)}</p>${JSON.stringify(m)!==JSON.stringify(emptyModel())?html`<label class="row"><md-checkbox ?checked=${this.replaceExample} ?disabled=${this.pending} @change=${(e:Event)=>{this.replaceExample=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox>${this.l("Replace this populated draft with the example; Undo draft can restore it.","以範例取代有內容嘅草稿；復原草稿可還原。",true)}</label>`:nothing}${this.button("Use GNU Hello example","使用 GNU Hello 範例",()=>this.example(),JSON.stringify(m)!==JSON.stringify(emptyModel())&&!this.replaceExample)}</details>
        <details><summary>${this.l("Initialize folders and activate external trees","初始化資料夾同啟用外部樹",true)}</summary><external-tree-panel .workspaceId=${this.workspaceId} .language=${this.language} @external-selected=${(e:CustomEvent)=>{this.external=e.detail;this.resetDraftStorage();this.edit();}}></external-tree-panel></details></div>
      </section>
      <section class="panel stack"><details><summary>${this.l("Saved package drafts and recovery","已儲存套件草稿同復原",true)}</summary><p>${this.l("Choose or reacquire the project and prepared external tree first. Save is explicit and preserves incomplete drafts, up to 32 KiB each and ten undo plus ten redo snapshots. No package files are written. Credentials must never be entered into a draft.","請先選擇或重新取得專案同已準備好外部樹。明確儲存會保留未完成草稿，每份最多 32 KiB，同十份復原及十份重做快照。唔會寫入套件檔案，切勿喺草稿填寫憑證。",true)}</p><guided-forms .language=${this.language} .guide=${{title:this.l("Recover a saved recipe draft","復原已儲存配方草稿",true),purpose:this.l("Recovery is bound to current project, source and external-folder identity. Changed identities show a separate empty history. Previously granted access and file-write approval are never restored.","復原綁定目前專案、來源同外部資料夾識別。識別更改會顯示獨立空白歷史，唔會還原之前授權或檔案寫入批准。",true),steps:[this.l("Reacquire the project and external folder, then refresh saved draft history.","重新取得專案同外部資料夾，再重新整理草稿歷史。",true),this.l("Select a saved revision and approve replacement of the editor draft. The current editor draft is retained as an Undo step.","選擇已儲存修訂版本並批准取代編輯器草稿，目前草稿會保留為復原步驟。",true),this.l("Restore explicitly, review the recovered fields, then create a new package preview before any write.","明確還原並審核欄位，任何寫入前須建立新套件預覽。",true)],example:"1",expected:this.l("A positive revision number passes practice validation only; the live selector uses actual saved records.","正數修訂版本只通過練習驗證，真實選單會使用實際儲存記錄。",true),validate:(v:string)=>/^[1-9][0-9]*$/.test(v)&&Number.isSafeInteger(Number(v))?"":this.l("Enter a positive whole revision number.","請輸入正整數修訂版本。",true)}}></guided-forms><div class="row">${this.button("Refresh saved draft history","重新整理草稿歷史",()=>this.draftStorage("history"),!this.workspaceId||!this.external)}${this.button("Save draft and undo history","儲存草稿同復原歷史",()=>this.draftStorage("save"),!this.workspaceId||!this.external||this.draftStorageRevision===undefined)}</div><p>${this.draftStorageRevision===undefined?this.l("Refresh history after choosing the external tree before saving or restoring. If an operation is unconfirmed, refresh again.","選擇外部樹後，儲存或還原前請重新整理歷史。操作未能確認時請再重新整理。",true):this.l("History is loaded. Save preserves the current editor state; restore replaces only the editor draft.","已載入歷史，儲存會保留目前編輯器狀態，還原只會取代編輯器草稿。",true)}</p>${this.draftRecords.length?html`<md-outlined-select .label=${this.l("Saved draft revision","已儲存草稿修訂版本",true)} .value=${this.selectedDraftRevision} ?disabled=${this.pending} @change=${(e:Event)=>{this.selectedDraftRevision=(e.target as HTMLSelectElement).value;this.restoreDraftApproved=false;this.changed();}}>${this.draftRecords.map(record=>html`<md-select-option .value=${String(record.revision)}><div slot="headline">${record.revision} · ${record.timestamp||this.l("Timestamp unavailable","時間不可用",true)}</div></md-select-option>`)}</md-outlined-select><label class="row"><md-checkbox ?checked=${this.restoreDraftApproved} ?disabled=${this.pending||!this.selectedDraftRevision} @change=${(e:Event)=>{this.restoreDraftApproved=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox>${this.l("Replace the editor draft only; keep the previous draft in Undo.","只取代編輯器草稿，並保留之前草稿喺復原記錄。",true)}</label>${this.button("Restore selected draft","還原所選草稿",()=>this.draftStorage("restore"),!this.restoreDraftApproved||!this.selectedDraftRevision)}`:this.draftStorageRevision!==undefined?html`<p>${this.l("No revisions listed. Save this draft or refresh after a save to list available revisions.","未列出修訂版本。請儲存此草稿，或儲存後重新整理以列出可用版本。",true)}</p>`:nothing}</details></section>
      <div class="row" role="group" aria-label=${this.l("Package draft history","套件草稿歷史",true)}>${this.button("Undo draft","復原草稿",()=>this.restoreDraft(),!this.draftHistory.canUndo)}${this.button("Redo draft","重做草稿",()=>this.restoreDraft(true),!this.draftHistory.canRedo)}<span>${this.l("Draft history includes recipe fields and dependency removal. Canvas Undo changes positions only. Neither restores applied files.","草稿歷史包括配方欄位同移除相依項目。畫布復原只會改變位置，兩者都唔會還原已套用檔案。",true)}</span></div><div class="package-workbench"><div class="canvas-pane"><diagram-workbench .language=${this.language} .title=${this.l("Package dependencies","套件相依圖",true)} .workspaceId=${this.workspaceId} canvasId="package-dependencies" .layoutKey=${this.workspaceId+":package-dependencies"} .nodes=${[{id:"package",label:m.name||this.l("Package draft","套件草稿",true),detail:m.buildSystem,kind:"package"},...m.dependencies.map(value=>({id:"dep:"+value,label:value,detail:this.l("Build dependency","建置相依",true),kind:"dependency",removable:true})),...m.configDependencies.map(value=>({id:"config:"+value,label:value,detail:this.l("Configuration constraint","設定限制",true),kind:"constraint",removable:true}))]} .edges=${[...m.dependencies.map(value=>({from:"package",to:"dep:"+value})),...m.configDependencies.map(value=>({from:"package",to:"config:"+value}))]} @diagram-select=${(e:CustomEvent)=>{this.editorTab=e.detail.id==="package"?"identity":"dependencies";}} @diagram-remove=${(e:CustomEvent)=>{const id=e.detail.id;if(id.startsWith("dep:"))m.dependencies=m.dependencies.filter(value=>"dep:"+value!==id);if(id.startsWith("config:"))m.configDependencies=m.configDependencies.filter(value=>"config:"+value!==id);this.edit();}}></diagram-workbench></div><div class="package-inspector">
      <md-tabs .activeTabIndex=${["identity","build","dependencies","hashes","files","review"].indexOf(this.editorTab)} @change=${(e:Event)=>{this.editorTab=["identity","build","dependencies","hashes","files","review"][(e.target as any).activeTabIndex];}}>${[["identity","Identity","識別"],["build","Build","建置"],["dependencies","Dependencies","相依"],["hashes","Hashes","摘要"],["files","Patches & files","修補同檔案"],["review","Review","審核"]].map(([id,en,zh])=>html`<md-secondary-tab role="tab" aria-label=${this.l(en,zh,true)}>${this.l(en,zh,true)}</md-secondary-tab>`)}</md-tabs>
      <div class="columns"><section class="panel stack" ?hidden=${this.editorTab!=="identity"}><h3>${this.l("Package identity and source","套件識別同來源",true)}</h3>
        ${this.field(this.l("Package name","套件名稱",true),m.name,v=>m.name=v,this.l("Lowercase letters, digits and hyphens; starts with a letter.","小寫字母、數字同連字號，以字母開頭。",true))}
        ${this.field(this.l("Version","版本",true),m.version,v=>m.version=v,this.l("Literal version only; no build variables or expressions.","只接受字面版本，唔可以使用建置變數或表達式。",true))}
        ${this.field(this.l("Source archive URL","來源封存網址",true),m.source,v=>m.source=v,this.l("Direct HTTP(S) URL ending with the source filename; no credentials or query string.","直接 HTTP(S) 網址，以來源檔名結尾，唔可以含憑證或查詢字串。",true))}
        ${this.field(this.l("Source filename","來源檔名",true),m.sourceFilename,v=>m.sourceFilename=v,this.l("Basename only, for example hello-2.12.1.tar.gz.","只接受基本檔名，例如 hello-2.12.1.tar.gz。",true))}
        ${this.field(this.l("Homepage URL","首頁網址",true),m.homepage,v=>m.homepage=v)}
        ${this.field(this.l("Package help","套件說明",true),m.help,v=>m.help=v,this.l("Plain text shown in the generated configuration menu.","喺產生嘅設定選單顯示純文字。",true),true)}
      </section><section class="panel stack" ?hidden=${this.editorTab!=="build"}><h3>${this.l("Build system and license","建置系統同授權條款",true)}</h3>
        ${this.select(this.l("Build system","建置系統",true),m.buildSystem,["generic","autotools","cmake","meson","cargo","go","python"],v=>{m.buildSystem=v as BuildSystem;if(v==="python")m.pythonSetupType="setuptools";else delete m.pythonSetupType;})}
        ${m.buildSystem==="python"?this.select(this.l("Python setup type","Python 安裝類型",true),m.pythonSetupType||"setuptools",["setuptools","pep517","flit","hatch","poetry","setuptools-rust","maturin"],v=>m.pythonSetupType=v as PackageModel["pythonSetupType"]):nothing}
        <p class="note">${this.l("Buildroot infrastructure generates the recipe. Dependency toolchain constraints are not inferred. Generic recipes contain metadata only; custom commands require a separate reviewed workflow.","Buildroot 基礎架構會產生配方，但唔會推斷相依工具鏈限制。generic 配方只有中繼資料，自訂指令需要獨立審核流程。",true)}</p>
        ${this.field(this.l("License expression","授權條款表達式",true),m.license,v=>m.license=v,this.l("Single line, for example MIT or GPL-3.0+.","單行，例如 MIT 或 GPL-3.0+。",true))}
        <h3>${this.l("License files","授權條款檔案",true)}</h3>
        ${m.licenseFiles.map((name,index)=>html`<div class="row">${this.field(this.l(`License file ${index+1}`,`授權條款檔案 ${index+1}`),name,v=>m.licenseFiles[index]=v)}${this.button(`Remove license file ${index+1}`,`移除授權條款檔案 ${index+1}`,()=>{m.licenseFiles=m.licenseFiles.filter((_,i)=>i!==index);this.edit();})}</div>`)}
        ${this.button("Add license file","加入授權條款檔案",()=>{m.licenseFiles=[...m.licenseFiles,""];this.edit();},m.licenseFiles.length>=256)}
      </section></div>
      <section class="panel stack" ?hidden=${this.editorTab!=="dependencies"}><h3>${this.l("Dependencies","相依項目",true)}</h3><div class="columns"><div class="stack">
        <div class="row">${this.field(this.l("Package dependency","套件相依項目",true),this.dependency,v=>this.dependency=v)}${this.button("Add package dependency","加入套件相依項目",()=>this.addDependency(),!this.dependency.trim()||m.dependencies.length>=256)}</div>
        <md-chip-set aria-label=${this.l("Package dependencies","套件相依項目清單",true)}>${m.dependencies.map(item=>html`<md-input-chip .label=${item} remove-only ?disabled=${this.pending} aria-label=${this.l(`Remove dependency ${item}`,`移除相依項目 ${item}`)} @remove=${()=>{m.dependencies=m.dependencies.filter(v=>v!==item);this.edit();}}></md-input-chip>`)}</md-chip-set>
        </div><div class="stack"><div class="row">${this.field(this.l("Configuration dependency","設定相依項目",true),this.configDependency,v=>this.configDependency=v,this.l("An exact BR2_ symbol, for example BR2_USE_MMU.","確切 BR2_ 符號，例如 BR2_USE_MMU。",true))}${this.button("Add configuration dependency","加入設定相依項目",()=>this.addDependency(true),!this.configDependency.trim()||m.configDependencies.length>=256)}</div>
        <md-chip-set aria-label=${this.l("Configuration dependencies","設定相依項目清單",true)}>${m.configDependencies.map(item=>html`<md-input-chip .label=${item} remove-only ?disabled=${this.pending} aria-label=${this.l(`Remove dependency ${item}`,`移除相依項目 ${item}`)} @remove=${()=>{m.configDependencies=m.configDependencies.filter(v=>v!==item);this.edit();}}></md-input-chip>`)}</md-chip-set></div></div>
      </section>
      <section class="panel stack" ?hidden=${this.editorTab!=="hashes"}><h3>${this.l("Verified file hashes","已驗證檔案摘要",true)}</h3><p class="note">${this.l("Provide one verified SHA-256 or SHA-512 digest for the source archive and each license file. License hashes refer to the files inside the source archive. This editor does not download files or invent digests.","請為來源封存檔同每個授權條款檔提供一項已驗證 SHA-256 或 SHA-512 摘要。授權條款摘要對應來源封存檔內嘅檔案。此編輯器唔會下載檔案或產生虛構摘要。",true)}</p>
        <div class="row">${this.button("Add missing required hash rows","加入缺少嘅必要摘要列",()=>{for(const file of [m.sourceFilename,...m.licenseFiles].filter(Boolean))if(!m.hashes.some(h=>h.file===file)&&m.hashes.length<256)m.hashes.push({algorithm:"sha256",file,digest:""});this.edit();})}${this.button("Add another hash","加入另一項摘要",()=>{m.hashes.push({algorithm:"sha256",file:"",digest:""});this.edit();},m.hashes.length>=256)}</div>
        ${m.hashes.map((hash,index)=>html`<div class="hash-row stack"><div class="columns">${this.field(this.l(`Hash file ${index+1}`,`摘要檔案 ${index+1}`),hash.file,v=>hash.file=v)}${this.select(this.l(`Hash algorithm ${index+1}`,`摘要演算法 ${index+1}`),hash.algorithm,["sha256","sha512"],v=>hash.algorithm=v as Hash["algorithm"])}</div>${this.field(this.l(`Verified digest ${index+1}`,`已驗證摘要 ${index+1}`),hash.digest,v=>hash.digest=v,this.l(`${hash.algorithm==="sha256"?64:128} hexadecimal digits; verify against the actual file.`,`${hash.algorithm==="sha256"?64:128} 位十六進位數字，請對照實際檔案驗證。`))}${this.button(`Remove hash ${index+1}`,`移除摘要 ${index+1}`,()=>{m.hashes=m.hashes.filter((_,i)=>i!==index);this.edit();})}</div>`)}
      </section>
      ${this.renderFiles()}
      ${this.validation.length?html`<section class="panel validation" role="alert"><h3>${this.l("Check the package draft","檢查套件草稿",true)}</h3><ul>${displayOwnedStatus(this,"validation",this.validation,this.language).map(error=>html`<li>${error}</li>`)}</ul></section>`:nothing}
      ${this.button("Preview generated files","預覽產生檔案",()=>this.createPreview(),!this.workspaceId||!this.external)}
      ${this.preview&&file?html`<section class="panel stack" ?hidden=${this.editorTab!=="review"}><h2>${this.l("Review package files","審核套件檔案",true)}</h2><p>${this.l("Edits invalidate this preview. Applying checks both the current external-tree revision and the generated content hash.","編輯會令此預覽失效。套用時會同時檢查目前外部樹修訂版本同產生內容摘要。",true)}</p>
        <ul>${this.preview.warnings.map(warning=>html`<li>${warning}</li>`)}</ul>
        <md-outlined-select .label=${this.l("File to review","要審核嘅檔案",true)} .value=${String(this.selectedFile)} .displayText=${file.path} ?disabled=${this.pending} @change=${(e:Event)=>{this.selectedFile=Number((e.target as HTMLSelectElement).value);this.changed();}}>${this.preview.files.map((f,index)=>html`<md-select-option .value=${String(index)}><div slot="headline">${f.path}</div></md-select-option>`)}</md-outlined-select>
        <p>${file.before===null?this.l("New file","新檔案",true):file.before===file.after?this.l("Unchanged file","未變更檔案",true):this.l("Existing file will be updated","會更新現有檔案",true)} · ${this.l("Mode","模式",true)}: ${file.mode.toString(8)}</p>
        <div class="columns"><div class="stack"><h3>${this.l("Before","之前",true)}</h3><pre tabindex="0" role="region" aria-label=${this.l("File before change","變更前檔案",true)}>${file.before??this.l("File does not exist.","檔案不存在。",true)}</pre></div><div class="stack"><h3>${this.l("After","之後",true)}</h3><pre tabindex="0" role="region" aria-label=${this.l("File after change","變更後檔案",true)}>${file.after}</pre></div></div>
        <details><summary>${this.l("Review identifiers","審核識別碼",true)}</summary><p class="hash">${this.preview.revision}</p><p class="hash">${this.preview.previewHash}</p></details>
        <label class="row consent"><md-checkbox aria-label=${this.l("I reviewed the generated files and approve writing them to the selected external tree.","我已審核產生檔案，並批准寫入所選外部樹。",true)} ?checked=${this.consent} ?disabled=${this.pending} @change=${(e:Event)=>{this.consent=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox><span>${this.l("I reviewed the generated files and approve writing them to the selected external tree.","我已審核產生檔案，並批准寫入所選外部樹。",true)}</span></label>
        ${this.button("Apply reviewed package files","套用已審核套件檔案",()=>this.apply(),!this.consent||this.uncertain)}
      </section>`:nothing}
      </div></div>
    </div>`;
  }
}
customElements.define("package-panel",PackagePanel);
