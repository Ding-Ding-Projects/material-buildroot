# Desktop editor workspace

The current direction replaces long card pages with a compact desktop IDE. The application opens its execution workspace when a desktop operations host is connected. Project plans remain a separate planning document, and are never presented as executable projects.

## Layout

A compact title bar and activity rail surround a project explorer, persistent document tabs, an independently scrolling central editor and a bottom jobs/output dock. The dock displays only returned job records and selected log pages. Its splitter supports pointer dragging and arrow keys. No project files, jobs or logs are fabricated for empty states.

Package authoring uses a dependency canvas beside a tabbed typed inspector. Node selection chooses the relevant inspector, and removing a dependency changes the exact package model submitted for host-generated preview. Source and license hashes remain user-supplied verified values. Package application remains bound to the external-tree revision, generated preview hash and explicit consent.

Guest topology uses managed records and typed configuration. Canvas positions are diagram metadata, not proof of applied hardware. Native execution and guest boot require separate runtime evidence.

## Canvas controls

Selection, snapping, drag, background pan, zoom, fit, keyboard movement, structured node selection, and layout undo/redo are functional. Layout read/write uses a separately authorized workspace canvas store with revision checks. Failed or unknown writes require reloading before saving again. Semantic edits continue through their owning typed form and explicit host operation; layout history never claims to undo host operations.

## Verification boundary

Browser fixtures establish renderer behavior and genuine application pixels at 960 and 1440 widths in light and dark themes. Typed fake host replies are labelled fixtures. They do not establish native picker, Buildroot, TLS, hypervisor or Windows runtime acceptance. Capture provenance must bind final source and generated artifacts after the implementation checkpoint.

## Material icon and workflow follow-up

The desktop now uses a checked-in subset of Google's Material Icons, pinned to upstream commit `49d4db35df873165d6bd6ba09b063c7dafbac2f4`. Original SVGs, Apache-2.0 license and per-file SHA-256 provenance live in `src/renderer/assets/material-icons/`. Icons render through registered `md-icon` components and inherit the active Material color; there is no remote font or CDN dependency. Navigation has distinct workspace symbols and tooltips. Repeated refresh, movement and removal controls use named `md-icon-button` controls; primary actions retain a short label with a decorative icon. Canvas icon targets are 48 CSS pixels and keep keyboard focus and accessible names.

The diagram edge SVG rule is scoped to the canvas world so it cannot shrink nested Material icons. Focused renderer captures assert visible icon geometry and that the package canvas footer ends above the default jobs dock at 960 and 1440 CSS pixels. Inspector scrolling is reset deliberately for capture framing. A larger user-resized dock can still require scrolling the editor; controls remain within its scrollable content.

External-tree setup supports native folder selection, preview of the three initialization files, explicit initialization approval, inspection of persisted grants, a separately reviewed ordered activation list and explicit trust for executable external recipes. Managed Ollama installation, cancellation, start and owned stop use typed host requests; fixture tests do not establish native installation or process acceptance.

Layout reload remains explicit to protect unsaved arrangements. Browser fixtures exercise real components and actual workspace preference storage with clearly typed fake native-operation replies. Final published screenshots must be regenerated and bound to the subsequent committed source; working-tree captures are review material only. Offline documentation integration and its final screen inventory follow separately.

## Offline documentation workspace

The Help & documentation tab, explorer action and command launcher entry open a task-oriented offline reader. The local index supplies article titles, summaries, topics and available language; article prose is rendered by the host's admitted Markdown renderer. The frontend inserts only that host HTML and intercepts article links. Internal navigation uses opaque document IDs and admitted anchors; external links send only the current document ID and an opaque link ID to the host. There is no arbitrary renderer URL-opening route. Back/forward history, on-page headings, focusable article reading, formatted tables/code/images and explicit unavailable-resource disclosures are implemented.

The adjacent documentation regex builder is specific to local title/topic/summary filtering. It cannot modify other searches, and catastrophic expressions are terminated in a separate worker. The search inventory records the precise scope and remaining history/snippet limitations. Unavailable/corrupt bundles show a retryable message. Reading documentation does not execute setup or project operations.

