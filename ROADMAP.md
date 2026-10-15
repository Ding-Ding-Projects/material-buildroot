# Phased implementation roadmap

Status: implementation underway after the initial planning/documentation checkpoint, beginning with contract and evidence admission. No application runtime or production A/D/C parity is verified. This roadmap orders the complete requested delivery; phases are checkpoints, not reduced scope.

## Execution and checkbox rules

1. Read the current owner-managed canonical contracts and [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), [surface boundaries](docs/planning/surfaces.md), [architecture](docs/planning/architecture.md), [feature inventory](docs/planning/feature-coverage.md) and [design acceptance](design/REVIEW.md). Current contracts control detail; this public index never narrows them.
2. Work only on `main`; preserve existing changes and publish frequent recoverable checkpoints after focused checks. Do not create task branches or worktrees.
3. Take the lowest eligible unchecked task ID. Complete one work unit, validate it, attach evidence, then tick it. Never skip a prerequisite. If blocked, leave it unchecked, record the exact blocker and dependency, and continue only the next independent eligible task.
4. Before a large task starts, expand it into stable child IDs such as `PH03-T02-01` using the same checkbox format. A child is one reviewable work unit. Preserve parent IDs permanently; the parent remains unchecked until all required children and exit proof pass.
5. A checked planning task proves its named planning artifact only. A checked implementation task requires actual code, required focused/negative tests, real built-artifact interaction/output, genuine source-bound screenshots where applicable, current localized documentation and durable evidence records. No tick for a stub, registry entry, disabled control, mock, source preview or sibling-surface implementation.
6. Keep separate applicable **A** Windows application, **D** public visitor, **C** authenticated companion and **R** repository/build/release records. Each names identity/task, consumer path, source revision and artifact hash, state/persistence, tests and actual commands/results, runtime route, captures, documentation and exact limitations. Platform exceptions require documented reasons and tested alternative behavior, not silent omissions.
7. Check off a phase only after its exit proof is met. If later evidence fails, reopen affected tasks and dependents. Missing host access, publication permissions or owner answers stays visibly incomplete.
8. On stop or resume, update [HANDOFF.md](HANDOFF.md) and [NEXT_SESSION.md](NEXT_SESSION.md) with current main revision, last verified task, first eligible task, evidence locations, pending owner answers and exact blockers. Never infer a passed check from an earlier session.

The initial documentation website in PH00 is authorized now. Its deployment does not complete `landing-site`, production D tools, companion C, the full language/layout matrix or native application evidence. P40–P42 are resolved in DECISIONS.md: all four cloud destinations, Linux SSH process/container and Windows SSH WSL/Docker, and USB/SD/physical-drive plus ISO/guest installation. Adapter implementation and runtime proof remain pending.


## Durable task evidence

Use `docs/evidence/tasks/PHxx-Tyy.md` for each task's durable record, with stable child sections or child files when expanded. These are required destinations to create during work, not claims that files already exist. PH00 planning/site records belong in `docs/evidence/planning-site.md`, to be created and populated with actual evidence.

Each record includes task/child ID; declared A/D/C/R scope; prerequisite verdicts; source revision and built artifact/hash; implementation and documentation paths; exact commands and pass/fail output; focused and negative-test receipts; actual runtime/host/browser route; state/persistence and recovery results; genuine capture paths; limitations/blockers; and final verdict. Link only real retained artifacts. Mark unavailable proof pending rather than inventing a path or receipt.

Scope labels below apply to each task. **A+D-native+R** means A, applicable browser-native visitor modules that can run independently, and their repository evidence. It does not include C, broker-backed D capabilities or future installer/release proof. PH09 owns remaining D and C implementation and verification. PH10 closes packaging/release-dependent records. An earlier phase can pass its declared scope while a full catalogue identity remains open.

## PH00 Planning and initial documentation website

Prerequisites: None. Historical PH00 scope was planning and the initial public documentation site; current implementation continues under PH01 and later phases.

