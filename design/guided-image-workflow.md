# Guided image creation

Design baseline: `457b51ae4ead511a9be30857e93c289c0e9f3aad`. This record specifies the renderer workflow, not evidence of an image build or boot.

## Five-stage shared draft

Easy is the default. Advanced reveals the same stages and values together, never replaces the draft or applies a preset implicitly.

1. **Purpose and target** (`purpose`): prefilled editable image name, retain current contents or a supported package purpose, BIOS x86-64 target with a clear UEFI limitation. The name is bounded draft metadata and a suggested export basename only. The producer remains `images/rootfs.iso9660`.
2. **Source and runtime** (`source`): show the saved runtime returned by `project.options`; route setup to the owning operations panel through `guided-workflow-navigate` with `{workspaceId, destination: 'source' | 'runtime'}`. The parent validates the current panel/workspace and owns setup. Keep `review-iso-permission` unchanged. All host state is rechecked, never restored from browser storage. Source-provided PC presets remain capability-backed and require explicit replacement approval.
3. **Contents** (`contents`): retain existing configuration by default. Live catalog IDs support additive minimal, desktop, server, appliance choices and display stacks. Missing capabilities stay unavailable. Preview and explicit consent precede applying additions. Values outside the supported catalog display Custom/unavailable and stay unchanged. A preset change invalidates prior ISO readiness.
4. **Review** (`review`): show name, purpose, target, runtime readiness, requested additions and current ISO requirements. Explicit consent and Configure BIOS ISO remain separate from Build. No automatic permission, preset application or effective-result restoration.
5. **Build and result** (`result`): existing typed ISO build, refresh, cancel and inspection actions; fixed producer path, two-job request, no arbitrary command execution. Recorded job status, structural inspection and boot evidence stay distinct. Unknown, interrupted, missing and unverified outcomes never become success. Display the safe export basename and open the owner's existing export workflow through `guided-workflow-navigate` with `{workspaceId, destination: 'artifacts'}`. No basename is sent in that event.

## Persistence and invalidation

Version 2 storage is bounded to 2 KiB and allowlisted: stage, mode, safe image name, purpose/preset/display IDs, target ID, SSH choice, optional source board ID, and job ID. Never save runtime objects, local paths, source content, approval checkboxes, permission grants, configuration revisions, logs, preview payloads or effective results. Version 1 stage 0 maps to source, stage 1/2 to build/result; retain a valid job ID as unverified. Revalidate catalogs and runtime after restoration. Workspace changes reset the in-memory draft before restoring that workspace. Configuration-generation changes invalidate previews/approvals/readiness without discarding draft choices or job identity.

## Interaction and accessibility

Use registered Material Web selects, text field, checkbox, buttons and progress. Every select option has a checked-in icon. Name has a localized clear action and inline validation; clearing never submits or changes the producer path. Back/Next preserve state, save progress explicitly, and focus the new stage heading. Stage labels and guide-position progress do not imply build progress. Existing explanatory examples remain isolated from production. English, Cantonese and bilingual copy follow the existing localization path. Wrapping, keyboard access, reduced motion and minimum-width behavior retain the workspace styles.

## Verification inventory

- Source-level and browser-fixture checks: five-stage progression, shared Easy/Advanced values, valid/invalid/bounded persistence, old-version migration, per-workspace isolation, capability-backed options, explicit consent, setup-event scope, metadata-only naming, stale replies, cancellation and truthful unavailable production.
- Existing ISO typed request contracts and permission epoch checks remain intact.
- Intended built layout tuples: normal 1440×960 and documented minimum, English/Cantonese/bilingual, light/dark, 100/125/150/200 percent scale. Native execution, image creation, boot and built layout capture are owned by the integrating task and remain unverified in this renderer lane.
- Independent `gpt-6-astra` read-only review approved the direction with eight conditions: exact navigation contract, separate draft invalidation, epoch-scoped package replies, live catalog availability, bounded names, strict restoration, truthful job status and stage-specific focus. These conditions guide the implementation. Project-scoped job APIs are required for all restored IDs.

Draft conflicts are detected with storage events and comparison against the last-read serialized value before every save. A conflict blocks mutation and offers explicit Load saved draft or Keep this draft. Both invalidate live readiness and consent. Names use 1 to 64 ASCII letters, digits, dots, hyphens or underscores, start with an alphanumeric character, reject reserved device names and trailing dots, and never enter a producer request. No ISO success is restored from storage.

## Focused implementation evidence

The combined renderer fixture run passed 27 tests in 33.1 seconds. After the final recovery-navigation and storage-clear handling changes, all 14 guided-image fixture tests passed in 16.9 seconds. Existing profile/runtime guidance and ISO workflow tests retain their safety assertions with stage-aware navigation and project-scoped job fixtures. A separate source review accepted the corrected lifecycle behavior. The whole-project TypeScript check still reports diagnostics in unrelated renderer files; none named the image workflow files. These are source-preview fixtures, not native execution, image production, boot or packaged-layout evidence.

## Missing saved jobs and primary actions

A successful complete `jobs.project` response with a well-formed array that omits the saved ID enables an explicit **Detach unavailable saved job** action. The host implementation returns the full owner-filtered job inventory and then filters by workspace, without pagination. Network, authorization and malformed responses never authorize detachment; each refresh clears earlier absence evidence. Detachment removes only the local reference, invalidates runtime/configuration readiness and consent, preserves draft choices, and focuses the Source heading. It never cancels a process, changes a host job record, deletes output or claims that cleanup is safe. Review the runtime and Builds workspace for running or quarantined work before proceeding. Unresolved IDs retain setup and output navigation through the existing event allowlist.

Easy uses one registered Material filled button for its current primary action; secondary actions stay outlined, and Advanced stays outlined. The recovery/action follow-up passed 25 guided-image and ISO workflow fixtures in 32.1 seconds. The final focused detachment test additionally passed with retained draft-choice and heading-focus assertions. Native execution and packaged-layout evidence remain separate.
