# Material Buildroot implementation plan

Status: planning. Application implementation belongs to the next development session.

## Confirmed owner decisions

1. The product is a Windows desktop application using the requested desktop web runtime.
2. Every product workflow uses genuine registered Material Design 3 controls.
3. Buildroot execution supports WSL and Docker Linux containers. These are build backends, not additional desktop delivery platforms.
4. All shared application features are required, including the converter, Ollama suite and Minecraft server manager.
5. The public repository is `Ding-Ding-Projects/material-buildroot`.
6. A GitHub Pages documentation companion is required, with its deployed URL in the repository About homepage.
7. Work stays on `main`. Publish recoverable planning checkpoints frequently.
8. This session prepares the plan and interviews the owner. The next development session implements it.
9. Serve both beginners and experienced builders through guided and advanced access to the same validated actions.
10. The central workflow is board selection, configuration, build and image export.
11. Ask for WSL or Docker when creating a project and remember the selection per project.
12. Manage existing sources, official releases, Git clones, branches and upgrades.
13. Initial image targets are VMware Workstation and VirtualBox guests.
14. Include full package, overlay and external-tree editors.
15. The next development session's requested delivery is the complete specified application and every shared feature. Internal milestones do not reduce that scope.

## Product architecture proposal

The desktop renderer presents productive workspaces: project setup, configuration, package development, build tasks, outputs, shared tools, documentation and settings. It does not use a marketing landing screen or a command catalogue as the application.

The renderer is sandboxed with context isolation. A typed IPC broker validates every action. The same action schemas and state consumers serve direct controls, guided workflows and command-palette actions. Native file pickers grant bounded path capabilities. Credentials remain in an operating-system vault; the renderer receives references and presence states.

A Linux bridge reads Buildroot's actual Kconfig environment. A pinned Kconfig library supplies menus, types, choices, dependencies, ranges and help. Buildroot's own `make olddefconfig` reconciles requested edits, and the interface displays requested versus effective values. A guessed text parser is not an acceptable replacement for authoritative Kconfig semantics.

WSL and Docker adapters share typed requests, persistent jobs and output inspection, but keep distinct path semantics and lifecycle handling. Fixed executable arguments and structured stdin requests replace shell interpolation. Configuration mutations are serialized per canonical output tree. Independent output trees may run concurrently.

Configuration writes are atomic and preceded by snapshots. Reconciliation failure restores the previous usable configuration. Cancellation verifies task ownership before stopping the complete process group or container. Existing projects, installations and settings are preserved.

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
| Virtual machines | VMware Workstation and VirtualBox guest-image workflows; guest content, formats, lifecycle, firmware and architecture choices await owner answers |

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

## Proposed milestones

- [ ] Resolve the planning questions and approve the next session's first milestone.
- [ ] Review the target-owned design handoff and exact component inventory.
- [ ] Establish the secure desktop shell, transactional storage, file capabilities and job services.
- [ ] Implement a complete source-to-image Buildroot workflow with WSL and Docker adapters.
- [ ] Complete development, recovery, output and advanced Buildroot workflows.
- [ ] Complete every shared feature family without silent deferral.
- [ ] Produce the packaged Windows application and unsigned Squirrel.Windows installer.
- [ ] Verify actual Windows installation, cancellation, updates and existing-installation preservation.
- [ ] Publish and verify the documentation website, wiki, downloads and About homepage.

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
