# Complete feature planning inventory

Status: every production feature below is planned and unverified. This hand-written inventory expands the shared feature catalogue into individual obligations; it is not implementation evidence.

Surfaces: **A** Windows application; **W** documentation website/browser companion; **R** repository/build/release/operating process. A+W means independent delivery on both surfaces, with shared source permitted but no sibling-surface substitution. Platform capability limitations need exact documented reasons and tested alternative behavior; they never become silent omissions.

Before implementation, the next session must reread the current owner-managed canonical contracts and reconcile this planning inventory. The canonical contracts control detailed behavior. Public documentation uses neutral identifiers and never includes private vocabulary values or operational machine details.

## Language, voice and personalization

| ID | Requirement | Surface |
| --- | --- | --- |
| language | Persisted English/Cantonese/bilingual and complete localization | A+W |
| funny-emoji | Independent 1–5 humor levels default 5, fact-preserving copy, message emoji preference | A+W |
| personal-vocabulary | Visible local-only bounded JSON upload, atomic validation, replace/clear/corrupt states and leak exclusions | A+W |
| school-mode | Shared renamed mode, live propagation, protected exit, complete suppression/restoration | A+W |
| narration | Real per-language voice discovery, serialized speech, rate/pitch, screen-reader coexistence | A+W |
| scheduled-settings | Timezone/DST/precedence/base restoration and protected external sources for settings | A+W |
| display-name | Display-only rename preserving installed identity and data | A+W |
| adhd-modes | Five independently persisted modes, off by default, actual attention behavior | A+W |
| dim-sum | Required discovery/surprise behavior, accurate catalogue state and mode suppression | A+W |
| dim-sum-photo-source | Verified public catalogue URLs and licenses; consumer source contains no copied photographs | A+W+R |

## Material, appearance and layout

| ID | Requirement | Surface |
| --- | --- | --- |
| material-design | Complete Material Design 3 Expressive, registered genuine component provenance | A+W |
| workflow-navigation | Productive workspaces, task reachability and real application window controls | A+W |
| motion | Complete motion behavior with equivalent reduced-motion paths | A+W |
| appearance-editor | Every-element typography/layers/geometry/states/effects/motion editor, timeline, undo and resets | A+W |
| color-picker | Continuous color control/translation, contrast, history and exact entry | A+W |
| logo-customization | Safe local image conversion, crop/focal/fit/background, derivatives and rollback | A+W |
| overlay-panels | Bounded own-surface overlays, accessible move/resize/focus/restore | A+W |
| collapse-filters | Collapsible filters/statistics without losing state or discovery | A+W |
| accessibility-sizing | Accessible controls, target sizing, zoom and layout without clipping | A+W |
| functional-ui | Real action consumers and truthful empty/loading/error/unsupported states | A+W |

## Navigation, search and commands

| ID | Requirement | Surface |
| --- | --- | --- |
| tabs | Four edges, left default, group/reorder/pin/overflow/four discovery searches and bulk close | A+W |
| regex-search | Independent anchored full regex workbench at every search/menu/picker | A+W |
| command-palette | Ctrl+Shift+F, live rich controls, navigation/focus and shared action consumers | A+W |
| context-menus | Pointer/keyboard/touch menus on every element, appearance and lock routes | A+W |
| menu-shortcuts | Real working shortcut labels in menus | A+W |
| rich-controls | Typed interactive controls, visual editors and applicable canvases with actual consumers | A+W |
| guided-forms | Contextual stepwise help, shared validation/actions and isolated resettable playgrounds | A+W |
| settings-explanations | Current/default provenance, plain explanations and meaningful disabled reasons | A+W |
| blank-editors | Useful real presets and guided starting points in empty editors | A+W |

## Safety, locks and authentication

