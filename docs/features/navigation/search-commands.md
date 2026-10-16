# Search and command surfaces

## Search workbenches

The desktop renderer imports a shared command surface from its application entry point. Settings, command results, context actions and application-owned select choices use an isolated search component. Literal text is the default. The adjacent code button opens the complete local expression workbench, including construction, flags, capture and replacement previews, cases, timing, capability explanations and session snippets. Editing the expression synchronizes the owning field; using the expression is explicit. Closing and reopening the settings workbench retains its session state.

Expression filtering runs in a separate worker with a 600 ms deadline. Patterns are limited to 2,000 characters, inventories to 1,000 entries, and each searchable record to 70,000 characters. Invalid expressions and unavailable or timed-out workers produce an explanatory empty result rather than silently treating a failed filter as a successful match. Each record resets the expression cursor so global and sticky flags do not leak state between records. Unsupported engine flags or combinations remain invalid.

### Search inventory

| Consumer | Exact search scope | Workbench connection |
| --- | --- | --- |
| Settings search, including nested settings-search instances | Supplied setting labels and descriptions, excluding imported vocabulary contents | Adjacent full workbench, isolated field state |
| Command palette | Registered mounted controls and existing destination actions | Own settings-search instance |
| Element context menu | Applicable focus, activation/edit and command-discovery actions | Independent settings-search instance retained per target for the session |
| Application select picker | Options from the original Material or native select | Independent per-picker search state, filtered choice inventory, original value/change consumer |
| Documentation | Indexed article titles, summaries and host-admitted article bodies, with the existing explicit fallback | Adjacent full workbench feeds the actual article worker |
| Source package catalogue | Existing host literal catalogue query; expression filters the loaded page only | Full workbench feeds the existing page filter |
| Model catalogue | Existing host literal cached-name query; expression filters the loaded page only | Full workbench feeds the existing page filter |

Package and model catalogue scopes remain deliberately distinct: a page expression does not pretend to search unloaded results, and it is never sent as an arbitrary host command. Changing a host query invalidates its old page as before. No pattern, sample or snippet is uploaded by these changes. Snippet file import/export remains explicitly user initiated.

## Commands and shortcuts

Control+Shift+F and the existing toolbar Actions button open a searchable, bounded command card. A persisted view preference switches between card and full-window presentation. Labels are taken from actual controls, including localized labels and their owning panel context. Password and file inputs are excluded. Setting results expose editable fields and switches that dispatch the original input/change path. Select results open real options and use the original selection consumer. Navigation selects the owning workspace/panel, then scrolls and focuses the original element with a reduced-motion-aware highlight. Existing unsaved-work prompts remain in force.

The palette inventories controls currently instantiated by the renderer, including mounted hidden feature panels and existing workspace destination actions. A feature panel that creates controls only after navigation becomes searchable after opening that destination. This is an explicit coverage limitation, not a complete registry of every possible future dynamic control or unloaded article.

Right-click, Shift+F10, the context-menu key and a 650 ms stationary touch hold open an element-specific menu. Applicable actions focus the element, activate its existing consumer or edit its actual value. The menu includes command discovery with the same Control+Shift+F binding used by the keyboard listener. Shortcut labels are sourced from that shared registry; no fictitious save, delete or navigation shortcuts are displayed. Disabled, inert and explicitly locked targets remain non-operable. Context menus do not add placeholder appearance or lock actions: those require the separate per-element providers and remain implementation gaps.

Application-owned Material and native select controls open a searchable choice surface on click, Enter, Space or arrow-key activation. Each choice uses the original select value and input/change events, preserves option order, marks the current value and respects disabled options. Native operating-system file dialogs remain platform-owned and are outside this renderer consumer. Select controls inside the command surface's own expression builder retain their native Material popup to avoid recursive modal replacement; searchable nested picker coverage remains incomplete.

## Delivery status and remaining work

This change is implementation only. Tests, static analysis, reviews, accessibility checks, runtime interaction and screenshots were intentionally not run in the selected accelerated delivery mode. No installed or runtime acceptance is claimed.

Remaining implementation includes exhaustive registered discovery of unmounted feature controls and unloaded article targets; per-element appearance and authentication-backed lock actions; searchable nested workbench picker popups; and the complete per-surface inventory for lists that do not yet have search. Existing standalone workbench engine diagnostics are reused without claiming unsupported engine trace capabilities. End-to-end validation of keyboard, touch, all language modes, focus return, cancellation, narrow layouts, scales, invalid expressions, settings persistence and original validation consumers remains deferred.

## Build repair follow-up

The command-card size control had a missing template-expression delimiter, which prevented the production bundle from compiling. The delimiter is repaired. Context and picker searches now retain separate component instances per target for the current session, including query, mode, flags and workbench snippets; reopening a different target cannot replace another target's search draft. Read-only original fields remain protected from inline writes. Build production is recorded separately from unrun functional acceptance.
