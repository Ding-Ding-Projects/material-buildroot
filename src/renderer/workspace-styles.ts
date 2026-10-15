import { css } from "lit";
export const workspaceStyles = css`
  .settings-grid > [hidden]{display:none!important;}
  :host {
    display: block;
    height: 100%;
    font-family: Roboto, "Segoe UI", "Microsoft JhengHei", sans-serif;
    --md-ref-typeface-plain:
      Roboto, "Segoe UI", "Microsoft JhengHei", sans-serif;
    --md-ref-typeface-brand:
      Roboto, "Segoe UI", "Microsoft JhengHei", sans-serif;
    --md-sys-color-primary: #6750a4;
    --md-sys-color-on-primary: #fff;
    --md-sys-color-primary-container: #eaddff;
    --md-sys-color-on-primary-container: #21005d;
    --md-sys-color-surface: #fef7ff;
    --md-sys-color-surface-container: #f3edf7;
    --md-sys-color-surface-container-low: #f7f2fa;
    --md-sys-color-surface-container-high: #ece6f0;
    --md-sys-color-on-surface: #1d1b20;
    --md-sys-color-on-surface-variant: #49454f;
    --md-sys-color-outline: #79747e;
    --md-sys-color-outline-variant: #cac4d0;
    --md-sys-color-secondary-container: #e8def8;
    --md-sys-color-on-secondary-container: #1d192b;
    --md-sys-color-error: #b3261e;
    color: var(--md-sys-color-on-surface);
  }
  .operations-host[hidden] {
    display: none;
  }
  * {
    box-sizing: border-box;
  }
  .shell {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
  }
  .dark {
    --md-sys-color-primary: #d0bcff;
    --md-sys-color-on-primary: #381e72;
    --md-sys-color-primary-container: #4f378b;
    --md-sys-color-on-primary-container: #eaddff;
    --md-sys-color-surface: #141218;
    --md-sys-color-surface-container: #211f26;
    --md-sys-color-surface-container-low: #1d1b20;
    --md-sys-color-surface-container-high: #2b2930;
    --md-sys-color-on-surface: #e6e0e9;
    --md-sys-color-on-surface-variant: #cac4d0;
    --md-sys-color-outline: #938f99;
    --md-sys-color-outline-variant: #49454f;
    --md-sys-color-secondary-container: #4a4458;
    --md-sys-color-on-secondary-container: #e8def8;
    --md-sys-color-error: #f2b8b5;
    color-scheme: dark;
  }
  header {
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 12px;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    -webkit-app-region: drag;
  }
  .brand {
    flex: 1;
    min-width: 0;
  }
  .brand strong {
    font-size: 16px;
  }
  .brand small {
    display: block;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 11px;
  }
  .window {
    display: flex;
    gap: 0;
  }
  header md-text-button {
    min-width: 48px;
  }
  .body {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  nav {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 12px;
    background: var(--md-sys-color-surface-container-low);
    border-right: 1px solid var(--md-sys-color-outline-variant);
  }
  nav md-text-button {
    width: 100%;
    justify-content: flex-start;
  }
  nav .spacer {
    flex: 1;
  }
  .navsymbol {
    font-size: 22px;
    min-width: 28px;
    display: inline-block;
  }
  .navlabel {
    margin-left: 8px;
  }
  .selected {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    border-radius: 24px;
  }
  .menu {
    display: none;
  }
  main {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  h1 {
    font-size: 22px;
    line-height: 1.3;
    margin: 0;
    overflow-wrap: anywhere;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 12px;
  }
  h3 {
    font-size: 14px;
    margin: 0 0 8px;
  }
  p {
    line-height: 1.5;
    margin: 8px 0;
    overflow-wrap: anywhere;
  }
  .muted,
  small {
    color: var(--md-sys-color-on-surface-variant);
  }
  .toolbar,
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .toolbar .heading {
    flex: 1;
    min-width: 200px;
  }
  .toolbar p {
    font-size: 12px;
    margin: 4px 0;
  }
  .badge {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 16px;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }
  .workspace {
    display: grid;
    grid-template-columns: minmax(180px, 240px) minmax(300px, 1fr);
    gap: 12px;
    align-items: start;
    flex: 1;
    min-height: 0;
  }
  .panel {
    padding: 20px;
    background: var(--md-sys-color-surface-container);
    border-radius: 16px;
    min-width: 0;
  }
  .records {
    padding: 8px;
    max-height: 65vh;
    overflow: auto;
  }
  .records md-text-button {
    width: 100%;
    height: auto;
    min-height: 64px;
    --md-text-button-container-shape: 12px;
  }
  .record-label {
    text-align: left;
    display: block;
    white-space: normal;
    overflow-wrap: anywhere;
    padding: 8px 0;
  }
  .record-label strong {
    display: block;
    font-size: 14px;
  }
  .record-label small {
    display: block;
    font-size: 12px;
  }
  .editor {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .fields .wide {
    grid-column: 1/-1;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .settings-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(240px, 0.8fr);
    gap: 16px;
    align-items: start;
  }
  .settings-grid p {
    font-size: 14px;
    margin: 4px 0;
  }
  .settings-grid .stack {
    gap: 8px;
  }
  .empty {
    padding: 24px;
    min-height: 240px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
  }
  .empty-symbol {
    font-size: 40px;
    color: var(--md-sys-color-primary);
    margin-bottom: 16px;
  }
  .status {
    padding: 10px 16px;
    background: var(--md-sys-color-surface-container-high);
    border-top: 1px solid var(--md-sys-color-outline-variant);
    font-size: 12px;
    min-height: 40px;
    overflow-wrap: anywhere;
  }
  .feedback {
    font-size: 13px;
    min-height: 20px;
  }
  .error {
    color: var(--md-sys-color-error);
  }
  .notice {
    padding: 12px 16px;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 12px;
    font-size: 13px;
  }
  .onboarding {
    display: flex;
    gap: 12px;
    align-items: center;
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    padding: 12px 16px;
    border-radius: 12px;
  }
  .onboarding .heading {
    flex: 1;
  }
  .onboarding p {
    font-size: 13px;
  }
  .import-label {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 14px;
  }
  .import-label input {
    max-width: 100%;
    min-height: 48px;
    font: inherit;
  }
  .row .heading {
    flex: 1;
    min-width: 0;
  }
  .activity {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .activity li {
    padding: 14px 0;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
  }
  .activity time {
    display: block;
    font-size: 12px;
    color: var(--md-sys-color-on-surface-variant);
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: minmax(90px, 0.4fr) minmax(0, 1fr);
    gap: 14px;
  }
  dt {
    color: var(--md-sys-color-on-surface-variant);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  md-outlined-text-field,
  md-outlined-select {
    width: 100%;
    max-width: 100%;
  }
  md-filled-button,
  md-filled-tonal-button,
  md-outlined-button,
  md-text-button,
  md-outlined-select,
  md-outlined-text-field {
    -webkit-app-region: no-drag;
    font-family: inherit;
    max-width: 100%;
  }
  md-filled-button,
  md-filled-tonal-button,
  md-outlined-button,
  md-text-button {
    min-height: 48px;
  }
  md-dialog {
    max-width: calc(100vw - 24px);
    width: 560px;
    --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  }
  .dialog-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dialog-content {
    padding-top: 8px;
  }
  .commands md-text-button {
    justify-content: flex-start;
    width: 100%;
  }
  .inspector {
    margin-top: 16px;
  }
  .step {
    font-size: 12px;
    color: var(--md-sys-color-primary);
  }
  .progress {
    display: flex;
    gap: 6px;
    margin: 12px 0;
  }
  .progress span {
    height: 4px;
    flex: 1;
    border-radius: 4px;
    background: var(--md-sys-color-outline-variant);
  }
  .progress span.active {
    background: var(--md-sys-color-primary);
  }
  :focus-visible {
    outline: 3px solid var(--md-sys-color-primary);
    outline-offset: 3px;
  }
  h1:focus,
  h2:focus {
    outline: none;
  }
  .shell,
  .panel,
  nav,
  header,
  .status,
  .badge,
  .selected {
    transition:
      background-color 160ms cubic-bezier(0.2, 0, 0, 1),
      color 160ms cubic-bezier(0.2, 0, 0, 1),
      border-color 160ms cubic-bezier(0.2, 0, 0, 1);
  }
  .view {
    animation: enter 200ms cubic-bezier(0, 0, 0, 1);
  }
  .record-label {
    animation: enter 180ms cubic-bezier(0, 0, 0, 1);
  }
  .feedback {
    animation: feedback 120ms ease-out;
  }
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes feedback {
    from {
      opacity: 0.5;
    }
    to {
      opacity: 1;
    }
  }
  @media (min-width: 1500px) {
    .workspace.has-inspector {
      grid-template-columns: 240px minmax(360px, 1fr) 280px;
    }
    .workspace > .inspector {
      margin: 0;
    }
  }
  @media (max-width: 1199px) {
    nav {
      width: 72px;
      padding: 12px 8px;
    }
    .navlabel {
      display: none;
    }
    .navsymbol {
      min-width: 0;
    }
    .workspace {
      grid-template-columns: 180px minmax(0, 1fr);
    }
    main {
      padding: 12px;
    }
    .panel {
      padding: 16px;
    }
  }
  @media (max-width: 850px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
    .fields {
      grid-template-columns: 1fr;
    }
    .fields .wide {
      grid-column: auto;
    }
    .workspace {
      grid-template-columns: 1fr;
    }
    .records {
      max-height: 220px;
    }
    .brand small {
      display: none;
    }
    header {
      gap: 4px;
    }
    .toolbar .heading {
      min-width: 160px;
    }
  }
  @media (max-width: 699px) {
    nav {
      display: none;
    }
    .menu {
      display: inline-flex;
    }
    header {
      flex-wrap: wrap;
    }
    .window {
      margin-left: auto;
    }
    .palette-label {
      display: none;
    }
    .onboarding {
      flex-wrap: wrap;
    }
    main {
      padding: 10px;
    }
    .settings-grid {
      display: flex;
      flex-direction: column;
    }
    .settings-grid > .panel {
      width: 100%;
    }
    dl {
      grid-template-columns: 1fr;
      gap: 6px;
    }
    dd {
      margin-bottom: 12px;
    }
    .panel {
      padding: 14px;
    }
  }
  /* Dense desktop workspace; controls retain their Material component semantics. */
  :host { --md-filled-button-container-height:32px;--md-outlined-button-container-height:32px;--md-text-button-container-height:32px;--md-filled-tonal-button-container-height:32px;--md-outlined-field-top-space:9px;--md-outlined-field-bottom-space:9px;--md-outlined-field-content-size:13px;--md-outlined-select-text-field-container-height:42px; }
  header{min-height:40px;padding:2px 8px}.brand strong{font-size:13px}.brand small{display:none}
  nav{width:54px;padding:6px 4px;gap:4px}nav .navlabel{display:none}nav .navsymbol{min-width:24px;margin:0}.selected{border-radius:8px}
  nav md-text-button{min-width:40px;--md-text-button-container-shape:8px;--md-text-button-container-height:40px}
  main{padding:8px;gap:8px}.toolbar .heading h1{font-size:16px}.toolbar p{margin:0;font-size:11px}
  main:has(>.operations-host:not([hidden])){overflow:hidden}
  .operations-host:not([hidden]){flex:1;min-height:0;height:auto}
  .panel{border-radius:4px;padding:12px}.fields,.editor,.settings-grid{gap:10px}.records md-text-button{min-height:42px}
  h2{font-size:15px;margin-bottom:8px}p{font-size:13px;line-height:1.45}
  md-filled-button,md-outlined-button,md-text-button,md-filled-tonal-button{--md-filled-button-container-shape:6px;--md-outlined-button-container-shape:6px;--md-text-button-container-shape:6px;--md-filled-tonal-button-container-shape:6px;font-size:12px}
  .onboarding{padding:8px;border-radius:4px}.onboarding p{display:none}.onboarding strong{font-size:12px}
  .status{font-size:11px;padding:4px 10px;min-height:24px}
  @media(max-width:699px){nav{display:none}main{padding:4px}}
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  }
`;
