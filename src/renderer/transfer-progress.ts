import { LitElement, html, css, nothing } from "lit";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/progress/linear-progress.js";
import { localizedCopy } from "./language-wording";
type Transfer = { id: string; version: string; state: string; progress?: { bytes: number; total: number | null; bytesPerSecond: number; etaSeconds: number | null }; result?: { code?: string; bytes?: number; sha256?: string; destination?: string; receipt?: string } };
declare global { interface Window { transferProgress?: { read(): Promise<{ ok: boolean; code?: string; language?: string; transfer?: Transfer }>; cancel(): Promise<{ ok: boolean; code?: string; language?: string; transfer?: Transfer }>; close(): Promise<unknown> } } }
class TransferProgressView extends LitElement {
  static properties = { revision: { state: true } };
  revision = 0;
  private language = "bilingual";
  private transfer?: Transfer;
  private code = "";
  private pending = false;
  private timer?: ReturnType<typeof setInterval>;
  static styles = css`:host{display:block;font-family:system-ui,sans-serif;padding:20px;color:var(--md-sys-color-on-surface,#211f26);background:var(--md-sys-color-surface,#fdf7ff);min-height:calc(100vh - 56px);box-sizing:border-box}section{display:grid;gap:16px;min-width:0}p,code{overflow-wrap:anywhere;margin:0}.actions{display:flex;gap:12px;flex-wrap:wrap}@media(prefers-color-scheme:dark){:host{--md-sys-color-surface:#141218;--md-sys-color-on-surface:#e6e0e9;--md-sys-color-primary:#d0bcff}}`;
  private l(en: string, zh: string) { return localizedCopy(en, zh, this.language, true); }
  connectedCallback() { super.connectedCallback(); void this.read(); this.timer = setInterval(() => { void this.read(); }, 1000); }
  disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.timer); }
  private async read(cancel = false) {
    if (this.pending) return; this.pending = true;
    try { const bridge = window.transferProgress; if (!bridge) throw Error(); const result = await (cancel ? bridge.cancel() : bridge.read());
      if (result.ok) { this.transfer = result.transfer; this.language = result.language || this.language; this.code = ""; }
      else if (result.code !== "BUSY") this.code = result.code || "TRANSFER_STATUS_UNAVAILABLE";
    } catch { this.code = "TRANSFER_STATUS_UNAVAILABLE"; }
    finally { this.pending = false; this.revision++; }
  }
  render() { const t = this.transfer, p = t?.progress; return html`<section><h1>${this.l("Transfer progress", "傳輸進度")}</h1><p>${this.l("This window can only read or cancel its assigned transfer. Closing it leaves the transfer running.", "此視窗只可以讀取或取消指定傳輸，關閉視窗會繼續傳輸。")}</p><p role="status" aria-live="polite">${this.code || t?.state || this.l("Reading status", "讀取狀態中")}</p>${t ? html`<p>Buildroot ${t.version}</p><code>${t.id}</code>${p ? html`<md-linear-progress .value=${p.total ? Math.min(1, p.bytes / p.total) : 0} ?indeterminate=${!p.total} aria-label=${this.l("Transfer bytes", "傳輸位元組")}></md-linear-progress><p>${p.bytes} / ${p.total ?? this.l("Unknown", "未知道")} B · ${p.bytesPerSecond} B/s · ETA ${p.etaSeconds ?? this.l("Unknown", "未知道")}</p>` : nothing}${t.result ? html`<p>${t.result.code || t.result.destination || ""}</p><p>${t.result.bytes ?? ""}</p><code>${t.result.sha256 || ""}</code><p>${t.result.receipt || ""}</p>` : nothing}` : nothing}<div class="actions"><md-outlined-button ?disabled=${this.pending || !t || !["queued", "running"].includes(t.state)} @click=${() => this.read(true)}>${this.l("Cancel this transfer", "取消此傳輸")}</md-outlined-button><md-text-button @click=${() => window.transferProgress?.close()}>${this.l("Close progress window", "關閉進度視窗")}</md-text-button></div></section>`; }
}
customElements.define("transfer-progress-view", TransferProgressView);