- [x] **PH00-T01** [D-initial+R] Reconcile the recorded owner decisions, 105-identity inventory, architecture, surfaces and conditional design review into this ordered plan.
- [x] **PH00-T02** [D-initial+R] Create the documentation website source and render the authoritative planning documents, decision log and source wiki with stable internal routes.
- [x] **PH00-T03** [D-initial+R] Implement usable roadmap navigation and checklist rendering from these stable phase/task IDs; use genuine registered Material Design 3 controls throughout and keep source Markdown authoritative.
- [x] **PH00-T04** [D-initial+R] Verify the built website with real browser interaction, phone-friendly touch/keyboard layouts from approximately 320px, pure Material Design 3 control provenance, working document routes and genuine source-bound captures; retain actual check output.
- [ ] **PH00-T05** [D-initial+R] Deploy the initial GitHub Pages website, verify the live URL and routes, and read back the repository About homepage; record hosted evidence separately from local proof.
- [x] **PH00-T06** [D-initial+R] Update current handoff, public status and next-session prompt with verified planning/site evidence and explicit unimplemented application and D/C parity boundaries.

Exit proof: The recorded plan and initial website have reviewed source, focused checks, genuine browser captures and separate live publication/homepage readback; missing proof remains unchecked. Full production feature parity remains open.

Current pause: the owner requested preservation closeout on 2026-10-15. Completed source is retained on main; the encrypted-publication admission lane stopped before any source write. Unchecked work remains open.

## PH01 Detailed contracts, evidence admission and dependencies

Prerequisites: PH00-T01 and review of the current PH00 handoff/status records, including PH00-T06 when available. Pages deployment is not a prerequisite for independent contract preparation. Implementation is now authorized; begin with contract admission before dependent application work.

- [ ] **PH01-T01** [R (A/D/C admission only)] Reconcile all current canonical contracts against each of the 105 identities; preserve conditional and canonical-only dispositions with reasons.
- [ ] **PH01-T02** [R (A/D/C admission only)] Expand every applicable identity into independent A/D/C/R evidence records with stable child work IDs, implementation consumers, articles, copy, persistence, focused tests and exact runtime/capture requirements.
  - [x] **PH01-T01-C01** Reconcile the 105 catalogue identities and their recorded surface/disposition boundaries into a machine-readable admission ledger. [Evidence](docs/evidence/tasks/PH01-contracts.md).
  - [ ] **PH01-T01-C02** Finish full canonical-section reconciliation and independent review for every identity. The ledger now has 386 planned catalogue-derived subrequirements, not completed full-contract reconciliation.
  - [x] **PH01-T02-C01** Create independent stable A/D/C/R records, explicit pending implementation and separate proof slots for all 105 identities. [Evidence](docs/evidence/tasks/PH01-contracts.md).
  - [ ] **PH01-T02-C02** Admit concrete implementation consumers, localized articles/copy, persistence, detailed runtime/capture tuples and tests before each feature is implemented. All 420 records now have explicit planned identities and tuple axes, but reserved paths are not admitted consumers or runtime evidence.
  - [x] **PH01-T02-C03** Implement and locally verify the representative serialized-request parser, strict schema and typed request union. Nine focused tests and independent review pass; this child grants no authority and does not complete production IPC or any effectful action. [Evidence](docs/security/operation-requests.md).
- [ ] **PH01-T03** [R (A/D/C admission only)] Admit genuine registered Material Design 3 components and every native/browser/tool adapter: pin provenance, compatibility, licenses, redistributability, offline payloads and full installer size.
- [ ] **PH01-T04** [R (A/D/C admission only)] Create deterministic screen/state references, a direct reference renderer and hand-written parity/control maps; include reduced-motion, accessible structured canvas alternatives and negative textbox-substitution checks. Thirty reference states and local build tooling are authored. Two source-bound builds and focused runtime repairs are verified; full reference interaction, accessibility, typography and tuple acceptance remain pending.
- [ ] **PH01-T05** [R (A/D/C admission only)] Implement evidence validation that fails red then green when individual implementation, test, article, runtime, capture or parity records are absent or stale; bind proof to source and built artifact hashes.
  - [x] **PH01-T05-C01** Implement and verify local ledger integrity and synthetic red/green proof-binding checks. Full semantic/runtime admission remains pending. [Evidence](docs/evidence/tasks/PH01-contracts.md).
