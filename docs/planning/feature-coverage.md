# Complete feature planning inventory

Status: every production feature below is planned and unverified. This hand-written inventory expands the shared feature catalogue into individual obligations; it is not implementation evidence.

Surfaces: **A** Windows application; **D** public documentation visitor surface; **C** authenticated browser companion; **R** repository/build/release/operating process. A+D+C means separate delivery records and proof for all three surfaces. Shared implementation libraries are permitted; a sibling surface, redirect or shared state claim never substitutes for coverage. See [surface boundaries](surfaces.md). Platform capability limitations need exact documented reasons and tested alternative behavior; they never become silent omissions.

Before implementation, the next session must reread the current owner-managed canonical contracts and reconcile this planning inventory. The [direct contract reconciliation and dependency map](canonical-reconciliation.md) records all 109 identities, their concrete detail gaps and bounded independent review. The canonical contracts control detailed behavior. Public documentation uses neutral identifiers and never includes private vocabulary values or operational machine details.

## Language, voice and personalization

| ID | Requirement | Surface |
| --- | --- | --- |
| language | Persisted English/Cantonese/bilingual and complete localization | A+D+C |
| funny-emoji | Independent 1–5 humor levels default 5, fact-preserving copy, message emoji preference | A+D+C |
| personal-vocabulary | Visible local-only bounded JSON upload, atomic validation, replace/clear/corrupt states and leak exclusions | A+D+C |
| vocabulary-drop-apply | Whole-window local personal-wording JSON drop with atomic immediate application, accessible nonblocking celebration and retained Settings fallback | A+C |
| school-mode | Shared renamed mode, live propagation, protected exit, complete suppression/restoration | A+D+C |
| narration | Real per-language voice discovery, serialized speech, rate/pitch, screen-reader coexistence | A+D+C |
| scheduled-settings | Timezone/DST/precedence/base restoration and protected external sources for settings | A+D+C |
| display-name | Display-only rename preserving installed identity and data | A+D+C |
| adhd-modes | Five independently persisted modes, off by default, actual attention behavior | A+D+C |
| dim-sum | Required discovery/surprise behavior, accurate catalogue state and mode suppression | A+D+C |
| dim-sum-photo-source | Verified public catalogue URLs and licenses; consumer source contains no copied photographs | A+D+C+R |

## Material, appearance and layout

| ID | Requirement | Surface |
| --- | --- | --- |
| material-design | Complete Material Design 3 Expressive, registered genuine component provenance | A+D+C |
| workflow-navigation | Productive workspaces, task reachability and real application window controls | A+D+C |
| motion | Complete motion behavior with equivalent reduced-motion paths | A+D+C |
| appearance-editor | Every-element typography/layers/geometry/states/effects/motion editor, timeline, undo and resets | A+D+C |
| color-picker | Continuous color control/translation, contrast, history and exact entry | A+D+C |
| logo-customization | Safe local image conversion, crop/focal/fit/background, derivatives and rollback | A+D+C |
| overlay-panels | Bounded own-surface overlays, accessible move/resize/focus/restore | A+D+C |
| collapse-filters | Collapsible filters/statistics without losing state or discovery | A+D+C |
| accessibility-sizing | Accessible controls, target sizing, zoom and layout without clipping | A+D+C |
| functional-ui | Real action consumers and truthful empty/loading/error/unsupported states | A+D+C |

## Navigation, search and commands

| ID | Requirement | Surface |
| --- | --- | --- |
| onboarding-wizard | Practical in-app first-run setup with real actions/results, progress, Back/Next, save/resume, optional skipping and accessible localized completion into the workspace | A |
| tabs | Four edges, left default, group/reorder/pin/overflow/four discovery searches and bulk close | A+D+C |
| regex-search | Independent anchored full regex workbench at every search/menu/picker | A+D+C |
| command-palette | Ctrl+Shift+F, live rich controls, navigation/focus and shared action consumers | A+D+C |
| context-menus | Pointer/keyboard/touch menus on every element, appearance and lock routes | A+D+C |
| menu-shortcuts | Real working shortcut labels in menus | A+D+C |
| rich-controls | Typed interactive controls, visual editors and applicable canvases with actual consumers | A+D+C |
| guided-forms | Contextual stepwise help, shared validation/actions and isolated resettable playgrounds | A+D+C |
| info-icon-guidance | Independent per-control bundled info button above each capable target, contextual guidance, worked example and isolated playground with accessible focus return | A+D+C |
| settings-explanations | Current/default provenance, plain explanations and meaningful disabled reasons | A+D+C |
| blank-editors | Useful real presets and guided starting points in empty editors | A+D+C |

## Safety, locks and authentication

| ID | Requirement | Surface |
| --- | --- | --- |
| super-confirmation | Exact affected destination/data, two independent keys then full slider, cancel and focus return | A+D+C |
| element-locks | Independent per-element policies, protected enrollment and honest experience-lock limits | A+D+C |
| support-tickets | Searchable recovery desk, actual records, status/actions and exports | A+D+C |
| unlock-ladder | Preserved budgets, real timing, single-use challenges and correct escalation | A+D+C |
| authenticator | Protected local OTP management, real standards vectors and clock diagnosis | A+D+C |
| qr-pairing | Actual scannable pairing and manual equivalent, private secret handling | A+D+C |
| honest-monetization | Free defaults and accurate unavoidable upstream licensing/cost disclosure | A+D+C+R |

