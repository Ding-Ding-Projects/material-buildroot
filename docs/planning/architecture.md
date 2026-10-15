# Architecture and implementation handoff

Status: proposed execution architecture with a locally verified serialized-request parser. No IPC handlers or runtimes are implemented. The [parser article](../security/operation-requests.md) names its exact admitted dependencies and evidence; this document does not claim runtime conformance.

## Shared operation envelope

Every privileged action uses a versioned typed request with `operationId`, project identity, expected project/source/config revision, explicit capability handles, action-specific arguments and cancellation ownership. Replies identify the resulting revision and actual applied changes. Events identify operation/task, monotonic sequence, actual state, timestamp and bounded progress/log data.

Paths stored in project metadata are display/configuration data, not filesystem authority. A picker/import or explicitly paired caller obtains a bounded capability; the broker resolves canonical paths and verifies the capability again immediately before access. Reject symlink/reparse escapes, alias/case collisions, invalid path translations and incompatible permissions. Remote capabilities belong to an explicit host identity and cannot become local authority.

## Action families and consumers

| Family | Typed operations and real consumer |
| --- | --- |
| `projects.*` | Create/adopt/import/export, runtime/storage choice, validate descriptors, snapshots and transaction state |
| `sources.*` | Discover/download/clone, refs/status/diff, revision checkout, upgrade preview/apply/rollback |
| `config.*` | Discover configuration domains, tree/help/values, revision-bound reconcile, requested/effective diff, undo/redo/restore and defconfig |
| `development.*` | Package source/hash/license/build-system editors, ordered patches, overlay mappings/permissions and ordered external-tree transactions |
| `builds.*` | Preflight, named target, durable queue/resource scheduling, cancellation/retry and actual output invalidation |
| `artifacts.*` | Safe bounded previews, hashes, graph/license generation, real format conversion, bundle/export and SDK/toolchain export |
| `hypervisors.*` | Detect VMware/VirtualBox, create/import/read/update/launch/stop guest operations, hardware/network/firmware compatibility and ownership |
| `images.*` | Profile provenance, partition/canvas validation, ISO/disk/OVF/OVA production, explicit destination flashing and install-wizard recipes |
| `remote.*` | Verified host enrollment, scoped credentials, platform/runtime discovery, source transfer, jobs/cancel/recovery and verified outputs |
| `publishing.*` | Cloud/forge destination discovery, destination preview, scoped vault credentials, transfer/cancel/checksum/readback |
| `reproducibility.*` | Source/config/dependency locks, manifests/hashes/SBOM/licenses, controlled repeat builds and comparisons |
| `terminal.*` | Explicit interactive terminal capability scoped to selected runtime/project, session/process lifecycle and visible authority |
| `assistant.*` | Local model/tool capability selection, checkpoint, reviewed proposal/diff, explicit action application and rollback |
| `universal.*` | Complete converter, Ollama, Minecraft and authenticator domains using shared services |
| `companion.*` | Pairing, real authentication, scoped grants, LAN exposure, revocation and truthful client state |
| `application.*` | State/history/docs/notifications/settings/schedules/appearance/locks/accessibility/update/window control services |

These families supersede the initial minimal `buildroot.*` scaffold as a planning model. Final schemas require exact validation and integration review, not an unrestricted string dispatcher.

## Immediate configuration reconciliation

Each edit captures the base revision and requested value. Queue/debounce work per output tree, preserve user intent and mark pending state. Reconciliation returns requested/effective values, dependency-induced changes, warnings and an effective revision. Reject stale replies and stale mutation bases. Undo during pending work creates a new ordered intent; it cannot restore an obsolete asynchronous response.

Watch external `.config` changes and distinguish app-owned writes from external edits. Show a conflict/diff and require a safe reconciliation decision without overwriting unknown state. Atomic writes and pre-change snapshots preserve the prior usable configuration on failure. Ordinary edits reconcile immediately; migration/upgrade and clean rebuilds retain their explicit review/confirmation policies.

Admit Buildroot/kernel/BusyBox/U-Boot versions by actual semantics and generated environment. A library import or matching file format is not compatibility proof. Unsupported symbols/conditions/ranges and unknown custom extensions stay visible and preserved.

## Source, output and queue ownership

