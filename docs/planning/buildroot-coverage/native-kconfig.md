# Native Kconfig definition inventory

This PH01-T02-C02 milestone inventories the actual top-level Buildroot 2025.02 graph using the existing application adapter and its vendored Kconfiglib 14.1.0. It does not modify the production adapter, renderer, Buildroot source or existing build configuration. It supplements the earlier lexical filesystem/bootloader inventory with all definitions returned by this parser invocation, including hidden nodes and repeated definitions.

## Bound result

The snapshot is stored in [native-2025.02/index.json](native-2025.02/index.json) and its 58 content-hashed node shards. Each shard holds at most 200 definitions. The index binds 3,367 parsed source or virtual include files, the selected configuration, Makefile, vendored parser, existing adapter and inventory producer. Generated external includes are explicitly labeled virtual and hashed from their actual synthesized bytes.

| Measure | Observed count |
| --- | ---: |
| All definition nodes, excluding the synthetic top-level node | 11,464 |
| Symbol definitions | 9,117 |
| Unique defined symbols | 8,971 |
| Choice definitions and unique choices | 165 |
| Menus | 102 |
| Comments | 2,080 |
| Nodes currently invisible or without prompts | 8,299 |
| Promptless nodes | 832 |

Enumeration uses `conf.node_iter(unique_syms=False)`, without filtering visibility or deduplicating symbol names. Its symbol and choice definition counts are independently checked against the sum of `nodes` on `unique_defined_syms` and `unique_choices`. Thus a symbol defined at two source locations retains two records. Source locations carry path and line independently of semantic IDs; repeated definitions receive an occurrence suffix. Identical-location ordering changes still require review.

Each node includes its parent identity, prompt and condition, help, dependency, defaults, ranges, source select/imply edges, current visibility and promptless state. Symbols and choices additionally include original/effective type, requested/user value, effective value and assignable values. Choices retain requested/effective selections. Requested and effective values are parser results for the selected `.config`, not proof of a native `conf` reconciliation or successful build.

The inspected configuration SHA-256 is `0e33a58b7dfbe2099d0cc6027f18dbce99650168936ce56cb5f71934137db51f`, matching the separately retained ISO production configuration. Version, host architecture and GCC-version inputs are recorded. The producer checks configuration bytes and initial source configuration-file hashes again after inspection. It writes only inventory files outside the source and build-output trees. This does not claim a complete filesystem before/after audit of arbitrary source-provided command effects.

## Completeness checks and limitations

The real-source run deliberately removed one symbol, choice, menu, comment and hidden node. Each omission was rejected and the restored inventory passed; exact selected identities are stored in `completenessProof`. Five focused Python fixture tests additionally remove every fixture node and each required semantic field, reject optimistic GUI acceptance, preserve hidden/repeated definitions and check requested/effective values, ranges, defaults, select/imply edges and checkout-newline normalization. Generated shard and application-code hashes normalize CRLF to LF, so a normal Windows checkout does not invalidate unchanged planning content. Linux source and configuration hashes retain exact bytes.

Aggregate reverse-dependency expression text is explicitly unavailable. Formatting a real aggregate exceeded the vendored formatter's recursive depth during the first implementation attempts. Per-definition `select` and `imply` edges are retained without truncation. The production parser is unchanged. Optional help attributes on non-symbol nodes are handled as absent rather than inventing text.

This establishes complete enumeration of this invocation's MenuNodes, not exhaustive native Kconfig parity. It does not establish other Buildroot versions, other configurations, external trees, separately downloaded Linux/BusyBox/U-Boot graphs, every environment, native `conf` results, GUI interaction or Easy-mode acceptance. No external trees were selected. Definitions in unparsed files do not become covered by inference.

Existing parser external-include synthesis remains part of the evidence boundary. The graph is generated on the preserved non-root Linux source, avoiding the known incomplete Windows link transfer. The parser's trusted-runtime route can evaluate source-provided Kconfig commands; it is not a Python sandbox and must be used only with the explicitly admitted source. The helper requires non-root Linux and uses no build or reconciliation target.

Protected symbol values and defaults are withheld by name category, and local paths are normalized before output. The snapshot carries no raw `.config`, credentials or resolved machine paths. This is a bounded defensive filter, not permission to publish arbitrary configuration files; review newly added source and configuration inputs before retaining their output.

## GUI and Easy-mode disposition

Every definition has independent `gui`, `easyMode` and `runtime` planning state. The generic current configuration consumer is named but remains partial. Easy-mode interpretation remains missing and actual interaction remains unverified. Source help and a copied prompt do not establish child-friendly contextual help. The next implementation must transform these records into appropriate labeled controls, source-derived defaults and available icon dropdowns, explain hidden prerequisites and architecture restrictions, preserve requested/effective differences, and prove behavior independently.

The existing roadmap owners remain PH06-T01, PH06-T02 and PH01-T02-C02. Component graphs belong to PH06-T03. This inventory does not tick their parent tasks.

## Reproduce

Use the selected supported non-root Linux environment and the existing source/output. Supply paths locally; no host-specific path belongs in the retained command template.

```text
python3 -B scripts/buildroot-coverage/native_kconfig.py --source <selected-linux-source> --build-output <existing-output> --adapter <application-root>/scripts/configuration --destination <application-root>/docs/planning/buildroot-coverage/native-2025.02
python3 -B scripts/buildroot-coverage/native_kconfig.py --source <selected-linux-source> --build-output <existing-output> --adapter <application-root>/scripts/configuration --destination <application-root>/docs/planning/buildroot-coverage/native-2025.02 --check
python3 -B scripts/buildroot-coverage/test_native_kconfig.py
```

`--check` regenerates the graph, verifies every shard hash, checks node/category completeness and compares every bound semantic field and disposition. A changed configuration, source, parser, adapter or producer invalidates the snapshot. It performs no build and never writes to the selected source or existing output.
