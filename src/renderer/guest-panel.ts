import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
import {materialIcon, actionIcon} from "./material-icons";
import { LitElement, html, css, nothing, type PropertyValues } from "lit";
import "./guest-topology";
import type {Guest} from "../main/deployment/index.cjs";
import { workspaceStyles } from "./workspace-styles";
/** Managed guest and disk conversion controls using explicit host previews. */
export class GuestPanel extends LitElement {
  static properties = {
    workspaceId: { type: String },
    topology: { state: true },
    language: { type: String },
    pending: { state: true },
    feedback: { state: true },
    providers: { state: true },
    guests: { state: true },
    files: { state: true },
    provider: { state: true },
    memory: { state: true },
    cpus: { state: true },
    firmware: { state: true },
    network: { state: true },
    disk: { state: true },
    editing: { state: true },
    format: { state: true },
    outputName: { state: true },
    preview: { state: true },
    conversion: { state: true },
  };
  workspaceId = "";
  topology = true;
  language = "bilingual";
  pending = false;
  feedback = "";
  providers: any;
  guests: Guest[] = [];
  files: any[] = [];
  provider = "virtualbox";
  memory = 1024;
  cpus = 1;
  firmware = "bios";
  network = "nat";
  disk = "";
  editing = "";
  format = "qcow2";
  outputName = "";
  preview: any;
  conversion: any;
  static styles = [
    workspaceStyles,
    css`
      :host {
        height: auto;
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
      [hidden]{display:none!important}
      .guests {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .split {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .record {
        padding: 12px 0;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
      }
      .code {
        font-family: monospace;
        overflow-wrap: anywhere;
      }
      @media (max-width: 1000px) {
        .split {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];
  protected updated(changed: PropertyValues) {
    if (changed.has("workspaceId")) {
      this.providers = undefined;
      this.provider = "virtualbox";
      this.memory = 1024;
      this.cpus = 1;
      this.firmware = "bios";
      this.network = "nat";
      this.guests = [];
      this.files = [];
      this.disk = "";
      this.editing = "";
      this.preview = undefined;
      this.conversion = undefined;
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
    }
  }
  private l(en: string, zh: string) {
    return this.language === "en"
      ? en
      : this.language === "zh-HK"
        ? zh
        : `${en} · ${zh}`;
  }
  private async run(action: string, request?: Record<string, unknown>) {
    const api = window.studio?.operations;
    if (!api || this.pending) return undefined;
    this.pending = true;
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
    const targetWorkspace = this.workspaceId;
    try {
      const result = await api({
        action,
        workspaceId: targetWorkspace,
        ...(request ? { request } : {}),
      });
      if (targetWorkspace !== this.workspaceId) {
        this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
          "The previous project operation settled. Refresh this project to inspect its records.",
          "之前專案嘅操作已結束，請重新整理呢個專案以檢視記錄。",
        ));
        return undefined;
      }
      if (!result.ok) {
        this.feedback =
          captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Operation not completed", "未完成操作") + `: ${result.code}`);
        return undefined;
      }
      return result.result as any;
    } catch {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Outcome unavailable. Refresh managed records before trying again.",
        "未能確認結果，請先重新整理管理記錄再試。",
      ));
      return undefined;
    } finally {
      this.pending = false;
    }
  }
  private hardware() {
    return {
      memoryMiB: this.memory,
      cpus: this.cpus,
      firmware: this.firmware,
      network: this.network,
    };
  }
  private get validHardware() {
    return (
      Number.isInteger(this.memory) &&
      this.memory >= 128 &&
      this.memory <= 65536 &&
      Number.isInteger(this.cpus) &&
      this.cpus >= 1 &&
      this.cpus <= 32
    );
  }
  private async discover() {
    const result = await this.run("guest.discover");
    if (result !== undefined) this.providers = result;
  }
  private async refresh() {
    const result = await this.run("guest.list");
    if (Array.isArray(result)) this.guests = result;
  }
  private async loadFiles() {
    const api = window.studio?.operations;
    if (!api || this.pending) return;
    this.pending = true;
    const targetWorkspace = this.workspaceId;
    try {
      const reply = await api({
        action: "artifacts.list",
        workspaceId: targetWorkspace,
      });
      if (targetWorkspace !== this.workspaceId) return;
      if (reply.ok && Array.isArray(reply.result))
        this.files = reply.result.filter((item: any) => item.kind === "file");
      else
        this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
          "Output files could not be loaded.",
          "未能載入輸出檔案。",
        ));
    } catch {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Output file listing unavailable.",
        "未能列出輸出檔案。",
      ));
    } finally {
      this.pending = false;
    }
  }
  private async create() {
    if (!this.validHardware) return;
    const request = {
      provider: this.provider,
      hardware: this.hardware(),
      ...(this.disk ? { artifact: this.disk } : {}),
    };
    const result = await this.run(
      this.disk ? "guest.import" : "guest.create",
      request,
    );
    if (result !== undefined) {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Managed guest created. Guest boot has not been verified.",
        "已建立受管理客體，尚未驗證客體開機。",
      ));
      await this.refresh();
    }
  }
  private edit(guest: Guest) {
    this.editing = guest.id;
    this.provider = guest.provider;
    this.memory = guest.hardware.memoryMiB ?? 1024;
    this.cpus = guest.hardware.cpus ?? 1;
    this.firmware = guest.hardware.firmware ?? "bios";
    this.network = guest.hardware.network ?? "nat";
  }
  private async applyEdit() {
    if (!this.validHardware) return;
    const result = await this.run("guest.edit", {
      id: this.editing,
      hardware: this.hardware(),
    });
    if (result !== undefined) {
      this.editing = "";
      await this.refresh();
    }
  }
  private async act(action: string, guest: Guest) {
    const result = await this.run("guest." + action, { id: guest.id, ...(action === "refresh" ? {} : {expectedRevision: guest.revision}) });
    if (result !== undefined) {
      await this.refresh();
      this.feedback =
        captureOwnedStatus(this,"feedback",this.l.bind(this),l=>action === "stop"
          ? l(
              "Shutdown requested. Refresh this guest to verify it has stopped.",
              "已要求關閉，請重新整理呢個客體以確認已停止。",
            )
          : action === "launch"
            ? l(
                "Launch requested. A running process does not prove guest boot.",
                "已要求啟動，程序運行唔代表客體成功開機。",
              )
            : l("Guest state refreshed.", "已重新整理客體狀態。"));
    }
  }
  private async previewConversion() {
    if (!this.disk || !this.outputName) return;
    const result = await this.run("conversion.preview", {
      artifact: this.disk,
      format: this.format,
      outputName: this.outputName,
    });
    if (result !== undefined) this.preview = result;
  }
  private async executeConversion() {
    if (!this.preview) return;
    const result = await this.run("conversion.execute", {
      id: this.preview.id,
    });
    this.preview = undefined;
    if (result !== undefined) {
      this.conversion = result;
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Conversion completed and output inspected.",
        "已完成轉換並檢視輸出。",
      ));
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
  render() {
    if (!this.workspaceId)
      return html`<section class="panel">
        <p>
          ${this.l(
            "Adopt a project to manage its output images and guests.",
            "請先接入專案，再管理輸出映像同客體。",
          )}
        </p>
      </section>`;
    return html`<div class="row"><md-outlined-button @click=${()=>this.topology=true}>${actionIcon('Topology editor')}${this.l("Topology editor","拓樸編輯器")}</md-outlined-button><md-outlined-button @click=${()=>this.topology=false}>${actionIcon('Guest records and disk conversion')}${this.l("Guest records and disk conversion","客體記錄同磁碟轉換")}</md-outlined-button></div><guest-topology ?hidden=${!this.topology} .workspaceId=${this.workspaceId} .language=${this.language}></guest-topology><div class="guests" ?hidden=${this.topology}>
      <section class="panel stack">
        <h2>${this.l("Managed virtual machines", "受管理虛擬機")}</h2>
        <p>
          ${this.l(
            "These controls manage application-owned guest records. Launch opens the provider’s guest window. Existing unrelated guests are not changed.",
            "呢啲控制項管理應用程式擁有嘅客體記錄，啟動會開啟供應商嘅客體視窗，唔會變更其他現有客體。",
          )}
        </p>
        <div class="row">
          <md-outlined-button ?disabled=${this.pending} @click=${this.discover}
            >${actionIcon('Discover providers')}${this.l("Discover providers", "探索供應商")}</md-outlined-button
          ><md-outlined-button ?disabled=${this.pending} @click=${this.refresh}
            >${actionIcon('Refresh managed guests')}${this.l("Refresh managed guests",
              "重新整理受管理客體",
            )}</md-outlined-button
          ><md-outlined-button
            ?disabled=${this.pending}
            @click=${this.loadFiles}
            >${actionIcon('Load output files')}${this.l("Load output files", "載入輸出檔案")}</md-outlined-button
          >
        </div>
        ${this.providers
          ? html`<dl>
              <dt>VirtualBox</dt>
              <dd>
                ${this.providers.virtualbox?.available
                  ? this.l("Available", "可使用")
                  : this.l("Unavailable", "未能使用")}
              </dd>
              <dt>VMware</dt>
              <dd>
                ${this.providers.vmware?.available
                  ? this.l("Available", "可使用")
                  : this.l("Unavailable", "未能使用")}
              </dd>
            </dl>`
          : nothing}
      </section>
      <div class="split">
        <section class="panel stack">
          <h2>
            ${this.editing
              ? this.l("Edit stopped guest", "編輯已停止客體")
              : this.l("Create or import guest", "建立或匯入客體")}
          </h2>
          <md-outlined-select
            label=${this.l("Provider", "供應商")}
            .value=${this.provider}
            .displayText=${this.provider === "vmware" ? "VMware" : "VirtualBox"}
            ?disabled=${!!this.editing}
            @change=${(e: Event) =>
              (this.provider = (e.target as HTMLSelectElement).value)}
            >${this.options([
              ["virtualbox", "VirtualBox"],
              ["vmware", "VMware"],
            ])}</md-outlined-select
          >
          <div class="fields">
            <md-outlined-text-field
              type="number"
              min="128"
              max="65536"
              label=${this.l("Memory (MiB)", "記憶體（MiB）")}
              .value=${String(this.memory)}
              @input=${(e: Event) =>
                (this.memory = Number(
                  (e.composedPath()[0] as HTMLInputElement).value,
                ))}
            ></md-outlined-text-field
            ><md-outlined-text-field
              type="number"
              min="1"
              max="32"
              label=${this.l("Virtual CPUs", "虛擬 CPU")}
              .value=${String(this.cpus)}
              @input=${(e: Event) =>
                (this.cpus = Number(
                  (e.composedPath()[0] as HTMLInputElement).value,
                ))}
            ></md-outlined-text-field
            ><md-outlined-select
              label=${this.l("Firmware", "韌體")}
              .value=${this.firmware}
              .displayText=${this.firmware === "bios" ? "BIOS" : "EFI"}
              @change=${(e: Event) =>
                (this.firmware = (e.target as HTMLSelectElement).value)}
              >${this.options([
                ["bios", "BIOS"],
                ["efi", "EFI"],
              ])}</md-outlined-select
            ><md-outlined-select
              ?disabled=${!!this.editing}
              label=${this.l("Networking (edit adapters in topology)", "網絡（請喺拓樸編輯介面卡）")}
              .value=${this.network}
              .displayText=${this.network === "nat"
                ? "NAT"
                : this.network === "none"
                  ? this.l("None", "無")
                  : this.l("Host only", "僅主機")}
              @change=${(e: Event) =>
                (this.network = (e.target as HTMLSelectElement).value)}
              >${this.options([
                ["nat", "NAT"],
                ["none", this.l("None", "無")],
                ...(this.editing ? [["hostonly", this.l("Host only", "僅主機")]] as [string,string][] : []),
              ])}</md-outlined-select
            >
          </div>
          <md-outlined-select
            label=${this.l(
              "Output disk image (optional)",
              "輸出磁碟映像（選填）",
            )}
            .value=${this.disk}
            .displayText=${this.disk || this.l("No disk", "無磁碟")}
            ?disabled=${!!this.editing}
            @change=${(e: Event) => {
              this.disk = (e.target as HTMLSelectElement).value;
              this.preview = undefined;
            }}
            >${this.options([
              ["", this.l("No disk", "無磁碟")],
              ...this.files.map((file: any): [string, string] => [
                file.path,
                file.path,
              ]),
            ])}</md-outlined-select
          >
          <p>
            ${this.l(
              "Only provider-compatible validated disks are admitted. Appliance archives and unreviewed VMDK dependencies are rejected.",
              "只會接受供應商相容並已驗證嘅磁碟，設備封存檔同未經審查嘅 VMDK 相依項目會被拒絕。",
            )}
          </p>
          <div class="row">
            <md-filled-button
              ?disabled=${this.pending || !this.validHardware}
              @click=${() => (this.editing ? this.applyEdit() : this.create())}
              >${this.editing
                ? this.l("Apply hardware", "套用硬件")
                : this.disk
                  ? this.l("Import disk as new guest", "以磁碟匯入新客體")
                  : this.l(
                      "Create empty guest",
                      "建立空白客體",
                    )}</md-filled-button
            >${this.editing
              ? html`<md-text-button @click=${() => (this.editing = "")}
                  >${actionIcon('Cancel edit')}${this.l("Cancel edit", "取消編輯")}</md-text-button
                >`
              : nothing}
          </div>
        </section>
        <section class="panel stack">
          <h2>${this.l("Convert output disk", "轉換輸出磁碟")}</h2>
          <p>
            ${this.l(
              "Select the source disk in the form. Preview binds its hash and checks that the output does not already exist.",
              "請喺表格揀選來源磁碟，預覽會綁定其摘要，並檢查輸出尚未存在。",
            )}
          </p>
          <md-outlined-select
            label=${this.l("Output format", "輸出格式")}
            .value=${this.format}
            .displayText=${this.format}
            @change=${(e: Event) => {
              this.format = (e.target as HTMLSelectElement).value;
              this.preview = undefined;
            }}
            >${this.options(
              ["raw", "vmdk", "vdi", "qcow2"].map((value) => [value, value]),
            )}</md-outlined-select
          ><md-outlined-text-field
            label=${this.l("New output filename", "新輸出檔名")}
            maxlength="120"
            .value=${this.outputName}
            @input=${(e: Event) => {
              this.outputName = (e.composedPath()[0] as HTMLInputElement).value;
              this.preview = undefined;
            }}
          ></md-outlined-text-field
          ><md-outlined-button
            ?disabled=${this.pending ||
            !this.disk ||
            !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(this.outputName)}
            @click=${this.previewConversion}
            >${actionIcon('Preview conversion')}${this.l("Preview conversion", "預覽轉換")}</md-outlined-button
          >${this.preview
            ? html`<dl>
                  <dt>${this.l("Source", "來源")}</dt>
                  <dd>${this.preview.artifact}</dd>
                  <dt>SHA-256</dt>
                  <dd class="code">${this.preview.sha256}</dd>
                  <dt>${this.l("Output", "輸出")}</dt>
                  <dd>${this.preview.outputName} (${this.preview.format})</dd>
                </dl>
                <md-filled-button
                  ?disabled=${this.pending}
                  @click=${this.executeConversion}
                  >${actionIcon('Confirm conversion')}${this.l("Confirm conversion", "確認轉換")}</md-filled-button
                >`
            : nothing}${this.conversion
            ? html`<p>${this.conversion.path}</p>
                <p class="code">SHA-256: ${this.conversion.sha256}</p>`
            : nothing}
        </section>
      </div>
      <section class="panel">
        <h2>${this.l("Managed guests", "受管理客體")}</h2>
        ${this.guests.length
          ? this.guests.map(
              (guest) =>
                html`<div class="record">
                  <strong>${guest.provider}</strong>
                  <span class="badge">${guest.state}</span>
                  <p class="code">${guest.id}</p>
                  <p>
                    ${guest.hardware.memoryMiB} MiB · ${guest.hardware.cpus} CPU
                    · ${guest.hardware.firmware}
                  </p>
                  <div class="row">
                    <md-text-button
                      ?disabled=${this.pending}
                      @click=${() => this.act("refresh", guest)}
                      >${actionIcon('Refresh state')}${this.l("Refresh state",
                        "重新整理狀態",
                      )}</md-text-button
                    ><md-outlined-button
                      ?disabled=${this.pending || guest.state !== "stopped"}
                      @click=${() => this.edit(guest)}
                      >${actionIcon('Edit hardware')}${this.l("Edit hardware",
                        "編輯硬件",
                      )}</md-outlined-button
                    ><md-filled-tonal-button
                      ?disabled=${this.pending || guest.state !== "stopped"}
                      @click=${() => this.act("launch", guest)}
                      >${actionIcon('Launch guest')}${this.l("Launch guest",
                        "啟動客體",
                      )}</md-filled-tonal-button
                    ><md-outlined-button
                      ?disabled=${this.pending || guest.state !== "running"}
                      @click=${() => this.act("stop", guest)}
                      >${actionIcon('Request shutdown')}${this.l("Request shutdown",
                        "要求關閉",
                      )}</md-outlined-button
                    >
                  </div>
                </div>`,
            )
          : html`<p>
              ${this.l(
                "No managed guest records loaded.",
                "未有已載入嘅受管理客體記錄。",
              )}
            </p>`}
      </section>
      ${this.feedback
        ? html`<p class="status" role="status">${displayOwnedStatus(this,"feedback",this.feedback,this.language)}</p>`
        : nothing}
    </div>`;
  }
}
customElements.define("guest-panel", GuestPanel);
