import {localizedCopy} from './language-wording';
import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
import {actionIcon} from "./material-icons";
import { LitElement, html, nothing, css } from "lit";
import { workspaceStyles } from "./workspace-styles";
type Case = { text: string; expected: boolean };
type Snippet = {
  name: string;
  pattern: string;
  flags: string;
  sample: string;
  replacement: string;
};
/** Local bounded ECMAScript expression workbench with an isolated evaluator. */
export class RegexWorkbench extends LitElement {
  static properties = {
    language: { type: String },
    pattern: { state: true },
    flags: { state: true },
    sample: { state: true },
    replacement: { state: true },
    result: { state: true },
    busy: { state: true },
    feedback: { state: true },
    literal: { state: true },
    construct: { state: true },
    quantifier: { state: true },
    cases: { state: true },
    caseText: { state: true },
    caseExpected: { state: true },
    snippets: { state: true },
    snippetName: { state: true },
    matchIndex: { state: true },
  };
  language = "bilingual";
  pattern = "";
  flags = "g";
  sample = "";
  replacement = "";
  result: any;
  busy = false;
  feedback = "";
  literal = "";
  construct = "literal";
  quantifier = "one";
  cases: Case[] = [];
  caseText = "";
  caseExpected = true;
  snippets: Snippet[] = [];
  snippetName = "";
  matchIndex = 0;
  private worker?: Worker;
  private timer?: ReturnType<typeof setTimeout>;
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
      .workbench {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .columns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .flags {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .flags label {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .code {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font: 13px/1.5 monospace;
        padding: 12px;
        background: var(--md-sys-color-surface-container-high);
        border-radius: 8px;
        max-height: 240px;
        overflow: auto;
      }
      .tokens {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .token {
        padding: 4px 8px;
        border: 1px solid var(--md-sys-color-outline-variant);
        border-radius: 8px;
        font-size: 12px;
      }
      summary {
        cursor: pointer;
        min-height: 48px;
        padding: 12px 0;
        font-weight: 500;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        font-size: 13px;
      }
      td,
      th {
        text-align: left;
        vertical-align: top;
        padding: 8px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
        overflow-wrap: anywhere;
      }
      td {
        max-width: 300px;
      }
      .test-case {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }
      .test-case .code {
        flex: 1;
      }
      .file {
        font: inherit;
        max-width: 100%;
        min-height: 48px;
      }
      @media (max-width: 850px) {
        .columns {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];
  private l(en: string, zh: string) {return localizedCopy(en,zh,this.language);}
  disconnectedCallback() {
    this.stop();
    super.disconnectedCallback();
  }
  private stop() {
    this.worker?.terminate();
    this.worker = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.busy = false;
  }
  private run() {
    this.stop();
    this.busy = true;
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>"");
    this.result = undefined;
    try {
      this.worker = new Worker(new URL("./regex-worker.ts", import.meta.url), {
        type: "module",
      });
      this.timer = setTimeout(() => {
        this.stop();
        this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
          "Evaluator startup timed out. Try again.",
          "運算程序啟動超時，請再試。",
        ));
      }, 2000);
      this.worker.onmessage = (event: MessageEvent) => {
        if (event.data.ready) {
          if (this.timer) clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            this.stop();
            this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
              "Evaluation stopped after 250 ms. Reduce the input or simplify the expression.",
              "運算超過 250 毫秒，已停止。請縮短輸入或簡化表達式。",
            ));
          }, 250);
          this.worker?.postMessage({
            pattern: this.pattern,
            flags: this.flags,
            sample: this.sample,
            replacement: this.replacement,
            tests: this.cases,
          });
          return;
        }
        this.result = event.data;
        this.matchIndex = 0;
        this.stop();
        this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>this.result.ok
          ? l("Evaluation completed locally.", "已喺本機完成運算。")
          : l("Expression could not be evaluated.", "未能運算表達式。"));
      };
      this.worker.onerror = () => {
        this.stop();
        this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
          "The isolated evaluator is unavailable.",
          "未能使用獨立運算程序。",
        ));
      };
    } catch {
      this.stop();
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "The isolated evaluator could not be started.",
        "未能啟動獨立運算程序。",
      ));
    }
  }
  private updatePattern(value: string) {
    this.pattern = value.slice(0, 2000);
    this.result = undefined;
    this.dispatchEvent(
      new CustomEvent("pattern-change", {
        detail: { pattern: this.pattern, flags: this.flags },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private toggleFlag(flag: string, enabled: boolean) {
    this.flags = enabled ? this.flags + flag : this.flags.replace(flag, "");
    this.result = undefined;
    this.dispatchEvent(
      new CustomEvent("pattern-change", {
        detail: { pattern: this.pattern, flags: this.flags },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private appendConstruct() {
    const escaped = this.literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let fragment =
      this.construct === "literal"
        ? escaped
        : this.construct === "class"
          ? `[${this.literal.replace(/[\\\]\^-]/g, "\\$&")}]`
          : this.construct === "capture"
            ? `(${this.literal})`
            : this.construct === "named"
              ? `(?<group>${this.literal})`
              : this.construct === "noncapture"
                ? `(?:${this.literal})`
                : this.construct === "lookahead"
                  ? `(?=${this.literal})`
                  : this.construct === "lookbehind"
                    ? `(?<=${this.literal})`
                    : this.construct === "alternation"
                      ? `(?:${this.literal
                          .split("\n")
                          .map((value) =>
                            value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                          )
                          .join("|")})`
                      : this.construct === "start"
                        ? "^"
                        : this.construct === "end"
                          ? "$"
                          : this.construct === "boundary"
                            ? "\\b"
                            : this.construct === "digit"
                              ? "\\d"
                              : this.construct === "unicode"
                                ? "\\p{Letter}"
                                : this.construct === "backreference"
                                  ? "\\1"
                                  : this.construct === "codepoint"
                                    ? `\\u{${this.literal}}`
                                    : escaped;
    const suffix: Record<string, string> = {
      one: "",
      optional: "?",
      many: "*",
      some: "+",
      lazy: "*?",
      range: "{1,3}",
    };
    fragment += suffix[this.quantifier] ?? "";
    this.updatePattern(this.pattern + fragment);
  }
  private addCase() {
    if (this.cases.length >= 20 || this.caseText.length > 4096) return;
    this.cases = [
      ...this.cases,
      { text: this.caseText, expected: this.caseExpected },
    ];
    this.caseText = "";
    this.result = undefined;
  }
  private saveSnippet() {
    if (!this.snippetName.trim() || this.snippets.length >= 50) return;
    this.snippets = [
      ...this.snippets,
      {
        name: this.snippetName.trim().slice(0, 80),
        pattern: this.pattern,
        flags: this.flags,
        sample: this.sample,
        replacement: this.replacement,
      },
    ];
    this.snippetName = "";
  }
  private loadSnippet(snippet: Snippet) {
    this.flags = snippet.flags;
    this.updatePattern(snippet.pattern);
    this.sample = snippet.sample;
    this.replacement = snippet.replacement;
  }
  private exportSnippets() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, snippets: this.snippets }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "regex-snippets.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Snippet download requested.", "已要求下載片段。"));
  }
  private async importSnippets(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error();
      const document = JSON.parse(await file.text());
      if (
        document.version !== 1 ||
        Object.keys(document).some(
          (k) => !["version", "snippets"].includes(k),
        ) ||
        !Array.isArray(document.snippets) ||
        document.snippets.length > 50
      )
        throw new Error();
      for (const item of document.snippets) {
        if (
          !item ||
          typeof item !== "object" ||
          Object.keys(item).sort().join(",") !==
            "flags,name,pattern,replacement,sample" ||
          typeof item.name !== "string" ||
          item.name.length > 80 ||
          typeof item.pattern !== "string" ||
          item.pattern.length > 2000 ||
          typeof item.flags !== "string" ||
          !/^[dgimsuvy]*$/.test(item.flags) ||
          new Set(item.flags).size !== item.flags.length ||
          typeof item.sample !== "string" ||
          item.sample.length > 65536 ||
          typeof item.replacement !== "string" ||
          item.replacement.length > 2000
        )
          throw new Error();
      }
      this.snippets = document.snippets;
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Session snippets replaced from the file.",
        "已使用檔案取代工作階段片段。",
      ));
    } catch {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Invalid or oversized snippet file. Existing snippets are retained.",
        "片段檔案無效或太大，現有片段已保留。",
      ));
    }
  }
  private async copyPattern() {
    try {
      await navigator.clipboard.writeText(this.pattern);
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Pattern copied.", "已複製模式。"));
    } catch {
      this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l(
        "Clipboard unavailable. Select and copy the pattern field manually.",
        "未能使用剪貼簿，請手動選取並複製模式欄位。",
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
  private constructLabel() {
    const labels: Record<string, [string, string]> = {
      literal: ["Escaped literal", "已跳脫字面文字"],
      class: ["Character class", "字元類別"],
      capture: ["Capture group", "擷取群組"],
      named: ["Named capture group", "具名擷取群組"],
      noncapture: ["Non-capturing group", "非擷取群組"],
      alternation: ["Alternatives, one per line", "選項，每行一個"],
      lookahead: ["Positive lookahead", "正向前瞻"],
      lookbehind: ["Positive lookbehind", "正向後顧"],
      start: ["Start anchor", "起點錨點"],
      end: ["End anchor", "終點錨點"],
      boundary: ["Word boundary", "字詞邊界"],
      digit: ["Digit class", "數字類別"],
      unicode: ["Unicode letter property", "Unicode 字母屬性"],
      codepoint: ["Unicode code point, hexadecimal", "Unicode 碼位，十六進位"],
      backreference: ["First group backreference", "第一組反向參照"],
    };
    return this.l(...labels[this.construct]);
  }
  private explanations() {
    const tokens =
      this.pattern.match(
        /\\[pP]\{[^}]*\}|\\u\{[^}]*\}|\\.|\(\?<[^>]*>|\(\?[=!:]|\(\?<[=!]|\[[^\]]*\]|\{\d+(?:,\d*)?\}\??|[?*+]\??|\^|\$|\||[()]|[^\\()[\]{}?*+^$|]+/g,
      ) ?? [];
    return tokens.map((token) => ({
      token,
      meaning:
        token === "^"
          ? this.l("Start anchor", "起點錨點")
          : token === "$"
            ? this.l("End anchor", "終點錨點")
            : token === "|"
              ? this.l("Alternation", "選擇分支")
              : token.startsWith("[")
                ? this.l("Character class", "字元類別")
                : token.startsWith("\\")
                  ? this.l("Escape or character property", "跳脫序列或字元屬性")
                  : token.startsWith("(")
                    ? this.l("Group or assertion start", "群組或斷言開始")
                    : token === ")"
                      ? this.l("Group end", "群組結束")
                      : /^[?*+{]/.test(token)
                        ? this.l("Quantifier", "數量詞")
                        : this.l("Literal text", "字面文字"),
    }));
  }
  render() {
    const match = this.result?.matches?.[this.matchIndex];
    return html`<div class="workbench">
      <section class="panel stack">
        <h2>${this.l("Regular expression workbench", "正規表達式工作台")}</h2>
        <p>
          ${this.l(
            "Local ECMAScript RegExp engine. Evaluation uses an isolated worker with a 250 ms wall-time limit, 2000-character patterns, 64 KiB samples and at most 500 matches.",
            "使用本機 ECMAScript RegExp 引擎，獨立運算程序限時 250 毫秒，模式最多 2000 個字元、樣本最多 64 KiB，最多顯示 500 個符合項目。",
          )}
        </p>
        <md-outlined-text-field
          label=${this.l("Pattern", "模式")}
          .value=${this.pattern}
          maxlength="2000"
          @input=${(e: Event) =>
            this.updatePattern((e.composedPath()[0] as HTMLInputElement).value)}
        ></md-outlined-text-field>
        <div
          class="flags"
          role="group"
          aria-label=${this.l("Expression flags", "表達式旗標")}
        >
          ${["d", "g", "i", "m", "s", "u", "v", "y"].map(
            (flag) =>
              html`<label
                ><md-checkbox
                  aria-label=${this.l("Flag", "旗標") + " " + flag}
                  .checked=${this.flags.includes(flag)}
                  @change=${(e: Event) =>
                    this.toggleFlag(
                      flag,
                      (e.target as HTMLInputElement).checked,
                    )}
                ></md-checkbox
                >${flag}</label
              >`,
          )}
        </div>
        <p class="muted">
          ${this.l(
            "d indices · g global · i ignore case · m multiline · s dot all · u Unicode · v Unicode sets · y sticky. u and v cannot be combined.",
            "d 位置 · g 全域 · i 忽略大小寫 · m 多行 · s 點符合全部 · u Unicode · v Unicode 集合 · y 黏附。u 同 v 唔可以一齊使用。",
          )}
        </p>
        <div class="columns">
          <md-outlined-text-field
            type="textarea"
            rows="5"
            label=${this.l("Sample text", "樣本文字")}
            .value=${this.sample}
            maxlength="65536"
            @input=${(e: Event) => {
              this.sample = (e.composedPath()[0] as HTMLInputElement).value;
              this.result = undefined;
            }}
          ></md-outlined-text-field
          ><md-outlined-text-field
            type="textarea"
            rows="5"
            label=${this.l("Replacement template", "取代範本")}
            .value=${this.replacement}
            maxlength="2000"
            @input=${(e: Event) => {
              this.replacement = (
                e.composedPath()[0] as HTMLInputElement
              ).value;
              this.result = undefined;
            }}
          ></md-outlined-text-field>
        </div>
        <p class="muted">
          ${this.l(
            "Replacement references include $&, $1 and $<name>. Samples and patterns are never sent to a server.",
            "取代參照包括 $&、$1 同 $<name>，樣本同模式唔會傳送到伺服器。",
          )}
        </p>
        <div class="row">
          <md-filled-button @click=${this.run}
            >${actionIcon('Evaluate')}${this.l("Evaluate", "運算")}</md-filled-button
          ><md-outlined-button
            ?disabled=${!this.busy}
            @click=${() => {
              this.stop();
              this.feedback = captureOwnedStatus(this,"feedback",this.l.bind(this),l=>l("Evaluation cancelled.", "已取消運算。"));
            }}
            >${actionIcon('Cancel evaluation')}${this.l("Cancel evaluation", "取消運算")}</md-outlined-button
          ><md-text-button @click=${this.copyPattern}
            >${actionIcon('Copy pattern')}${this.l("Copy pattern", "複製模式")}</md-text-button
          >
        </div>
        ${this.feedback
          ? html`<p role="status">${displayOwnedStatus(this,"feedback",this.feedback,this.language)}</p>`
          : nothing}${this.result && !this.result.ok
          ? html`<p class="error">${this.result.message}</p>`
          : nothing}
      </section>
      <section class="panel">
        <details>
          <summary>${this.l("Guided construction", "引導式建立")}</summary>
          <div class="stack">
            <md-outlined-select
              label=${this.l("Construct", "結構")}
              .value=${this.construct}
              .displayText=${this.constructLabel()}
              @change=${(e: Event) =>
                (this.construct = (e.target as HTMLSelectElement).value)}
              >${this.options([
                ["literal", this.l("Escaped literal", "已跳脫字面文字")],
                ["class", this.l("Character class", "字元類別")],
                ["capture", this.l("Capture group", "擷取群組")],
                ["named", this.l("Named capture group", "具名擷取群組")],
                ["noncapture", this.l("Non-capturing group", "非擷取群組")],
                [
                  "alternation",
                  this.l("Alternatives, one per line", "選項，每行一個"),
                ],
                ["lookahead", this.l("Positive lookahead", "正向前瞻")],
                ["lookbehind", this.l("Positive lookbehind", "正向後顧")],
                ["start", this.l("Start anchor", "起點錨點")],
                ["end", this.l("End anchor", "終點錨點")],
                ["boundary", this.l("Word boundary", "字詞邊界")],
                ["digit", this.l("Digit class", "數字類別")],
                [
                  "unicode",
                  this.l("Unicode letter property", "Unicode 字母屬性"),
                ],
                [
                  "codepoint",
                  this.l(
                    "Unicode code point, hexadecimal",
                    "Unicode 碼位，十六進位",
                  ),
                ],
                [
                  "backreference",
                  this.l("First group backreference", "第一組反向參照"),
                ],
              ])}</md-outlined-select
            ><md-outlined-text-field
              type="textarea"
              rows="2"
              label=${this.l("Construct content", "結構內容")}
              .value=${this.literal}
              @input=${(e: Event) =>
                (this.literal = (
                  e.composedPath()[0] as HTMLInputElement
                ).value)}
            ></md-outlined-text-field
            ><md-outlined-select
              label=${this.l("Quantifier", "數量詞")}
              .value=${this.quantifier}
              .displayText=${this.quantifier === "one"
                ? this.l("Exactly once", "一次")
                : (
                    {
                      optional: "?",
                      many: "*",
                      some: "+",
                      lazy: "*?",
                      range: "{1,3}",
                    } as Record<string, string>
                  )[this.quantifier]}
              @change=${(e: Event) =>
                (this.quantifier = (e.target as HTMLSelectElement).value)}
              >${this.options([
                ["one", this.l("Exactly once", "一次")],
                ["optional", "?"],
                ["many", "*"],
                ["some", "+"],
                ["lazy", "*?"],
                ["range", "{1,3}"],
              ])}</md-outlined-select
            ><md-filled-tonal-button @click=${this.appendConstruct}
              >${this.l("Append construct", "加入結構")}</md-filled-tonal-button
            >
            <p>
              ${this.l(
                "Group contents are raw expressions. Literal and alternative text is escaped. Edit group names and ranges in the pattern field.",
                "群組內容係原始表達式，字面文字同選項會自動跳脫。請喺模式欄位編輯群組名稱同範圍。",
              )}
            </p>
          </div>
        </details>
        <details>
          <summary>
            ${this.l("Explanation and engine capabilities", "解釋同引擎能力")}
          </summary>
          <div class="tokens">
            ${this.explanations().map(
              (item) =>
                html`<span class="token"
                  ><code>${item.token}</code> ${item.meaning}</span
                >`,
            )}
          </div>
          <p>
            ${this.l(
              "This is lexical annotation, not a complete parse tree. ECMAScript supports lookarounds, captures, backreferences and lazy quantifiers. Unicode-set intersection/subtraction needs the v flag and a compatible engine.",
              "呢個係詞法註解，唔係完整語法樹。ECMAScript 支援前後顧、擷取、反向參照同非貪婪數量詞。Unicode 集合交集同差集需要 v 旗標同相容引擎。",
            )}
          </p>
          <p>
            ${this.l(
              "Atomic groups, possessive quantifiers, conditionals, subroutines and execution traces are not exposed by this engine. Inline modifiers depend on the embedded engine version; evaluation reports unsupported syntax.",
              "呢個引擎唔提供原子群組、佔有式數量詞、條件式、子常式同執行追蹤。行內修飾詞視乎內嵌引擎版本，運算會指出不支援嘅語法。",
            )}
          </p>
          <p class="notice">
            ${this.l(
              "Nested quantifiers, overlapping alternatives and unanchored repetition can cause excessive backtracking. Timing is measured for this sample only and is not a safety proof. The worker is terminated at the time limit.",
              "巢狀數量詞、重疊選項同無錨點重複可能造成過量回溯。時間只反映呢個樣本，唔代表安全證明。超時會終止運算程序。",
            )}
          </p>
        </details>
      </section>
      ${this.result?.ok
        ? html`<section class="panel stack">
            <h2>${this.l("Results", "結果")}</h2>
            <p>
              ${this.result.matches.length} ${this.l("matches", "個符合項目")} ·
              ${this.result.milliseconds.toFixed(2)} ms
              ${this.result.truncated
                ? this.l("(500-match display limit)", "（500 項顯示上限）")
                : ""}
            </p>
            <div class="row">
              <md-text-button
                ?disabled=${this.matchIndex === 0}
                @click=${() => this.matchIndex--}
                >${actionIcon('Previous match')}${this.l("Previous match", "上一個符合項目")}</md-text-button
              ><span
                >${this.result.matches.length ? this.matchIndex + 1 : 0} /
                ${this.result.matches.length}</span
              ><md-text-button
                ?disabled=${this.matchIndex + 1 >= this.result.matches.length}
                @click=${() => this.matchIndex++}
                >${actionIcon('Next match')}${this.l("Next match", "下一個符合項目")}</md-text-button
              >
            </div>
            ${match
              ? html`<p>
                    ${this.l("UTF-16 range", "UTF-16 範圍")}:
                    ${match.index}–${match.end}
                  </p>
                  <div class="code">
                    ${match.text ||
                    this.l("(zero-width match)", "（零寬度符合項目）")}
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>${this.l("Capture", "擷取")}</th>
                        <th>${this.l("Value", "值")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${match.captures.map(
                        (value: any, index: number) =>
                          html`<tr>
                            <td>${index + 1}</td>
                            <td>${value ?? this.l("Unmatched", "未符合")}</td>
                          </tr>`,
                      )}${Object.entries(match.groups).map(
                        ([key, value]) =>
                          html`<tr>
                            <td>${key}</td>
                            <td>${String(value ?? "")}</td>
                          </tr>`,
                      )}
                    </tbody>
                  </table>`
              : html`<p>${this.l("No matches.", "未有符合項目。")}</p>`}
            <h3>${this.l("Replacement preview", "取代預覽")}</h3>
            <div class="code">${this.result.replaced}</div>
          </section>`
        : nothing}
      <section class="panel stack">
        <h2>${this.l("Test cases", "測試個案")}</h2>
        <md-outlined-text-field
          label=${this.l("Test text", "測試文字")}
          .value=${this.caseText}
          maxlength="4096"
          @input=${(e: Event) =>
            (this.caseText = (e.composedPath()[0] as HTMLInputElement).value)}
        ></md-outlined-text-field
        ><label
          ><md-checkbox
            aria-label=${this.l("Expected to match", "預期符合")}
            .checked=${this.caseExpected}
            @change=${(e: Event) =>
              (this.caseExpected = (e.target as HTMLInputElement).checked)}
          ></md-checkbox
          >${this.l("Expected to match", "預期符合")}</label
        ><md-outlined-button
          ?disabled=${this.cases.length >= 20}
          @click=${this.addCase}
          >${actionIcon('Add test (maximum 20)')}${this.l("Add test (maximum 20)",
            "加入測試（最多 20 個）",
          )}</md-outlined-button
        >${this.cases.map(
          (test, index) =>
            html`<div class="test-case">
              <span class="code">${test.text}</span
              ><span
                >${test.expected
                  ? this.l("Match", "符合")
                  : this.l("No match", "唔符合")}</span
              ><span
                >${this.result?.outcomes?.[index]
                  ? this.result.outcomes[index].passed
                    ? this.l("Passed", "通過")
                    : this.l("Failed", "失敗")
                  : this.l("Not run", "未執行")}</span
              ><md-text-button
                @click=${() => {
                  this.cases = this.cases.filter((_, i) => i !== index);
                  this.result = undefined;
                }}
                >${actionIcon('Remove')}${this.l("Remove", "移除")}</md-text-button
              >
            </div>`,
        )}
      </section>
      <section class="panel stack">
        <h2>${this.l("Session snippets", "工作階段片段")}</h2>
        <p>
          ${this.l(
            "Snippets stay in memory. Export before closing to keep them. Import replaces this session list.",
            "片段只存喺記憶體，關閉前請匯出以保留。匯入會取代今次工作階段清單。",
          )}
        </p>
        <md-outlined-text-field
          label=${this.l("Snippet name", "片段名稱")}
          maxlength="80"
          .value=${this.snippetName}
          @input=${(e: Event) =>
            (this.snippetName = (
              e.composedPath()[0] as HTMLInputElement
            ).value)}
        ></md-outlined-text-field>
        <div class="row">
          <md-outlined-button
            ?disabled=${!this.snippetName.trim() || this.snippets.length >= 50}
            @click=${this.saveSnippet}
            >${actionIcon('Save snippet')}${this.l("Save snippet", "儲存片段")}</md-outlined-button
          ><md-text-button
            ?disabled=${!this.snippets.length}
            @click=${this.exportSnippets}
            >${actionIcon('Export snippets')}${this.l("Export snippets", "匯出片段")}</md-text-button
          >
        </div>
        ${this.snippets.map(
          (snippet, index) =>
            html`<div class="row">
              <md-text-button @click=${() => this.loadSnippet(snippet)}
                >${snippet.name}</md-text-button
              ><md-text-button
                @click=${() =>
                  (this.snippets = this.snippets.filter((_, i) => i !== index))}
                >${actionIcon('Remove')}${this.l("Remove", "移除")}</md-text-button
              >
            </div>`,
        )}<md-outlined-button
          @click=${() => this.renderRoot.querySelector<HTMLInputElement>("#snippet-import-file")?.click()}
        >${actionIcon("Import snippets")}${this.l("Import snippet JSON, maximum 1 MiB", "匯入片段 JSON，最大 1 MiB")}</md-outlined-button>
        <input id="snippet-import-file" hidden style="display:none" tabindex="-1"
          type="file" accept=".json,application/json" @change=${this.importSnippets}
        />
      </section>
    </div>`;
  }
}
customElements.define("regex-workbench", RegexWorkbench);

