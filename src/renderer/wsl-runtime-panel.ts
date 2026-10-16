import {LitElement, html, css, nothing} from "lit";
import "@material/web/button/outlined-button.js";
import "@material/web/button/filled-button.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/progress/linear-progress.js";
export class WslRuntimePanel extends LitElement {
  static properties={language:{type:String},pending:{state:true},distributions:{state:true},selected:{state:true},status:{state:true}};
  language="bilingual"; pending=false; distributions:any[]=[]; selected=""; status:any=null;
  static styles=css`:host{display:block;min-width:0}section{display:grid;gap:12px}h3,p{margin:0}.actions{display:flex;flex-wrap:wrap;gap:8px}md-outlined-select{max-width:100%;min-width:0}p,dd{overflow-wrap:anywhere}dl{margin:0}dd{margin-inline-start:12px}`;
  private l(en:string,zh:string){return this.language==="en"?en:this.language==="zh-HK"?zh:`${en} / ${zh}`;}
  private async act(kind:string){
    if(this.pending)return;this.pending=true;
    try {
      const reply=await window.studio.operations?.({action:"runtime.wsl",kind,distribution:this.selected});
      if(!reply?.ok){this.status={state:"operation-unavailable"};return;}
      const result=reply.result as any;this.status=result;
      if(kind==="discover"){this.distributions=result.distributions||[];if(!this.distributions.some(x=>x.name===this.selected))this.selected="";}
      if(kind==="import" && result.distribution){this.selected=result.distribution;const listing=await window.studio.operations?.({action:"runtime.wsl",kind:"discover",distribution:""});if(listing?.ok)this.distributions=(listing.result as any).distributions||[];}
    } catch {this.status={state:"operation-unavailable"};} finally{this.pending=false;}
  }
  private message(state:string){
    const labels:Record<string,[string,string]>={
      succeeded:["Discovery finished. Select a WSL 2 distribution.","探索完成，請揀選 WSL 2 發行版。"],
      ready:["Non-root account and required commands are available.","非 root 帳戶同所需指令已可使用。"],
      "prerequisites-missing":["Required tools are missing. Install prerequisites after reviewing the native confirmation.","欠缺所需工具，請核對原生確認後安裝。"],
      "account-setup-required":["A non-root default account must be initialized in the distribution. Preserve it and retry inspection after account setup.","需要喺發行版設定非 root 預設帳戶。保留發行版，完成帳戶設定後重新檢查。"],
      "manual-prerequisites-required":["Automatic package setup supports Debian and Ubuntu with a non-root default account only.","自動套件設定只支援已有非 root 預設帳戶嘅 Debian 同 Ubuntu。"],
      "storage-ready":["Linux source, output and downloads folders are ready. Existing files were preserved.","Linux 來源、輸出同下載目錄已建立，現有檔案已保留。"],
      "exported":["Backup exported. Keep it private. This does not prove restoration or application consistency.","備份已匯出，請保密保存；尚未驗證還原或應用程式一致性。"],
      "opened":["Native file browser opened.","已開啟原生檔案瀏覽器。"],
      "cancelled":["Cancelled. Existing distributions are preserved.","已取消，現有發行版保留不變。"],
      "import-incomplete":["Import did not finish. Preserve the managed record and files. Check WSL availability and any Windows restart requirement manually before retrying discovery.","匯入未完成，請保留管理記錄同檔案。手動檢查 WSL 可用性同 Windows 重新啟動需要，再探索。"],
      "unsupported-platform":["WSL setup requires Windows.","WSL 設定需要 Windows。"],
    };const value=labels[state];return value?this.l(...value):this.l("Operation incomplete. Existing files are retained. Check WSL 2 installation, virtualization support, permissions and available storage before retrying.","操作未完成，現有檔案已保留。請檢查 WSL 2 安裝、虛擬化支援、權限同儲存空間再重試。");
  }
  render(){return html`<section aria-label=${this.l("WSL setup and storage","WSL 設定同儲存")}>
    <h3>${this.l("WSL setup and Linux storage","WSL 設定同 Linux 儲存")}</h3>
    <p>${this.l("WSL 2 requires supported Windows, hardware virtualization and the WSL/Virtual Machine Platform features. Install or enable these through Windows before setup. Any required restart is yours to perform. Discovery does not start a distribution; inspection and setup do.","WSL 2 需要支援嘅 Windows、硬件虛擬化同 WSL／虛擬機平台功能，請先透過 Windows 安裝或啟用。如需重新啟動，請自行處理。探索唔會啟動發行版，檢查同設定會啟動。")}</p>
    <div class="actions"><md-outlined-button ?disabled=${this.pending} @click=${()=>this.act("discover")}>${this.l("Find distributions","尋找發行版")}</md-outlined-button><md-outlined-button ?disabled=${this.pending} @click=${()=>this.act("import")}>${this.l("Import dedicated distribution","匯入獨立發行版")}</md-outlined-button></div>
    <md-outlined-select label=${this.l("WSL 2 distribution","WSL 2 發行版")} .value=${this.selected} ?disabled=${this.pending} @change=${(e:Event)=>{this.selected=(e.target as HTMLSelectElement).value;this.status=null;}}>${this.distributions.map(x=>html`<md-select-option value=${x.name} ?disabled=${x.version!==2}><div slot="headline">${x.name} (WSL ${x.version}) ${x.managed?this.l("Managed","受管理"):this.l("Existing","現有")}</div></md-select-option>`)}</md-outlined-select>
    <div class="actions">${([ ["inspect","Inspect readiness","檢查就緒狀態"],["prerequisites","Install prerequisites","安裝所需套件"],["storage","Prepare Linux folders","建立 Linux 目錄"],["browse","Browse Linux folders","瀏覽 Linux 目錄"],["export","Export distribution backup","匯出發行版備份"]] as string[][]).map(([kind,en,zh])=>html`<md-outlined-button ?disabled=${this.pending||!this.selected} @click=${()=>this.act(kind)}>${this.l(en,zh)}</md-outlined-button>`)}</div>
    ${this.pending?html`<md-linear-progress indeterminate aria-label=${this.l("WSL operation running","WSL 操作進行中")}></md-linear-progress>`:nothing}
    <p role="status" aria-live="polite">${this.status?this.message(this.status.state):""}</p>
    ${this.status?.missing?.length?html`<p>${this.l("Missing tools","欠缺工具")}: ${this.status.missing.join(", ")}</p>`:nothing}
    ${this.status?.storage?html`<p>${this.l("Linux storage","Linux 儲存")}: ${this.status.storage}</p>`:nothing}
    ${this.status?.destination?html`<p>${this.l("Backup destination","備份位置")}: ${this.status.destination}</p>`:nothing}
    <p>${this.l("Keep source and output on Linux storage for filesystem semantics and performance. Managed imports are never unregistered or replaced automatically. Back up before manual recovery. Root is used only for explicitly confirmed package/account setup, never Buildroot builds.","來源同輸出應保存在 Linux 儲存，保持檔案系統語意同效能。受管理匯入唔會自動取消註冊或取代，手動復原前請先備份。root 只用於明確確認嘅套件／帳戶設定，絕不用於 Buildroot 建置。")}</p>
  </section>`;}
}
customElements.define("wsl-runtime-panel",WslRuntimePanel);
