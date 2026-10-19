import { css } from 'lit';

/** Nested workspaces use their owning shell's palette rather than root defaults. */
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
`;
