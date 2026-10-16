# Authenticated companion consumers

## Implemented source routes

The authenticated browser has ten explicit task workflows: source/projects, configuration/build, output/cloud transfer, local models, managed servers, managed guests, remote Buildroot jobs, product workflow publication, file conversion, and preferences/recovery. Switching workflows only changes visible controls and sends no host request. It has a separate project workspace, selected project, optional checksum comparison draft, file selection, result view and bounded request history. None of this state shares visitor storage. Sessions, file handles, host results and the last 50 request summaries remain in page memory. Reload requires pairing again and does not restore authority. The endpoint preference remains separate from authentication. A separate explicit Save/Restore/Clear local draft workflow persists only the named build target, parallelism, configuration domain and clone folder/ref draft, bounded to 1,024 characters. Restoration never submits a request and never restores session, project, file or source-selection capabilities.

The typed host adapter admits these exact actions, subject to the current session scope. Non-destructive build submission uses a named target selector and bounded parallel-job control, never a command string:

| Action | Scope | Consumer |
| --- | --- | --- |
| cloud.list | deployment:read | Enrolled destination labels and transfer state without credentials |
| cloud.retry | deployment:write | Native-confirmed readback retry for a session-owned retained cloud object |
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
| models.catalogue.page / models.catalogue.refresh | tools:read / tools:write | Paged observed official catalogue and native-approved durable refresh |
| models.pull / models.install | tools:write | Native-approved durable model download and managed runtime acquisition |
| models.managed.status / models.runtime.start / models.runtime.stop | tools:read / tools:write | Factual native runtime status and separately confirmed owned lifecycle |
| models.status | tools:read | Actual local model-service version |
| models.list | tools:read | Installed model names, sizes and digests |
| workspace.read | workspace:read | Workspace summary |
| projects.choose / projects.adopt | projects:write | Native folder selection and separate exact-source trust approval |
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
| packages.list / packages.files / packages.editors | packages:read | Paged package discovery, revision/file-hash metadata and installed native editors |
| packages.editor.open | packages:write | Native-confirmed visible editor handoff for a session-owned file record |
| product.inspect / product.runners / product.preview | forge:read | Exact repository/account inspection, admitted runner inventory and typed immutable workflow preview |
| product.selectRunner / product.publish / product.export | forge:write | Separate native billing/runner approval and exact generated-YAML publication/export approval |
| remote.list / remote.enroll / remote.reconnect | remote:read / remote:write | Sanitized target/job records and native descriptor/host-key enrollment |
| remote.transfer / remote.start | remote:write | Native-reviewed project transfer and named, source-bound remote build |
| remote.adopt | remote:write | New native authorization to recover an exact historical job after target reconnect |
| remote.observe / remote.cancel / remote.outputs / remote.download | remote:read / remote:write | Session-owned observation/cancel/output discovery and native-selected download |
| guests.discover / guests.list / guests.refresh | guests:read | Admitted hypervisors, managed records and observed state |
| guests.create / guests.disk.create | guests:write | Native-reviewed exact output-media guest creation and new virtual-disk creation |
| guests.launch / guests.stop | guests:write | Native-confirmed visible launch and graceful stop with expected revision |
| sdk.preview / sdk.export | outputs:read / outputs:write | Session-bound archive metadata preview and native-confirmed byte-preserving SDK export |
| outputs.manifest | outputs:write | Native-confirmed manifest of currently selected output handles |
| outputs.browse | outputs:read | Navigate an adopted project's output folders |
| outputs.inspect | outputs:read | File type, byte count and inspection summary |
| outputs.checksum | outputs:read | Compute SHA-256 and compare an optional expected digest |

The server validates the argument schema and scope before dispatch. The consumer rechecks authorization before each call and after awaited reads. Project actions revalidate the adopted root identity. Output identifiers are opaque handles scoped to one session and project; each session has its own output viewer. Browser callers cannot submit a host path, invoke a generic IPC operation, create a grant, select an executable or assert native consent.

## Independent companion preferences

The authenticated workspace keeps its own English/Cantonese/bilingual language, light/dark/system theme and 100/125/150/200 percent text-size preferences under a separate bounded browser key. They do not alter visitor settings or host authority. Static controls relabel immediately; existing host-result text retains its original rendering until explicitly refreshed. This source increment is not full localization, layout or accessibility proof.

## Existing managed servers