## Records, history and messages

| ID | Requirement | Surface |
| --- | --- | --- |
| local-history | Isolated append-only local history, protected sensitive access, restore-as-new-revision | A+D+C |
| exports | Complete formats, loss disclosure, selected/filtered scope and protected-data exclusions | A+D+C |
| bulk-actions | Selection/range/inverse/all-matches, per-item outcomes and partial/cancel/retry | A+D+C |
| changelog | Factual dates/releases/source links, filters/search and export | A+D+C |
| offline-docs | Complete bundled rendered articles, internal navigation and search | A+D+C |
| rendered-provider-text | Safe rendered upstream content instead of raw markup | A+D+C |
| notifications | Nonblocking messages, persistent errors, accessible review centre and actual recovery | A+D+C |

## Built-in tools and handoff

| ID | Requirement | Surface |
| --- | --- | --- |
| file-converter | All eight categories, offline verified adapters, PDF tools, unlimited disk-backed paged queue | A+D+C |
| minecraft-server-manager | Java/Bedrock versions/flavours/plugins and local-process/local-container/SSH-process/SSH-container targets | A+D+C |
| ollama-suite | Managed install/recovery, full catalogue/tags, hardware fit, durable pulls/chat/harness checkpoints | A+D+C |
| external-editor | Discovered configurable editors, actual file handoff and recovery | A+D+C |
| download-handoff | Distinct start/progress/complete download states and truthful paired-client transfer | A+D+C |
| forge-publishing | Previewed authenticated publication, exact destination/source and readback | A+D+C |
| progress-recovery | Progress at initiator, durable jobs/re-entry protection and contextual partial-result recovery | A+D+C |

## Completeness and evidence

| ID | Requirement | Surface |
| --- | --- | --- |
| completeness-parity | Hand-written per-surface identity/evidence manifests and exact-boundary negative tests | A+D+C+R |
| front-provenance | Actual front-screen version and updated-at/build provenance | A+D+C |
| product-evidence | Current genuine source/hash-bound screenshots in product descriptions | A+D+C+R |
| screen-recording | Genuine retained screen recording with provenance and safe large-file transport | A+D+C+R |
| design-reference-parity | Deterministic checked-in screen/state/theme/viewport/scale references and comparisons | A+D+C+R |
| design-folder | Target-owned design files and implementation handoff | R |
| layout-matrix | Full normal/minimum × three languages × two themes × four scales, geometry receipts | A+D+C+R |
| public-screenshot-gallery | Genuine reviewed public capture gallery at the applicable preservation milestone | R |

## Website and shared links

| ID | Requirement | Surface |
| --- | --- | --- |
| landing-site | Separate complete Material documentation/browser companion with independent feature coverage | D |
| mobile-site | Responsive touch/keyboard website from approximately 320 pixels | D |
| installer-download-button | Verified current installer download on the home surface | D |
| feature-articles | Full detailed feature articles and Cantonese twins rendered in the website | D+C+R |
| vendored-fonts | Scripted complete canonical font acquisition, licenses/hashes and local runtime consumption | A+D+C+R |
| shared-link-embed | Genuine current safe image and metadata for shared links | D+C+R |
| homepage-link | Verified GitHub Pages URL stored in repository About homepage | D+C+R |
| vocabulary-unlock-boundary | Private local language mapping only after the correct authenticated/local opt-in boundary | A+D+C |
| private-documentation-package | Conditional private-repository offline documentation package; not applicable to this public product | Private documentation only |

## Status integration

| ID | Requirement | Surface |
| --- | --- | --- |
| status-hub | Authenticated current status, interactive questions/replies and truthful unavailable integration | A+D+C+R |
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
| app-icon | Original product identity, packaged icons, actual installed rendering | A+D+C+R |

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
| wiki-site-sync | Complete current wiki content and website articles with internal routes | D+C+R |
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

Every applicable A/D/C row expands into distinct A, D and C records naming implementation paths, detailed/localized articles, copy resources, persistence, focused tests, red-then-green negative checks, exact built interaction receipts and genuine captures. Record unsupported capabilities with their actual limits; never mark a family complete from registry presence.

Application implementation is authorized and underway. The initial PH00 documentation checkpoint is separate from full production A/D/C acceptance; source preservation and an initial site do not establish delivered product releases. See the [phased roadmap](../../ROADMAP.md) for stable task IDs and explicit primary-phase ownership of all 109 identities.

## Current catalogue delta

The owner contract revision `13b4fb30ddcd1c7a4af6989a985ceae43af4f0eb` adds two independently tracked identities. The inventory now contains 109 identities and 436 explicit A/D/C/R records. The 398 existing requirement IDs are retained and 14 reviewed child requirements are added, giving 412. All new records are planned or explicitly inapplicable to this public product; no implementation or runtime acceptance is implied. See [the bounded reconciliation](catalogue-delta-2026-10-16.md).