- [x] **PH01-T06** [R (A/D/C admission only)] Resolve owner decisions P40–P42 for cloud destinations, remote targets and flashing/install routes; record exact answers without guessed defaults. This blocks only their dependent adapters.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

### Managed execution children (scope retained through PH10)

- [ ] **PH05-T11** Implement managed user Buildroot builds through GitHub Actions after secure backend admission.
  - [ ] **PH05-T11-C01** Guided setup for source or dedicated execution repositories, scoped credentials and compatible hosted/self-hosted Linux runner discovery.
  - [ ] **PH05-T11-C02** Generate workflows and validate reviewed expert YAML through the same admitted action model.
  - [ ] **PH05-T11-C03** Queue, observe, cancel, reconnect and download verified outputs from standard public hosted Linux builds.
  - [ ] **PH05-T11-C04** Independently verify self-hosted Linux execution and explicit runner choice; never auto-select larger billed runners.
  - [ ] **PH05-T11-C05** Review and extract the generic encrypted-builder engine without private records or secrets; enable transport only after user-selected push and private-repository verification.
- [ ] **PH10-T09** Deliver the product through the separately reviewed GitHub Actions pipeline.
  - [ ] **PH10-T09-C01** Guided/generated and reviewed expert YAML for source or dedicated execution repositories, selecting compatible hosted/self-hosted Windows runners for product builds and packaging.
  - [ ] **PH10-T09-C02** Produce and verify Windows outputs by invoking exact root `build.bat` and `build-installer.bat` on compatible Windows runners; Linux coordination alone proves no native package.
  - [ ] **PH10-T09-C03** Publish a normal unique release and verify source, downloadable assets and readback independently from user-build jobs.

## PH02 Secure foundation and Windows bootstrap

Prerequisites: PH01-T01 through PH01-T05; adapter-specific owner answers before those adapters.

- [ ] **PH02-T01** [A+R] Replace scaffold assumptions with a reviewed versioned project model, ordered external-tree array, migrations, stable installed identity and isolated per-surface storage.
- [ ] **PH02-T02** [A+R] Create the sandboxed desktop shell with context isolation and narrowly validated versioned IPC operation envelopes; reject arbitrary renderer commands.
  - [x] **PH02-T02-C01** Implement and independently verify the data-only settings broker: scoped expiring capabilities, atomic settings/revision/idempotency/events, foreign-database preservation and strict typed reply translation. Twenty focused tests and the TypeScript contract check pass. Production IPC, native grants and abrupt recovery remain open. [Evidence](docs/security/broker-admission.md).
  - [x] **PH02-T02-C02** Implement and verify the bounded packaged desktop shell: sandboxed host/preload, durable three-mode language settings, real empty-project state and session-only appearance. Source `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd`; 26 host/preload/broker checks on the earlier `aa91c34` candidate with unchanged host/preload/session files, 48 current-source settings tuples, 52 validated layout receipts and actual language persistence across restarts. This child does not close full IPC, project execution, native per-scale DPI, installer or shared-feature acceptance. [Evidence](docs/evidence/desktop-shell/README.md).
  - [ ] **PH02-T02-C03** Improve and verify settings loading, save progress, conflict recovery, unknown-outcome protection and current navigation feedback. Renderer implementation and Linux Chromium fixtures are being verified; updated packaged Windows evidence remains required. Keep this separate from the earlier C02 native receipts.
- [ ] **PH02-T03** [A+R] Implement canonical file capabilities with picker/import grants, revalidation, path translation and symlink/reparse/case escape rejection.
- [ ] **PH02-T04** [A+R] Implement OS-vault references, reviewed typed host privilege boundaries, least-privilege operation ownership and secret-redacted records.
- [ ] **PH02-T05** [A+R] Implement pinned bundled-first dependency discovery/acquisition and root build.bat/build-installer.bat entrypoints with silent mode and nonzero failures.
- [ ] **PH02-T06** [A+R] Prove the real fresh-Windows one-command bootstrap/build/run route and interrupted dependency recovery without overwriting existing installations or data.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

