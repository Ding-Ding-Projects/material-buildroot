# Bounded task-oriented Help reader

## Presentation and retained behavior

Help keeps the complete host-admitted index but renders at most 24 topic rows on one explicit article page. Previous/Next controls, page counts and a topic filter expose every admitted article, including all paginated source references. Search evaluates the complete index, not only the displayed page. Direct admitted article routes, article anchors, history, topic selection and query state remain intact.

The home view offers six source-backed workflow links: image creation, BIOS ISO preparation, container runtime selection, component configuration, build queues and package authoring. A link is shown only when its exact ID exists in the admitted index. Missing recommended guides are disclosed; a bundle without those recommendations falls back to at most six actual available guides. This is separate from the complete paginated article list. Topic, paging and workflow labels wrap in narrow views.

An empty literal query or regex pattern uses index metadata without joining article bodies or requesting the body-text payload. The first nonempty query loads the actual body-text response once for that index. The existing index-identity check rejects stale responses. Later queries reuse the body cache; clearing a query restores the complete result set without discarding history or the draft. Unavailable body text retains the existing explicit metadata-only fallback.

## Physical-input workload evidence

The bounded fixture copies real built resources and invokes the real documentation service. Its retained manifest SHA-256 is `cd6c9008d8891a573d267d55e8fd426917d167e188fcf919f69fbb79bd938585`. It contains 389 Markdown documents and expands to 547 reader entries, including 158 source-reference views. Its actual search response contains 547 entries and serializes to 6,687,555 bytes. This receipt belongs to that copied bundle, not later changing build resources.

At 480 by 320 CSS pixels, bilingual/dark, device scale factor 2, the original reader and final layout probe produced these individual observations:

| Observation | Before | After |
| --- | ---: | ---: |
| Admitted entries retained | 547 | 547 |
| Rendered topic rows | 547 | 24 |
| Rendered home links/cards | 547 | 6 |
| Counted Material buttons, icon buttons and text fields | 1,100 | 38 |
| Shadow elements | 22,029 | 1,235 |
| Help settle elapsed | 3,341.8 ms | 1,439.3 ms |
| Maximum 50 ms heartbeat gap | 1,467.4 ms | 76.4 ms |
| Empty-query body-text requests | 1 | 0 |

The new category selector and its options are included in the shadow-element count, but not the stated button/text-field selector count. Timings are individual renderer-fixture observations, not statistical benchmarks or native runtime proof. The fixture completed before the repair too; therefore this evidence does not establish the cause of the separate native CDP timeout.

## Verification and remaining acceptance

The final combined run passed 13 focused cases with zero failures, skips or flaky cases: ten existing reader regressions and three actual-bundle workload/completeness/search cases. The full-data tests walk every page and compare all 547 exact identities, retain all source-reference pages, open a real reference directly, preserve history/topic/query state across navigation, and find a phrase from actual body text absent from metadata. Seven final layout checks also passed, including three language/theme captures and the three short/normal-height Help ancestor tests; overlapping cases are not a second independent result.

The initial control-bound regression failed against the original reader. Narrow label geometry also failed before explicit wrapping and passed afterward. A temporary helper-name collision with the native element method was corrected before preservation; whole-tree TypeScript remains at the existing 23 diagnostics. Independent composition review was dry within this scope. Rebuilt native capture and timeout recovery remain integration acceptance work. No native operation or deployment was performed by this unit.
