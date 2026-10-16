# Authenticated companion consumers

## Implemented source routes

The authenticated browser has a separate project workspace, selected project, optional checksum comparison draft, file selection, result view and bounded request history. None of this state shares visitor storage. Sessions, file handles, host results and the last 50 request summaries remain in page memory. Reload requires pairing again and does not restore authority. The endpoint preference remains separate from authentication. A separate explicit Save/Restore/Clear local draft workflow persists only the named build target, parallelism, configuration domain and clone folder/ref draft, bounded to 1,024 characters. Restoration never submits a request and never restores session, project, file or source-selection capabilities.

The typed host adapter admits these exact actions, subject to the current session scope. Non-destructive build submission uses a named target selector and bounded parallel-job control, never a command string:

| Action | Scope | Consumer |
| --- | --- | --- |
| cloud.list | deployment:read | Enrolled destination labels and transfer state without credentials |
| cloud.start | deployment:write | Start the session preview after native exact-file approval |
| cloud.preview | deployment:write | Hash and preview the session-selected output for an enrolled destination |
| models.chat.start | tools:write | Start an ephemeral response using a model disclosed to this session |
| models.chat.read | tools:write | Read the next bounded response chunk for a session-owned chat |
| models.chat.cancel | tools:write | Request cancellation of that session-owned chat |
| models.status | tools:read | Actual local model-service version |
| models.list | tools:read | Installed model names, sizes and digests |
| workspace.read | workspace:read | Workspace summary |
| projects.list | projects:read | Select a currently adopted project |
| project.options | projects:read | Runtime kind, revision and external-tree authorization summary |
| source.choose | source:write | Open the native destination picker and retain the selection only in this session |
| source.clone.official | source:write | Native-approved official source clone and project adoption |
| source.status | source:read | Actual source revision, branch, dirty state and snapshot count |
| config.inspect | configuration:read | Boolean/numeric configuration rows and observed revision |
| config.apply | configuration:write | One typed revision-bound change after desktop approval |
| config.undo | configuration:write | Revision-bound undo after desktop approval |
| defconfig.apply | configuration:write | Exact catalogue selection after desktop approval |
| defconfig.catalog | configuration:read | Trusted configuration catalogue with revision and hashes |
| build.targets | projects:read | Discovered named/package targets |
| builds.submit | builds:submit | Queue an approved non-destructive named target with bounded parallelism |
| jobs.list | jobs:read | Current host-owned job summaries |
| jobs.get | jobs:read | Refresh a job previously disclosed to this session |
| jobs.cancel | jobs:cancel | Request cancellation of a disclosed job at its observed sequence |
| outputs.browse | outputs:read | Navigate an adopted project's output folders |
| outputs.inspect | outputs:read | File type, byte count and inspection summary |
| outputs.checksum | outputs:read | Compute SHA-256 and compare an optional expected digest |

The server validates the argument schema and scope before dispatch. The consumer rechecks authorization before each call and after awaited reads. Project actions revalidate the adopted root identity. Output identifiers are opaque handles scoped to one session and project; each session has its own output viewer. Browser callers cannot submit a host path, invoke a generic IPC operation, create a grant, select an executable or assert native consent.

## Local model workflow

Refresh installed models, select one, enter a prompt and explicitly send it through the approved tools scope. Prompts and replies remain ephemeral; neither the local draft nor request history records their content. Read successive bounded chunks and cancel only the chat admitted to the current session. Revocation requests cancellation through the host observer. Cancellation remains requested until the service reports its actual state. This does not implement model acquisition or persistent conversation management.

## Cancellation and recovery

Cancellation is a request, not a completed outcome. It checks the job sequence and existing host ownership, then uses the established queue cancellation method. Refresh the job until the host reports its actual terminal state. A lost response is unknown, not success, and is never automatically retried. An unavailable session stops new calls. Already accepted queue work retains the host's durable lifecycle; disconnect does not claim it was cancelled.

Source/output reads that finish after revocation do not disclose their newly obtained result. Source working-tree paths, raw logs, snapshots, output content previews and credentials are excluded from these projections. The client renders text nodes and accepts only known fields for each view.

## Remaining companion implementation gaps

This increment does not complete PH09-T03 or all C identities. The following are still implementation gaps, not exemptions inferred from missing code:

- Destructive build submission and job retry remain incomplete companion workflows. Non-destructive named builds now recheck the live session at their final enqueue boundary, use the desktop-adopted runtime and source grant, and enter the existing durable scheduler.
- Configuration string/credential editing, complete semantic menus, defconfig save, presets, account provisioning and package/external-tree editors still need dedicated capability-bound projections and controls. Boolean, tristate, integer and hexadecimal rows now support bounded symbol filtering and pagination. Their edits plus undo and defconfig apply now use the existing trusted configuration transaction after a separate native approval. Each request names its observed revision; browser-supplied consent is not accepted.
- Custom source clone, existing-source adopt/ref acquisition/upgrade/rollback need further native selection and revision-bound approval bridges. Official source cloning now uses a native destination picker, session-owned selection and a separate native trust approval. The browser supplies no trust or consent boolean.
- Rich artifact content, manifests/comparisons, SDK export, conversion, guest lifecycle, physical media, remote execution and cloud upload retry need their own narrowly admitted consumers. Enrolled destination listing, exact selected-output preview and upload start are implemented. Start consumes a preview owned by the current session and invokes the existing native exact-file/destination confirmation. A host-only authority callback is checked after native approval, after snapshot creation and before transfer effects. During transfer, revocation requests owned cancellation and preserves partial/unknown outcomes; it never claims a rollback. A preview alone does not upload or grant publication authority.
- Converter, server manager, model pulls and full conversation management, assistant/recovery, external editor, transfer and forge publication need actual dedicated authenticated consumers.
- Appearance, navigation, history, exports, accessibility, localization, locks and other applicable shared identities need their independent C records. The existing visitor implementation is not C evidence.
- Native credential enrollment, TLS selection, listener binding, executable selection and operating-system consent remain desktop-only authority operations; companion workflows must request their approved results rather than emulate consent.

## Verification status

Source implementation only. Tests, static analysis, reviews, browser/runtime execution and screenshots were intentionally deferred in the current speed-focused task. No listener, paired request, host action, build or publication was run by this lane. Build and integration belong to the coordinating task. Source presence is not runtime acceptance, security proof or full identity closure.








