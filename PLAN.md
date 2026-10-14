# Material Buildroot implementation plan

Status: planning plus initial documentation website implementation. Application and authenticated companion implementation belong to the next development session. The owner separately authorized creating the public documentation website now.

## Confirmed owner decisions

1. The product is a Windows desktop application using the requested desktop web runtime.
2. Every product workflow uses genuine registered Material Design 3 controls.
3. Buildroot execution supports WSL and Docker Linux containers. These are build backends, not additional desktop delivery platforms.
4. All shared application features are required, including the converter, Ollama suite and Minecraft server manager.
5. The public repository is `Ding-Ding-Projects/material-buildroot`.
6. A GitHub Pages documentation companion is required, with its deployed URL in the repository About homepage.
7. Work stays on `main`. Publish recoverable planning checkpoints frequently.
8. This session prepares the plan, interviews the owner and creates the initial documentation website. The next development session implements the application and complete shared surface coverage.
9. Serve both beginners and experienced builders through guided and advanced access to the same validated actions.
10. The central workflow is board selection, configuration, build and image export.
11. Ask for WSL or Docker when creating a project and remember the selection per project.
12. Manage existing sources, official releases, Git clones, branches and upgrades.
13. Initial image targets are VMware Workstation and VirtualBox guests.
14. Include full package, overlay and external-tree editors.
15. The next development session's requested delivery is the complete specified application and every shared feature. Internal milestones do not reduce that scope.
16. Guest presets cover minimal, desktop, server and appliance systems. First-class exports are bootable ISO, VMDK, VDI and OVA.
17. Rich controls create, import, configure and launch VMware Workstation and VirtualBox guests.
18. Verify x86_64 guests with both legacy BIOS and UEFI compatibility presets. Preserve broader architecture configuration access.
19. Offer a dedicated managed WSL distribution and support existing distributions.
20. Support current stable, maintained LTS and selected Git refs, with explicit verified compatibility boundaries.
21. Reconcile configuration immediately after every edit, with undo and history. Upgrade migration remains a separate snapshot/preview/explicit-Apply operation.
22. Cover every supported configuration system with full rich controls, including Linux kernel, BusyBox and U-Boot.
23. Default to Linux-side WSL storage or Docker volumes, with Windows browsing/export. Recommend maintained LTS when creating projects.
24. Explain configuration changes requiring a clean rebuild and obtain explicit confirmation for that operation.
25. Deliver Windows x64 first in one complete installer, accepting a large download. Fresh defaults are bilingual language and system theme.
26. Provide every feasible safe output preview, including genuine guest screenshots after actual boot tests.
27. Verify the newest stable Windows, VMware Workstation and VirtualBox versions observed during implementation. Exact versions and actual host access are currently unverified.
28. The application must be interactive. Collections of editable text fields are not an acceptable substitute for rich workflows.
29. Support multiple concurrent projects with per-project queues and global CPU/RAM/storage limits, plus a terminal scoped to the selected runtime/project.
30. Offer several genuinely supported desktop/compositor choices with previews, NAT by default, and bridged/host-only/advanced networking controls.
31. Include full configurable account and SSH provisioning with security explanations and protected credentials.
32. Treat reproducibility as a first-class workflow: source/config locks, hashes, manifests, SBOM/license output and repeat-build comparisons.
33. Include full local assistant workflows with checkpoints and reviewed actions. Model proposals never silently gain privileged execution authority.
34. The website includes a secure opt-in local companion connection, alongside complete documentation, downloads and independent shared-feature coverage.
35. Include canvas editors where appropriate, backed by actual validated configuration consumers.
36. Support explicitly paired Edge/Chrome clients and authenticated access from other devices on the LAN. Internet control exposure is not part of this decision.
37. Guest acceptance requires actual boot, login/console, networking, disk persistence and graceful guest shutdown. BIOS/UEFI support initially excludes Secure Boot.
38. Keep all sources/history/artifacts/caches until the user chooses cleanup; resource-budget notifications do not authorize automatic pruning.
39. Include SDK/toolchain export, image flashing, guest install wizards, remote Buildroot execution and cloud upload. Exact provider/target routes are being finalized in the decision log.

## Interactive control contract