## PH03 Shared interface and personalization

Prerequisites: PH02; admitted component and reference maps.

- [ ] **PH03-T01** [A+D-native+R] Implement the productive workspace shell, real window controls, tabs on all four edges, grouping/pinning/reordering/overflow and all discovery searches; use genuine registered Material Design 3 controls, with phone-friendly browser layouts and no generic control substitutes.
- [ ] **PH03-T02** [A+D-native+R] Implement complete English/Cantonese/bilingual copy, persisted fresh bilingual/system-theme defaults, independent humor levels, bounded local vocabulary import and display rename.
- [ ] **PH03-T03** [A+D-native+R] Implement shared School mode, narration/voice discovery, five ADHD modes, scheduled settings with timezone/DST precedence and required surprise/catalogue behavior.
- [ ] **PH03-T04** [A+D-native+R] Implement anchored regex workbenches at every search/picker, Ctrl+Shift+F rich command palette, actual context menus and working shortcut labels from shared action consumers.
- [ ] **PH03-T05** [A+D-native+R] Implement every-element appearance editor, continuous color tools, logo derivatives, accessible sizing, motion/reduced motion and bounded overlay/collapse behavior.
- [ ] **PH03-T06** [A+D-native+R] Implement guided forms, useful empty-editor presets, settings provenance/help and real rich controls/canvases with keyboard structured equivalents and undo.
- [ ] **PH03-T07** [A+D-native+R] Verify A and implemented browser-native D children independently with reload persistence, interaction, component provenance and source-bound captures. C and remaining D child records stay unchecked for PH09; this task does not close the full identity.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

## PH04 Safety, durable records and recovery

Prerequisites: PH02; PH03 controls as needed.

- [ ] **PH04-T01** [A+D-native+R] Implement exact-destination destructive confirmation with two independent keys, full slider, cancellation and focus return; retain explicit clean-rebuild consent.
- [ ] **PH04-T02** [A+D-native+R] Implement reversible per-element experience policies, protected enrollment, support-ticket records and preserved-budget timed unlock ladders; never use these as broker authentication.
- [ ] **PH04-T03** [A+D-native+R] Implement standards-tested local authenticators and real QR/manual pairing with protected secret handling.
- [ ] **PH04-T04** [A+D-native+R] Implement isolated append-only history, snapshots, restore-as-new-revision, complete scoped exports and protected-data exclusions.
- [ ] **PH04-T05** [A+D-native+R] Implement durable jobs, crash/re-entry recovery, progress at initiator, per-item bulk outcomes, cancel/retry and contextual recovery routes.
- [ ] **PH04-T06** [A+D-native+R] Implement factual changelog, safe upstream-markup rendering, complete offline documentation and accessible persistent notification/review centre.
- [ ] **PH04-T07** [A+D-native+R] Verify retention across failure/restart, cancellation ownership and no automatic cache/source/history pruning; prove free defaults and upstream cost/license disclosure.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

## PH05 Sources, runtimes and project execution

Prerequisites: PH02 and PH04 durable transactions.

- [ ] **PH05-T01** [A+R] Implement create/open/adopt/import/clone projects with source/ref/branch status, maintained-LTS recommendation, actual revision provenance and per-project WSL/Docker choice.
- [ ] **PH05-T02** [A+R] Implement existing and dedicated managed WSL distribution discovery/provisioning, prerequisite checks and Linux-side storage with Windows browse/export.
- [ ] **PH05-T03** [A+R] Implement Docker discovery, managed volumes, isolated non-root execution and truthful container lifecycle/permission recovery.
- [ ] **PH05-T04** [A+R] Implement source download/clone/ref acquisition and snapshot/diff/preview/explicit-Apply upgrades with rollback and compatibility boundaries.
- [ ] **PH05-T05** [A+R] Implement concurrent per-project queues with global CPU/RAM/storage limits, serialization per canonical output tree, safe process-group/container cancellation and scoped terminals.
- [ ] **PH05-T06** [A+R] Verify both runtime adapters on real Buildroot source acquisition and owned execution, including interrupted transfer, missing prerequisites and preserved existing trees.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

