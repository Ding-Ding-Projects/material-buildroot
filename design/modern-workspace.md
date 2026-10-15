# Desktop workspace implementation and design record

The production renderer is Lit with pinned Material Web components. The original design baseline was `e4202d9`; independent review approved the compact working-area direction before implementation. This document describes the implemented source and remaining verification or feature gaps. It does not certify the full roadmap or native execution.

## Current product boundary

The initial workspace is **Project plans**, with a real record list and editable planning fields. Plans describe intended runtime, output and review status. They are distinct from adopted executable Buildroot projects, which live in **Project operations**. The interface does not present planning status as runtime admission, configuration validation or successful execution.

Production uses the optional trusted workspace bridge for durable plans, theme, onboarding progress and completion, snapshots, import and export. Mutations use the host's expected revision; IDs and timestamps come from the host. Rejected writes retain pending input, revision conflicts refresh saved state without overwriting the pending editor, and unknown outcomes disable workspace mutations until restart and reconciliation. If the bridge is absent, the explicitly labelled session-only fallback remains available. A bridge failure never silently becomes a successful session save.

Language preferences retain the original independent operation identity, capability refresh, revision checks, bounded retry, confirmed/draft separation and all recovery states. Neither navigation nor plan/theme changes may clear unknown or refresh-unavailable language outcomes.

## Implemented anatomy and controls

- A 56 px custom titlebar carries product context, an action launcher and real window commands. Controls are excluded from the drag region. Version/source/update metadata is in About.
- Navigation uses a 200 px labelled column, a 72 px compact rail below 1200 px and a Material navigation dialog below 700 px. Destinations are Project plans, Project operations, Activity, Settings and About.
- The plans workspace has a record list and editor, with a Details dialog. Name, intended runtime, intended output, review status and notes are editable. Apply, discard, duplicate, remove and export are real actions. Names are bounded to 80 characters, notes to 4000 and plans to 100. Duplicate shares the same bounds.
- Unsaved plan navigation requires Apply, Discard or Stay. Each dialog, destination heading and language field has a stable selector. Dialog close focus returns to its origin or the destination heading as appropriate.
- The unfiltered **Workspace actions** launcher opens with `Ctrl+Shift+F`. Tab, Up/Down, Home/End, Enter and Escape operate genuine controls. It is an action launcher, not a completed search palette.
- Settings provides durable language, host-backed theme where available, snapshot creation and restoration, and explicit JSON workspace import. Import previews the plan count and requires confirmation before replacing the current workspace. Host validation remains authoritative. Snapshots include only applied state.
- Activity presents actual events. Durable host activity retains up to 100 records; session-only fallback retains up to 200. The interface distinguishes them.
- Export initiates a JSON download. Feedback says **Download requested**, because renderer initiation cannot prove the destination file was saved or detect every silent host refusal.

Registered components include Material filled, tonal, outlined and text buttons; outlined text fields; selects/options; dialogs; icons with local SVG; tabs; checkboxes; switches; and linear progress. Locally bundled licensed Roboto and explicit `--md-ref-typeface-plain` / `--md-ref-typeface-brand` tokens serve Material shadow roots, with local Cantonese font fallbacks. Selects use explicit display text because bound values alone previously produced blank visible selections. That defect requires renewed captures, not acceptance of older screenshots.

## Practical onboarding

The three-step setup records an intended runtime, creates an actual editable plan, and exposes preferences and language review. Back, Skip for now and Resume setup remain available. The host stores step, runtime, pending name, associated plan ID, dismissal and completion separately. Returning to an already-created plan step must not create another record. Skipping is distinct from completing setup. No runtime scan, installation or project execution is inferred from onboarding.

Plan creation and subsequent onboarding-progress persistence are currently separate host mutations. An interruption between them can leave a valid created plan without the latest onboarding checkpoint. The existing plan remains visible; an atomic combined creation/checkpoint operation remains a recovery improvement, not a verified property.

## Project operations

The operations composite stays mounted when navigating to another workspace, preserving its admitted project and editing state. Genuine Material tabs provide these workflows:

