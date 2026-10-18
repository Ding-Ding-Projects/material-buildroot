# Renderer exit diagnostics

[香港粵語](renderer-exit-diagnostics.zh-HK.md)

The main process records the latest `render-process-gone` event in `diagnostics/renderer-exit.json` beneath the application's local user-data directory. It revokes desktop capabilities first, retaining the existing security behavior. There is no automatic reload, restart or recovery claim.

The fixed version-1 JSON format contains only `schemaVersion`, the fixed event name `renderer-exit`, an allowlisted native `reason` (or `unknown`), the signed numeric `exitCode`, the packaged source SHA and product version (or `null` when unavailable), and the UTC event timestamp. It never copies URLs, page content, profile paths, environment values, imported wording or arbitrary event properties. One latest receipt is retained, replacing the preceding receipt only after the new record is written. A missing or unwritable destination leaves diagnostic recording unavailable without changing capability revocation.

The receipt reports the native exit notification. It does not diagnose the underlying cause, prove an operating-system fault or establish that a repair worked. Focused checks cover exact fields, arbitrary-input exclusion, bounded replacement, invalid-code preservation and nonthrowing write failures. Real renderer-exit capture remains unverified until the packaged application emits the event.