Review tuples include English/light/1440×960, Hong Kong Cantonese/light/960×960 and bilingual/dark/960×960. Browser fixtures use the actual host Markdown renderer with fixture article content and typed IPC replies; this establishes renderer behavior, not native packaged resource acceptance. Topic navigation explicitly overrides the shell activity-rail geometry and inherits all Material surface tokens, preventing narrow white rails in dark mode. Final screenshots must follow the documentation source checkpoint and use the final bundled corpus.

## Source package import and local model evidence

Package authoring now offers source-derived discovery with bounded paging, declared symbols/help, static-semantics warnings and original-file hash/content review. Unsupported recipes remain read-only. Only a backend-approved round-trip draft can replace the current editor draft, after a separate explicit checkbox; writes still require fresh file preview and Apply. Source packages become external-tree drafts; an external import retains only its current opaque native grant. Project changes discard pending inspection results.

The local assistant exposes host RAM/storage measurements, GPU evidence state, exact installed-model capability inspection and context-dependent fit estimates. Unknown evidence stays explicit. The displayed estimate includes weights, KV cache, overhead, safety factor, reasons and every backend limitation. Reported vision support does not enable attachment transport. Model selection changes invalidate displayed fit/capability evidence. Context values use the host's 128–1048576-token bounds and do not change chat settings.

The opt-in `renderer-current-gallery.spec.mjs` capture harness records invocation/capture timestamps, committed source revision, relevant source SHA-256s, article-bundle snapshot identity, screen/language/theme/viewport and explicit real-versus-fixture boundaries. It refuses dirty renderer/test source unless explicitly run as preliminary review. Offline-help screenshots use the actual verified bundled documentation service and corpus. Jobs remain empty rather than inventing records or output. Root promotion preserves historical originals separately.

## Capture review corrections

Workspace and regex imports expose registered Material upload buttons. Native file inputs remain hidden picker plumbing; the browser gesture, one MiB bounds, schema validation and cancellation behavior remain intact. Focused browser checks exercise both pickers and reject rendered native file inputs.

Below 85% diagram zoom, secondary text is omitted from the node face and node names retain a 13 CSS pixel screen size. Names truncate in a bounded label with the complete name available through the node's accessible name, tooltip and structured selector; semantic details remain in the inspector. This changes live rendering, not screenshot pixels. Source captures reset editor scroll to the start, and the narrow onboarding capture shows the actual plan-name step rather than a partly occluded runtime selector.

## Local vocabulary boundary

The renderer imports at most 256 KiB into a dedicated per-profile IndexedDB database. Import/replace uses a registered Material button and hidden native picker. Only generic empty/loaded/invalid/corrupt/cache-error states appear; filenames, entry counts, hashes and mapping previews are omitted. A failed replacement retains the previous valid vocabulary. Reload validates the cache again; Clear suppresses rendering immediately while the cache deletion completes. No mapping is added to workspace exports, activity or notifications.

The explicit `ownedCopy` helper currently covers static shell route names (including accessible navigation names), settings headings and the vocabulary palette actions. Dynamic/interpolated `l()` calls, records, paths, commands, providers, model strings and documentation bodies remain verbatim. This is a bounded coverage set, not a claim that all interface wording is customizable.

The consumer uses the typed host shared-mode status and event bridge. Unknown status suppresses formatting and import actions; active mode removes the vocabulary panel and palette routes. An event arriving during initial status lookup wins over the earlier reply. Native cross-application mode compatibility is not established by renderer fixtures.

A cache-deletion failure keeps substitutions suppressed and disables further import/clear attempts for the current renderer session. The generic recovery message requires a full application reload; no successful deletion is claimed. Reload revalidates the durable cache, so a vocabulary whose deletion failed may become active again when the shared host preference allows it. A browser check injects an IndexedDB deletion failure and verifies suppression, disabled mutation and revalidation after reload. This unit does not add an automatic retry or a reload button that could discard unsaved editor work.

