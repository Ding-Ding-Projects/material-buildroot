import {localizedCopy} from './language-wording';
import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
import {materialIcon, actionIcon, actionSymbol} from "./material-icons";
import { LitElement, html, css, nothing } from "lit";
import "@material/web/button/outlined-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/progress/linear-progress.js";
import { workspaceStyles } from "./workspace-styles";
type Session = {
  id: string;
  origin: string;
  scopes: string[];
  expiresAt: number;
  status: string;
};
type Status = {
  configured: boolean;
  enabled: boolean;
  allowedScopes: string[];
  availableBindings: string[];
  binding: null | { origin: string };
  sessions: Session[];
};
export class CompanionPanel extends LitElement {
  static properties = { language: { type: String }, revision: { state: true } };
  language = "bilingual";
  revision = 0;
  private state?: Status;
  private pending = false;
  private feedback = "";
  private host = "127.0.0.1";
  private port = "0";
  private origin = "";
  private scopes: string[] = ["workspace:read"];
  private pairing?: { challenge: string; expiresAt: number; origin: string };
  private reveal = false;
  static styles = [
    workspaceStyles,
    css`
      :host {
        display: block;
        height: auto;
        color: inherit;
        font-family: inherit;
      }
      :host {
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
      :host([hidden]) {
        display: none;
      }
      .stack {
        display: grid;
        gap: 16px;
      }
      .row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }
      .columns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      h2,
      h3,
      p {
        margin: 0;
      }
      md-outlined-text-field,
      md-outlined-select {
        width: 100%;
        min-width: 0;
      }
      .record {
        padding: 16px 0;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
        overflow-wrap: anywhere;
      }
      .note {
        color: var(--md-sys-color-on-surface-variant);
      }
      @media (max-width: 1000px) {
        .columns {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];
  private l(en:string,zh:string,authored=false) {return localizedCopy(en,zh,this.language,authored);}
  private async request(action: string, args: Record<string, unknown> = {}) {
    if (!window.studio?.operations) throw new Error("DESKTOP_REQUIRED");
    const reply: { ok: boolean; code?: string; result?: any } =
      await window.studio.operations({
        action: "companion",
        request: { action, args },
      });
    if (!reply.ok) throw new Error(reply.code);
    if (reply.result?.ok === false) throw new Error(reply.result.code);
    return reply.result;
  }
  private async run(work: () => Promise<void>) {
    if (this.pending) return;
    this.pending = true;
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
    this.revision++;
    try {
      await work();
      this.feedback ||= captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Completed.", "已完成。"));
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : "COMPANION_UNAVAILABLE";
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>`${l("Operation not completed", "操作未完成")}: ${code}`);
    } finally {
      this.pending = false;
      this.revision++;
    }
  }
  private button(
    en: string,
    zh: string,
    work: () => Promise<void>,
    disabled = false,
  ) {
    if (/^(Refresh|Remove|Move|Stop|Cancel|Revoke)\b/.test(en)) return html`<md-icon-button aria-label=${this.l(en,zh)} title=${this.l(en,zh)} ?disabled=${this.pending||disabled} @click=${()=>this.run(work)}>${materialIcon(actionSymbol(en))}</md-icon-button>`;
    return html`<md-outlined-button
      ?disabled=${this.pending || disabled}
      @click=${() => this.run(work)}
      >${actionIcon(en)}${this.l(en, zh)}</md-outlined-button
    >`;
  }
  private async refresh() {
    this.state = await this.request("companion.status");
    if (!this.state!.availableBindings.includes(this.host))
      this.host = this.state!.availableBindings[0] || "127.0.0.1";
    if (!this.state!.enabled) {
      this.pairing = undefined;
      this.reveal = false;
    }
  }
  render() {
    return html`<section class="panel stack" aria-busy=${this.pending}>
      <h2>${this.l("Browser companion","瀏覽器配對",true)}</h2>
      <p class="note">
        ${this.l("Read workspace, project and job status from an approved browser. Configure HTTPS certificates on this desktop, choose a local binding, then start explicitly. Pairing requires native desktop approval.","透過獲批准瀏覽器讀取工作區、專案同工作狀態。請喺呢部桌面設定 HTTPS 憑證、選擇本機綁定位址，再明確啟動。配對需要原生桌面批准。",true)}
      </p>
      ${this.pending
        ? html`<md-linear-progress
            indeterminate
            aria-label=${this.l("Operation in progress","操作進行中",true)}
          ></md-linear-progress>`
        : nothing}
      <div role="status">${displayOwnedStatus(this,"feedback",this.feedback,this.language)}</div>
      <div class="row">
        ${this.button("Refresh companion status", "重新整理配對狀態", () =>
          this.refresh(),
        )}${this.button(
          "Choose TLS certificate and key",
          "選擇 TLS 憑證同金鑰",
          async () => {
            this.state = await this.request("companion.configure");
            this.pairing = undefined;
            this.reveal = false;
          },
          this.state?.enabled === true,
        )}
      </div>
      ${this.state
        ? html`<p>
              ${this.state.enabled
                ? this.l("Listener running","監聽服務執行中",true)
                : this.state.configured
                  ? this.l("TLS configured; listener stopped","TLS 已設定，監聽服務已停止",true)
                  : this.l("TLS not configured","未設定 TLS",true)}
            </p>
            <div class="columns">
              <md-outlined-select
                .label=${this.l("Local binding","本機綁定位址",true)}
                .value=${this.host}
                .displayText=${this.host}
                ?disabled=${this.pending || this.state.enabled}
                @change=${(e: Event) => {
                  this.host = (e.target as HTMLSelectElement).value;
                  this.revision++;
                }}
                >${this.state.availableBindings.map(
                  (host) =>
                    html`<md-select-option .value=${host}
                      ><div slot="headline">${host}</div></md-select-option
                    >`,
                )}</md-outlined-select
              >
              <md-outlined-text-field
                type="number"
                min="0"
                max="65535"
                .label=${this.l("Port (0 selects an available port)","連接埠（0 會選擇可用連接埠）",true)}
                .value=${this.port}
                ?disabled=${this.pending || this.state.enabled}
                @input=${(e: Event) => {
                  this.port = (e.target as HTMLInputElement).value;
                  this.revision++;
                }}
              ></md-outlined-text-field>
            </div>
            <div class="row">
              ${this.button(
                "Start companion",
                "啟動配對服務",
                async () => {
                  if (!/^\d+$/.test(this.port) || Number(this.port) > 65535)
                    throw new Error("INVALID_BINDING");
                  this.state = await this.request("companion.start", {
                    host: this.host,
                    port: Number(this.port),
                  });
                },
                !this.state.configured || this.state.enabled,
              )}${this.button(
                "Stop and revoke sessions",
                "停止並撤銷工作階段",
                async () => {
                  this.state = await this.request("companion.stop");
                  this.pairing = undefined;
                  this.reveal = false;
                },
                !this.state.enabled,
              )}
            </div>
            ${this.state.binding
              ? html`<p>
                  ${this.l("HTTPS endpoint","HTTPS 端點",true)}:
                  ${this.state.binding.origin}
                </p>`
              : nothing}
            <h3>${this.l("Pair a browser","配對瀏覽器",true)}</h3>
            <md-outlined-text-field
              type="url"
              .label=${this.l("Browser origin (HTTPS)","瀏覽器來源（HTTPS）",true)}
              placeholder="https://example.com"
              .value=${this.origin}
              ?disabled=${this.pending}
              @input=${(e: Event) => {
                this.origin = (e.target as HTMLInputElement).value;
                this.pairing = undefined;
                this.reveal = false;
                this.revision++;
              }}
            ></md-outlined-text-field>
            <div class="row">
              ${this.state.allowedScopes.map(
                (scope) =>
                  html`<label class="row"
                    ><md-checkbox
                          aria-label=${scope}
                      ?checked=${this.scopes.includes(scope)}
                      ?disabled=${this.pending}
                      @change=${(e: Event) => {
                        this.scopes = (e.target as HTMLInputElement).checked
                          ? [...this.scopes, scope]
                          : this.scopes.filter((s) => s !== scope);
                        this.pairing = undefined;
                        this.reveal = false;
                        this.revision++;
                      }}
                    ></md-checkbox
                    ><span>${scope}</span></label
                  >`,
              )}
            </div>
            ${this.button(
              "Create five-minute pairing code",
              "建立五分鐘配對碼",
              async () => {
                this.pairing = undefined;
                this.reveal = false;
                this.pairing = await this.request("companion.createPairing", {
                  origin: this.origin.trim(),
                  scopes: this.scopes,
                });
              },
              !this.state.enabled || !this.origin.trim() || !this.scopes.length,
            )}
            ${this.pairing
              ? html`<p>
                    ${this.l("For browser","指定瀏覽器",true)}:
                    ${this.pairing.origin} · ${this.l("Expires","到期",true)}:
                    ${new Date(this.pairing.expiresAt).toLocaleTimeString()}
                  </p>
                  <md-outlined-text-field
                    readonly
                    .type=${this.reveal ? "text" : "password"}
                    .label=${this.l("Pairing code","配對碼",true)}
                    .value=${this.pairing.challenge}
                  ></md-outlined-text-field>
                  <div class="row">
                    <md-outlined-button
                      @click=${() => {
                        this.reveal = !this.reveal;
                        this.revision++;
                      }}
                      >${this.reveal
                        ? this.l("Hide code","隱藏配對碼",true)
                        : this.l("Reveal code","顯示配對碼",true)}</md-outlined-button
                    ><md-outlined-button
                      @click=${() => {
                        this.pairing = undefined;
                        this.reveal = false;
                        this.revision++;
                      }}
                      >${actionIcon('Dismiss code')}${this.l("Dismiss code","關閉配對碼",true)}</md-outlined-button
                    >
                  </div>
                  <p class="note">
                    ${this.l("Enter this code only in the intended browser. Review its origin and permissions in the desktop approval dialog. Dismissing hides the code; stopping the service invalidates pending codes.","只喺指定瀏覽器輸入配對碼，並喺桌面批准對話框檢查來源同權限。關閉只會隱藏配對碼，停止服務先會令待用配對碼失效。",true)}
                  </p>`
              : nothing}
            <h3>${this.l("Browser sessions","瀏覽器工作階段",true)}</h3>
            ${!this.state.sessions.length
              ? html`<p>
                  ${this.l("No paired browser sessions.","暫無已配對瀏覽器工作階段。",true)}
                </p>`
              : this.state.sessions.map(
                  (s) =>
                    html`<div class="record stack">
                      <strong>${s.origin}</strong
                      ><span>${s.status} · ${s.scopes.join(", ")}</span
                      ><span
                        >${this.l("Expires","到期",true)}:
                        ${new Date(s.expiresAt).toLocaleString()}</span
                      >${this.button(
                        "Revoke session",
                        "撤銷工作階段",
                        async () => {
                          const r = await this.request("companion.revoke", {
                            sessionId: s.id,
                          });
                          if (!r.revoked) throw new Error("SESSION_NOT_FOUND");
                          await this.refresh();
                        },
                        s.status !== "active",
                      )}
                    </div>`,
                )}`
        : nothing}
    </section>`;
  }
}
customElements.define("companion-panel", CompanionPanel);
