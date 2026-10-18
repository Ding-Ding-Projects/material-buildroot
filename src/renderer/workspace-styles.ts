import { css } from "lit";
export const workspaceStyles = css`
  .settings-grid > [hidden]{display:none!important;}
  :host {
    display: block;
    height: 100%;
    font-family: 'Roboto Variable','Noto Sans HK Variable',Roboto, "Segoe UI", "Microsoft JhengHei", sans-serif;
    --md-ref-typeface-plain:
      'Roboto Variable','Noto Sans HK Variable',Roboto, "Segoe UI", "Microsoft JhengHei", sans-serif;
    --md-ref-typeface-brand:
      'Roboto Variable','Noto Sans HK Variable',Roboto, "Segoe UI", "Microsoft JhengHei", sans-serif;
    --md-sys-color-primary: #315da8;
    --md-sys-color-on-primary: #fff;
    --md-sys-color-primary-container: #dce8ff;
    --md-sys-color-on-primary-container: #142e57;
    --md-sys-color-surface: #f8fafc;
    --md-sys-color-surface-container: #f1f5f9;
    --md-sys-color-surface-container-low: #ffffff;
    --md-sys-color-surface-container-high: #e8edf3;
    --md-sys-color-on-surface: #17212f;
    --md-sys-color-on-surface-variant: #526174;
    --md-sys-color-outline: #748093;
    --md-sys-color-outline-variant: #d8e0e9;
    --md-sys-color-secondary-container: #e2eaf5;
    --md-sys-color-on-secondary-container: #24354e;
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
    --md-sys-color-primary: #a8c7ff;
    --md-sys-color-on-primary: #0a305f;
    --md-sys-color-primary-container: #244779;
    --md-sys-color-on-primary-container: #dce8ff;
    --md-sys-color-surface: #111821;
    --md-sys-color-surface-container: #192330;
    --md-sys-color-surface-container-low: #151e29;
    --md-sys-color-surface-container-high: #243143;
    --md-sys-color-on-surface: #e7edf6;
    --md-sys-color-on-surface-variant: #b8c5d6;
    --md-sys-color-outline: #8e9db2;
    --md-sys-color-outline-variant: #465367;
    --md-sys-color-secondary-container: #34445c;
    --md-sys-color-on-secondary-container: #e2eaf5;
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
  /* Workspace proportions follow the package-authoring design reference. */
  :host{--md-filled-button-container-height:40px;--md-outlined-button-container-height:40px;--md-text-button-container-height:40px;--md-filled-tonal-button-container-height:40px;--md-outlined-field-top-space:12px;--md-outlined-field-bottom-space:12px;--md-outlined-field-content-size:14px}
  header{min-height:52px;padding:0 0 0 16px;flex-shrink:0}
  .brand{display:flex;align-items:center;gap:10px;flex:0 1 auto}.brand strong{font-size:15px;font-weight:500;white-space:nowrap}.brand small{display:none}
  .brand-mark{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:28px;height:28px;border-radius:8px;background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);font-size:13px;font-weight:700}
  .command-search{flex:1;max-width:520px;margin-inline:auto;--md-text-button-container-height:36px;--md-text-button-container-shape:18px;background:var(--md-sys-color-surface-container-high);border-radius:18px;color:var(--md-sys-color-on-surface-variant)}
  .window md-text-button{min-width:46px;--md-text-button-container-height:52px;--md-text-button-container-shape:0}
  nav{width:80px;padding:12px;gap:4px}nav .navlabel{display:none}nav .navsymbol{min-width:24px;margin:0}.selected{border-radius:16px}
  nav md-text-button{min-width:56px;--md-text-button-container-shape:16px;--md-text-button-container-height:56px}
  main{padding:16px;gap:16px}.toolbar .heading h1{font-size:22px}.toolbar p{margin:0;font-size:13px}
  main:has(>.operations-host:not([hidden])){overflow:hidden;padding:0;gap:0}
  main:has(>.operations-host:not([hidden]))>.toolbar{padding:12px 24px}
  .operations-host:not([hidden]){flex:1;min-height:0;height:auto}
  .panel{border-radius:16px;padding:16px 20px}.fields,.editor,.settings-grid{gap:16px}.records md-text-button{min-height:44px}
  h2{font-size:18px;margin-bottom:8px}p{font-size:14px;line-height:1.45}
  md-filled-button,md-outlined-button,md-text-button,md-filled-tonal-button{--md-filled-button-container-shape:20px;--md-outlined-button-container-shape:20px;--md-text-button-container-shape:20px;--md-filled-tonal-button-container-shape:20px;font-size:14px}
  .onboarding{padding:16px;border-radius:16px}.onboarding strong{font-size:14px}
  .status{font-size:12px;padding:8px 16px;min-height:32px}
  @media(max-width:1100px){nav{width:64px;padding:8px 4px}.brand strong{max-width:180px;overflow:hidden;text-overflow:ellipsis}}
  @media(max-width:699px){nav{display:none}main{padding:8px}header{padding-left:8px;gap:4px}.brand-mark{display:none}.brand strong{max-width:100px}.command-search{flex:0 0 auto}.window md-text-button{min-width:40px}.palette-label{display:none}}
  /* Scope shell layout to avoid changing nested workflow anatomy. */
  .shell > .body > nav{width:192px;padding:16px 12px;gap:8px}
  .shell > .body > nav .navlabel,.dialog-nav .navlabel{display:inline;white-space:normal;overflow-wrap:anywhere}
  .shell > .body > nav md-text-button{width:100%;min-width:0;min-height:48px;height:auto;--md-text-button-container-height:48px;justify-content:flex-start}
  .shell > .body > nav .navsymbol{margin-right:10px}
  .shell > .body > workspace-tabs{flex:1;min-width:0;min-height:0}
  .shell main{gap:20px;padding:24px;overflow:auto}
  .shell main:has(>.operations-host:not([hidden])){padding:0;gap:0;overflow:hidden}
  .shell main:has(>.operations-host:not([hidden]))>.toolbar{padding:20px 24px 12px}
  .shell .toolbar .heading{min-width:0}
  .shell .toolbar h1{font-size:28px;font-weight:500;line-height:1.25}
  .shell .toolbar p{margin-top:6px;font-size:14px}
  .shell .brand{min-width:0;flex:0 1 auto}.shell .brand strong{white-space:normal;max-width:none;overflow:visible}
  .shell .settings-page[hidden]{display:none!important}
  .shell .settings-grid{display:flex;flex-direction:column;gap:20px}
  .settings-categories,.image-actions{display:flex;flex-wrap:wrap;gap:8px}
  .settings-categories md-outlined-button[aria-pressed="true"]{background:var(--md-sys-color-secondary-container)}
  .project-context{display:flex;flex-wrap:wrap;gap:8px 24px;padding:0 24px 16px;font-size:13px;color:var(--md-sys-color-on-surface-variant)}
  .project-context span{overflow-wrap:anywhere;min-width:0}
  .images-workspace{max-width:1040px;width:100%;min-width:0}
  .image-projects{margin-top:24px;padding:24px}.image-projects h2{font-size:20px}
  .project-list{list-style:none;padding:0;margin:0}
  .project-list li{display:flex;align-items:center;gap:20px;padding:20px 0;border-top:1px solid var(--md-sys-color-outline-variant)}
  .project-list li>div{flex:1;min-width:0;overflow-wrap:anywhere}
  .project-list md-outlined-button{flex-shrink:0}
  .shell md-filled-button,.shell md-outlined-button,.shell md-text-button,.shell md-filled-tonal-button{min-height:44px}
  .shell.compact main{padding:16px;gap:12px}
  .shell.compact main:has(>.operations-host:not([hidden])){padding:0;gap:0}
  .shell.compact main:has(>.operations-host:not([hidden]))>.toolbar{padding:12px 20px 8px}
  .shell.compact .image-projects{padding:16px;margin-top:16px}
  .shell.compact .project-list li{padding:12px 0}
  .shell.compact > .body > nav{gap:4px;padding:12px}
  @media(max-width:900px){
    .shell > .body{flex-direction:column}
    .shell > .body > nav{display:flex;flex-direction:row;flex-wrap:wrap;width:auto;padding:8px;gap:4px;flex-shrink:0}
    .shell > .body > nav md-text-button{width:auto;flex:1 1 100px;--md-text-button-container-height:44px}
    .shell > .body > nav .spacer{display:none}
    .shell > .body > nav .navsymbol{margin-right:6px}
    .shell main{padding:16px}
    .shell .toolbar h1{font-size:24px}
  }
  @media(max-width:480px){
    .shell header{padding:8px;gap:4px;flex-wrap:wrap}
    .shell .brand{flex:1 1 140px}.shell .brand strong{font-size:14px}
    .shell > .body > nav md-text-button{flex:1 1 88px;font-size:13px}
    .shell .toolbar{align-items:flex-start}
    .shell main{padding:12px}
    .shell main:has(>.operations-host:not([hidden]))>.toolbar{padding:16px 12px 8px}
    .project-context{padding:0 12px 12px}
    .project-list li{align-items:stretch;flex-direction:column;gap:8px}
    .image-actions{align-items:stretch;flex-direction:column}
    .image-projects{padding:16px}
  }
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