## PH06 Authoritative configuration, development and builds

Prerequisites: PH05; PH03 rich controls and PH04 revision history.

- [ ] **PH06-T01** [A+R] Bridge authoritative Buildroot Kconfig semantics through a pinned admitted library and actual make olddefconfig; expose full menus/types/choices/ranges/dependencies/help.
- [ ] **PH06-T02** [A+R] Implement typed configuration controls and immediate queued reconciliation with requested/effective diff, atomic snapshots, undo ordering and failure restoration.
- [ ] **PH06-T03** [A+R] Implement full Linux kernel, BusyBox and U-Boot configuration domains with the same real semantics and revision-bound behavior.
- [ ] **PH06-T04** [A+R] Implement real defconfig browsing/apply/minimal-save provenance, ordered external trees and separate output directories.
- [ ] **PH06-T05** [A+R] Implement complete package source/build/hash/license/dependency editors, ordered patch/hook workflows, overlays with mappings/permissions and discovered external-editor handoff.
- [ ] **PH06-T06** [A+R] Implement named build/package/clean targets, truthful streaming logs/history/progress and explicit invalidation/rebuild explanations.
- [ ] **PH06-T07** [A+R] Verify real source-to-image builds in WSL and Docker, rapid-edit race/rollback behavior and interaction tests rejecting generic textbox substitutions.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

## PH07 Images, virtual machines, reproducibility and deployment adapters

Prerequisites: PH06; P40–P42 answers required for their respective adapters.

- [ ] **PH07-T01** [A+R] Implement minimal/desktop/server/appliance presets and genuinely supported desktop/compositor previews with account/SSH provisioning and protected credentials.
- [ ] **PH07-T02** [A+R] Implement safe artifact viewers, checksums/graphs/licenses, filesystem/archive/image inspection, disk/partition canvas and validated ISO/VMDK/VDI/OVA conversion/export.
- [ ] **PH07-T03** [A+R] Implement VMware Workstation and VirtualBox discovery/create/import/hardware/storage/network/firmware edit/launch/stop with topology controls, NAT default and advanced network options.
- [ ] **PH07-T04** [A+R] Prove real x86_64 BIOS and UEFI guest boot, login/console, networking, disk persistence and graceful shutdown on both observed current-stable hypervisors; record actual versions and no Secure Boot claim.
- [ ] **PH07-T05** [A+R] Implement source/config locks, manifests, hashes, SBOM/license outputs and repeat-build comparisons with explicit nonreproducible differences.
- [ ] **PH07-T06** [A+R] Implement real SDK/toolchain export with consumer smoke-build verification and environment instructions.
- [ ] **PH07-T07** [A+R] After P42, implement exact destination-validated flashing and guest installer routes with reviewed destructive actions, cancellation and recovery proof.
- [ ] **PH07-T08** [A+R] After P41, implement authenticated remote runtime enrollment, transfer/jobs/cancel/recovery/output verification for the approved target types.
- [ ] **PH07-T09** [A+R] After P40, implement approved cloud providers/destinations with scoped vault credentials, previewed upload, checksums, cancel/retry and actual provider readback.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

## PH08 Complete built-in tools and publication handoffs

Prerequisites: PH03–PH05; required admitted adapter payloads.

