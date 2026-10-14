# Application screen and state inventory

Every row is planned and unimplemented. Each state needs its own source-bound normal-size capture and relevant interactive proof. All collections have scoped search, an adjacent anchored full regex builder, selection, applicable bulk actions and complete exports. Every settings/property surface is tabbed and searchable. Every editable text field has a dedicated clear action; every path field also has native browse.

| ID | Surface and primary contents | Required states and actions |
| --- | --- | --- |
| S01 | Restored shell and project empty state | No project; restored project; corrupt persistence; missing build provenance; open/create; last active task |
| S02 | Project library and creation/adoption wizard | Discovered, empty, invalid source, missing output, path conflict, read-only, backend disconnected; native browsing; defconfig choice; review/apply/back/cancel |
| S03 | Configuration workspace | Tree plus typed table and inspector; loading, populated, no match, unavailable symbols, dependent changes, dirty, applying, applied, rejected, external conflict |
| S04 | Symbol inspector | Help, current/default provenance, dependencies, choices, changed-by relationships; boolean/tristate/string/integer/hex/choice controls; unknown metadata; guided edit and isolated example |
| S05 | Configuration review | Pending changes, before/after, dependency side effects, select/deselect, apply failure, retry, discard with confirmation; save minimal defconfig |
| S06 | Builds workspace | Task queue/table, selected task details, exact target; queued, preflight, running, cancelling, cancelled, failed, succeeded, interrupted, disconnected; retry and contextual recovery |
| S07 | Resizable log panel | Live/frozen/follow-tail, filtered/no match, bounded retention, truncated indicator, stream failure; copy/export selected or filtered logs; navigation to originating task |
| S08 | Artifacts workspace | Real files, package graph, build graph, legal information; not generated, loading, ready, stale, unsupported preview, partial export, export failure |
| S09 | Runtime drawer | WSL distributions and Docker engines/images; unavailable, found, insufficient permissions, unhealthy, preparing, cancellation, restart-required; guided setup and revalidate |
| S10 | Tools workspace | Local models, file conversion, server manager, authenticator and regex workbench as separate task tabs; complete dedicated sub-inventories required |
| S11 | Settings workspace | Language/voice, attention, appearance, navigation, schedules, privacy/vocabulary, editors, updates; current/default provenance; saved/invalid/unavailable source |
| S12 | Local history | Password-protected access where required; date/action/search filters, snapshots, diff, label, restore as new revision, retention, export; vault/storage failure |
| S13 | Documentation and changelog | Bundled rendered articles, internal links, title/body search, dated release list with commit links; no article, invalid link, unavailable provenance; export |
| S14 | Notifications | Corner notifications and searchable centre; informational timeout, persistent warning/error, retry/action, multi-select dismiss/export; complete factual history |
| S15 | Command palette | Ctrl+Shift+F, bounded/full-window preference; live setting controls, commands, exact-element navigation; no match, invalid regex, unavailable action with reason |
| S16 | Tab discovery and management | Current strip, group members, group names, master search; all edges, pinned region, overflow, collapsed groups, move-group picker, bulk-close preview, unsaved protection |
| S17 | Every-element context menu | Pointer, keyboard and touch entry; target actions, working shortcut labels, Edit appearance, Lock; own filtered items and anchored builder; bounded scrolling |
| S18 | Appearance workspace anchored to target | Typography, color, layers, geometry, states, animation/transition tabs; all capability rows; unsupported preserved values; before/after, undo/redo/reset/import/export |
| S19 | Destructive decision gate | Exact affected data, independent key A/key B, full-range slider only after both, partial/complete/cancel/Escape, reduced motion; actual operation failure |
| S20 | Element lock and recovery | Password/OTP enrollment, independent element credential, locked/unlocked, incorrect attempts, support tickets, wait and unlock ladder; never authentication bypass |
| S21 | Personalization and shared mode | Vocabulary no-file/valid/invalid/replace/clear/cache-corrupt; mode renamed/shared/unreadable/locked; suppressed routes and restoration; secrets never captured |
| S22 | Schedule editor | Local settings/API/Home Assistant source, date/time/weekdays/timezone, cross-midnight, precedence, inactive/active/stale/offline/invalid; safe base restoration |
| S23 | Logo editor | Shipped presets, local upload, decode failure, crop/fit/focal/background, safe-area previews, conversion and rollback; package identity preserved |
| S24 | Export and external editor | Format capability/disclosure, destination browsing, archive options, selected/filtered scope, progress/partial/cancelled/failed; no editor and install guidance |
| S25 | Guided contextual help | Above-control entry, meaningful steps, Back/Cancel, input validation, exact preview and isolated playground reset; same descriptor/action as direct control |

## Search ownership

The explicit inventory must name: project list; every project-wizard picker; configuration tree; symbol table; each inspector tab; change review; tasks; task details; logs; artifacts; graphs; runtime list; every Tools sub-surface; every settings tab; history/date-action pickers; documentation; changelog; notifications; command palette; each of four tab discovery scopes; every context menu; every dropdown; each appearance editor tab/layer list/property inspector; locks/tickets; schedule list and editor; logo presets; export formats; editor picker; and guided examples. Each instance owns query, flags, validation, history and snippets without shared hidden query state.

## Reference tuple

Normal client area: 1440 × 960. Minimum client area: 960 × 640. Themes: light/dark. Language: English/Cantonese/bilingual. Scale: 100/125/150/200%. Deterministic state routes use stable screen and state IDs with a documented fixture or controlled real project; fixtures are labelled and never presented as successful backend execution. Exact source/build/artifact hash, runtime route, capture method and deviations accompany every reference comparison.
