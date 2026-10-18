# Buildroot 2025.02 manual and source-topic coverage

This finite PH01-T02-C02 inventory reads the actual selected Buildroot manual and related package/Make source. It does not execute source, render AsciiDoc, call a native runtime or change the source/output trees. Existing lexical and native Kconfig identities are preserved in their separate inventories.

## Exact inventory

The [index](manual-2025.02/index.json) binds 91 exact source files: all 73 `.adoc` articles in `docs/manual`, the source Makefile and 17 package-infrastructure makefiles. It also binds concrete candidate renderer/backend/help files and the inventory producer. Version is read from the selected Makefile as 2025.02; content hashes do not independently authenticate its upstream revision. No machine paths are stored.

| Record category | Count | Meaning |
| --- | ---: | --- |
| Manual articles | 73 | Every selected `.adoc` file, including files not reachable from the root include graph |
| Explicit anchors | 119 | Lexical `[[id]]` and block-position `[#id]` candidates, including examples requiring review; ordinary URL fragment labels are excluded |
| Headings | 226 | Source heading text and depth; automatic rendered anchor IDs remain unverified |
| List/admonition topics | 712 | Individual list entries and NOTE/WARNING/IMPORTANT/TIP/CAUTION candidates |
| Table rows | 56 | Source table-row candidates |
| Table cells | 91 | Individual small fields and values, without claiming complete table rendering |
| Identifier candidates | 895 | Uppercase source-document identifiers and acronyms, with all article occurrences and matching package/Make references |
| Include edges | 73 | Literal include target and attributes, with dynamic/available state |
| Total | 2,245 | Lexical planning records, not accepted capabilities |

Twenty-three content-hashed detail shards contain at most 100 records each. Stable identities use the relative article path and explicit anchor/title/identifier, or the content fingerprint for an unnamed topic/table row. Repeated definitions retain an occurrence suffix. Source line numbers are separate evidence. Renamed content and reordered identical repeated definitions require review; previous inventory identities are never silently rewritten by this separate inventory.

Whole-article hashes bind small prose details that are not extracted as individual records. The tool does not claim that extracting an acronym proves a configurable field, or that a list item captures every condition from following paragraphs. AsciiDoc commands/macros, conditionals, include expansion, implicit HTML anchors and multiline table semantics remain explicitly unexecuted. Existing manual text can contain documented example paths and ordinary technical words; those are public source quotations, not resolved local configuration.

## Concrete workflow and Easy-mode mapping

Every record carries separate GUI, Easy-mode, contextual-help and runtime states. Topic routing is explicitly provisional. It names actual candidate paths, not implementation acceptance. Unmatched topics, including upstream contribution/release processes, receive an explicit unadmitted-workflow gap instead of being assigned an imaginary control or automatically added to product scope.

| Topic family | Candidate implementation and help | Actionable gap |
| --- | --- | --- |
| Package infrastructures, download methods, patches and fields | `package-panel.ts`, `package-discovery-panel.ts`, `package-authoring.cjs`, `package-discovery.cjs`; `docs/features/packages/package-authoring.md` | Admit each field/infrastructure separately. `SITE_METHOD`, `EXTRA_DOWNLOADS`, staging, SELinux, CPE, redistribution and account/device/permission fields remain explicit dedicated-workflow gaps. Preserve unsupported recipe content. |
| Configuration and external trees | `configuration-panel.ts`, `defconfig-panel.ts`, configuration/defconfig services; configuration and Kconfig-semantics articles | Discover types, current values, choices, defaults and visibility/dependency reasons from the selected source. A visible option or generic textbox does not prove the detailed workflow. |
| Runtime, target, rebuild, cache and debugging topics | `wsl-runtime-panel.ts`, `build-queue-panel.ts`, execution and scheduler services; execution/package-target articles | Discover admitted targets, prerequisites and current results; explain destructive effects, resource limits and recovery. Lexical Make references never authorize command execution. |
| Root filesystem, user/device/permission tables, boards and post-image topics | `image-presets-panel.ts`, image/account services; ISO workflow/production articles | Add structured fields for exact manual concepts, source-specific validation and explanations; current accepted ISO profile does not cover general board customization. |
| Source acquisition and migration | `source-panel.ts`, source service; source-lifecycle article | Discover selected source/ref and revision, preserve existing state and explain upgrade compatibility. |
| SDK/toolchain use | `sdk-export-panel.ts`, SDK export service; SDK article | Independently admit toolchain consumption, environment/setup and actual consumer build evidence. |
| Legal/provenance topics | Build queue and reproducibility service; reproducibility article | Separate declarative license/SBOM output from compliance promises; manual notice details remain unaccepted. |