The companion lists sanitized ownership records, refreshes the existing manager state and requests native-confirmed stopping of a disclosed server. It does not infer ownership or readiness from persisted metadata. Native directory selection, typed configuration, actual version/flavour/plugin discovery and native-approved vanilla/Paper/Fabric/plugin installation now use the existing services and durable queue. Bedrock discovery explicitly reports missing checksum admission rather than pretending installation is available. Fabric retains its bootstrap-only and unpublished-digest limitations. All four process/container targets now use exact native confirmation and existing ownership checks; SSH retains existing strict known-host and authentication handling. A native-reviewed source distribution preview binds its hash and exact destination to the session before entering the durable transfer queue. Cancellation retains remote-state-unknown/partial-destination facts and never pretends rollback. The trusted start context supplies `authorizeExecution` outside request JSON for the native manager to retain across scheduled restart. Automatic revocation stop is armed only when the manager returns a per-launch `instanceId`; it supplies `expectedInstanceId` and retires on identity replacement. Without that receipt, no automatic stop claim is made. Target/runtime/distribution availability remains enforced by the existing adapters.

## Native file conversion

Conversion controls use the existing native input/new-output pickers. The browser receives only names and session-owned identifiers, never filesystem paths. The category/format selectors reflect the existing converter adapter availability; unavailable packaged adapters remain disabled. Run converts only the current session-selected read and write grants. Revocation requests abortion of the owned operation, while a lost reply remains unknown and never claims output rollback. Existing no-overwrite and output-signature checks remain in the converter. The companion now has its own durable host queue, serialized execution, bounded pages, result/checkpoint reads and sequence-bound cancellation. PDF controls cover inspection, merging, splitting, extraction, reordering, rotation and metadata removal, using the existing admitted PDF adapter. Missing payloads or isolation admission produce a real failed job rather than a simulated result. Historical records restore no native file authority; users explicitly reselect inputs and a new output before submitting replacement work.

## Local model workflow

Refresh installed models, select one, enter a prompt and explicitly send it through the approved tools scope. Prompts and replies remain ephemeral; neither the local draft nor request history records their content. Read successive bounded chunks and cancel only the chat admitted to the current session. Revocation requests cancellation through the host observer. Cancellation remains requested until the service reports its actual state. The companion also pages the observed official catalogue and uses native-confirmed durable jobs for catalogue refresh, admitted model pulls and managed runtime acquisition. Existing installations/models stay protected by the native service. Runtime start is cancellable while in flight; after a completed native-approved start, the runtime is retained and stopping requires another native approval. Revocation never claims that runtime shut down. Persistent conversation management remains incomplete.

## Cancellation and recovery

Cancellation is a request, not a completed outcome. It checks the job sequence, originating companion session and existing host ownership, then uses the established queue cancellation method. Refresh the job until the host reports its actual terminal state. A lost response is unknown, not success, and is never automatically retried. An unavailable session stops new calls. For builds started by a companion session, the host authority observer requests cancellation when the session expires or is revoked. Already accepted queue work retains the host's durable lifecycle and observed terminal state; disconnect does not claim cancellation completed.

Source/output reads that finish after revocation do not disclose their newly obtained result. Source working-tree paths, raw logs, snapshots, output content previews and credentials are excluded from these projections. The client renders text nodes and accepts only known fields for each view.

## Remaining companion implementation gaps

This increment does not complete PH09-T03 or all C identities. The following are still implementation gaps, not exemptions inferred from missing code:

- Destructive build submission and job retry remain incomplete companion workflows. Non-destructive named builds now recheck the live session at their final enqueue boundary, use the desktop-adopted runtime and source grant, and enter the existing durable scheduler.
- Configuration string/credential editing, complete semantic menus, defconfig save, presets, account provisioning and structured package/external-tree authoring still need dedicated capability-bound projections and controls. Package discovery, file-hash metadata and visible native editor handoff now have session-bound consumers; browser callers cannot provide an executable or filesystem path. Boolean, tristate, integer and hexadecimal rows now support bounded symbol filtering and 100-row pagination, semantic type/assignability metadata and revision-bound symbol help. Their edits plus undo and defconfig apply now use the existing trusted configuration transaction after a separate native approval. Each request names its observed revision; browser-supplied consent is not accepted.
- Custom source clone, source ref acquisition and historical rollback discovery need further native selection and revision-bound approval bridges. Official source cloning now uses a native destination picker, session-owned selection and a separate native trust approval. The browser supplies no trust or consent boolean. Source upgrade now retains its immutable preview in the session and requires native review of the actual patch before the existing revision-bound apply. Rollback previews and apply are also bound to rollback records created by this session, with the same native review and current-revision checks. Patches above 16,000 characters require the full native workflow instead of a truncated approval.
- Rich artifact content, multi-file manifest selection/comparisons, advanced guest topology/edit/import, physical media, raw remote logs remain excluded from the browser projection. Enrolled destination listing, exact selected-output preview and upload start are implemented. Start consumes a preview owned by the current session and invokes the existing native exact-file/destination confirmation. A host-only authority callback is checked after native approval, after snapshot creation and before transfer effects. During transfer, revocation requests owned cancellation and preserves partial/unknown outcomes; it never claims a rollback. A preview alone does not upload or grant publication authority. Readback retry is limited to this session/project's retained upload, requires the existing native confirmation and rechecks live authority before enqueue and each transfer effect. It verifies the retained object and does not silently upload or overwrite it again.
- Full version-specific descriptors and native SSH authentication enrollment, full persistent conversation management, assistant/recovery and general artifact/release forge publication still need dedicated authenticated consumers. Product workflow publication now has a typed native-approved consumer.
- Appearance, navigation, history, exports, accessibility, localization, locks and other applicable shared identities need their independent C records. The existing visitor implementation is not C evidence.
- Native credential enrollment, TLS selection, listener binding, executable selection and operating-system consent remain desktop-only authority operations; companion workflows must request their approved results rather than emulate consent.

## SDK and output provenance

Select a current output file to preview SDK metadata or create its manifest. SDK previews are scoped to the session/project and expire; export requires native approval of the exact hash, size and destination folder, then uses the existing byte-preserving export workflow. The result keeps consumer-build/runtime verification false. No archive extraction, toolchain execution or existing-output overwrite is implied. Manifest creation translates only session-owned handles inside the host.

## Package and external editor handoff

Package search uses the existing source/external-tree catalogue with 25-row pages. File metadata is bound to the imported package revision and exact file hash; raw package bytes are not returned. Native editors are discovered by the host. A separate native prompt discloses the exact file, editor and visible-launch consequence before the existing package discovery service revalidates and opens it. Structured authoring of all package fields remains incomplete.

## Managed guest workflow

Guest creation uses a selected session-owned output handle, bounded hardware controls, BIOS/EFI and NAT/none networking. Native confirmation shows the source hash, provider and hardware; the hash and grant are checked again before the existing manager copies owned media. New virtual disks use a reviewed output name, format and bounded capacity. Launch and graceful stop require separate native confirmation and current guest revision. Guest creation is not boot proof; launch is not login/networking proof, and a stop request is not completed shutdown. Completed native-approved guests remain managed by the desktop after session revocation rather than implying an automatic shutdown.

## General remote Buildroot consumers

Remote target descriptors and private host details are selected and confirmed on the native desktop, never entered as browser credentials. C receives sanitized names/kinds and opaque IDs. Project transfers and named build dispatch use the existing source snapshot/revalidation and reservation logic. A trusted callback passed outside request JSON is isolated per asynchronous request, rechecked after native waits and before every SSH call/effect, and cancels only its in-flight transport when revoked. An already accepted remote worker may still run; interruption remains unknown until native observation, never a rollback claim. C verifies remote terminal identity/source digest against its accepted transfer. Outputs are admitted by returned name/hash and downloaded to a native-selected directory with existing digest checks. Historical job recovery requires a new native approval of the exact target, job and source digest after native reconnect. The service rereads that record before granting this session control; persisted browser state never restores authority. Existing-project adoption likewise uses native workspace/source/output pickers and a separate native source-trust prompt. Raw logs and machine paths are not projected.

## Product workflow publication

The browser supplies only repository identifiers, an immutable source revision and the build/installer choice. Runner inventory comes from the native account. Billing/runner selection requires a native prompt and is rechecked by the existing setup service. The workflow is generated by the existing strict model, never accepted as browser-authored commands or expert YAML. Native publication/export approval shows the exact destination, base/source revisions, SHA-256 and complete bounded generated YAML. Host-only authority callbacks are rechecked after account/native waits and immediately before API/filesystem writes. Publication retains exact readback and does not dispatch a runner or establish a build/release. Private-source execution restrictions remain unchanged.

## Verification status

Source implementation only. Tests, static analysis, reviews, browser/runtime execution and screenshots were intentionally deferred in the current speed-focused task. No listener, paired request, host action, build or publication was run by this lane. Build and integration belong to the coordinating task. Source presence is not runtime acceptance, security proof or full identity closure.






























