## Product completion continuation, 2026-10-18

The owner resumed implementation and acceptance. Historical test deferrals below are no longer the current execution boundary. Startup repair remains verified; broader product acceptance is incomplete.

At source 79f0de311430271bd195d4f16952de636f041209, the exact root desktop build passed. Hidden-desktop inspection reproduced the catalog overflow at 1440 by 960, bilingual, scale 1: the dialog was 900 pixels wide, its content 885 pixels wide, and the implicit grid column 1632.234375 pixels wide. The proposed repair constrains the grid to one shrinkable track and bounds its children. Same-tuple rebuilt verification remains pending. Dialog transition and batch-close review candidates still need reproduction.

Focused workspace service, store and IPC verification reported 15 passed, zero failed and one skipped file-symbolic-link privilege case after updating stale fixtures for idempotent setup retries and durable history directories. The pagination fixture now performs real preference changes. Further strengthened assertions are pending rerun. No production storage semantics were changed.

Remaining scope includes the implementation queue, translation inventory, native consumers, full firmware production, and independently proved feature acceptance. Configuration and metadata checks through WSL and Docker do not establish a complete firmware build. Preserve existing data, runtime distributions, installed settings and unrelated applications.

## Verified startup repair and runtime checks, 2026-10-17

Normal release [v0.1.1-build.232.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.1-build.232.1), source 00bca0993c22a30c6c5071458489c01331c67d2e, completed production successfully. The downloaded Setup.exe SHA-256 is 808cfce7b6662771d563793193df95f03d0bb98fca28a00ddae281c2e322f672. A user-scoped demand-only installer helper completed with exit zero. Independent native file-handle readback verified the physical normal installation, version 0.1.1 and exact embedded source, outside package-local redirection. The installed executable SHA-256 matches the producer inventory: 5700e24dbdfeeb5b718eb9bd316d16fdbf6c19956978d13fc355598c6b930e6c.

The installed executable reached a complete document, navigated to About and returned to the productive workspace using a separate verification profile. The bounded observation recorded zero console errors, unhandled exceptions and page errors. The current inspected workspace capture is indexed in docs/evidence/startup-repair/inventory.json, with exact source and hashes; its full private receipts are retained separately. The owned installed verification process and hidden desktop then exited through the normal close path.

Execution tests now report 20 passed, 0 failed and 6 skipped. Source-preview startup regression: 1 passed. Real non-root WSL 2 and Docker execution through ExecutionService passed olddefconfig and show-info against Buildroot 2025.02 source aa2d7ca53f704af901f6c33c13e4bb1591886700, with independently verified process/container cleanup. See docs/evidence/startup-repair/runtime-smoke.json. These are configuration and package-metadata checks, not a full firmware-image build; Windows source-link transfer limitations remain explicit.

The source repairs are complete for this bounded startup/runtime task. Final test-fixture/evidence preservation and remote closeout follow this record. A further automatic metadata-only release is a separate publication state, not retroactive evidence for build 232. Existing settings, installations, unrelated applications and other-session work were preserved. No visible desktop switch was required.

Retained follow-up: the tab catalog has an oversized layout in the inspected state, and a direct diagnostic close did not supply a complete later observation. This is outside the bounded startup repair and remains part of broader interface acceptance in issue #1. It does not negate the separately verified installed About-and-return workflow. Wiki publication is unavailable: the wiki remote reports Repository not found despite the repository capability flag. Do not claim wiki synchronization or whole-product acceptance.

---

## Startup and runtime repair candidate, 2026-10-17

Version 0.1.1 repairs missing workspace-tab registration, native Element.matches collisions in tab/authenticator components, and repeated identical search-result notifications that can keep the renderer busy. The startup browser regression passed. Runtime probing no longer references an undefined target, and WSL launches use setsid --wait so output and process ownership survive session creation.

Real execution through ExecutionService passed olddefconfig and show-info for both WSL 2 and Docker, using upstream Buildroot commit aa2d7ca53f704af901f6c33c13e4bb1591886700 and the official Buildroot environment image digest 340aa0de68e8e13e4eca70a00aaf94ec68d3a3891c28f3e7495d844829a8c958. Builds ran as UID 1000, and cleanup independently reported stopped WSL sessions or absent owned containers. These checks compile the configuration tool and enumerate package metadata; they do not prove a complete firmware build. WSL uses a task-owned distribution and preserves Linux source links. Native Windows extraction could not preserve all source links, so Docker's bind-mounted source check is limited to these two exercised targets.

The earlier broad execution suite had 11 passes, 8 failures and 6 skips. Two environment-probe failures are repaired; the remaining broad failures include outdated target/cache fixtures and remain separate from live runtime acceptance. Focused changed-path checks are recorded separately.

Next: build the 0.1.1 installer with the exact root entrypoint, verify packaged startup, publish and read back the exact release, update the matching normal installation through its supported route, and verify the actual installed workspace. Existing package-local filesystem redirection remains a verification concern. A visible-desktop check still requires explicit owner consent. Keep issue #6 current and preserve user data and unrelated applications.

---

## Installer startup repair result, 2026-10-17

The component-discovery syntax repair is published in normal release [v0.1.0-build.230.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0-build.230.1), source d159bb1f33212002a606fa8672210d5d42afd98a. Release production, release timing annotation and documentation deployment passed. Setup.exe download SHA-256 matches b373285e67ae3af7b49cb30228387727ffb91aeb29bd251f7b2f39ad124861cf. Production syntax checks passed for 134 modules; configuration checks passed 12 with 3 skipped, and the new discovery regression passed.

Installed startup acceptance remains incomplete. The owner reports nothing or a blank window after attempting the installer and normal shortcut. Automated installer/readback resolved through the agent application's package-local cache, so it does not establish repair of the normal installation. Hidden diagnostic copies reach navigation start but not document readiness; black native captures and timed-out CDP commands are not accepted runtime evidence. Production source was not altered by diagnostic instrumentation. The three originally reported application processes were terminated after explicit owner authorization.