- [ ] **PH08-T01** [A+D-native+R] Implement all eight converter categories and PDF operations with packaged offline adapters, searchable rich controls and unlimited disk-backed paged queues; validate genuine outputs.
- [ ] **PH08-T02** [A+D-native+R] Implement Java/Bedrock version/flavour/plugin discovery and rich Minecraft server creation/configuration/lifecycle across local process, local container, SSH process and SSH container.
- [ ] **PH08-T03** [A+D-native+R] Implement Ollama discovery and one-click managed install/recovery, full catalogue/tags/hardware fit, durable model pulls and streamed chat preserving existing models.
- [ ] **PH08-T04** [A+D-native+R] Implement local assistant plans/checkpoints/reviewed actions and harness recovery with no silent privilege escalation; verify failure and cancellation phases.
- [ ] **PH08-T05** [A+D-native+R] Implement actual external-editor handoff and browser transfer start/progress/completion surfaces with real queue consumers, recovery and supported focus/visibility behavior.
- [ ] **PH08-T06** [A+D-native+R] Implement previewed authenticated forge publication with exact destination/source, scoped credentials and actual readback.
- [ ] **PH08-T07** [A+D-native+R] Verify every A tool and each implemented browser-native D tool using separate runtime/output/persistence/capture proof, including offline missing-payload and partial-result behavior. C and remaining D records stay unchecked for PH09; full identity closure waits for all applicable records.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

## PH09 Complete visitor and authenticated companion surfaces

Prerequisites: PH03–PH08 shared consumers; PH02 secure broker and PH04 pairing.

- [ ] **PH09-T01** [A+D+C+R (through-PH09 scope)] Complete D browser-native implementations for every applicable identity, with local visitor state, reset/export explanations and truthful unavailable/offline behavior.
- [ ] **PH09-T02** [A+D+C+R (through-PH09 scope)] Implement reviewed explicit Edge/Chrome pairing and authenticated LAN capability grants/revocation with origin, TLS, CSRF/replay and browser private-network handling; no internet control exposure.
- [ ] **PH09-T03** [A+D+C+R (through-PH09 scope)] Complete C typed broker consumers and independent client state for every applicable identity; revocation stops new authority and settles owned jobs truthfully.
- [ ] **PH09-T04** [A+D+C+R (through-PH09 scope)] Complete detailed categorized feature articles and Cantonese twins, rendered source wiki, search/offline navigation and actual API Postman category/master collections; distinguish non-HTTP IPC.
- [ ] **PH09-T05** [A+D+C+R (through-PH09 scope)] Complete vendored licensed/hashed fonts, safe shared-link metadata, genuine screenshot/gallery/recording presentation and current source-bound front provenance.
- [ ] **PH09-T06** [A+D+C+R (through-PH09 scope)] Implement authenticated status integration and truthful unavailable states; verify authorized status bridge, protected webhooks and display-event delivery with separate R evidence.
- [ ] **PH09-T07** [A+D+C+R (through-PH09 scope)] Run independent A/D/C identity and state/persistence audits for capabilities implemented through PH09, plus normal/minimum × three languages × two themes × four scales, pure registered Material Design 3 controls and phone-friendly touch/keyboard checks from approximately 320px. Keep PH10 installer/update/download-dependent records unchecked until PH10 final acceptance.
- [ ] **PH09-T08** [A+D+C+R (through-PH09 scope)] Prove exact-boundary completeness and design-reference guards red then green by removing one required record at a time; all missing runtime, hosted, permission or platform evidence remains open. PH10-dependent records are explicitly pending, not waived or treated as passed.

Exit proof: Every required task and expanded child is checked with current linked evidence under the execution rules; all surface records within this phase's declared task scope, failure/recovery paths and relevant documentation pass. Future C, remaining D and PH10-dependent records stay unchecked and do not create a backward prerequisite. Blocked proof within the declared scope prevents this phase from being called complete.

## PH10 Packaging, release and complete native acceptance

- [x] Publish the bounded version 0.1.0 desktop milestone as a normal release with all five assets verified by size and SHA-256, exact source `0881a3a3f58c85bf73f57035b3a09da3acbbe1a8`. [Release and installer](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0). Bounded installed launch and full-package identity were verified. Full PH10 installer, updater, automatic-workflow and product acceptance remain open.

Prerequisites: PH01–PH09 scoped exit proofs and a complete explicit ledger of remaining PH10 packaging/release-dependent records. No earlier phase may require those future records to pass.

