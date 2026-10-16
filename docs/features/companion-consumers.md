# Authenticated companion consumers

## Implemented source routes

The authenticated browser has seven explicit task workflows: source/projects, configuration/build, output/cloud transfer, local models, managed servers, file conversion, and preferences/recovery. Switching workflows only changes visible controls and sends no host request. It has a separate project workspace, selected project, optional checksum comparison draft, file selection, result view and bounded request history. None of this state shares visitor storage. Sessions, file handles, host results and the last 50 request summaries remain in page memory. Reload requires pairing again and does not restore authority. The endpoint preference remains separate from authentication. A separate explicit Save/Restore/Clear local draft workflow persists only the named build target, parallelism, configuration domain and clone folder/ref draft, bounded to 1,024 characters. Restoration never submits a request and never restores session, project, file or source-selection capabilities.

The typed host adapter admits these exact actions, subject to the current session scope. Non-destructive build submission uses a named target selector and bounded parallel-job control, never a command string:

| Action | Scope | Consumer |
| --- | --- | --- |
| cloud.list | deployment:read | Enrolled destination labels and transfer state without credentials |
| cloud.cancel | deployment:write | Request cancellation only for an upload started by this session/project |
| cloud.start | deployment:write | Start the session preview after native exact-file approval |
| cloud.preview | deployment:write | Hash and preview the session-selected output for an enrolled destination |
| models.chat.start | tools:write | Start an ephemeral response using a model disclosed to this session |
| models.chat.read | tools:write | Read the next bounded response chunk for a session-owned chat |
| models.chat.cancel | tools:write | Request cancellation of that session-owned chat |
| conversion.queue | tools:write | Enqueue a session-owned durable conversion with current native grants |
| pdf.queue | tools:write | Enqueue inspect/merge/split/extract/reorder/rotate/metadata-removal with selected native inputs |
| tools.queue.page | tools:read | Page the current session queue in groups of 50 |
| tools.queue.history | tools:read | Read bounded historical summaries without restoring authority |
| tools.queue.get | tools:read | Read a current-session operation result and checkpoint |
| tools.queue.cancel | tools:write | Request cancellation using the observed sequence |
| conversion.choose | tools:write | Native input or new-output picker, scoped to this session |
| conversion.catalog | tools:read | Actual eight-category adapter availability |
| conversion.run | tools:write | Convert the session-selected files through a named category/format |
| servers.versions / servers.flavours / servers.plugins | servers:read | Actual edition/version/flavour/plugin discovery with explicit availability |
| servers.paper.builds / servers.fabric.options | servers:read | Discover exact stable installation choices |
| servers.choose | servers:write | Native directory selection with native server execution consent |
| servers.configuration.read / servers.configuration.save | servers:read / servers:write | Typed properties and separately native-approved, stopped-server configuration |
| servers.install / servers.paper.install / servers.fabric.install / servers.plugin.install | servers:write | Native-confirmed durable installation jobs for admitted catalogue choices |
| servers.start | servers:write | Native-confirmed owned local/SSH process/container lifecycle |
| servers.remote.preview / servers.remote.execute / servers.remote.status | servers:write / servers:read | Native-reviewed exact SSH destination, hash-bound durable transfer and truthful progress |
| servers.list | servers:read | Saved managed-server ownership summaries without host paths |
| servers.status | servers:read | Current managed state for a server disclosed to this session |
| servers.stop | servers:write | Existing manager stop after separate native confirmation |
| models.status | tools:read | Actual local model-service version |
| models.list | tools:read | Installed model names, sizes and digests |
| workspace.read | workspace:read | Workspace summary |
| projects.list | projects:read | Select a currently adopted project |
| project.options | projects:read | Runtime kind, revision and external-tree authorization summary |
| source.rollback.preview | source:write | Preview a rollback created by a source change in this session |
| source.rollback.apply | source:write | Apply that rollback after native patch review |
| source.upgrade.preview | source:write | Preview an immutable source revision and retain its record in this session |
| source.upgrade.apply | source:write | Apply the exact preview after native patch review, preserving the existing rollback snapshot |
| source.choose | source:write | Open the native destination picker and retain the selection only in this session |
| source.clone.official | source:write | Native-approved official source clone and project adoption |
| source.status | source:read | Actual source revision, branch, dirty state and snapshot count |
| config.details | configuration:read | Revision-bound help, dependencies, ranges and assignable states for one symbol |
| config.inspect | configuration:read | Boolean/numeric configuration rows and observed revision |
| config.apply | configuration:write | One typed revision-bound change after desktop approval |
| config.undo | configuration:write | Revision-bound undo after desktop approval |
| defconfig.apply | configuration:write | Exact catalogue selection after desktop approval |
| defconfig.catalog | configuration:read | Trusted configuration catalogue with revision and hashes |
| build.targets | projects:read | Discovered named/package targets |
| builds.submit | builds:submit | Queue an approved non-destructive named target with bounded parallelism |
| jobs.owned | jobs:read | Builds started by this paired session, with cancellation controls |
| jobs.list | jobs:read | Current host-owned job summaries |
| jobs.get | jobs:read | Refresh a job previously disclosed to this session |
| jobs.cancel | jobs:cancel | Request cancellation of a build started by this session at its observed sequence |
| outputs.browse | outputs:read | Navigate an adopted project's output folders |
| outputs.inspect | outputs:read | File type, byte count and inspection summary |
| outputs.checksum | outputs:read | Compute SHA-256 and compare an optional expected digest |

