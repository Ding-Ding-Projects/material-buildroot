# Guided image workspace remake

## Accepted direction

The October 18, 2026 redesign replaces the editor-first presentation with a guided image-building workspace across the entire application. The existing Lit runtime, registered Material components, validated host requests and project identity remain in place. This document supersedes the explorer-and-permanent-dock direction in `desktop-workspace-remake.md` for the new presentation. Existing reference captures remain historical until replacement captures are built and verified.

The primary destinations are Images, Builds, Tools, Help and Settings. Each uses a restrained header, labelled navigation, a clear page heading, one emphasized next action and contextual secondary actions. Comfortable density is the default. Narrow layouts collapse secondary summaries beneath the main content rather than introducing another independently scrolling column.

## Destination preservation inventory

| Destination | Required retained workflows |
| --- | --- |
| Images | Saved plans; create/open/adopt/import/clone project; source and runtime setup; configuration; image presets; package authoring; generated outputs; flashing; SDK export |
| Builds | Admission; queue; selected job and output; cancellation; retry; reconciliation; quarantine and recovery |
| Tools | Guests; local assistant; regex; browser companion; authenticator; trusted local tools; file conversion; PDF; file/model queue; server management |
| Help | Offline task-oriented articles; source links; article history; first-run setup; About; activity/history access |
| Settings | Language and wording; appearance; schedules; shared preferences; experience controls; backups/history; updates |

Existing `operation:*`, `tool:*`, `setting:*`, `wording:*`, `project:*`, `setup`, `new-plan` and `export-plans` identifiers remain compatible targets for the New tab catalog and command actions. Selecting a primary destination does not create a new workspace tab. Reopening a known project focuses its existing identity. Utility tabs require an explicit catalog choice.

## State and action ownership

The shell retains one mounted operations instance per adopted project. Presentation changes must not discard pending source, package, guest, configuration or tool drafts. The operations component accepts an opt-in guided presentation while retaining existing destination identifiers. Builds owns queue and log reading; a compact status affordance may navigate there but must not recreate a permanent output dock.

Independent source review requires keeping the actual configuration/image subtree mounted, not only its parent operations component. Navigation previously replaced that subtree. Preserve the exact child identity and generation checks used by permission review; leaving that context invalidates pending consent. Replace removed tab-panel references with a real visible heading relationship in guided presentation.

Image creation has five stages: purpose and target; source and execution setup; contents; review; build and result. Easy and Advanced presentation share one draft. Advanced choices that cannot be represented by a preset remain custom and are never silently overwritten. Continuing between stages is distinct from applying configuration, approving source execution or starting a build.

The existing ISO progress record contains only step, mode and job ID. The replacement draft record must be versioned and bounded, preserve compatible historical progress, detect concurrent changes and retain safe user choices. Stored names, IDs and paths never grant access. Resume re-reads current project, source, configuration and job evidence; consent, grants, effective configuration and readiness are never restored as permission. An editable image name is display/export metadata, not permission to change the fixed producer output path.

Guided navigation requests use a narrowly handled event with the current workspace identity and an allowlisted destination. The owning operations instance handles only its own project. Renderer navigation does not grant host authority or accept a command string.

Recovered job IDs use the existing workspace-scoped job lookup, page and cancellation operations. A valid-looking saved ID never proves project membership. Missing or mismatched jobs remain unverified with cancellation disabled. Storage denial, malformed records and concurrent changes retain in-memory values and visibly distinguish saved from unsaved state.

## Implementation ownership

The shell lane owns the primary shell, shared styling and focused settings presentation. The image lane owns the image workflow and draft presentation. The operations lane owns the execution adapter, focused runtime/configuration presentation, dedicated build workspace and tool routing. An independent design review checks their shared contracts before integration. Backend changes require a concrete missing operation rather than being introduced merely for the visual redesign.

## Verification and truthful delivery

The inspected pre-remake baseline contains twelve captures: workspace, configuration, builds, tools, documentation and settings at 1440 by 960 and 960 by 640, English/light at scale 1. It uses the unchanged packaged renderer produced at `8db4e8519a27e1a3878d96714717f68432af7ed1`, compared with `457b51ae4ead511a9be30857e93c289c0e9f3aad`. The renderer bundle SHA-256 is `8e62ad0f0cbd1299443d454ebb3ceb242766b67f21e2579b4860df73ee3bb4f1`. The local capture receipt SHA-256 is `250f5a74bca995e8b3d7ea754b684b91491969827e77370a4886d2380d77169f`.

| Baseline viewport | Editor left edge | Editor width | Operations height | Empty dock height |
| --- | ---: | ---: | ---: | ---: |
| 1440 by 960 | 499 px | 940 px | 526.5625 px | 140 px |
| 960 by 640 | 443 px | 516 px | 206.5625 px | 140 px |

These measurements explain the duplicate-navigation and permanent-dock removal. The route used a hidden desktop parent and isolated headless browser, a real local workspace service and explicit synthetic native replies. Documentation was captured in its unavailable-fixture state. The captures prove renderer pixels and raw geometry, not native startup, host operations, native display scaling or a validated layout-probe acceptance result. Both attempts and their profiles are retained privately; this document does not publish the captures or relabel them as the redesigned interface.

The baseline is 1440 by 960 CSS pixels and the existing documented minimum is 960 by 640. Verify English, Hong Kong Cantonese and bilingual modes, both themes and 100%, 125%, 150% and 200% display scales. Measure overflow, focus, accessible names, readable labels and reachable actions. Reference and production comparisons use matching tuples and source-bound captures.

Exercise first launch, create/open/resume, preset changes, contextual explanations, mode changes, saved drafts, reviewed configuration, actual authorized build and output location. Include unavailable runtimes, stale revisions, invalid inputs, cancellation, uncertain results, active work and unsaved changes. Cover every retained destination and the explicit New tab catalog.

Renderer fixtures prove renderer behavior only. The existing ISO, compiler and native-startup evidence retains its original source binding. Current-GUI ISO production, sustained native startup, release delivery and installed update remain incomplete until separately verified. No mock, design reference, successful process exit or previous output may stand in for those results.


## Focused local utility tasks

The Local tools category now selects one of five tasks: Local tool setup, Convert a file, PDF operations, File/model queue and Server management. The selection uses the existing searchable Material picker. It changes the visible task without opening another workspace tab. The explicit New tab catalog retains `tool:local`, `tool:convert`, `tool:pdf`, `tool:queue` and `tool:server` and selects the corresponding task through the component's validated public adapter.

All five sections remain mounted; inactive sections are hidden and inert. Conversion grants, PDF choices, queued model text and the server manager's own draft survive task changes. Only the chosen task is presented, with an existing readiness-based next action emphasized. Secondary actions and the outer Tools category selector remain available. Navigation never selects a file or executes a host operation. Short-height Tools continues to use its previously verified outer scroll owner.

Server management retains its existing tailored child workflow. The parent adds no duplicate action. The child emphasizes its existing next distribution, configuration, extension or lifecycle action while retaining the original handler, disabled conditions and explicit execution/consent boundaries. Its deeper world, player, console, profile and remote controls remain their existing workflows; this change adds no server behavior.