| ID | Requirement | Surface |
| --- | --- | --- |
| super-confirmation | Exact affected destination/data, two independent keys then full slider, cancel and focus return | A+W |
| element-locks | Independent per-element policies, protected enrollment and honest experience-lock limits | A+W |
| support-tickets | Searchable recovery desk, actual records, status/actions and exports | A+W |
| unlock-ladder | Preserved budgets, real timing, single-use challenges and correct escalation | A+W |
| authenticator | Protected local OTP management, real standards vectors and clock diagnosis | A+W |
| qr-pairing | Actual scannable pairing and manual equivalent, private secret handling | A+W |
| honest-monetization | Free defaults and accurate unavoidable upstream licensing/cost disclosure | A+W+R |

## Records, history and messages

| ID | Requirement | Surface |
| --- | --- | --- |
| local-history | Isolated append-only local history, protected sensitive access, restore-as-new-revision | A+W |
| exports | Complete formats, loss disclosure, selected/filtered scope and protected-data exclusions | A+W |
| bulk-actions | Selection/range/inverse/all-matches, per-item outcomes and partial/cancel/retry | A+W |
| changelog | Factual dates/releases/source links, filters/search and export | A+W |
| offline-docs | Complete bundled rendered articles, internal navigation and search | A+W |
| rendered-provider-text | Safe rendered upstream content instead of raw markup | A+W |
| notifications | Nonblocking messages, persistent errors, accessible review centre and actual recovery | A+W |

## Built-in tools and handoff

| ID | Requirement | Surface |
| --- | --- | --- |
| file-converter | All eight categories, offline verified adapters, PDF tools, unlimited disk-backed paged queue | A+W |
| minecraft-server-manager | Java/Bedrock versions/flavours/plugins and local-process/local-container/SSH-process/SSH-container targets | A+W |
| ollama-suite | Managed install/recovery, full catalogue/tags, hardware fit, durable pulls/chat/harness checkpoints | A+W |
| external-editor | Discovered configurable editors, actual file handoff and recovery | A+W |
| download-handoff | Distinct start/progress/complete download states and truthful paired-client transfer | A+W |
| forge-publishing | Previewed authenticated publication, exact destination/source and readback | A+W |
| progress-recovery | Progress at initiator, durable jobs/re-entry protection and contextual partial-result recovery | A+W |

## Completeness and evidence

| ID | Requirement | Surface |
| --- | --- | --- |
| completeness-parity | Hand-written per-surface identity/evidence manifests and exact-boundary negative tests | A+W+R |
| front-provenance | Actual front-screen version and updated-at/build provenance | A+W |
| product-evidence | Current genuine source/hash-bound screenshots in product descriptions | A+W+R |
| screen-recording | Genuine retained screen recording with provenance and safe large-file transport | A+W+R |
| design-reference-parity | Deterministic checked-in screen/state/theme/viewport/scale references and comparisons | A+W+R |
| design-folder | Target-owned design files and implementation handoff | R |
| layout-matrix | Full normal/minimum × three languages × two themes × four scales, geometry receipts | A+W+R |
| public-screenshot-gallery | Genuine reviewed public capture gallery at the applicable preservation milestone | R |

## Website and shared links

| ID | Requirement | Surface |
| --- | --- | --- |
| landing-site | Separate complete Material documentation/browser companion with independent feature coverage | W |
| mobile-site | Responsive touch/keyboard website from approximately 320 pixels | W |
| installer-download-button | Verified current installer download on the home surface | W |
| feature-articles | Full detailed feature articles and Cantonese twins rendered in the website | W+R |
| vendored-fonts | Scripted complete canonical font acquisition, licenses/hashes and local runtime consumption | A+W+R |
| shared-link-embed | Genuine current safe image and metadata for shared links | W+R |
| homepage-link | Verified GitHub Pages URL stored in repository About homepage | W+R |
| vocabulary-unlock-boundary | Private local language mapping only after the correct authenticated/local opt-in boundary | A+W |

## Status integration

| ID | Requirement | Surface |
| --- | --- | --- |
| status-hub | Authenticated current status, interactive questions/replies and truthful unavailable integration | A+W+R |
| discord-status-bridge | Scoped protected bridge and accurate delivery/readback evidence | R |
| panic-webhooks | Verified protected dispatch, immutable evidence and bounded safe destinations | R |
| tidbyt-displays | Registered owner-authorized factual event frames and actual delivery evidence | R |

## Build and install

