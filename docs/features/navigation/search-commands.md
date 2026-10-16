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

Application-owned Material and native select controls open a searchable choice surface on click, Enter, Space or arrow-key activation. Each choice uses the original select value and input/change events, preserves option order, marks the current value and respects disabled options. Native operating-system file dialogs remain platform-owned and are outside this renderer consumer. Select controls inside expression builders use separate searchable picker dialogs too. Each picker owns its own search component and returns focus to its original select after selection or cancellation. Opening a nested picker preserves the parent expression draft.

## Delivery status and remaining work

This change is implementation only. Tests, static analysis, reviews, accessibility checks, runtime interaction and screenshots were intentionally not run in the selected accelerated delivery mode. No installed or runtime acceptance is claimed.

Remaining implementation includes exhaustive registered discovery of unmounted feature controls ; per-element appearance and authentication-backed lock actions; the complete per-surface inventory for lists that do not yet have search. Existing standalone workbench engine diagnostics are reused without claiming unsupported engine trace capabilities. End-to-end validation of keyboard, touch, all language modes, focus return, cancellation, narrow layouts, scales, invalid expressions, settings persistence and original validation consumers remains deferred.

## Build repair follow-up

The command-card size control had a missing template-expression delimiter, which prevented the production bundle from compiling. The delimiter is repaired. Context and picker searches now retain separate component instances per target for the current session, including query, mode, flags and workbench snippets; reopening a different target cannot replace another target's search draft. Read-only original fields remain protected from inline writes. Build production is recorded separately from unrun functional acceptance.

## Destination and nested-picker continuation

The palette includes explicit destinations for language, theme, scheduled preferences, schedule history, external source enrollment, shared preference and personal vocabulary controls even when Settings is not mounted. It also reads the admitted offline article index and opens selected articles through the existing documentation consumer. Restricted mode omits personal vocabulary and documentation discovery. Per-target picker dialogs now cover nested workbench selects without replacing the parent command card or its draft. Appearance and authentication-backed lock providers remain dependent on PH03-T05 and PH04-T02.

## Context provider API

Trusted renderer modules register through `registerContextActionProvider(providerId, provider)` from `command-surfaces.ts`. Registration returns a disposer. The provider receives `{target: HTMLElement, language: string}` and returns localized actions with `{id, label, context?, disabled?, run}`. Provider and action identifiers are stable lowercase identifiers, never user-visible labels. The provider resolves its own persisted element identity from its explicit attribute or established identity resolver; transient palette indexes are not persistence keys. The registry is limited to 16 providers and 32 actions per provider. Invalid contributions are omitted with an availability notice, without disabling unrelated providers.

The menu closes before an editor callback runs. Provider management actions deliberately have no original-action target field, so an editor can manage a disabled or locked element without executing that element. Registration does not grant host capabilities, remove restrictions or execute arbitrary commands. Provider editor validation and emergency exclusions remain authoritative.

A separate synchronous `registerCommandAccessProvider(providerId, target => boolean)` protects original command activation, inline writes and picker selection. Every registered provider must return `true`; false, an exception or a non-boolean result blocks the original consumer. Its disposer removes only that same registered function. Management actions remain separate. The experience-policy provider must preserve its native event protection and emergency routes outside this command surface as well.

Appearance and experience-policy modules register their own concrete editors. This file does not import a sibling implementation before that implementation is integrated, and the provider registry alone is not evidence that either editor is installed or verified.

## Shared palette and destination inventory

`registerCommandActionProvider(providerId, ({language}) => actions)` registers supported destinations and exact property/editor callbacks before their controls are mounted. It returns a disposer. An action has `id`, localized `label`, optional localized `context`, optional `disabled`, optional original `target: HTMLElement`, and a real `run` callback. `getCommandActionEntries(language)` returns the same flattened inventory for the palette and New tab catalog. Returned IDs are namespaced as `providerId:sourceActionId`; consumers must retain these IDs instead of deriving identity from labels or order.

Registration is bounded to 16 providers, each returning at most 256 actions, with a maximum of 512 flattened entries. Action IDs are nonempty strings up to 256 characters without control characters. Duplicate IDs within one provider and malformed actions are omitted; one provider cannot replace another. Register/unregister emits the window event `command-action-providers-changed`, allowing a mounted catalog to refresh. Providers supply supported action families or the current target's properties, not an unbounded Cartesian product of records and properties.

The palette closes before invoking a registered callback. Entry invocation resolves the current action again, checks that its provider still exists and respects its current disabled state. An optional original target also receives the existing dynamic command-access checks and must remain connected. Management/editor actions omit that field and retain their own validation, so managing a locked element never implicitly invokes its protected original action. A separate destination catalog closes its own presentation before calling the shared entry's `run`.

Workspace navigation and appearance modules register their own real callbacks. Registration supports unmounted destinations without fabricating controls or running renderer-provided commands. This registry is implementation infrastructure; it does not claim a sibling module has registered until that module is integrated. The palette combines provider entries with current controls and admitted articles, deduplicates IDs and caps its visible inventory at 1,000 with an explicit narrowing notice if exceeded.