- [ ] **PH10-T01** [A+D+C+R (final applicable acceptance)] Assemble one complete Windows x64 installer with all required capability payloads, original installed icons, valid license disclosures and actual offline bundled-first discovery.
- [ ] **PH10-T02** [A+D+C+R (final applicable acceptance)] Produce real unsigned Squirrel.Windows Setup.exe, RELEASES, full packages and deltas; apply only required project-owned signing without claiming public trust.
- [ ] **PH10-T03** [A+D+C+R (final applicable acceptance)] Verify actual current physical Windows host installation/launch, preservation, cancellation, update/rollback and unsaved-state handling; record fresh-environment and uninstall proof separately when actually available.
- [ ] **PH10-T04** [A+D+C+R (final applicable acceptance)] Implement background update discovery/download with an unsigned-ready banner and explicit restart; exercise real version transitions and recovery.
- [ ] **PH10-T05** [A+D+C+R (final applicable acceptance)] Implement CI bootstrap inventories, compatible accessible runner selection/cloud fallback and defensive evidence collection; use encrypted public builder transport only if private source is introduced.
- [ ] **PH10-T06** [A+D+C+R (final applicable acceptance)] Publish uniquely tagged normal releases with verified installer assets, workflow timing and line counts, factual catalogue-linked naming and resolved permitted release-photo policy; read back draft=false/prerelease=false.
- [ ] **PH10-T07** [A+D+C+R (final applicable acceptance)] Verify live downloads against expected source/version/checksums and complete homepage/wiki/articles/screenshots/gallery links; synchronize repository records, supported discussions/project item and sanitized guidance.
- [ ] **PH10-T08** [A+D+C+R (final applicable acceptance)] Publish the verified operating procedure, grounded human-effort estimate and source-bound final handoff/issue/next-session prompt; reconcile every applicable child and all 105 dispositions before declaring complete.

Exit proof: Every required task, child and applicable A/D/C/R record passes with current linked evidence. All product, installer, update, guest, complete website/companion and release acceptance is verified. Any missing applicable proof prevents full completion; explicit canonical-only or genuinely inapplicable dispositions retain their documented reasons.

## Primary-phase map for all 105 catalogue identities

Each identity has exactly one primary acceptance phase below. Cross-phase dependencies still apply. The primary phase owns detailed child expansion and initial A/browser-native D acceptance; PH01 admits the complete records first. Full identity closure additionally requires every applicable surface record: remaining D and C in PH09, and packaging/release-dependent records in PH10. Earlier phase acceptance never asserts those future records passed. This table is routing, not evidence or a feature checkbox. Full requirements and surfaces remain in the [105-identity inventory](docs/planning/feature-coverage.md).

