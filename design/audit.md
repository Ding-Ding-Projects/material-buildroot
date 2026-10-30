# material-buildroot feature audit against FEATURES.md (111 ids)

Read-only audit. Nothing in either repo was changed. Renderer paths are relative to `src/renderer/`.

## 1. Current shell map

**Entry HTML:** `index.html` (lang `zh-HK`, strict CSP, `connect-src 'none'`). It mounts `<material-buildroot>` and loads `/src/renderer/main.ts`. A second page, `transfer-progress.html`, mounts `<transfer-progress-view>` (`transfer-progress.ts`) in its own always-on-top progress window.

**Root element:** `material-buildroot` (class `MaterialBuildroot`, `main.ts`, about 2,300 lines). It owns `route` (default `images`), `settingsCategory`, project sessions and dialogs.

**Layout, from top to bottom:**
- `<guided-shell-attention>` (`guided-shell-attention.ts`, which extends `AttentionModePanel` from `attention-mode-panel.ts`). It is a floating attention/ADHD/narration region opened by the top-bar "tune" button. It also renders `<guided-shell-dim-sum>` (extends `DimSumPanel`, `dim-sum-panel.ts`).
- **Top bar (`<header>`), a frameless custom title bar** (`frame:false` in `src/main/index.cjs`). It contains:
  - Menu button, which opens `navigation-dialog`.
  - Brand: the "MB" mark plus `wording.productName()` and "Desktop workspace". A custom logo `<img>` is inserted by `appearance-logo.ts`.
  - Command-search button "Actions · Ctrl+Shift+F". Its click is intercepted by `command-surfaces.ts`, so it opens the palette.
  - Attention button.
  - `<notification-centre>`.
  - Minimize, maximize and close window controls (`window.studio`).
- **Nav rail** (`navigation()`): primary destinations come from `guided-shell.ts` `guidedDestinations`. These are Images, Builds, Tools, Help and Settings, plus a "Setup" button that opens `setup-dialog`.
- **`<workspace-tabs>`** (`workspace-tabs.ts`) wraps `<main>`. It provides a browser-style tab strip with a "New tab" catalogue built from `workspaceDestinations()`, groups, pinning, edge choice, a master list and a regex filter.
- **`<main>`** contains:
  - `<update-panel compact>`, the persistent update banner.
  - A toolbar heading for routes other than operations.
  - The route content (see the table below).
  - One `<operations-panel presentation="guided">` per open project session.
- **Status bar** (`.status`): `front-provenance` version and updated-at time, with seconds and the timezone.
- `<personal-vocabulary-drop>`: a whole-window JSON drop target with a level-up celebration and a tada sound.
- Elements appended at runtime:
  - `command-surfaces`: the palette, context menus and `searchable-picker`. It is appended to `.shell` on `whenDefined`.
  - `appearance-panel`: the per-element editor, appended to the app shadow root by `openAppearanceEditor`.
  - `experience-policy-panel[data-floating]`: element-lock wizard and unlock prompt, appended to `document.body`.
  - `destructive-confirmation`: appended by `requestDestructiveConfirmation`.

**Route mapping.** `go()` folds `builds`, `tools` and `help` into `route='operations'` and sets `operations-panel.tab`. `primaryForOperation()` chooses which rail item is highlighted.

