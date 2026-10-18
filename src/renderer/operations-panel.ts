import {localizedCopy} from './language-wording';
import "./named-targets-panel";
import "./account-provisioning-panel";
import "./image-presets-panel";
import "./configuration-panel";
import "./defconfig-panel";
import "./update-panel";
import "./wsl-runtime-panel";
import "./remote-runtime-panel";
import "./execution-setup-panel";
import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
import "./ollama-evidence-panel";
import "./ollama-workspace-panel";
import "./build-queue-panel";
import { requestDestructiveConfirmation } from "./destructive-confirmation";
import "./ollama-catalogue-panel";
import "./documentation-panel";
import {materialIcon, actionIcon} from "./material-icons";
import { LitElement, html, nothing, css } from "lit";
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/switch/switch.js";
import "@material/web/progress/linear-progress.js";
import "./regex-workbench";
import "./guest-panel";
import "./artifact-viewers";
import "./tools-panel";
import "./companion-panel";
import "./authenticator-panel";
import "./source-panel";
import "./project-workflow-panel";
import "./package-panel";
import "./managed-ollama-panel";
import { workspaceStyles } from "./workspace-styles";
type Reply = { ok: true; result: any } | { ok: false; code: string };
type IsoPermissionContext={panel:import('./image-presets-panel').ImagePresetsPanel;workspaceId:string;generation:number;isoEpoch:number;status:'review'|'approved'};
type Job = {
  id: string;
  kind: string;
  state: string;
  sequence: number;
  createdAt: string;
  logCount: number;
  payload?: {target:string;jobs:number;resources?:{cpuSlots:number;memoryBytes:number;storageBytes:number};intent?:{projectId:string;sourceRevision:string;configRevision:string}};
};
/** Typed task controls. Host operations remain the authority for paths and execution. */
export class OperationsPanel extends LitElement {
  static properties = {
    configurationGeneration:{state:true},
    restricted:{type:Boolean},
    language: { type: String },
    tab: { state: true },
    pending: { state: true },
    feedback: { state: true },
    runtime: { state: true },
    containerStorage: { state: true },
    selection: { state: true },
    workspace: { state: true },
    jobs: { state: true },
    logs: { state: true },
    selectedJob: { state: true },
    config: { state: true },
    configDomain: { state: true },
    configTrustPreview: { state: true },
    configTrustAccepted: { state: true },
    isoPermission: { state: true },
    changes: { state: true },
    defconfigs: { state: true },
    artifacts: { state: true },
    artifact: { state: true },
    models: { state: true },
    messages: { state: true },
    updateState: { state: true },
    runtimeKind: { state: true },
    distribution: { state: true },
    image: { state: true },
    parallelism: { state: true },
    customResources: { state: true },
    cpuSlots: { state: true },
    memoryMiB: { state: true },
    storageGiB: { state: true },
    target: { state: true },
    trust: { state: true },
    model: { state: true },
    prompt: { state: true },
    configPage: { state: true },
    dockHeight: { state: true },
    dockOpen: { state: true },
  };
  configurationGeneration=0;
  restricted=false;
  language = "bilingual";
  tab = "runtime";
  pending = false;
  feedback = "";
  runtime: any;
  containerStorage?: { name: string; state: string; permissions: string };
  selection: any;
  workspace: any;
  jobs: Job[] = [];
  logs: any[] = [];
  selectedJob = "";
  config: any;
  configDomain = "buildroot";
  configTrustPreview: any;
  configTrustAccepted = false;
  changes: Record<string, { type: string; value: unknown }> = {};
  defconfigs: any[] = [];
  artifacts: any[] = [];
  artifact: any;
  models: any[] = [];
  messages: { role: "user" | "assistant"; content: string }[] = [];
  updateState: any;
  runtimeKind = "docker";
  distribution = "";
  image = "";
  parallelism = 2;
  customResources=false;cpuSlots=2;memoryMiB=4096;storageGiB=8;
  target = "all";
  trust = false;
  model = "";
  prompt = "";
  configPage = 0;
  dockHeight = 140;
  dockOpen = true;
  private logCursor = 0;
  private logMore = false;
  private confirmingClean = false;
  private configTrustEpoch=0;
  private isoPermission?:IsoPermissionContext;
  disconnectedCallback(){this.configTrustEpoch++;this.isoPermission=undefined;this.configTrustPreview=undefined;this.configTrustAccepted=false;super.disconnectedCallback();}
  protected willUpdate(changed:Map<string,unknown>){
    if(['workspace','configDomain','configurationGeneration','tab'].some(key=>changed.has(key))){
      this.configTrustEpoch++;this.configTrustPreview=undefined;this.configTrustAccepted=false;
      if(this.isoPermission&&!this.currentIsoPermission(this.isoPermission))this.isoPermission=undefined;
    }
  }
  protected updated(changed: Map<string, unknown>) {
    if (!changed.has("workspace")) return;
    const workspaceId = this.workspace?.workspaceId;
    this.runtimeKind = "docker"; this.image = ""; this.distribution = "";
    if (!workspaceId) return;
    void this.run("project.options", { workspaceId }).then(options => {
      if (this.workspace?.workspaceId !== workspaceId || !options) return;
      if (options.runtime?.kind === "wsl") { this.runtimeKind = "wsl"; this.distribution = options.runtime.distribution; }
      if (options.runtime?.kind === "docker") { this.runtimeKind = "docker"; this.image = options.runtime.image; }
    });
  }
  static styles = [
    workspaceStyles,
    css`
      :host {
        height: auto;
        min-height: 0;
        font-family: inherit;
        color: inherit;
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
      .guest-host[hidden],
      .regex-host[hidden] {
        display: none;
      }
      .ide { display:flex; height:100%; min-height:0; overflow:hidden; border:1px solid var(--md-sys-color-outline-variant); }
      .explorer { width:180px; flex-shrink:0; overflow:auto; background:var(--md-sys-color-surface-container-low); border-right:1px solid var(--md-sys-color-outline-variant);padding:8px; }
      .explorer h2 {font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:8px 4px;}
      .explorer .project-name{font-size:12px;font-weight:600;padding:8px 4px;overflow-wrap:anywhere}
      .explorer md-text-button{display:flex;width:100%;justify-content:flex-start;--md-text-button-container-height:32px;--md-text-button-container-shape:4px;font-size:12px}
      .explorer .active{background:var(--md-sys-color-secondary-container)}
      .editor-frame{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
      .document-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:8px 24px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:13px;min-height:56px}
      .document-toolbar strong{margin-right:auto;font-size:22px;line-height:28px;font-weight:400}.document-toolbar md-text-button{--md-text-button-container-height:40px}
      .dock{flex-shrink:0;display:flex;flex-direction:column;border-top:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low);overflow:hidden}
      .dock-resizer{height:5px;cursor:ns-resize;flex-shrink:0;background:var(--md-sys-color-outline-variant)}
      .dock-content{display:flex;min-height:0;flex:1;overflow:hidden}.dock-jobs{width:220px;overflow:auto;border-right:1px solid var(--md-sys-color-outline-variant)}
      .dock-jobs md-text-button{width:100%;--md-text-button-container-height:30px;font-size:11px}.dock-log{flex:1;min-width:0;overflow:auto;white-space:pre-wrap;font:12px/1.5 monospace;padding:8px}
      .dock-empty{font:12px/1.5 inherit;padding:8px;color:var(--md-sys-color-on-surface-variant)}
      .operations > .content{overflow:auto;flex:1;min-height:0;padding:12px;gap:8px}
      .operations > [hidden]{display:none!important}
      .operations > guest-panel,.operations > source-panel,.operations > package-panel,.operations > tools-panel,.operations > authenticator-panel,.operations > companion-panel,.operations > regex-workbench,.operations > documentation-panel{flex:1;min-height:0;overflow:auto;padding:8px}
      .operations > package-panel{padding:16px 24px;box-sizing:border-box}
      .operations > md-tabs{min-height:38px;--md-primary-tab-container-height:38px}
      .panel{border-radius:0;padding:12px;background:transparent;border-bottom:1px solid var(--md-sys-color-outline-variant)}
      .operations {
        display: flex;
        flex-direction: column;
        gap: 0;
        flex:1;min-height:0;overflow:hidden;
      }
      md-tabs {
        --md-primary-tab-container-color: var(--md-sys-color-surface);
        flex-shrink: 0;
      }
      md-primary-tab {
        flex: 0 0 auto;
        min-width: max-content;
      }
      .content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .split {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .build-fields { align-items: start; }
      .build-fields > named-targets-panel { grid-column: 1 / -1; }
      .record {
        padding: 12px 0;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
      }
      .log {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        max-height: 360px;
        overflow: auto;
        padding: 16px;
        background: var(--md-sys-color-surface-container-high);
        border-radius: 12px;
        font: 13px/1.5 monospace;
      }
      .symbol {
        font-family: monospace;
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .config-row {
        display: grid;
        grid-template-columns: minmax(160px, 1fr) minmax(120px, 1fr);
        gap: 12px;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
      }
      .consent {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .message {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        padding: 12px;
        border-radius: 12px;
        background: var(--md-sys-color-surface-container);
      }
      .message strong {
        display: block;
        margin-bottom: 8px;
      }
      .status {
        border-radius: 12px;
      }
      md-primary-tab {
        min-width: 100px;
      }
      md-tabs {
        max-width: 100%;
        overflow: auto;
      }
      @media (max-width:1100px){.explorer{width:140px}.explorer md-text-button{font-size:11px}.dock-jobs{width:160px}}
      @media (max-width:750px){.explorer{display:none}}
      @media (max-width: 850px) {
        .split {
          grid-template-columns: 1fr;
        }
        .config-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];
  private l(en:string,zh:string,authored=false) {return localizedCopy(en,zh,this.language,authored);}
  private get api() {
    return (
      window.studio as unknown as {
        operations?: (request: Record<string, unknown>) => Promise<Reply>;
      }
    )?.operations;
  }
  private async run(action: string, fields: Record<string, unknown> = {}) {
    if (!this.api) {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Desktop operations are unavailable. Restart with a connected desktop host.",
        "未能使用桌面操作，請喺已連接嘅桌面主機重新啟動。",
      ));
      return undefined;
    }
    if (this.pending) return undefined;
    if(["config.apply","config.undo","config.defconfig"].includes(action))this.configurationGeneration++;
    this.pending = true;
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
    try {
      const reply = await this.api({ action, ...fields });
      if (!reply.ok) {
        this.feedback =
          captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Operation was not completed", "未完成操作") +
          `: ${reply.code}` +
          (reply.code === "PROJECT_NOT_ADOPTED"
            ? l(
                ". Choose the same project folders again to renew access before retrying.",
                "。請重新選擇相同專案資料夾，更新存取授權後再試。",
              )
            : ""));
        return undefined;
      }
      return reply.result;
    } catch {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Operation outcome unavailable. Refresh the relevant records before retrying.",
        "未能確認操作結果，請先重新整理相關記錄再試。",
      ));
      return undefined;
    } finally {
      this.pending = false;
    }
  }
  private async choosePython() {
    const result = await this.run("runtime.python.choose");
    if (result !== undefined)
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>result.available
        ? l(
            "Python admitted for Kconfig inspection",
            "已授權 Python 用於 Kconfig 檢視",
          ) + `: ${result.version}`
        : l("Python could not be admitted.", "未能授權 Python。"));
  }
  private configEntries() {
    if (!this.config?.semantics?.available)
      return (this.config?.entries ?? []).filter((entry: any) => entry.symbol);
    const entries: any[] = [];
    const seen = new Set<string>();
    const visit = (node: any, path: string[]) => {
      const next =
        node.kind === "menu" && node.prompt ? [...path, node.prompt] : path;
      if (node.symbol && !seen.has(node.symbol)) {
        seen.add(node.symbol);
        entries.push({
          ...node,
          menu: next.join(" / "),
          value: node.type === "bool" ? node.value === "y" : node.value,
        });
      }
      for (const child of node.children ?? []) visit(child, next);
    };
    visit(this.config.semantics.tree, []);
    return entries;
  }
  private async discover() {
    const result = await this.run("runtime.discover");
    if (result !== undefined) this.runtime = result;
  }
  private async prepareContainerStorage() {
    if (!this.workspace) return;
    const workspaceId = this.workspace.workspaceId;
    const image = this.image;
    const result = await this.run("runtime.docker.prepare", { workspaceId, runtime: { kind: "docker", image, uid: 1000, gid: 1000 } });
    if (result !== undefined && this.workspace?.workspaceId === workspaceId && this.image === image) this.containerStorage = result;
  }
  private containerRecovery(reason: string) {
    switch (reason) {
      case "ready": return this.l("Linux engine is available. Image compatibility and volume permissions are checked when the build starts.","Linux 引擎可用，建置開始時會檢查映像相容性同磁碟區權限。",true);
      case "client-unavailable": return this.l("Install the Docker CLI using its supported installer, then retry discovery.","請透過支援嘅安裝程式安裝 Docker CLI，再重新探索。",true);
      case "permission-denied": return this.l("Docker access was denied. Ask the runtime administrator to grant your account access, then retry. No elevation or permission change is performed here.","Docker 存取被拒絕。請執行環境管理員授予帳戶權限，再重試；此處唔會提升或更改權限。",true);
      case "linux-engine-required": return this.l("Select the Linux container engine in Docker, then retry discovery.","請喺 Docker 選擇 Linux 容器引擎，再重新探索。",true);
      default: return this.l("Start the intended Docker engine and check its selected context, then retry discovery. Existing volumes and containers are preserved.","請啟動指定 Docker 引擎並檢查所選環境，再重新探索；現有磁碟區同容器會保留。",true);
    }
  }
  private async choose() {
    const result = await this.run("project.choose");
    if (result !== undefined) {
      this.selection = result;
      this.trust = false;
    }
  }
  private async adopt() {
    if (!this.selection || !this.trust) return;
    const result = await this.run("project.adopt", {
      selectionId: this.selection.selectionId,
      trust: true,
    });
    if (result !== undefined) {
      if(!this.dispatchEvent(new CustomEvent('workspace-adopted',{bubbles:true,composed:true,cancelable:true,detail:result}))) { this.selection=undefined;this.trust=false;return; }
      this.workspace = result;
      this.configTrustPreview = undefined; this.configTrustAccepted = false;
      this.config = undefined;
      this.artifacts = [];
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Project adopted. Choose a runtime before requesting a build.",
        "專案已接入，要求建置前請先選擇執行環境。",
      ));
      this.tab = "builds";
    }
  }
  private async refreshJobs() {
    const result = await this.run("jobs.list");
    if (Array.isArray(result)) this.jobs = result;
  }
  private currentRuntime() {
    return this.runtimeKind === "wsl"
      ? { kind: "wsl", distribution: this.distribution }
      : { kind: "docker", image: this.image, uid: 1000, gid: 1000 };
  }
  private async selectRuntime() {
    if (!this.workspace) return;
    const result = await this.run("project.runtime", {
      workspaceId: this.workspace.workspaceId,
      runtime: this.currentRuntime(),
    });
    if (result !== undefined)
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Runtime selected for this project.",
        "已為呢個專案選擇執行環境。",
      ));
  }
  private validResources(){return !this.customResources||(Number.isSafeInteger(this.cpuSlots)&&this.cpuSlots>=(this.runtimeKind==="docker"?2:this.parallelism)&&this.cpuSlots<=64&&Number.isSafeInteger(this.memoryMiB)&&this.memoryMiB>=(this.runtimeKind==="docker"?4096:256)&&this.memoryMiB<=262144&&Number.isSafeInteger(this.storageGiB)&&this.storageGiB>=0&&this.storageGiB<=1024);}
  private async submit(event?:Event) {
    if (!this.workspace || !this.validResources() || this.pending || this.confirmingClean) return;
    const origin=event?.currentTarget instanceof HTMLElement?event.currentTarget:undefined;
    const runtime =
      this.runtimeKind === "wsl"
        ? { kind: "wsl", distribution: this.distribution }
        : { kind: "docker", image: this.image, uid: 1000, gid: 1000 };
    const input = {
      workspaceId: this.workspace.workspaceId,
      target: this.target,
      runtime,
      jobs: this.parallelism,
      ...(this.customResources?{resources:{cpuSlots:this.cpuSlots,memoryBytes:this.memoryMiB*1024**2,storageBytes:this.storageGiB*1024**3}}:{}),
    };
    let confirmationToken: string | undefined;
    if(input.target === "clean" || input.target.endsWith("-dirclean")) {
      this.confirmingClean=true;
      let challenge;
      try {
        challenge=await this.run("build.confirmation.challenge",{request:{action:"build.submit",...input}});
        if(!challenge)return;
        const proof=await requestDestructiveConfirmation(this,this.language,challenge,origin);
        if(!proof)return;
        if(this.workspace?.workspaceId!==input.workspaceId)return;
        const granted=await this.run("build.confirmation.confirm",proof);
        if(!granted)return;
        confirmationToken=granted.token;
      } finally {
        if(challenge)await this.api?.({action:"build.confirmation.cancel",id:challenge.id}).catch(()=>undefined);
        this.confirmingClean=false;
        await this.updateComplete;
        if(origin?.isConnected)origin.focus();
      }
    }
    const result = await this.run("build.submit", {...input,...(confirmationToken?{confirmationToken}:{})});
    if (result !== undefined) {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Build request accepted. Job records determine its outcome.",
        "建置要求已接受，結果以工作記錄為準。",
      ));
      await this.refreshJobs();
    }
    await this.updateComplete;
    if(origin?.isConnected)origin.focus();
  }
  private async jobAction(action: string, job: Job) {
    const result = await this.run("jobs." + action, {
      id: job.id,
      sequence: job.sequence,
    });
    if (result !== undefined) await this.refreshJobs();
  }
  private async readLogs(job: Job, more = false) {
    const result = await this.run("jobs.page", {
      id: job.id,
      after: more ? this.logCursor : 0,
      limit: 50,
    });
    if (result !== undefined) {
      this.selectedJob = job.id;
      this.logs = more
        ? [...this.logs, ...result.records].slice(-500)
        : result.records;
      this.logCursor = result.next;
      this.logMore = result.hasMore;
    }
  }
  private currentIsoPermission(context:IsoPermissionContext){return this.isoPermission===context&&context.panel.isConnected&&context.panel.workspaceId===context.workspaceId&&context.panel.permissionReviewCurrent(context.isoEpoch)&&this.workspace?.workspaceId===context.workspaceId&&this.configurationGeneration===context.generation&&this.configDomain==='buildroot'&&this.tab==='config';}
  private async reviewIsoPermission(event:CustomEvent<{workspaceId:string;epoch:number}>){
    const panel=event.currentTarget as import('./image-presets-panel').ImagePresetsPanel;
    if(this.pending||Object.keys(this.changes).length||event.detail?.workspaceId!==this.workspace?.workspaceId||!panel.permissionReviewCurrent(event.detail.epoch))return;
    this.configDomain='buildroot';this.tab='config';
    this.isoPermission={panel,workspaceId:event.detail.workspaceId,generation:this.configurationGeneration,isoEpoch:event.detail.epoch,status:'review'};
    const context=this.isoPermission;
    await this.updateComplete;
    if(!this.currentIsoPermission(context))return;
    await this.previewConfigTrust(true);
    await this.updateComplete;
    if(!this.currentIsoPermission(context))return;
    const section=this.renderRoot.querySelector<HTMLElement>('#source-execution-permission');section?.focus();section?.scrollIntoView({block:'start',behavior:'auto'});
  }
  private async returnToIso(recheck=false){
    const context=this.isoPermission;if(!context||!this.currentIsoPermission(context))return;
    await this.updateComplete;
    if(this.currentIsoPermission(context))await context.panel.returnFromPermission(context.isoEpoch,recheck);
  }
  private async previewConfigTrust(preserveIso=false) {
    if (!this.workspace||this.pending) return;
    if(!preserveIso)this.isoPermission=undefined;
    const epoch=++this.configTrustEpoch;
    this.configTrustAccepted = false;
    this.configTrustPreview = undefined;
    const workspaceId = this.workspace.workspaceId, domain = this.configDomain;
    const result = await this.run("config.trustPreview", { workspaceId, domain });
    if(epoch!==this.configTrustEpoch||this.workspace?.workspaceId!==workspaceId||this.configDomain!==domain)return;
    if(result!==undefined)this.configTrustPreview=result;
    else if(preserveIso)this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Permission review is unavailable. Check project runtime access in Projects & runtime, then review again. No permission was granted and ISO compatibility remains unconfirmed.','未能核對權限。請喺「專案同執行環境」檢查專案環境存取，再重新核對。未有授權，ISO 相容性仍未確認。'));
  }
  private async grantConfigTrust() {
    if (!this.workspace || !this.configTrustPreview || !this.configTrustAccepted||this.pending) return;
    const preview=this.configTrustPreview,workspaceId=this.workspace.workspaceId,domain=this.configDomain,epoch=this.configTrustEpoch,context=this.isoPermission;
    const result = await this.run("config.trustGrant", { workspaceId, domain:preview.domain, challengeId: preview.id, trusted: true });
    if(epoch!==this.configTrustEpoch||this.workspace?.workspaceId!==workspaceId||this.configDomain!==domain||this.configTrustPreview!==preview)return;
    const discoveryOnly = preview.discoveryOnly;
    this.configTrustAccepted = false;
    this.configTrustPreview = undefined;
    if (result?.trusted===true&&result.domain===preview.domain) {
      if(context){if(this.currentIsoPermission(context)&&result.domain==='buildroot'&&!discoveryOnly){this.isoPermission={...context,status:'approved'};await this.returnToIso(true);}return;}
      if (discoveryOnly) await this.previewConfigTrust();
      else await this.inspectConfig();
    }else if(context&&this.currentIsoPermission(context))this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Permission was not confirmed. It may have expired, changed or been declined. Review the current scope again; ISO compatibility has not been checked again.','未能確認權限，可能已過期、有變更或未獲批准。請重新核對目前範圍；尚未重新檢查 ISO 相容性。'));
  }
  private async revokeConfigTrust() {
    if (!this.workspace) return;
    this.configTrustEpoch++;this.isoPermission=undefined;this.configurationGeneration++;
    await this.run("config.trustRevoke", { workspaceId: this.workspace.workspaceId, domain:this.configDomain });
    this.configTrustPreview = undefined; this.configTrustAccepted = false; this.config = undefined; this.changes = {};
  }
  private async inspectConfig() {
    if (!this.workspace) return;
    const result = await this.run("config.inspect", {
      workspaceId: this.workspace.workspaceId,
      domain: this.configDomain,
    });
    if (result !== undefined) {
      this.config = result;
      this.changes = {};
      this.configPage = 0;
    }
  }
  private async applyConfig() {
    if (!this.config || !Object.keys(this.changes).length) return;
    const result = await this.run("config.apply", {
      workspaceId: this.workspace.workspaceId,
      domain: this.configDomain,
      revision: this.config.revision,
      changes: this.changes,
    });
    if (result !== undefined) {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Configuration reconciled. Inspect effective values before building.",
        "設定已協調完成，建置前請檢視實際值。",
      ));
      await this.inspectConfig();
    }
  }
  private async listDefconfigs() {
    const result = await this.run("config.defconfigs", {
      workspaceId: this.workspace.workspaceId,
      domain: this.configDomain,
    });
    if (Array.isArray(result)) this.defconfigs = result;
  }
  private async applyDefconfig(path: string) {
    if (!this.config) return;
    const result = await this.run("config.defconfig", {
      workspaceId: this.workspace.workspaceId,
      domain: this.configDomain,
      revision: this.config.revision,
      path,
    });
    if (result !== undefined) await this.inspectConfig();
  }
  private async undoConfig() {
    const result = await this.run("config.undo", {
      workspaceId: this.workspace.workspaceId,
      domain: this.configDomain,
      revision: this.config.revision,
    });
    if (result !== undefined) await this.inspectConfig();
  }
  private async listArtifacts() {
    const result = await this.run("artifacts.list", {
      workspaceId: this.workspace.workspaceId,
    });
    if (Array.isArray(result)) this.artifacts = result;
  }
  private async inspectArtifact(path: string) {
    const result = await this.run("artifacts.inspect", {
      workspaceId: this.workspace.workspaceId,
      path,
    });
    if (result !== undefined) this.artifact = result;
  }
  private async loadModels() {
    const result = await this.run("tools", {
      request: { action: "ollama.tags" },
    });
    if (result !== undefined) {
      this.models = result.models ?? [];
      this.model = this.models[0]?.name ?? "";
    }
  }
  private async sendMessage() {
    if (!this.prompt.trim() || !this.model) return;
    const conversation = [
      ...this.messages,
      { role: "user" as const, content: this.prompt.trim() },
    ];
    const result = await this.run("tools", {
      request: {
        action: "ollama.chat",
        model: this.model,
        messages: conversation,
      },
    });
    if (result !== undefined) {
      this.messages = conversation;
      const content = result.message?.content ?? result.content;
      if (typeof content === "string")
        this.messages = [...this.messages, { role: "assistant", content }];
      else
        this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
          "The local model request completed without a displayable response.",
          "本機模型要求已完成，但未有可顯示嘅回覆。",
        ));
      this.prompt = "";
    }
  }
  private async updateAction(action: string) {
    const result = await this.run("updates." + action);
    if (result !== undefined) this.updateState = result;
  }
  private options(items: [string, string][]) {
    return items.map(
      ([value, label]) =>
        html`<md-select-option value=${value}
          ><div slot="headline">${label}</div></md-select-option
        >`,
    );
  }
  private label(tab: string) {
    const labels: Record<string, [string, string]> = {
      runtime: ["Projects & runtime", "專案同執行環境"],
      builds: ["Builds", "建置"],
      config: ["Configuration", "設定選項"],
      artifacts: ["Artifacts", "輸出檔案"],
      assistant: ["Local assistant", "本機助理"],
      updates: ["Updates", "更新"],
      regex: ["Regex workbench", "正規表達式"],
      source: ["Source", "來源"],
      package: ["Package authoring", "套件編寫"],
      tools: ["Tools", "工具"],
      authenticator: ["Authenticator", "驗證器"],
      companion: ["Browser companion", "瀏覽器配對"],
      documentation: ["Help & documentation", "說明同文件"],
      guests: ["Virtual machines", "虛擬機"],
    };
    return this.l(...labels[tab]);
  }
  private noProject() {
    return html`<section class="panel">
      <h2>${this.l("Adopt a project first","請先接入專案",true)}</h2>
      <p>
        ${this.l("Choose an existing trusted Buildroot source and a separate output directory in Projects & runtime.","請喺專案同執行環境揀選現有可信嘅 Buildroot 來源同獨立輸出目錄。",true)}
      </p>
      <md-filled-button @click=${() => (this.tab = "runtime")}
        >${actionIcon('Choose project')}${this.l("Choose project","選擇專案",true)}</md-filled-button
      >
    </section>`;
  }
  private runtimeView() {
    return html`<div class="split">
      <project-workflow-panel .language=${this.language} .workspaceId=${this.workspace?.workspaceId || ""}
        @project-opened=${(event: CustomEvent) => {
          if (!this.dispatchEvent(new CustomEvent("workspace-adopted", { bubbles: true, composed: true, cancelable: true, detail: event.detail }))) return;
          this.workspace = event.detail;
          this.config = undefined; this.artifacts = []; this.artifact = undefined; this.changes = {};
          this.configTrustPreview = undefined; this.configTrustAccepted = false;
          const runtime = event.detail.runtime;
          this.runtimeKind = "docker"; this.image = ""; this.distribution = "";
          if (runtime?.kind === "wsl") { this.runtimeKind = "wsl"; this.distribution = runtime.distribution; }
          if (runtime?.kind === "docker") { this.runtimeKind = "docker"; this.image = runtime.image; }
        }}></project-workflow-panel>
      <section class="panel stack">
        <remote-runtime-panel .language=${this.language} .workspaceId=${this.workspace?.workspaceId||""}></remote-runtime-panel>
        <wsl-runtime-panel .language=${this.language} @wsl-project-adopted=${(event:CustomEvent) => { if(!this.dispatchEvent(new CustomEvent("workspace-adopted",{detail:event.detail,bubbles:true,composed:true,cancelable:true})))return; this.workspace=event.detail; this.runtimeKind="wsl"; this.distribution=event.detail.distribution; this.config=undefined; this.artifacts=[]; this.tab="builds"; }}></wsl-runtime-panel>
        <execution-setup-panel .language=${this.language}></execution-setup-panel>
        <execution-setup-panel .product=${true} .language=${this.language}></execution-setup-panel>
        <h2>${this.l("Runtime discovery","探索執行環境",true)}</h2>
        <p>
          ${this.l("Inspect installed WSL distributions and Docker availability. Discovery does not install or start a runtime.","檢視已安裝嘅 WSL 發行版同 Docker 可用狀態，探索唔會安裝或啟動執行環境。",true)}
        </p>
        <md-outlined-button ?disabled=${this.pending} @click=${this.discover}
          >${actionIcon('Discover runtimes')}${this.l("Discover runtimes","探索執行環境",true)}</md-outlined-button
        >
        <p>
          ${this.l("Kconfig inspection executes a Python interpreter you select. Choose only an interpreter you trust.","Kconfig 檢視會執行你揀選嘅 Python 解譯器，請只揀選可信嘅解譯器。",true)}
        </p>
        <md-outlined-button
          ?disabled=${this.pending}
          @click=${this.choosePython}
          >${actionIcon('Choose trusted Python')}${this.l("Choose trusted Python","揀選可信 Python",true)}</md-outlined-button
        >${this.runtime
          ? html`<dl>
              <dt>Docker</dt>
              <dd>
                ${this.runtime.docker?.available
                  ? this.l("Available","可使用",true)
                  : this.l("Unavailable","未能使用",true)}
              </dd>
              <dd role="status">${this.containerRecovery(this.runtime.docker?.reason)}</dd>
              <dt>WSL</dt>
              <dd>
                ${(this.runtime.wsl?.distributions ?? []).map(
                  (d: any) =>
                    html`<p>
                      ${typeof d === "string" ? d : d.name} ${d.version ?? ""}
                    </p>`,
                )}
              </dd>
            </dl>`
          : nothing}
      </section>
      <section class="panel stack">
        <h2>${this.l("Existing Buildroot project","現有 Buildroot 專案",true)}</h2>
        <p>
          ${this.l("The native picker grants access to the source and output directories you choose. Existing files are preserved during adoption.","原生選擇器會授權存取你揀選嘅來源同輸出目錄，接入專案時會保留現有檔案。",true)}
        </p>
        <md-filled-button ?disabled=${this.pending} @click=${this.choose}
          >${actionIcon('Choose source and output')}${this.l("Choose source and output","選擇來源同輸出",true)}</md-filled-button
        >${this.selection
          ? html`<dl>
                <dt>${this.l("Project","專案",true)}</dt>
                <dd>${this.selection.name}</dd>
                <dt>${this.l("Source","來源",true)}</dt>
                <dd>${this.selection.source}</dd>
                <dt>${this.l("Output","輸出",true)}</dt>
                <dd>${this.selection.output}</dd>
              </dl>
              <label class="consent"
                ><md-checkbox
                  aria-label=${this.l("I trust this source. Build steps execute code from it.","我信任呢個來源，建置步驟會執行當中嘅程式碼。",true)}
                  .checked=${this.trust}
                  @change=${(e: Event) =>
                    (this.trust = (e.target as HTMLInputElement).checked)}
                ></md-checkbox
                ><span
                  >${this.l("I trust this source. Build steps execute code from it.","我信任呢個來源，建置步驟會執行當中嘅程式碼。",true)}</span
                ></label
              ><md-filled-tonal-button
                ?disabled=${this.pending || !this.trust}
                @click=${this.adopt}
                >${actionIcon('Adopt trusted project')}${this.l("Adopt trusted project","接入可信專案",true)}</md-filled-tonal-button
              >`
          : nothing}${this.workspace
          ? html`<p class="badge">
              ${this.l("Active project","目前專案",true)}: ${this.workspace.name}
            </p>`
          : nothing}
      </section>
    </div>`;
  }
  private buildsView() {
    return html`${this.workspace
        ? html`<section class="panel stack">
            <h2>${this.workspace.name}</h2>
            ${this.runtimeKind === "docker" ? html`<section class="panel stack" aria-label=${this.l("Container storage","容器儲存",true)}>
              <h3>${this.l("Managed download cache","受管理下載快取",true)}</h3>
              <md-outlined-button ?disabled=${this.pending} @click=${this.discover}>${this.l("Refresh local images and engine","重新整理本機映像同引擎",true)}</md-outlined-button>
              ${this.runtime?.docker ? html`<p role="status">${this.containerRecovery(this.runtime.docker.reason)}</p><md-outlined-select label=${this.l("Installed digest-pinned image","已安裝固定摘要映像",true)} .value=${this.image} @change=${(e: Event) => { this.image = (e.target as HTMLSelectElement).value; this.containerStorage = undefined; }}>${this.options((this.runtime.docker.images ?? []).map((value: string) => [value, value]))}</md-outlined-select>` : nothing}
              <p>${this.l("Prepare a retained cache volume for this project, image and UID/GID 1000. No image is downloaded. The image must contain /material-buildroot-cache writable by UID/GID 1000 so Docker can initialize its volume without a root helper. Existing cache data is never deleted or repaired automatically.","為此專案、映像同 UID/GID 1000 準備保留快取磁碟區，唔會下載映像。映像必須有 UID/GID 1000 可寫入嘅 /material-buildroot-cache，讓 Docker 毋須 root 輔助程序初始化磁碟區。現有快取唔會自動刪除或修復。",true)}</p>
              <md-outlined-button ?disabled=${this.pending || !/^[a-z0-9][a-z0-9./:_-]*@sha256:[0-9a-f]{64}$/.test(this.image)} @click=${this.prepareContainerStorage}>${this.l("Prepare retained cache","準備保留快取",true)}</md-outlined-button>
              ${this.containerStorage ? html`<p role="status">${this.containerStorage.name}: ${this.l("Prepared. Write permissions remain unverified until execution.","已準備；寫入權限仍待執行時驗證。",true)}</p>` : nothing}
              <p>${this.l("If storage access fails, preserve the existing volume and correct the image directory ownership or output-folder permissions through your administrator. Retry preparation and then the failed job. Cancellation stops only an ownership-verified container; uncertain cleanup remains quarantined until job reconciliation proves it stopped.","如果儲存存取失敗，請保留現有磁碟區，經管理員修正映像目錄擁有權或輸出資料夾權限，再重新準備同重試工作。取消只會停止已確認擁有權嘅容器；未確認清理會繼續隔離，直到工作復核證明已停止。",true)}</p>
            </section>` : nothing}
            <div class="fields build-fields">
              <md-outlined-select
                label=${this.l("Runtime","執行環境",true)}
                id="build-runtime"
                .value=${this.runtimeKind}
                .displayText=${this.runtimeKind === "wsl" ? "WSL 2" : "Docker"}
                @change=${(e: Event) =>
                  (this.runtimeKind = (e.target as HTMLSelectElement).value)}
                >${this.options([
                  ["docker", "Docker"],
                  ["wsl", "WSL 2"],
                ])}</md-outlined-select
              >${this.runtimeKind === "wsl"
                ? html`<md-outlined-text-field
                    label=${this.l("WSL distribution","WSL 發行版",true)}
                    .value=${this.distribution}
                    @input=${(e: Event) =>
                      (this.distribution = (
                        e.composedPath()[0] as HTMLInputElement
                      ).value)}
                  ></md-outlined-text-field>`
                : html`<md-outlined-text-field
                    label=${this.l("Container image with SHA-256 digest","包含 SHA-256 摘要嘅容器映像",true)}
                    .value=${this.image}
                    @input=${(e: Event) =>
                      { this.image = (e.composedPath()[0] as HTMLInputElement).value; this.containerStorage = undefined; }}
                  ></md-outlined-text-field>`}<named-targets-panel .language=${this.language} .workspaceId=${this.workspace.workspaceId} .target=${this.target} @named-target-change=${(e:CustomEvent)=>{this.target=e.detail.target;}}></named-targets-panel><md-outlined-text-field
                type="number"
                min="1"
                max="32"
                label=${this.l("Parallel jobs","並行工作數",true)}
                .value=${String(this.parallelism)}
                @input=${(e: Event) =>
                  (this.parallelism = Number(
                    (e.composedPath()[0] as HTMLInputElement).value,
                  ))}
              ></md-outlined-text-field>
            </div>
            <p>
              ${this.l("The build runs trusted project code and writes to its chosen output directory. Docker runs as UID/GID 1000.","建置會執行可信專案程式碼，並寫入所選輸出目錄。Docker 會以 UID/GID 1000 執行。",true)}
            </p>
            <label class="row"><md-checkbox aria-label=${this.l("Customize build reservations","自訂建置預留",true)} ?checked=${this.customResources} @change=${(e:Event)=>this.customResources=(e.target as HTMLInputElement).checked}></md-checkbox>${this.l("Customize build reservations","自訂建置預留",true)}</label>
            ${this.customResources?html`<div class="row">${([['CPU slots','CPU 配額','cpuSlots',this.runtimeKind==='docker'?2:this.parallelism,64],['Memory reservation (MiB)','記憶體預留（MiB）','memoryMiB',this.runtimeKind==='docker'?4096:256,262144],['Free storage floor (GiB)','可用儲存空間下限（GiB）','storageGiB',0,1024]] as const).map(([en,zh,key,min,max])=>html`<md-outlined-text-field type="number" .label=${this.l(en,zh)} .value=${String(this[key])} min=${String(min)} max=${String(max)} @input=${(e:Event)=>this[key]=(e.target as HTMLInputElement).value.trim()===""?NaN:Number((e.target as HTMLInputElement).value)}></md-outlined-text-field>`)}</div>`:nothing}
            <p>${this.l("Defaults reserve at least 2 CPU slots (or WSL parallel jobs), 4 GiB RAM and an 8 GiB free-storage floor. Docker keeps its fixed 2 CPU / 4 GiB execution envelope; reservations do not expand it. Queued source/configuration intent cannot be edited.","預設預留至少 2 個 CPU 配額（或 WSL 並行工作數）、4 GiB 記憶體及 8 GiB 可用儲存空間下限。Docker 保持固定 2 CPU／4 GiB 執行範圍，預留唔會擴大範圍。佇列中來源／設定意圖不可編輯。",true)}</p>
            <md-outlined-button
              ?disabled=${this.pending ||
              (this.runtimeKind === "wsl"
                ? !this.distribution
                : !/^.+@sha256:[a-f0-9]{64}$/.test(this.image))}
              @click=${this.selectRuntime}
              >${actionIcon('Use runtime for configuration')}${this.l("Use runtime for configuration","設定使用呢個執行環境",true)}</md-outlined-button
            ><md-filled-button
              ?disabled=${this.pending ||
              !this.validResources() ||
              !Number.isInteger(this.parallelism) ||
              this.parallelism < 1 ||
              this.parallelism > 32 ||
              (this.runtimeKind === "wsl"
                ? !this.distribution
                : !/^.+@sha256:[a-f0-9]{64}$/.test(this.image))}
              @click=${this.submit}
              >${actionIcon('Start build')}${this.l("Start build","開始建置",true)}</md-filled-button
            >
          </section>`
        : this.noProject()}
      <section class="panel"><build-queue-panel .language=${this.language} .workspaceId=${this.workspace?.workspaceId||""} @queue-updated=${()=>this.refreshJobs()} @renew-project-access=${()=>{this.tab="runtime";void this.choose();}}></build-queue-panel></section>
      <section class="panel">
        <div class="row">
          <h2>${this.l("Build jobs","建置工作",true)}</h2>
          <md-text-button ?disabled=${this.pending} @click=${this.refreshJobs}
            >${actionIcon('Refresh')}${this.l("Refresh","重新整理",true)}</md-text-button
          >
        </div>
        ${this.jobs.length
          ? this.jobs.map(
              (job) =>
                html`<div class="record">
                  <strong>${job.kind}</strong>
                  <span class="badge">${job.state}</span>
                  <p class="muted">${job.id}</p>
                  ${job.payload?html`<p>${this.l("Captured intent","已擷取意圖",true)}: ${job.payload.target} · ${job.payload.jobs} ${this.l("parallel jobs","並行工作",true)}</p><p>${this.l("Source revision","來源版本",true)}: ${job.payload.intent?.sourceRevision||this.l("Unknown","未知",true)}</p><p>${this.l("Configuration revision","設定版本",true)}: ${job.payload.intent?.configRevision||this.l("Unknown","未知",true)}</p>${job.payload.resources?html`<p>${job.payload.resources.cpuSlots} CPU · ${job.payload.resources.memoryBytes/1024**2} MiB · ${job.payload.resources.storageBytes/1024**3} GiB</p>`:nothing}`:nothing}
                  ${job.state==='interrupted'?html`<p>${this.l("Interrupted is not proof of stopped runtime or successful cleanup. Inspect queue recovery before a new attempt.","中斷唔代表執行環境已停止或清理成功，新增嘗試前請檢視佇列復原。",true)}</p>`:nothing}
                  <div class="row">
                    <md-text-button
                      ?disabled=${this.pending}
                      @click=${() => this.readLogs(job)}
                      >${actionIcon('Read logs')}${this.l("Read logs","檢視記錄",true)}</md-text-button
                    >${["queued", "running"].includes(job.state)
                      ? html`<md-outlined-button
                          ?disabled=${this.pending}
                          @click=${() => this.jobAction("cancel", job)}
                          >${actionIcon('Request cancellation')}${this.l("Request cancellation","要求取消",true)}</md-outlined-button
                        >`
                      : nothing}${[
                      "failed",
                      "interrupted",
                      "cancelled",
                    ].includes(job.state)
                      ? html`<md-outlined-button
                          ?disabled=${this.pending}
                          @click=${() => this.jobAction("retry", job)}
                          >${actionIcon('New attempt')}${this.l("New attempt","新增嘗試",true)}</md-outlined-button
                        >`
                      : nothing}
                  </div>
                </div>`,
            )
          : html`<p>
              ${this.l("Refresh to load recorded jobs. No success is inferred from an empty list.","重新整理以載入工作記錄，空白清單唔代表建置成功。",true)}
            </p>`}${this.selectedJob
          ? html`<h3>${this.l("Job logs","工作記錄",true)}</h3>
              <div
                class="log"
                role="region"
                tabindex="0"
                aria-label=${this.l("Job logs","工作記錄",true)}
              >
                ${this.logs.map(
                  (record) =>
                    html`<div>
                      ${typeof record.value === "string"
                        ? record.value
                        : (record.value?.text ??
                          record.value?.message ??
                          this.l("Structured job event","結構化工作事件",true))}
                    </div>`,
                )}
              </div>
              ${this.logMore
                ? html`<md-text-button
                    @click=${() => {
                      const job = this.jobs.find(
                        (j) => j.id === this.selectedJob,
                      );
                      if (job) void this.readLogs(job, true);
                    }}
                    >${actionIcon('Load next records')}${this.l("Load next records","載入下一批記錄",true)}</md-text-button
                  >`
                : nothing}`
          : nothing}
      </section>`;
  }
  private async openIsoHelp(event:CustomEvent<{title:string}>) {
    const titles=['ISO profile and firmware','ISO runtime and resources','ISO configuration and recovery','ISO output and validation'];
    if(!titles.includes(event.detail?.title))return;
    const index=await this.run('documentation.list');
    const article=index?.articles?.find((item:any)=>item.title===event.detail.title);
    if(!article){this.feedback=this.l('This field guide is not available in the bundled documentation.','內附文件未提供呢份欄位指南。',true);return;}
    this.tab='documentation';await this.updateComplete;
    const panel=this.renderRoot.querySelector('documentation-panel') as import('./documentation-panel').DocumentationPanel|null;
    await panel?.openArticle(article.id);
  }
  private configView() {
    if (!this.workspace) return this.noProject();
    const entries = this.configEntries();
    return html`<image-presets-panel @review-iso-permission=${this.reviewIsoPermission} .configurationGeneration=${this.configurationGeneration} @open-documentation=${this.openIsoHelp} .disabled=${this.pending || !!Object.keys(this.changes).length} .workspaceId=${this.workspace.workspaceId} .language=${this.language} @configuration-changed=${() => { this.config=undefined; }}></image-presets-panel><account-provisioning-panel .disabled=${this.pending || !!Object.keys(this.changes).length} .workspaceId=${this.workspace.workspaceId} .language=${this.language} @configuration-changed=${() => { this.config=undefined;this.configurationGeneration++; }}></account-provisioning-panel><defconfig-panel @configuration-changed=${() => {this.config=undefined;this.configurationGeneration++;}} .workspaceId=${this.workspace.workspaceId} .language=${this.language}></defconfig-panel><section class="panel stack">
      <div class="row">
        <h2>${this.l("Configuration domain","設定範圍",true)}</h2>
        <md-outlined-select .label=${this.l("Domain","範圍",true)} .value=${this.configDomain} ?disabled=${this.pending || !!Object.keys(this.changes).length} @change=${(event: Event) => { this.configDomain = (event.target as HTMLSelectElement).value; this.configTrustPreview = undefined; this.configTrustAccepted = false; this.config = undefined; this.changes = {}; this.defconfigs = []; this.configPage = 0; }}>
          ${this.options([["buildroot", "Buildroot"], ["linux", "Linux"], ["busybox", "BusyBox"], ["uboot", "U-Boot"]])}
        </md-outlined-select>
        <md-outlined-button
          ?disabled=${this.pending || !!Object.keys(this.changes).length}
          @click=${this.inspectConfig}
          >${actionIcon('Inspect configuration')}${this.l("Inspect configuration","檢視設定",true)}</md-outlined-button
        ><md-text-button ?disabled=${this.pending} @click=${this.listDefconfigs}
          >${actionIcon('List defconfigs')}${this.l("List defconfigs","列出預設設定",true)}</md-text-button
        >
      </div>
      <p>${this.l("Authoritative inspection can execute commands from the selected Make/Kconfig sources. Review the exact source and runtime before allowing it. WSL commands have your distribution account's access; the container route has read-only source mounts and no network. Configuration apply uses the admitted writable build route.","權威檢視可以執行所選 Make／Kconfig 來源入面嘅指令。批准前請核對確切來源同執行環境。WSL 指令具有發行版帳戶嘅存取權；容器路線使用唯讀來源掛載同停用網絡。套用設定會使用已授權嘅可寫建置路線。",true)}</p>
      <div class="row">
        <md-outlined-button ?disabled=${this.pending} @click=${()=>this.previewConfigTrust()}>${this.l("Review source execution permission","核對來源執行權限",true)}</md-outlined-button>
        <md-text-button ?disabled=${this.pending} @click=${this.revokeConfigTrust}>${this.l("Revoke configuration permission","撤銷設定權限",true)}</md-text-button>
      </div>
      ${this.configTrustPreview||this.isoPermission ? html`<section id="source-execution-permission" tabindex="-1" class="panel stack" aria-label=${this.l("Source execution permission","來源執行權限",true)}>
        ${this.isoPermission?html`<p role="status">${this.isoPermission.status==='approved'?this.l("This scope was approved. ISO compatibility is checked separately in the guide; approval does not configure or build an image.","已批准此範圍。指南會另行檢查 ISO 相容性；批准唔代表已設定或建立映像。",true):this.l("Review this exact scope for the ISO guide. You can return without granting permission.","請為 ISO 指南核對此確切範圍。你可以唔授權而返回。",true)}</p><md-outlined-button ?disabled=${this.pending} @click=${()=>this.returnToIso()}>${materialIcon('arrow_back','icon')}${this.l("Return to ISO guide","返回 ISO 指南",true)}</md-outlined-button>${!this.configTrustPreview?html`<md-outlined-button ?disabled=${this.pending} @click=${()=>this.previewConfigTrust(true)}>${this.l("Review current scope again","重新核對目前範圍",true)}</md-outlined-button>`:nothing}`:nothing}
        ${this.configTrustPreview?html`
        <h3>${this.configTrustPreview.domain} · ${this.l("Review exact scope","核對確切範圍",true)}</h3>
        <p>${this.configTrustPreview.discoveryOnly ? this.l("First allow this Buildroot revision to discover the selected component. A second review will name that component's actual source.","先批准呢個 Buildroot 修訂以尋找所選元件。第二次核對會列出該元件嘅實際來源。",true) : this.l("Permission lasts up to 15 minutes in this session and expires when source, configuration, roots or runtime change.","權限只喺本次工作階段維持最多 15 分鐘；來源、設定、目錄或執行環境一改就失效。",true)}</p>
        <dl><dt>${this.l("Source","來源",true)}</dt><dd class="symbol">${this.configTrustPreview.sourceRoot}</dd>
        <dt>${this.l("Output","輸出",true)}</dt><dd class="symbol">${this.configTrustPreview.outputRoot}</dd>
        <dt>${this.l("Runtime","執行環境",true)}</dt><dd class="symbol">${JSON.stringify(this.configTrustPreview.runtime)}</dd>
        <dt>${this.l("Source revision","來源修訂",true)}</dt><dd class="symbol">${this.configTrustPreview.sourceRevision}</dd>
        <dt>${this.l("Configuration revision","設定修訂",true)}</dt><dd class="symbol">${this.configTrustPreview.configRevision}</dd>
        <dt>${this.l("External sources","外部來源",true)}</dt><dd class="symbol">${this.configTrustPreview.externalRoots.join(" · ") || this.l("None","無",true)}</dd></dl>
        <label class="row"><md-checkbox aria-label=${this.l("Allow execution of this exact source revision in this runtime for configuration inspection and reconciliation.","批准喺呢個執行環境執行呢個確切來源修訂，用作檢視同協調設定。",true)} ?disabled=${this.pending} .checked=${this.configTrustAccepted} @change=${(event: Event) => this.configTrustAccepted = (event.target as any).checked}></md-checkbox>${this.l("Allow execution of this exact source revision in this runtime for configuration inspection and reconciliation.","批准喺呢個執行環境執行呢個確切來源修訂，用作檢視同協調設定。",true)}</label>
        <md-filled-button ?disabled=${this.pending || !this.configTrustAccepted} @click=${this.grantConfigTrust}>${this.l("Allow this scope","批准此範圍",true)}</md-filled-button>
        `:nothing}
      </section>` : nothing}
      ${this.config
        ? html`<p class="notice">
              ${this.config.semantics?.available
                ? this.l("Kconfig menus, effective values, dependencies and help are provided by the admitted parser. Changes are reconciled by the selected runtime.","已授權解析器提供 Kconfig 選單、實際值、相依關係同說明，變更會由所選執行環境協調。",true)
                : this.l("Full Kconfig semantics are unavailable. Review source execution permission for authoritative inspection, or choose a trusted Python interpreter for limited read-only inspection.","未能使用完整 Kconfig 語意。請核對來源執行權限以作權威檢視，或選擇可信 Python 解譯器作有限唯讀檢視。",true) +
                  " " +
                  (this.config.semantics?.reason ?? "")}
            </p>
            <configuration-panel .config=${this.config} .api=${this.api} .language=${this.language} .workspaceId=${this.workspace.workspaceId} .domain=${this.configDomain}
              @configuration-queue=${(event: CustomEvent) => { if(event.detail.pending)this.configurationGeneration++;this.pending=event.detail.pending; this.changes=event.detail.blocked ? {__retained:{type:'raw',value:true}} : {}; }}
              @configuration-result=${(event: CustomEvent) => { this.config=event.detail;this.configurationGeneration++; }}></configuration-panel>`
        : html`<p>
            ${this.l("Inspect the active output configuration before editing.","編輯之前，請先檢視目前輸出設定。",true)}
          </p>`}${this.defconfigs.length
        ? html`<h3>${this.l("Available defconfigs","可用預設設定",true)}</h3>
            <p>
              ${this.l("Applying a defconfig replaces the current configuration and reconciles it.","套用預設設定會取代目前設定，並進行協調。",true)}
            </p>
            ${this.defconfigs
              .slice(0, 100)
              .map(
                (item) =>
                  html`<div class="row">
                    <span class="symbol">${item.name}</span
                    ><md-outlined-button
                      ?disabled=${this.pending ||
                      !this.config ||
                      !!Object.keys(this.changes).length}
                      @click=${() => this.applyDefconfig(item.path)}
                      >${actionIcon('Apply')}${this.l("Apply","套用",true)}</md-outlined-button
                    >
                  </div>`,
              )}${this.defconfigs.length > 100
              ? html`<p>
                  ${this.l("Showing the first 100 entries.","顯示首 100 項。",true)}
                </p>`
              : nothing}`
        : nothing}
    </section>`;
  }
  private artifactsView() {
    if (!this.workspace) return this.noProject();
    return html`<artifact-viewers .workspaceId=${this.workspace.workspaceId} .language=${this.language}></artifact-viewers>`;
  }
  private assistantView() {
    return html`<section class="panel"><ollama-workspace-panel .language=${this.language}></ollama-workspace-panel></section>`;
  }
  private updatesView() {
    return html`<section class="panel"><update-panel .language=${this.language}></update-panel><p>${this.l("Use the persistent update banner to restart after saving work.","儲存工作後，請使用持續顯示嘅更新提示重新啟動程式。",true)}</p></section>`;
  }  private resizeDock(event: PointerEvent) {
    const separator = event.currentTarget as HTMLElement;
    const start = event.clientY, original = this.dockHeight;
    separator.setPointerCapture(event.pointerId);
    const move = (e:PointerEvent) => this.dockHeight = Math.max(80,Math.min(400,original+start-e.clientY));
    const end = () => { separator.removeEventListener("pointermove",move); separator.removeEventListener("pointerup",end); separator.removeEventListener("pointercancel",end); };
    separator.addEventListener("pointermove",move); separator.addEventListener("pointerup",end); separator.addEventListener("pointercancel",end);
  }
  render() {
    return html`<div class="ide"><aside class="explorer" aria-label=${this.l("Project explorer","專案總管",true)}><h2>${this.l("Explorer","總管",true)}</h2><div class="project-name">${this.workspace?.name||this.l("No adopted project","未接入專案",true)}</div>${["runtime","source","config","package","builds","artifacts","guests","tools","assistant","regex","companion","authenticator","updates","documentation"].map(tab=>html`<md-text-button title=${this.label(tab)} class=${this.tab===tab?"active":""} aria-current=${this.tab===tab?"page":"false"} @click=${()=>this.tab=tab}> ${materialIcon(({runtime:"computer",source:"code",config:"tune",package:"inventory_2",builds:"build",artifacts:"folder_open",guests:"memory",tools:"build",assistant:"help_outline",regex:"code",companion:"link",authenticator:"key",updates:"download",documentation:"help_outline"} as Record<string,string>)[tab],"icon")}${this.label(tab)}</md-text-button>`)}</aside><div class="editor-frame"><div class="document-toolbar"><strong>${this.label(this.tab)}</strong><span>${this.workspace?this.l("Trusted project","可信專案",true):this.l("No execution context","無執行內容",true)}</span><md-text-button @click=${()=>this.dockOpen=!this.dockOpen}>${this.dockOpen?this.l("Hide jobs","隱藏工作",true):this.l("Show jobs","顯示工作",true)}</md-text-button></div><div class="operations">
      <md-tabs
        aria-label=${this.l("Project operations","專案操作",true)}
        .activeTabIndex=${[
          "runtime",
          "source",
          "package",
          "builds",
          "config",
          "artifacts",
          "guests",
          "assistant",
          "updates",
          "regex",
          "tools",
          "authenticator",
          "companion",
          "documentation",
        ].indexOf(this.tab)}
        @change=${(e: Event) => {
          const index = (e.target as any).activeTabIndex;
          this.tab =
            [
              "runtime",
          "source",
          "package",
              "builds",
              "config",
              "artifacts",
              "guests",
              "assistant",
              "updates",
              "regex",
              "tools",
              "authenticator",
          "companion",
          "documentation",
            ][index] ?? "runtime";
        }}
        >${[
          "runtime",
          "source",
          "package",
          "builds",
          "config",
          "artifacts",
          "guests",
          "assistant",
          "updates",
          "regex",
          "tools",
          "authenticator",
          "companion",
          "documentation",
        ].map(
          (tab) =>
            html`<md-primary-tab
              role="tab"
              aria-label=${this.label(tab)}
              id=${"operation-tab-" + tab}
              aria-controls="operation-content"
              >${this.label(tab)}</md-primary-tab
            >`,
        )}</md-tabs
      >${this.pending
        ? html`<md-linear-progress
            indeterminate
            aria-label=${this.l("Operation in progress","操作進行中",true)}
          ></md-linear-progress>`
        : nothing}
      <div
        class="content view"
        ?hidden=${["guests","regex","tools","companion","authenticator","source","package","documentation"].includes(this.tab)}
        id="operation-content"
        role="tabpanel"
        aria-labelledby=${"operation-tab-" + this.tab}
      >
        ${this.tab === "runtime"
          ? this.runtimeView()
          : this.tab === "builds"
            ? this.buildsView()
            : this.tab === "config"
              ? this.configView()
              : this.tab === "artifacts"
                ? this.artifactsView()
                : this.tab === "guests"
                  ? nothing
                  : this.tab === "assistant"
                    ? this.assistantView()
                    : ["regex", "tools", "companion", "authenticator", "source", "package", "documentation"].includes(this.tab)
                      ? nothing
                      : this.updatesView()}
      </div>
      <guest-panel
        class="guest-host"
        ?hidden=${this.tab !== "guests"}
        .workspaceId=${this.workspace?.workspaceId ?? ""}
        .language=${this.language}
      ></guest-panel
      ><regex-workbench
        class="regex-host"
        ?hidden=${this.tab !== "regex"}
        .language=${this.language}
      ></regex-workbench
      ><package-panel
        ?hidden=${this.tab !== "package"}
        .workspaceId=${this.workspace?.workspaceId ?? ""}
        .language=${this.language}
      ></package-panel
      ><source-panel
        ?hidden=${this.tab !== "source"}
        .workspaceId=${this.workspace?.workspaceId ?? ""}
        .language=${this.language}
        @source-adopted=${(event: CustomEvent) => {
          if(!this.dispatchEvent(new CustomEvent('workspace-adopted',{bubbles:true,composed:true,cancelable:true,detail:event.detail})))return;
          this.workspace = event.detail;
          this.config = undefined;
          this.artifacts = [];
          this.artifact = undefined;
          this.changes = {};
        }}
        @source-applied=${(event: CustomEvent) => {
          if (event.detail.workspaceId !== this.workspace?.workspaceId) return;
          this.config = undefined;
          this.artifacts = [];
          this.artifact = undefined;
          this.changes = {};
        }}
      ></source-panel
      ><tools-panel
        ?hidden=${this.tab !== "tools"}
        .language=${this.language}
      ></tools-panel
      ><authenticator-panel ?hidden=${this.tab!=="authenticator"} .active=${this.tab==="authenticator"} .language=${this.language}></authenticator-panel><documentation-panel .restricted=${this.restricted} ?hidden=${this.tab!=="documentation"} .active=${this.tab==="documentation"} .language=${this.language}></documentation-panel><companion-panel
        ?hidden=${this.tab !== "companion"}
        .language=${this.language}
      ></companion-panel
      >${this.feedback
        ? html`<div class="status" role="status">${displayOwnedStatus(this,"feedback",this.feedback,this.language)}</div>`
        : nothing}
    </div>${this.dockOpen?html`<section class="dock" style=${`height:${this.dockHeight}px`} aria-label=${this.l("Jobs and output dock","工作同輸出面板",true)}><div class="dock-resizer" role="separator" tabindex="0" aria-label=${this.l("Resize jobs dock","調整工作面板大小",true)} aria-orientation="horizontal" aria-valuenow=${this.dockHeight} aria-valuemin="80" aria-valuemax="400" @pointerdown=${this.resizeDock} @keydown=${(e:KeyboardEvent)=>{if(["ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();this.dockHeight=Math.max(80,Math.min(400,this.dockHeight+(e.key==="ArrowUp"?20:-20)));}}}></div><div class="document-toolbar"><strong>${this.l("Jobs / output","工作／輸出",true)}</strong><span>${this.jobs.length} ${this.l("loaded","已載入",true)}</span><md-text-button ?disabled=${this.pending} @click=${this.refreshJobs}>${actionIcon('Refresh jobs')}${this.l("Refresh jobs","重新整理工作",true)}</md-text-button></div><div class="dock-content"><div class="dock-jobs">${this.jobs.map(job=>html`<md-text-button ?disabled=${this.pending} @click=${()=>this.readLogs(job)}>${job.kind} · ${job.state}</md-text-button>`)}</div><div class="dock-log" role="log" tabindex="0" aria-label=${this.l("Selected job output","所選工作輸出",true)}>${this.selectedJob?this.logs.map(record=>html`<div>${typeof record.value==="string"?record.value:record.value?.text??record.value?.message??this.l("Structured job event","結構化工作事件",true)}</div>`):html`<span class="dock-empty">${this.l("Refresh recorded jobs, then select one to read its output. No job is running by implication.","重新整理工作記錄，再選擇工作以讀取輸出。唔會假設有工作執行中。",true)}</span>`}</div></div></section>`:nothing}</div></div>`;
  }
}
customElements.define("operations-panel", OperationsPanel);


