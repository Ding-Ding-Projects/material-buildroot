# Workspace dialog lifecycle

The New tab catalog, tab management dialog, and cross-window tab list share one
Material Web dialog. Their transitions are serialized: an opening animation
finishes before a close begins, and a close finishes before another open begins.
Repeated pending open requests keep only the latest requested destination.

Closing retains the current heading, search, and content until Material Web
reports the close complete. State is then cleared and the connected opener
receives one explicit focus restoration. Repeated close requests do not repeat
that restoration. Escape and scrim cancellation use the same close path.
Destination selection and tab appearance actions wait for closure before opening
their next surface.

Each request has a generation identity. Closing or disconnecting invalidates
pending open continuations, so a stale render completion cannot unexpectedly
reopen the dialog. Cross-window refresh continuations also check the current
request before starting. A transition rejection displays a localized notice and
does not poison later queued requests.

Tab-close requests use a separate `requestClose()` method. The host retains the
native `Element.remove()` method so callers can safely disconnect it without
accidentally invoking tab removal with a missing argument.

## Scope and preservation

This lifecycle does not delete projects, alter drafts, change execution approval,
or replace the existing owning decisions for tab closure. Batch tab removal,
pinned-tab exclusion, and retained mounted workspaces keep their existing
behavior. No paths, credentials, or application records enter lifecycle state.

## Verification

Focused renderer coverage is in `tests/renderer/renderer-tabs.spec.mjs`. It covers
content retention during controlled close animation, exactly-once explicit focus
restoration, rapid close/reopen ordering, latest-request selection, canceled
pending opens, Escape, real opening/closing animation ordering, and disconnect
invalidation. The existing four batch-close cases remain in the same suite.

The unmodified lifecycle failed the content-retention, rapid-reopen, and
canceled-open cases; its Escape case passed. Initial source-browser reproduction
used shared installed dependencies and encountered font allow-list rejections;
the corrected isolated preview configuration served those dependencies normally
for the repaired run. Browser component evidence is not packaged Windows or
native input acceptance. Integrated native verification remains separate.

The disconnect case also asserts identity with `Element.prototype.remove`, calls
that native method, and verifies the host is disconnected and no stale opening
occurs. Before the method rename, native removal invoked the tab-close method and
threw while reading an absent tab ID. No production build was run in this lane.
The final focused renderer run passed all ten cases in 18.8 seconds, including
real animation ordering without page errors. Whitespace validation passed.

Intermittent disappearance of a native renderer process and stalled debugging
connections have not been attributed to this lifecycle. This change makes no
claim to repair those undiagnosed conditions.