| Route / destination | How it is reached | Element (tag), file |
|---|---|---|
| `images` | Rail | Inline `imagesView()` in `main.ts`. "Create image" goes to `image-creation`. |
| `image-creation` | From Images | `guided-image-creation`, `guided-shell-image-creation.ts`, plus `operations-panel` for the source stage |
| `builds` → operations `tab=builds` | Rail | `operations-panel` (`operations-panel.ts`) → `buildsView()` → `build-queue-panel` (→ `job-recovery-panel`) |
| `tools` → operations `tab=tools` | Rail | `tools-panel` (`tools-panel.ts`). Sub-tasks `tool:local`, `convert`, `pdf`, `queue` and `server` (`minecraft-panel` → `minecraft-remote-panel` and `minecraft-workflow-panel`), plus `editor-transfer-panel` |
| `help` → operations `tab=documentation` | Rail | `documentation-panel` (`documentation-panel.ts`) |
| `settings` | Rail | Inline `settingsView()` in `main.ts` (see settings below) |
| `projects` (Plans) | Actions dialog, palette, tab catalogue only | Inline `plansView()` |
| `activity` | Actions dialog, palette, tab catalogue only | Inline activity list |
| `about` | Actions dialog, palette, tab catalogue only | Inline About: version, source, updated time, Material Icons licence |
| operations `runtime` (Project & runtime) | Image sub-navigation and tabs | `project-workflow-panel`, `remote-runtime-panel`, `wsl-runtime-panel`, `execution-setup-panel` (→ `execution-workflow-panel` → `execution-jobs-panel`; `product-workflow-panel`) |
| operations `config` (Image guide) | Image sub-navigation | `image-presets-panel`. Sub-sections: `configuration-panel`, `defconfig-panel`, `account-provisioning-panel`, `named-targets-panel` |
| operations `source` | Image sub-navigation | `source-panel` |
| operations `package` | Image sub-navigation | `package-panel` (→ `package-discovery-panel`, `external-tree-panel`, `diagram-workbench`) |
| operations `artifacts` | Image sub-navigation | `artifact-viewers` (→ `forge-publication-panel`, `flashing-panel`, `cloud-destinations-panel`, `sdk-export-panel`, `output-evidence`) |
| operations `guests` | Tools select | `guest-panel` (→ `guest-topology` → `diagram-workbench`) |
| operations `assistant` | Tools select | `assistant-plan-panel` plus `ollama-workspace-panel` (→ `managed-ollama-panel`, `ollama-catalogue-panel`, `ollama-evidence-panel`) |
| operations `regex` | Tools select | `regex-workbench` |
| operations `authenticator` | Tools select | `authenticator-panel` (→ `authenticator-pairing`) |
| operations `companion` | Tools select | `companion-panel` |
| operations `updates` | Tab catalogue only (rail highlight: Settings) | `update-panel` (full) |

In guided presentation, `operations-panel` hides the older layout: explorer, `md-tabs` and the jobs dock. Each panel above is still reached through `guidedNavigation()` (the image sub-navigation buttons or the Tools `md-outlined-select`), through the tab catalogue (`operation:*`, `tool:*`) or through palette teleport.

**Settings organisation** (`settingsCategories()` and `settingsEntries()` in `main.ts`):
- `<settings-search>` (`settings-search.ts`, plain or regex search with `regex-workbench`) filters the categories.
- Category chips (`md-outlined-button`) switch a single visible section:
  - **Language:** language select, plus `language-wording-panel` (humour sliders and display name).
  - **Appearance:** density, theme with provenance.
  - **Schedules:** `scheduled-preferences-panel`.
  - **Experience:** `experience-policy-panel`, which holds locks, Support Tickets and the ladder.
  - **Shared preference:** `shared-mode-panel` (School mode).
  - **Backups:** snapshots, import and restore.
  - **Personal vocabulary:** `personal-vocabulary-panel`.
- School mode removes Language and Personal vocabulary.
- Each category is also a `setting:<id>` tab and palette destination.

**Dialogs (`md-dialog` in `main.ts`):** `navigation-dialog`, `new-plan-dialog`, `details-dialog`, `remove-dialog`, `leave-dialog`, `setup-dialog` (the three-step first-run wizard), `restore-dialog`, `import-dialog`, and `actions-dialog`. The actions dialog is the legacy route list: Plans, Operations, Activity, Settings and About, plus shared preference, schedules, vocabulary, Help, New plan, Export plans and Resume setup.

**Separate overlays:**
- Command palette, context menus and searchable pickers come from `command-surfaces` (`command-surfaces.ts`). The palette opens on Ctrl+Shift+F, size is card or wide (persisted), and it teleports to targets. Context menus open on right-click, the context-menu key or a long touch; they have a filter and show shortcuts.
- Notification centre (`notification-centre.ts`): a fixed right-side sheet with three tabs (Notifications, Changelog, Connection status / Status Hub). It has regex search, `review-date-range`, bulk review and Markdown export.
- Attention panel (`guided-shell-attention`).
- Appearance editor (`appearance-panel`): draggable and resizable, with five tabs including colour, motion and logo.
- Experience-lock panel (`experience-policy-panel`).
- Destructive confirmation (`destructive-confirmation`).

