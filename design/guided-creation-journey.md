# Image creation before project selection

Baseline: `4c41de12de9795f749e2978dd13ed0face6cc0c0`. This design supplements the guided shell and image workflow references. It describes renderer behavior, not native execution or boot evidence.

## Journey

Create image opens Purpose and target before any native folder picker. The editable safe name, Easy/Advanced mode, intended purpose and BIOS x86-64 target are local choices. Every purpose is explicitly an unverified intention until the selected source's real capability catalogue is read. No selection implies a supported package, permission, configuration result, or image readiness.

Next saves the intent and opens Source and runtime, composing the existing project Create/Open/Adopt/Import/Clone controls. It does not invoke a picker automatically. Back and Return to Images retain the intent. Restart restores its stable identifier and stage. Adoption binds only the host-returned stable workspace identifier and automatically enters that project's existing image guide at Source and runtime. Existing trust, runtime, configuration, build, job and output controls remain authoritative.

The Images workspace reads the actual project.list catalogue on entry and after adoption, with distinct loading, empty, unavailable and Retry states. Stable identifiers deduplicate catalogue rows and mounted session instances. Open invokes project.open even when metadata says authorized; metadata never recreates a grant. Unauthorized rows open the existing folder-renewal workflow. A renewal request retains the expected identifier and accepts only the matching host-returned identity. A mismatched selection is reported and never substitutes for the requested project or binds its image intent.

## Persistence and transfer

A bounded version-1 local pre-project record stores only a stable draft ID, revision, stage, safe name, Easy/Advanced mode, purpose enum, target enum and optional workspace ID. It stores no paths, runtime objects, source grants, consent, capabilities, preview, readiness, output or job result. Reads validate shape and bounds; writes compare against the previous raw value to detect concurrent changes. Invalid or unavailable storage remains visible and cannot silently overwrite the previous record.

A typed renderer adapter transfers the validated intent into the project-scoped version-2 image draft. An optional creation ID makes repeat delivery idempotent. Transfer invalidates configuration/readiness and consent. A different existing project draft is a conflict, with explicit Resume existing and Replace choices actions. Resume preserves existing choices and every job reference. Replace archives the previous allowlisted draft under a bounded recovery inventory before writing the new choices; it preserves any job ID and leaves it unverified at the result/recovery stage rather than dropping it. If the recovery inventory is full, storage fails, a concurrent write occurs, or execution is pending, replacement stops without losing either draft. The pre-project intent remains recoverable after transfer and across restart.

## Product layout

Use one current task heading. Purpose has compact inline guidance, a single main action and secondary Back/Return actions. At 960×640 its name, purpose, target and Next must be visible without a stack of repeated shell headings. Guided operations suppress duplicate outer title/subtitle, unnecessary no-project runtime context and redundant inner navigation rows during image creation. All destinations remain reachable in the existing New tab catalog and an explicit contextual advanced-tools disclosure. A compact empty-tab presentation is opt-in and preserves saved placement, existing tabs, minimum 44 px controls and the full catalog. Existing bundled icons are used directly: inventory_2 for Images, build for Builds, code for Tools and tune for attention.

## Verification and independent review

Renderer cases: Purpose precedes every picker; save/cancel/restart preserve identity and choices; adoption continues into Source; repeated transfer is idempotent; different drafts require a decision; replacement archives the previous record and retains job IDs; real catalogue metadata survives restart; denied/expired access requires renewal; matching identifiers are enforced; failed catalogue reads show Retry; storage conflicts and failures preserve prior data. Existing typed ISO permission/build behavior remains unchanged.

Built acceptance belongs to the integrating task, at the same inspected 960×640 and 1440×960 tuples, including the first visible Name/Purpose/Next controls and English/Cantonese/bilingual layouts. Source preview fixtures do not claim native folder access, runtime, build, ISO or boot success.

Independent design and source review approved the implemented storage, transfer recovery, and asynchronous adoption boundaries. Review required shared locking, invalid-record preservation, identity-based idempotence, pending-save draining, transfer interaction locking, a return-to-editing path, and generation-bound adoption. These are implemented and covered below.

## Implemented behavior and evidence

Create and Resume are separate actions. Creating another intent requires an explicit choice and archives the previous allowlisted record before generating a new stable ID. Source summaries localize purpose labels and use distinct bundled icons. The safe image name suggests a project folder name only while that form remains untouched; typed project choices are retained.

Project catalogue reads come from the host after entry and adoption. Session rows merge by stable ID. Opening always rechecks host authority. Renewing uses the existing picker and rejects a different returned project identity. Pending open responses are invalidated by later navigation. Project adoption carries its original creation context; late completion remains available without forcing navigation or binding to a newer intent.

All project-image draft writers and incoming transfer use the same workspace lock. Transfer drains already queued local saves, disables mutation and execution while waiting, and rechecks identity, configuration epoch and job reference when the lock is acquired. Matching creation IDs resume later edits unchanged. Replacement archives the latest saved choices first and retains job IDs. Invalid existing records, failed writes and unavailable locks remain incomplete. An unsaved incoming transfer can return to editing without discarding the durable intent.

The shared stylesheet's rail selectors now target only the shell navigation. A handwritten fixture proves that a nested pager retains its own row layout at 960 and 480 pixels while all five main destinations remain visible. The image step navigation also explicitly sets row direction, auto width and zero rail padding. Next sits immediately after Purpose fields; explanatory target controls remain in disclosures below it. The strict 960×640 fixture requires Name, Purpose and Next above the existing 608-pixel boundary. The shell footer displays host version and the bound update date, time and timezone, or an explicit unavailable value.

The combined creation, image and shell fixture run passed 63 checks. After the final delayed-adoption changes, all 20 focused journey checks passed in 24.8 seconds with 131 recorded input hashes unchanged. Existing image navigation and persistence assertions now wait for serialized saves or emitted events before checking their original destination, identity and retained-data claims. Renderer checks do not prove native pickers, access renewal, runtime execution, ISO production or boot. The integrating task must repeat the identical built 960×640 tuple and full supported matrix.

Integration fixture notes: guided operation headings now identify Image guide, and advanced configuration sections open through the Advanced project tools disclosure. Shared operation fixtures that expected an always-visible Accounts row must open that disclosure first; permission-review fixtures still enter the Source stage before requesting permission. No permission or workspace-ownership assertion should be removed during that adaptation.

## Delayed continuation and disclosure focus

Adoption captures its navigation generation, workspace ID and creation ID before awaiting rendering or durable intent persistence. After persistence it rechecks the same visible journey and project instance before continuing. The operations adapter receives the continuation predicate and checks it before changing destination and after each options/rendering wait. A completed save remains durable when superseded, but cannot reopen the image guide after the user chooses Help or Tools.

Advanced project actions validate their destination/section pair, close the disclosure, and move focus after rendering only if the navigation epoch, workspace, destination and section still match and the host remains visible. Accounts and Saved configurations have matching destination headings. Superseded actions leave focus with the newer interaction.

Six regressions reproduced these two defects before repair: two held-persistence navigation cases and four keyboard disclosure transitions. The final journey suite passed all 26 checks in 38.6 seconds. TypeScript retains the same 23 baseline diagnostic identities. This is renderer evidence; integrated built and native acceptance remain separate.

An invalid pre-project image name now has an explicit inline status explaining that it is unsaved and the last valid name is retained, including when returning to Images. The invalid value is not emitted for persistence. Two focused checks passed: the valid first-step layout retains the 960×640 boundary, and invalid input leaves stored bytes unchanged while Return/reload restores the last valid name.
