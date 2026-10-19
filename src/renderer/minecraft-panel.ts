import {localizedCopy} from './language-wording';
import "./minecraft-workflow-panel";
import "./minecraft-remote-panel";
import { LitElement, html, css, nothing } from "lit";
import "@material/web/button/outlined-button.js";
import "@material/web/button/filled-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/checkbox/checkbox.js";
import { workspaceStyles } from "./workspace-styles";
import { inheritedWorkspaceTheme } from "./inherited-workspace-theme";

type Grant = { id: string; name: string };
type Version = { id: string; type?: string };
export class MinecraftPanel extends LitElement {
  static properties = { language: { type: String }, revision: { state: true } };
  language = "bilingual";
  revision = 0;
  private busy = false;
  private message = "";
  private tab = "distribution";
  private edition = "java";
  private flavour = "vanilla";
  private target = "local-process";
  private version = "";
  private query = "";
  private versions: Version[] = [];
  private paperBuilds: string[] = [];
  private paperBuild = "";
  private flavourLicense = false;
  private fabricLoaders: string[] = [];
  private fabricInstallers: string[] = [];
  private fabricLoader = "";
  private fabricInstaller = "";
  private fabricDownloads = false;
  private fabricFolder = "fabric-server";
  private fabricSetupState = "idle";
  private serverEntry = "server.jar";
  private extensions: any[] = [];
  private extensionRevision = "";
  private extensionStopped = false;
  private extensionRecovery = "";
  private shown = 100;
  private directory?: Grant;
  private pluginDirectory?: Grant;
  private project = "";
  private pluginVersions: any[] = [];
  private pluginVersion = "";
  private pluginConsent = false;
  private eula = false;
  private execution = false;
  private serverId = "my-server";
  private memory = "2048";
  private port = "25565";
  private players = "20";
  private difficulty = "normal";
  private mode = "survival";
  private serverName = "Minecraft server";
  private world = "world";
  private allowlist = true;
  private host = "";
  private remoteDirectory = "";
  private image = "";
  private state = "not-managed";
  private readiness = "unknown";
  private onlineNames: string[] = [];
  private discoveryNote = "";
  static styles = [workspaceStyles, inheritedWorkspaceTheme, css`
    :host { display:block; min-width:0; } .stack { display:grid; gap:16px; }
    .columns { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px; }
    .row { display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
    md-outlined-text-field, md-outlined-select { width:100%; min-width:0; }
    .note { color:var(--md-sys-color-on-surface-variant); overflow-wrap:anywhere; }
    nav { display:flex; flex-wrap:wrap; gap:8px; } nav [aria-pressed=true] { --md-outlined-button-outline-color:var(--md-sys-color-primary); }
    .status { padding:12px; background:var(--md-sys-color-surface-container); border-radius:12px; overflow-wrap:anywhere; }
  `];
  private l(en:string,zh:string,authored=false) {return localizedCopy(en,zh,this.language,authored);}
  private change() { this.revision++; }
  private async call(action: string, fields: Record<string, unknown> = {}) {
    const reply: any = await window.studio?.operations({ action, ...fields });
    if (!reply?.ok || reply.result?.ok === false || reply.result?.cancelled) throw new Error(reply?.code || reply?.result?.code || "CANCELLED");
    return reply.result;
  }
  private tool(request: Record<string, unknown>) { return this.call("tools", { request }); }
  private async run(work: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true; this.message = ""; this.change();
    try { await work(); this.message ||= this.l("Operation completed. Runtime acceptance remains unverified.","操作完成，執行驗收仍未驗證。",true); }
    catch (error) { const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "OPERATION_FAILED"; this.message = this.l("Operation incomplete","操作未完成",true) + ": " + code; }
    finally { this.busy = false; this.change(); }
  }
  private get primaryAction(){
    if(this.tab==='distribution'){
      if(!this.version)return 'Discover official versions';
      if(!this.directory)return 'Choose trusted server folder';
      if(this.edition==='bedrock')return 'Discover official versions';
      if(this.flavour==='paper')return this.paperBuild?'Install selected Paper build':'Load stable Paper builds';
      if(this.flavour==='fabric')return this.fabricLoader&&this.fabricInstaller?'Install complete Fabric files':'Load compatible Fabric launchers';
      return 'Install selected vanilla server';
    }
    if(this.tab==='configuration')return !this.directory?'Choose trusted server folder':this.eula?'Save configuration':'Read current configuration';
    if(this.tab==='extensions')return !this.directory?'Choose trusted server folder':this.pluginVersion?'Install or update selected extension':this.project.trim()&&this.version?'Find compatible releases':'Load managed extensions';
    if(this.tab==='lifecycle')return this.state==='not-managed'&&this.eula&&this.execution&&this.version?'Start selected server':'Refresh server status';
    return '';
  }
  private button(en: string, zh: string, work: () => Promise<void>, disabled = false) { if(en===this.primaryAction)return html`<md-filled-button data-primary-action=${en} ?disabled=${this.busy||disabled} @click=${()=>this.run(work)}>${this.l(en,zh,true)}</md-filled-button>`;return html`<md-outlined-button ?disabled=${this.busy || disabled} @click=${() => this.run(work)}>${this.l(en, zh,true)}</md-outlined-button>`; }
  private field(en: string, zh: string, value: string, set: (v: string) => void, type = "text") { return html`<md-outlined-text-field .label=${this.l(en, zh,true)} .value=${value} .type=${type} ?disabled=${this.busy} @input=${(e: Event) => { set((e.target as HTMLInputElement).value); this.change(); }}></md-outlined-text-field>`; }
  private select(en: string, zh: string, value: string, choices: string[], set: (v: string) => void) { return html`<md-outlined-select .label=${this.l(en, zh,true)} .value=${value} .displayText=${value} ?disabled=${this.busy} @change=${(e: Event) => { set((e.target as HTMLSelectElement).value); this.change(); }}>${choices.map(v => html`<md-select-option .value=${v}><div slot="headline">${v}</div></md-select-option>`)}</md-outlined-select>`; }
  private check(en: string, zh: string, checked: boolean, set: (v: boolean) => void) { return html`<label class="row"><md-checkbox aria-label=${this.l(en, zh,true)} ?checked=${checked} ?disabled=${this.busy} @change=${(e: Event) => { set((e.target as HTMLInputElement).checked); this.change(); }}></md-checkbox><span>${this.l(en, zh,true)}</span></label>`; }
  private async choose() { this.directory = await this.call("file.choose", { access: "write", kind: "directory" }); }
  private async discover() {
    this.versions = []; this.version = ""; this.shown = 100; this.paperBuilds = []; this.paperBuild = "";
    if (this.edition === "bedrock") {
      const result = await this.tool({ action: "minecraft.bedrock.discovery" });
      this.versions = result.releases.map((v: any) => ({ id: v.version, type: v.platform }));
      this.discoveryNote = this.l("Current official download links only. Historical availability and automatic archive admission remain unavailable. Install an official distribution manually in the trusted folder before starting.","只列出現時官方下載連結，歷史版本同自動壓縮檔認可尚未提供。啟動前請手動將官方發行檔安裝到信任資料夾。",true);
    } else if (this.flavour === "vanilla") {
      const result = await this.tool({ action: "minecraft.versions", edition: "java" });
      this.versions = result.versions;
      this.discoveryNote = this.l("Every official catalogue entry is retained. Some older versions have no server distribution. Runtime compatibility is not inferred from catalogue membership.","保留官方目錄所有項目，部分舊版本無伺服器發行檔。目錄收錄唔代表執行相容性已驗證。",true);
    } else {
      const result = await this.tool({ action: "minecraft.flavours", flavour: this.flavour });
      this.versions = this.flavour === "fabric" ? result.gameVersions.map((v: any) => ({ id: v.version })) : (result.metadata.versions || []).map((id: string) => ({ id }));
      this.discoveryNote = this.flavour === "paper" ? this.l("Choose an explicit stable build. Installation checks the official SHA-256 and never replaces server.jar.","請明確選擇穩定版本，安裝會檢查官方 SHA-256，唔會取代 server.jar。",true) : this.l("Discovery and official launcher acquisition are available. Runtime dependencies are obtained later by the launcher. Plugins and mods must match the exact version and loader.","可探索版本同取得官方啟動器。啟動器之後先取得執行依賴，插件同模組必須配對確實版本同載入器。",true);
    }
    this.version = this.versions[0]?.id || "";
  }
  private properties() { return { "server-port": Number(this.port), "max-players": Number(this.players), difficulty: this.difficulty, gamemode: this.mode, "online-mode": true, [this.edition === "java" ? "white-list" : "allow-list"]: this.allowlist, [this.edition === "java" ? "motd" : "server-name"]: this.serverName, "level-name": this.world }; }
  private async loadExtensions() { const result = await this.tool({ action: "minecraft.extensions.list", directoryId: this.directory?.id }); this.extensions = result.projects; this.extensionRevision = result.revision; this.extensionRecovery = result.recoveryProject || ""; }
  private async extensionOperation(action: string, fields: Record<string, unknown>) { await this.tool({ action, directoryId: this.directory?.id, gameVersion: this.version, loader: this.flavour, revision: this.extensionRevision, confirmStopped: this.extensionStopped, acceptPluginCode: this.pluginConsent, acceptLicense: this.pluginConsent, ...fields }); await this.loadExtensions(); }
  private async readConfiguration() {
    const result = await this.tool({ action: "minecraft.configuration.read", directoryId: this.directory?.id, edition: this.edition });
    const p = result.properties;
    this.port = p["server-port"] ?? this.port; this.players = p["max-players"] ?? this.players;
    this.difficulty = p.difficulty ?? this.difficulty; this.mode = p.gamemode ?? this.mode;
    this.serverName = p[this.edition === "java" ? "motd" : "server-name"] ?? this.serverName;
    this.world = p["level-name"] ?? this.world; this.allowlist = p[this.edition === "java" ? "white-list" : "allow-list"] !== "false";
    this.message = this.l("Supported values loaded. Other properties are preserved when saving. Changes require a stopped server and restart.","已載入支援設定，儲存時保留其他設定。修改前必須停止伺服器，之後重新啟動。",true);
  }
  render() {
    const remote = this.target.startsWith("ssh-"), container = this.target.endsWith("container");
    const filtered = this.versions.filter(v => v.id.toLowerCase().includes(this.query.toLowerCase()));
    const compatiblePlugins = this.pluginVersions.filter(v => v.game_versions?.includes(this.version) && v.loaders?.includes(this.flavour));
    return html`<section class="panel stack" aria-label=${this.l("Minecraft server manager","Minecraft 伺服器管理員",true)}>
      <h2>${this.l("Minecraft server manager","Minecraft 伺服器管理員",true)}</h2>
      <nav aria-label=${this.l("Server workflow","伺服器流程",true)}>${[["distribution", "Distribution", "發行檔"], ["configuration", "Configuration", "設定"], ["extensions", "Plugins and mods", "插件同模組"], ["lifecycle", "Run and stop", "執行同停止"], ["worlds", "Worlds", "世界"], ["players", "Players", "玩家"], ["commands", "Console actions", "主控台操作"], ["records", "Profiles and schedules", "設定檔同排程"], ["remote", "Remote transfer", "遠端傳送"]].map(([id, en, zh]) => html`<md-outlined-button aria-pressed=${this.tab === id} @click=${() => { this.tab = id; this.change(); }}>${this.l(en, zh,true)}</md-outlined-button>`)}</nav>
      <div role="status" aria-live="polite" class="status">${this.busy ? this.l("Operation in progress","操作進行中",true) : this.message || this.l("Choose a distribution and a trusted server folder to begin.","先選擇發行檔同信任伺服器資料夾。",true)}</div>
      <div class="columns">${this.select("Edition", "版本類別", this.edition, ["java", "bedrock"], v => { this.edition = v; this.port = v === "java" ? "25565" : "19132"; this.versions = []; this.version = ""; this.pluginVersions = []; this.eula = false; if (v === "bedrock") this.mode = "survival"; })}${this.edition === "java" ? this.select("Flavour", "發行種類", this.flavour, ["vanilla", "paper", "fabric"], v => { this.flavour = v; this.versions = []; this.version = ""; this.pluginVersions = []; }) : nothing}</div>
      <div class="row">${this.button("Choose trusted server folder", "選擇信任伺服器資料夾", () => this.choose())}<span>${this.directory?.name || this.l("No folder selected","未選資料夾",true)}</span></div>
      ${this.tab === "distribution" ? html`<div class="stack">
        ${this.button("Discover official versions", "探索官方版本", () => this.discover())}
        ${this.field("Search versions", "搜尋版本", this.query, v => { this.query = v; this.shown = 100; })}
        ${this.select("Version", "版本", this.version, [...new Set([...(this.version ? [this.version] : []), ...filtered.slice(0, this.shown).map(v => v.id)])], v => { this.version = v; this.pluginVersions = []; this.paperBuilds = []; this.paperBuild = ""; })}
        <p>${filtered.length} ${this.l("matching catalogue entries","個相符目錄項目",true)}</p>
        ${filtered.length > this.shown ? this.button("Show more versions", "顯示更多版本", async () => { this.shown += 100; }) : nothing}
        <p class="note">${this.discoveryNote}</p>
        ${this.edition === "java" && this.flavour === "fabric" ? html`<div class="stack">
          ${this.button("Load compatible Fabric launchers", "載入相容 Fabric 啟動器", async () => { const r = await this.tool({ action: "minecraft.fabric.options", version: this.version }); this.fabricLoaders = r.loaders; this.fabricInstallers = r.installers; this.fabricLoader = r.loaders[0] || ""; this.fabricInstaller = r.installers[0] || ""; }, !this.version)}
          ${this.select("Fabric loader", "Fabric 載入器", this.fabricLoader, this.fabricLoaders, v => this.fabricLoader = v)}${this.select("Fabric installer", "Fabric 安裝器", this.fabricInstaller, this.fabricInstallers, v => this.fabricInstaller = v)}
          ${this.check("I accept the Fabric licence and later launcher runtime downloads", "我接受 Fabric 授權同啟動器之後下載執行檔", this.fabricDownloads, v => this.fabricDownloads = v)}
          <p class="note">${this.l("Downloads only the official launcher. Current metadata must admit the exact combination. Its local SHA-256 is recorded; no upstream checksum is claimed. First launch may acquire additional runtime files, which are not installed by this operation.","只下載官方啟動器，目前資料必須接納確實組合。記錄本機 SHA-256，唔聲稱上游校驗摘要已驗證。首次啟動可能再下載執行檔，今次操作唔會安裝嗰啲檔案。",true)}</p>
          ${this.button("Acquire Fabric launcher", "取得 Fabric 啟動器", async () => { await this.tool({ action: "minecraft.fabric.install", version: this.version, loader: this.fabricLoader, installer: this.fabricInstaller, directoryId: this.directory?.id, acceptLicense: this.fabricDownloads, acceptRuntimeDownloads: this.fabricDownloads }); }, !this.version || !this.fabricLoader || !this.fabricInstaller || !this.directory || !this.fabricDownloads)}
          ${this.field("New installation subfolder", "新安裝子資料夾", this.fabricFolder, v => this.fabricFolder = v)}
          ${this.button("Install complete Fabric files", "安裝完整 Fabric 檔案", async () => { try { const result = await this.tool({ action: "minecraft.fabric.complete", version: this.version, loader: this.fabricLoader, installer: this.fabricInstaller, directoryId: this.directory?.id, folderName: this.fabricFolder, acceptLicense: this.fabricDownloads, acceptRuntimeDownloads: this.fabricDownloads }); this.serverEntry = "fabric-server-launch.jar"; this.message = this.l("Files installed. Choose the new subfolder, create configuration and accept the EULA before starting. Runtime remains unverified.", "檔案已安裝，啟動前請選新子資料夾、建立設定並接受 EULA，執行仍未驗證。", true) + " " + result.folderName; } finally { this.fabricSetupState = (await this.tool({ action: "minecraft.fabric.setup.status" })).state; } }, !this.directory || !this.fabricLoader || !this.fabricInstaller || !this.fabricDownloads || !this.fabricFolder)}
          <div class="row"><md-outlined-button @click=${async () => { this.fabricSetupState = (await this.tool({ action: "minecraft.fabric.setup.status" })).state; this.change(); }}>${this.l("Refresh Fabric setup", "重新整理 Fabric 安裝")}</md-outlined-button><md-outlined-button @click=${async () => { try { await this.tool({ action: "minecraft.fabric.setup.cancel" }); this.fabricSetupState = "cancelling"; } catch { this.fabricSetupState = "not-active"; } this.change(); }}>${this.l("Cancel Fabric setup", "取消 Fabric 安裝")}</md-outlined-button><span>${this.fabricSetupState}</span></div>
        </div>` : nothing}
        ${this.edition === "java" && this.flavour === "paper" ? html`<div class="stack">${this.button("Load stable Paper builds", "載入穩定 Paper 版本", async () => { const result = await this.tool({ action: "minecraft.paper.builds", version: this.version }); this.paperBuilds = result.builds.map((b: any) => String(b.id)); this.paperBuild = this.paperBuilds[0] || ""; }, !this.version)}${this.select("Paper build", "Paper 建置版本", this.paperBuild, this.paperBuilds, v => this.paperBuild = v)}${this.check("I accept the Paper distribution licence", "我接受 Paper 發行授權", this.flavourLicense, v => this.flavourLicense = v)}${this.button("Install selected Paper build", "安裝所選 Paper 版本", async () => { await this.tool({ action: "minecraft.paper.install", version: this.version, build: Number(this.paperBuild), directoryId: this.directory?.id, acceptLicense: this.flavourLicense }); }, !this.paperBuild || !this.directory || !this.flavourLicense)}</div>` : nothing}
        ${this.edition === "java" && this.flavour === "vanilla" ? this.button("Install selected vanilla server", "安裝所選原版伺服器", async () => { await this.tool({ action: "minecraft.install", edition: "java", version: this.version, directoryId: this.directory?.id }); }, !this.directory || !this.version) : this.edition === "bedrock" ? html`<p class="note">${this.l("Automatic installation unavailable for this distribution. Existing files are never replaced.","此發行檔未提供自動安裝，唔會取代現有檔案。",true)}</p>` : nothing}
      </div>` : nothing}
      ${this.tab === "configuration" ? html`<div class="stack">
        ${this.button("Read current configuration", "讀取現有設定", () => this.readConfiguration(), !this.directory)}
        <div class="columns">${this.field("Server name", "伺服器名稱", this.serverName, v => this.serverName = v)}${this.field("World folder name", "世界資料夾名稱", this.world, v => this.world = v)}${this.field("Port (1024–65535)", "連接埠（1024–65535）", this.port, v => this.port = v, "number")}${this.field("Maximum players (1–1000)", "玩家上限（1–1000）", this.players, v => this.players = v, "number")}${this.select("Difficulty", "難度", this.difficulty, ["peaceful", "easy", "normal", "hard"], v => this.difficulty = v)}${this.select("Game mode", "遊戲模式", this.mode, this.edition === "java" ? ["survival", "creative", "adventure", "spectator"] : ["survival", "creative", "adventure"], v => this.mode = v)}</div>
        ${this.check("Require allowlist membership", "要求允許清單成員資格", this.allowlist, v => this.allowlist = v)}
        ${this.check("I have read and accept the Minecraft EULA", "我已閱讀並接受 Minecraft EULA", this.eula, v => this.eula = v)}
        <a href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">Minecraft EULA</a>
        <p class="note">${this.l("Online authentication remains enabled. This editor changes only the listed properties and preserves unknown settings. Existing configuration receives a backup. Stop any externally managed server before saving. The numeric limits are application limits, not a claim of compatibility with every historical version.","保持啟用線上驗證。編輯器只改列出設定，保留未知設定並備份現有設定。儲存前請停止外部管理嘅伺服器。數值範圍係應用程式限制，唔代表所有歷史版本都相容。",true)}</p>
        ${this.button("Save configuration", "儲存設定", async () => { await this.tool({ action: "minecraft.configuration.save", directoryId: this.directory?.id, edition: this.edition, acceptEula: this.eula, properties: this.properties() }); }, !this.directory || !this.eula)}
      </div>` : nothing}
      ${this.tab === "extensions" ? html`<div class="stack">
        <p class="note">${this.l("Choose the server version and loader first. Discovery returns Modrinth project releases; only matching version and loader entries are offered. Automatic third-party dependencies, upgrades and rollback remain unavailable.","先選伺服器版本同載入器。探索傳回 Modrinth 發行項目，只提供配對版本同載入器嘅選項。暫未提供自動第三方依賴、升級同回復。",true)}</p>
        ${this.field("Modrinth project ID or slug", "Modrinth 項目識別碼或簡稱", this.project, v => this.project = v)}
        ${this.button("Find compatible releases", "搜尋相容發行版本", async () => { const result = await this.tool({ action: "minecraft.plugins", projectId: this.project.trim() }); this.pluginVersions = result.versions; this.pluginVersion = ""; }, !this.project.trim() || !this.version)}
        ${this.select("Compatible release ID", "相容發行識別碼", this.pluginVersion, compatiblePlugins.map(v => v.id), v => this.pluginVersion = v)}
        <p>${compatiblePlugins.length} ${this.l("compatible releases","個相容發行版本",true)}</p>
        ${this.button("Load managed extensions", "載入受管理擴充", () => this.loadExtensions(), !this.directory)}
        ${this.check("I trust this extension code and accept its licence", "我信任此擴充程式碼並接受授權", this.pluginConsent, v => this.pluginConsent = v)}
        ${this.check("I confirmed this server is stopped before extension changes", "我已確認修改擴充前伺服器已停止", this.extensionStopped, v => this.extensionStopped = v)}
        ${this.extensionRecovery ? this.button("Recover prior extension state", "復原之前擴充狀態", () => this.extensionOperation("minecraft.extensions.recover", { projectId: this.extensionRecovery }), !this.extensionStopped || !this.pluginConsent) : nothing}
        <p class="note">${this.l("Managed changes use the selected server root, verify its distribution receipt and preserve up to 20 historical versions per project. Unknown files are never adopted. Incomplete changes retain a recovery marker and block startup.", "受管理修改使用所選伺服器根目錄、驗證發行收據，並為每個項目保留最多 20 個歷史版本。唔會接管未知檔案。未完成修改會保留復原標記並阻止啟動。", true)}</p>
        ${this.extensions.map(record => html`<div class="status stack"><strong>${record.projectId}</strong><span>${record.current?.filename || this.l("Removed with history retained", "已移除並保留歷史", true)}</span>${record.current ? this.button("Remove managed extension", "移除受管理擴充", () => this.extensionOperation("minecraft.extensions.remove", { projectId: record.projectId }), !this.extensionStopped || !this.pluginConsent) : nothing}${record.history.map((snapshot: any) => html`<div class="row"><span>${snapshot.versionId} · ${snapshot.storedAt}</span>${this.button("Restore this retained version", "還原此保留版本", () => this.extensionOperation("minecraft.extensions.rollback", { projectId: record.projectId, snapshotId: snapshot.snapshotId }), !this.extensionStopped || !this.pluginConsent)}</div>`)}</div>`)}
        ${this.button("Install or update selected extension", "安裝或更新所選擴充", () => this.extensionOperation("minecraft.extensions.install", { versionId: this.pluginVersion }), !this.directory || !this.pluginVersion || !this.pluginConsent || !this.extensionStopped || !this.extensionRevision || this.edition !== "java")}
      </div>` : nothing}
      ${this.tab === "lifecycle" ? html`<div class="stack">
        ${this.edition === "java" ? this.select("Java server entry point", "Java 伺服器進入點", this.serverEntry, ["server.jar", "fabric-server-launch.jar"], v => this.serverEntry = v) : nothing}
        ${this.select("Execution target", "執行目標", this.target, ["local-process", "local-container", "ssh-process", "ssh-container"], v => { this.target = v; this.execution = false; })}
        <div class="columns">${this.field("Managed server identifier", "受管理伺服器識別碼", this.serverId, v => { this.serverId = v; this.state = "not-managed"; })}${this.field("Memory MiB (512–32768)", "記憶體 MiB（512–32768）", this.memory, v => this.memory = v, "number")}${this.field("Configured server port", "已設定伺服器連接埠", this.port, v => this.port = v, "number")}</div>
        ${remote ? html`<div class="columns">${this.field("Trusted SSH host alias", "已信任 SSH 主機別名", this.host, v => this.host = v)}${this.field("Existing remote server directory", "現有遠端伺服器目錄", this.remoteDirectory, v => this.remoteDirectory = v)}</div><p class="note">${this.l("Uses your existing OpenSSH configuration and key authentication. The host key must already be trusted. Only a preinstalled Linux server is supported; remote provisioning is unavailable. A lost connection is unknown server state, not a stopped server.","使用現有 OpenSSH 設定同金鑰驗證，主機金鑰必須已受信任。只支援已安裝嘅 Linux 伺服器，未提供遠端部署。連線中斷表示狀態未知，唔等於伺服器已停止。",true)}</p>` : nothing}
        ${container ? html`${this.field("Preloaded compatible image with @sha256 digest", "已載入相容映像及 @sha256 摘要", this.image, v => this.image = v)}<p class="note">${this.l("The selected image must already exist on the target daemon and supply Java or Bedrock dependencies. Runs as UID/GID 1000 with no added capabilities; the server directory must be writable by that identity. The port is bound to loopback only. No image is pulled automatically.","所選映像必須已存在目標服務，並提供 Java 或 Bedrock 依賴。以 UID/GID 1000 執行，唔加入額外權限，伺服器目錄必須允許該身分寫入。連接埠只綁定本機回環，唔會自動下載映像。",true)}</p>` : nothing}
        <div class="row">${this.button("Choose Java executable", "選擇 Java 執行檔", async () => { await this.call("payload.choose", { toolId: "java" }); })}${container ? this.button("Choose Docker executable", "選擇 Docker 執行檔", async () => { await this.call("payload.choose", { toolId: "docker" }); }) : nothing}${remote ? this.button("Choose SSH executable", "選擇 SSH 執行檔", async () => { await this.call("payload.choose", { toolId: "ssh" }); }) : nothing}</div>
        ${this.check("I accept the Minecraft EULA for this server", "我接受此伺服器嘅 Minecraft EULA", this.eula, v => this.eula = v)}
        ${this.check("I authorize execution of this trusted server and extensions", "我授權執行此信任伺服器同擴充", this.execution, v => this.execution = v)}
        <div class="row">${this.button("Start selected server", "啟動所選伺服器", async () => { const result = await this.tool({ action: "minecraft.managed.start", serverId: this.serverId, edition: this.edition, version: this.version, flavour: this.edition === "bedrock" ? "vanilla" : this.flavour, target: this.target, ...(this.edition === "java" ? { entryPoint: this.serverEntry } : {}), memoryMiB: Number(this.memory), port: Number(this.port), acceptExecution: this.execution, acceptEula: this.eula, ...(remote ? { host: this.host, remoteDirectory: this.remoteDirectory } : { directoryId: this.directory?.id }), ...(container ? { image: this.image } : {}) }); this.state = result.state; this.message = this.l("Process started; game readiness has not been verified. Refresh status and verify the server before inviting players.","程序已啟動，但遊戲就緒狀態未經驗證。請重新整理狀態並確認伺服器先邀請玩家。",true); }, !this.eula || !this.execution || !this.version || (!remote && !this.directory))}${this.button("Refresh server status", "重新整理伺服器狀態", async () => { const result = await this.tool({ action: "minecraft.managed.status", serverId: this.serverId }); this.state = result.state; this.readiness = result.readinessState || "unknown"; this.onlineNames = result.players?.names || []; })}${this.button("Request graceful stop", "要求正常停止", async () => { this.state = (await this.tool({ action: "minecraft.managed.stop", serverId: this.serverId })).state; })}</div>
        <p class="status">${this.l("Observed state","已觀察狀態",true)}: ${this.state} · ${this.readiness}</p>
        <p>${this.l("Last observed Java players","最後觀察到嘅 Java 玩家",true)}: ${this.onlineNames.join(", ") || this.l("No observation","未有觀察記錄",true)}</p>
        <p class="note">${this.l("Process handles last for this application session. Ownership records persist, but process adoption after restart is never inferred. Recorded containers require explicit reconnect and identity checks. Stop and confirm exit before closing. Java uses server.jar; Bedrock uses bedrock_server.exe locally on Windows and bedrock_server on Linux. No arbitrary command field, force kill, automatic world migration or host power operation is provided.","程序控制代碼只維持到今次工作階段結束。擁有權記錄會保留，但重新啟動後唔會推斷程序已接管。已記錄容器需要明確重新連接及身分檢查，關閉前請停止並確認退出。Java 使用 server.jar；Bedrock 喺本機 Windows 使用 bedrock_server.exe，Linux 使用 bedrock_server。唔提供任意指令欄、強制終止、自動世界遷移或主機電源操作。",true)}</p>
      </div>` : nothing}
      ${this.tab === "remote" ? html`<minecraft-remote-panel .language=${this.language} .edition=${this.edition} .version=${this.version} .flavour=${this.flavour}></minecraft-remote-panel>` : nothing}
      ${["worlds", "players", "commands", "records"].includes(this.tab) ? html`<minecraft-workflow-panel .section=${this.tab} .language=${this.language} .edition=${this.edition} .version=${this.version} .flavour=${this.flavour} .serverId=${this.serverId} .target=${this.target} .directory=${this.directory} .memoryMiB=${Number(this.memory)} .port=${Number(this.port)} .entryPoint=${this.serverEntry} @minecraft-profile=${(event: CustomEvent) => { const p = event.detail; this.serverId = p.id; this.edition = p.edition; this.version = p.version; this.flavour = p.flavour; this.target = p.target; this.memory = String(p.memoryMiB); this.port = String(p.port); this.serverEntry = p.entryPoint || "server.jar"; this.directory = undefined; this.eula = false; this.execution = false; this.state = "not-managed"; this.change(); }}></minecraft-workflow-panel>` : nothing}
    </section>`;
  }
}
customElements.define("minecraft-panel", MinecraftPanel);
