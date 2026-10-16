import "./experience-policies";
import "./experience-policy-panel";
import "./update-panel";
import {repeat} from "lit/directives/repeat.js";
import {WorkspaceTabs, type WorkspaceDestination} from "./workspace-tabs";
import "./command-surfaces";
import "./shared-mode-panel";
import "./attention-mode-panel";
import "./scheduled-preferences-panel";
import type {ScheduledPreferencesSnapshot} from "../shared/scheduled-preferences";
import type {SharedModeSnapshot} from "../shared/shared-mode";
import {ownedCopy, vocabulary} from "./owned-copy";
import "./personal-vocabulary-panel";
import "./personal-vocabulary-drop";
import "./settings-search";
import "./regex-workbench";
import materialIconsLicense from "./assets/material-icons/LICENSE.txt?raw";
import {materialIcon, actionIcon} from "./material-icons";
import { LitElement, html, nothing } from "lit";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/dialog/dialog.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/icon/icon.js";
import "@material/web/textfield/outlined-text-field.js";
import "./fonts.css";
import "./operations-panel";
import { workspaceStyles } from "./workspace-styles";

type Plan = {
  id: string;
  name: string;
  runtime: "wsl" | "docker";
  target: "image" | "sdk" | "toolchain";
  status: "draft" | "ready-for-review";
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type Activity = { id: string; en: string; zh: string; at: string };
import type {
  Language,
  StudioBootstrap,
  OperationRequest,
  WindowCommand,
} from "../shared/api";

type ConnectionState = "loading" | "ready" | "unavailable";
type SaveState =
  | "idle"
  | "saving"
  | "saved"
  | "conflict"
  | "failed"
  | "unknown"
  | "refresh-unavailable"
  | "discarded";

/** Production composite: Material Web controls with semantic internal anatomy. */
class MaterialBuildroot extends LitElement {
  static properties = {
    state: { state: true },
    route: { state: true },
    connection: { state: true },
    saveState: { state: true },
    windowNotice: { state: true },
    theme: { state: true },
    dark: { state: true },
    draft: { state: true },
    plans: { state: true },
    selectedId: { state: true },
    edit: { state: true },
    events: { state: true },
    notice: { state: true },
    newName: { state: true },
    newRuntime: { state: true },
    nameError: { state: true },
    setupStep: { state: true },
    setupDone: { state: true },
    setupRuntime: { state: true },
    setupChecking: { state: true },
    inspector: { state: true },
    pendingDestination: { state: true },
    workspaceMode: { state: true },
    workspaceBusy: { state: true },
    snapshots: { state: true },
    snapshotName: { state: true },
    restoreId: { state: true },
    importText: { state: true },
    importSummary: { state: true },
    projectSessions: { state: true },
    activeProject: { state: true },
  };
  declare state: StudioBootstrap | undefined;
  route = window.studio?.operations ? "operations" : "projects";
  connection: ConnectionState = "loading";
  saveState: SaveState = "idle";
  windowNotice = false;
  theme = "system";
  dark = false;
  draft: Language = "bilingual";
  workspaceMode: "session" | "loading" | "durable" | "unavailable" = "session";
  workspaceBusy = false;
  snapshots: { id: string; name: string; createdAt: string }[] = [];
  snapshotName = "";
  restoreId = "";
  importText = "";
  importSummary = "";
  private projectSessions: {workspaceId:string;name:string}[]=[];
  private activeProject='';
  private tabsHost(){return this.renderRoot.querySelector('workspace-tabs') as WorkspaceTabs|null;}
  private activeOperations(){return Array.from(this.renderRoot.querySelectorAll<import('./operations-panel').OperationsPanel>('operations-panel')).find(panel=>panel.dataset.projectId===this.activeProject)??null;}
  private workspaceDestinations():WorkspaceDestination[]{return [
    {id:'open-project',en:'Open or adopt project',zh:'開啟或接入專案',icon:'folder_open'},
    ...this.projectSessions.map(p=>({id:`project:${p.workspaceId}`,en:p.name,zh:p.name,icon:'folder_open'})),
    ...[['projects','Plans','計劃','dashboard'],['activity','Activity','活動','history'],['settings','Settings','設定','settings'],['about','About','關於','info']].map(([id,en,zh,icon])=>({id,en,zh,icon})),
    ...[['runtime','Projects & runtime','專案同執行環境','computer'],['source','Source','來源','code'],['config','Configuration','設定選項','tune'],['package','Package authoring','套件編寫','inventory_2'],['builds','Build queue and output','建置佇列同輸出','build'],['artifacts','Artifacts','輸出檔案','folder_open'],['guests','Virtual machines','虛擬機','memory'],['tools','Tools','工具','build'],['assistant','Local assistant','本機助理','help_outline'],['regex','Regex workbench','正規表達式工作台','code'],['companion','Browser companion','瀏覽器配對','link'],['updates','Updates','更新','download'],['documentation','Help and documentation','說明同文件','help_outline']].map(([id,en,zh,icon])=>({id:`operation:${id}`,en,zh,icon})),
    ...[['local','Trusted local tools','可信本機工具','build'],['convert','File converter','檔案轉換','description'],['pdf','PDF workspace','PDF 工作區','description'],['queue','File and model queue','檔案同模型佇列','history'],['server','Minecraft Java server','Minecraft Java 伺服器','computer']].map(([id,en,zh,icon])=>({id:`tool:${id}`,en,zh,icon})),
    ...this.settingsEntries().map(e=>({id:`setting:${e.id}`,en:e.text,zh:e.text,icon:'settings'})),
    {id:'new-plan',en:'New plan',zh:'新增計劃',icon:'add'},
    {id:'export-plans',en:'Export plans',zh:'匯出計劃',icon:'download'},
    ...(!this.restricted?[{id:'wording:upload',en:'Import personal vocabulary',zh:'匯入個人詞彙',icon:'upload'},{id:'wording:status',en:'Personal vocabulary status',zh:'個人詞彙狀態',icon:'info'},{id:'wording:clear',en:'Clear personal vocabulary',zh:'清除個人詞彙',icon:'delete'}]:[]),
    {id:'setup',en:'First-run setup',zh:'首次設定',icon:'tune'}
  ];}
  private async workspaceDestination(event:CustomEvent){
    const destination=event.detail.destination as string;
    if(this.dirty||!(await this.confirmScheduleLeave())){this.notice=this.noticeText('Save or discard the current draft before switching tabs.','切換分頁前請先儲存或捨棄目前草稿。');return;}
    const owner=event.detail.projectContext;
    if(typeof owner==='string'&&owner){if(!this.projectSessions.some(p=>p.workspaceId===owner)){this.notice=this.noticeText('Reopen the owning project before using its saved utility tab.','使用已儲存工具分頁前，請重新開啟所屬專案。');return;}this.activeProject=owner;}
    if(destination.startsWith('project:')){
      const id=destination.slice(8),project=this.projectSessions.find(p=>p.workspaceId===id);
      if(!project){await this.navigate('operations');if(this.route==='operations'){this.activeProject='';await this.updateComplete;const panel=this.activeOperations();if(panel)panel.tab='runtime';}this.notice=this.noticeText('Reopen this project through the folder picker to renew access.','請透過資料夾選擇器重新開啟專案，以更新存取權。');return;}
      await this.navigate('operations');if(this.route!=='operations')return;
      this.activeProject=id;this.tabsHost()?.acknowledge(destination,project.name,id);return;
    }
    if(destination==='open-project'){
      await this.navigate('operations');if(this.route!=='operations')return;
      this.activeProject='';await this.updateComplete;const panel=this.activeOperations();if(panel)panel.tab='runtime';this.tabsHost()?.acknowledge(destination);return;
    }
    if(destination==='setup'){this.openDialog('setup-dialog');return;}
    if(destination==='new-plan'){await this.navigate('projects');if(this.route==='projects'){this.tabsHost()?.acknowledge('projects');this.beginNew();}return;}
    if(destination==='export-plans'){await this.navigate('projects');if(this.route==='projects'){this.tabsHost()?.acknowledge('projects');this.exportPlans();}return;}
    if(destination.startsWith('wording:')){if(this.restricted)return;await this.navigate('settings');if(this.route!=='settings')return;const search=this.renderRoot.querySelector('settings-search') as import('./settings-search').SettingsSearch|null;search?.reset();await search?.updateComplete;await this.updateComplete;const panel=this.renderRoot.querySelector('personal-vocabulary-panel') as import('./personal-vocabulary-panel').PersonalVocabularyPanel|null;panel?.scrollIntoView({block:'nearest'});await panel?.updateComplete;panel?.focusAction(destination.slice(8) as 'upload'|'status'|'clear');this.tabsHost()?.acknowledge('setting:vocabulary');return;}
    if(destination.startsWith('tool:')){
      await this.navigate('operations');if(this.route!=='operations')return;const panel=this.activeOperations();if(panel){panel.tab='tools';await panel.updateComplete;const tools=panel.shadowRoot?.querySelector('tools-panel') as import('lit').LitElement|null;await tools?.updateComplete;const section=tools?.shadowRoot?.querySelector<HTMLElement>(`[data-destination="${destination.slice(5)}"]`);section?.scrollIntoView({block:'start'});section?.focus();}
    }else if(destination.startsWith('operation:')){
      await this.navigate('operations');if(this.route!=='operations')return;
      const panel=this.activeOperations();if(panel)panel.tab=destination.slice(10);
    }else if(destination.startsWith('setting:')){
      await this.navigate('settings');if(this.route!=='settings')return;
      const id=destination.slice(8);const search=this.renderRoot.querySelector('settings-search') as import('./settings-search').SettingsSearch|null;const entry=this.settingsEntries().find(e=>e.id===id);if(search&&entry){search.regex=false;search.query=entry.text;search.focusQuery();}
    }else{await this.navigate(destination);if(this.route!==destination)return;}
    this.tabsHost()?.acknowledge(destination,'','',destination.startsWith('operation:')||destination.startsWith('tool:')?this.activeProject:'');
  }
  private async adoptedProject(event:CustomEvent){
    event.preventDefault();event.stopPropagation();
    const workspace=event.detail;if(!workspace||typeof workspace.workspaceId!=='string'||typeof workspace.name!=='string')return;
    if(!this.projectSessions.some(p=>p.workspaceId===workspace.workspaceId))this.projectSessions=[...this.projectSessions,{workspaceId:workspace.workspaceId,name:workspace.name}];
    this.activeProject=workspace.workspaceId;this.route='operations';await this.updateComplete;
    this.tabsHost()?.acknowledge(`project:${workspace.workspaceId}`,workspace.name,workspace.workspaceId);
  }
  protected firstUpdated(){this.tabsHost()?.acknowledge(window.studio?.operations?'open-project':'projects');}
  private async closeWorkspaceTab(event:CustomEvent){
    // Keep mounted instances so closing navigation never discards pending drafts or job output.
    if(this.dirty||!(await this.confirmScheduleLeave())){this.notice=this.noticeText('Save or discard the current draft before closing a tab.','關閉分頁前請先儲存或捨棄目前草稿。');return;}
    event.detail.complete();
  }
  private workspaceRevision = 0;
  plans: Plan[] = [];
  selectedId = "";
  edit: Plan | undefined;
  events: Activity[] = [];
  notice = "";
  private noticeEnglish="";
  private noticeText(en:string,zh:string){this.noticeEnglish=en;return this.l(en,zh);}
  newName = "";
  newRuntime: "wsl" | "docker" = "wsl";
  nameError = false;
  setupStep = 0;
  setupDone = false;
  private storedOnboarding: any;
  setupRuntime: any;
  setupChecking = false;
  inspector = false;
  pendingDestination = "";
  private destinationDialogs = new Set<string>();
  private setupPlanId = "";
  private setupDismissed = false;
  private dialogOpeners = new Map<string, HTMLElement>();
  private media = matchMedia("(prefers-color-scheme: dark)");
  private unsubscribe?: () => void;
  private opener?: HTMLElement;
  private dialogDestination = false;
  private mediaChanged = () => {
    this.dark =
      this.effectiveTheme === "dark" || (this.effectiveTheme === "system" && this.media.matches);
  };
  static styles = workspaceStyles;
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.shortcut);
    this.media.addEventListener("change", this.mediaChanged);
    this.mediaChanged();
    this.vocabularyUnsubscribe=vocabulary.subscribe(()=>this.requestUpdate());
    void this.loadSharedMode();
    void this.loadScheduledPreferences();
    void this.load();
  }
  disconnectedCallback() {
    window.removeEventListener("keydown", this.shortcut);
    this.unsubscribe?.();
    this.vocabularyUnsubscribe?.();this.modeUnsubscribe?.();this.scheduleUnsubscribe?.();
    this.media.removeEventListener("change", this.mediaChanged);
    super.disconnectedCallback();
  }
  private vocabularyUnsubscribe?:()=>void;
  private modeUnsubscribe?:()=>void;
  private sharedSnapshot:SharedModeSnapshot|null=null;
  private get restricted(){return vocabulary.school()!=="inactive";}
  private get effectiveLanguage():Language{return this.restricted?"en":this.scheduleSnapshot?.available&&this.scheduleSnapshot.effective?.provenance.language?this.scheduleSnapshot.effective.values.language:this.state?.language??"bilingual";}
  private scheduleSnapshot:ScheduledPreferencesSnapshot|null=null;
  private scheduleUnsubscribe?:()=>void;
  private get effectiveTheme(){return this.scheduleSnapshot?.available&&this.scheduleSnapshot.effective?.provenance['appearance.theme']?this.scheduleSnapshot.effective.values['appearance.theme']:this.theme;}
  private applyScheduledSnapshot(snapshot:ScheduledPreferencesSnapshot|null){this.scheduleSnapshot=snapshot;this.mediaChanged();this.syncDocumentLanguage();this.requestUpdate();}
  private async loadScheduledPreferences(){const bridge=window.studio;if(!bridge?.scheduledPreferences)return;let observed=false;this.scheduleUnsubscribe=bridge.onScheduledPreferences?.(snapshot=>{observed=true;this.applyScheduledSnapshot(snapshot);});try{const reply=await bridge.scheduledPreferences({action:'status'});if(!observed)this.applyScheduledSnapshot(reply.ok?reply.result as ScheduledPreferencesSnapshot:null);}catch{if(!observed)this.applyScheduledSnapshot(null);}}
  private schedulePanel(){return this.renderRoot.querySelector('scheduled-preferences-panel') as import('./scheduled-preferences-panel').ScheduledPreferencesPanel|null;}
  private async confirmScheduleLeave(){
    const panel=this.schedulePanel();if(!panel)return true;
    if(panel.hasPendingDraft&&!this.settingIds.includes('schedules')){this.settingIds=[...this.settingIds,'schedules'];this.requestUpdate();await this.updateComplete;}
    return panel.confirmLeave();
  }
  private async scheduledPreferenceAction(){const dialog=this.renderRoot.querySelector('#actions-dialog');const closed=new Promise<void>(resolve=>dialog?.addEventListener('closed',()=>resolve(),{once:true}));this.closeDialog('actions-dialog',true);await closed;this.settingIds=['language','appearance','backups','vocabulary','shared','schedules','experience'];await this.navigate('settings');await this.updateComplete;const search=this.renderRoot.querySelector('settings-search') as import('./settings-search').SettingsSearch|null;search?.reset();await search?.updateComplete;await this.updateComplete;const panel=this.schedulePanel();panel?.scrollIntoView({block:'nearest'});await panel?.updateComplete;(panel?.shadowRoot?.querySelector('#schedule-heading') as HTMLElement|null)?.focus();}
  private applySharedSnapshot(snapshot:SharedModeSnapshot|null){this.sharedSnapshot=snapshot;void vocabulary.setSchool(snapshot?.available===true&&typeof snapshot.active==='boolean'?(snapshot.active?'active':'inactive'):'unknown');this.syncDocumentLanguage();this.requestUpdate();}
  private syncDocumentLanguage(){document.documentElement.lang=this.effectiveLanguage==='en'?'en':'zh-HK';}
  private settingIds=['language','appearance','backups','vocabulary','shared','schedules','experience'];
  private settingsEntries(){return [
    ...(!this.restricted?[{id:'language',text:this.l('Language Interface language','語言 介面語言')}]:[]),
    {id:'schedules',text:this.l('Scheduled preferences Rules Timezone History External source enrollment','偏好排程 規則 時區 歷史 外部來源登記')},
    {id:'experience',text:this.l('Experience locks Local support tickets Credential policies Waiting challenges','體驗鎖 本機支援工單 憑證規則 等候挑戰')},
    {id:'shared',text:this.l('Shared preference Exit credential Recovery','共用偏好 退出憑證 復原')},
    {id:'appearance',text:this.l('Appearance Theme','外觀 主題')},
    {id:'backups',text:this.l('Workspace backups Snapshots Import','工作區備份 快照 匯入')},
    ...(this.restricted?[]:[{id:'vocabulary',text:this.l('Personal vocabulary Import Replace Clear','個人詞彙 匯入 取代 清除')}])];}
  private owned(en:string,zh:string,kind:'ui-copy'|'accessible-name'='ui-copy'){return ownedCopy(en,zh,this.effectiveLanguage,kind);}
  private async loadSharedMode(){
    const bridge=window.studio;
    const apply=(snapshot?:SharedModeSnapshot)=>this.applySharedSnapshot(snapshot??null);
    if(!bridge?.sharedMode){apply();return;}
    let observed=false;this.modeUnsubscribe=bridge.onSharedMode?.(snapshot=>{observed=true;apply(snapshot);});
    try{const reply=await bridge.sharedMode({action:'status'});if(!observed)apply(reply.ok?reply.result:undefined);}catch{if(!observed)apply();}
  }
  private async sharedPreferenceAction(){
    const dialog=this.renderRoot.querySelector('#actions-dialog');const closed=new Promise<void>(resolve=>dialog?.addEventListener('closed',()=>resolve(),{once:true}));this.closeDialog('actions-dialog',true);await closed;
    this.settingIds=['language','appearance','backups','vocabulary','shared','schedules','experience'];await this.navigate('settings');await this.updateComplete;
    const search=this.renderRoot.querySelector('settings-search') as import('./settings-search').SettingsSearch|null;search?.reset();await search?.updateComplete;await this.updateComplete;
    const panel=this.renderRoot.querySelector('shared-mode-panel') as import('./shared-mode-panel').SharedModePanel|null;panel?.scrollIntoView({block:'nearest'});await panel?.updateComplete;(panel?.shadowRoot?.querySelector('#shared-heading') as HTMLElement|null)?.focus();
  }
  private async vocabularyAction(action:'upload'|'status'|'clear'){
    if(vocabulary.school()!=='inactive')return;
    const dialog=this.renderRoot.querySelector('#actions-dialog');
    const closed=new Promise<void>(resolve=>dialog?.addEventListener('closed',()=>resolve(),{once:true}));
    this.closeDialog('actions-dialog',true);await closed;this.settingIds=['language','appearance','backups','vocabulary','shared','schedules','experience'];await this.navigate('settings');await this.updateComplete;
    const search=this.renderRoot.querySelector('settings-search') as import('./settings-search').SettingsSearch|null;search?.reset();await search?.updateComplete;await this.updateComplete;
    const panel=this.renderRoot.querySelector('personal-vocabulary-panel') as import('./personal-vocabulary-panel').PersonalVocabularyPanel|null;
    panel?.scrollIntoView({block:'nearest'});await panel?.updateComplete;panel?.focusAction(action);
  }
  private l(en: string, zh: string) {
    const language = this.effectiveLanguage;
    return language === "en" ? en : language === "zh-HK" ? zh : `${en} · ${zh}`;
  }
  private buildTime() {
    const value = this.state?.updatedAt;
    if (!value || !Number.isFinite(Date.parse(value)))
      return this.l("Unavailable", "未能取得");
    try {
      const locale = this.effectiveLanguage === "zh-HK" ? "zh-HK" : "en-CA";
      const formatter = new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "longOffset",
      });
      return (
        formatter.format(new Date(value)) +
        " (" +
        formatter.resolvedOptions().timeZone +
        ")"
      );
    } catch {
      return this.l("Unavailable", "未能取得");
    }
  }
  private get busy() {
    return this.saveState === "saving";
  }
  private get canSave() {
    return (
      !this.restricted && this.connection === "ready" &&
      this.state?.storage === "ready" &&
      !this.busy &&
      this.saveState !== "unknown" &&
      this.saveState !== "refresh-unavailable"
    );
  }
  private get canDiscard() {
    return this.canSave && this.draft !== this.state?.language;
  }
  private languageName(language: Language) {
    return language === "en"
      ? "English"
      : language === "zh-HK"
        ? "香港粵語"
        : "English + 香港粵語";
  }
  private confirmedPreference() {
    if (this.connection !== "ready" || this.state?.storage !== "ready")
      return nothing;
    const origin =
      this.state.origin === "default"
        ? this.l("Application default", "應用程式預設")
        : this.state.origin === "saved"
          ? this.l("Saved on this device", "已儲存喺呢部電腦")
          : this.l("Origin unavailable", "未能取得來源");
    return html`<p class="muted" id="confirmed-language">
      ${this.l("Last confirmed language", "上次確認嘅語言")}:
      ${this.languageName(this.state.language)}. ${origin}.
    </p>`;
  }
  private async discardLanguage() {
    if (!this.state || !this.canDiscard) return;
    this.draft = this.state.language;
    this.saveState = "discarded";
    this.windowNotice = false;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>("#language-select")?.focus();
  }
  private applyBootstrap(state: StudioBootstrap, resetDraft = false) {
    this.state = state;
    this.connection = "ready";
    if (resetDraft) this.draft = state.language;
    this.syncDocumentLanguage();
  }
  private async load() {
    try {
      this.applyBootstrap(await window.studio.bootstrap(), true);
      await this.loadWorkspace();
      this.unsubscribe?.();
      this.unsubscribe = window.studio.onEvent(() => {
        /* Transaction results, not notifications, determine the displayed saved state. */
      });
    } catch {
      this.connection = "unavailable";
    }
  }
  private async controlWindow(command: WindowCommand) {
    if(command==="close"&&!(await this.confirmScheduleLeave()))return;
    try {
      this.windowNotice = !(await window.studio.windowControl(command));
    } catch {
      this.windowNotice = true;
    }
  }
  private storageMessage() {
    if (this.connection === "loading")
      return this.l("Loading saved preferences…", "正在載入已儲存嘅偏好設定…");
    if (this.connection === "unavailable")
      return this.l(
        "Desktop connection unavailable. Restart the application to reconnect.",
        "未能連接桌面服務。請重新啟動應用程式再連接。",
      );
    return this.state?.storage === "ready"
      ? this.l("Local storage ready.", "本機儲存已就緒。")
      : this.l(
          "Local storage unavailable. Existing data is preserved; saving is disabled.",
          "未能使用本機儲存。現有資料已保留，暫停儲存。",
        );
  }
  private statusMessage() {
    if (this.saveState === "saving")
      return this.l("Saving language…", "正在儲存語言…");
    if (this.saveState === "unknown")
      return this.l(
        "Save outcome unavailable. Saving is disabled until you restart the application and review the saved language.",
        "未能確認儲存結果。請重新啟動應用程式並檢視已儲存嘅語言，先可以再儲存。",
      );
    if (this.saveState === "refresh-unavailable")
      return this.l(
        "The save was rejected, and current settings could not be loaded. Restart the application before saving again.",
        "儲存要求已被拒絕，亦未能載入目前設定。請重新啟動應用程式再儲存。",
      );
    if (this.windowNotice)
      return this.l(
        "The window action could not be completed. Press Alt+F4 if you need to close the application.",
        "未能完成視窗操作。如要關閉應用程式，請按 Alt+F4。",
      );
    if (this.connection !== "ready" || this.state?.storage !== "ready")
      return this.storageMessage();
    if (this.saveState === "saved")
      return this.l("Language saved on this device.", "語言已儲存喺呢部電腦。");
    if (this.saveState === "discarded")
      return this.l(
        "Pending choice reset to the last confirmed language.",
        "已將待儲存嘅選擇還原為上次確認嘅語言。",
      );
    if (this.saveState === "conflict")
      return this.l(
        "Settings changed since this screen loaded. Your choice is retained; review it and Save again.",
        "設定已經改咗。已保留你嘅選擇，請檢視後再儲存。",
      );
    if (this.saveState === "failed")
      return this.l(
        "Language was not saved. The previous saved setting remains in use.",
        "語言未能儲存，繼續使用之前嘅設定。",
      );
    return this.draft !== this.state.language
      ? this.l("You have an unsaved language choice.", "你有未儲存嘅語言選擇。")
      : this.route === "operations"
        ? this.l("Language preferences are ready.", "語言偏好設定已就緒。")
        : this.l("No operation in progress.", "目前冇操作進行中。");
  }
  private async navigate(route: string) {
    if(route!==this.route&&!(await this.confirmScheduleLeave()))return;
    if (this.dirty) {
      this.pendingDestination = route;
      this.openDialog("leave-dialog");
      return;
    }
    await this.go(route);
  }
  private async go(route: string) {
    if(route!==this.route&&!(await this.confirmScheduleLeave()))return;
    this.route = route;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>("#workspace-heading")?.focus();
  }
  private async saveLanguage() {
    if (!this.state || !this.canSave) return;
    this.saveState = "saving";
    this.windowNotice = false;
    const desired = this.draft;
    let request: OperationRequest = {
      version: 1,
      operationId: crypto.randomUUID(),
      projectId: this.state.projectId,
      capability: this.state.capability,
      expectedRevision: this.state.revision,
      action: "settings.setLanguage",
      arguments: { language: desired },
    };
    let rejected = false;
    try {
      let result = await window.studio.request(request);
      rejected = !result.ok;
      if (!result.ok && result.code === "UNAUTHORIZED") {
        const current = await window.studio.bootstrap();
        this.applyBootstrap(current);
        if (current.storage !== "ready") {
          this.saveState = "failed";
          return;
        }
        if (current.revision !== request.expectedRevision) {
          this.saveState = "conflict";
          return;
        }
        request = { ...request, capability: current.capability };
        rejected = false;
        result = await window.studio.request(request);
        rejected = !result.ok;
      }
      if (result.ok) {
        this.applyBootstrap({
          ...this.state,
          language: desired,
          revision: result.revision,
          origin: "saved",
        });
        this.saveState = "saved";
      } else if (result.code === "STALE_REVISION") {
        this.applyBootstrap(await window.studio.bootstrap());
        this.saveState = "conflict";
      } else this.saveState = "failed";
    } catch {
      this.saveState = rejected ? "refresh-unavailable" : "unknown";
    }
  }
  private options(items: [string, string][]) {
    return items.map(
      ([value, label]) =>
        html`<md-select-option value=${value}
          ><div slot="headline">${label}</div></md-select-option
        >`,
    );
  }
  private get workspaceAPI() {
    return window.studio as unknown as {
      workspaceGet?: () => Promise<any>;
      workspaceMutate?: (request: Record<string, unknown>) => Promise<any>;
      workspaceExport?: () => Promise<any>;
    };
  }
  private get canEditWorkspace() {
    return (
      !this.workspaceBusy &&
      (this.workspaceMode === "session" || this.workspaceMode === "durable")
    );
  }
  private scope() {
    return this.workspaceMode === "durable"
      ? this.l("Saved on this device", "已儲存喺呢部電腦")
      : this.workspaceMode === "session"
        ? this.l(
            "Session only. Export to keep your plans.",
            "只限今次工作階段，請匯出以保留計劃。",
          )
        : this.l(
            "Workspace storage unavailable. Changes are disabled.",
            "未能使用工作區儲存，暫停變更。",
          );
  }
  private hydrateWorkspace(state: any) {
    this.workspaceRevision = state.revision;
    this.historyWarning = state.historyWarning === true;
    this.snapshots = state.snapshots;
    this.plans = state.plans;
    this.theme = state.preferences.theme;
    this.mediaChanged();
    this.setupDone =
      state.onboardingCompleted || state.onboarding?.dismissed === true;
    this.storedOnboarding = state.onboarding;
    this.workspaceMode = "durable";
    this.events = state.activity
      .slice()
      .reverse()
      .map((event: any) => ({
        id: event.id,
        en: this.activityName(event.action, false),
        zh: this.activityName(event.action, true),
        at: event.timestamp,
      }));
  }
  private activityName(action: string, zh: boolean) {
    const names: Record<string, [string, string]> = {
      "plan.create": ["Created a project plan", "已建立專案計劃"],
      "plan.update": ["Updated a project plan", "已更新專案計劃"],
      "plan.delete": ["Removed a project plan", "已移除專案計劃"],
      "preferences.update": [
        "Updated workspace preferences",
        "已更新工作區偏好設定",
      ],
      "onboarding.complete": ["Completed workspace setup", "已完成工作區設定"],
      "onboarding.createPlan": [
        "Created the setup project plan",
        "已建立設定專案計劃",
      ],
      "snapshot.create": ["Created a workspace snapshot", "已建立工作區快照"],
      "snapshot.restore": ["Restored a workspace snapshot", "已還原工作區快照"],
      "document.import": ["Imported a workspace document", "已匯入工作區文件"],
    };
    return names[action]?.[zh ? 1 : 0] ?? action;
  }
  private async loadWorkspace() {
    if (!this.workspaceAPI?.workspaceGet) return;
    this.workspaceMode = "loading";
    try {
      const reply = await this.workspaceAPI.workspaceGet();
      if (!reply.ok) throw new Error("unavailable");
      this.hydrateWorkspace(reply.state);
      this.restoreSetup(reply.state.onboarding);
      this.selectedId = this.plans[0]?.id ?? "";
      this.edit = this.selected ? { ...this.selected } : undefined;
    } catch {
      this.workspaceMode = "unavailable";
      this.notice = this.noticeText(
        "Workspace storage could not be loaded. Restart to retry; existing data is preserved.",
        "未能載入工作區儲存，請重新啟動再試，現有資料已保留。",
      );
    }
  }
  private async mutateWorkspace(
    action: string,
    fields: Record<string, unknown> = {},
  ) {
    if (this.workspaceMode !== "durable" || !this.canEditWorkspace)
      return false;
    this.workspaceBusy = true;
    try {
      const reply = await this.workspaceAPI.workspaceMutate!({
        expectedRevision: this.workspaceRevision,
        action,
        ...fields,
      });
      if (!reply.ok) {
        if (reply.code === "REVISION_CONFLICT") {
          const current = await this.workspaceAPI.workspaceGet!();
          if (current.ok) this.hydrateWorkspace(current.state);
          else this.workspaceMode = "unavailable";
          this.notice = this.noticeText(
            "Workspace changed elsewhere. Your pending edits are retained; review before trying again.",
            "工作區已喺其他地方變更。待套用變更已保留，請檢視後再試。",
          );
        } else
          this.notice = this.noticeText(
            "Workspace change was rejected. Your pending edits are retained.",
            "工作區變更已被拒絕，待套用變更已保留。",
          );
        return false;
      }
      this.hydrateWorkspace(reply.state);
      return true;
    } catch {
      this.workspaceMode = "unavailable";
      this.notice = this.noticeText(
        "Workspace save outcome is unknown. Restart and review saved data before making more changes.",
        "未能確認工作區儲存結果。請重新啟動並檢視已儲存資料，再作變更。",
      );
      return false;
    } finally {
      this.workspaceBusy = false;
    }
  }
  private async setTheme(value: string) {
    if (this.workspaceMode === "durable") {
      await this.mutateWorkspace("preferences.update", {
        preferences: { theme: value },
      });
    } else if (this.workspaceMode === "session") {
      this.theme = value;
      this.mediaChanged();
    }
  }
  private restoreSetup(progress: any) {
    if (!progress) return;
    this.setupStep = progress.step;
    this.newRuntime = progress.runtime;
    this.newName = progress.name;
    this.setupPlanId = progress.planId ?? "";
    this.setupDismissed = progress.dismissed;
    if (progress.dismissed) this.setupDone = true;
  }
  private async saveSetup(step = this.setupStep, dismissed = false) {
    const onboarding = {
      step,
      runtime: this.newRuntime,
      name: this.newName.slice(0, 80),
      dismissed,
      ...(this.setupPlanId ? { planId: this.setupPlanId } : {}),
    };
    if (
      this.workspaceMode === "durable" &&
      !(await this.mutateWorkspace("onboarding.update", { onboarding }))
    )
      return false;
    this.setupStep = step;
    this.setupDismissed = dismissed;
    if (dismissed) this.setupDone = true;
    return true;
  }
  private async skipSetup() {
    if (await this.saveSetup(this.setupStep, true))
      this.closeDialog("setup-dialog");
  }
  private async completeSetup() {
    if (!this.canEditWorkspace) return;
    if (
      this.workspaceMode === "durable" &&
      !(await this.mutateWorkspace("onboarding.complete"))
    )
      return;
    this.setupDone = true;
    this.closeDialog("setup-dialog", true);
    void this.navigate(window.studio?.operations ? "operations" : "projects");
  }
  private async createSnapshot() {
    if (
      !this.snapshotName.trim() ||
      this.snapshotName.trim().length > 80 ||
      this.dirty
    )
      return;
    if (
      await this.mutateWorkspace("snapshot.create", {
        name: this.snapshotName.trim(),
      })
    ) {
      this.snapshotName = "";
      this.notice = this.noticeText("Workspace snapshot saved.", "工作區快照已儲存。");
    }
  }
  private async restoreSnapshot() {
    if (!this.restoreId || this.dirty) return;
    if (
      await this.mutateWorkspace(this.restoreId.startsWith("revision:") ? "revision.restore" : "snapshot.restore", this.restoreId.startsWith("revision:") ? { revision: Number(this.restoreId.slice(9)) } : { id: this.restoreId })
    ) {
      this.selectedId = this.plans[0]?.id ?? "";
      this.edit = this.selected ? { ...this.selected } : undefined;
      this.closeDialog("restore-dialog");
      this.notice = this.noticeText(
        "Workspace snapshot restored.",
        "工作區快照已還原。",
      );
    }
  }
  private async readImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    this.importText = "";
    this.importSummary = "";
    if (file.size > 1024 * 1024) {
      this.notice = this.noticeText(
        "The workspace document must be no larger than 1 MiB.",
        "工作區文件唔可以大過 1 MiB。",
      );
      return;
    }
    try {
      const text = await file.text();
      const document = JSON.parse(text);
      if (
        document.format !== "material-buildroot-workspace-export" ||
        document.version !== 1 ||
        !Array.isArray(document.plans) ||
        document.plans.length > 100
      )
        throw new Error("invalid");
      this.importText = text;
      this.importSummary = this.l(
        `${document.plans.length} plans. Imported preferences and setup completion replace the current values.`,
        `${document.plans.length} 個計劃。匯入嘅偏好設定同設定完成狀態會取代目前值。`,
      );
      this.openDialog("import-dialog", e);
    } catch {
      this.notice = this.noticeText(
        "Invalid workspace export. Existing data is unchanged.",
        "工作區匯出文件無效，現有資料未有變更。",
      );
    }
  }
  private async applyImport() {
    if (this.dirty || !this.importText) return;
    if (
      await this.mutateWorkspace("document.import", {
        document: this.importText,
      })
    ) {
      this.selectedId = this.plans[0]?.id ?? "";
      this.edit = this.selected ? { ...this.selected } : undefined;
      this.importText = "";
      this.closeDialog("import-dialog");
      this.notice = this.noticeText(
        "Workspace document imported.",
        "工作區文件已匯入。",
      );
    }
  }
  private revisionRows: Array<{revision:number;action:string;timestamp:string|null;plans:number;labels:string[]}> = [];
  private revisionCursor: number | null = null;
  private historyBusy = false;
  private historyWarning = false;
  private revisionLabel = "";
  private revisionQuery = "";
  private revisionFrom = "";
  private revisionTo = "";
  private revisionActions = new Set<string>();
  private revisionRegex = false;
  private revisionPattern = "";
  private revisionFlags = "i";
  private revisionMatches: string[] | null = null;
  private revisionFilterError = "";
  private revisionFilterGeneration = 0;
  private get filteredRevisionRows() {
    const datesValid=(!this.revisionFrom||/^\d{4}-\d{2}-\d{2}$/.test(this.revisionFrom))&&(!this.revisionTo||/^\d{4}-\d{2}-\d{2}$/.test(this.revisionTo))&&(!this.revisionFrom||!this.revisionTo||this.revisionFrom<=this.revisionTo);
    if(!datesValid)return [];
    return this.revisionRows.filter(row=>{
      const date=row.timestamp?.slice(0,10)??"";
      const text=JSON.stringify(row).toLocaleLowerCase();
      return (!this.revisionFrom||(date&&date>=this.revisionFrom))&&(!this.revisionTo||(date&&date<=this.revisionTo))&&
        (!this.revisionActions.size||this.revisionActions.has(row.action))&&
        (this.revisionRegex?this.revisionMatches?.includes(String(row.revision)):text.includes(this.revisionQuery.toLocaleLowerCase()));
    });
  }
  private async filterRevisionRegex() {
    const generation=++this.revisionFilterGeneration;
    this.revisionMatches=null;this.revisionFilterError="";this.requestUpdate();
    if(!this.revisionRegex)return;
    const matches:string[]=[];
    try {
      for(let start=0;start<this.revisionRows.length;start+=1000){
        const articles=this.revisionRows.slice(start,start+1000).map(row=>({id:String(row.revision),text:JSON.stringify(row)}));
        const ids=await new Promise<string[]>((resolve,reject)=>{
          const worker=new Worker(new URL('./documentation-search-worker.ts',import.meta.url),{type:'module'});
          const timer=setTimeout(()=>{worker.terminate();reject(new Error('timeout'));},600);
          worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('unavailable'));};
          worker.onmessage=e=>{clearTimeout(timer);worker.terminate();e.data.ok?resolve(e.data.ids):reject(new Error('invalid'));};
          worker.postMessage({pattern:this.revisionPattern,flags:this.revisionFlags,articles});
        });
        if(generation!==this.revisionFilterGeneration)return;
        matches.push(...ids);
      }
      if(generation===this.revisionFilterGeneration)this.revisionMatches=matches;
    }catch{if(generation===this.revisionFilterGeneration)this.revisionFilterError=this.l("Invalid, unsupported or timed-out expression. Filtering accepts i, m, s and u flags only. No filtered results are shown.","表達式無效或逾時，暫時唔顯示篩選結果。");}
    this.requestUpdate();
  }
  private nativeHistory: any = null;
  private nativeKind: "catalogue" | "options" = "catalogue";
  private nativeProjectId = "";
  private nativeRestoreRevision: number | null = null;
  private async nativeHistoryAction(action: "native.history" | "native.restore" | "native.export") {
    if(this.historyBusy||!this.workspaceAPI?.workspaceMutate)return;
    this.historyBusy=true;this.requestUpdate();
    try {
      const reply=await this.workspaceAPI.workspaceMutate({action,expectedRevision:this.workspaceRevision,kind:this.nativeKind,
        ...(this.nativeKind==="options"?{workspaceId:this.nativeProjectId}:{}),
        ...(action==="native.restore"?{revision:this.nativeRestoreRevision,expectedNativeRevision:this.nativeHistory?.revision}:{} )});
      if(!reply.ok)throw new Error("unavailable");
      if(action==="native.history")this.nativeHistory=reply.nativeHistory;
      if(action==="native.restore"){this.nativeHistory=null;this.closeDialog("native-history-restore-dialog");this.notice=this.noticeText("Metadata restored as a new revision. Reopen the project through its picker before use; existing running operations are unchanged.","資料已還原為新版本，使用前請經選擇器重新開啟專案，現有執行中工作保持不變。");}
      if(action==="native.export"&&typeof reply.document==="string"){
        const url=URL.createObjectURL(new Blob([reply.document],{type:"application/json"}));
        const link=document.createElement("a");link.href=url;link.download=`material-buildroot-${this.nativeKind}-history.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    }catch{this.notice=this.noticeText("Native metadata history is unavailable or changed. Read it again before restoring.","原生資料歷史未能使用或已變更，還原前請重新讀取。");}
    finally{this.historyBusy=false;this.requestUpdate();}
  }
  private revisionComparison = "";
  private retentionKeep: 25 | 100 | 500 = 100;
  private async historyAction(action: "history.compare" | "history.label" | "history.retain", revision = 0) {
    if (this.historyBusy || !this.workspaceAPI?.workspaceMutate) return;
    this.historyBusy = true; this.requestUpdate();
    try {
      const extra = action === "history.retain" ? {keep:this.retentionKeep} : action === "history.label" ? {revision,label:this.revisionLabel.trim()} : {revision};
      const reply = await this.workspaceAPI.workspaceMutate({action,expectedRevision:this.workspaceRevision,...extra});
      if (!reply.ok) throw new Error("unavailable");
      if (action === "history.compare") this.revisionComparison=JSON.stringify(reply.comparison,null,2);
      if (action === "history.label") {this.revisionLabel="";this.historyLoaded=false;this.revisionRows=[];}
      if (action === "history.retain") this.closeDialog("history-retention-dialog");
      this.notice=this.noticeText(action==="history.retain"?`${reply.removed} redundant cached copies removed. Recorded history remains available.`:"History action completed.",action==="history.retain"?`已移除 ${reply.removed} 個重複快取副本，已記錄歷史仍可使用。`:"歷史動作已完成。");
    } catch {this.notice=this.noticeText("History action unavailable. Refresh the workspace revision and retry. Existing history is retained.","歷史動作未能使用，請更新工作區版本再試，已有歷史仍然保留。");}
    finally {this.historyBusy=false;this.requestUpdate();}
  }
  private historyLoaded = false;
  private exportScope: "workspace" | "plans" | "history" | "revisions" | "revision-page" = "workspace";
  private exportPlanIds = new Set<string>();
  private async readRevisions(more = false) {
    if (this.historyBusy || !this.workspaceAPI?.workspaceMutate) return;
    this.historyBusy = true; this.requestUpdate();
    try {
      const reply = await this.workspaceAPI.workspaceMutate({action:"history.read",expectedRevision:this.workspaceRevision,
        ...(more && this.revisionCursor !== null ? {beforeRevision:this.revisionCursor} : {})});
      if (!reply.ok || !reply.history) throw new Error("unavailable");
      this.revisionRows = more ? [...this.revisionRows,...reply.history.records] : reply.history.records;
      this.revisionCursor = reply.history.nextBeforeRevision; this.historyLoaded = true;void this.filterRevisionRegex();
    } catch {this.notice=this.noticeText("Revision history unavailable. Current workspace is retained.","版本歷史未能使用，目前工作區仍然保留。");}
    finally {this.historyBusy=false;this.requestUpdate();}
  }
  private historyPanel() {
    return html`<section class="panel stack">
      <h2>${this.l("Workspace backups", "工作區備份")}</h2>
      <p>
        ${this.l(
          "Snapshots preserve applied plans and preferences. Restore and import create new revisions, retaining recorded earlier revisions. Full history starts with the first save in this version.",
          "快照保留已套用計劃同偏好。還原同匯入會建立新版本，保留已有版本。完整歷史由此版本首次儲存開始。",
        )}
      </p>
      ${this.workspaceMode === "durable"
        ? html`<md-outlined-text-field
              label=${this.l("Snapshot name", "快照名稱")}
              maxlength="80"
              .value=${this.snapshotName}
              @input=${(e: Event) =>
                (this.snapshotName = (
                  e.composedPath()[0] as HTMLInputElement
                ).value)}
            ></md-outlined-text-field
            ><md-filled-tonal-button
              ?disabled=${!this.canEditWorkspace ||
              !this.snapshotName.trim() ||
              this.snapshots.length >= 20 ||
              this.dirty}
              @click=${this.createSnapshot}
              >${actionIcon('Create snapshot')}${this.l("Create snapshot", "建立快照")}</md-filled-tonal-button
            >
            <p class="muted">
              ${this.l(
                `${this.snapshots.length} of 20 snapshots. Pending plan edits are not included.`,
                `${this.snapshots.length} / 20 個快照，唔包括計劃嘅待套用變更。`,
              )}
            </p>
            ${this.snapshots.map(
              (snapshot) =>
                html`<div class="row" data-appearance-key=${"snapshot:"+snapshot.id}>
                  <div class="heading">
                    <strong>${snapshot.name}</strong>
                    <p class="muted">${this.date(snapshot.createdAt)}</p>
                  </div>
                  <md-outlined-button
                    ?disabled=${!this.canEditWorkspace || this.dirty}
                    @click=${(e: Event) => {
                      this.restoreId = snapshot.id;
                      this.openDialog("restore-dialog", e);
                    }}
                    >${actionIcon('Restore')}${this.l("Restore", "還原")}</md-outlined-button
                  >
                </div>`,
            )}<md-outlined-button
              ?disabled=${!this.canEditWorkspace || this.dirty}
              @click=${() => this.renderRoot.querySelector<HTMLInputElement>("#workspace-import-file")?.click()}
            >${materialIcon("upload", "icon")}${this.l("Import workspace JSON (maximum 1 MiB)", "匯入工作區 JSON（最大 1 MiB）")}</md-outlined-button>
            <h3>${this.l("Recorded revisions", "已記錄版本")}</h3>
            ${this.historyWarning?html`<p role="alert">${this.l("The workspace was saved but complete local history could not be recorded. Git must be available to the host; inspect storage access before relying on recovery.","工作區已儲存，但未能記錄完整本機歷史。主機需要可用 Git，依賴復原前請檢查儲存存取。")}</p>`:nothing}
            <md-outlined-text-field .label=${this.l("Label for a revision","版本標籤")} maxlength="80" .value=${this.revisionLabel} @input=${(e:Event)=>{this.revisionLabel=(e.target as HTMLInputElement).value;this.requestUpdate();}}></md-outlined-text-field>
            <md-text-button @click=${()=>{this.revisionLabel="";this.requestUpdate();}}>${this.l("Clear label draft","清除標籤草稿")}</md-text-button>
            <md-outlined-button ?disabled=${this.historyBusy} @click=${()=>this.readRevisions()}>${materialIcon("history","icon")}${this.l("Read revisions","讀取版本")}</md-outlined-button>
            ${this.historyLoaded&&!this.revisionRows.length?html`<p>${this.l("No complete revision records yet. Older activity has no restorable state.","暫時未有完整版本記錄。較舊活動冇可還原狀態。")}</p>`:nothing}
            <p>${this.l("Filters apply to loaded revision pages only. Dates use UTC calendar days; load older pages to expand the scope.","篩選只適用於已載入版本頁，日期使用 UTC 日曆日，載入較舊頁面可擴大範圍。")}</p>
            <div class="row"><md-outlined-text-field .label=${this.l("Search loaded revisions","搜尋已載入版本")} .value=${this.revisionQuery} @input=${(e:Event)=>{this.revisionQuery=(e.target as HTMLInputElement).value;this.revisionPattern=this.revisionQuery;if(this.revisionRegex)void this.filterRevisionRegex();this.requestUpdate();}}></md-outlined-text-field><md-text-button @click=${()=>{this.revisionQuery=this.revisionPattern="";void this.filterRevisionRegex();}}>${this.l("Clear search","清除搜尋")}</md-text-button><md-outlined-button aria-pressed=${this.revisionRegex} @click=${()=>{this.revisionRegex=!this.revisionRegex;void this.filterRevisionRegex();}}>${this.l("Regex builder","正規表達式建構器")}</md-outlined-button></div>
            ${this.revisionRegex?html`<regex-workbench .language=${this.effectiveLanguage} .pattern=${this.revisionPattern} .flags=${this.revisionFlags} @pattern-change=${(e:CustomEvent)=>{this.revisionPattern=e.detail.pattern;this.revisionQuery=e.detail.pattern;this.revisionFlags=e.detail.flags;void this.filterRevisionRegex();}}></regex-workbench>`:nothing}
            <div class="row"><label>${this.l("From date (UTC)","開始日期（UTC）")}<input type="date" .value=${this.revisionFrom} @input=${(e:Event)=>{this.revisionFrom=(e.target as HTMLInputElement).value;this.requestUpdate();}}></label><label>${this.l("Through date (UTC)","結束日期（UTC）")}<input type="date" .value=${this.revisionTo} @input=${(e:Event)=>{this.revisionTo=(e.target as HTMLInputElement).value;this.requestUpdate();}}></label><md-text-button @click=${()=>{this.revisionFrom=this.revisionTo="";this.requestUpdate();}}>${this.l("Clear dates","清除日期")}</md-text-button></div>
            ${this.revisionFrom&&this.revisionTo&&this.revisionFrom>this.revisionTo?html`<p role="alert">${this.l("End date must not precede start date.","結束日期唔可以早過開始日期。")}</p>`:nothing}
            <div class="row">${[...new Set(this.revisionRows.map(row=>row.action))].map(action=>html`<md-outlined-button aria-pressed=${this.revisionActions.has(action)} @click=${()=>{this.revisionActions.has(action)?this.revisionActions.delete(action):this.revisionActions.add(action);this.requestUpdate();}}>${this.activityName(action,this.effectiveLanguage==="zh-HK")} (${this.revisionRows.filter(row=>row.action===action).length})</md-outlined-button>`)}</div>
            ${this.revisionFilterError?html`<p role="alert">${this.revisionFilterError}</p>`:nothing}<p>${this.filteredRevisionRows.length} / ${this.revisionRows.length} ${this.l("loaded revisions match","個已載入版本符合篩選")}</p>
            ${this.filteredRevisionRows.map(row=>html`<div class="row" data-appearance-key=${"history:"+row.revision}><span>${row.revision} · ${this.activityName(row.action,this.effectiveLanguage==="zh-HK")} · ${row.timestamp?this.date(row.timestamp):this.l("Initial state","初始狀態")} · ${row.plans} ${this.l("plans","個計劃")} · ${row.labels.join(" · ")}</span><md-outlined-button ?disabled=${this.historyBusy} @click=${()=>this.historyAction("history.compare",row.revision)}>${this.l("Compare with current","比較目前版本")}</md-outlined-button><md-outlined-button ?disabled=${this.historyBusy||!this.revisionLabel.trim()} @click=${()=>this.historyAction("history.label",row.revision)}>${this.l("Append label","新增標籤")}</md-outlined-button><md-outlined-button ?disabled=${!this.canEditWorkspace||this.dirty} @click=${(e:Event)=>{this.restoreId=`revision:${row.revision}`;this.openDialog("restore-dialog",e);}}>${this.l("Restore as new revision","還原為新版本")}</md-outlined-button></div>`)}
            ${this.revisionCursor!==null?html`<md-text-button ?disabled=${this.historyBusy} @click=${()=>this.readRevisions(true)}>${this.l("More revisions","更多版本")}</md-text-button>`:nothing}
            ${this.revisionComparison?html`<h4>${this.l("Selected revision versus current workspace","所選版本與目前工作區比較")}</h4><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${this.revisionComparison}</pre><md-text-button @click=${()=>{this.revisionComparison="";this.requestUpdate();}}>${this.l("Close comparison","關閉比較")}</md-text-button>`:nothing}
            <h3>${this.l("Revision cache retention","版本快取保留")}</h3>
            <p>${this.l("History stays local in an isolated repository beside application data. No automatic pruning or synchronization runs. This action only removes redundant cached copies after byte-for-byte comparison with preserved history; all recorded revisions remain restorable. Protected stores are excluded.","歷史保留喺應用程式資料旁嘅獨立本機儲存庫，唔會自動刪減或同步。呢個動作只會喺逐位元組核對已保留歷史之後移除重複快取，全部已記錄版本仍可還原。受保護儲存資料不包含在內。")}</p>
            <md-outlined-select .label=${this.l("Recent cached copies to keep","保留最近快取數目")} .value=${String(this.retentionKeep)} @change=${(e:Event)=>{this.retentionKeep=Number((e.target as HTMLSelectElement).value) as 25|100|500;this.requestUpdate();}}>${[25,100,500].map(count=>html`<md-select-option .value=${String(count)}><div slot="headline">${count}</div></md-select-option>`)}</md-outlined-select>
            <md-outlined-button ?disabled=${this.historyBusy} @click=${(e:Event)=>this.openDialog("history-retention-dialog",e)}>${this.l("Review cache pruning","檢視快取刪減")}</md-outlined-button>
            <md-dialog id="history-retention-dialog"><div slot="headline">${this.l("Remove redundant revision caches?","移除重複版本快取？")}</div><div slot="content">${this.l(`Keep the newest ${this.retentionKeep} recorded revisions cached. Older cache files are deleted only when identical bytes exist in local history. History commits and restore access are preserved.`, `保留最近 ${this.retentionKeep} 個已記錄版本快取。只有本機歷史保留完全相同內容時，先會刪除較舊快取。歷史提交同還原存取保持不變。`)}</div><div slot="actions"><md-text-button ?disabled=${this.historyBusy} @click=${()=>this.closeDialog("history-retention-dialog")}>${this.l("Cancel","取消")}</md-text-button><md-filled-button ?disabled=${this.historyBusy} @click=${()=>this.historyAction("history.retain")}>${this.l("Remove redundant caches","移除重複快取")}</md-filled-button></div></md-dialog>
            <h3>${this.l("Native project history","原生專案歷史")}</h3>
            <p>${this.l("Project catalogue and options have independent revisions. Paths are retained only in local recovery records and omitted from these views and exports. Restoring metadata grants no filesystem authority; reopen through the project picker.","專案目錄同選項有獨立版本。路徑只保留喺本機復原記錄，唔會顯示或匯出。還原資料唔會授予檔案權限，請經專案選擇器重新開啟。")}</p>
            <md-outlined-button ?disabled=${this.historyBusy} @click=${()=>{this.nativeKind="catalogue";this.nativeHistory=null;void this.nativeHistoryAction("native.history");}}>${this.l("Read catalogue history","讀取目錄歷史")}</md-outlined-button>
            ${this.nativeHistory?.projects?.map((project:any)=>html`<md-outlined-button data-appearance-key=${"native-project:"+project.id} ?disabled=${this.historyBusy} @click=${()=>{this.nativeKind="options";this.nativeProjectId=project.id;this.nativeHistory=null;void this.nativeHistoryAction("native.history");}}>${this.l("Read options history","讀取選項歷史")}: ${project.name}</md-outlined-button>`)}
            ${this.nativeHistory?html`<p>${this.l("Current metadata revision","目前資料版本")}: ${this.nativeHistory.revision}</p>${this.nativeHistory.records.map((record:any)=>html`<section data-appearance-key=${"native-history:"+this.nativeKind+":"+this.nativeProjectId+":"+record.revision}><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${JSON.stringify(record,null,2)}</pre><md-outlined-button ?disabled=${this.historyBusy} @click=${(e:Event)=>{this.nativeRestoreRevision=record.revision;this.openDialog("native-history-restore-dialog",e);}}>${this.l("Restore metadata as new revision","還原資料為新版本")}</md-outlined-button></section>`)}<md-outlined-button ?disabled=${this.historyBusy} @click=${()=>this.nativeHistoryAction("native.export")}>${this.l("Export this metadata history without paths","匯出此資料歷史，不含路徑")}</md-outlined-button>`:nothing}
            <md-dialog id="native-history-restore-dialog"><div slot="headline">${this.l("Restore native metadata?","還原原生資料？")}</div><div slot="content">${this.l("Replace the current metadata with the selected historical state as a new revision. This may remove later catalogue entries or change saved runtime and external-tree choices. Source and output files are not changed. Reopen affected projects after restoration.","將目前資料取代為所選歷史狀態並建立新版本，可能移除較後目錄項目或變更執行環境同外部樹選擇。來源同輸出檔案保持不變，還原後請重新開啟受影響專案。")} ${this.nativeRestoreRevision}</div><div slot="actions"><md-text-button ?disabled=${this.historyBusy} @click=${()=>this.closeDialog("native-history-restore-dialog")}>${this.l("Cancel","取消")}</md-text-button><md-filled-button ?disabled=${this.historyBusy} @click=${()=>this.nativeHistoryAction("native.restore")}>${this.l("Restore metadata","還原資料")}</md-filled-button></div></md-dialog>
            <h3>${this.l("Export scope","匯出範圍")}</h3>
            <md-outlined-select .label=${this.l("Include","包含")} .value=${this.exportScope} @change=${(e:Event)=>{this.exportScope=(e.target as HTMLSelectElement).value as typeof this.exportScope;this.requestUpdate();}}>
              <md-select-option value="workspace"><div slot="headline">${this.l("Current workspace, re-importable","目前工作區，可重新匯入")}</div></md-select-option>
              <md-select-option value="plans"><div slot="headline">${this.l("Selected saved plans","已選儲存計劃")}</div></md-select-option>
              <md-select-option value="revision-page"><div slot="headline">${this.l("Last 25 matching loaded revisions","最後 25 個符合篩選嘅已載入版本")}</div></md-select-option>
              <md-select-option value="revisions"><div slot="headline">${this.l("All complete recorded revisions (maximum 32 MiB)","全部完整已記錄版本（最大 32 MiB）")}</div></md-select-option>
              <md-select-option value="history"><div slot="headline">${this.l("Complete recorded activity","全部已記錄活動")}</div></md-select-option>
            </md-outlined-select>
            ${this.exportScope==="plans"?html`<md-text-button @click=${()=>{this.exportPlanIds=new Set(this.plans.map(p=>p.id));this.requestUpdate();}}>${this.l("Select all saved plans","選擇全部儲存計劃")}</md-text-button><md-text-button @click=${()=>{this.exportPlanIds=new Set(this.plans.filter(p=>!this.exportPlanIds.has(p.id)).map(p=>p.id));this.requestUpdate();}}>${this.l("Invert selection","反轉選擇")}</md-text-button>${this.plans.map(p=>html`<md-outlined-button data-appearance-key=${"export-plan:"+p.id} aria-pressed=${this.exportPlanIds.has(p.id)} @click=${()=>{this.exportPlanIds.has(p.id)?this.exportPlanIds.delete(p.id):this.exportPlanIds.add(p.id);this.requestUpdate();}}>${this.exportPlanIds.has(p.id)?"✓ ":""}${p.name}</md-outlined-button>`)}`:nothing}
            <p>${this.l("Exports exclude protected credentials, personal wording data and file metadata, custom images, service enrollments, project paths and build output. Plan names and notes are included: review for sensitive text. Only workspace JSON supports import. Encoding: UTF-8, LF line endings.","匯出唔包括受保護憑證、個人用字資料同檔案資料、自訂圖片、服務登記、專案路徑同建置輸出。計劃名稱同備註會包含在內，請檢查敏感文字。只有工作區 JSON 支援匯入，使用 UTF-8 同 LF 換行。")}</p>
            <md-filled-tonal-button ?disabled=${!this.canEditWorkspace||this.dirty||(this.exportScope==="plans"&&!this.plans.some(p=>this.exportPlanIds.has(p.id)))} @click=${this.exportPlans}>${materialIcon("download","icon")}${this.l("Export chosen scope","匯出所選範圍")}</md-filled-tonal-button>
            <input id="workspace-import-file" hidden style="display:none" type="file"
              accept="application/json,.json" tabindex="-1"
              ?disabled=${!this.canEditWorkspace || this.dirty}
              @change=${this.readImport}
            />`
        : html`<p>
            ${this.l(
              "Durable workspace storage is required for snapshots and importing.",
              "快照同匯入需要持久工作區儲存。",
            )}
          </p>`}
    </section>`;
  }
  private get selected() {
    return this.plans.find((p) => p.id === this.selectedId);
  }
  private updateWorkSaved() {
    if (!this.state || this.dirty || this.workspaceBusy || this.draft !== this.state.language || this.saveState === "saving" || this.schedulePanel()?.hasPendingDraft) return false;
    const panel = this.renderRoot.querySelector('operations-panel') as any;
    if (panel && (panel.pending || Object.keys(panel.changes || {}).length || panel.jobs?.some((job:any) => ['queued','running','cancelling'].includes(job.state)))) return false;
    // Unknown nested editors cannot silently claim that their drafts are saved.
    if (panel?.shadowRoot?.querySelector('source-panel,package-panel,tools-panel,guest-panel,companion-panel')) return false;
    return true;
  }
  private get dirty() {
    return (
      !!this.edit &&
      !!this.selected &&
      JSON.stringify(this.edit) !== JSON.stringify(this.selected)
    );
  }
  private shortcut = (e: KeyboardEvent) => {
    if (
      e.ctrlKey &&
      e.shiftKey &&
      e.key.toLowerCase() === "f" &&
      !e.isComposing
    ) {
      e.preventDefault();
      if (!this.renderRoot.querySelector("md-dialog[open]"))
        this.openDialog("actions-dialog");
    }
  };
  private async openDialog(id: string, e?: Event) {
    const active = e?.currentTarget as HTMLElement | undefined;
    this.dialogOpeners.set(
      id,
      active ?? ((this.renderRoot as ShadowRoot).activeElement as HTMLElement),
    );
    const existing = this.renderRoot.querySelector("md-dialog[open]") as any;
    if (existing && existing.id !== id) await existing.close();
    await (this.renderRoot.querySelector("#" + id) as any)?.show();
  }
  private closeDialog(id: string, destination = false) {
    if (destination) this.destinationDialogs.add(id);
    (this.renderRoot.querySelector("#" + id) as any)?.close();
  }
  private restoreFocus(id: string) {
    if (this.destinationDialogs.delete(id)) {
      this.renderRoot.querySelector<HTMLElement>("#workspace-heading")?.focus();
      return;
    }
    const opener = this.dialogOpeners.get(id);
    if (opener?.isConnected) opener.focus();
    else
      this.renderRoot.querySelector<HTMLElement>("#workspace-heading")?.focus();
  }
  private record(en: string, zh: string) {
    this.events = [
      { id: crypto.randomUUID(), en, zh, at: new Date().toISOString() },
      ...this.events,
    ].slice(0, 200);
  }
  private date(value: string) {
    return new Intl.DateTimeFormat(
      this.effectiveLanguage === "zh-HK" ? "zh-HK" : "en-GB",
      { dateStyle: "medium", timeStyle: "short" },
    ).format(new Date(value));
  }
  private async selectPlan(id: string) {
    if (this.dirty) {
      this.pendingDestination = "plan:" + id;
      this.openDialog("leave-dialog");
      return;
    }
    this.selectedId = id;
    this.edit = { ...this.selected! };
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>("#editor-heading")?.focus();
  }
  private updateEdit(key: keyof Plan, value: string) {
    if (this.edit) this.edit = { ...this.edit, [key]: value };
  }
  private async applyPlan() {
    if (!this.canEditWorkspace) return false;
    if (
      !this.edit ||
      !this.edit.name.trim() ||
      this.edit.name.trim().length > 80 ||
      this.edit.notes.length > 4000
    ) {
      this.notice = this.noticeText(
        "Enter a name of 1–80 characters and notes of up to 4000 characters.",
        "名稱須為 1–80 個字元，備註最多 4000 個字元。",
      );
      return false;
    }
    const plan = {
      ...this.edit,
      name: this.edit.name.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (this.workspaceMode === "durable") {
      const { name, runtime, target, status, notes } = plan;
      if (
        !(await this.mutateWorkspace("plan.update", {
          id: plan.id,
          changes: { name, runtime, target, status, notes },
        }))
      )
        return false;
      this.edit = this.selected ? { ...this.selected } : undefined;
      this.notice = this.noticeText(
        "Plan saved on this device.",
        "計劃已儲存喺呢部電腦。",
      );
      return true;
    }
    this.plans = this.plans.map((p) => (p.id === plan.id ? plan : p));
    this.edit = { ...plan };
    this.record(
      `Applied changes to ${plan.name}`,
      `已套用 ${plan.name} 嘅變更`,
    );
    this.notice = this.noticeText(
      "Plan updated for this session.",
      "已更新今次工作階段嘅計劃。",
    );
    return true;
  }
  private discardPlan() {
    if (this.selected) this.edit = { ...this.selected };
    this.notice = this.noticeText(
      "Pending plan changes discarded.",
      "已放棄計劃嘅待套用變更。",
    );
  }
  private async finishLeave(apply: boolean) {
    if (apply && !(await this.applyPlan())) return;
    if (!apply) this.discardPlan();
    this.closeDialog("leave-dialog", true);
    const target = this.pendingDestination;
    this.pendingDestination = "";
    if (target.startsWith("plan:")) void this.selectPlan(target.slice(5));
    else if (target === "new") this.openDialog("new-plan-dialog");
    else if (target === "export") this.exportPlans();
    else void this.go(target);
  }
  private beginNew(e?: Event) {
    this.newName = "";
    this.nameError = false;
    if (this.dirty) {
      this.pendingDestination = "new";
      this.openDialog("leave-dialog", e);
      return;
    }
    this.openDialog("new-plan-dialog", e);
  }
  private async createPlan(onboarding = false) {
    if (!this.canEditWorkspace) return;
    if (
      onboarding &&
      this.setupPlanId &&
      this.plans.some((p) => p.id === this.setupPlanId)
    ) {
      this.setupStep = 2;
      return;
    }
    if (this.dirty) {
      this.notice = this.noticeText(
        "Apply or discard pending plan edits before creating another plan.",
        "建立另一個計劃前，請先套用或放棄待套用變更。",
      );
      return;
    }
    const name = this.newName.trim();
    if (!name || name.length > 80 || this.plans.length >= 100) {
      this.nameError = true;
      return;
    }
    const at = new Date().toISOString();
    const plan: Plan = {
      id: crypto.randomUUID(),
      name,
      runtime: this.newRuntime,
      target: "image",
      status: "draft",
      notes: "",
      createdAt: at,
      updatedAt: at,
    };
    if (this.workspaceMode === "durable") {
      const oldIds = new Set(this.plans.map((p) => p.id));
      if (
        !(await this.mutateWorkspace(
          onboarding ? "onboarding.createPlan" : "plan.create",
          {
            plan: {
              name,
              runtime: this.newRuntime,
              target: "image",
              status: "draft",
              notes: "",
            },
          },
        ))
      )
        return;
      this.selectedId = this.plans.find((p) => !oldIds.has(p.id))?.id ?? "";
      this.edit = this.selected ? { ...this.selected } : undefined;
    } else {
      this.plans = [...this.plans, plan];
      this.selectedId = plan.id;
      this.edit = { ...plan };
      this.record(`Created plan ${name}`, `已建立計劃 ${name}`);
    }
    this.notice =
      this.workspaceMode === "durable"
        ? this.noticeText(
            "Plan saved. No project files were created.",
            "計劃已儲存，未建立專案檔案。",
          )
        : this.noticeText(
            "Session plan created. No project files were created.",
            "已建立工作階段計劃，未建立專案檔案。",
          );
    this.nameError = false;
    if (onboarding && this.workspaceMode === "durable") {
      // The host already recorded the plan and step 2 in the same transaction.
      this.restoreSetup(this.storedOnboarding);
      if (this.setupPlanId) {
        this.selectedId = this.setupPlanId;
        this.edit = this.selected ? { ...this.selected } : undefined;
      }
    } else if (onboarding) {
      this.setupPlanId = this.selectedId;
      await this.saveSetup(2);
    } else {
      this.closeDialog("new-plan-dialog", true);
      void this.go("projects");
    }
  }
  private async duplicatePlan() {
    if (!this.selected || this.plans.length >= 100 || !this.canEditWorkspace)
      return;
    const at = new Date().toISOString();
    const plan = {
      ...this.selected,
      id: crypto.randomUUID(),
      name: this.selected.name.slice(0, 70) + this.l(" (copy)", "（副本）"),
      createdAt: at,
      updatedAt: at,
    };
    if (this.workspaceMode === "durable") {
      const oldIds = new Set(this.plans.map((p) => p.id));
      const { name, runtime, target, status, notes } = plan;
      if (
        !(await this.mutateWorkspace("plan.create", {
          plan: { name, runtime, target, status, notes },
        }))
      )
        return;
      const created = this.plans.find((p) => !oldIds.has(p.id));
      if (created) void this.selectPlan(created.id);
      return;
    }
    this.plans = [...this.plans, plan];
    this.record(
      `Duplicated plan ${this.selected.name}`,
      `已複製計劃 ${this.selected.name}`,
    );
    void this.selectPlan(plan.id);
  }
  private async removePlan() {
    if (!this.canEditWorkspace) return;
    const name = this.selected?.name;
    if (!name) return;
    if (this.workspaceMode === "durable") {
      if (!(await this.mutateWorkspace("plan.delete", { id: this.selectedId })))
        return;
    } else this.plans = this.plans.filter((p) => p.id !== this.selectedId);
    this.selectedId = this.plans[0]?.id ?? "";
    this.edit = this.selected ? { ...this.selected } : undefined;
    if (this.workspaceMode === "session")
      this.record(`Removed plan ${name}`, `已移除計劃 ${name}`);
    this.closeDialog("remove-dialog");
    this.notice =
      this.workspaceMode === "durable"
        ? this.noticeText(
            "Plan removed from the saved workspace.",
            "已從儲存嘅工作區移除計劃。",
          )
        : this.noticeText(
            "Plan removed from this session. Its name remains in session activity.",
            "已從今次工作階段移除計劃，活動記錄仍保留其名稱。",
          );
  }
  private async exportPlans() {
    if (!this.canEditWorkspace) return;
    if (this.dirty) {
      this.pendingDestination = "export";
      this.openDialog("leave-dialog");
      return;
    }
    let document = JSON.stringify(
      {
        version: 1,
        kind: "material-buildroot-session-plans",
        plans: this.plans,
      },
      null,
      2,
    );
    if (this.workspaceMode === "durable") {
      try {
        const reply = await this.workspaceAPI.workspaceMutate!({action:"document.export",expectedRevision:this.workspaceRevision,scope:this.exportScope,ids:this.exportScope==="plans"?this.plans.filter(p=>this.exportPlanIds.has(p.id)).map(p=>p.id):this.exportScope==="revision-page"?this.filteredRevisionRows.slice(-25).map(row=>String(row.revision)):[]});
        if (!reply.ok || typeof reply.document !== "string") throw new Error("unavailable");
        document = reply.document;
      } catch {
        this.notice = this.noticeText(
          "Workspace export unavailable or exceeds its size bound. No partial export was produced; your plans are retained.",
          "未能匯出工作區，計劃仍然保留。",
        );
        return;
      }
    }
    const blob = new Blob([document], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `material-buildroot-${this.workspaceMode==="durable"?this.exportScope:"session-plans"}.json`;
    try {
      a.click();
      this.record("Plan download requested", "已要求下載計劃");
      this.notice = this.noticeText(
        "Download requested. Check your downloads to confirm the file was saved.",
        "已要求下載。請檢查下載項目，確認檔案已儲存。",
      );
    } catch {
      this.notice = this.noticeText(
        "Download could not be requested. Your session plans are retained.",
        "未能要求下載，工作階段計劃仍然保留。",
      );
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  private icon(name: string) {
    return materialIcon(({plans:"dashboard",operations:"computer",activity:"history",settings:"settings",about:"info"} as Record<string,string>)[name]||name);
  }

  private routeLabel(route: string, kind:"ui-copy"|"accessible-name"="ui-copy") {
    return route === "operations"
      ? this.owned("Project operations", "專案操作", kind)
      : route === "settings"
        ? this.owned("Settings", "設定", kind)
        : route === "activity"
          ? this.owned("Activity", "活動", kind)
          : route === "about"
            ? this.owned("About", "關於", kind)
            : this.owned("Project plans", "專案計劃", kind);
  }
  private navigation(dialog = false) {
    return html`${[
      "projects",
      "operations",
      "activity",
      "settings",
      "about",
    ].map(
      (route, index) =>
        html`<md-text-button
          data-experience-id=${"navigation:"+route} title=${this.routeLabel(route)} class=${this.route === route ? "selected" : ""}
          aria-label=${this.route === route
            ? `${this.routeLabel(route,"accessible-name")}, ${this.owned("current workspace", "目前工作區","accessible-name")}`
            : this.routeLabel(route,"accessible-name")}
          @click=${() => {
            if (dialog) this.closeDialog("navigation-dialog", true);
            void this.navigate(route);
          }}
          ><span class="navsymbol" aria-hidden="true"
            >${this.icon(
              ["plans", "operations", "activity", "settings", "about"][index],
            )}</span
          ><span class=${dialog ? "" : "navlabel"}
            >${this.routeLabel(route)}</span
          ></md-text-button
        >`,
    )}`;
  }
  private runtimeName(value: string) {
    return value === "wsl" ? "WSL 2" : "Docker";
  }
  private planForm() {
    if (!this.edit) return nothing;
    return html`<section class="panel editor" aria-labelledby="editor-heading">
      <div class="row">
        <h2 id="editor-heading" tabindex="-1">
          ${this.l("Plan details", "計劃詳情")}
        </h2>
        <span class="badge"
          >${this.dirty
            ? this.l("Pending changes", "待套用變更")
            : this.workspaceMode === "durable"
              ? this.l("Saved locally", "已儲存喺本機")
              : this.l("Session only", "只限今次工作階段")}</span
        >
      </div>
      <div class="fields">
        <md-outlined-text-field
          id="plan-name"
          class="wide"
          label=${this.l("Plan name", "計劃名稱")}
          .value=${this.edit.name}
          maxlength="80"
          required
          @input=${(e: Event) =>
            this.updateEdit(
              "name",
              (e.composedPath()[0] as HTMLInputElement).value,
            )}
        ></md-outlined-text-field
        ><md-outlined-select
          label=${this.l("Intended runtime", "預定執行環境")}
          id="plan-runtime"
          .value=${this.edit.runtime}
          .displayText=${this.runtimeName(this.edit.runtime)}
          @change=${(e: Event) =>
            this.updateEdit("runtime", (e.target as HTMLSelectElement).value)}
          >${this.options([
            ["wsl", "WSL 2"],
            ["docker", "Docker"],
          ])}</md-outlined-select
        ><md-outlined-select
          label=${this.l("Intended output", "預定輸出")}
          id="plan-target"
          .value=${this.edit.target}
          .displayText=${this.edit.target === "image"
            ? this.l("System image", "系統映像")
            : this.edit.target === "sdk"
              ? "SDK"
              : this.l("Toolchain", "工具鏈")}
          @change=${(e: Event) =>
            this.updateEdit("target", (e.target as HTMLSelectElement).value)}
          >${this.options([
            ["image", this.l("System image", "系統映像")],
            ["sdk", "SDK"],
            ["toolchain", this.l("Toolchain", "工具鏈")],
          ])}</md-outlined-select
        ><md-outlined-select
          class="wide"
          label=${this.l("Planning status", "計劃狀態")}
          id="plan-status"
          .value=${this.edit.status}
          .displayText=${this.edit.status === "draft"
            ? this.l("Draft", "草稿")
            : this.l("Ready for review", "可供檢視")}
          @change=${(e: Event) =>
            this.updateEdit("status", (e.target as HTMLSelectElement).value)}
          >${this.options([
            ["draft", this.l("Draft", "草稿")],
            ["ready-for-review", this.l("Ready for review", "可供檢視")],
          ])}</md-outlined-select
        ><md-outlined-text-field
          id="plan-notes"
          class="wide"
          type="textarea"
          rows="4"
          label=${this.l("Notes", "備註")}
          maxlength="4000"
          .value=${this.edit.notes}
          @input=${(e: Event) =>
            this.updateEdit(
              "notes",
              (e.composedPath()[0] as HTMLTextAreaElement).value,
            )}
        ></md-outlined-text-field>
      </div>
      <p class="muted">
        ${this.l(
          "Runtime and output are planning choices. No host has been checked and no build has started.",
          "執行環境同輸出只係計劃選項，未檢查主機，亦未開始建置。",
        )}
      </p>
      <div class="row">
        <md-filled-button
          ?disabled=${!this.dirty || !this.canEditWorkspace}
          @click=${() => this.applyPlan()}
          >${actionIcon('Apply changes')}${this.l("Apply changes", "套用變更")}</md-filled-button
        ><md-text-button
          ?disabled=${!this.dirty || !this.canEditWorkspace}
          @click=${this.discardPlan}
          >${actionIcon('Discard changes')}${this.l("Discard changes", "放棄變更")}</md-text-button
        ><md-outlined-button
          @click=${(e: Event) => this.openDialog("details-dialog", e)}
          >${actionIcon('Details')}${this.l("Details", "詳細資料")}</md-outlined-button
        >
      </div>
      <div class="row">
        <md-text-button
          ?disabled=${this.plans.length >= 100 ||
          this.dirty ||
          !this.canEditWorkspace}
          @click=${this.duplicatePlan}
          >${actionIcon('Duplicate')}${this.l("Duplicate", "複製")}</md-text-button
        ><md-text-button
          @click=${(e: Event) => this.openDialog("remove-dialog", e)}
          >${actionIcon('Remove plan')}${this.l("Remove plan", "移除計劃")}</md-text-button
        >
      </div>
    </section>`;
  }
  private details() {
    return this.selected
      ? html`<dl>
          <dt>${this.l("Name", "名稱")}</dt>
          <dd>${this.selected.name}</dd>
          <dt>${this.l("Runtime", "執行環境")}</dt>
          <dd>${this.runtimeName(this.selected.runtime)}</dd>
          <dt>${this.l("Created", "建立時間")}</dt>
          <dd>${this.date(this.selected.createdAt)}</dd>
          <dt>${this.l("Updated", "更新時間")}</dt>
          <dd>${this.date(this.selected.updatedAt)}</dd>
          <dt>${this.l("Storage", "儲存")}</dt>
          <dd>${this.scope()}</dd>
        </dl>`
      : html`<p>
          ${this.l("Select a plan to inspect it.", "選擇計劃以檢視資料。")}
        </p>`;
  }
  private plansView() {
    return html`<div class="workspace view">
      <section
        class="panel records"
        aria-label=${this.l("Session plans", "工作階段計劃")}
      >
        ${this.plans.length
          ? this.plans.map(
              (plan) =>
                html`<md-text-button data-appearance-key=${"plan:"+plan.id}
                  class=${plan.id === this.selectedId ? "selected" : ""}
                  aria-label=${plan.name}
                  aria-pressed=${plan.id === this.selectedId}
                  @click=${() => this.selectPlan(plan.id)}
                  ><span class="record-label"
                    ><strong>${plan.name}</strong
                    ><small
                      >${this.runtimeName(plan.runtime)} · ${plan.target}</small
                    ></span
                  ></md-text-button
                >`,
            )
          : html`<div class="empty">
              <span class="empty-symbol" aria-hidden="true">▦</span>
              <h2>${this.l("No plans yet", "未有計劃")}</h2>
              <p class="muted">
                ${this.l(
                  "Create a plan to organize your next Buildroot project.",
                  "建立計劃，整理下一個 Buildroot 專案。",
                )}
              </p>
              <md-filled-button @click=${(e: Event) => this.beginNew(e)}
                >${actionIcon('New plan')}${this.l("New plan", "新增計劃")}</md-filled-button
              >
            </div>`}
      </section>
      ${this.edit
        ? this.planForm()
        : html`<section class="panel empty">
            <h2>${this.l("Plan your project", "規劃專案")}</h2>
            <p>
              ${this.l(
                "Choose an intended runtime and output, add notes, then export your plans.",
                "選擇預定執行環境同輸出、加入備註，再匯出計劃。",
              )}
            </p>
            <p class="muted">
              ${this.l(
                "Project execution is not connected. Session plans do not create project files.",
                "專案執行尚未連接，工作階段計劃唔會建立專案檔案。",
              )}
            </p>
          </section>`}
    </div>`;
  }
  private settingsView() {
    return html`<div class="settings-grid view">
      <settings-search .language=${this.effectiveLanguage} .restricted=${this.restricted} .entries=${this.settingsEntries()} @settings-filter=${(e:CustomEvent<string[]>)=>{if(JSON.stringify(this.settingIds)!==JSON.stringify(e.detail)){this.settingIds=e.detail;this.requestUpdate();}}}></settings-search>
      ${!this.settingIds.length?html`<p>${this.l('No matching settings.','無符合嘅設定。')}</p>`:nothing}
      ${!this.restricted?html`<section
        class="panel stack" ?hidden=${!this.settingIds.includes("language")}
        aria-busy=${this.connection === "loading" || this.busy}
      >
        <h2>${this.owned("Language", "語言")}</h2>
        <p>
          ${this.l(
            "Bilingual is the default. A successful save persists across application restarts.",
            "預設使用雙語。成功儲存後，重新啟動都會保留。",
          )}
        </p>
        ${this.confirmedPreference()}<md-outlined-select
          id="language-select" data-experience-id="settings:language"
          .label=${this.l("Interface language", "介面語言")}
          .value=${this.draft}
          .displayText=${this.languageName(this.draft)}
          ?disabled=${!this.canSave}
          @change=${(e: Event) => {
            this.draft = (e.target as HTMLSelectElement).value as Language;
            if (
              this.saveState !== "unknown" &&
              this.saveState !== "refresh-unavailable"
            )
              this.saveState = "idle";
            this.windowNotice = false;
          }}
          >${this.options([
            ["en", "English"],
            ["zh-HK", "香港粵語"],
            ["bilingual", "English + 香港粵語"],
          ])}</md-outlined-select
        >
        <div
          class="row"
          role="group"
          aria-label=${this.l("Language actions", "語言操作")}
          aria-describedby="save-feedback"
        >
          <md-filled-button
            ?disabled=${!this.canSave}
            @click=${this.saveLanguage}
            >${this.busy
              ? this.l("Saving…", "儲存中…")
              : this.l("Save language", "儲存語言")}</md-filled-button
          ><md-text-button
            ?disabled=${!this.canDiscard}
            @click=${this.discardLanguage}
            >${actionIcon('Discard choice')}${this.l("Discard choice", "放棄選擇")}</md-text-button
          >
        </div>
        <p class="muted">${this.storageMessage()}</p>
        <p id="save-feedback">${this.statusMessage()}</p>
      </section>`:nothing}
      <section class="panel stack" ?hidden=${!this.settingIds.includes("appearance")} >
        <h2>${this.owned("Appearance", "外觀")}</h2>
        <md-outlined-select
          .label=${this.workspaceMode === "durable"
            ? this.l("Theme", "主題")
            : this.l("Theme for this session", "今次工作階段嘅主題")}
          .value=${this.theme}
          .displayText=${this.theme === "light"
            ? this.l("Light", "淺色")
            : this.theme === "dark"
              ? this.l("Dark", "深色")
              : this.l("Follow system", "跟隨系統")}
          @change=${(e: Event) => {
            void this.setTheme((e.target as HTMLSelectElement).value);
          }}
          >${this.options([
            ["system", this.l("Follow system", "跟隨系統")],
            ["light", this.l("Light", "淺色")],
            ["dark", this.l("Dark", "深色")],
          ])}</md-outlined-select
        >
        <p class="muted">
          ${this.workspaceMode === "durable"
            ? this.l(
                "Theme is saved on this device after a confirmed update.",
                "確認更新後，主題會儲存喺呢部電腦。",
              )
            : this.l(
                "Theme resets to the system preference on restart.",
                "重新啟動後，主題會跟隨系統。",
              )}
        </p>
      </section>
      <section class="panel stack" ?hidden=${!this.settingIds.includes('experience')}><experience-policy-panel .language=${this.effectiveLanguage}></experience-policy-panel></section>
      <section class="panel stack" ?hidden=${!this.settingIds.includes('shared')}><shared-mode-panel .snapshot=${this.sharedSnapshot} .language=${this.effectiveLanguage} @shared-mode-snapshot=${(e:CustomEvent<SharedModeSnapshot>)=>this.applySharedSnapshot(e.detail)}></shared-mode-panel></section>
      <section class="panel stack" ?hidden=${!this.settingIds.includes('schedules')}><scheduled-preferences-panel .language=${this.effectiveLanguage} .restricted=${this.restricted} .snapshot=${this.scheduleSnapshot} .baseLanguage=${this.state?.language||"bilingual"} .baseTheme=${this.theme} @scheduled-snapshot=${(e:CustomEvent<ScheduledPreferencesSnapshot|null>)=>this.applyScheduledSnapshot(e.detail)}></scheduled-preferences-panel></section>
      <div ?hidden=${!this.settingIds.includes('backups')}>${this.historyPanel()}</div>
      ${!this.restricted?html`<section class="panel stack" ?hidden=${!this.settingIds.includes('vocabulary')}><personal-vocabulary-panel .language=${this.effectiveLanguage} .restricted=${this.restricted}></personal-vocabulary-panel></section>`:nothing}
    </div>`;
  }
  private setupView() {
    return html`<span class="step"
        >${this.l("Step", "步驟")} ${this.setupStep + 1} / 3</span
      >
      <div class="progress" aria-hidden="true">
        ${[0, 1, 2].map(
          (step) =>
            html`<span class=${step <= this.setupStep ? "active" : ""}></span>`,
        )}
      </div>
      ${this.setupStep === 0
        ? html`<h2>
              ${this.l("Choose your intended runtime", "選擇預定執行環境")}
            </h2>
            <p>
              ${this.l(
                "Buildroot needs Linux. Record how you intend to run it; the optional check inspects installed runtimes without installing them.",
                "Buildroot 需要 Linux。記錄你打算使用嘅環境，選填檢查會檢視已安裝執行環境，唔會安裝。",
              )}
            </p>
            ${window.studio?.operations ? html`<div class="row"><md-outlined-button ?disabled=${this.setupChecking} @click=${async()=>{this.setupChecking=true;try{const r=await window.studio.operations!({action:"runtime.discover"});this.setupRuntime=r.ok?r.result:{code:r.code};}catch{this.setupRuntime={code:"RUNTIME_DISCOVERY_UNAVAILABLE"};}finally{this.setupChecking=false;}}}>${actionIcon('Check installed runtimes')}${this.l("Check installed runtimes","檢查已安裝執行環境")}</md-outlined-button><md-outlined-button @click=${async()=>{this.closeDialog("setup-dialog",true);await this.navigate("operations");const panel=this.activeOperations() as any;if(panel)panel.tab="runtime";}}>${actionIcon('Open trusted project setup')}${this.l("Open trusted project setup","開啟可信專案設定")}</md-outlined-button><md-outlined-button @click=${async()=>{this.closeDialog("setup-dialog",true);await this.navigate("operations");const panel=this.activeOperations() as any;if(panel)panel.tab="source";}}>${actionIcon('Clone source in workspace')}${this.l("Clone source in workspace","喺工作區複製來源")}</md-outlined-button></div>${this.setupRuntime?html`<p role="status">${this.setupRuntime.code||this.l("Runtime discovery completed. Inspect the project runtime workspace for distribution and container details.","已完成執行環境探索，請喺專案執行環境工作區檢視發行版同容器詳情。")}</p>`:nothing}`:nothing}
            <md-outlined-select
              label=${this.l("Intended runtime", "預定執行環境")}
              .value=${this.newRuntime}
              .displayText=${this.runtimeName(this.newRuntime)}
              @change=${(e: Event) =>
                (this.newRuntime = (e.target as HTMLSelectElement).value as
                  | "wsl"
                  | "docker")}
              >${this.options([
                ["wsl", "WSL 2"],
                ["docker", "Docker"],
              ])}</md-outlined-select
            >`
        : this.setupStep === 1
          ? html`<h2>${this.l("Create your first plan", "建立第一個計劃")}</h2>
              <p>
                ${this.l(
                  "Create an editable project plan.",
                  "建立可編輯嘅專案計劃。",
                ) +
                " " +
                this.scope()}
              </p>
              ${this.nameField()}`
          : html`<h2>
                ${this.l(
                  "Review preferences and start planning",
                  "檢視偏好設定並開始規劃",
                )}
              </h2>
              <p>
                ${this.l(
                  this.restricted?"Your plan is ready to edit. Choose a theme below.":"Your plan is ready to edit. Review language in Settings and choose a theme below.",
                  "計劃已可編輯。你可以喺設定檢視語言，並喺下面選擇主題。",
                )}
              </p>
              <md-outlined-select
                label=${this.workspaceMode === "durable"
                  ? this.l("Theme", "主題")
                  : this.l("Theme for this session", "今次工作階段嘅主題")}
                .value=${this.theme}
                .displayText=${this.theme === "light"
                  ? this.l("Light", "淺色")
                  : this.theme === "dark"
                    ? this.l("Dark", "深色")
                    : this.l("Follow system", "跟隨系統")}
                @change=${(e: Event) => {
                  void this.setTheme((e.target as HTMLSelectElement).value);
                }}
                >${this.options([
                  ["system", this.l("Follow system", "跟隨系統")],
                  ["light", this.l("Light", "淺色")],
                  ["dark", this.l("Dark", "深色")],
                ])}</md-outlined-select
              >${!this.restricted?html`<md-text-button
                @click=${() => {
                  this.setupDone = true;
                  this.closeDialog("setup-dialog", true);
                  void this.navigate("settings");
                }}
                >${actionIcon('Review language settings')}${this.l("Review language settings",
                  "檢視語言設定",
                )}</md-text-button
              >`:nothing}`}`;
  }
  private nameField() {
    return html`<md-outlined-text-field
      label=${this.l("Plan name", "計劃名稱")}
      .value=${this.newName}
      required
      maxlength="80"
      ?error=${this.nameError}
      error-text=${this.l(
        "Enter a name of 1–80 characters. Maximum 100 plans.",
        "名稱須為 1–80 個字元，最多 100 個計劃。",
      )}
      @input=${(e: Event) => {
        this.newName = (e.composedPath()[0] as HTMLInputElement).value;
        this.nameError = false;
      }}
    ></md-outlined-text-field>`;
  }
  private dialog(
    id: string,
    title: string,
    content: unknown,
    actions: unknown,
  ) {
    return html`<md-dialog id=${id} aria-label=${title} @closed=${() => this.restoreFocus(id)}
      ><div slot="headline">${title}</div>
      <div slot="content" class="dialog-content stack">
        ${content}${this.notice
          ? html`<p class="feedback" role="status">${this.restricted?this.noticeEnglish:this.notice}</p>`
          : nothing}
      </div>
      <div slot="actions">${actions}</div></md-dialog
    >`;
  }
  private commandKeys(e: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const buttons = Array.from(
      this.renderRoot.querySelectorAll<HTMLElement>(
        "#actions-dialog .commands md-text-button",
      ),
    ).filter((button) => !(button as any).disabled);
    const current = buttons.indexOf(
      (this.renderRoot as ShadowRoot).activeElement as HTMLElement,
    );
    const index =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? buttons.length - 1
          : e.key === "ArrowDown"
            ? (current + 1) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
    buttons[index]?.focus();
  }
  private closeButton(id: string) {
    return html`<md-text-button @click=${() => this.closeDialog(id)}
      >${actionIcon('Close')}${this.l("Close", "關閉")}</md-text-button
    >`;
  }
  render() {
    return html`<div class="shell ${this.dark ? "dark" : ""}">
      <attention-mode-panel .language=${this.effectiveLanguage} .restricted=${this.restricted} .startupEligible=${this.setupDone&&this.state?.origin==='saved'} data-experience-exempt></attention-mode-panel>
      <header>
        <md-text-button
          class="menu"
          aria-label=${this.l("Open navigation", "開啟導覽")}
          @click=${(e: Event) => this.openDialog("navigation-dialog", e)}
          >${materialIcon("menu")}</md-text-button
        >
        <div class="brand">
          <strong>Material Buildroot</strong
          ><small>${this.l("Desktop workspace", "桌面工作區")}</small>
        </div>
        <md-text-button
          aria-label=${this.l(
            "Open actions, Control Shift F",
            "開啟操作，Control Shift F",
          )}
          @click=${(e: Event) => this.openDialog("actions-dialog", e)}
          >${materialIcon("search","icon")}<span class="palette-label">
            ${this.l("Actions", "操作")} · Ctrl+Shift+F</span
          ></md-text-button
        >
        <div class="window">
          ${(["minimize", "maximize-restore", "close"] as const).map(
            (command, index) =>
              html`<md-text-button
                aria-label=${[
                  this.l("Minimize", "最小化"),
                  this.l("Maximize or restore", "最大化或還原"),
                  this.l("Close application", "關閉應用程式"),
                ][index]}
                ?disabled=${!window.studio}
                @click=${() => void this.controlWindow(command)}
                >${materialIcon(["remove", "crop_square", "close"][index])}</md-text-button
              >`,
          )}
        </div>
      </header>
      <div class="body">
        <nav aria-label=${this.l("Workspace navigation", "工作區導覽")}>
          ${this.navigation()}
          <div class="spacer"></div>
          <md-text-button
            aria-label=${this.l("Resume setup", "繼續設定")}
            @click=${(e: Event) => this.openDialog("setup-dialog", e)}
            ><span class="navsymbol" aria-hidden="true">${materialIcon("tune")}</span><span class="navlabel"
              >${actionIcon('Setup')}${this.l("Setup", "開始設定")}</span
            ></md-text-button
          >
        </nav>
        <workspace-tabs .language=${this.effectiveLanguage} .destinations=${this.workspaceDestinations()} @workspace-destination=${this.workspaceDestination} @workspace-close=${this.closeWorkspaceTab}>
        <main>
          <update-panel compact .language=${this.state?.language || "bilingual"} .canRestart=${() => this.updateWorkSaved()}></update-panel>
          <div class="toolbar">
            <div class="heading">
              <h1 id="workspace-heading" tabindex="-1">
                ${this.routeLabel(this.route)}
              </h1>
              <p class="muted">
                ${this.route === "projects"
                  ? `${this.plans.length} ${this.l("plans", "個計劃")} · ${this.scope()}`
                  : this.route === "activity"
                    ? this.workspaceMode === "durable"
                      ? this.l(
                          "Saved workspace changes, up to 100 events.",
                          "已儲存嘅工作區變更，最多保留 100 項。",
                        )
                      : this.l(
                          "Actual actions from this session, up to 200 events.",
                          "今次工作階段嘅實際操作，最多保留 200 項。",
                        )
                    : this.route === "settings"
                      ? this.workspaceMode === "durable"
                        ? this.l(
                            this.restricted?"Appearance is saved on this device.":"Language and theme are saved on this device.",
                            "語言同主題會儲存喺呢部電腦。",
                          )
                        : this.l(
                            this.restricted?"Appearance is session-only.":"Language is saved on this device. Appearance is session-only.",
                            "語言會儲存喺呢部電腦，外觀只限今次工作階段。",
                          )
                      : this.route === "operations"
                        ? this.l(
                            "Trusted projects, configuration, builds and outputs.",
                            "可信專案、設定、建置同輸出。",
                          )
                        : this.l(
                            "Installed application provenance",
                            "已安裝應用程式嘅來源資料",
                          )}
              </p>
            </div>
            ${!this.setupDone && this.route!=="projects"?html`<md-outlined-button @click=${(e:Event)=>this.openDialog("setup-dialog",e)}>${actionIcon('Start setup')}${this.l("Start setup","開始設定")}</md-outlined-button>`:nothing}
            ${this.route === "projects"
              ? html`<md-outlined-button
                    ?disabled=${!this.plans.length}
                    @click=${this.exportPlans}
                    >${actionIcon('Export plans')}${this.l("Export plans", "匯出計劃")}</md-outlined-button
                  ><md-filled-button
                    ?disabled=${this.plans.length >= 100 ||
                    !this.canEditWorkspace}
                    @click=${(e: Event) => this.beginNew(e)}
                    >${actionIcon('New plan')}${this.l("New plan", "新增計劃")}</md-filled-button
                  >`
              : nothing}
          </div>
          ${!this.setupDone && this.route === "projects"
            ? html`<section class="onboarding">
                <div class="heading">
                  <strong
                    >${this.l("Set up a project plan", "設定專案計劃")}</strong
                  >
                  <p>
                    ${this.l(
                      "Choose a runtime, create a plan and review preferences.",
                      "選擇執行環境、建立計劃，同埋檢視偏好設定。",
                    )}
                  </p>
                </div>
                <md-filled-tonal-button
                  @click=${(e: Event) => this.openDialog("setup-dialog", e)}
                  >${this.setupStep
                    ? this.l("Resume setup", "繼續設定")
                    : this.l("Start setup", "開始設定")}</md-filled-tonal-button
                ><md-text-button @click=${this.skipSetup}
                  >${actionIcon('Skip for now')}${this.l("Skip for now", "暫時略過")}</md-text-button
                >
              </section>`
            : nothing}${this.route === "settings"
            ? this.settingsView()
            : this.route === "operations"
              ? nothing
              : this.route === "projects"
                ? this.plansView()
                : this.route === "activity"
                  ? html`<section class="panel view">
                      ${this.events.length
                        ? html`<ul class="activity">
                            ${this.events.map(
                              (event) =>
                                html`<li data-appearance-key=${"activity:"+event.id}>
                                  ${this.l(event.en, event.zh)}<time
                                    datetime=${event.at}
                                    >${this.date(event.at)}</time
                                  >
                                </li>`,
                            )}
                          </ul>`
                        : html`<h2>${this.l("No activity yet", "未有活動")}</h2>
                            <p>
                              ${this.l(
                                "Creating, editing and exporting plans will appear here.",
                                "建立、編輯同匯出計劃嘅操作會顯示喺呢度。",
                              )}
                            </p>`}
                    </section>`
                  : html`<section class="panel view">
                      <h2>Material Buildroot</h2><details><summary>${this.l("Material Icons license", "Material Icons 授權")}</summary><p>Google Material Icons · Apache-2.0</p><pre style="white-space:pre-wrap;max-height:320px;overflow:auto" tabindex="0">${materialIconsLicense}</pre></details>
                      <dl>
                        <dt>${this.l("Version", "版本")}</dt>
                        <dd>
                          ${this.state?.version ??
                          this.l("Unavailable", "未能取得")}
                        </dd>
                        <dt>${this.l("Source", "來源")}</dt>
                        <dd>
                          ${this.state?.source ??
                          this.l("Unavailable", "未能取得")}
                        </dd>
                        <dt>${this.l("Updated", "更新時間")}</dt>
                        <dd>${this.buildTime()}</dd>
                      </dl>
                      <p class="notice">
                        ${this.l(
                          "Project execution is not connected to these planning controls.",
                          "呢啲計劃控制項尚未連接專案執行。",
                        ) +
                        " " +
                        this.scope()}
                      </p>
                    </section>`}${repeat([{workspaceId:'',name:''},...this.projectSessions],project=>project.workspaceId,project=>html`<operations-panel
            class="operations-host" data-project-id=${project.workspaceId}
            ?hidden=${this.route !== "operations"||this.activeProject!==project.workspaceId}
            .workspace=${project.workspaceId?project:undefined}
            .language=${this.effectiveLanguage} .restricted=${this.restricted}
            @workspace-adopted=${this.adoptedProject}
          ></operations-panel>`)}${this.notice
            ? html`<p class="notice" role="status">${this.restricted?this.noticeEnglish:this.notice}</p>`
            : nothing}
        </main></workspace-tabs>
      </div>
      <div class="status" role="status" aria-live="polite">
        ${this.restricted?this.sharedSnapshot?.active===true?`${this.sharedSnapshot.displayName??""} · Active`:"Shared preference status unavailable.":this.statusMessage()}
      </div>
      <personal-vocabulary-drop .language=${this.effectiveLanguage}></personal-vocabulary-drop>
      ${this.dialog(
        "navigation-dialog",
        this.l("Navigation", "導覽"),
        html`<div class="dialog-nav">${this.navigation(true)}</div>`,
        this.closeButton("navigation-dialog"),
      )}
      ${this.dialog(
        "new-plan-dialog",
        this.l("New project plan", "新增專案計劃"),
        html`<p>${this.scope()}</p>
          ${this.nameField()}<md-outlined-select
            label=${this.l("Intended runtime", "預定執行環境")}
            .value=${this.newRuntime}
            .displayText=${this.runtimeName(this.newRuntime)}
            @change=${(e: Event) =>
              (this.newRuntime = (e.target as HTMLSelectElement).value as
                | "wsl"
                | "docker")}
            >${this.options([
              ["wsl", "WSL 2"],
              ["docker", "Docker"],
            ])}</md-outlined-select
          >`,
        html`${this.closeButton("new-plan-dialog")}<md-filled-button
            ?disabled=${this.plans.length >= 100 || !this.canEditWorkspace}
            @click=${() => this.createPlan()}
            >${actionIcon('Create plan')}${this.l("Create plan", "建立計劃")}</md-filled-button
          >`,
      )}
      ${this.dialog(
        "details-dialog",
        this.l("Plan details", "計劃詳情"),
        this.details(),
        this.closeButton("details-dialog"),
      )}
      ${this.dialog(
        "remove-dialog",
        this.l("Remove this plan?", "移除呢個計劃？"),
        html`<p>${this.selected?.name}</p>
          <p>
            ${this.workspaceMode === "durable"
              ? this.l(
                  "This removes the saved plan and pending edits. Existing snapshots may still contain this plan.",
                  "呢個操作會移除已儲存嘅計劃同待套用變更，現有快照可能仍包含呢個計劃。",
                )
              : this.l(
                  "This removes the session plan and its pending edits. Its name remains in session activity.",
                  "呢個操作會移除工作階段計劃同待套用變更，活動記錄仍保留其名稱。",
                )}
          </p>`,
        html`${this.closeButton("remove-dialog")}<md-filled-button
            @click=${this.removePlan}
            >${actionIcon('Remove plan')}${this.l("Remove plan", "移除計劃")}</md-filled-button
          >`,
      )}
      ${this.dialog(
        "leave-dialog",
        this.l("Pending plan changes", "計劃有待套用變更"),
        html`<p>
          ${this.l(
            "Apply your edits before continuing, or discard them and use the last applied version.",
            "繼續之前，請套用變更，或者放棄變更並使用上次套用嘅版本。",
          )}
        </p>`,
        html`<md-text-button @click=${() => this.closeDialog("leave-dialog")}
            >${actionIcon('Stay')}${this.l("Stay", "留喺呢度")}</md-text-button
          ><md-outlined-button @click=${() => this.finishLeave(false)}
            >${actionIcon('Discard and continue')}${this.l("Discard and continue", "放棄並繼續")}</md-outlined-button
          ><md-filled-button @click=${() => this.finishLeave(true)}
            >${actionIcon('Apply and continue')}${this.l("Apply and continue", "套用並繼續")}</md-filled-button
          >`,
      )}
      ${this.dialog(
        "setup-dialog",
        this.l("Workspace setup", "工作區設定"),
        this.setupView(),
        html`<md-text-button @click=${this.skipSetup}
            >${actionIcon('Skip for now')}${this.l("Skip for now", "暫時略過")}</md-text-button
          >${this.setupStep > 0
            ? html`<md-text-button
                @click=${() => this.saveSetup(this.setupStep - 1)}
                >${actionIcon('Back')}${this.l("Back", "上一步")}</md-text-button
              >`
            : nothing}<md-filled-button
            @click=${() => {
              if (this.setupStep === 0) void this.saveSetup(1);
              else if (this.setupStep === 1) this.createPlan(true);
              else void this.completeSetup();
            }}
            >${this.setupStep === 0
              ? this.l("Next", "下一步")
              : this.setupStep === 1
                ? this.l("Create plan", "建立計劃")
                : this.l("Open workspace", "開啟工作區")}</md-filled-button
          >`,
      )}
      ${this.dialog(
        "restore-dialog",
        this.l("Restore workspace snapshot?", "還原工作區快照？"),
        html`<p>${this.restoreId.startsWith("revision:")?this.restoreId:this.snapshots.find((s) => s.id === this.restoreId)?.name}</p>
          <p>
            ${this.l(
              "This creates a new revision with the selected plans, theme and setup completion. Recorded earlier revisions remain available. Language settings are unchanged.",
              "呢個操作會以快照取代目前計劃、主題同設定完成狀態，語言設定維持不變。",
            )}
          </p>`,
        html`${this.closeButton("restore-dialog")}<md-filled-button
            ?disabled=${!this.canEditWorkspace || this.dirty}
            @click=${this.restoreSnapshot}
            >${actionIcon('Restore snapshot')}${this.l("Restore snapshot", "還原快照")}</md-filled-button
          >`,
      )}
      ${this.dialog(
        "import-dialog",
        this.l("Replace workspace from file?", "以檔案取代工作區？"),
        html`<p>${this.importSummary}</p>
          <p>
            ${this.l(
              "The host validates the complete document before any change. Existing snapshots remain available.",
              "主機會喺變更之前驗證完整文件，現有快照仍可使用。",
            )}
          </p>`,
        html`${this.closeButton("import-dialog")}<md-filled-button
            ?disabled=${!this.canEditWorkspace ||
            this.dirty ||
            !this.importText}
            @click=${this.applyImport}
            >${actionIcon('Import and replace')}${this.l("Import and replace", "匯入並取代")}</md-filled-button
          >`,
      )}
      ${this.dialog(
        "actions-dialog",
        this.l("Workspace actions", "工作區操作"),
        html`<p class="muted">
            ${this.l(
              "Choose an action. Use Tab to move between actions and Enter to activate.",
              "選擇操作，按 Tab 切換操作，按 Enter 執行。",
            )}
          </p>
          <div class="commands stack" @keydown=${this.commandKeys}>
            ${["projects", "operations", "activity", "settings", "about"].map(
              (route) =>
                html`<md-text-button
                  @click=${() => {
                    this.closeDialog("actions-dialog", true);
                    void this.navigate(route);
                  }}
                  >${this.routeLabel(route)}</md-text-button
                >`,
            )}<md-text-button @click=${this.sharedPreferenceAction}>${materialIcon('security','icon')}${this.l('Shared preference','共用偏好')}</md-text-button><md-text-button @click=${this.scheduledPreferenceAction}>${materialIcon('history','icon')}${this.l('Scheduled preferences','偏好排程')}</md-text-button>${vocabulary.school()==='inactive'?(['upload','status','clear'] as const).map(action=>html`<md-text-button @click=${()=>this.vocabularyAction(action)}>${materialIcon(action==='upload'?'upload':action==='clear'?'delete':'info','icon')}${action==='upload'?this.owned('Import personal vocabulary','匯入個人詞彙'):action==='clear'?this.owned('Clear personal vocabulary','清除個人詞彙'):this.owned('Personal vocabulary status','個人詞彙狀態')}</md-text-button>`):nothing}<md-text-button @click=${async()=>{this.closeDialog("actions-dialog",true);await this.navigate("operations");await this.updateComplete;const panel=this.activeOperations() as any;if(panel)panel.tab="documentation";}}>${materialIcon("help_outline","icon")}${this.l("Help & documentation","說明同文件")}</md-text-button><md-text-button
              ?disabled=${this.plans.length >= 100 || !this.canEditWorkspace}
              @click=${() => {
                this.closeDialog("actions-dialog");
                this.beginNew();
              }}
              >${actionIcon('New plan')}${this.l("New plan", "新增計劃")}</md-text-button
            ><md-text-button
              ?disabled=${!this.plans.length}
              @click=${() => {
                this.closeDialog("actions-dialog");
                this.exportPlans();
              }}
              >${actionIcon('Export plans')}${this.l("Export plans", "匯出計劃")}</md-text-button
            ><md-text-button
              @click=${() => {
                this.closeDialog("actions-dialog");
                this.openDialog("setup-dialog");
              }}
              >${actionIcon('Resume setup')}${this.l("Resume setup", "繼續設定")}</md-text-button
            >
          </div>`,
        this.closeButton("actions-dialog"),
      )}
    </div>`;
  }
}
customElements.define("material-buildroot", MaterialBuildroot);
