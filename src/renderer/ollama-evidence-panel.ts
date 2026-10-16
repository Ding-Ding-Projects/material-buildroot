import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
import { LitElement, html, css, nothing, type PropertyValues } from "lit";
import { materialIcon } from "./material-icons";
type Hardware = {
  observedAt: string;
  adapterInventory?: {state:string;reason?:string;observedAt?:string;adapters:{name:string|null;vendor:string|null;driverVersion:string|null;reportedAdapterRamBytes:number|null}[]};
  ram: { totalBytes: number; availableBytes: number; source: string };
  cpu: {
    architecture: string;
    logicalCores: number;
    backendSupported: boolean | null;
  };
  gpu: {
    state: string;
    reason?: string;
    devices: {
      backend: string;
      driverSupported: boolean;
      totalBytes: number;
      availableBytes: number;
    }[];
  };
  storage: {
    state: string;
    reason?: string;
    availableBytes?: number;
    totalBytes?: number;
  };
};
type Fit = {
  verdict: string;
  observedAt: string;
  adapterInventory?: {state:string;reason?:string;observedAt?:string;adapters:{name:string|null;vendor:string|null;driverVersion:string|null;reportedAdapterRamBytes:number|null}[]};
  reasons: string[];
  limitations: string[];
  hardware: Hardware;
  model: {
    name: string;
    digest: string;
    quantization: string | null;
    contextMaximum: number | null;
  };
  estimate: null | {
    contextTokens: number;
    contextSource: string;
    weightsBytes: number;
    kvCacheBytes: number;
    runtimeOverheadBytes: number;
    safetyFactor: number;
    requiredMemoryBytes: number;
    kvFormula: string;
  };
};
type Capabilities = {
  observedAt: string;
  adapterInventory?: {state:string;reason?:string;observedAt?:string;adapters:{name:string|null;vendor:string|null;driverVersion:string|null;reportedAdapterRamBytes:number|null}[]};
  model: string;
  digest: string;
  capabilities: string[] | null;
  attachments: {
    imageCapability: boolean | null;
    transferEnabled: boolean;
    reason: string;
  };
  toolCalling: boolean | null;
};
export class OllamaEvidencePanel extends LitElement {
  static properties = {
    model: { type: String },
    language: { type: String },
    revision: { state: true },
  };
  model = "";
  language = "bilingual";
  revision = 0;
  private hardware?: Hardware;
  private fit?: Fit;
  private capabilities?: Capabilities;
  private context = "4096";
  private pending = false;
  private serial = 0;
  private feedback = "";
  static styles = css`
    :host {
      display: block;
      color: inherit;
      font: inherit;
    }
    .stack {
      display: grid;
      gap: 10px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .row md-outlined-text-field {
      max-width: 230px;
    }
    p {
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
    }
    h3 {
      font-size: 14px;
      margin: 0;
    }
    dl {
      display: grid;
      grid-template-columns: minmax(140px, 1fr) minmax(0, 2fr);
      gap: 6px;
      font-size: 12px;
      margin: 0;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .evidence {
      padding: 12px;
      border: 1px solid var(--md-sys-color-outline-variant);
    }
    .verdict {
      font-size: 18px;
      font-weight: 600;
    }
    .digest {
      overflow-wrap: anywhere;
      font: 11px monospace;
    }
    md-icon-button {
      width: 48px;
      height: 48px;
    }
  `;
  protected updated(changed: PropertyValues) {
    if (changed.has("model")) {
      this.serial++;
      this.pending = false;
      this.fit = undefined;
      this.capabilities = undefined;
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
      this.revision++;
    }
  }
  private l(en: string, zh: string) {
    return this.language === "en"
      ? en
      : this.language === "zh-HK"
        ? zh
        : `${en} · ${zh}`;
  }
  private bytes(value?: number) {
    return typeof value === "number" && Number.isFinite(value)
      ? `${(value / 1024 ** 3).toFixed(2)} GiB`
      : this.l("Unknown", "未知");
  }
  private evidence(value: boolean | null) {
    return value === null
      ? this.l("Unknown", "未知")
      : value
        ? this.l("Reported supported", "報告支援")
        : this.l("Reported unsupported", "報告唔支援");
  }
  private async inspect(action: string) {
    if (this.pending) return;
    const token = ++this.serial;
    this.pending = true;
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
    this.revision++;
    try {
      const request = {
        action,
        ...(action !== "ollama.hardware" ? { model: this.model } : {}),
        ...(action === "ollama.fit"
          ? { contextTokens: Number(this.context) }
          : {}),
      };
      if (!window.studio?.operations) throw Error("DESKTOP_REQUIRED");
      const reply = await window.studio.operations({
        action: "tools",
        request,
      });
      if (!reply.ok) throw Error(reply.code);
      if (token !== this.serial) return;
      const result = reply.result as any;
      if (result?.ok === false) throw Error(result.code);
      if (action === "ollama.hardware") this.hardware = result.hardware;
      else if (action === "ollama.fit") {
        this.fit = result.fit;
        this.hardware = result.fit.hardware;
      } else this.capabilities = result;
    } catch (e) {
      if (token === this.serial) {
        if (action === "ollama.fit") this.fit = undefined;
        if (action === "ollama.capabilities") this.capabilities = undefined;
        this.feedback =
          captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
            "Evidence unavailable. Refresh before making a runtime decision.",
            "未能取得證據，決定執行環境前請重新整理。",
          ) +
          " " +
          (e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : ""));
      }
    } finally {
      if (token === this.serial) {
        this.pending = false;
        this.revision++;
      }
    }
  }
  render() {
    const h = this.hardware,
      f = this.fit,
      c = this.capabilities;
    return html`<details class="evidence">
      <summary>
        ${this.l(
          "Hardware, model fit and capabilities",
          "硬件、模型適用程度同能力",
        )}
      </summary>
      <div class="stack">
        <p>
          ${this.l(
            "These are current host measurements and local model metadata. A fit estimate is not a benchmark or successful model-load proof. Unknown remains unknown.",
            "呢啲係目前主機量度同本機模型中繼資料，適用估算唔係效能測試或成功載入模型證明，未知狀態仍然係未知。",
          )}
        </p>
        <div class="row">
          <md-icon-button
            aria-label=${this.l("Measure local hardware", "量度本機硬件")}
            title=${this.l("Measure local hardware", "量度本機硬件")}
            ?disabled=${this.pending}
            @click=${() => this.inspect("ollama.hardware")}
            >${materialIcon("memory")}</md-icon-button
          ><md-outlined-text-field
            type="number"
            min="128"
            max="1048576"
            .label=${this.l("Planning context tokens", "規劃上下文詞元")}
            .value=${this.context}
            .supportingText=${this.l(
              "128–1048576; example: 4096. Planning only; does not change chat settings.",
              "128 至 1048576，例如 4096，只供規劃，唔會更改聊天設定。",
            )}
            ?disabled=${this.pending}
            @input=${(e: Event) => {
              this.context = (e.target as HTMLInputElement).value;
              this.fit = undefined;
              this.revision++;
            }}
          ></md-outlined-text-field
          ><md-outlined-button
            ?disabled=${this.pending ||
            !this.model ||
            !/^\d+$/.test(this.context) ||
            Number(this.context) < 128 ||
            Number(this.context) > 1048576}
            @click=${() => this.inspect("ollama.fit")}
            >${materialIcon("preview", "icon")}${this.l(
              "Estimate selected model fit",
              "估算所選模型適用程度",
            )}</md-outlined-button
          ><md-outlined-button
            ?disabled=${this.pending || !this.model}
            @click=${() => this.inspect("ollama.capabilities")}
            >${materialIcon("info", "icon")}${this.l(
              "Inspect model capabilities",
              "檢視模型能力",
            )}</md-outlined-button
          >
        </div>
        ${!this.model
          ? html`<p>
              ${this.l(
                "Load installed models and select one first.",
                "請先載入已安裝模型並選擇一個。",
              )}
            </p>`
          : nothing}
        <p role="status">${displayOwnedStatus(this,"feedback",this.feedback,this.language)}</p>
        ${this.pending
          ? html`<md-linear-progress
              indeterminate
              aria-label=${this.l(
                "Inspecting local model evidence",
                "檢視本機模型證據",
              )}
            ></md-linear-progress>`
          : nothing}${h
          ? html`<h3>${this.l("Measured hardware", "已量度硬件")}</h3>
              <p>${h.observedAt}</p>
              <dl>
                <dt>${this.l("Available / total RAM", "可用／總記憶體")}</dt>
                <dd>
                  ${this.bytes(h.ram.availableBytes)} /
                  ${this.bytes(h.ram.totalBytes)}
                </dd>
                <dt>CPU</dt>
                <dd>
                  ${h.cpu.architecture} · ${h.cpu.logicalCores}
                  ${this.l("logical cores", "邏輯核心")} ·
                  ${this.evidence(h.cpu.backendSupported)}
                </dd>
                <dt>${this.l("Reported graphics adapters", "報告嘅顯示卡")}</dt>
                <dd>
                  ${h.adapterInventory?.state === "observed" ? this.l("Operating-system inventory observed", "已觀察作業系統清單") : this.l("Inventory unavailable", "未能取得清單")}
                  ${h.adapterInventory?.observedAt || ""} ${h.adapterInventory?.reason || ""}
                  ${(h.adapterInventory?.adapters || []).map(adapter=>html`<p>${adapter.name || this.l("Unknown adapter", "未知顯示卡")} · ${adapter.vendor || this.l("Unknown vendor", "未知廠商")} · ${adapter.driverVersion || this.l("Unknown driver", "未知驅動程式")}<br>${this.l("Raw 32-bit AdapterRAM report", "原始 32 位元 AdapterRAM 報告")}: ${adapter.reportedAdapterRamBytes === null ? this.l("Unknown", "未知") : adapter.reportedAdapterRamBytes} ${this.l("bytes", "位元組")}</p>`)}
                  <p>${this.l("AdapterRAM is a 32-bit report, not verified total or usable VRAM. Detected hardware does not prove an Ollama backend, free accelerator memory or a working driver. CPU-only runtime packages remain CPU-only; this inventory never enables GPU execution or installs drivers.", "AdapterRAM 係 32 位元報告，唔代表已驗證總顯示記憶體或可用顯示記憶體。偵測硬件唔代表 Ollama 後端、可用加速器記憶體或驅動程式正常。純 CPU 執行環境仍然只用 CPU，呢個清單唔會啟用 GPU 或安裝驅動程式。")}</p>
                </dd>
                <dt>GPU</dt>
                <dd>
                  ${h.gpu.state === "verified"
                    ? this.l("Verified probe", "已驗證探測")
                    : this.l("Unknown", "未知")}
                  ${h.gpu.reason || ""}${h.gpu.devices.map(
                    (d) =>
                      html`<p>
                        ${d.backend} · ${this.bytes(d.availableBytes)} /
                        ${this.bytes(d.totalBytes)} ·
                        ${this.evidence(d.driverSupported)}
                      </p>`,
                  )}
                </dd>
                <dt>
                  ${this.l("Available model storage", "可用模型儲存空間")}
                </dt>
                <dd>
                  ${h.storage.state === "verified"
                    ? this.bytes(h.storage.availableBytes)
                    : this.l("Unknown", "未知")}
                  ${h.storage.reason || ""}
                </dd>
              </dl>`
          : nothing}${f
          ? html`<div class="verdict">${f.verdict}</div>
              <p>
                ${f.model.name} ·
                ${f.model.quantization ||
                this.l("Unknown quantization", "量化未知")}
                · ${f.observedAt}
              </p>
              <div class="digest">${f.model.digest}</div>
              <ul>
                ${f.reasons.map((reason) => html`<li>${reason}</li>`)}
              </ul>
              ${f.estimate
                ? html`<dl>
                    <dt>
                      ${this.l("Required memory estimate", "所需記憶體估算")}
                    </dt>
                    <dd>${this.bytes(f.estimate.requiredMemoryBytes)}</dd>
                    <dt>
                      ${this.l(
                        "Weights / KV cache / overhead",
                        "權重／KV 快取／額外用量",
                      )}
                    </dt>
                    <dd>
                      ${this.bytes(f.estimate.weightsBytes)} /
                      ${this.bytes(f.estimate.kvCacheBytes)} /
                      ${this.bytes(f.estimate.runtimeOverheadBytes)}
                    </dd>
                    <dt>
                      ${this.l("Context / safety factor", "上下文／安全系數")}
                    </dt>
                    <dd>
                      ${f.estimate.contextTokens} / ${f.estimate.safetyFactor}
                    </dd>
                  </dl>`
                : nothing}
              <ul>
                ${f.limitations.map((limit) => html`<li>${limit}</li>`)}
              </ul>`
          : nothing}${c
          ? html`<h3>
                ${this.l("Reported model capabilities", "模型報告能力")}
              </h3>
              <p>${c.model} · ${c.observedAt}</p>
              <p>${c.capabilities?.join(", ") || this.l("Unknown", "未知")}</p>
              <p>
                ${this.l("Image capability", "圖像能力")}:
                ${this.evidence(c.attachments.imageCapability)} ·
                ${this.l("Tool calling", "工具呼叫")}:
                ${this.evidence(c.toolCalling)}
              </p>
              <p>
                ${this.l(
                  "Attachment transfer is not implemented. Reported vision support does not enable file or image upload.",
                  "未實作附件傳輸，模型報告支援視覺唔代表已啟用檔案或圖像上載。",
                )}
              </p>
              <p>${c.attachments.reason}</p>`
          : nothing}
      </div>
    </details>`;
  }
}
customElements.define("ollama-evidence-panel", OllamaEvidencePanel);