## Shared preference control workspace

The settings panel uses the typed host service for initialization, exact display-name changes, PIN/password enrollment and replacement, entry, verified exit and read-only recovery instructions. Password/PIN fields clear after requests and observed state changes. Passkey enrollment is not offered; an existing passkey is explicitly reported as unsupported by this adapter with recovery available. Failed refresh and uncertain transport outcomes force the unavailable state until an explicit refresh confirms the host record.

Active and unavailable states render the shell and child workspace controls in English without mutating the saved base language. Language and vocabulary sections, their settings-search entries, vocabulary palette routes and the onboarding language-review action are omitted. The chosen shared display name, provider strings, user records, source data and documentation remain exact data rather than translation inputs. Leaving a confirmed active state restores the saved language and revalidates the vocabulary cache. The shared-preference palette action opens the panel and focuses its heading after the dialog closes.

Browser checks execute the actual shared-mode record service, IPC request validator and filesystem watcher with a temporary fixture vault. They cover initialization, exact rename, enrolled PIN exit, wrong-proof rejection, corrupt-state suppression, lost response, failed refresh and explicit recovery. These checks do not establish native safeStorage, passkey support or compatibility with unrelated applications. Current gallery provenance now includes shared renderer dependencies; prior e8 screenshots remain historical evidence and do not establish this new control workspace.

The full app-owned offline article corpus is not yet individually classified for restricted presentation. While the preference is active or unavailable, the reader therefore exposes only a vetted English workflow/recovery guide; article bodies, metadata search, topic routes and reader history controls are omitted. Unrestricted navigation state is retained for restoration. This deliberately limits offline help rather than claiming a complete article classifier. Shell workspace notices retain their English counterpart at assignment and switch at rendering; project names remain exact. Operational outcomes also retain English counterparts through an explicit named-field helper. The audited fields cover feedback in operations, tools, companion, source, package, guests, guest topology, external trees, managed Ollama, model evidence and package discovery; package validation and discovery filter messages; diagram layout-save messages; regex feedback; and settings-search errors. Shared-preference messages use semantic states and vocabulary status renders from state. Only pure application-owned status expressions are evaluated for the counterpart; interpolated provider codes, counts and records stay exact. No DOM text rewriting or clearing of meaningful outcomes is used. Reader feedback is withheld with the restricted reader. Focused browser checks verify an already-visible source failure switches to English while preserving its provider code and project name, and that empty resets cannot restore stale counterparts.

## Build admission and observed model catalogue

The Builds workspace now separates read-only scheduler inspection from explicit admission rechecks. It shows configured limits, running and quarantined reservations, blocked reason codes and the source/configuration revisions captured by each job. Optional typed reservation fields convert MiB/GiB to exact bytes and enforce runtime-specific bounds; Docker's fixed execution envelope is disclosed separately. Interrupted jobs are never labelled as verified stopped. Recovery offers the native project-selection route and a separate host cleanup verification action; missing identity, unavailable recovery records or an unverified runtime remain blocked. Rechecks may start eligible jobs, and retries retain their original intent.

The local assistant includes an official-source catalogue reader. Explicit refresh and independently available cancellation use the host controller; publication-in-progress cancellation refusal stays visible. Cached pages use a bounded substring query, per-result family drill-down and previous/next navigation. Its adjacent anchored regex builder filters only the loaded page in a terminable worker, with independent pattern, flags and mode. Observed counts are explicitly non-exhaustive; rounded display metadata never becomes exact sizes, capabilities, licences or hardware-fit recommendations. Browsing cannot pull or run a model. Changing query/family invalidates pending page results.

Review targets are English/light at 1440×960 and bilingual/dark at 960×960, using the existing Material controls, icons and 48-pixel action targets. These panels add no motion beyond the existing Material component behavior. Browser fixtures exercise typed queue and catalogue replies, including unverified cleanup and refusal to cancel publication; they do not establish native runtime cleanup, native pickers or live upstream network acceptance. Working-tree screenshots remain preliminary until a source checkpoint.