Continue through [issue #6](https://github.com/Ding-Ding-Projects/material-buildroot/issues/6). Clarify whether the normal shortcut produces no window or a blank visible window, complete a briefly visible isolated check only after explicit owner consent, resolve the actual installed target and finish startup acceptance. Preserve settings and data. Docker server 29.8.2 responds; WSL lists docker-desktop, with a separate Buildroot WSL distribution still unverified. This bounded repair does not adopt the broader product backlog.

---

# Closeout revalidation, 2026-10-17

This chat remains stopped at the owner's requested preservation closeout. Its unfinished implementation goal is being paused, not marked complete. A later session advanced remote main by 388 commits; this local checkout fast-forwarded without rewriting or discarding work to e60ea1775f692091ee75b218bc891f0acfecb45c. The detailed later-session handoff below is preserved. This record does not adopt or delete that session's branches or change its verification scope.

The previously pending installer run 38982993840 is now terminal: failed at 2026-10-17T00:30:17Z, source d8a6489821657ae6fa4a6ae893130127ab1175f9. The installer step reports Invoke-FlashingBuild / IOException: Source and destination path must have identical roots. Move will not work across volumes. The build returned exit 1 and publication was skipped. Predecessor run 38980674305 also failed, at 2026-10-17T00:24:47Z, with Setup must contain one genuine embedded package ZIP resource. Neither run is still waiting; no duplicate dispatch or repair was started during this closeout.

The existing public historical gallery was independently rechecked anonymously: 59 endpoints returned HTTP 200 and all 52 image SHA-256 values matched the current manifest. The repository is public and its stored homepage exactly matches https://ding-ding-projects.github.io/material-buildroot/. The gallery is https://ding-ding-projects.github.io/material-buildroot/gallery/. This proves HTTP/byte delivery only. The older live-delivery receipt still counts 51 images, and historical/current per-record wording remains unresolved. Capture dates exist for 36 records and remain unavailable for 16; no dates were inferred. No current-build capture or recording was created.

Local inventory contains one primary checkout, one local main branch and no stashes or uncommitted source. Other-session remote branches remain retained. This chat has no eligible redundant cleanup candidate, so no archive or deletion pass was started. Four earlier isolated profiles remain after automatic approval review rejected deletion with the reason blocked by policy. Private original evidence and recovery material remain intact.

Next work requires the owner to resume implementation. Start with the terminal installer diagnostics, exact preserved source/branch inventory and the detailed remaining work below. Never treat this closeout, historical captures, production receipts or published release metadata as complete runtime, installer or feature acceptance. Preserve the original full objective and the separate completion criteria of each session.

---

# Preservation handoff, 2026-10-16

## Objective and current boundary

Implement and release the finite Material Buildroot roadmap, one implementation worker per leaf, with completed source integrated into main. All tests, reviews, audits, static analysis, runtime exercises and screenshots remain explicitly deferred, including VM and Docker tests. The configured account-preservation threshold was reached. New implementation and producer launches stopped; already assigned work settled and recoverable source was preserved. The goal is blocked and incomplete. The configured account-preservation boundary persisted for three consecutive goal turns. Source preservation is complete; new implementation requires an allowance change, and existing installer operations still require an external terminal result. This is not a completion verdict. No fixed token budget was requested.

## Integrated source and actual production

Verified main before this record: 26e3f4264ebd049cb21e1358e63533321d485377. The combined documentation candidate c5e501acfeb02bdbcc8e1a2ad1c54c0540306155 and combined desktop candidate 1777cd7024fcde736d14ee22e14ffb0d552a1e72 are integrated through original histories. Latest documentation production returned direct exit 0:351 HTML pages,8955 internal references,79 task entries and 109 feature identities. Identity counts are inventory, not complete behavior. The documentation and desktop font manifests record127 emitted files and 5864880 font bytes, from pinned Roboto5.2.9 and Noto Sans HK5.3.1. Glyph rendering and variation axes remain unverified.

The source contains 49 detailed Cantonese reference twins plus category/wiki translations. Actual Postman collections contain111 requests:four session routes and 107 typed actions from their exact integrated source. No API request was sent. See the exact remaining translation list in [article-translation-status.md](docs/features/article-translation-status.md).

[Production receipts](docs/planning/production-receipts.json) now contain32 source-bound records:31 reported numeric zero exits and one historical numeric exit unavailable. Every runtimeVerified field remains false. Desktop directory production does not prove native broker compilation, installation or runtime behavior.

## Preserved outside main

- task/companion-consumers at 89c7fad3f1bf37f6a6ac72eac16a691d9b34cdce adds the final Fabric/extension consumer unit after the successful 1777 build. This final atomic unit is unbuilt.
- task/converter-workflows atb8b98ff1f811d578068e111a2188373aec79d8a7 completed desktop production, but its history contains pending packaging changes. Preserve its original editor, durable-job, guided-form, assistant, forge and native histories.
- task/file-capabilities at 37bc9da1e590d3696da3649898cb4721b865f420 contains bounded video, seekable PDF, single-member ZIP and strict-Markdown protocols. These latest native operations are uncompiled and not all have integrated desktop consumers. No generic process fallback is authorized.
- task/squirrel-native at 6a537ba009162c2a9281c0df61bcd271030e5a19 preserves genuine-helper observation, native flashing packaging and adapter-admission source.
- task/offline-payload-source-origin atd8a6489821657ae6fa4a6ae893130127ab1175f9 adds the fixed-origin payload correction and safe rejection diagnostics.

All 63 local branches and 60 retained workspaces were inventoried. The pre-closeout source inventory found no modified or nonignored untracked files and no stashes. No branch, workspace, archive source, ignored announcement original or incomplete output was deleted. Default-branch integration does not cover every preserved branch, and no cleanup is claimed.

## Installer and release blocker

The full/delta packages from run 38972521474 fit the unchanged 1.4GB cap, but the actual setup lacked its DATA resource. Run38976198284 also failed setup-resource admission. Instrumented run 38979123512 then failed acquisition with “Untrusted payload source or redirect” before native/helper compilation or Squirrel production. Its rejected tool and host are unknown because the earlier diagnostics omitted them.

The correction was based on an actual official-origin redirect and an exact 374870016-byte fixed-mirror download matching the unchanged archive SHA256. It narrows source admission and records safe rejection identity; it is not a proven diagnosis of the earlier hosted failure. Existing changed-source run 38982993840 was pending with no job at the last readback. Its source isd8a6489821657ae6fa4a6ae893130127ab1175f9; observation deadline 2026-10-17T00:44:22Z. Observe that existing run before any retry, and never publish local version 0.1.1000. See [installer-production-state.json](docs/planning/installer-production-state.json). No complete installer/release success is claimed.

## Gallery and external state

The existing public [historical gallery](https://ding-ding-projects.github.io/material-buildroot/gallery/) was read anonymously:home, manifest, scripts/styles and all 52 PNGs returned 200; image hashes matched. Source README contains the exact backlink and repository visibility is PUBLIC. Capture 052 has separate native source provenance and unchanged-image inspection. The older live-delivery receipt still counts 51 images, and 25 per-record labels retain current wording despite historical global presentation. Those metadata gaps remain. No current-build capture or recording was created.

Status Hub health is reachable, but enrollment configuration is absent and the supported SSH enrollment route is unavailable. No authenticated Hub/display delivery is claimed.

## Next safe actions after allowance recovery

1. Read this record, the [assignment queue](docs/planning/implementation-queue.json), exact source receipts and current remote refs. Preserve the same owners and isolated scopes.
2. Observe existing installer run 38982993840. Retrieve actual diagnostics; correct only an evidenced failure, within the unchanged retry limits. Do not duplicate its dispatch.
3. Complete native compilation and the remaining converter consumers, preserve original histories, then incorporate the held packaging/editor/assistant/durable/forge/guided contributions when genuinely ready.
4. Complete the documented browser/companion restrictions, authentication/history, format and workflow gaps, remaining server administration/version/dependency gaps and exact article translations. Keep unsupported historical vendor data explicit.
5. Produce the final exact source through build.bat and build-installer.bat, then publish/read back a normal unique release and its intended assets. Deferred runtime/test/VM/container/capture acceptance stays separate.
6. Update source/wiki/public documentation and resolve gallery metadata. Only after ownership, archive, preservation, remote ancestry and inactivity proof may the task-owned cleanup proceed.

No force push, unrelated deletion, private publication, credential exposure or host power/login action is authorized.

---

# Historical implementation snapshot, 2026-10-16

## Current request and boundary

Implement the finite proposed roadmap, one implementation worker per leaf. The selected strict release pass defers all tests, reviews, audits, static analysis, runtime exercises and screenshots, including VM and Docker tests. Source, production, publication and runtime acceptance remain distinct. No complete-product claim is made.

## Preserved integration

Remote main before this record is de833ef29f68ba80c017af1018e7e90bbe0a026e. Browser source f1ee6423ecd827bf5e5f491f45a9b1a0ae9b7311, product workflow authoring c952cdf5f1afeaf90a5f2bc9b7e1111a35ea14cf and article unit cf590128682e0e6e15756000a66f16f4ce5482f7 are integrated with original histories. Each originating push has its verified shared-instructions preservation operation.

The production inventory now contains 28 source-bound receipts, 27 with numeric zero exits and one historical exit unavailable. Latest article production contains 301 HTML pages and 7250 internal references, at exact source cf590128682e0e6e15756000a66f16f4ce5482f7. Fourteen complete workflow twins and three wiki twins are integrated. Long-reference translations continue. API collections describe six baseline actions; expanded companion action collections remain in progress. These are production and source facts, not runtime acceptance.

## Active implementation and producer ownership

Companion candidate e1b3918cd1d27c7fe24a4e36ae2f63edcac18dcc completed the serialized desktop producer with direct numeric exit 0. It retains correction history for intermediate merge ca555a095cdaec0c21e84169434cccff4f4fcf53; unresolved markers were corrected before production. Do not integrate that intermediate commit alone. Browser durable category queues, full article translations, native seekable PDF operations and converter consumers continue in their existing isolated branches. Adapter admission source 050130bd1e80cab270c500f220c7649bd2e3b27d awaits the packaging owner's actual consumer.

Combined editor/durable/assistant/guided/forge source dbfeb8fcf1a54ea95d256748881d57459d85c4a6 remains preserved outside main because its original history contains incomplete installer changes. Converter successors include native video and seekable PDF source; their new production remains unverified. Future flashing packaging source d84a9470fa1a1ca2c7fccbd283202ab1773bd28f remains separate from the queued diagnostic.

## Installer evidence and remaining work

Run 38972521474 failed actual setup-resource admission: full package 1,375,477,453 bytes and delta 1,316,896,276 bytes meet the unchanged 1,400,000,000-byte cap, but Setup.exe 193,024 bytes has no DATA resource. Native broker and genuine helper compiled, with no installer launch. Instrumented source 714cd3d2ca7d5857b1cc5cfbe84658db25c48666 remains queued in run 38979123512 as of 23:22:11Z. Its observation deadline is 2026-10-17T00:01:19Z. Observe that existing operation, do not duplicate dispatch or replace its source. The older running installer 38976198284 is retained.

Finish concrete remaining source, preserve coherent branches, integrate independently ready units, produce the final exact candidate, and publish/read back a normal unique release. Keep all acceptance-dependent checkboxes open. Do not publish local version 0.1.1000. Preserve all owned work and ignored private announcement variants before any cleanup; no cleanup has occurred.

## External state

Status Hub health responds but enrollment configuration is absent and SSH enrollment is unavailable. No authenticated session/display delivery is claimed. Latest account reading is 31 percent remaining; battery 100 percent and charging. Goal remains active. No fixed token budget was requested.

See [assignment inventory](docs/planning/implementation-queue.json) and [production receipts](docs/planning/production-receipts.json).

---

# Earlier isolated implementation snapshot, 2026-10-16

The finite roadmap pass uses one implementation worker per leaf. All tests, reviews, audits, static analysis, runtime exercises and screenshots remain deferred, including VM and Docker tests. Production and release metadata readback remain enabled. No whole-product completion is claimed.

Verified remote main before this record: ba486005c2c91f0e216b695610ab764570bac29d. Recent integration adds named targets/SDK export, language and notifications, typed status availability, cloud destinations, remote execution and destination-bound flashing source. Native flashing compilation/packaging remains separate.

The production inventory contains 24 source/hash records, including seven newly recorded exact-source desktop/documentation outputs. Twenty-three records have reported numeric zero exits; the historical preset record has no retained numeric exit. Every runtime acceptance remains unverified. Documentation receipt be354a11fe88f8cd43a33e66ce1c2eec7ec7c8cf predates later browser changes.

Combined editor/durable/assistant/guided/forge/converter candidate dbfeb8fcf1a54ea95d256748881d57459d85c4a6 completed desktop production with exit 0. Its original history contains pending installer changes, so it remains preserved outside main until those changes have genuine production proof. Browser f1ee6423ecd827bf5e5f491f45a9b1a0ae9b7311 is assigned the next isolated documentation producer. Companion source 80529d3628f7c51692563c40141a0cfb1430464c is preserved and its owner continues remaining typed consumers. Complete articles and product-workflow authoring have separate active owners.

Full installer run 38972521474 at 1271e06b139875442f3a5850cfd2cacae2c8cfcb failed actual setup-resource admission. Its full package is 1,375,477,453 bytes and delta 1,316,896,276 bytes, both below the unchanged 1,400,000,000-byte cap. Actual Setup.exe is 193,024 bytes and has FLAGS but no DATA resource. Native broker and genuine x64 helper compilation succeeded; no installer launch or runtime acceptance ran. The diagnostic metadata is retained; full/delta binary retention is separate from the bounded diagnostic download. Never publish local version 0.1.1000.

Instrumented candidate 714cd3d2ca7d5857b1cc5cfbe84658db25c48666 is preserved. Automatic run 38979123512 is pending as of 23:07:45Z, with no job yet. It observes the actual genuine helper exit, input ZIP and pre/post DATA identities without replacing the installer format or weakening admission. The responsible resource-loss boundary is unresolved until actual evidence arrives.

Status Hub health is reachable but enrollment configuration is absent and the supported SSH enrollment route is unavailable. No authenticated session or display delivery is claimed. Latest verified allowance is 36 percent remaining. All linked workspaces, source histories, incomplete outputs and ignored private announcement variants are retained. No cleanup occurred.

See [assignment inventory](docs/planning/implementation-queue.json) and [source-bound production receipts](docs/planning/production-receipts.json). Continue remaining implementation, preserve each coherent unit, integrate only ready source, then produce and publish the final exact candidate. Deferred acceptance checkboxes remain open.

# Latest implementation continuation, 2026-10-16

## Three pending features implemented, full native suite now passing

Account allowance was re-read before work: the lowest window had 34% remaining, so implementation resumed. This supersedes the account-preservation stop recorded below.

- **API collections.** `docs/security/postman/companion.postman_collection.json` (category) and `docs/postman/material-buildroot.postman_collection.json` (master) cover the four HTTPS companion routes and six typed actions with placeholders only. `scripts/api/generate-postman.cjs` generates both; `--check` fails when stale. `tests/postman-collections.test.cjs` has four passing cases, including an in-order replay of every request against a real loopback HTTPS companion with a temporary certificate. It was watched red when the `sequence` placeholder was serialized as a JSON string. Not a Postman-application, LAN, firewall or browser-trust result.
- **Article-body search.** New host operation `documentation.searchText` returns verified plain text per indexed article, at most 32,768 characters each, with a `truncated` flag. The Help panel loads it after the index, validates every entry, and uses it for literal and regex search; the status line names a title-and-summary fallback while loading or when unavailable. One new host case and one new renderer case pass with the existing documentation suite (eight renderer cases).
- **Atomic onboarding plan step.** New workspace action `onboarding.createPlan` creates the setup plan and records `{step:2,planId}` in one transaction, reuses a recorded existing plan on retry, and leaves neither half after a failed write. Two new host cases pass and were watched red with reuse disabled. The real-service wizard renderer spec asserts the single transaction; 54 renderer cases across workspace, source and settings pass.
- **Full native suite.** With `TEST_PYTHON3_EXECUTABLE` set to a Python 3.13 interpreter: 514 discovered, 479 passed, zero failed, 35 explicit skips. Skips need Linux/WSL, downloaded Buildroot source, symbolic-link privilege, Windows-blocked SQLite journal replacement, POSIX filenames or browser IndexedDB, and stay unverified. TypeScript passes.

Not done in this continuation: packaged native interaction for any of the three features, documentation rebuild and deployment, and every roadmap item that needs WSL, Docker, hypervisors, real Buildroot builds or other unavailable host capabilities. WSL is still absent and Docker unavailable on this host.

---

# Latest evidence continuation, 2026-10-16

## Latest bounded audit and native result

The current continuation state is in [CLOSEOUT_PROMPT.md](CLOSEOUT_PROMPT.md). The [new native wording report](docs/evidence/tasks/wording-drop-native.md) records 29 packaged checks at e463, actual restart and complete owned-process teardown, together with OLE/picker/speech/matrix gaps and missing per-image capture clocks. The public 109-identity audit is a provisional baseline, not complete implementation. The security category index now includes all current articles and correctly distinguishes IPC-only boundaries from the companion HTTPS API; category/master Postman collections remain missing. Reviewed generated documentation output is preserved and awaits a fresh build/deployment after source-record changes. Earlier pending/current statements below are historical and are superseded only by these explicitly bounded updates.

## Desktop wording-drop source ready for native verification

The desktop now shares one serialized, bounded file-import route between Settings and window-wide drops. Successful application uses the imported exact headline or localized neutral fallback, a real Material Web filled card, reduced-motion behavior and a polite announcement inside the active modal boundary. Invalid/unavailable outcomes share nonblocking feedback; mode changes suppress private presentation immediately. Source review corrected modal/primitive defects before application. A repeated-invalid renderer regression exposed removed Lit anchors; clearing now blanks text nodes while retaining bindings, and independent review closed that residual source finding. TypeScript and 18 renderer cases passed. Shared/headline checks passed 11 cases, with a separate real IndexedDB pass accounting for its earlier browser skip; native ACL and file-link proof remain unavailable. Native dragging, screen-reader speech, installed-package behavior and the complete current-source matrix remain pending. No complete feature acceptance is claimed.

## Terminal release timing correction

The first hosted annotation is now verified: original run `38892342358` and annotation `38892731384` succeeded at source `065497b05ebf09c9b90012a9cda87cffd8e52218`. Normal release 51.1 reads back the exact owned timing block computed from terminal API records: `2026-10-16T11:13:24.000Z` through publication-step completion `2026-10-16T11:16:36.000Z`, duration `00:03:12`. The later terminal-job timestamp remains separately labelled. This supersedes only this route's hosted-pending statement below.

The publisher now leaves timing explicitly pending until a separate completed-workflow listener reads the original attempt's actual first-job start and final publication-step completion. The listener executes reviewed default-branch code, never triggering-branch code or artifacts, validates exact source/tag/normal-release identity, edits only its owned timing block and reads back unchanged assets. Six focused cases, syntax/YAML checks and independent security/correctness review passed. Hosted trigger/bootstrap/annotation remain unverified. Release 49.1 was manually corrected from terminal API records and read back at `00:03:42`; its five published digests and three independent metadata downloads are recorded separately. Source publication remains a checkpoint, not complete product acceptance.

## Complete identity source inventory, incomplete delivery

The preserved source audit at `e722cf1b91ccc46465eb449df4abd84d9d6df2a1` accounts for all 109 public identities exactly once and 436 surface rows. Independent review confirmed the identifier/source hashes and found 62 applicability differences: 55 have explicit scope interpretations, seven remain partial applicable obligations. Shared feature traces are not independent surface proof. The public overview links all 427 ledger requirement IDs and 109 individual source-audit articles; all 1,908 detailed private audit rows remain outside independent public clause admission. Provisional counts are 71 partial, 21 missing, six implemented-unverified and 11 scoped conditional exclusions, with no whole-feature verified-complete result. Later browser and markup repairs retain separate delta evidence. See the [audit and limits](docs/evidence/tasks/PH01-delivery-audit.md).

## Built browser observations and markup correction

The exact documentation build from `bb34a7efc011c2c5450616197ffa7cf9ef0701b3` passed 110-page/2757-link admission. Its hidden-desktop Edge run drove 17 supporting article routes, guide and visitor persistence, three viewport/language/theme tuples and isolated production-shaped companion response fixtures. All 17 owned processes, ports and desktop are absent; retained task profiles keep strict cleanup validation incomplete. Actual host pairing and the full matrix remain unverified. Pixels also exposed span markup inside two accessibility attributes. The current narrow correction escapes plain attribute text and updates names in all three language modes; twelve focused checks and two-lens source review passed. A fresh identical-tuple build/capture remains pending.

## Current browser response repair

The browser source now consumes the host's actual flat workspace projection and named project/job wrappers, validates complete bounded collections before rendering, clears invalid/lost data before language rerendering and fixes dynamic supporting-article extensions. Eight focused production-source cases passed after the original six-case red baseline; independent review found no blocking regression. These are in-memory DOM checks, not built browser or actual paired-host acceptance. The exact documentation build and headless browser run are next. Main `7a6b2b5ee5d23f9029d3128d9961cb8aef52cf79` is published; its normal release 49.1 has five verified metadata/digest records. Its deployment workflow succeeded, and the home plus exact new dialog PNG returned HTTP 200 with the expected image hash and exact homepage readback. Complete article inventory and current browser repair deployment remain pending.

## Current native dialog evidence promotion

The settled dialog-action capture now binds to desktop source `e722cf1b91ccc46465eb449df4abd84d9d6df2a1`, executable SHA-256 `47ed433b93e9c924ba510207f670a455c54ec28a5c8c59b5883a8090f5f77c6b`. At 1280×752 logical pixels, observed scale 1.5, bilingual/light state, all three actions are inside the dialog and the final action wraps. The raw PNG was copied byte-for-byte, independently inspected and linked from the README. See [the exact receipt and limits](docs/evidence/native-windows-20261016/README.md#settled-dialog-actions-at-e722cf1). The transitional image remains excluded. Normal owned close and fresh absence of all four recorded processes are verified separately from the bounded visual result. This supersedes the dialog-after-proof pending statements below only; publication, full matrix and overall acceptance remain pending.

Latest owner direction requires a deep audit of every applicable required feature, beyond the planned ledger. The immediate instruction resynchronization read back 85 current targets with zero drift/missing. Publisher correction bec09ceeb5c4ba86a67113bef025149b5de30e55 has eight focused passes and actual exact-source public-metadata admission: 45 prior releases inspected and an unused Scallop Har Gow reference selected in 22.229 seconds, without raster acquisition or publication. Dialog repair 2402e8d and bounded planning expansion 2a2772e are locally committed; native dialog after proof and publication remain pending.

Correction: the copied catalogue-photo source/attachments introduced at 7b679a713d87350253106fba7e6dbd30a7522a67 were incorrect. Release 47/48 duplicate PNGs have been withdrawn; each retains five unchanged other assets and a verified corrected description, with historical checksum entries disclosed. The pending source correction uses public references, unused-name selection and an explicit version-only fallback. Eight focused cases passed. Earlier attachment claims below are historical and superseded by this correction, not current delivery claims.

The panel sizing repair has genuine native after proof at source 2ed493d3f0f001f13e3c21422d6a598ae451d85b: 503/503 px layout and editor widths at identical 1280×752, actual 150%, bilingual/light state. Native Enter exercised preservation and normal close. A second settled dialog-action defect is source-repaired with six focused cases passing; its native rebuild/after proof remains pending. Planning now has 427 requirements after a bounded 15-clause expansion with all prior 412 IDs/text unchanged and 20 ledger cases passing. Shared rules main 584ef39737dd52fd2fa728f66e502c005cd7e527 is verified and all 85 installed targets are current. Full acceptance remains incomplete; see the current closeout.

The complete current scheduled-preferences browser matrix passed all 20 cases in 55.6 seconds using isolated headless Edge, the actual SQLite service and the typed IPC adapter with explicit frame-admission fixtures. This supersedes the earlier partial browser results below. Native packaged interaction and the complete layout matrix remain pending. Normal release v0.1.0-build.47.1 targets 7b679a713d87350253106fba7e6dbd30a7522a67 and GitHub readback confirms all six expected assets, including the exact required original photo. Planning reconciliation c90805cd33cd920a13007622cd68247d43b9e446 is independently reviewed and verified on main.

The required catalogue photo publication unit bundles the unchanged selected original and requires source/hash/native-decode admission before publication. Seven focused cases passed and independent source review is complete. Actual attachment in a new release remains pending. All three new renderer recovery cases now pass in the browser source-preview route; the full current 20-case matrix and native GUI acceptance remain pending. The latest private instruction revision has 85 installed targets verified current; its complete validation sweep remains non-green, with a timed-out synchronization fixture and unsupported Bash verification recorded separately.

Local draft-discard host actions and separate bounded SQLite history are implemented. Ten focused cases and an additional genuine interrupted-writer recovery case passed; the existing active schedule regression passed 19 cases with four explicit native skips. TypeScript passed for the integrated candidate. Two browser recovery cases passed; unknown-removal recovery exhausted the test budget after final readback and remains unverified. The exact current continuation and next steps are in `CLOSEOUT_PROMPT.md`; these latest facts supersede pending statements below while retaining their historical evidence boundaries.

The active objective remains complete PH00–PH10 implementation and actual Windows acceptance. The complete repaired native run found 466 cases: 423 passed, nine failed, 34 skipped. Seven failures came from an omitted interpreter selection; the corrected focused invocation passed eight cases with two explicit skips. Two unchanged HTTPS cases remain under focused diagnosis during severe paging. Storage recovery passed 17 cases with six explicit skips. These are bounded results, not complete product acceptance.

The latest test-only scheduled-editor correction has a separate byte-bound recovery receipt at `design/archive/schedule-editor-20261016/receipt-v2.json`. The candidate remains inactive and unverified. Baseline application, hidden desktop and owned Lowlevel server teardown is independently confirmed; see `docs/evidence/native-windows-20261016/README.md`. Installer/update, source-to-image builds, guest lifecycle, source enrollment and broad roadmap acceptance remain unfinished.

---

# Handoff

## Native Windows continuation, 2026-10-16

Verified fixture batches are published at `22861aed9678918b5a9a23e319ac5f17719f5d5d` and `08ba5a8a2a1f85737bc5fccb5527231fdbae8ce6`. The second complete tools run passed 16 tests with zero failures/skips. Further native fixture changes have passed syntax checks across 28 files and received bounded assertion-preservation review, but their new runtime verdict is pending. They are recovery work, not a new green full-suite result.

The latest scheduled-preferences candidate is preserved byte-for-byte in [a separate inactive archive](design/archive/schedule-editor-20261016/README.md). Independent display corrections are included. One SQLite/IPC save/reload/history assertion passed, but interrupted teardown and the later first-case reload timeout leave the full twelve-case browser matrix unverified. The other eleven cases did not run. Do not activate the candidate merely to preserve it. The latest physical-memory reading reached approximately 4.6 MiB free, so further heavy verification awaits capacity. The owner has been asked to report when capacity is available; this is not a new implementation-authorization request.

The owner resumed complete-roadmap implementation and explicitly requested Windows tests, superseding the older deferral below. Baseline source `1b7ea15359ac2870a9f8bc02889770db4cb48d08` built successfully through the exact desktop entrypoint. Six focused native toolchain tests passed without skips. The complete Node baseline reports 444 tests, 361 passed, 74 failed and nine skipped. A later focused discovery/TLS/Kconfig batch reports 44 passed, zero failed and three explicit skips. See [native continuation evidence](docs/evidence/native-windows-20261016/README.md) for source boundaries and limitations.

Native checkout newline conversion changed pinned Kconfig vendor bytes; exact-byte attributes and a provenance regression repair that checkout behavior without changing expected hashes. Other native fixture repairs and the reviewed scheduled-preferences renderer are in progress. A real packaged workspace launched on a named hidden Windows desktop and runtime discovery was exercised against the host. Installer, successful Linux builds, guest lifecycle and full phase acceptance remain open. Older source/capture/test records retain their historical boundaries.

## Public gallery preservation, 2026-10-15

The source preservation checkpoint is `d236a1fddc8c57609ab9697db0e64979dbe7923a`; its Windows release and Pages workflows passed. The unfinished schedule editor remains an inactive, byte-verified recovery patch. New implementation remains stopped, and the full roadmap is incomplete.

A reviewed [51-image gallery](https://ding-ding-projects.github.io/material-buildroot/gallery/) is live at source `838befc311ab12d17eca744445331b53f2c3b25f`, with the exact source README backlink verified from GitHub. Pages workflow `38822061871` passed. The [live receipt](gallery/live-delivery.json) records 58 successful HTTP responses, matching hashes for five site assets and all 51 images, and actual Chromium interactions at 320/390/768/1440 pixel widths with no overflow or console/page errors. Language/theme persistence, search/filter/clear, provenance disclosure and keyboard activation passed. The locally bundled Material components resolve to version 2.4.1.

The gallery retains 24 workspace, nine historical workspace, six interactive website, five earlier landing, five early preview and two historical desktop-shell originals. Capture clocks are used only when recorded; image dimensions, viewport dimensions, build bases and source snapshots remain distinct. Later shared-mode, queue/catalogue and schedule changes are not represented by current accepted captures. Unmanifested cache captures remain withheld.

Creating the separately requested gallery repository was blocked by GitHub integration permissions (`Resource not accessible by integration (createRepository)`). The existing project Pages route preserves the publishable work; it does not satisfy that separate repository requirement. No extra branches, linked worktrees or stashes exist in either the source or private reference checkout, so there is no redundant cleanup candidate and no repository deletion or archive is claimed. New implementation remains stopped. On resumption, apply the latest tab contract: one workspace tab per project identity, focus existing tabs on reselect, and open utilities only through an explicit searchable destination catalog with independent plain/regex state and preserved drafts. That contract is not an implementation or acceptance claim.

## Requested preservation and scoped cleanup, 2026-10-15

New implementation stopped at the owner's explicit preservation request. Reviewed schedule enrollment is published at `8c0c15edd7ed45cd3ffa02cd1032f52922e1396c`. The unfinished schedule GUI is retained as a byte-verified, inactive [recovery patch](design/archive/schedule-editor-in-progress/README.md); it passed TypeScript but has no browser acceptance. Source-enrollment forms were not started. The active renderer preserves the existing working controls. Independent queue/catalogue motion and capture-alignment fixes passed two focused viewport checks.

The source and private reference checkouts each have main only, one primary worktree and no stashes. No redundant task-owned deletion candidate exists; retain the primary checkouts, recovery draft and evidence. A dedicated public screenshot gallery is the sole continuing publication lane. The updated [continuation prompt](CLOSEOUT_PROMPT.md) records implemented, verified and unfinished work. The complete roadmap is not finished.

## Explicit schedule-source enrollment, 2026-10-15

The schedule host now persists deliberate HTTPS/Home Assistant source enrollments with exact origins, explicit private-address choices, revision conflicts and protected credential references. Tokens are transient operation input; safe settings replies contain no token or vault reference. Setup makes no DNS or socket request. Rotation writes a fresh protected reference; prior references are preserved. The narrow bridge exposes list/save/remove with live authority checks and generic failures.

Removing or losing an enrollment aborts the old provider generation and restores eligible local/base values without deleting saved rules. Unenrolled rules remain editable but inert. Independent review repaired external-rule origin changes/removal; 43 current host/enrollment/IPC/preload checks pass, including actual SQLite and local TLS fixtures. Native vault, real user services and Windows acceptance remain unverified. Astra is implementing the graphical editor, source setup and effective language/theme consumers against these APIs.

## Queue controls and interactive workflow guide source, 2026-10-15

The queue/catalogue GUI is published at `009354b177a74e9ca9a12306771287243a3cc556`; both Windows packaging and Pages workflows passed. The Builds workspace exposes typed reservations, scheduler status, admission rechecks, native-access renewal and verified cleanup. The Local assistant workspace provides observed official catalogue status, paging, family drill-down, scoped regex filtering and refresh/cancel. Fourteen affected browser checks and two viewport checks passed. The captures remain preliminary source previews, with native effects supplied by fixtures.

Four interactive website guides now cover personal vocabulary, shared preference, build recovery and observed model discovery. They store only visitor learning progress and accept no private mappings, credentials or desktop execution. A fresh isolated preview passed 2,481 route/link/asset/fragment checks, 16 browser interaction checks, 73 article routes and 12 responsive tuples. This source checkpoint does not regenerate or replace the tracked deployed site. Final current captures, generated documentation and live delivery are still pending.

All five downloaded assets of `v0.1.0-build.35.1` were independently verified against GitHub sizes/digests, published checksums, provenance and Squirrel package records. The [receipt](docs/evidence/desktop-shell/release-v0.1.0-build.35.1.json) binds source `a1db4edacd949c679420dd29259391053860e9c3`. GitHub reports the release is not platform-enforced immutable. No native runtime check was performed. The release-note template is corrected to describe the implemented workspace and remaining runtime gaps instead of the historical empty-shell milestone.

## Shared preference controls and scheduled host integration, 2026-10-15

Shared-mode desktop controls are published at `4f023e4`. The settings workspace supports exact-name initialization and rename, PIN/password enrollment and replacement, entry, verified exit, refresh and recovery guidance. Active or unknown mode uses English for application-owned controls and retained operational outcomes without changing saved language or exact records. Language and vocabulary routes are omitted; restricted offline help exposes a vetted English guide while full article classification remains open. Thirty-five focused browser checks and strict TypeScript checking passed. Native vault, cross-application and passkey acceptance remain unverified.

The scheduled-preferences host now connects SQLite document/history transactions, bounded profile watching, civil-time evaluation and a privileged HTTPS/Home Assistant provider to a narrow desktop bridge. Forty focused checks cover the shared core, real SQLite crash recovery, actual local TLS fixtures, bounded concurrency, credential and frame revocation, event filtering and IPC. Independent review repaired cleanup when a foreign journal or incident record appears: retained files are preserved, SQLite locks are released and recovery remains unavailable until explicit owner action. These checks do not establish every physical failure or hostile filesystem race.

The application currently admits local schedules for language and theme. External source enrollment is empty by default; network provider support does not claim configured user services. Graphical scheduling controls and effective preference consumption remain separate active work. The original base preferences stay unchanged. Windows runtime testing remains deferred.

Canonical reconciliation is published at `ba7ea4b`: 107 feature identities, 398 requirement rows and 1,767 cross-contract edges. The independent review checked structure and selected semantic clauses, not every interpretation or runtime consumer. A later explanatory catalogue link changed its bytes; the two current digest bindings were refreshed without changing validators, historical evidence, requirement content or acceptance states.

Queue/recovery and official catalogue controls, scheduling consumers and interactive documentation updates continue with their existing owners. The earlier gallery and live website receipts below retain their original source bindings and need new captures/publication for these features. No broad roadmap phase is newly accepted.

After correcting the two current catalogue bindings, the full Node suite passed 425 tests with four skips: three opt-in official-source checks and the Windows PowerShell runtime check. This is one combined run of 429 discovered tests. The official-source paths retain their separate earlier focused receipts; skipped cases are not counted as passing this run.

## Reviewed scheduling, recovery and catalogue checkpoint, 2026-10-15

Personal-vocabulary controls and scoped owned-copy consumers are published at `1578869b7d59ba18ac8720085071516ccd10b4df`. Unknown shared-preference status suppresses substitutions. A failed cache deletion keeps substitutions inactive and mutations disabled until a full reload revalidates retained bytes; the GUI does not claim deletion succeeded. Settings search and palette routes focus the actual controls. Complete interface-copy and independent visitor/companion coverage remain open.

The scheduled-preferences core is published at `d13db21cf27cc5b35d8c7729433efda6a72c482a`. Twelve focused checks cover civil-time/DST rules, per-setting precedence, revoked external receipts, transactional storage contracts and revision-growth byte bounds. Real profile storage, privileged providers and graphical consumers are separate active work. Both Windows packaging and Pages workflows passed for these two source checkpoints.

This checkpoint connects durable independent-project build admission, bounded content intent and cleanup quarantine. Pending ownership is journaled before runtime effects. Unknown cleanup remains interrupted and blocks unsafe new admission across restart; explicit reconciliation requires renewed native authority, verified owned-runtime stop and fresh known capacity. Independent review repaired duplicate journal keys and a revoked-grant WSL startup race. A final synchronous pre-spawn abort check runs before acquiring locks so rejected startup cannot leave a permanent busy state. Real WSL/Docker runtime and Windows acceptance remain unverified.

The tools boundary now admits official Ollama catalogue status, refresh, paging and cancellation with a host-owned private cache. The historical official-source traversal observed 253 families and 7,492 tags; it explicitly remains non-exhaustive. Independent review repaired HTML attribute/raw-text handling, bounded cache-read races and the late-cancellation publication boundary. Exact metadata remains unknown where the source provides only display labels. Catalogue GUI controls remain separate integration work.

The combined host/source/execution/catalogue run passed 99 focused checks, including actual official Buildroot source capture. All 24 execution checks passed again after the final pre-spawn lock correction; do not relabel these as a complete application or native run. Full Node and renderer suites should run after the current GUI and profile-service units settle.

The 107-identity canonical mapping and cross-contract graph are under independent review. No broad roadmap phase is newly accepted. Astra continues shared-mode management and live English-only suppression; remaining queue/catalogue controls and schedule consumers follow their reviewed host contracts. Current gallery and live documentation receipts retain the earlier source bindings below and need regeneration for these new features.

## Current desktop and documentation implementation, 2026-10-15

The interactive documentation site is delivered at source `3de982211517bbeeb221cb540893bb3b3e4c06ff`. All 171 generated files matched the deployed bytes, and the public-origin Chromium run passed 14 interaction checks, 67 document routes, 12 responsive combinations and all 24 current gallery images. Pages is configured for `main` → `/docs`, and the repository About homepage matches the deployed URL. The [live delivery receipt](docs/evidence/interactive-guides/live-delivery.json) retains the exact input snapshot and distinguishes it from the build base commit. Later source changes require independent publication evidence.

The [current desktop gallery](docs/evidence/modern-workspace/README.md) retains 24 inspected renderer captures of twelve workflows at `e8f9bebf2b96397b00000be485870a61c16cb3e2`; the README uses twelve of these. [Historical originals](docs/evidence/ARCHIVE.md) remain separate. These are genuine Linux Chromium source previews: workspace storage and offline articles are real, native operations are typed fixtures. They are not packaged Windows acceptance. Both workflows passed for the later `275b5c25bb4e5e55f1029203d2e41ac98f8af547` backend checkpoint.

The reusable personal-vocabulary core and isolated caches are published at `d7f276d`. Independent review repaired buffer aliasing and retry after a synchronous IndexedDB opening failure; all 11 focused tests passed. Desktop controls and audited owned-copy consumers are being integrated using a dedicated IndexedDB cache in the private Electron profile. The cache is separate from workspace exports/history. Complete interface-copy coverage and independent visitor/companion consumers remain open.

This checkpoint adds a reviewed shared-mode host candidate and narrow desktop bridge. Twelve core tests and four IPC tests plus the existing preload check pass: live two-instance state/rename changes, credential verification, process lock contention, byte/identity conflicts, watcher failure, frame revocation and bounded state events. Same-revision external edits and failed lock initialization were repaired after independent review. The host chooses a common local protocol directory with protected credentials; explicitly isolated verification profiles use isolated mode storage. Existing-application/vault interoperability, Windows protected storage, passkey integration and complete GUI suppression remain unverified or incomplete.

The previous full Node run passed 315 tests with one platform-specific skip. The full renderer run initially found 24 stale settings heading selectors; those were repaired and all 29 settings checks passed, with the other 52 functional cases unchanged and passing in the earlier run. The gallery-only case is opt-in. These combined results are not relabelled as a single new full run. Windows runtime testing remains deferred by owner direction.

Host queue integration now uses bounded content intent, actual runtime resource observations and independent-project scheduling, but its active work adds durable quarantine for uncertain runtime cleanup before publication. Official Buildroot 2025.02.1 source was captured successfully, including template symlinks represented only by their link text. The Docker probe excludes only its verified artificial leaf quota while preserving observed parent constraints. No real WSL/Docker execution or native cleanup proof is claimed.

Continue on main with one owner per phase: Astra for desktop GUI, Sol for other implementation and Luna for the website. The 107-identity, 428-surface, 398-requirement roadmap remains incomplete. Active work includes shared-mode controls, remaining vocabulary consumers, runtime quarantine, official model discovery and full canonical-detail reconciliation. Never infer broad acceptance from module presence, fixture results or a green packaging workflow.

## Integrated workspace checkpoint, 2026-10-15

Source `7c14df34ffe785e2a7e108b17f839e15668d1183` is published on main. It connects typed converters/PDF and model queues, native session file grants, executable admission, local server execution consent, read-only HTTPS companion controls and source clone/ref/preview/apply/rollback transactions. Application shutdown waits for owned tool operations. The previous `d236e56` Windows release and Pages runs both succeeded; all five release assets were downloaded and verified. GitHub reports the release itself is not platform-enforced immutable.

Local checks passed 217 tests with one platform-specific skip. The 52-case renderer suite passed, including settings, actual workspace persistence and tools/companion fixtures. Nine reviewed source previews are retained in [the dated workspace gallery](docs/evidence/modern-workspace/README.md), with exact source/image hashes and explicit Linux/browser boundaries. A separate onboarding recapture waits for field transition completion. Native Windows, LAN/browser trust and actual WSL/Docker/guest acceptance remain deferred or unavailable, never passed.

The catalogue now has 107 identities, 428 surface records and 398 planned requirements. The two added identities are practical application onboarding and per-control information guidance. Detailed canonical reconciliation and broad phase acceptance remain open. Source-management GUI integration and final website generation/live readback are active; these records must be refreshed after their final changes.

## Current full-product implementation, 2026-10-15

The owner requested the complete roadmap, practical in-application onboarding, one phase owner per roadmap phase, main-only development and frequent pushes. Windows runtime testing is explicitly deferred. The backend checkpoint `725785f92a9082c144cdc3315c2826b77b1a38b9` passed its Windows packaging workflow and Pages deployment. New source extends the Material workspace with durable plans, onboarding progress, snapshots/import, native project adoption, jobs, configuration, artifacts, VM controls, local-model chat, updates and a regex workbench. Read [the current workspace article](docs/desktop/modern-workspace.md) and individual adapter articles for exact supported behavior and limitations. Earlier native evidence below remains historical and does not transfer to this renderer.

The local unit run passed 187 checks with one platform-specific check skipped. Browser suites passed 29 settings regressions and 17 workspace cases before final capture readiness repairs; final source-bound capture receipts are recorded separately. The integration audit caught and repaired configuration mutation during a running build, short-lived picker grants being reused as session authority, and missing durable project identities. Additional tools and companion integration remain active. No broad phase is marked complete from module presence, fixture results or deferred Windows acceptance.

## Confirmed language review and draft reset, 2026-10-15

The settings panel now identifies the last confirmed language and whether it came from the application default or device storage. A localized Discard choice action restores the pending selection without a host request, preserves confirmed state and returns keyboard focus to the select. Unknown outcomes, failed refresh, unavailable storage and pending saves keep the action disabled. Strict TypeScript and all 29 source-preview browser cases pass, including twelve language/theme/viewport tuples. Renderer SHA-256 is `122575c891c1c9c4e2a9d4a852d6b61a196b459faf598197ff52be0361623114`. Independent source review found no blocking issue.

This is a later renderer than the separately verified `v0.1.0-build.4.1` package. Its new packaged/native verification is pending; the earlier 25-case package result and five-asset audit below retain their original source binding. The owner continues to require frequent publication directly on main. Concurrent website changes were integrated without changing renderer source or discarding their records. See [the task evidence](docs/evidence/tasks/PH02-T02-C03.md).

## Website landing refresh, 2026-10-15

Live delivery completed at published source `5819290b661789737618c37049ca00708ad8334f`, built from `a8c71418c7ab75673bd4cb8c960d4b4c6cfc23e9`. Pages deployment [38692479628](https://github.com/Ding-Ding-Projects/material-buildroot/actions/runs/38692479628) succeeded; all 108 public files matched the reviewed bytes at 2026-10-15T06:36:31.873977+00:00. The final browser run passed all 71 routes, twelve responsive combinations and ten interaction groups, with five reviewed captures. See [the delivery receipt](https://github.com/Ding-Ding-Projects/material-buildroot/blob/main/website/evidence/landing-refresh/live-delivery.json). Later concurrent desktop records retain their independent source boundaries.

The website now leads with the immutable v0.1.0 Windows x64 download, a genuine desktop capture explicitly bound to historical source `3f5d2cd`, and separate available/planned capabilities. Bilingual copy and responsive cards lead to the complete documentation, verification records and contributor guidance. Search reports the full match count, supports keyboard entry and dismissal, and the mobile drawer follows the actual Material list Tab order. These changes do not implement desktop project creation, Buildroot execution or the authenticated companion.

The first website source checkpoint was integrated with concurrent desktop changes and verified on remote main at `703d960a7e32232f5cb80ac80df929f517373bf3`. Five documentation-source tests passed. The initial generated candidate passed 70 pages, 1,612 internal links/assets/fragments, ten browser interaction checks, all 70 routes and twelve width/language combinations; its exact source snapshot was `e724eb3d4c70ac0614557d3ac722bd171d241e8739b0c7a51f746fd9d920dafb`. Later spacing, drawer and merged documentation changes require their own rebuilt evidence. [The current landing browser receipt and captures](https://github.com/Ding-Ding-Projects/material-buildroot/tree/main/website/evidence/landing-refresh) record their own source and artifact hashes; do not transfer earlier proof to a later snapshot.

This session uses the Linux Node.js documentation generator with isolated output and Chromium. It does not claim a successful Windows root `build.bat` run, native application verification or installer acceptance. The browser verifier compares served artifact bytes against `DOCS_OUTPUT_ROOT` and writes exploratory evidence outside tracked source. Publication promotes only the generated website, preserving Markdown source. Hosting remains main → /docs; verify live delivery separately from source publication. No redundant task-owned branches, linked worktrees or stashes were created.

## Resumed renderer verification, 2026-10-15

The owner authorized resumption and repeated frequent publication on main. Capture readiness now includes exact property and rendered label text, nested Material content opacity of 1, and font readiness. All 12 presentation cases passed and independent inspection confirmed all selected labels visible. No renderer mutation was needed for the finite fade-in transition. Normal release `v0.1.0-build.4.1` and successful workflow `38690926331` bind exact source `299dca4d0d9413ef98ee249c172704a4d1732cc8`; all five downloaded asset sizes/digests and package manifests were verified. All 25 renderer tests also passed against its unchanged packaged assets with a synthetic bridge. Native Windows input, installation and IPC remain separate and unverified for this source. See [the current evidence record](docs/evidence/tasks/PH02-T02-C03.md).

## Frontend continuation, 2026-10-15

The owner requested continued frontend work directly on main with frequent published checkpoints. The current unit is PH02-T02-C03, settings lifecycle and navigation feedback in the existing production renderer. It adds explicit loading/saving/recovery states, draft retention and document-language synchronization after refresh, blocked submission after an unknown outcome or unavailable refresh, contained window-command failures and visible current-workspace navigation. Material Web does not forward arbitrary ARIA attributes to internal buttons; current navigation uses a supported accessible label and save feedback describes a native action group.

The initial Linux full-suite run exposed a pre-existing catalogue digest bound to CRLF bytes while the committed catalogue was LF. Checkpoint `40878b5f6bc9677d666905061e883b1a89f0c10c` pins the catalogue to LF and corrects only its digest. All 17 ledger tests then passed; the full local suite passed 62 tests with one Windows-only PowerShell check skipped. Strict TypeScript checking passed on Node.js 24.19.0. Raw-byte evidence validation remains unchanged.

Renderer verification uses Linux Chromium and a deliberately synthetic desktop bridge, preserving the production content-security policy. It does not prove packaged Windows IPC, native input, persistence, DPI, installer behavior or a new application capture. The portable `npm run test:renderer` suite passed 25 checks: 13 behavior cases and 12 language/theme/viewport tuples, including actual accessibility-tree names/descriptions and measured horizontal overflow. Seven of the first ten regression cases failed against the original renderer. See [the renderer evidence record](docs/evidence/tasks/PH02-T02-C03.md). One screenshot was taken before a Material select finished displaying its selected label; screenshot acceptance remains incomplete and those source previews are not published as current product captures. The owner then requested preservation and task-scoped cleanup before any further implementation. Current native evidence below retains its earlier source bindings; PH02-T02-C03 and broader parents remain open until their required proof exists.

## Verified first downloadable release

Latest observation: workflow [38682722692](https://github.com/Ding-Ding-Projects/material-buildroot/actions/runs/38682722692) completed successfully and created normal release `v0.1.0-build.1.1`, superseding its earlier running state below. The first manually verified `v0.1.0` download remains stable.

[Version 0.1.0: Classic Har Gow · 蝦餃](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0) is published as a normal, non-draft, non-prerelease release. Its exact tag source is `0881a3a3f58c85bf73f57035b3a09da3acbbe1a8`; all five uploaded assets matched local SHA-256 digests and sizes. [Setup.exe](https://github.com/Ding-Ding-Projects/material-buildroot/releases/download/v0.1.0/Setup.exe) is the genuine unsigned Squirrel.Windows installer. Unknown-publisher or SmartScreen warnings may appear.

The installed executable SHA-256 `b73e70f3338f965d7a1f6820beae31ccfcf8e0be4e16b5dcd922d5d89ea466bf` and archive SHA-256 `b37f6a251a71f60ab117ca27b58214b350499e8990104bf6dcb54aeac99be69b` matched the full package. A bounded installed launch reported version 0.1.0, the exact release source and ready storage, with native capture. Setup process exit code was unavailable. Signer-process auditing, update-pair proof and automatic updates remain unverified or unimplemented. Workflow [38682722692](https://github.com/Ding-Ding-Projects/material-buildroot/actions/runs/38682722692) was still running, so no successful automatic workflow verdict is claimed. Earlier preparation notes below are historical and superseded by this publication record.

## First downloadable release preparation and focused desktop acceptance

The owner additionally requested a real release because the Releases page was empty. The first unsigned Squirrel.Windows package and automatic publication route are prepared in source; actual build, installation and published-asset proof must be recorded separately. Version 0.1.0 remains an early desktop milestone, not a complete Buildroot manager. Read [the release procedure](docs/build/releases.md).

A further packaged pass against unchanged desktop source `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd` completed six keyboard/accessibility combinations: each of the three languages at 1440x960/light and 960x640/dark. Each accessibility tree had eight named interactive controls and no unnamed control. Native background Tab/Enter opened Settings, focused its heading, traversed controls and saved language. The smaller viewport used recorded CDP emulation because native hidden-window resize was unavailable.

Real stale-revision recovery retained the pending language, displayed review guidance and accepted the second Save. Actual document reload rejected old authority and admitted a fresh change; exact replay produced no duplicate event. Invalid and foreign SQLite fixtures displayed the unavailable-storage state with disabled Save and remained byte-identical after shutdown. All three product process trees, desktops and CDP ports were closed. New profiles and fixture originals remain intentionally preserved; no retained website profile was touched. Wall-clock expiry and native display-scale variation remain unrun. Private receipts are retained outside published source.

## Current bounded desktop GUI closeout, 2026-10-15 America/Toronto

The current task is the bounded desktop GUI milestone and its evidence/documentation delivery, not implementation of the remaining product backlog. Preserve the verified source bindings below. Continue nonblocked closeout work while recording the owner's skipped blockers explicitly. Independent acceptance review may add factual limits; this record does not pre-empt that review.

The documentation delivery is verified at published source `ae1951d18a29ea3ba5aab726cee20e896ad89cc2`, built from `53a37011c04e46536c882bc79dae751ff56f9757`. All 103 of 103 live files returned matching published-source and expected bytes at `2026-10-15T04:08:06.761198+00:00`. Deployment [38679631020](https://github.com/Ding-Ding-Projects/material-buildroot/actions/runs/38679631020) completed successfully. The exact homepage is https://ding-ding-projects.github.io/material-buildroot/, with `main` → `/docs` hosting and matching stored About URL. This is delivery proof for that revision; subsequent record edits require their own publication and must not inherit it.

The owner now directs continuation while skipping blocked tasks. Five temporary guest browser profiles remain retained. The strict audit still reports 0 accepted and 20 rejected receipts at `cleanup.completed`; the blocked removal and full strict-audit acceptance are explicitly skipped, not repaired, passed or waived into success. No deletion retry, alternate removal route or profile write is authorized by this continuation. All owned browser/server processes, desktops and task ports were closed. Native per-scale operating-system DPI proof remains unsupported and open; runtime/CDP scaling is not a substitute.

## Local checks and their separate source boundaries

The earlier `npm test` run passed 61 discovered tests with zero failures, cancellations or skips: broker contract 3, broker/storage 17, build tools 6, preload 1, desktop session 5, documentation source boundaries 3, evidence ledger 17 and operation parser 9. Subsequent CRLF parsing repair passed four focused documentation checks; later indexed-publication admission passed five focused documentation checks on pinned Node.js 24.22.0. The five-check result is a targeted later run, not a new full-suite result. No actual private-file publication occurred. Generated deployment paths preserve exact bytes through Git attributes.

The earlier root documentation build and 20-tuple browser observations remain bound to `2f24e10df6e8294d2bb00863f4d1222161669df0`: 69 HTML pages, 43 articles and 1,578 internal links/assets/fragments. Observed rendering, accessibility names, focus, console and resource checks passed in that bounded browser run; full strict audit acceptance remains skipped as stated above. The final delivery source and byte verification are separate evidence, not a relabelled browser run.

## Verified desktop shell and documentation evidence, 2026-10-14 America/Toronto

The current production executable is built from `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd`. Its root build-receipt SHA-256 is `21e9109880510ef4fde2b561e728195b7de0dd09bbeb0fdfa3ea01a415ea92d1`. The bounded shell has sandboxed preload/IPC, a genuine empty-project state, durable English/Cantonese/bilingual language settings and visibly session-only appearance. No project creation, Buildroot process, virtual-machine workflow, encrypted publication, installer or release is claimed.

Twenty-six focused host/preload/broker checks and strict renderer/shared type checking passed on the earlier `aa91c34f4588a0dae85faef169c4dcf542c307d0` candidate. The host/preload/session files were unchanged by the final renderer-only repairs. Six build-tool checks passed on the current source. The current settings matrix covered all 48 tuples (three languages, two themes, two viewports and four runtime scale factors). All 52 layout receipts passed, including four startups, without measured horizontal document overflow. Current matrix observation intervals recorded no console errors, unhandled exceptions or page errors. All three languages survived actual executable restarts. Dark foreground roles and cached translated theme labels were repaired before the final matrix.

Native minimize/restore/close behavior was exercised on the current source. Background Tab, event subscription/count/unsubscribe, malformed IPC and the earlier window-command checks belong to `aa91c34f4588a0dae85faef169c4dcf542c307d0`; they are not relabelled as a fresh current-source audit. See the [capture record](docs/evidence/desktop-shell/README.md). Native DPI 144 was observed. Runtime/CDP scale factors 1, 1.25, 1.5 and 2 do not prove native operating-system scaling at each factor; independent native 125% and 200% acceptance remains unverified. All owned product processes and hidden desktops ended.

Two inspected raw PNGs and a public-safe hash inventory are retained under `docs/evidence/desktop-shell/` and embedded in README. Historical synthetic reference images keep their original provenance. Private launch/capture manifests and machine paths remain outside the repository.

The documentation route is `build.bat --target documentation /s`, with isolated ignored output, indexed recursive article/wiki inventory, locally copied indexed assets and raw-byte source provenance. The delivered revision and 103-file verification are recorded above. Five focused documentation checks passed after the final publication-admission repair. The 20-tuple browser observations retain their earlier source binding, and strict cleanup acceptance remains explicitly skipped with all five guest profiles retained.

Project 53 is linked to this repository. Issue 1 remains In Progress for the wider objective, and discussion 2 is the rolling progress record. External final delivery evidence belongs on issue 1. Status Hub health is reachable, but no trusted ingest credential is available. The separate GitHub wiki repository returned Repository not found; existing `docs/wiki/` articles are rendered in the verified static delivery, without claiming separate wiki synchronization.

Full shared feature coverage, project operations, execution adapters, VM acceptance, encrypted transport, companion, installer/update/release and fresh-host proof remain open. Keep one tracked-source writer and preserve existing output/profile data. Earlier dated records below are historical and do not supersede this milestone.

## Requested preservation closeout, 2026-10-15

The owner requested preservation and cleanup before further implementation. The encrypted-publication admission lane stopped before creating any files; that entire slice remains unimplemented. Completed settings work is pushed and verified at a4926c2c70afd1d118f2a46b572ee42cafd0f760. No source work remains uncommitted.

The product repository has one primary checkout, one local main branch, remote main and no stashes. No redundant task-owned branch or linked checkout exists, so no destructive cleanup is needed and no deletion/archive pass was started. Four isolated capture profiles remain after automatic approval review rejected deletion with the reason blocked by policy. Source history recovery, original reference captures and every generated private announcement variant are retained; none is silently discarded or published. Unrelated repository work remains outside this cleanup inventory.

Verified units remain separate: 17 evidence-ledger tests, six build-tool tests, nine request-parser tests and 20 broker/translation tests, with strict request and broker type checks. The focused reference verification binds source 9352fe63f34e06057fb865231294674afb72f136, not the later broker commit. It is synthetic reference evidence and does not prove the installed product.

Resume on main with one source writer. Next: implement and independently verify explicit private-publication consent admission, then the reviewed generic encrypted engine with authenticated source/body, fixed transport, exclusive builder, scoped secrets, private-only outputs and separately authorized refresh. Do not enable encrypted behavior merely because a private repository is selected. Both managed Linux Buildroot execution and Windows product delivery remain unimplemented. Production IPC/shell, project actions, full canonical admission, complete shared features, runtime/VM acceptance, installer/update/release and current documentation regeneration/delivery remain open.


## Durable settings admission and focused reference verification, 2026-10-15

The data-only settings broker now binds capabilities to principal, project, action and monotonic expiry. Settings, revision, accepted-operation identity and sequenced event timestamp commit together. Exact retries recover the accepted result after authorized regrant; changed content conflicts. The strict internal/public translator is typed and runtime-validated. Twenty focused tests pass on pinned Node.js 24.22.0, and the strict TypeScript contract check passes.

Independent storage review reproduced two defects in the initial candidate: adopting an unrelated version-1 database and changing a foreign WAL database before rejecting it. The repaired pre-open header and read-only exact-schema admission preserves both fixtures byte-for-byte, including persistent journal mode. Independent correctness and storage reruns reached no remaining candidate within those bounded seams. See [broker admission](docs/security/broker-admission.md). This is not production IPC, native filesystem authority, project creation, process execution, migration or abrupt-process recovery.

The focused reference rerun is bound to source 9352fe63f34e06057fb865231294674afb72f136 and build receipt SHA-256 7e4417c2ff516153f7f06863666e94c9c9a7f7143efeee8590234dcb19b3c70b. It retained 15 interaction captures and 54 matrix captures, plus one whole-window capture. A changed jobs value creates a distinct project; an identical retry reuses it. Accessible follow-control names passed in six states, and review-checkbox names passed all 48 language/theme/viewport/device-scale tuples. Those 54 matrix cases recorded zero unnamed-control, body-overflow or relevant console/network observations. These remain synthetic design references, not production screenshots. Browser device scale is not native Windows display scaling or browser zoom.

All owned browsers, servers and hidden desktops ended. Four isolated profiles remain because automatic approval review rejected scoped deletion with the reason blocked by policy. No alternate deletion route was attempted. Raw captures remain private and were not promoted to production evidence. Full reference interaction/accessibility/typography acceptance, installed runtime, installer and fresh-host verification remain open.

Current online documentation still reflects the initial 9c8fe848ff7abb1c11fd3d5014fc0ebfa8c60f1a deployment. The newer articles need a recursive isolated-output documentation build, source-bound verification and actual delivery. The approved encrypted transport remains off and unimplemented; its next admission slice must bind explicit push consent and live private-repository verification independently from optional refresh authorization.

## Earlier checkpoints (historical)


## Request admission and built-reference findings, 2026-10-15

The serialized-operation parser and exact action union are implemented, with nine focused tests passing on pinned Node.js 24.22.0. Independent review reproduced numeric precision loss in the first candidate; the repaired original-lexeme check now rejects fractions, exponent notation, underflow and negative zero. The independent rerun reached no remaining parser finding. This admits request data only; caller authentication, capabilities, revisions, durable idempotency, IPC and effects remain unwired.

The original built matrix is complete: 222 page captures (30 declared states plus 48 browser tuples for each of four representative workspaces), zero body-overflow observations, zero relevant console/network observations, and 55 observations of the two unnamed controls. Device scale factor is not native Windows scaling. Owned browsers, servers and hidden desktops ended. Three isolated profiles remain because automatic approval review rejected their scoped deletion. Raw evidence is retained privately and has not been promoted as public screenshots.

The actual reference build from e16fa45fc73d24480b80c4db2eab695bcbe57b2d succeeded with receipt SHA-256 99a6b5a5d9b5da35b0cc23b5986f6302d7d296e01d1f3c0ac7e59f23433cec0f. Built checks confirmed component registration and five repaired flows, but disproved the earlier claim that all six repairs reached source: creation identity still omitted jobs. The corrected source now includes the full draft, with readback. The built accessibility tree also exposed unnamed follow/review controls; explicit localized names are now authored. Those three source corrections need a new build and focused runtime rerun. The ongoing original matrix remains bound to e16fa45 and is not proof for this newer source.


## Build and reference source checkpoint, 2026-10-15

Root build, installer and dependency entrypoints now share a pinned manifest, complete portable-tree verification, exclusive producer ownership, source/index binding and output receipts/recovery. Cold acquisition obtained Node.js 24.22.0 and MinGit 2.56.0.2 and installed 311 locked npm packages. Six build-tool tests pass, including real PowerShell 5.1 activation/recovery and real junction rejection. The existing 17 ledger tests remain a separate admission result.

Thirty executable reference states are authored. Independent review identified six simulated interaction defects, now repaired in source: attempt-scoped cancellation, exact YAML draft/save identity, terminal dialog focus, complete creation identity, paused admission and named table scrolling. Built interactions and the 48-tuple geometry matrix remain unverified. Next: commit the immutable source candidate, invoke the exact root reference build and independently inspect its real output. Desktop source, installer, fresh-host proof and full PH00-PH10 acceptance remain incomplete.

The scoped history repair is verified on main at 62b5cad1142a088ff948f2042d1dd18041acbe72 with parent 74275645a032fca98ce51ecb6e47d057e65960a7. Source bytes were preserved. Prior clones and provider caches are outside that verification.


## Admission expansion checkpoint

The ledger contains 386 bounded planned subrequirements and 420 separate planned surface admissions. Seventeen local focused tests pass, including independent obligation inventory, bounded planned paths, malformed rows and exact desktop tuple axes. The representative version-1 request schema documents strict fields, bounded input, idempotency and interruption recovery, but no broker parser or transactional execution is implemented. Full linked-section reconciliation and concrete consumer admission remain open. Product runtime, installer and release acceptance remain unverified.


## Implementation checkpoint, 2026-10-14

Implementation is authorized and underway on main. P40-P42 are resolved, with all proposed cloud destinations, SSH host families and flashing/install routes approved. Managed GitHub Actions execution, product delivery and conditional private-repository encrypted publication are added to the decision log and stable roadmap children.

The first implemented unit is the 105-identity, 420-surface admission ledger and local validator. Ten focused tests pass, including actual Windows junction escape rejection, exact surface-map keys, traversal, missing/stale proof and restored fixtures. This proves structural admission only. Full canonical reconciliation, concrete consumers, semantic evidence, desktop runtime and every remaining phase stay open. See [PH01 evidence](docs/evidence/tasks/PH01-contracts.md).

The initial documentation website is deployed from source 9c8fe848ff7abb1c11fd3d5014fc0ebfa8c60f1a. All 46 HTML routes and 62 static files returned HTTP 200 and matched that commit's exact Git blob bytes. The repository homepage was set to the deployed home URL and read back. This is HTTP/source delivery proof, separate from previous local browser evidence. See [hosting receipt](docs/evidence/hosting/initial-live.json). New source documentation still needs regeneration and deployment before it is current online.

Discussions are enabled and the [rolling implementation discussion](https://github.com/Ding-Ding-Projects/material-buildroot/discussions/2) exists. Projects access lacks read:project; no project-board mutation is claimed. Status Hub health is reachable, but no trusted ingest credential was available in this session's configured environment, so no status-session delivery is claimed.

Native readiness: WSL is not installed; the selected Docker Linux engine is unavailable. VMware Workstation was discovered, but guest acceptance has not run. VirtualBox was not found in inspected standard locations. No product build, installer or release is verified.

Next eligible work is PH01-T01-C02 and PH01-T02-C02: detailed contract reconciliation and concrete consumer/evidence admission. The design proposal retains 1440x960 normal and 960x640 minimum. Keep one source writer at a time and do not resume historical linked worktrees.

Earlier records below are historical planning observations; this checkpoint supersedes their current-session and hosting blockers.

## Current objective

Plan a Windows desktop Buildroot application with complete Material Design 3 controls, WSL and Docker execution, the full shared feature baseline and a GitHub Pages documentation companion. The owner authorized the initial documentation website now. Desktop application and authenticated companion implementation remain reserved for the next development session.

## Verification

The initial documentation website is built with genuine registered Material Web controls, phone-friendly layouts and separate categorized pages. A short overview leads to four roadmap categories, individual phase checklists, four documentation categories, articles/wiki and a separate downloads/status page. Local generated-site and browser checks passed; exact current artifacts and limitations are in [the evidence record](docs/evidence/planning-site.md). The checklist has 11 phases, 77 stable tasks and 105 mapped feature identities.

PH00-T01 through T04 and T06 are locally verified or completed records. PH00-T05 remains unchecked because GitHub denied Pages activation. The first application task for the next session is PH01-T01. Each task is implemented and verified before its checkbox is ticked; missing evidence stays open.

A minimal application scaffold predates the planning clarification. No application build, native runtime, installer, guest boot or product release verification has completed.

## Working policy

Work on `main` only and publish planning checkpoints frequently. Preserve existing work. Read [PLAN.md](PLAN.md) and [DECISIONS.md](DECISIONS.md) before implementation, and resolve pending owner answers rather than guessing.

## Implementation handoff

- [Design and 40-screen state inventory](design/README.md).
- [Typed architecture, source/configuration concurrency, VM ownership and companion security](docs/planning/architecture.md).
- [105 individually identified feature obligations](docs/planning/feature-coverage.md), each unverified for production.
- [Official-source Buildroot/runtime constraints](docs/planning/buildroot-constraints.md); recheck current versions before pinning.
- [Repository issue handoff](https://github.com/Ding-Ding-Projects/material-buildroot/issues/1).
- [Next-session operating prompt](NEXT_SESSION.md).

The complete specified application, all shared features, public website and authenticated LAN companion remain in scope. Internal sequencing never waives unfinished rows. Interactive rich controls and appropriate canvas editors are explicit requirements.

## External-state evidence

Source publication to `main` works. Pages creation with `main` → `/docs` returned HTTP 403 `Resource not accessible by integration`; no live website is claimed. Enabling Discussions also returned 403; no Discussion was created. Native Windows host access, exact newest-stable Windows/VMware/VirtualBox versions and installer/runtime capability remain unverified. Source wiki content exists and renders locally; GitHub's separate wiki service was not accessible as an initialized repository.

## Earlier isolation artifacts

Three linked planning/implementation lanes were created before the owner required main-only work. No backend or frontend implementation was written there. Their work must not resume. Early design drafts are retained as historical planning inputs, superseded by the primary `design/` documents. Main is the sole active source branch.

## Publication dependency

Public target: `Ding-Ding-Projects/material-buildroot`, provided by the repository owner. The generated site is prepared in `docs/` for Pages branch publishing from `main` → `/docs`, with `.nojekyll`. Owner settings access is needed to activate this route. Verify actual live routes/assets and the exact About homepage before checking PH00-T05. The intended home URL is `https://ding-ding-projects.github.io/material-buildroot/`.

## Installer startup repair, 2026-10-17

Repair preserved in c7d132d: removed duplicated source inside component-discovery enablement regex and added prepackaging syntax validation. Configuration checks: 12 passed, 3 skipped; dedicated discovery regression: 1 passed. Initial installer attempt stopped on a stale maintainer-local currency lock after verified tool acquisition, before packaging. Replacement installer and installed launch remain pending. Docker server 29.8.2 responds; WSL lists docker-desktop. No separate Buildroot distribution is verified.