| Task | Required interaction |
| --- | --- |
| Sources and versions | Selectable source tree, branch/ref browser, revision comparison, clone progress and upgrade preview |
| Board/guest selection | Filterable real profiles, previewable preset details, architecture/firmware/storage compatibility controls |
| Kconfig | Navigable menu tree, Boolean switches, tristate/choice pickers, ranged numeric controls, dependency graph and help inspector |
| Package development | Structured source/build/license editor, dependency graph, patch ordering, hash validation and previewable changes |
| Overlay development | File tree, drag/drop import, destination mapping, permissions controls and staged diff preview |
| VM hardware | CPU/RAM sliders with exact numeric entry, storage/controller editors, firmware/network choices and live compatibility feedback |
| Builds | Selectable targets, queue reorder/pause/cancel where supported, actual resource/progress states and actionable errors |
| Outputs | File/graph/image/archive/filesystem viewers, selectable export bundles, real conversion progress and checksum validation |
| Shared tools | Complete tool-specific editors and previews, durable queues, discoverable real actions and recovery states |
| Spatial/graph work | Interactive VM/network topology, disk/partition layouts, pipelines, package dependencies, image/logo editing and appearance timelines |

Use text/code editors for values that require them, preserve exact technical syntax, and provide clear validation. Each workflow must have a meaningful interaction test. A negative substitution test must fail when required rich controls are replaced by generic textbox forms.

Canvas controls support pan/zoom, selection, snapping where meaningful, an inspector, keyboard editing, accessible structured equivalents and undo/redo. A dependency viewer is labelled a viewer until actual package/configuration edits are validated and previewed. Generated pipelines may invoke only reviewed allowlisted operations. Spatial editing must preserve unknown source metadata and show exact output changes.

## Browser companion security proposal

GitHub Pages is static hosting; it does not itself run Buildroot or obtain arbitrary host privileges. The companion requires explicit pairing to a running desktop broker, bounded typed actions, scoped capability grants, revocation and a visible connection state. Browser transport, TLS trust, origin checks, CSRF/replay protection, browser private-network restrictions and any extension requirement need a separately reviewed implementation design. Never solve transport restrictions with permissive CORS, trust-all TLS, shared tokens or an unauthenticated localhost service.

The desktop remains the privileged consumer. Explicit paired authentication and scoped permissions also cover supported LAN devices. The website retains its own complete shared-feature inventory; a link or redirect to desktop features does not count as website delivery. Show truthful disconnected and offline states, and provide browser-native capability implementations where the feature can run locally without the broker.

## Product architecture proposal

The desktop renderer presents productive workspaces: project setup, configuration, package development, build tasks, outputs, shared tools, documentation and settings. It does not use a marketing landing screen or a command catalogue as the application.

The renderer is sandboxed with context isolation. A typed IPC broker validates every action. The same action schemas and state consumers serve direct controls, guided workflows and command-palette actions. Native file pickers grant bounded path capabilities. Credentials remain in an operating-system vault; the renderer receives references and presence states.

A Linux bridge reads Buildroot's actual Kconfig environment. A pinned Kconfig library supplies menus, types, choices, dependencies, ranges and help. Buildroot's own `make olddefconfig` reconciles requested edits, and the interface displays requested versus effective values. A guessed text parser is not an acceptable replacement for authoritative Kconfig semantics.

WSL and Docker adapters share typed requests, persistent jobs and output inspection, but keep distinct path semantics and lifecycle handling. Fixed executable arguments and structured stdin requests replace shell interpolation. Configuration mutations are serialized per canonical output tree. Independent output trees may run concurrently.

Configuration writes are atomic and preceded by snapshots. Immediate reconciliation is queued/debounced and serialized per output tree so rapid edits cannot race; visible pending state preserves user intent and undo order. Reconciliation failure restores the previous usable configuration. Cancellation verifies task ownership before stopping the complete process group or container. Existing projects, installations and settings are preserved.

## Buildroot workflow inventory

| Workspace | Required workflow |
| --- | --- |
| Projects | Create/open/clone a tree, manage source branches and upgrades, choose and remember a runtime, validate prerequisites, select output storage and external trees |
| Configuration | Browse every menu and symbol, search, edit typed values and choices, inspect dependencies/help, reconcile and compare changes |
| Presets | Browse real defconfigs, apply them safely, save a minimal defconfig and track provenance |
| Development | Full package and external-tree editors, overlays, patches, hooks and external-editor integration |
| Builds | Source acquisition, build, selected package actions, clean targets, progress, logs, cancellation and recoverable history |
| Outputs | Inspect/export images and metadata, checksums, graphs, license information and safe previews |
| Recovery | Restore configuration snapshots, revisit failed operations and retain partial results truthfully |
| Virtual machines | Minimal/desktop/server/appliance presets; ISO/VMDK/VDI/OVA export; create/import/configure/launch in VMware Workstation and VirtualBox; BIOS/UEFI x86_64 boot verification |

