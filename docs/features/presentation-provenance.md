# Presentation provenance

The documentation build separates source identity, source update time, production time and visual acceptance. These values describe different events and are not interchangeable.

## Front-screen provenance

The documentation header shows its package version, abbreviated source commit, exact input snapshot digest, build timestamp and latest committed input-change timestamp. Modified inputs make the source-update timestamp explicitly unavailable, while the input snapshot still identifies the actual source bytes. Build time is labelled as build time rather than the date of a source change or screenshot. Full values remain in `site/build-info.json`.

## Local font inventory

Both root build targets acquire exact lockfile-pinned packages: `@fontsource-variable/roboto@5.2.9` and `@fontsource-variable/noto-sans-hk@5.3.1`. Roboto supplies all normal and italic weight subsets from the selected package stylesheets; Noto Sans HK supplies every normal weight subset for the Cantonese fallback. Imports preserve the published weight and Unicode-range declarations. Only WOFF2 files referenced by these stylesheets ship, rather than redundant package variants or source trees. Dependencies download through the normal build bootstrap, and no new font binaries enter source control.

Desktop and documentation font stacks select `Roboto Variable` and `Noto Sans HK Variable`, followed by their existing system fallbacks. Desktop fonts remain addressable output files rather than inline data. The production hook copies each complete package license, records its hash, records each required source stylesheet and subset hash, and requires every source font hash to match a produced local font file. A missing subset or wrong installed package version stops production. The resulting `assets/fonts-manifest.json` contains actual byte counts, total output font bytes and source identity. The documentation footer links its inventory; desktop output carries its own inventory and licenses in `dist/assets`.

The manifest is production metadata, not correct-rendering proof. Binary variation axes, glyph interpretation, every required weight and CJK fallback remain unverified. Noto Sans HK has no italic import in this selection; no native italic-face claim is made. Installer compression and final package size require actual production. Browser font checks and offline rendering remain pending.

## Shared links

Static page titles and descriptions are escaped before HTML emission. Open Graph and summary-card metadata use the bundled project icon with alt text identifying it as an icon, not a screenshot. Visitor notes, imported wording, host paths and private workspace state never supply this metadata. No analytics or external preview service is introduced. Referrer policy is explicit. Per-article canonical URL metadata remains a separate pending capability.

## Historical gallery and recordings

Every retained gallery card explicitly says it is historical and does not establish the current build appearance or interaction. Stable capture IDs, original filenames, image bytes, source revisions, hashes and recorded timestamps are preserved. The inventory exposes `presentationStatus: historical`, unavailable current-build captures and an empty recording inventory. An empty recording list means no published recording, not a successful capture run.

Still images cannot establish transition timing, keyboard interaction, persistence or a workflow recording. Source timestamps and receipt-check times cannot stand in for capture times. Current screenshots and timed recordings remain pending. Earlier originals and their provenance remain in the [evidence archive](../evidence/ARCHIVE.md).

## Delivery boundary

This is source implementation only. No tests, reviews, static analysis, browser interaction, screenshot capture, font-rendering check or deployment verification ran in this implementation lane. Production must use the root `build.bat --target documentation /s` entrypoint on its pinned candidate. A successful production run would establish output generation only; current browser behavior, metadata delivery, font selection and capture acceptance require separate evidence.
