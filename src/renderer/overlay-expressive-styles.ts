import {css} from 'lit';
import {expressiveComponentStyles} from './shell-expressive-components';

/** Overlay-only anatomy extends the shared component rules without owning a palette. */
export const overlayExpressiveStyles=[expressiveComponentStyles,css`
 :host{color:var(--md-sys-color-on-surface);font-family:inherit}
 md-text-button,md-filled-button,md-filled-tonal-button,md-outlined-button,md-icon-button{min-height:48px;min-width:48px;white-space:normal}
 md-slider{min-height:48px}
 md-switch,md-checkbox{margin-block:8px;flex-shrink:0}
 .hero-icon{display:flex;justify-content:center;color:var(--md-sys-color-secondary)}.hero-icon md-icon{--md-icon-size:32px;width:32px;height:32px}
 .floating-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:8px;border-radius:28px;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
 :focus-visible{outline:3px solid var(--md-sys-color-secondary);outline-offset:2px}
 @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`];
