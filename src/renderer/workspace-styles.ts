import {expressiveComponentStyles} from './shell-expressive-components';
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
  .shell > .body > nav {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 12px;
    background: var(--md-sys-color-surface-container-low);
    border-right: 1px solid var(--md-sys-color-outline-variant);
  }
  .shell > .body > nav md-text-button {
    width: 100%;
    justify-content: flex-start;
  }
  .shell > .body > nav .spacer {
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
  .shell > .body > nav,
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
    .shell > .body > nav {
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
  /* Remade desktop chrome. Workflow panels retain their own layout boundaries. */
  :host{--md-sys-color-primary:#415F91;--md-sys-color-on-primary:#FFFFFF;--md-sys-color-primary-container:#D6E3FF;--md-sys-color-on-primary-container:#284777;--md-sys-color-secondary:#565F71;--md-sys-color-on-secondary:#FFFFFF;--md-sys-color-secondary-container:#DAE2F9;--md-sys-color-on-secondary-container:#3E4759;--md-sys-color-tertiary:#705575;--md-sys-color-on-tertiary:#FFFFFF;--md-sys-color-tertiary-container:#FAD8FD;--md-sys-color-on-tertiary-container:#573E5C;--md-sys-color-error:#BA1A1A;--md-sys-color-on-error:#FFFFFF;--md-sys-color-error-container:#FFDAD6;--md-sys-color-on-error-container:#93000A;--md-sys-color-surface:#F9F9FF;--md-sys-color-surface-dim:#D9D9E0;--md-sys-color-surface-bright:#F9F9FF;--md-sys-color-surface-container-lowest:#FFFFFF;--md-sys-color-surface-container-low:#F3F3FA;--md-sys-color-surface-container:#EDEDF4;--md-sys-color-surface-container-high:#E7E8EE;--md-sys-color-surface-container-highest:#E2E2E9;--md-sys-color-on-surface:#191C20;--md-sys-color-on-surface-variant:#44474E;--md-sys-color-outline:#74777F;--md-sys-color-outline-variant:#C4C6D0;--md-sys-color-inverse-surface:#2E3036;--md-sys-color-inverse-on-surface:#F0F0F7;--md-sys-color-inverse-primary:#AAC7FF;--md-sys-color-scrim:#000000;--app-elevation-1:0 1px 2px rgba(0,0,0,.3),0 1px 3px 1px rgba(0,0,0,.15);--app-elevation-2:0 1px 2px rgba(0,0,0,.3),0 2px 6px 2px rgba(0,0,0,.15);--app-elevation-3:0 1px 3px rgba(0,0,0,.3),0 4px 8px 3px rgba(0,0,0,.15);--md-filled-button-container-height:44px;--md-outlined-button-container-height:44px;--md-text-button-container-height:44px;--md-filled-tonal-button-container-height:44px}
  .dark{--md-sys-color-primary:#AAC7FF;--md-sys-color-on-primary:#0A305F;--md-sys-color-primary-container:#284777;--md-sys-color-on-primary-container:#D6E3FF;--md-sys-color-secondary:#BEC6DC;--md-sys-color-on-secondary:#283141;--md-sys-color-secondary-container:#3E4759;--md-sys-color-on-secondary-container:#DAE2F9;--md-sys-color-tertiary:#DDBCE0;--md-sys-color-on-tertiary:#3F2844;--md-sys-color-tertiary-container:#573E5C;--md-sys-color-on-tertiary-container:#FAD8FD;--md-sys-color-error:#FFB4AB;--md-sys-color-on-error:#690005;--md-sys-color-error-container:#93000A;--md-sys-color-on-error-container:#FFDAD6;--md-sys-color-surface:#111318;--md-sys-color-surface-dim:#111318;--md-sys-color-surface-bright:#37393E;--md-sys-color-surface-container-lowest:#0C0E13;--md-sys-color-surface-container-low:#191C20;--md-sys-color-surface-container:#1D2024;--md-sys-color-surface-container-high:#282A2F;--md-sys-color-surface-container-highest:#33353A;--md-sys-color-on-surface:#E2E2E9;--md-sys-color-on-surface-variant:#C4C6D0;--md-sys-color-outline:#8E9099;--md-sys-color-outline-variant:#44474E;--md-sys-color-inverse-surface:#E2E2E9;--md-sys-color-inverse-on-surface:#2E3036;--md-sys-color-inverse-primary:#415F91;}
  ${expressiveComponentStyles}
  .shell{overflow:hidden;min-height:0;background:var(--md-sys-color-surface-container)}.shell>[hidden],.shell main>[hidden],.settings-content>[hidden]{display:none!important}
  .shell>header{height:64px;min-height:64px;flex:0 0 64px;flex-wrap:nowrap;gap:8px;padding:0 0 0 12px;background:var(--md-sys-color-surface-container);border:0}
  .brand{display:flex;align-items:center;gap:10px;flex:0 1 300px;min-width:100px}.brand-copy{min-width:0}.brand strong{display:block;font-size:15px;font-weight:600;white-space:normal;overflow-wrap:anywhere;line-height:1.2}.brand small{display:block;font-size:10px;line-height:1.25;max-height:26px;overflow:auto}.brand-mark{display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;border-radius:10px;background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);font-weight:600;font-size:13px}
  .command-search{flex:1;min-width:44px;max-width:640px;height:48px;min-height:48px;max-height:48px;align-self:center;box-sizing:border-box;margin-inline:auto;background:var(--md-sys-color-surface-container-highest);border-radius:24px;color:var(--md-sys-color-on-surface-variant);--md-text-button-container-height:48px}.palette-label{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;max-width:100%;height:20px;line-height:20px;white-space:nowrap;text-align:start}.command-copy{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.palette-label kbd{flex-shrink:0}kbd{font:500 11px/1.4 inherit;padding:3px 6px;border-radius:6px;background:var(--md-sys-color-surface-container);white-space:nowrap}
  header md-text-button{min-width:44px;min-height:44px}.window{flex-shrink:0}.window md-text-button{width:48px;min-width:44px;--md-text-button-container-height:56px;--md-text-button-container-shape:0}
  .shell>.body{flex-direction:row;overflow:hidden}.shell>.body>nav{display:flex;width:96px;padding:4px 8px 16px;gap:8px;background:var(--md-sys-color-surface-container);border:0;overflow:auto;align-items:center}
  .shell>.body>nav md-text-button{width:80px;min-width:0;min-height:64px;height:auto;--md-text-button-container-height:64px;--md-text-button-container-shape:20px;padding:4px;flex-shrink:0}
  .shell>.body>nav .nav-content{display:flex;flex-direction:column;align-items:center;width:100%;max-width:72px}.shell>.body>nav .navsymbol{display:flex;align-items:center;justify-content:center;margin:0;min-width:0;width:56px;height:32px;border-radius:999px}.shell>.body>nav .selected{background:transparent}.shell>.body>nav .selected .navsymbol{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}.shell>.body>nav .navlabel{display:block;margin:3px 0 0;white-space:normal;overflow-wrap:anywhere;font-size:11px;line-height:1.25}
  .shell>.body>nav .rail-create{width:56px;min-width:56px;height:56px;flex-shrink:0;margin-bottom:8px;--md-filled-tonal-button-container-height:56px;--md-filled-tonal-button-container-shape:16px;--md-filled-tonal-button-container-color:var(--md-sys-color-tertiary-container);--md-filled-tonal-button-label-text-color:var(--md-sys-color-on-tertiary-container)}
  .shell>.body>workspace-tabs{flex:1;min-width:0;min-height:0;margin:0 16px 16px 0}.shell main{padding:28px 32px;gap:24px;min-height:0;overflow:auto;container-type:inline-size;background:var(--md-sys-color-surface);border-radius:28px}.shell main:has(>.operations-host:not([hidden])){padding:0;gap:0;overflow:hidden}.operations-host:not([hidden]){flex:1;min-height:0;height:auto}.shell main:has(>.operations-host:not([hidden]))>.toolbar{padding:20px 24px 12px}
  .toolbar .heading{min-width:0}.toolbar .heading h1{font-size:32px;font-weight:500;line-height:1.25}.toolbar p{font-size:14px;margin:4px 0 0}.panel{border-radius:16px;padding:20px 24px;background:var(--md-sys-color-surface-container)}
  .settings-grid{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;align-items:start}.settings-sidebar{position:sticky;top:0;padding:16px 12px;border-radius:28px;background:var(--md-sys-color-surface-container-low);min-width:0;display:grid;gap:16px}.settings-sidebar h2{padding-inline:12px}.settings-sidebar>settings-search{min-width:0;position:relative;z-index:2}.settings-categories{display:flex;flex-direction:column;gap:4px;min-width:0;position:static}.settings-categories md-outlined-button{width:100%;height:auto;min-height:48px;--md-outlined-button-outline-width:0;--md-outlined-button-container-shape:24px;white-space:normal;text-align:start}.settings-categories .selected{background:var(--md-sys-color-secondary-container)}.settings-content{min-width:0;display:flex;flex-direction:column;gap:16px}.settings-content>*{min-width:0;max-width:100%}.settings-content .stack{gap:12px}.settings-content .panel{width:100%;border:0;background:var(--md-sys-color-surface-container-low);border-radius:28px}.settings-content .fields{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
  .images-workspace{width:100%;min-width:0}.image-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.project-context{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;padding:8px 24px;font-size:13px;color:var(--md-sys-color-on-surface-variant)}.project-context span{min-width:0;overflow-wrap:anywhere}
  .shell md-filled-button,.shell md-outlined-button,.shell md-text-button,.shell md-filled-tonal-button{min-height:44px}.status{flex:none;min-height:32px;max-height:64px;overflow:auto;font-size:11px;padding:6px 16px}.front-provenance{margin-right:16px;overflow-wrap:anywhere}.shell.compact main{padding:16px;gap:16px}.shell.compact main:has(>.operations-host:not([hidden])){padding:0;gap:0}.shell.compact .panel{padding:16px}
  @container(max-width:700px){.settings-grid{grid-template-columns:minmax(0,1fr)}.settings-sidebar{position:static}.settings-categories{position:static;flex-direction:row;flex-wrap:wrap}.settings-categories md-outlined-button{width:auto;flex:1 1 160px}.toolbar .heading h1{font-size:28px}}
  @media(max-width:1200px){.shell>header .command-search{flex:0 0 44px;width:44px;min-width:44px;max-width:44px;height:44px;min-height:44px;max-height:44px;padding:0;--md-text-button-container-height:44px;--md-text-button-with-leading-icon-leading-space:10px;--md-text-button-with-leading-icon-trailing-space:10px;--md-text-button-icon-size:24px}.shell>header .palette-label{display:none}}
  @media(max-width:1100px){.brand{flex-basis:230px}.palette-label kbd{display:none}.shell main{padding:20px}.shell>header{gap:4px}}
  @media(max-width:760px),(max-height:500px){.shell>.body>nav{display:none}.shell>header .menu{display:inline-flex}.shell>header{gap:0;padding-left:4px}.shell>header .brand{flex:1;min-width:0;padding-inline:4px}.shell>header .brand-mark,.shell>header .brand small,.shell>header .palette-label,.shell>header .header-help{display:none}.shell>header .brand strong{font-size:13px}.shell>header .command-search{flex:0 0 44px;margin:0}.shell>header md-text-button{width:44px;min-width:44px;max-width:44px}.window md-text-button{--md-text-button-container-height:44px}.shell main{padding:12px}.toolbar .heading h1{font-size:24px}.dialog-nav .navlabel{display:inline;margin-left:8px}.settings-grid{grid-template-columns:minmax(0,1fr)}.settings-sidebar{position:static}.settings-categories{position:static;flex-direction:row;flex-wrap:wrap}.settings-categories md-outlined-button{width:auto;flex:1 1 140px}}
  @media(max-width:420px){.brand strong{max-height:40px;overflow:auto}.shell>header #attention-button{display:none}.panel{padding:12px}.image-actions{align-items:stretch}.image-actions>*{flex:1 1 140px}}
  @media(max-width:600px){.shell>.body{flex-direction:column-reverse}.shell>.body>nav{display:flex;flex-direction:row;width:100%;max-height:88px;min-height:64px;padding:4px;gap:0;justify-content:space-around;overflow:auto}.shell>.body>nav>.rail-create,.shell>.body>nav>.rail-menu,.shell>.body>nav>.spacer,.shell>.body>nav>.rail-setup{display:none}.shell>.body>nav md-text-button{width:auto;flex:1;min-width:52px;min-height:56px;--md-text-button-container-height:56px}.shell>.body>nav .navlabel{font-size:10px}.shell>.body>workspace-tabs{margin:0 8px 8px}.shell main{border-radius:20px}.shell>header .brand strong{font-size:12px}.shell>header #attention-button,.shell>header .header-help{display:none}.shell>header .menu{display:inline-flex}.shell>header .brand small{display:none}.status{display:flex;flex-wrap:wrap;min-height:32px;max-height:64px}.settings-sidebar{padding:12px}}
  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
