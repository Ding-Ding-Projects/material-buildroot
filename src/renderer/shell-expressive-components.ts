import {css} from 'lit';

/** Opt-in component anatomy shared by the shell and its owned settings consumers. */
export const expressiveComponentStyles=css`
  .expressive-connected{display:flex;flex-wrap:wrap;gap:2px;align-items:stretch}
  .expressive-connected>md-outlined-button,.expressive-connected>md-filled-tonal-button{min-height:44px;--md-outlined-button-outline-width:0;--md-outlined-button-container-shape:8px;--md-filled-tonal-button-container-shape:8px;background:var(--md-sys-color-surface-container-highest);color:var(--md-sys-color-on-surface-variant)}
  .expressive-connected>:first-child{border-radius:24px 8px 8px 24px;--md-outlined-button-container-shape:8px;--md-filled-tonal-button-container-shape:8px}
  .expressive-connected>:last-child{border-radius:8px 24px 24px 8px;--md-outlined-button-container-shape:8px;--md-filled-tonal-button-container-shape:8px}
  .expressive-connected>[aria-pressed=true]{border-radius:24px;background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);--md-outlined-button-label-text-color:var(--md-sys-color-on-primary);--md-outlined-button-icon-color:var(--md-sys-color-on-primary);--md-filled-tonal-button-label-text-color:var(--md-sys-color-on-primary);--md-filled-tonal-button-container-color:var(--md-sys-color-primary)}
  .expressive-list{display:flex;flex-direction:column;gap:2px;min-width:0}
  .expressive-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;min-height:56px;padding:12px 16px;border-radius:4px;background:var(--md-sys-color-surface-container);min-width:0}
  .expressive-list>.expressive-row:first-child{border-start-start-radius:20px;border-start-end-radius:20px}
  .expressive-list>.expressive-row:last-child{border-end-start-radius:20px;border-end-end-radius:20px}
  .expressive-row .row-copy{flex:1;min-width:min(180px,100%);overflow-wrap:anywhere}
  md-slider{--md-slider-active-track-height:16px;--md-slider-inactive-track-height:16px;--md-slider-handle-width:4px;--md-slider-handle-height:44px;--md-slider-handle-shape:2px;--md-slider-with-tick-marks-container-size:4px;--md-slider-active-track-shape:8px;--md-slider-inactive-track-shape:8px;max-width:100%;min-height:44px}
  md-outlined-button,md-filled-button,md-filled-tonal-button{transition:border-radius 250ms cubic-bezier(.3,0,0,1)}
  md-outlined-button:active,md-filled-button:active,md-filled-tonal-button:active{border-radius:12px}
  @media(prefers-reduced-motion:reduce){md-outlined-button,md-filled-button,md-filled-tonal-button{transition:none}}
`;
