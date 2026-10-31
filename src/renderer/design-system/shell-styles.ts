import { css } from 'lit';

/**
 * Window shell and destination layouts from design/Main.dc.html and the
 * other artboards. Selectors are scoped to .win so the older shared
 * workspace rules cannot reshape the title bar, rail or panes.
 */
export const shellStyles = css`
  :host{display:block;height:100%}
  .win.shell{min-height:0;height:100%;background:var(--surface-container);color:var(--on-surface)}
  .win > header.tbar{min-height:64px;height:64px;border:0;padding:0 0 0 20px;gap:8px;-webkit-app-region:drag}
  .win > header.tbar button,.win > header.tbar notification-centre{-webkit-app-region:no-drag}
  .win > header.tbar .menu{display:none}
  .win .tbar .brand{flex:0 0 auto}
  .win .tbar .bt .title-m{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .win .tbar .bt .label-s{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .win .tbar .search{cursor:pointer;text-align:left;font:inherit}
  .win .tbar .search .placeholder{flex:1;min-width:0;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--on-surface-variant)}
  .win .tbar .search .regex-mark{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;color:var(--on-surface-variant)}
  .win .tbar .wctl{height:64px}
  .win .tbar .wctl button{width:48px;height:100%}
  .win .runtime-chip{max-width:220px;overflow:hidden}
  .win > .body{display:flex;flex:1;min-height:0}
  .win > .body > nav.rail{width:96px;padding:4px 0 16px;gap:4px;background:transparent;border:0;flex-shrink:0;display:flex;flex-direction:column;align-items:center;overflow-y:auto}
  .win nav.rail .ri{cursor:pointer;font-family:inherit}
  .win nav.rail .spacer{flex:1}
  .win nav.rail .rail-create{margin:4px 0 20px}
  .win nav.rail .navlabel{margin:0}
  .win workspace-tabs.panes{flex:1;min-width:0;min-height:0;padding:0 16px 16px 0;display:flex}
  .win main.main-pane{flex:1;min-width:0;min-height:0;overflow:auto;padding:32px;gap:24px;display:flex;flex-direction:column;border-radius:28px;background:var(--surface)}
  .win main.main-pane[data-route="operations"],.win main.main-pane[data-route="image-creation"]{padding:8px 0 0}
  .win main.main-pane > operations-panel{flex:1;min-height:0}
  .win .page-head{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}
  .win .page-head .heading{flex:1;min-width:240px;display:flex;flex-direction:column;gap:4px}
  .win .page-head h1{margin:0;font-size:32px;line-height:40px;font-weight:500;letter-spacing:-.25px}
  .win .page-head p{margin:0;font-size:16px}
  .win .head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .win .sbar{height:32px;padding:0 24px;gap:16px;border:0;background:transparent;display:flex;align-items:center;font-size:12px}
  .win .sbar .status-message{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .win .sbar .grow,.win .grow{flex:1}
  .win .sbar .front-provenance{white-space:nowrap}
  .win .btn,.win .chip,.win .ib,.win .fab,.win .cbg > button{font-family:inherit}
  .win .btn:disabled,.win .chip:disabled,.win .cbg > button:disabled{opacity:.38;cursor:default}

  /* Images home (design/Main.dc.html) */
  .images-home{display:flex;flex-direction:column;gap:24px}
  .chip-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .chip-row .chips{display:flex;gap:8px;flex-wrap:wrap}
  .project-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
  .pcard{display:flex;flex-direction:column;gap:16px;padding:20px;border-radius:24px;min-height:200px}
  .pcard.card.e1{background:var(--surface-container-low)}
  .pcard .pc-head{display:flex;align-items:center;gap:12px}
  .pcard .pc-head .txt{flex:1;min-width:0;display:flex;flex-direction:column}
  .pcard h2{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pcard p{margin:0}
  .pcard .av.err{background:var(--error);color:var(--on-error)}
  .pcard .pc-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px}
  .pcard .status-line{display:flex;align-items:center;gap:6px}
  .pcard .lp .act{width:auto}
  .pcard.empty{min-height:120px;justify-content:center}
  .decision{display:flex;align-items:center;gap:12px;padding:16px 20px;flex-wrap:wrap}
  .decision p{flex:1;min-width:200px;margin:0}
  .guide-card{background:var(--surface-container);border-radius:28px;padding:24px;display:flex;flex-direction:column;gap:20px}
  .guide-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap}
  .guide-head > div:first-child{flex:1;min-width:220px}
  .guide-head h2{margin:0}
  .guide-head p{margin:4px 0 0}
  .stage-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
  .stage{display:flex;flex-direction:column;gap:6px;padding:16px;border-radius:20px;min-height:108px;background:var(--surface);border:1px solid var(--outline-variant);color:var(--on-surface)}
  .stage .ms,.stage .rb{margin-bottom:10px}
  .stage.done{background:var(--primary-container);color:var(--on-primary-container);border-color:transparent}
  .stage.done .ms{color:var(--primary)}
  .stage.current{border:2px solid var(--primary);padding:15px}
  .stage .body-s{color:inherit;opacity:.85}
  .guide-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .library[hidden]{display:none}
  .standalone{display:flex;flex-direction:column;gap:16px;align-items:flex-start}

  /* Settings (design/Settings.dc.html) */
  .win .settings-grid.view{display:grid;grid-template-columns:280px minmax(0,1fr);gap:24px;align-items:start}
  .win .settings-sidebar{position:sticky;top:0;display:flex;flex-direction:column;gap:12px;background:var(--surface-container-low);border-radius:28px;padding:16px 12px}
  .win .settings-sidebar h2{margin:4px 12px 0;font-size:22px;line-height:28px;font-weight:500}
  .win .settings-categories{display:flex;flex-direction:column;gap:2px}
  .win .settings-grid > section.panel,.win .settings-grid > div > section.panel,.win .settings-grid > div:not(.settings-sidebar){min-width:0}
  .win section.panel{background:var(--surface-container-low);border-radius:28px;padding:24px;display:flex;flex-direction:column;gap:12px}
  .win section.panel h2{font-size:22px;line-height:28px;font-weight:500;margin:0}
  .win section.panel p{margin:0}

  @media (max-width:1180px){
    .stage-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .win .settings-grid.view{grid-template-columns:1fr}
    .win .settings-sidebar{position:static}
  }
  @media (max-width:860px){
    .win main.main-pane{padding:20px}
    .stage-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
  @media (max-width:600px){
    .win > .body{flex-direction:column-reverse}
    .win > .body > nav.rail{width:100%;flex-direction:row;justify-content:space-around;padding:8px 0;overflow:visible}
    .win nav.rail .navlabel{font-size:12px}
    .win > header.tbar .menu{display:inline-flex}
    .win workspace-tabs.panes{padding:0 8px 8px}
    .stage-grid{grid-template-columns:1fr}
    .win .page-head h1{font-size:28px;line-height:36px}
    /* The desktop window keeps its controls and provenance in every size class. */
    .win > header.tbar .wctl{display:flex!important}
    .win > footer.sbar{display:flex!important;padding:0 12px}
    .win > footer.sbar .status-message{display:none}
    .win > header.tbar .brand{width:auto}
    .win .tbar .search .placeholder,.win .tbar .search .regex-mark{display:none}
  }
`;
export const shellFocusStyles = css`
  .win #workspace-heading:focus,.win #settings-heading:focus{outline:none}
  .win .pcard.empty{grid-column:1/-1}
  .win .settings-sidebar settings-search{margin:0 4px}
  .win .settings-categories .ndi{cursor:pointer;font-family:inherit}
`;
export const shellHiddenStyles = css`
  .win [hidden]{display:none!important}
`;
export const shellSizeStyles = css`
  .win > header.tbar .mid .search.command-search{width:100%;min-width:0;max-width:640px;height:48px;padding:0 4px 0 16px}
  .win nav.rail{scrollbar-width:none}
  @media (max-width:1180px){
    .win > header.tbar .brand{width:auto}
    .win > header.tbar .search .kbd{display:none}
  }
  @media (max-height:760px){
    .win nav.rail .rail-create{margin:0 0 8px}
    .win nav.rail .ri{padding:2px 0}
  }
  @media (max-width:600px){
    .win > header.tbar .mid .search.command-search{width:48px;padding:0;justify-content:center}
  }
`;
export const shellNarrowStyles = css`
  .win .project-grid{grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr))}
  .win .page-head .heading{min-width:min(240px,100%)}
  .win .images-workspace,.win .images-home,.win .guide-card,.win .pcard{min-width:0;max-width:100%}
  .win .guide-actions .btn,.win .head-actions .btn,.win .decision .btn{max-width:100%;white-space:normal;height:auto;min-height:40px;text-align:center}
  .win .guide-actions .btn.m{min-height:56px}
  .win .cbg{max-width:100%}
  @media (max-width:600px){
    .win main.main-pane{padding:16px 12px}
    .win .chip-row .grow{display:none}
    .win .guide-card{padding:16px}
    .win .stage-grid{grid-template-columns:minmax(0,1fr)}
  }
`;
export const shellShortStyles = css`
  /* Very short renderer heights: the rail moves into the navigation menu. */
  @media (max-height:500px){
    .win > header.tbar{height:56px;min-height:56px}
    .win > header.tbar .menu{display:inline-flex}
    .win > header.tbar .wctl{height:56px}
    .win > .body > nav.rail{display:none}
    .win workspace-tabs.panes{padding:0 8px 8px}
    .win main.main-pane{padding:16px}
  }
`;
