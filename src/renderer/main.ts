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
  private workspaceRevision = 0;
  plans: Plan[] = [];
  selectedId = "";
  edit: Plan | undefined;
  events: Activity[] = [];
  notice = "";
  newName = "";
  newRuntime: "wsl" | "docker" = "wsl";
  nameError = false;
  setupStep = 0;
  setupDone = false;
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
      this.theme === "dark" || (this.theme === "system" && this.media.matches);
  };
  static styles = workspaceStyles;
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.shortcut);
    this.media.addEventListener("change", this.mediaChanged);
    this.mediaChanged();
    void this.load();
  }
  disconnectedCallback() {
    window.removeEventListener("keydown", this.shortcut);
    this.unsubscribe?.();
    this.media.removeEventListener("change", this.mediaChanged);
    super.disconnectedCallback();
  }
  private l(en: string, zh: string) {
    const language = this.state?.language ?? "bilingual";
    return language === "en" ? en : language === "zh-HK" ? zh : `${en} · ${zh}`;
  }
  private buildTime() {
    const value = this.state?.updatedAt;
    if (!value || !Number.isFinite(Date.parse(value)))
      return this.l("Unavailable", "未能取得");
    try {
      const locale = this.state?.language === "zh-HK" ? "zh-HK" : "en-CA";
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
      this.connection === "ready" &&
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
    document.documentElement.lang = state.language === "en" ? "en" : "zh-HK";
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
    if (this.dirty) {
      this.pendingDestination = route;
      this.openDialog("leave-dialog");
      return;
    }
    await this.go(route);
  }
  private async go(route: string) {
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
    this.snapshots = state.snapshots;
    this.plans = state.plans;
    this.theme = state.preferences.theme;
    this.mediaChanged();
    this.setupDone =
      state.onboardingCompleted || state.onboarding?.dismissed === true;
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
      this.notice = this.l(
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
          this.notice = this.l(
            "Workspace changed elsewhere. Your pending edits are retained; review before trying again.",
            "工作區已喺其他地方變更。待套用變更已保留，請檢視後再試。",
          );
        } else
          this.notice = this.l(
            "Workspace change was rejected. Your pending edits are retained.",
            "工作區變更已被拒絕，待套用變更已保留。",
          );
        return false;
      }
      this.hydrateWorkspace(reply.state);
      return true;
    } catch {
      this.workspaceMode = "unavailable";
      this.notice = this.l(
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
      this.notice = this.l("Workspace snapshot saved.", "工作區快照已儲存。");
    }
  }
  private async restoreSnapshot() {
    if (!this.restoreId || this.dirty) return;
    if (
      await this.mutateWorkspace("snapshot.restore", { id: this.restoreId })
    ) {
      this.selectedId = this.plans[0]?.id ?? "";
      this.edit = this.selected ? { ...this.selected } : undefined;
      this.closeDialog("restore-dialog");
      this.notice = this.l(
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
      this.notice = this.l(
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
      this.notice = this.l(
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
      this.notice = this.l(
        "Workspace document imported.",
        "工作區文件已匯入。",
      );
    }
  }
  private historyPanel() {
    return html`<section class="panel stack">
      <h2>${this.l("Workspace backups", "工作區備份")}</h2>
      <p>
        ${this.l(
          "Snapshots preserve applied plans and preferences on this device. Restore or import replaces the current workspace; create a snapshot first if you need a recovery copy.",
          "快照會喺呢部電腦保留已套用嘅計劃同偏好設定。還原或匯入會取代目前工作區，如需復原副本，請先建立快照。",
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
                html`<div class="row">
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
            )}<label class="import-label"
              >${this.l(
                "Import workspace JSON (maximum 1 MiB)",
                "匯入工作區 JSON（最大 1 MiB）",
              )}<input
                type="file"
                accept="application/json,.json"
                ?disabled=${!this.canEditWorkspace || this.dirty}
                @change=${this.readImport}
            /></label>`
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
      this.state?.language === "zh-HK" ? "zh-HK" : "en-GB",
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
      this.notice = this.l(
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
      this.notice = this.l(
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
    this.notice = this.l(
      "Plan updated for this session.",
      "已更新今次工作階段嘅計劃。",
    );
    return true;
  }
  private discardPlan() {
    if (this.selected) this.edit = { ...this.selected };
    this.notice = this.l(
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
      this.notice = this.l(
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
        !(await this.mutateWorkspace("plan.create", {
          plan: {
            name,
            runtime: this.newRuntime,
            target: "image",
            status: "draft",
            notes: "",
          },
        }))
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
        ? this.l(
            "Plan saved. No project files were created.",
            "計劃已儲存，未建立專案檔案。",
          )
        : this.l(
            "Session plan created. No project files were created.",
            "已建立工作階段計劃，未建立專案檔案。",
          );
    this.nameError = false;
    if (onboarding) {
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
        ? this.l(
            "Plan removed from the saved workspace.",
            "已從儲存嘅工作區移除計劃。",
          )
        : this.l(
            "Plan removed from this session. Its name remains in session activity.",
            "已從今次工作階段移除計劃，活動記錄仍保留其名稱。",
          );
  }
  private async exportPlans() {
    if (!this.plans.length || !this.canEditWorkspace) return;
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
        const reply = await this.workspaceAPI.workspaceExport!();
        if (!reply.ok) throw new Error("unavailable");
        document = reply.document;
      } catch {
        this.notice = this.l(
          "Workspace export unavailable. Your plans are retained.",
          "未能匯出工作區，計劃仍然保留。",
        );
        return;
      }
    }
    const blob = new Blob([document], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "material-buildroot-plans.json";
    try {
      a.click();
      this.record("Plan download requested", "已要求下載計劃");
      this.notice = this.l(
        "Download requested. Check your downloads to confirm the file was saved.",
        "已要求下載。請檢查下載項目，確認檔案已儲存。",
      );
    } catch {
      this.notice = this.l(
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

  private routeLabel(route: string) {
    return route === "operations"
      ? this.l("Project operations", "專案操作")
      : route === "settings"
        ? this.l("Settings", "設定")
        : route === "activity"
          ? this.l("Activity", "活動")
          : route === "about"
            ? this.l("About", "關於")
            : this.l("Project plans", "專案計劃");
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
          title=${this.routeLabel(route)} class=${this.route === route ? "selected" : ""}
          aria-label=${this.route === route
            ? `${this.routeLabel(route)}, ${this.l("current workspace", "目前工作區")}`
            : this.routeLabel(route)}
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
                html`<md-text-button
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
      <section
        class="panel stack"
        aria-busy=${this.connection === "loading" || this.busy}
      >
        <h2>${this.l("Language", "語言")}</h2>
        <p>
          ${this.l(
            "Bilingual is the default. A successful save persists across application restarts.",
            "預設使用雙語。成功儲存後，重新啟動都會保留。",
          )}
        </p>
        ${this.confirmedPreference()}<md-outlined-select
          id="language-select"
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
      </section>
      <section class="panel stack">
        <h2>${this.l("Appearance", "外觀")}</h2>
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
      ${this.historyPanel()}
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
            ${window.studio?.operations ? html`<div class="row"><md-outlined-button ?disabled=${this.setupChecking} @click=${async()=>{this.setupChecking=true;try{const r=await window.studio.operations!({action:"runtime.discover"});this.setupRuntime=r.ok?r.result:{code:r.code};}catch{this.setupRuntime={code:"RUNTIME_DISCOVERY_UNAVAILABLE"};}finally{this.setupChecking=false;}}}>${actionIcon('Check installed runtimes')}${this.l("Check installed runtimes","檢查已安裝執行環境")}</md-outlined-button><md-outlined-button @click=${async()=>{this.closeDialog("setup-dialog",true);await this.navigate("operations");const panel=this.renderRoot.querySelector("operations-panel") as any;if(panel)panel.tab="runtime";}}>${actionIcon('Open trusted project setup')}${this.l("Open trusted project setup","開啟可信專案設定")}</md-outlined-button><md-outlined-button @click=${async()=>{this.closeDialog("setup-dialog",true);await this.navigate("operations");const panel=this.renderRoot.querySelector("operations-panel") as any;if(panel)panel.tab="source";}}>${actionIcon('Clone source in workspace')}${this.l("Clone source in workspace","喺工作區複製來源")}</md-outlined-button></div>${this.setupRuntime?html`<p role="status">${this.setupRuntime.code||this.l("Runtime discovery completed. Inspect the project runtime workspace for distribution and container details.","已完成執行環境探索，請喺專案執行環境工作區檢視發行版同容器詳情。")}</p>`:nothing}`:nothing}
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
                  "Your plan is ready to edit. Review language in Settings and choose a theme below.",
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
              ><md-text-button
                @click=${() => {
                  this.setupDone = true;
                  this.closeDialog("setup-dialog", true);
                  void this.navigate("settings");
                }}
                >${actionIcon('Review language settings')}${this.l("Review language settings",
                  "檢視語言設定",
                )}</md-text-button
              >`}`;
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
          ? html`<p class="feedback" role="status">${this.notice}</p>`
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
        <main>
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
                            "Language and theme are saved on this device.",
                            "語言同主題會儲存喺呢部電腦。",
                          )
                        : this.l(
                            "Language is saved on this device. Appearance is session-only.",
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
                                html`<li>
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
                    </section>`}<operations-panel
            class="operations-host"
            ?hidden=${this.route !== "operations"}
            .language=${this.state?.language ?? "bilingual"}
          ></operations-panel
          >${this.notice
            ? html`<p class="notice" role="status">${this.notice}</p>`
            : nothing}
        </main>
      </div>
      <div class="status" role="status" aria-live="polite">
        ${this.statusMessage()}
      </div>
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
        html`<p>${this.snapshots.find((s) => s.id === this.restoreId)?.name}</p>
          <p>
            ${this.l(
              "This replaces current plans, theme and setup completion with the snapshot. Language settings are unchanged.",
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
            )}<md-text-button @click=${async()=>{this.closeDialog("actions-dialog",true);await this.navigate("operations");await this.updateComplete;const panel=this.renderRoot.querySelector("operations-panel") as any;if(panel)panel.tab="documentation";}}>${materialIcon("help_outline","icon")}${this.l("Help & documentation","說明同文件")}</md-text-button><md-text-button
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