Bind every build to an immutable source revision/snapshot and configuration revision, or hold a source-level exclusion lock preventing branch/upgrade edits for its duration. Output locks alone are insufficient when sources are shared.

Model tracked modifications, untracked files, submodule state, patches and external trees explicitly. A snapshot records its actual scope and omissions. Never silently discard dirty state or switch refs while affected builds consume mutable files. Upgrade preview determines output invalidation and preserves rollback; cancellation leaves recoverable transactions and truthful partial results.

Global scheduling accounts for per-project queues and CPU/RAM/storage limits. Distinguish package parallelism from experimental top-level parallelism. Resource estimates remain estimates; admission uses actual observed availability and reports unknown measurements. No automatic cleanup occurs: retain sources, history, artifacts and caches until the user explicitly selects cleanup.

## Execution trust and isolation

Selecting custom Buildroot sources intentionally executes source-provided build logic. Fixed launcher arguments prevent command injection in the broker; they do not sandbox a Makefile. Explain that distinction when adopting/downloading sources and bind consent to the selected source/runtime.

Use normal-user WSL execution and dedicated non-root Docker builds with bounded resources, explicit mounts, task-owned identities, no host Docker socket and no inherited host credentials. Decide networking per fetch/build operation. Never let a raw project path or model suggestion confer arbitrary host execution authority.

The expert terminal is an explicitly opened interactive user capability with a visible project/runtime scope, separate from typed automatic actions. It does not weaken action validation or permit hidden model execution.

## Hypervisor and image architecture

Windows-host adapters use the installed supported VMware/VirtualBox management tools with fixed argument schemas. Discover exact executable identity, version, licensing/prerequisites and capabilities. Preserve imported VMs separately from app-created VMs. Track VM ID, configuration revision, storage ownership, referenced shared disks and task processes. Removal always previews the exact owned resources; imported/shared disks cannot be inferred disposable.

Validate CPU/RAM/storage controllers/disks/network adapters/firmware before applying. Distinguish absent tools, incompatible versions, permission failures, unavailable acceleration, host resource constraints and actual guest states. User-selected remote or guest lifecycle actions never imply permission to restart or shut down the Windows host.

| Dimension | Required planning values and acceptance |
| --- | --- |
| Host | Windows x64 first; exact latest-stable Windows/hypervisor versions observed during implementation |
| Guest architecture | x86_64 initially; preserve broader Buildroot architecture controls without claiming hypervisor support |
| Hypervisor | VMware Workstation and VirtualBox, each with independently proven adapters |
| Firmware | BIOS and UEFI; Secure Boot is excluded from the first guest-support claim |
| System profile | Minimal, desktop, server and appliance; exact package/configuration/source provenance |
| Media | Bootable ISO installation/live media; VMDK/VDI actual disks; OVA containing validated OVF/disks/manifests |
| Hardware/network | Editable controller/device topology; NAT default, bridged and host-only plus advanced compatible choices |
| Boot acceptance | Actual boot, login/console, networking, disk persistence and graceful guest shutdown |

Maintain a capability matrix across hypervisor × firmware × profile × output format. Formats have different consumers: an ISO is not a disk, and OVA is an appliance container. Verify partition tables, filesystems, bootloader/ESP where relevant, disk metadata, OVF hardware references and manifests. Conversion is real content conversion, never extension renaming.

Guest account/SSH presets are fully configurable with explicit security explanations, protected credentials and previewed resulting configuration. Do not embed a shared undisclosed password in templates. Supported desktops/compositors are actual admitted packages/configurations with real previews.

## Desktop/browser security and LAN access

Edge and Chrome are the initial companion browsers. Explicitly pair a browser/device with the running desktop. Real authentication, scoped grants, revocation and visible connection/permission history apply to both local and authenticated LAN access. Element experience locks never substitute for companion authentication.

The default listener, exposure controls, TLS/certificate trust, allowed origins, replay/CSRF protection, browser private-network permissions and extension/native-host requirements need reviewed transport selection. Exact paired-device identity and host allowlists bound LAN access. Do not add internet exposure under the LAN requirement.

GitHub Pages remains static hosting. It cannot directly execute Buildroot, and a link/redirect to the desktop is not independent website feature delivery. Browser-local adapters and the typed opt-in broker each require concrete capability/proof records. Disconnected/offline states remain truthful.