| Category | Count | Primary phase | Explicit catalogue IDs |
| --- | ---: | --- | --- |
| Language, voice and personalization | 10 | PH03 | `language`, `funny-emoji`, `personal-vocabulary`, `school-mode`, `narration`, `scheduled-settings`, `display-name`, `adhd-modes`, `dim-sum`, `dim-sum-photo-source` |
| Material, appearance and layout | 10 | PH03 | `material-design`, `workflow-navigation`, `motion`, `appearance-editor`, `color-picker`, `logo-customization`, `overlay-panels`, `collapse-filters`, `accessibility-sizing`, `functional-ui` |
| Navigation, search and commands | 9 | PH03 | `tabs`, `regex-search`, `command-palette`, `context-menus`, `menu-shortcuts`, `rich-controls`, `guided-forms`, `settings-explanations`, `blank-editors` |
| Safety, locks and authentication | 7 | PH04 | `super-confirmation`, `element-locks`, `support-tickets`, `unlock-ladder`, `authenticator`, `qr-pairing`, `honest-monetization` |
| Records, history and messages | 7 | PH04 | `local-history`, `exports`, `bulk-actions`, `changelog`, `offline-docs`, `rendered-provider-text`, `notifications` |
| Built-in tools and handoff | 7 | PH08 | `file-converter`, `minecraft-server-manager`, `ollama-suite`, `external-editor`, `download-handoff`, `forge-publishing`, `progress-recovery` |
| Completeness and evidence | 8 | PH09 | `completeness-parity`, `front-provenance`, `product-evidence`, `screen-recording`, `design-reference-parity`, `design-folder`, `layout-matrix`, `public-screenshot-gallery` |
| Website and shared links | 8 | PH09 | `landing-site`, `mobile-site`, `installer-download-button`, `feature-articles`, `vendored-fonts`, `shared-link-embed`, `homepage-link`, `vocabulary-unlock-boundary` |
| Status integration | 4 | PH09 | `status-hub`, `discord-status-bridge`, `panic-webhooks`, `tidbyt-displays` |
| Build and install: bootstrap | 3 | PH02 | `build-entrypoints`, `fresh-build-run-command`, `dependency-fetcher` |
| Build and install: packaged acceptance | 5 | PH10 | `bundled-dependencies`, `squirrel-installer`, `self-signing`, `auto-updates`, `app-icon` |
| Release process | 8 | PH10 | `release-workflow`, `release-timing`, `release-line-counts`, `release-dim-sum-photo`, `dim-sum-code-names`, `ci-bootstrap`, `runner-selection`, `encrypted-public-builder` |
| Repository records | 14 | PH10 | `tabbed-readme`, `human-time-estimate`, `sanitized-instruction-copy`, `agents-md-vocabulary-block`, `vocabulary-hash-lock`, `roadmap-checklist`, `feature-docs`, `postman-collections`, `wiki-site-sync`, `handoff-record`, `closeout-prompt`, `discussion-records`, `project-board`, `operational-skill` |
| Catalogue entries with narrower subjects | 5 | PH01 | `readme-prompt-banner`, `single-file-instruction-editions`, `project-profile`, `roblox-model-catalogue`, `roblox-visual-realism` |

**Total: 105 unique catalogue identities.** Canonical-only, owner-memory and currently inapplicable Roblox identities retain explicit disposition records in PH01; they do not authorize private instruction publication or unrelated product implementation. Conditional encrypted-builder scope remains conditional. Repository records begin with PH01 admission and setup; PH10 owns their final closure and they remain current throughout delivery.

## Current checkpoint

The public landing page now emphasizes the published early desktop shell, immutable download, historical genuine capture and explicit feature boundaries. Documentation search and mobile keyboard navigation were improved. This bounded website refresh does not close PH09 or the full shared-feature inventory; see the current [handoff](HANDOFF.md#website-landing-refresh-2026-10-15) for verification boundaries.

The requested first downloadable desktop milestone is published as version 0.1.0. This bounded publication does not close complete installer, update or full-product acceptance. The additional focused packaged pass on `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd` passed six keyboard/accessibility combinations, reload/replay and stale-revision recovery, and two preserved invalid/foreign storage cases; native display-scale and elapsed-time expiry evidence remain separate and open.

The bounded PH02-T02-C02 desktop-shell child is verified against the source and capture record linked above; its broad parent remains unchecked. The earlier data-only broker child retains its separate evidence. All wider phase and per-surface acceptance requirements remain open unless their own checkbox and evidence explicitly say otherwise.

The initial documentation deployment remains historical in [its hosting evidence](docs/evidence/hosting/initial-live.json). The current desktop articles and captures were delivered at `ae1951d18a29ea3ba5aab726cee20e896ad89cc2`, built from `53a37011c04e46536c882bc79dae751ff56f9757`: all 103 live files matched expected and published-source bytes, and deployment [38679631020](https://github.com/Ding-Ding-Projects/material-buildroot/actions/runs/38679631020) succeeded. This bounded delivery does not close broad phase or per-surface requirements.

The owner directed continuation while skipping blocker tasks. Five guest profiles remain retained, and strict browser audit acceptance remains 0 accepted / 20 rejected at `cleanup.completed`. Cleanup and that strict acceptance are skipped, not passed; no deletion retry or profile write is part of this continuation. Unsupported native per-scale DPI proof and the broader product backlog remain open. The current closeout objective is the bounded desktop GUI milestone, not implementation of that backlog.