## Shared feature inventory

Every row requires its own implementation, packaged capability and runtime/GUI evidence. A catalogue entry or disabled button is not delivery.

| Feature family | Required coverage |
| --- | --- |
| Language and presentation | Persisted English, Cantonese and bilingual; independent humor controls; local vocabulary; shared School mode |
| Navigation | Workspace/settings/editor tabs, all four docks, grouping, pinning, reordering, overflow and discovery searches |
| Search and actions | Anchored regex builders for each search; rich command palette; bulk operations with shared consumers |
| Appearance and accessibility | Genuine registered components, per-element context menus/appearance, accessibility tools, ADHD modes and narration |
| Locks and support | Reversible per-element policies, support tickets, unlock flows and preserved state |
| Records | Local history, snapshots, exports, changelog, notifications and complete offline documentation |
| Converter | Eight searchable categories, durable disk-backed paged queue, offline packaged adapters, PDF operations and validated outputs |
| Ollama | Discovery, managed installation/recovery, model catalogue/tags, model management, streamed chat and safe harness recovery |
| Minecraft | Java/Bedrock discovery, version/flavour/plugin descriptors, rich configuration, lifecycle/logs/console/backup and all four execution targets |
| Security services | Vault references, bounded downloads, two-key-plus-slider destructive confirmation, authenticator and private-data exclusions |

## Ordered implementation phases

[ROADMAP.md](ROADMAP.md) is the authoritative task checklist. It contains PH00–PH10, stable task IDs, prerequisites, phase exit requirements and a primary-phase map for all 105 shared identities. This plan describes scope; it does not maintain a competing completion list.

Implementers take the lowest eligible unchecked task, split large work into stable child tasks, implement one reviewable unit, attach its required evidence and only then check it off. Keep blocked items unchecked and continue independent eligible work. Record current and next task IDs in the handoff after each verified checkpoint.

PH00 delivers the plan and initial documentation website now. Subsequent phases cover detailed contracts, secure foundations, the shared interface and records, real runtime/configuration/build workflows, VM/image/deployment adapters, built-in tools, complete visitor/companion parity and final native packaging/release acceptance. A phase is an ordering mechanism and never removes unfinished scope. The initial website does not complete full D/C coverage.

## Evidence and release acceptance

Local focused tests cover configuration semantics, injection rejection, path containment, atomic rollback, concurrent mutations and owned cancellation. Workflow jobs build/package/publish; tests and lint run locally rather than in the publication workflow.

Real built captures bind to the source commit and packaged artifact hash. The presentation matrix covers normal and minimum client areas, three language modes, two themes, and 100%, 125%, 150% and 200% scales. Record every screen/state and measurement tuple. Preview/browser evidence does not prove Windows input, installation or update behavior.

Windows deliverables use genuine unsigned Squirrel.Windows with `Setup.exe`, `RELEASES`, full packages and generated deltas where available. Fresh-host root build/fetch/installer entrypoints, bundled runtime discovery, update recovery and actual asset readback are required. Releases use unique immutable tags and are normal releases, with actual source and timing evidence.

The public documentation companion hosts complete articles and wiki content directly, with internal navigation, current genuine application captures and downloads. Verify its live routes/assets and the exact repository homepage readback separately from the source push.

## Planning questions

The owner interview resolves audience, first workflow, backend default, source management, initial hardware, in-app development depth, milestone scope, supported releases, storage, prerequisite ownership, editing/reconciliation behavior, output previews, retention, dependency/installer size, SSH targets, server flavours and release acceptance.

Unanswered choices remain proposed or pending. They do not silently become owner-approved requirements.

## Existing scaffold

A minimal local manifest and interface scaffold was created before the owner clarified planning-only scope. No backend or GUI implementation, dependency installation, build, runtime capture, installer or release has completed. The next session must review the scaffold rather than treating its package pins, API shape or unchecked roadmap as verified design.