| ID | Requirement | Surface |
| --- | --- | --- |
| build-entrypoints | Real root build.bat/build-installer.bat, silent mode and nonzero failure propagation | R |
| fresh-build-run-command | Fresh Windows one-command bootstrap/build/run with genuine receipts | R |
| dependency-fetcher | One-click pinned trusted dependency acquisition with actual installation readback | R |
| bundled-dependencies | Complete single-installer capability bundle, bundled-first discovery and offline proof | A+R |
| squirrel-installer | Real unsigned Squirrel.Windows Setup.exe/RELEASES/full packages/deltas | A+R |
| self-signing | Required-format project-owned signing only; no invented trust or secret exposure | A+R |
| auto-updates | Background discovery/download, unsigned ready banner, explicit restart, rollback and unsaved protection | A+R |
| app-icon | Original product identity, packaged icons, actual installed rendering | A+W+R |

## Release process

| ID | Requirement | Surface |
| --- | --- | --- |
| release-workflow | Implementation-phase publication produces real uniquely tagged normal releases and installer assets | R |
| release-timing | Actual workflow start/completion/duration in notes | R |
| release-line-counts | Workflow-produced line counts, accurate source scope | R |
| release-dim-sum-photo | Reconcile catalogue-only/no-consumer-copy policy with actual permitted release assets before publication | R |
| dim-sum-code-names | Accurate catalogue-linked release naming and mode boundaries | R |
| ci-bootstrap | Complete job dependency inventory and defensive safe output collection | R |
| runner-selection | Actual online/accessible compatible runner selection with cloud fallback | R |
| encrypted-public-builder | Private-source transport only if private source is later introduced; current source is public | R, conditional by privacy |

## Repository records

| ID | Requirement | Surface |
| --- | --- | --- |
| tabbed-readme | Navigable tabbed README presentation, genuine captures and actual links | R |
| human-time-estimate | Explicitly grounded human-effort estimate with its limits | R |
| sanitized-instruction-copy | Sanitized current owner-guidance mirror, no private source/values/host details | R |
| agents-md-vocabulary-block | Public-safe agent discipline with accurate identifier/privacy boundaries | R |
| vocabulary-hash-lock | Required local producer validation; no private password/mapping persisted publicly | R |
| roadmap-checklist | Factual checklist, complete backlog and evidence-based completion | R |
| feature-docs | Categorized per-feature Markdown articles and indexes | R |
| postman-collections | Actual HTTP APIs receive category/master collections; document non-HTTP IPC separately | R |
| wiki-site-sync | Complete current wiki content and website articles with internal routes | W+R |
| handoff-record | Current handoff document and titled repository-issue handoff | R |
| closeout-prompt | Published source-bound next-session prompt without private data | R |
| discussion-records | One rolling task record and per-release records when supported | R |
| project-board | Owned task item in a repository-linked project when permissions support it | R |
| operational-skill | Product-specific verified operating procedure and actual capability boundaries | R |

## Catalogue entries with narrower subjects

| ID | Requirement/disposition | Surface |
| --- | --- | --- |
| readme-prompt-banner | Applies to the canonical instruction repository; not a banner exposing private prompts in this public product | Canonical source only |
| single-file-instruction-editions | Applies to the canonical instruction repository; do not publish private editions here | Canonical source only |
| project-profile | Maintain a sanitized product profile in owner-controlled project memory, with private operations excluded from public source | Owner memory |
| roblox-model-catalogue | Conditional on building a Roblox game; no Roblox game is currently requested | Not applicable to current product |
| roblox-visual-realism | Conditional on Roblox visual/game work; not evidence for Buildroot or guest UI | Not applicable to current product |

## Required row expansion before delivery

Every applicable A/W row expands into separate surface records naming implementation paths, detailed/localized articles, copy resources, persistence, focused tests, red-then-green negative checks, exact built interaction receipts and genuine captures. Record unsupported capabilities with their actual limits; never mark a family complete from registry presence.

The planning-only owner instruction defers builds, installers, application/site implementation and release wiring to the next development session. Planning checkpoints are source preservation and do not claim delivered product releases.