## Everywhere-reachable accessibility and locks

Add a persistent accessibility entry and local proxies in dialogs, full-screen views, narrow layouts and locked states. Include text size, contrast, reduced motion, focus, larger targets, keyboard help, reset and user-initiated read-aloud with start/pause/resume/stop and actual voice/rate capability states. Never read concealed/restricted/secret content.

Hiding the entry is a separate action with explicit confirmation and initial focus on Cancel. Show the restore route before confirmation; cancellation preserves visibility and preferences. Settings/search/palette restoration remains reachable in locked states, and reset restores visibility.

Every element's independent experience-lock wizard supports exactly PIN, password, PIN+password, password+TOTP, PIN+TOTP, and password+PIN+TOTP. Track separate ordered credentials/durations/attempts per lock. PIN keypad/manual entry share validation/budgets, with keyboard parity, secret-safe names, Backspace/Clear/Cancel/Submit and optional randomized order. Locked actions are intercepted across pointer/keyboard/touch/palette/drag/programmatic paths while the element remains an accessible unlock target. Clearly disclose the experience-lock boundary and actual reset route.

## Shared tool dependency admission

Converter completeness requires a reviewed pinned redistribution-compatible adapter set, not only JavaScript built-ins. Cover PDF/image/audio/video/archive/office and remaining canonical categories with offline packaged proof. The durable paged queue has bounded working memory without a total-file cap.

Ollama requires actual managed installation/recovery, complete paginated catalogue/tags, hardware-fit evidence, batch pulls/storage/chat and allowlisted checkpoint/rollback harnesses. Minecraft support needs official-source/version-bound descriptors and independently tested local/SSH process/container targets. Retained research catalogues do not prove all-version runtime support.

Measure the complete installer and its dependencies against real Squirrel/package/release-transport constraints. The owner accepts a large single installer; do not silently replace it with missing capability packs or omit offline engines. Resolve licensing and supported large-file transport before claiming delivery.

## Representative versioned action requests

The [version 1 request schema](operation-request.schema.json) is a planned admission boundary, not implemented IPC. It illustrates settings language, project creation, build preview/submission and owned cancellation. It rejects unknown envelope/argument keys, unknown action/version, unbounded names, invalid revision/digest shapes and incompatible action arguments. A future parser must enforce a 64 KiB UTF-8 envelope maximum, depth 8, duplicate-key rejection before JSON object construction, finite integers and JSON Schema validation with no coercion. Capability strings are opaque broker references, never supplied credentials, paths or shell commands. Local/remote capability ownership and realpath checks still occur immediately before effects.

Durable idempotency keys are `(authenticated principal, projectId, operationId)`. Persist the normalized validated request digest and actual result before acknowledging durable acceptance. An identical retry returns its recorded state/result without repeating effects; a reused ID with changed content returns an explicit conflict. Persist operation acceptance and terminal output transactionally, reconcile interrupted effects through target-owned discovery, and retain the idempotency record as long as effects can be retried. An expired record cannot justify silently re-executing a destructive operation.

Compare `expectedRevision` and capability validity before mutation and before applying asynchronous results. Stale requests produce a conflict and fresh preview, preserving user input and existing data. An approved build preview binds source/configuration, target and effects through `previewId`/`previewSha256`; a changed destination or source invalidates it. Cancellation includes job ownership and expected sequence, never a caller-provided PID or command.

Every consumer admission includes stale, disconnected, interrupted and partial runtime states in addition to its initial/success/invalid/unavailable/cancelled/recovery/reload/reset baseline. Disconnection never means stopped or cancelled. Re-entry discovers durable actual state before enabling retries; interrupted jobs expose ownership, last observed sequence and recoverable outputs. Partial results enumerate successful, skipped, failed and uncertain items with exact hashes and next safe actions. Never report rollback unless the adapter verified it. Completion events use monotonic operation-scoped sequence numbers, reject obsolete deliveries and preserve a truthful unknown state when the target cannot be observed.

Next implementation must admit action-specific authorization, validation, transactional persistence, red/green negative request tests and actual consumer integration. The representative schema alone does not fulfill these controls or close PH01-T01-C02/PH01-T02-C02.