| Surface | Implemented interaction | Authority and limitations |
| --- | --- | --- |
| Projects and runtime | Discover Docker/WSL, choose source/output through native pickers, review exact selection, explicitly trust source, adopt project; choose trusted Python for Kconfig inspection | Host validates directory grants and executes selected trusted tools. Discovery is not installation. Prior job retry may require choosing the same folders to renew access. |
| Builds | Choose runtime, WSL distribution or pinned Docker image, fixed target and parallelism; select runtime for configuration; submit, refresh jobs, page logs, request cancellation and create a new attempt | Host job records determine results. Cancel requested is distinct from cancelled; stale sequences are rejected. |
| Configuration | Inspect effective values; use admitted Kconfig tree/menu paths, help, dependencies and ranges when available; typed boolean/tristate/string/integer/hex controls; apply/reconcile, discard, undo and defconfig application | Parser unavailability is visible with its actual reason. Symbol rows are paged. Invisible/fixed values are disabled. Reconciliation requires a selected project runtime. |
| Artifacts | List output files and inspect format, size, digest and bounded text preview | Metadata inspection does not extract archives or prove deployment acceptance. Directory traversal UI remains incomplete. |
| Virtual machines | Discover providers, list managed guests, choose provider/hardware/disk, create/import, edit stopped hardware, launch, request shutdown and refresh actual state | Operates on application-owned records. Launch does not prove guest boot; shutdown request requires readback. Native provider verification remains open. |
| Disk conversion | Choose actual output artifact, format and new filename; preview source hash and exact output; confirm conversion | Host binds preview identity and rejects stale input or existing output. No arbitrary command editor. |
| Local assistant | Load installed Ollama models and send explicit chat messages to loopback service | Project data is not attached automatically. Missing local service/model remains an honest failure. |
| Updates | Check releases, inspect candidate version/source and request verified download | Unsigned installer status remains visible. Download does not install. Full install UX and native installer verification remain incomplete. |
| Regex workbench | Guided/raw ECMAScript patterns, flags, isolated evaluation, match navigation/captures, replacement preview, lexical annotation, capability explanations, test cases, session snippets and file import/export | See the exact gaps below. |

Guest and regex composites remain mounted across tab changes, retaining session inputs. Operations are not presented as completed merely because a button was clicked. The broad backend contract is still evolving; each workflow needs real host evidence separately from browser fixtures.

## Regex workbench and outstanding interface contract

The actual workbench uses a dedicated worker with bounded startup and a 250 ms evaluation deadline, 2000-character patterns, 64 KiB sample text, at most 500 displayed matches and 20 test cases. Zero-width iteration advances safely. Replacement output is bounded. Cancellation terminates the worker. Samples and patterns remain local. Guided constructs include literals, classes, captures, lookarounds, alternation, anchors, Unicode code points/properties and common greedy/lazy quantifiers. Engine-unsupported atomic groups, possessive quantifiers, conditionals, subroutines and native traces are explicitly identified.

This is usable implemented functionality, not the entire canonical interface contract. Remaining requirements include the complete syntax tree and deeper debugging facilities, engine-version capability proof, per-surface anchored builder/search integration and negative completeness inventory, persistent snippets/history, full search palette, four-edge reorderable/pinnable/groupable tabs, complete appearance editing, per-element guidance, accessibility tools, vocabulary loading and the other tracked cross-application features. Lexical annotation is explicitly labelled and must not be reported as a complete parser. A standalone workbench does not satisfy every required local search surface.

## Visual system, motion and reflow

Use the existing purple Material color roles, surface-container hierarchy, 12–16 px panel corners, readable body typography and 48 px action targets. Selected navigation and records use secondary-container with corresponding foreground roles. The supported minimum is 960 × 640 CSS px; smaller CSS viewports support zoom/reflow without changing that declared desktop minimum. At constrained widths, form columns stack, navigation becomes a dialog and record/editor regions use a single column. Pane and tab content remains reachable through bounded scrolling.

Every element class has meaningful state motion: 160 ms surface/theme color transitions, native Material control state layers, 200 ms route/panel entrance with at most 8 px movement, 180 ms record entrance and 120 ms feedback fades. No continuous decorative text motion or global `transition: all` is used. Native Material dialog motion owns modal presentation. Interactions update immediately and do not wait for animation callbacks. `prefers-reduced-motion` removes added transforms, transitions and animations. Screenshots must wait for stable dialog/route transitions; filling an inert background during modal close is not a valid interaction.

English, Hong Kong Cantonese and bilingual presentation cover owned UI copy and accessible names. Exact source symbols, external help, runtime names and protocol/state identifiers preserve their factual spelling. Longer bilingual labels wrap rather than relying on hover for recovery.

## Evidence and acceptance

Source-preview smoke checks exercised onboarding, creating an actual session plan, applying notes, navigating to Settings, runtime discovery, native-picker fixtures, source trust/adoption and worker regex capture evaluation. TypeScript checks passed at the implementation handoff. These checks do not prove real native tools, installation, guest boot or full visual acceptance.

The root integration lane owns fresh renderer tests and source-bound screenshots. Capture empty/populated/dirty/invalid plans; settings saving/conflict/unknown/recovery; onboarding/back/skip/resume; all operations tabs and failure states; guest conversion review; and regex valid/invalid/zero-width/timeout states. Cover 1440 × 900 and 960 × 640, light/dark, all three languages, 100/125/150/200% display scales and sub-700 CSS-pixel reflow. Bind evidence to exact source, built artifact digest, screen/state, viewport, theme, language and scale. Measure bounding boxes and winning computed layout, verify visible select labels and keyboard focus, and inspect the images.

The current user explicitly deferred Windows testing. Keep that gap visible. Replace current website/README/documentation presentation images only with inspected genuine captures of the rebuilt source. Historical evidence retains its original dates and provenance. Neither successful browser fixtures nor this document marks the full product roadmap complete.
