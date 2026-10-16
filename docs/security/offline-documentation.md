# Bundled offline documentation

The documentation bundle is generated from the existing public website article inventory, not from arbitrary filesystem discovery. `scripts/documentation/bundle.mjs` imports `website/inventory.mjs` and `website/source-boundary.mjs`, admits only indexed canonical public Markdown sources, and refuses linked or escaping article paths. Unindexed articles and unindexed image contents never enter the bundle. No network fetch occurs.

Run `node scripts/documentation/bundle.mjs --root <repository> --output <generated-documentation-directory>`. The output must be new or empty, outside indexed source destinations. The root build driver owns clean staging and packaging; the helper does not replace existing nonempty directories. Generated files are:

- `index.json`, an exact version-one `material-buildroot-documentation` manifest with `sourceSnapshot`, `documents`, `assets` and `issues`.
- `articles/doc-<source-path-sha256>.md`, preserving each admitted Markdown article's original bytes.
- `assets/<content-sha256>.png`, `.jpg` or `.webp`, containing admitted local raster images with matching signatures.

Each document record is exactly `{id,source,file,title,category,language,summary,sha256,bytes,anchors}`. Each asset is exactly `{source,file,sha256,bytes,mime}`. Each issue is exactly `{source,reference,reason}`. The aggregate source snapshot binds sorted original source paths and their copied bytes using the same algorithm as the website source boundary. A concurrent source change that produces a different snapshot fails generation. The completed staging bundle is validated before replacement of the empty output.

Articles are limited to 512 KiB each, images to 8 MiB each, and total admitted content plus manifest to 64 MiB. The manifest is limited to 1 MiB, with at most 1,000 articles, 1,000 image references and 10,000 recorded issues. Unsupported SVG/GIF images, remote images, unindexed assets, missing articles and missing anchors remain visible as unavailable content and issues. They are never silently counted as complete offline coverage. SVG is omitted because this implementation does not provide an admitted SVG sanitizer.

## Host service and renderer contract

`createDocumentationService({directory,openExternal?})` receives the absolute generated documentation directory from the trusted host. It exposes synchronous `list()`, `searchText()` and `read({id})`, plus asynchronous `open({id,linkId})`. None accepts a caller path. Unknown fields and malformed IDs are rejected.

`list()` returns `{articles,navigation,issues,complete}`. Article metadata is exactly `{id,title,category,language,summary}`. Navigation is `{categories:[{name,articles:[{id,title}]}],headings:[]}`. `read({id})` returns `{article,html,navigation,issues,complete}`; its navigation headings contain `{id,text,level}` for the current article. `complete` is false while any admitted issue remains. Reading does not fetch resources or open links.

`searchText()` returns `{entries:[{id,text,truncated}]}`, one entry per indexed article. It verifies the same aggregate snapshot as `list()`, renders each article with the production renderer and returns only its plain text, with tags removed, entities decoded and whitespace collapsed. Text is bounded to 32,768 characters per article and `truncated` reports a cut. Unindexed files are never included. The desktop exposes it as the argument-free `documentation.searchText` operation; the renderer validates every entry against the current index before using it for local matching.

The service revalidates the exact manifest schema, generated filename forms, file sizes, hashes, UTF-8 article bytes, image signatures and aggregate source snapshot. Symbolic links, junction-style canonical-path changes and multiply linked files are rejected. Missing or corrupt files cause a sanitized failure instead of a partial success. SHA-256 checks detect accidental or out-of-sync bundle changes; they are not a signature against an attacker who can replace both trusted packaged code and the manifest.

`renderMarkdown(text,{source?,documents?,assets?})` is exported for other admitted prose consumers. It returns `{html,headings,links,issues}` and uses the production-pinned Markdown parser with `html:false` and automatic linkification disabled. Tables, fenced code, headings, reference-style Markdown and descriptive link text remain readable. Raw HTML is escaped. Script, iframe and arbitrary embedded markup are never enabled. Future prose consumers still need their own source admission and external-link authorization; sharing the renderer grants no host capabilities.

Internal links have `href="#"`, `data-document-id` and, when applicable, `data-document-anchor`. Targets must exist in the admitted document/anchor inventory. The GUI intercepts these attributes and requests the indicated document ID. Missing or unsafe targets remain visibly disabled and add an issue. Heading IDs are deterministic, including suffixes for repeated headings.

External links admit HTTPS only, with no embedded credentials, controls or alternate schemes. Their HTML contains `data-document-link-id`, an opaque source-bound identifier, rather than a navigable external URL. The GUI calls `open({id,linkId})` only after the user's explicit link action. The service rereads and verifies that article, regenerates the admitted link set, checks the link ID against that exact source, then invokes the trusted `openExternal(url)` callback. It never accepts a URL supplied by the renderer. The callback result is `{opened:true}`; it does not claim the browser loaded the destination.

Local images use generated URLs under `documentation/assets/` with escaped descriptive alternate text. The root build must place those exact generated assets beside the packaged renderer. Remote image URLs, data images and unsupported formats produce visible unavailable-image text. A renderer must retain its existing restrictive content security policy and must not bypass the service by accepting caller-provided HTML or resource paths.

Errors use `INVALID_REQUEST`, `INVALID_BUNDLE`, `CORRUPT_BUNDLE`, `NOT_FOUND`, `LINK_NOT_ALLOWED` or `EXTERNAL_UNAVAILABLE`, with no underlying filesystem details. Article and asset inventory is bounded and generated from indexed public content; adding a source file requires normal inventory admission and regeneration.

## Verification boundary

Focused Linux fixtures initialize a local temporary Git index, generate a real bundle and read it through the service. They cover formatted articles and navigation, raw-HTML/XSS refusal, unsafe schemes, source-bound external opening, missing/unindexed/escaping references, unsupported SVG, linked article rejection, malformed hashes, aggregate snapshot corruption and linked generated storage. No fixtures fetch network content or commit private keys or source data.

A development-host run generated 63 indexed articles and 11 admitted images, with 23 unresolved or unsupported references reported as incomplete. That count is an observation of that source state, not a promise about later inventory. Live renderer integration, packaged resource loading and Windows runtime acceptance require separate evidence. The generated bundle and tests alone do not establish complete offline documentation coverage.
