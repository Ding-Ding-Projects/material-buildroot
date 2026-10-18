# Source-derived Buildroot coverage

This inventory makes concrete Buildroot details actionable before broader product acceptance. It supplements PH01-T02-C02 and does not replace the roadmap, the feature ledger or runtime evidence.

The later [native Kconfig milestone](native-kconfig.md) adds all 11,464 definition nodes returned by the current parser invocation, including hidden nodes and repeated definitions, with source locations and complete available per-definition semantics. It is separate from the lexical inventory below and retains its own native/configuration and GUI acceptance boundaries.

The retained `2025.02.json` snapshot contains 992 details from 168 content-hashed source files: 157 filesystem options, 309 bootloader options, 144 documented package fields, 16 package-infrastructure topics, 351 lexical make-rule candidates and 15 application parser capabilities. The selected source declares Buildroot 2025.02. The declared revision `aa2d7ca53f704af901f6c33c13e4bb1591886700` comes from the existing runtime smoke record; this generator does not independently establish repository ancestry or verify a tarball against that revision. Its reproducible content binding is the hash of the listed file paths, hashes and byte counts.

## Reproduce and check

Run from the application repository root, supplying the actual selected source directory. No source directory is stored in the output.

```text
node scripts/buildroot-coverage/inventory.cjs --source <source-directory> --source-revision <recorded-revision> --output docs/planning/buildroot-coverage/2025.02.json
node scripts/buildroot-coverage/inventory.cjs --source <source-directory> --source-revision <recorded-revision> --output docs/planning/buildroot-coverage/2025.02.json --check
node --test tests/buildroot-coverage.test.cjs
```

The check regenerates expected details from actual source, checks every hand-written category, checks individual IDs, validates referenced application files and rejects optimistic edited dispositions, stripped semantics and source drift. IDs use semantic names and relative source paths, with a definition ordinal for repeated definitions. Line numbers remain separate evidence and do not change IDs after unrelated line insertion. Renaming or reordering repeated definitions requires explicit inventory review.

Every detail has a relative source path and line, source hash, raw semantics or source occurrences, candidate GUI consumers, separate GUI/Easy-mode/help/runtime states and existing roadmap owners. These references identify candidate implementations; they do not establish that each detail is usable. All runtime states are unverified. An Easy-mode record is an implementation requirement, not evidence that the control exists. Questions and suggested control types are reviewable planning copy, not shipped copy.

## Deliberate boundaries

- Filesystem and bootloader declarations are lexically extracted from `Config.in` files. Their raw blocks preserve defaults, restrictions and help, but multiline expressions are not fully evaluated. Hidden choices, menus, include reachability, repeated symbol semantics, select/imply resolution and all package Kconfig symbols need a native parser-derived graph and independent comparison.
- Package fields are extracted from documented `FOO_` and `LIBFOO_` examples. Other prefixes, dynamically generated variables and complete infrastructure semantics are not exhaustively enumerated. Infrastructure entries are documentation topics, not proof that their build implementation works.
- Make targets are lexical candidates from selected top-level, support, filesystem and package-infrastructure makefiles. Pattern rules, make expansion, conditionals and other included makefiles need native admission. A candidate is not a renderer-authorized command. Existing validated target boundaries remain intact.
- Symbolic links are not followed. The retained Windows source transfer could not preserve every Linux link. Native Linux/WSL source verification is still required before full-tree or complete-image claims.
- This is one source version. Another version, external tree, architecture or component source needs its own inventory and effective-state evidence. The adapter does not claim complete Kconfig parsing or all-version compatibility.
- No GUI interaction, image production, boot, installation, runtime resource limits, accessibility or localization acceptance follows from this inventory.

## Finite next wave

| Priority | Source detail and actual gap | Easy-mode work and contextual help | Existing owner |
| --- | --- | --- | --- |
| 1 | ISO9660 options in `fs/iso9660/Config.in`; current export copies an existing ISO rather than producing a bootable image | Discover architecture/kernel/bootloader eligibility, prefill boot menu and initrd choices, explain read-only optical root versus RAM root, compression and hybrid restrictions; bind requested/effective config and actual output | PH06-T01/T02, PH07-T02/T04 |
| 2 | GRUB platform, modules, boot partition and PC/EFI configuration in `boot/grub2/Config.in` | Offer eligible labeled platform choices, discover module/config inputs and explain CD-root settings; verify BIOS and EFI separately | PH06-T03, PH07-T01/T04 |
| 3 | Package variables such as `SITE_METHOD`, `INSTALL_STAGING`, `USERS`, `DEVICES` and `PERMISSIONS` have no admitted dedicated typed authoring workflow | Source-method dropdown with matching revision/location fields, staging explanation, structured account/device/permission tables and collision checks; preserve unknown recipe fields | PH06-T05 |
| 4 | Source make-rule candidates exceed the fixed execution list and package actions are source-discovered rather than configuration-verified | Discover target availability and actual prerequisites, explain destructive effects, retain validated typed operations; never execute arbitrary discovered text | PH06-T06, PH05-T06 |
| 5 | Parser emits effective graph details but no complete source-location/select-imply/requested-value inventory | Native graph inventory with stable definition identities; hidden-choice explanations, dependency reason paths and requested/effective differences; prove individual omission rejection | PH06-T01/T02, PH01-T05 |

The focused tests use a small explicit source fixture and witness each omission rejection before the restored inventory passes. They do not execute Buildroot. The current real snapshot must also pass `--check` against its retained source before integration. Current source-bound execution evidence remains the separate `docs/evidence/startup-repair/runtime-smoke.json` record, limited to `olddefconfig` and `show-info`.
