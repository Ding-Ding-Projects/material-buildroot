import {css} from 'lit';
/** Shared layout for the tool work area. All colours inherit the application roles. */
export const workspacePresentationStyles=css`
:host{container-type:inline-size;min-width:0}
.tools-workspace{display:grid;grid-template-columns:minmax(240px,320px) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:16px;padding:16px;box-sizing:border-box;background:var(--md-sys-color-surface-container);min-height:0;height:100%;overflow:hidden}
.tools-search-bar{grid-column:1/-1;display:flex;gap:12px;align-items:start;min-width:0}.tools-search-bar settings-search{flex:1;min-width:0}.tools-workspace[data-drawer-open=false]{grid-template-columns:minmax(0,1fr)}
.workspace-sidebar{border-radius:28px;min-width:0;overflow:auto;padding:20px 12px;background:var(--md-sys-color-surface-container-low);border-right:0}
.workspace-sidebar h2{font-size:22px;margin:0 12px 16px}.workspace-sidebar h3{font-size:13px;font-weight:500;margin:20px 12px 8px;color:var(--md-sys-color-on-surface-variant)}
.workspace-destination{width:100%;min-height:56px;text-align:left;white-space:normal;--md-list-item-label-text-size:16px}.workspace-destination[aria-current=page]{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container);border-radius:20px}.tool-group md-list{background:transparent;padding:0}
.workspace-body{border-radius:28px;background:var(--md-sys-color-surface);min-width:0;min-height:0;overflow:auto;padding:24px;align-content:start;scroll-padding:16px}
.workspace-heading{display:flex;gap:16px;align-items:start;justify-content:space-between;flex-wrap:wrap}.workspace-heading h2{font-size:30px;font-weight:500;line-height:1.25}.workspace-heading p{margin-top:8px;max-width:65ch}.eyebrow{color:var(--md-sys-color-primary);font-size:12px;font-weight:600}
.conversion-stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;list-style:none;padding:0;margin:0}.conversion-stages li{padding:16px;border-radius:16px;background:var(--md-sys-color-surface-container);overflow-wrap:anywhere}.conversion-stages li[data-ready=true]{background:var(--md-sys-color-tertiary-container);color:var(--md-sys-color-on-tertiary-container)}
@container(max-width:860px){.tools-workspace{grid-template-columns:1fr;overflow:auto;height:auto}.tools-search-bar{grid-column:1/-1;display:flex;gap:12px;align-items:start;min-width:0}.tools-search-bar settings-search{flex:1;min-width:0}.tools-workspace[data-drawer-open=false]{grid-template-columns:minmax(0,1fr)}
.workspace-sidebar{border-radius:28px;border-right:0;border-bottom:1px solid var(--md-sys-color-outline-variant);max-height:260px}.workspace-body{border-radius:28px;background:var(--md-sys-color-surface);padding:16px;overflow:visible}.conversion-stages{grid-template-columns:1fr}.tools-search-bar{flex-wrap:wrap}.tools-search-bar settings-search{flex-basis:100%}}
`;