The server validates the argument schema and scope before dispatch. The consumer rechecks authorization before each call and after awaited reads. Project actions revalidate the adopted root identity. Output identifiers are opaque handles scoped to one session and project; each session has its own output viewer. Browser callers cannot submit a host path, invoke a generic IPC operation, create a grant, select an executable or assert native consent.

## Independent companion preferences

The authenticated workspace keeps its own English/Cantonese/bilingual language, light/dark/system theme and 100/125/150/200 percent text-size preferences under a separate bounded browser key. They do not alter visitor settings or host authority. Static controls relabel immediately; existing host-result text retains its original rendering until explicitly refreshed. This source increment is not full localization, layout or accessibility proof.

## Existing managed servers

The companion lists sanitized ownership records, refreshes the existing manager state and requests native-confirmed stopping of a disclosed server. It does not infer ownership or readiness from persisted metadata. Native directory selection, typed configuration, actual version/flavour/plugin discovery and native-approved vanilla/Paper/Fabric/plugin installation now use the existing services and durable queue. Bedrock discovery explicitly reports missing checksum admission rather than pretending installation is available. Fabric retains its bootstrap-only and unpublished-digest limitations. All four process/container targets now use exact native confirmation and existing ownership checks; SSH retains existing strict known-host and authentication handling. A native-reviewed source distribution preview binds its hash and exact destination to the session before entering the durable transfer queue. Cancellation retains remote-state-unknown/partial-destination facts and never pretends rollback. Revocation requests stopping only the started server. Target/runtime/distribution availability remains enforced by the existing adapters.

## Native file conversion

Conversion controls use the existing native input/new-output pickers. The browser receives only names and session-owned identifiers, never filesystem paths. The category/format selectors reflect the existing converter adapter availability; unavailable packaged adapters remain disabled. Run converts only the current session-selected read and write grants. Revocation requests abortion of the owned operation, while a lost reply remains unknown and never claims output rollback. Existing no-overwrite and output-signature checks remain in the converter. The companion now has its own durable host queue, serialized execution, bounded pages, result/checkpoint reads and sequence-bound cancellation. PDF controls cover inspection, merging, splitting, extraction, reordering, rotation and metadata removal, using the existing admitted PDF adapter. Missing payloads or isolation admission produce a real failed job rather than a simulated result. Historical records restore no native file authority; users explicitly reselect inputs and a new output before submitting replacement work.

