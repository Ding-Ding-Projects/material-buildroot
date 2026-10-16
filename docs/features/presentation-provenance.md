# Presentation provenance

The documentation build separates source identity, source update time, production time and visual acceptance. These values describe different events and are not interchangeable.

## Front-screen provenance

The documentation header shows its package version, abbreviated source commit, exact input snapshot digest, build timestamp and latest committed input-change timestamp. Modified inputs make the source-update timestamp explicitly unavailable, while the input snapshot still identifies the actual source bytes. Build time is labelled as build time rather than the date of a source change or screenshot. Full values remain in `site/build-info.json`.

## Local font inventory

The existing root documentation build installs the lockfile-pinned `@fontsource-variable/roboto` package and bundles its imported stylesheet and font files locally. The build now writes `site/assets/fonts-manifest.json` from actual emitted font bytes, recording each filename, byte count and SHA-256, plus the exact package version and hashes of its copied license and emitted stylesheet. An empty font output stops production. The footer links to this inventory.

The manifest is generated production metadata, not a claim of complete family acquisition or correct rendering. Binary variation axes, every required script, weight selection and CJK fallback remain unverified. The existing stylesheet import preserves package declarations through the bundler; this change does not invent axis support or replace font assets. Complete acquisition and pinned per-source-file inventory remain unfinished beyond the existing package lock.

## Shared links

Static page titles and descriptions are escaped before HTML emission. Open Graph and summary-card metadata use the bundled project icon with alt text identifying it as an icon, not a screenshot. Visitor notes, imported wording, host paths and private workspace state never supply this metadata. No analytics or external preview service is introduced. Referrer policy is explicit. Per-article canonical URL metadata remains a separate pending capability.

## Historical gallery and recordings

Every retained gallery card explicitly says it is historical and does not establish the current build appearance or interaction. Stable capture IDs, original filenames, image bytes, source revisions, hashes and recorded timestamps are preserved. The inventory exposes `presentationStatus: historical`, unavailable current-build captures and an empty recording inventory. An empty recording list means no published recording, not a successful capture run.

Still images cannot establish transition timing, keyboard interaction, persistence or a workflow recording. Source timestamps and receipt-check times cannot stand in for capture times. Current screenshots and timed recordings remain pending. Earlier originals and their provenance remain in the [evidence archive](../evidence/ARCHIVE.md).

## Delivery boundary

This is source implementation only. No tests, reviews, static analysis, browser interaction, screenshot capture, font-rendering check or deployment verification ran in this implementation lane. Production must use the root `build.bat --target documentation /s` entrypoint on its pinned candidate. A successful production run would establish output generation only; current browser behavior, metadata delivery, font selection and capture acceptance require separate evidence.
