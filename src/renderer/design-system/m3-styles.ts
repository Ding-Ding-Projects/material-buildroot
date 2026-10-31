import { css, unsafeCSS } from 'lit';
import anatomy from './m3.css?inline';
import theme from './theme.css?inline';

const roles = ['primary','on-primary','primary-container','on-primary-container','secondary','on-secondary','secondary-container','on-secondary-container','tertiary','on-tertiary','tertiary-container','on-tertiary-container','error','on-error','error-container','on-error-container','surface','surface-dim','surface-bright','surface-container-lowest','surface-container-low','surface-container','surface-container-high','surface-container-highest','on-surface','on-surface-variant','outline','outline-variant','inverse-surface','inverse-on-surface','inverse-primary','scrim'];

/**
 * Material 3 Expressive design system from the repository design folder.
 * theme.css holds the colour roles, m3.css the component anatomy. The bridge
 * publishes the same roles as Material Web tokens so every registered
 * component inside nested workspaces renders from one palette.
 */
export const m3Theme = unsafeCSS(theme);
export const m3Anatomy = unsafeCSS(anatomy);
export const m3Bridge = unsafeCSS(`.m3{${roles.map(role => `--md-sys-color-${role}:var(--${role});`).join('')}--md-sys-color-shadow:#000;--md-sys-color-surface-variant:var(--surface-container-highest);--md-sys-color-on-surface-variant:var(--on-surface-variant);--md-ref-typeface-plain:'Roboto Flex Variable','Noto Sans HK Variable',system-ui,sans-serif;--md-ref-typeface-brand:'Roboto Flex Variable','Noto Sans HK Variable',system-ui,sans-serif;--md-sys-shape-corner-extra-small:4px;--md-sys-shape-corner-small:8px;--md-sys-shape-corner-medium:12px;--md-sys-shape-corner-large:16px;--md-sys-shape-corner-extra-large:28px;--md-sys-shape-corner-full:9999px;font-family:'Roboto Flex Variable','Noto Sans HK Variable',system-ui,sans-serif}.m3.dark{color-scheme:dark}.m3:not(.dark){color-scheme:light}`);
export const m3Styles = [m3Theme, m3Anatomy, m3Bridge, css`
  .m3 .mono{font-family:'Roboto Mono',monospace}
  .m3 button:disabled{cursor:default;opacity:.38}
  .m3 .ms{font-family:'Material Symbols Rounded'}
`];

/** Icon button anatomy only, for components that keep their own layout classes. */
export const m3IconButton = css`
  .ms{font-family:'Material Symbols Rounded';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;direction:ltr;font-feature-settings:'liga';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;user-select:none;flex-shrink:0}
  .sl{position:relative;overflow:hidden}
  .sl::after{content:"";position:absolute;inset:0;border-radius:inherit;background:currentColor;opacity:0;pointer-events:none;transition:opacity 150ms cubic-bezier(.2,0,0,1)}
  .sl:hover::after{opacity:.08}.sl:active::after{opacity:.1}
  .ib{position:relative;width:40px;height:40px;border:0;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:transparent;color:var(--md-sys-color-on-surface-variant);flex-shrink:0;cursor:pointer;transition:border-radius 250ms cubic-bezier(.3,0,0,1)}
  .ib:active{border-radius:12px}
  .ib:focus-visible{outline:3px solid var(--md-sys-color-secondary);outline-offset:2px}
`;