**Styling system:**
- `workspace-styles.ts` exports `workspaceStyles`, a Lit `css`. It defines a hand-set `--md-sys-color-*` token set (about 15 tokens, primary `#315da8`, a `.dark` override) and the Roboto Variable / Noto Sans HK typefaces through `--md-ref-typeface-*`. It also holds the shell layout and responsive rules (`@media(max-width:699px)`, etc.).
- `inherited-workspace-theme.ts` makes nested panels inherit the tokens.
- Fonts are vendored in `fonts.css` and `assets/roboto-latin.woff2`.
- Components are `@material/web` (`md-*`).
- Runtime appearance overrides are injected per shadow root by `appearance-panel.ts`. Low-stimulation overrides come from `attention-surfaces.ts`.

**Reachability note:** every custom element defined in `src/renderer` is instantiated from a chain that starts at `main.ts`. No defined element is orphaned. Plans, Activity and About are reachable only through the actions dialog, the palette or the tab catalogue; they are not on the nav rail.

## 2. Feature table

Statuses: wired / partial / missing / unwired / n/a (gui but not applicable). "—" means non-gui.

| id | category | status | where | gaps |
|---|---|---|---|---|
| job-experience-document-label | gui | n/a | — | No job-related workflows in this app |
| language | gui | wired | main.ts Settings›Language (`#language-select`); language-wording.ts | — |
| funny-emoji | gui | partial | language-wording-panel.ts `language-wording-panel` (Settings›Language) | No dialog-emoji switch; no first-run disclosure |
| personal-vocabulary | gui | wired | personal-vocabulary-panel.ts `personal-vocabulary-panel` (Settings›Personal vocabulary, palette `wording:*`) | — |
| vocabulary-drop-apply | gui | wired | personal-vocabulary-drop.ts `personal-vocabulary-drop` (+`personal-vocabulary-feedback`), mounted in main.ts; src/main/vocabulary-drop-sound.cjs | — |
| school-mode | gui | wired | shared-mode-panel.ts `shared-mode-panel` (Settings›Shared preference); owned-copy.ts `vocabulary.school()` | Off-switch is PIN/password only (no passkey) |
| narration | gui | wired | attention-mode-panel.ts + narration.ts `LocalNarrator`, via `guided-shell-attention` (top-bar button) | — |
| action-sound-effects | gui | missing | Only the drop tada (personal-vocabulary-drop.ts) | No action cues; no Settings switch |
| scheduled-settings | gui | wired | scheduled-preferences-panel.ts `scheduled-preferences-panel` (Settings›Schedules); appearance-schedule.ts | — |
| display-name | gui | partial | language-wording-panel.ts (Settings›Language); language-wording-state.ts | No append-only history record of renames |
| adhd-modes | gui | wired | attention-modes.ts, attention-mode-panel.ts via `guided-shell-attention` | — |
| dim-sum | gui | wired | guided-shell-dim-sum.ts `guided-shell-dim-sum` / dim-sum-panel.ts; host src/main/preferences/dim-sum.cjs (randomInt(10)) | — |
| dim-sum-photo-source | gui | wired | src/main/preferences/dim-sum.cjs (public catalogue + catalog-v1 assets, app-data cache) | — |
| material-design | gui | partial | @material/web throughout; workspace-styles.ts tokens | Raw HTML controls remain (checkboxes, pre); hand-set non-Expressive tokens; no component inventory |
| workflow-navigation | gui | wired | main.ts header/nav, guided-shell.ts; frameless window in src/main/index.cjs | Plans/Activity/About not on rail |
| motion | gui | wired | appearance-motion.ts `appearance-motion` (inside appearance-panel); reduced-motion in command-surfaces/attention-surfaces | — |
| appearance-editor | gui | partial | appearance-panel.ts `appearance-panel`, `openAppearanceEditor()` via context menu "Edit appearance…" | No layered image editing; Word/Photoshop depth unproven |
| color-picker | gui | wired | appearance-panel.ts colour tab; shared/appearance.ts (HEX/RGB/HSL/HSV/HWB/Lab/LCH/OKLCH/CMYK, rainbow) | — |
| logo-customization | gui | wired | appearance-panel.ts logo tab; appearance-logo.ts `applyLogo` + appearance-logo-worker.ts | Default "MB" text mark still shown alongside |
| overlay-panels | gui | partial | appearance-panel drag/resize/persist; notification-centre, attention panel fixed | Most panels not resizable or persisted |
| collapse-filters | gui | partial | `<details>` in notification-centre/docs; workspace-tabs groups | Search/filter rows not collapsible; no persistence |
| accessibility-sizing | gui | missing | Density only (Settings›Appearance) | No accessibility-tools menu; text size and contrast controls absent |
| functional-ui | gui | partial | Plans route (`plansView`) is labelled "not connected" | Plans are planning-only; discard is not history-recorded |
| onboarding-wizard | gui | partial | main.ts `setup-dialog` (`setupView`, 3 steps) | Creates plans, not real projects; limited real setup |
| tabs | gui | wired | workspace-tabs.ts `workspace-tabs` (catalogue, regex, groups, pin) | — |
| regex-search | gui | partial | regex-workbench.ts `regex-workbench` (Tools›Regex; embedded in settings-search, notification-centre, docs, pickers) | No dated RegexBuddy parity ledger found |
| command-palette | gui | wired | command-surfaces.ts `command-surfaces` `openPalette`, Ctrl+Shift+F, card/wide size | — |
| context-menus | gui | wired | command-surfaces.ts `openContext` (filter, Edit appearance, Lock), touch long-press | — |
| menu-shortcuts | gui | wired | command-surfaces.ts (`shortcut`, `aria-keyshortcuts`) | — |
| rich-controls | gui | partial | Palette rows activate real controls | Lists/results are mostly plain readouts; no virtualisation |
| guided-forms | gui | partial | guided-forms.ts `guided-forms` (language, theme, defconfig, package, diagram) | Present on about 8 controls only |
| info-icon-guidance | gui | partial | guided-forms.ts `md-icon-button#entry` | Not on every control; no per-control inventory |
| settings-explanations | gui | partial | main.ts `themeProvenance()`; short paragraphs | Provenance for theme only; no per-setting inventory |
| blank-editors | gui | partial | image-presets-panel.ts presets; appearance presets | Not all blank editors have default-derived presets |
| super-confirmation | gui | partial | destructive-confirmation.ts `requestDestructiveConfirmation` (two keys, slider, Emergency exit) | Used only for build clean; other deletes use plain dialogs |
| element-locks | gui | wired | experience-policies.ts `openExperiencePolicy`, experience-policy-panel.ts (six mixes) via context menu | — |
| support-tickets | gui | wired | experience-policy-panel.ts (Settings›Experience, unlock prompt) | Not linked from Help |
| unlock-ladder | gui | wired | experience-policy-panel.ts (dish, sums, `experience-mole-round`, clock); src/main/security/experience-policy.cjs | — |
| authenticator | gui | wired | authenticator-panel.ts `authenticator-panel` (Tools›Authenticator); src/main/security/authenticator.cjs | No camera capture |
| qr-pairing | gui | wired | authenticator-pairing.ts `authenticator-pairing` (authenticator + lock wizard) | — |
| honest-monetization | gui | n/a | No paid surfaces | — |
| local-history | gui | partial | Settings›Backups snapshots/restore (main.ts); appearance history (appearance-panel) | No unified history panel; no diff/prune/regex/date filter |
| exports | gui | partial | Plans, notifications (MD), appearance (JSON), artifacts, Activity | Not every datum; no 7z or format choice |
| bulk-actions | gui | partial | notification-centre, authenticator, job-recovery-panel, tools queue | Absent from most lists |
| changelog | gui | partial | notification-centre.ts Changelog tab (date range, regex, export) | No commit SHAs; not under Help/About |
| offline-docs | gui | wired | documentation-panel.ts `documentation-panel` (Help); src/main/documentation/service.cjs | — |
| rendered-provider-text | gui | partial | notification-centre/doc HTML via `unsafeHTML` of host-rendered Markdown | Not an isolated renderer; no README/PR previews |
| notifications | gui | partial | notification-centre.ts `notification-centre` (review centre) | No bottom-corner toasts |
| file-converter | gui | wired | tools-panel.ts `tool:convert`, `tool:pdf`; src/main/tools/* | — |
| minecraft-server-manager | gui | partial | minecraft-panel.ts (+remote, workflow) under Tools›Server | No Bedrock historical versions; Fabric/Paper only |
| ollama-suite | gui | wired | ollama-workspace-panel.ts, managed-ollama-panel.ts (Tools›Assistant) | — |
| external-editor | gui | wired | editor-transfer-panel.ts `editor-transfer-panel` (in tools-panel); src/main/tools/editor-transfer.cjs | — |
| download-handoff | gui | wired | editor-transfer-panel.ts (Start download / Downloading / Download complete); transfer-progress.html `transfer-progress-view`; companion-panel.ts | — |
| forge-publishing | gui | partial | forge-publication-panel.ts (Artifacts) | No multi-account list with sign-out and set-active |
| progress-recovery | gui | wired | build-queue-panel / job-recovery-panel.ts; in-panel progress | — |
| completeness-parity | non-gui | — | — | — |
| front-provenance | gui | wired | main.ts status bar `.front-provenance` + `buildTime()` | — |
| product-evidence | non-gui | — | — | — |
| screen-recording | non-gui | — | — | — |
| design-reference-parity | non-gui | — | — | — |
| design-folder | non-gui | — | — | — |
| layout-matrix | non-gui | — | — | — |
| public-screenshot-gallery | non-gui | — | — | — |
| landing-site | non-gui | — | — | — |
| responsive-documentation | non-gui | — | — | — |
| installer-download-button | non-gui | — | — | — |
| feature-articles | non-gui | — | — | — |
| vendored-fonts | non-gui | — | — | — |
| shared-link-embed | non-gui | — | — | — |
| homepage-link | non-gui | — | — | — |
| vocabulary-unlock-boundary | non-gui | — | — | — |
| private-site-app | non-gui | — | — | — |
| status-hub | gui | partial | notification-centre.ts Connection status tab; src/main/status-hub/service.cjs | No emoji states; thin evidence |
| discord-status-bridge | non-gui | — | — | — |
| panic-webhooks | non-gui | — | — | — |
| tidbyt-displays | non-gui | — | — | — |
| build-entrypoints | non-gui | — | — | — |
| fresh-build-run-command | non-gui | — | — | — |
| dependency-fetcher | non-gui | — | — | — |
| bundled-dependencies | non-gui | — | — | — |
| squirrel-installer | non-gui | — | — | — |
| self-signing | non-gui | — | — | — |
| auto-updates | gui | wired | update-panel.ts `update-panel` (compact banner in main + full panel at operation:updates) | — |
| app-icon | non-gui | — | — | — |
| release-workflow | non-gui | — | — | — |
| release-timing | non-gui | — | — | — |
| release-line-counts | non-gui | — | — | — |
| release-dim-sum-photo | non-gui | — | — | — |
| dim-sum-code-names | gui | missing | — | No code name in About or changelog |
| ci-bootstrap | non-gui | — | — | — |
| runner-selection | non-gui | — | — | — |
| encrypted-public-builder | non-gui | — | — | — |
| tabbed-readme | non-gui | — | — | — |
| human-time-estimate | non-gui | — | — | — |
| sanitized-instruction-copy | non-gui | — | — | — |
| agents-md-vocabulary-block | non-gui | — | — | — |
| vocabulary-hash-lock | non-gui | — | — | — |
| roadmap-checklist | non-gui | — | — | — |
| feature-docs | non-gui | — | — | — |
| postman-collections | non-gui | — | — | — |
| wiki-site-sync | non-gui | — | — | — |
| handoff-record | non-gui | — | — | — |
| closeout-prompt | non-gui | — | — | — |
| discussion-records | non-gui | — | — | — |
| project-board | non-gui | — | — | — |
| operational-skill | non-gui | — | — | — |
| readme-prompt-banner | non-gui | — | — | — |
| uh-single-file-editions | non-gui | — | — | — |
| project-profile | non-gui | — | — | — |
| roblox-model-catalogue | non-gui | — | — | — |
| roblox-visual-realism | non-gui | — | — | — |

**Counts:** 111 ids in total. 59 are gui and 52 are non-gui. Of the 59 gui features: 30 wired, 24 partial, 3 missing, 0 unwired, 2 n/a.

**Method caveat:** "partial" judgements are based on reading the source and keyword checks. No built app was run.