## Local model workflow

Refresh installed models, select one, enter a prompt and explicitly send it through the approved tools scope. Prompts and replies remain ephemeral; neither the local draft nor request history records their content. Read successive bounded chunks and cancel only the chat admitted to the current session. Revocation requests cancellation through the host observer. Cancellation remains requested until the service reports its actual state. This does not implement model acquisition or persistent conversation management.

## Cancellation and recovery

Cancellation is a request, not a completed outcome. It checks the job sequence, originating companion session and existing host ownership, then uses the established queue cancellation method. Refresh the job until the host reports its actual terminal state. A lost response is unknown, not success, and is never automatically retried. An unavailable session stops new calls. For builds started by a companion session, the host authority observer requests cancellation when the session expires or is revoked. Already accepted queue work retains the host's durable lifecycle and observed terminal state; disconnect does not claim cancellation completed.

Source/output reads that finish after revocation do not disclose their newly obtained result. Source working-tree paths, raw logs, snapshots, output content previews and credentials are excluded from these projections. The client renders text nodes and accepts only known fields for each view.

## Remaining companion implementation gaps

This increment does not complete PH09-T03 or all C identities. The following are still implementation gaps, not exemptions inferred from missing code:

- Destructive build submission and job retry remain incomplete companion workflows. Non-destructive named builds now recheck the live session at their final enqueue boundary, use the desktop-adopted runtime and source grant, and enter the existing durable scheduler.
- Configuration string/credential editing, complete semantic menus, defconfig save, presets, account provisioning and package/external-tree editors still need dedicated capability-bound projections and controls. Boolean, tristate, integer and hexadecimal rows now support bounded symbol filtering and 100-row pagination, semantic type/assignability metadata and revision-bound symbol help. Their edits plus undo and defconfig apply now use the existing trusted configuration transaction after a separate native approval. Each request names its observed revision; browser-supplied consent is not accepted.
- Custom source clone, existing-source adopt/ref acquisition and historical rollback discovery need further native selection and revision-bound approval bridges. Official source cloning now uses a native destination picker, session-owned selection and a separate native trust approval. The browser supplies no trust or consent boolean. Source upgrade now retains its immutable preview in the session and requires native review of the actual patch before the existing revision-bound apply. Rollback previews and apply are also bound to rollback records created by this session, with the same native review and current-revision checks. Patches above 16,000 characters require the full native workflow instead of a truncated approval.
- Rich artifact content, manifests/comparisons, SDK export, conversion, guest lifecycle, physical media, remote execution and cloud upload retry need their own narrowly admitted consumers. Enrolled destination listing, exact selected-output preview and upload start are implemented. Start consumes a preview owned by the current session and invokes the existing native exact-file/destination confirmation. A host-only authority callback is checked after native approval, after snapshot creation and before transfer effects. During transfer, revocation requests owned cancellation and preserves partial/unknown outcomes; it never claims a rollback. A preview alone does not upload or grant publication authority.
- Full version-specific descriptors and native SSH authentication enrollment, model pulls and full conversation management, assistant/recovery, external editor, transfer and forge publication need actual dedicated authenticated consumers.
- Appearance, navigation, history, exports, accessibility, localization, locks and other applicable shared identities need their independent C records. The existing visitor implementation is not C evidence.
- Native credential enrollment, TLS selection, listener binding, executable selection and operating-system consent remain desktop-only authority operations; companion workflows must request their approved results rather than emulate consent.

## Verification status

Source implementation only. Tests, static analysis, reviews, browser/runtime execution and screenshots were intentionally deferred in the current speed-focused task. No listener, paired request, host action, build or publication was run by this lane. Build and integration belong to the coordinating task. Source presence is not runtime acceptance, security proof or full identity closure.





















