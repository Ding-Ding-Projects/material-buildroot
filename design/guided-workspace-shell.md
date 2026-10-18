# Guided workspace shell

## Scope and implementation handoff

This handoff defines the shell around the existing Lit and Material Web workflow panels. It introduces five labelled primary destinations: Images, Builds, Tools, Help, and Settings. It does not change native execution, trust admission, ISO validation, or the retained destination catalog. Current GUI ISO execution and boot validation remain unverified.

Images is the initial productive overview. Its primary action opens the existing project creation workflow, Open project opens the existing trusted-project picker workflow, and session project rows resume the exact retained project instance. No sample projects, simulated build results, or invented runtime readiness are shown. Planning records remain available through the catalog and a secondary Plans action.

Builds opens the existing build queue for the active project. Tools opens the existing tool workspace. Help opens the complete in-app documentation browser. Settings opens existing settings with their persistence and search. The New tab catalog retains every current destination, including source, configuration, package authoring, output files, guests, local assistant, regex, authenticator, companion, updates, plans and activity. Primary navigation changes the displayed destination without manufacturing utility tabs.

## State and ownership

Keep the keyed operations-panel repeat mounted for every adopted project, including the unadopted workspace. Images overview hides those hosts without changing their active inner destination. Resume reveals the same instance, preserving its pending configuration, logs and project identity. Existing plan and scheduled-preference leave decisions continue to run before a destination changes. The sibling operations lane owns preservation of inner editor panels when its own tab changes.

Use public panel navigation properties or methods only, never private shadow DOM mutation to select a workflow. The shell supports a composed `operation-destination-changed` event from an operations host to synchronize the primary selected state and header after inner navigation. The sibling may expose `openProjectWorkflow(mode)` for create/open selection; without that supported method, both entry points open the existing project workflow with its explicit choices rather than inventing a picker result.

The shell displays the actual selected project name and a truthful runtime configuration summary from a validated read of the existing project.options host action: a named WSL distribution, saved container image, explicitly not selected or unavailable. The last-read label and explicit Refresh status action keep freshness honest and exclude unsaved panel inputs. Configured does not mean verified, running, or build-ready. No default runtime kind alone is readiness evidence.

## Layout and controls

Use registered Material Web buttons with bundled Material Icons and persistent text labels. A quiet title bar holds product identity, actions, notifications and native window controls. A 192 px labelled navigation column and a restrained content heading establish hierarchy. Main content scrolls in one column; no shell output dock is introduced. The sibling operations lane removes its permanent output dock. Neutral light/dark surfaces and one blue accent use the existing theme-token and appearance plumbing. Fresh workspace tab layouts default to the top while saved user placement is retained. Attention and narration controls open in a bounded keyboard-accessible panel from the title bar or destination catalog, preserving the existing controller without its permanent toolbar. Settings categories show one section at a time and retain mounted panels and drafts while navigating.

At 900 px and below, navigation becomes a wrapping labelled horizontal row above content. At 480 px and below, controls and project rows stack without hiding action labels. The menu dialog remains an equivalent keyboard route. Main headings receive focus after navigation; selected buttons include the current-workspace state in their accessible name (the installed Material button does not forward `aria-current` to its internal button). Material controls retain visible focus and at least 44 px interaction height. Reduced motion respects the existing global rule. English, Cantonese and bilingual labels use the existing localization boundary.

Appearance offers Comfortable (default) and Compact shell density. A bounded version-1 local presentation preference preserves the choice without host authority. Invalid stored data falls back to Comfortable with visible feedback; a failed write leaves the previous applied density intact. Compact reduces spacing, never the 44 px minimum interaction height.

## Reference states and verification

Stable states: `images-empty`, `images-projects`, `project-runtime`, `builds`, `tools`, `help`, `settings`, `catalog`, and `draft-leave-decision`. Validate at 1440×960, 1024×768, 640×900 and 320×800 CSS pixels, both themes, English/Cantonese/bilingual and 100/125/150/200% scale in the integrated built application. This document is a design reference, not a capture receipt.

Focused renderer fixtures check five primary labels and selected state, no utility-tab inflation, exact instance reuse on resume, honest empty/runtime state, the complete catalog, leave-decision preservation, narrow layout bounds and direct-action routing. Fixture results do not prove native picker, runtime, build, installer, ISO or boot success. The parent integration owns built captures and the full layout matrix.

Independent design and source review approved implementation. Built verification remains pending. This handoff supersedes the older shell reference requiring an explorer and permanent dock; those elements are intentionally removed by the coordinated operations presentation.

## Renderer implementation evidence

The focused guided-shell fixture suite passed 17 checks. It covers primary navigation without automatic utility tabs, exact retained project/editor identity, public create/open adapter calls, inactive-host event rejection, scheduled and plan draft navigation decisions, retained settings panels, filtered settings jumps, complete compatibility identifiers, attention focus return, density persistence/write rejection/invalid types, saved runtime records versus draft inputs, output/update grouping, and horizontal bounds at 960/640/320 CSS pixels in English, Cantonese and bilingual modes.

The candidate TypeScript diagnostic set is identical to the baseline: 23 diagnostics in unchanged sibling files, none in these shell files. This is not a whole-project typecheck pass. Computed WCAG text contrast ratios for the six principal light/dark foreground/background pairs are 15.50, 5.77, 6.44, 15.17, 9.06 and 7.67. Existing personal appearance overrides remain supported and require their own contrast checks.

The operations adapter must be integrated before claiming the duplicate inner navigation and output dock are removed. Native project pickers, runtime acquisition/execution, ISO generation, boot validation, installation, and the integrated built layout matrix remain outside this renderer evidence. The retained original attention controller now renders as `guided-shell-attention`; shared test fixtures targeting the old element or Project operations heading need coordinated adaptation.

## Attention preservation follow-up

The initial drawer wrapper hid the existing attention feedback and could consume startup presentation invisibly. The base attention controller now exposes protected composition methods for settings, feedback, and the catalogue component. The guided composition keeps enabled time-awareness, next-action and idle feedback visible independently of the drawer. Default-off feedback adds no permanent utility row. The same mounted catalogue controller retains startup suppression, shared restrictions and dismissal behavior; its ordinary entry controls appear only in the open drawer.

Escape restores a connected visible opener or the stable header control after catalog navigation. A nested control that already handles Escape keeps the drawer open. Closing while a catalogue-photo request is pending invalidates that presentation epoch; a late response cannot reappear as a startup surprise or overwrite a newer request's busy state.

The final focused shell suite passed 22 checks in 33.8 seconds, including all five added attention preservation cases. All 103 recorded renderer input hashes remained unchanged across the run. Original output and before/after receipts are retained as local verification records. TypeScript still reports the identical 23 baseline diagnostics in unchanged sibling files. This remains renderer evidence only.

Restriction cancellation now uses that same presentation-cancellation hook. This also resets busy state when a catalogue or photo request is invalidated, so removing restrictions permits another request. Two deferred-reply regressions reproduced the previous stuck state before the change. After the change, all eight focused attention checks passed in 12.5 seconds, including a stale reply arriving while the new retry remains pending. The unchanged broader shell checks retain their preceding result; this follow-up does not claim a new full-suite or native verdict.
