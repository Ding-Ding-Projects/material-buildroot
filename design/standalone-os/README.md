# Standalone OS creator design and implementation handoff

## Scope and placement

A dedicated guided creator in Images, alongside the existing Buildroot workflow. Target framework: Lit with registered Material Web controls. The workflow produces x86-64 BIOS boot media using a validated backend operation. It does not claim that structural inspection proves boot.

## State inventory

1. Source: image name, WSL distribution, registry reference or native-picked archive/Compose project. Native selections are opaque capabilities, never renderer-entered paths.
2. Experience: kiosk and LAN access by default, console alternative, local kiosk URL, persistent data disk versus temporary data. BIOS and x86-64 are fixed and explicit.
3. Optional settings: tunnel off by default, temporary quick tunnel or named domain enrollment after guest boot. Optional personal wording JSON is selected natively and validated completely by the service. A notice identifies resulting media as private. Unauthenticated network pages retain original wording.
4. Review: actual backend preview, exact source and configuration summary, explicit build consent. Editing invalidates preview and consent.
5. Build: actual state and bounded log, refresh, cancel request, output export and log export. Cancellation is pending until a terminal service result. Success identifies output and explains separate boot verification.

## Interaction and recovery

Back and Next remain keyboard reachable. Step headings receive focus on navigation. Native picks preserve prior selection when canceled. Changes persist only safe draft choices locally, never JSON bytes, credentials, preview authorization or successful outcomes. Opaque native capabilities must be selected again after reopening. A saved job identifier is restored as unverified and refreshed against the service before output actions. Late responses after workspace changes or disconnection are discarded. Only one request at a time; a live build prevents editing and duplicate builds.

## Visual reference

The existing Images panel is the typography and spacing reference. A single surface contains a small eyebrow, meaningful title, horizontal wrapping step labels and one column of controls, with paired fields only above 600px. Use theme tokens inherited from workspace styles, no fixed light colors. Buttons wrap and controls have a minimum 44px target. Long names, identifiers and logs wrap within their owning surface. No invented artwork or runtime screenshots.

## Reference and verification tuples

Normal 1280x900 and minimum 800x600 desktop client sizes; English, Cantonese and bilingual; light/dark; 100%, 125%, 150%, 200% scale. State identifiers: source-registry, source-archive, source-compose, experience-kiosk, experience-console, options-private-wording, review-ready, build-running, build-failed, build-succeeded, resumed-unverified. Browser fixtures verify wiring only. Built application screenshots, layout receipts and guest boot acceptance remain separate required evidence.

## Service contract

`appliance.choose`, `appliance.preview`, `appliance.build`, `appliance.state`, `appliance.cancel`, `appliance.export` use the existing `window.studio.operations` boundary. Preview and native picker responses originate in the main process. No shell commands or credentials are accepted by the renderer.

## Implementation and review record

An independent design review approved implementation with explicit Linux/x86-64 compatibility checks, preserved existing data disks, temporary-data loss disclosure, authenticated private-wording activation, and guest-only tunnel enrollment. The creator is reachable from Images without an adopted Buildroot project. Existing project ISO controls remain available separately.

The Build stage now includes `appliance.verify {id}` for real bounded guest boot verification. Pending verification polls `appliance.state`; only `verification.bootVerified` confirms boot. Network endpoint verification remains a distinct result. Interrupted jobs stay locked against a duplicate build and offer refresh/cancellation reconciliation.

Focused browser fixtures exercise native-picker capability wiring, preview consent, private-file omission from local drafts, job cancellation and resume, stale responses, and no-project Images entry. They do not establish native input, package compatibility, boot, LAN access, layout or installer proof.

## Source preparation extension

Add an optional, task-oriented source-preparation section in the Source stage, separate from the existing registry/archive/Compose controls. A native folder picker grants access to one source. The service identifies the tracked HEAD and origin and reports the supported adapter; unsupported upstream or Home Assistant adapters remain visibly unavailable until implemented. The user reviews that untracked files are excluded and explicitly consents to executing the fixed root `build.bat` in an isolated snapshot. No command field is offered.

States: source-unselected, source-selected, source-preview-ready, source-unsupported, preparation-running, preparation-interrupted, preparation-failed and prepared-archive-ready. The view reports real phases and sanitized logs, provides refresh and a cancellation action only when the service supports it, and never equates process launch with output readiness. A verified complete result provides a prepared-bundle capability to the existing image workflow. The bundle retains application images, database image and normalized Compose configuration. Intermediate results cannot transfer. Source-path data, authority and consent are not stored in renderer drafts; a saved preparation job resumes as unverified. Pending work locks conflicting source edits, and a delayed native response cannot be applied after disconnection.


## Root navigation correction and complete bundle boundary

The actual application Images action bar now exposes **Create standalone OS**, opening a dedicated working view with **Back to Images**. No adopted project is required. The original image-project creation and open controls remain available. The previous inner configuration-panel-only insertion was removed because it did not establish root navigation reachability. A browser fixture boots `material-buildroot`, clicks its real action and returns through the real Back control.

Prepared sources use `{kind: 'prepared', bundleId}` rather than an archive-only source. `completeWorkload: true` is structural bundle completeness, not runtime acceptance. The UI retains owner-setup, worker-opt-in and runtime-unverified limitations. A private file remains outside renderer draft persistence, and the bundle capability must be reacquired after reload. Wizard styling inherits the active shell theme variables without a fixed light palette; actual native light/dark layout evidence is still separate.

Home Assistant source review can request a matching frontend through a separate native directory capability. Both core and frontend revisions appear in the fresh preview; selecting the frontend alone explains that core must be selected first. Runtime setup displays only structured stage, process state, exit code, reason and package diagnostics, never raw command output.

## Validated failure and endpoint presentation

Build status renders only the host-validated diagnostic stage, fixed code, tool and exit code, with localized explanations. Invalid or unavailable diagnostic records explicitly leave the specific cause unverified. Raw output, arguments and paths are never rendered from that record.

A prepared-source transfer selects `endpoints.productiveUrl` as the kiosk URL only after validating a credential-free loopback HTTP(S) address with no query or fragment. `setupOrigin` remains separate and is never chosen as a fallback. Missing or invalid productive metadata leaves the source unselected. The complete prepared-bundle identity remains intact in the operation request.
