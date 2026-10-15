# Screen and state inventory

All screens are proposed and unimplemented. Every collection/search/menu/picker has its own anchored regex workbench and isolated query state. Settings, inspectors and editors use managed tabs. Every applicable view has selections, bulk actions, complete exports, contextual help, clear/browse controls, appearance and lock entrypoints.

| ID | Screen | Required state coverage |
| --- | --- | --- |
| S01 | Shell and project empty state | Empty/restored/corrupt state; open/create; active tasks; native window controls |
| S02 | Project library and wizard | New/adopt/clone; validation; runtime choice; source/output separation; Back/Cancel/recovery |
| S03 | Configuration tree/table | Real menus, typed values, choices, unavailable symbols, filters, immediate reconciliation |
| S04 | Symbol inspector | Help/default/effective value, dependency graph, ranges, side effects, unknown metadata |
| S05 | Config history and defconfig | Requested/effective diff, undo/restore, reconcile failure, save/import real presets |
| S06 | Build queues | Per-project/global limits, actual tasks, running/cancelling/partial/failed/interrupted/succeeded |
| S07 | Log/task panel | Follow/freeze/filter/export, truncation state, actual errors and contextual recovery |
| S08 | Outputs | File metadata/checksums, safe previews, conversion/export, stale/partial/missing outputs |
| S09 | Runtime setup | WSL/distro/Docker discovery; managed/existing distro; missing/license/elevation/restart states |
| S10 | Shared tool suite | Converter, Ollama, Minecraft, authenticator and all dedicated sub-inventories |
| S11 | Settings | Languages/humor/attention/voice/appearance/schedules/privacy/editor/update state |
| S12 | Local history | Filters/snapshots/diffs/restore-as-new-revision/retention/export/protected access |
| S13 | Offline documentation and changelog | Rendered articles/internal routes/search/date filters/build provenance |
| S14 | Notifications | Nonblocking toast and centre, persistent errors, retry, bulk/export and exact progress |
| S15 | Command palette | Ctrl+Shift+F, actual setting controls/actions, navigation/focus, disabled reasons |
| S16 | Tabs | Four edges, grouping/pin/reorder/overflow/four searches, unsaved protection and bulk close |
| S17 | Element context menus | Pointer/keyboard/touch, working shortcuts, appearance/locks, bounded search |
| S18 | Appearance editor/canvas | Complete typography/colors/layers/geometry/states/motion timelines, undo/reset/import/export |
| S19 | Destructive confirmation | Exact affected data, two independent keys, full slider, cancel/focus/operation failure |
| S20 | Locks/support/recovery | Independent policies, protected enrollments, tickets, attempts/timing/unlock ladder |
| S21 | Vocabulary/shared mode | No-file/valid/invalid/replace/clear, renamed/live/shared/unreadable mode, suppression/restore |
| S22 | Schedules | Timezone/DST/cross-midnight/precedence, external sources, stale/offline/base restoration |
| S23 | Logo/image canvas | Local upload/presets/crop/focal/background/derivatives/preview/rollback |
| S24 | Export/editor integration | Actual formats/loss disclosure/destinations/progress/partial results, editor discovery |
| S25 | Guided help/playgrounds | Meaningful steps, contextual entry, isolated examples/reset, actual shared consumers |
| S26 | Source and versions | Existing/clone/ref/change/dirty/conflict/offline, upgrade snapshot/preview/Apply/rollback |
| S27 | VM profiles | Four system presets, architectures/firmware/disks, image-format validation/compatibility |
| S28 | Package editor | Source/build/license/hash metadata, dependencies/patches, invalid/cyclic/unavailable states |
| S29 | Overlay editor | File tree/drag-drop/destination/permissions/diff, traversal rejection and binary previews |
| S30 | External trees | Ordered arrays, symbol/package collisions, validate/reorder/remove/restore |
| S31 | Kernel/BusyBox/U-Boot | Version-capable rich configuration, native semantics, dependencies and rebuild implications |
| S32 | Scoped terminal | Selected runtime/project, process/session lifecycle, exit/reconnect/error, exact scope indicator |
| S33 | Reproducibility | Locks/manifests/hashes/SBOM/license warnings/repeat-build comparison and provenance |
| S34 | VM lifecycle/hardware canvas | Discover/create/import/configure/launch, CPU/RAM/storage/network topology, actual boot captures |
| S35 | Local assistant | Model readiness/checkpoints/reviewed proposals/diffs/Apply, cancel/rollback and tool permissions |
| S36 | Browser companion | Opt-in pair/connected/disconnected/revoked, permission review and browser transport failures |
| S37 | Pipeline/partition canvases | Typed operations/disk constraints, accessible alternative, preview/validation/undo |
| S38 | Accessibility tools | Persistent/proxied entry, immediate preferences, explicit hide/Cancel focus, locked-state restore and secret-safe read-aloud |
| S39 | Authenticated status integration | Session registration, current status, scoped replies/questions and truthful disconnected/unsupported states |
| S40 | Cloud/remote/flash/install | Typed target selection, destination preview, credentials by reference, progress/cancel/partial/readback and destructive confirmation |
| S41 | Managed execution and delivery | Purpose/platform distinction, source/dedicated repository, hosted/self-hosted setup, reviewed YAML, saved/published/dispatched separation, observed jobs and verified output retrieval |

The bounded executable desktop reference covers selected states of S01-S04, S06-S07, S09, S11 and S41. See [the exact state inventory](reference/states.json) and [control map](reference/control-map.md). It is a synthetic design fixture, not production or runtime acceptance. All other screen and shared-feature requirements remain open.

## Search inventory

Name every concrete project/source/ref/profile/defconfig/symbol/help/dependency/changes/task/log/output/runtime/settings/tool/history/docs/changelog/notification/palette/tab/context-menu/picker/appearance/layer/lock/ticket/schedule/logo/export/editor/canvas/guided-example search instance. Each owns raw query, flags, validation, history and snippets. Shared invisible query state is invalid.