All Easy-mode records remain missing until implemented and verified. They specify a plain-language question, discovery/prefill work, labeled control choice, source-specific recommended-default boundary and validation/help obligations. Existing values or actual source defaults must be discovered before prefill. Icon dropdowns require real available choices and text labels, not invented menus.

Small account-table fields have individual records and tailored guidance: username collision discovery, automatic versus explicit UID/GID selection, protected authentication controls, target home paths, installed-shell discovery and supplementary-group selection. Passwords are never prefilled or printed. The exact source sentinel and its interactions require source-specific validation rather than a universal hard-coded recommendation.

Related help articles are candidates only. Each exact topic still needs purpose, default, useful examples, architecture/dependency restrictions, permission/security effects, failure/recovery and interactions explained in context. Source help, a title or a catalog entry never substitutes for that workflow.

## Negative completeness proof

The generator has a hand-written category list and required core article list. Against the actual source, it removes one record from every category, observes rejection and accepts the restored inventory. Exact identities and outcomes are stored in `completenessProof`.

The eleven focused coverage tests retain the earlier source-inventory checks and add manual fixtures. They remove every fixture detail and every category, change an otherwise unextracted prose paragraph, alter a GUI disposition and corrupt a shard. Each relevant omission/change is rejected. Ordinary URL fragment labels are not mistaken for block anchors. Unchanged shards with ordinary checkout CRLF conversion still pass. The restored source-derived inventory passes `--check`.

## Source and application path containment

An independent review confirmed that checking only a final file's `lstat` allowed a linked `docs/manual` or `package` ancestor to admit outside text. The repair rejects aliased selected roots and every symbolic-link/junction component before enumeration or file access. Every component's resolved path must match the selected spelling (case-insensitively on Windows) and remain inside the selected root. Application renderer/backend/help candidates use the same checks, rather than trusting the application-root parameter.

File reads open a descriptor with no-follow behavior where supported, compare its identity before reading and again afterward, and revalidate the checked component chain. Directory enumeration checks and revalidates its component chain. A changed or aliased path rejects the inventory instead of emitting partial source records. This is not a claim of an atomic filesystem snapshot against arbitrary concurrent host mutation.

Harmless negative fixtures cover selected source/application root aliases, linked manual/package parents and linked application `src`/`docs` parents. Outside payloads contain only a known public marker. The tests assert rejection before outside file opens or directory enumeration, then restore normal paths and observe a passing inventory. No real private outside data is read. The generated producer binding was refreshed after this repair; the earlier parent-link-admitting candidate is not accepted output.

```text
node scripts/buildroot-coverage/manual-inventory.cjs --source <selected-source> --output docs/planning/buildroot-coverage/manual-2025.02
node scripts/buildroot-coverage/manual-inventory.cjs --source <selected-source> --output docs/planning/buildroot-coverage/manual-2025.02 --check
node --test tests/buildroot-coverage.test.cjs
```

This is one-version documentation/source coverage. Native parser graph proof, production, boot, installed application behavior, source trust and Easy-mode acceptance remain separate. The [coverage index](README.md) links the actual ISO production/boot and native-parser evidence with their bounded verdicts.
