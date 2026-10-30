import { css } from 'lit';

/** Nested workspaces inherit every role from the owning shell, including dark surfaces. */
export const inheritedWorkspaceTheme = css`
  :host {
    color: inherit;
    font-family: inherit;
    --md-ref-typeface-plain: inherit;
    --md-ref-typeface-brand: inherit;
    --md-sys-color-primary: inherit;
    --md-sys-color-on-primary: inherit;
    --md-sys-color-primary-container: inherit;
    --md-sys-color-on-primary-container: inherit;
    --md-sys-color-secondary: inherit;
    --md-sys-color-on-secondary: inherit;
    --md-sys-color-secondary-container: inherit;
    --md-sys-color-on-secondary-container: inherit;
    --md-sys-color-tertiary: inherit;
    --md-sys-color-on-tertiary: inherit;
    --md-sys-color-tertiary-container: inherit;
    --md-sys-color-on-tertiary-container: inherit;
    --md-sys-color-error: inherit;
    --md-sys-color-on-error: inherit;
    --md-sys-color-error-container: inherit;
    --md-sys-color-on-error-container: inherit;
    --md-sys-color-surface: inherit;
    --md-sys-color-surface-dim: inherit;
    --md-sys-color-surface-bright: inherit;
    --md-sys-color-surface-container-lowest: inherit;
    --md-sys-color-surface-container-low: inherit;
    --md-sys-color-surface-container: inherit;
    --md-sys-color-surface-container-high: inherit;
    --md-sys-color-surface-container-highest: inherit;
    --md-sys-color-on-surface: inherit;
    --md-sys-color-on-surface-variant: inherit;
    --md-sys-color-outline: inherit;
    --md-sys-color-outline-variant: inherit;
    --md-sys-color-inverse-surface: inherit;
    --md-sys-color-inverse-on-surface: inherit;
    --md-sys-color-inverse-primary: inherit;
    --md-sys-color-scrim: inherit;
    --app-elevation-1: inherit;
    --app-elevation-2: inherit;
    --app-elevation-3: inherit;
  }
`;
