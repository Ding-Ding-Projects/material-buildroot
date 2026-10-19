# Bundled documentation source references

Offline Help opens directly linked JSON references and image references through the same admitted document reader used for Markdown articles. These are source views, not editable files, executable examples, downloads, or general file access. The Markdown article inventory remains unchanged; a separate typed reference inventory records the linked sources.

## Read a source reference

Open a JSON or image link in a bundled article. A valid local reference opens inside Help using an opaque document ID. A JSON reference displays escaped source text with its current page and total page count. Use the Previous page and Next page links to read the complete source. The normal Help history and article navigation continue to work. Each page is a contiguous source slice, so an individual page need not be a complete JSON value.

Images linked with ordinary Markdown links open in an image reference view. Images already embedded elsewhere reuse their admitted backing asset. Successful reference metadata uses a filename label and opaque IDs rather than a source path. Existing unavailable-link diagnostics continue to identify their source article and original reference.

The existing read operation accepts an optional presentation language of `en`, `zh-HK` or `bilingual`, defaulting to English for previous callers. Only the generated source-view description, page controls and their accessible name are localized. Original JSON, filenames, images and authored Markdown are unchanged. The desktop reader sends its effective language and refreshes the active page when that language changes.

## Admission and privacy

The producer discovers references only in link tokens from the admitted tracked Markdown inventory. JSON strings do not discover more references. An indexed file that has no direct article link is not included merely because it is JSON. The source must resolve inside the repository through the existing tracked-path boundary. Untracked, missing, outside-root, symbolic-link, junction and multiply linked inputs cannot supply reference bytes.

JSON requires valid UTF-8 with an exact byte round trip and valid JSON syntax. It is displayed as data, never interpreted as Markdown or HTML. Image references accept the existing PNG, JPEG and WebP formats and byte signatures. Unsupported formats, invalid images, unsafe links and nonexistent fragments stay visibly unavailable and keep the bundle incomplete. External HTTPS links retain their existing explicit host-mediated opening behavior; reference discovery performs no network requests.

The manifest retains exact source bytes, lengths and SHA-256 hashes. Every original input enters the aggregate source snapshot once, including an image used as both a link and an embedded image. Runtime reads verify the admitted bundle files and snapshot before returning content. Unknown manifest fields, duplicate source identities, invalid types, mismatched image backing records and altered or missing bytes fail closed. The reader accepts the exact previous manifest shape or the exact extended shape with a strict reference array.

## Packaged resource location

Packaged execution reads the generated bundle from the physical `documentation` directory below the runtime's host-owned resources directory. Packaging copies `dist/documentation` with `extraResources` and excludes its manifest, articles and JSON references from the application archive. Image assets also retain an archive-local copy for the reader's existing renderer-relative image URLs; both copies enter the output integrity inventory. Development continues to read `dist/documentation` below the application root. Renderer input cannot select either root. Physical resources preserve the strict file-descriptor identity checks, which are incompatible with synthetic archive filesystem metadata.

The root build entrypoints compare the complete copied resource inventory with the generated bundle and run the existing strict reader validation before accepting desktop output, including installer production. The normal build receipt inventories every physical documentation file with its length and SHA-256 hash alongside the application archive and installer files. Missing, extra, altered or invalid resources fail the build; archive-only output is insufficient. Focused physical-resource tests cover root selection, copy integrity, corruption and missing resources. Actual packaged interaction remains a separate runtime acceptance check.

## Resource limits

- Markdown inputs retain the existing 512 KiB per-article bound.
- Each raw JSON reference uses the existing 8 MiB asset-size bound. An oversized reference stays unavailable; it is not truncated.
- JSON views divide verified bytes into pages of at most 64 KiB, preserving UTF-8 character boundaries. Boundary adjustment can make an 8 MiB source require 129 pages.
- Escaped reference HTML must fit within 512 KiB. Page IDs and page counts are derived from verified sources, not supplied by a caller.
- The existing 64 MiB total bundle bound includes original content and manifest bytes. Markdown articles, image reference views and every JSON page share the 1,000-entry reader limit; image assets retain their 1,000-entry limit. Every page ID appears in the existing reader index, navigation and bounded search results so a later page can be restored by the normal Help lifecycle.
- Search retains its existing 32,768-character per-entry response bound and explicit truncation indicator, applied to each page's own text. Each source is verified, decoded and divided into pages once per operation; page rendering reuses those verified bytes without retaining a cache between requests. The complete source remains available through page navigation.

## Verification and remaining acceptance

Focused Node tests exercise opaque reference reads, link-only images, source and asset deduplication, unchanged Markdown rendering, original-byte snapshots, strict old/new manifests, JSON escaping, unknown pages, UTF-8 boundaries, the exact per-reference limit, the total limit, malformed and oversized inputs, unsafe or untracked paths, missing targets and hash mutations. Real file-symbolic-link cases remain explicitly unverified when the host does not grant the required privilege. Junction and hard-link cases run separately.

The actual repository inventory was also bundled and checked through the reader service. This focused source and service verification does not establish packaged desktop interaction, localization, keyboard navigation, layout, installation or release acceptance. Those checks remain part of the owning interface-remake verification.

## Related content

- [Offline help, notifications and release history](documentation-notifications.md)
- [Beginner documentation walkthrough](guided-documentation.md)
