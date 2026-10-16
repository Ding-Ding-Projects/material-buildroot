# Project workspace tabs

[香港粵語](workspace-tabs.zh-HK.md)

The desktop shell retains one operations-panel instance for each adopted project. Its key is the stable workspace ID returned by the trusted project-registration service. Selecting the same project again focuses that instance. Different projects retain separate configuration edits, source state, output and tool forms. Closing navigation does not destroy the instance or delete project data. Native title-bar controls are unchanged.

Use **New tab** to choose a destination. The catalog contains the existing root pages, each operations workspace, each settings category, each tool section and setup. Utility tabs retain the project that opened them; returning to a utility selects that retained project before its destination. Regular navigation changes the current working surface without automatically creating utility tabs. Catalog search defaults to literal matching and uses the existing adjacent regex workbench with worker timeout and expression validation.

The strip defaults to the left and can dock to all four edges through its management surface or context menu. Layout metadata is stored locally: open identities, pin state, order, group names, group order, membership, collapse state and docking. This data is not execution authority. After restarting, a saved project must be opened through the native folder picker to renew trusted access. Re-adoption reuses its stable tab identity.

Pinned tabs have a separate scrolling region. Drag tabs to reorder or move between groups; use Alt plus the orientation-appropriate arrow key to reorder and Alt+P to pin. Arrow keys move focus, Home/End select an edge, and Enter/Space activates. The management surface also offers named buttons for these actions. All labels remain horizontal at every edge. Narrow side strips retain icon buttons with accessible full names.

The searchable tab manager remains available regardless of overflow. It provides separate searches for all open tabs, groups and each group's members. Each search owns its independent regex state. Matching and nonmatching close actions require a valid nonempty search, preview their selected labels and exclude pins unless explicitly included. Existing unsaved language and scheduled-preference decisions remain in the owning shell; retained project instances preserve their drafts when hidden or closed.

## Verification and limits

This implementation was prepared in the speed-focused release mode. Runtime interaction, accessibility acceptance, display-scale geometry, persisted restart behavior and screenshots were deliberately not exercised. The first production build completed for e1615cde49e4dbc80a86b3248de8431c30a4b77f; it is superseded by the utility ownership and tool-catalog follow-up. A successful production build is compilation evidence only. Per-tab and per-group appearance controls are supplied by the separate appearance integration through stable target identities; this change does not claim that integration's runtime acceptance. The catalog lists destinations, not arbitrary executable commands, and never authorizes execution from persisted metadata.

## Shared command destinations and host window discovery

The shell registers its real destination callbacks through `registerCommandActionProvider`. Both the command palette and New tab catalog consume that same registry. Catalog activation resolves the current callable entry, closes the catalog, and invokes the existing destination handler. Restricted or removed entries are not resurrected from a cached label.

The master search obtains its inventory from the main process. Only registered application windows and admitted main-frame documents can publish bounded tab metadata. The host assigns window identity, clears navigation records when a document navigates or crashes, and removes destroyed windows. Metadata is held in memory, never persisted by the host, and cannot authorize a project, select a filesystem path or execute an arbitrary command. Activation only targets an existing tab in an extant registered window and requests its normal renderer navigation, preserving draft decisions.

The current desktop host creates one application window and does not expose a new-window action. The inventory therefore reports one actual window in that host configuration. The registry supports explicitly registered additional application windows without claiming that this release creates them. A missing host bridge is shown as unavailable, never replaced with invented renderer window records.

The local strip manager, master window search, group search and individual group searches use separate expression-workbench instances. Switching catalog/dialog modes does not reuse another search's hidden query state.

Tab and group context actions open the existing nonmodal appearance editor, with an explicit Shift+right-click route. Typography, colors, geometry, state styles, export/reset and presets remain owned by that editor. Stable tab/group identity is separate from their order and current navigation destination.

These additions remain source and production-build work. Runtime, multi-window activation, appearance persistence, access-revocation behavior and geometry have not been exercised under this task mode.
