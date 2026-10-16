# Concrete implementation admission

The [phase registry](implementation-admission.json) binds existing architecture consumers, focused tests and documentation to SHA-256 file contents. It complements the 109-identity, 436-surface feature ledger; it does not replace independent acceptance or complete reconciliation.

## Surface consumer dispositions

The surfaceConsumerAdmission section records PH01-T02-C02 separately from historical phase snapshots. It preserves every identity, surface and child work ID from feature-evidence.json, without modifying that ledger or promoting any evidence state. Each record explicitly identifies an existing bounded source mapping awaiting independent admission or an uninspected surface awaiting consumer mapping. Uninspected never means absent. Planned paths are never treated as existing consumers.

Existing bounded mappings cover desktop controls/services, public visitor controls and documentation, browser companion controls, and repository documentation/build/release producers. Their source hashes identify the baseline bytes only. A mapped module does not establish complete behavior, all destinations, localization, persistence, test execution, runtime delivery or capture acceptance. Other surfaces remain explicitly uninspected and pending; this inventory makes no absence claim for them. Later work must add the actual feature-specific consumer, complete localized article and copy bindings, persistence behavior, focused and negative test bindings, and the exact runtime/capture receipts before independent admission.

Every surface retains independentlyAdmitted: false and accepted: false. Runtime requirements reference the unchanged ledger record by child work ID; null receipts mean no evidence was admitted. Shared modules are never copied across surfaces as proof of independent delivery. The source revision describes the mapping baseline, not a build or execution receipt. Concurrent source changes require explicit rebinding of affected snapshots after inspection.

## Historical phase snapshots

Each phase states its behavior, authority boundary, persistence contract and remaining acceptance gap. Planned phases reserve behavior only and have no implementation consumers or tests. Authored records identify files without claiming execution. Tested records require a dated environment-specific receipt, output file, source revision, build hash and complete bindings. All phases retain accepted: false. Existing phase revisions and receipts are preserved independently from the new surface inventory.

The existing validator, scripts/evidence/admit-implementation.cjs, validates phase snapshots only. It does not currently enforce the new surfaceConsumerAdmission section. Independent structural validation of that section remains pending; its data is not an executable admission gate. No tests, reviews, static analysis or runtime captures were run for this authoring pass.

The validator cannot establish that a command executed, that a build hash corresponds to an executable, or that captures demonstrate requested behavior. Synthetic fixtures remain validator checks, never application evidence. Windows acceptance remains unverified. Planning forms, empty adapters, documentation and registry entries never establish build execution, conversion or authenticated companion delivery.

## Complete record processing and remaining admission

All 109 identities and 436 surface records have now been processed against the existing feature-specific source records under docs/evidence/tasks/feature-delivery/. Each surface names its historical article, original source revision, reported historical status and existing referenced files with current-byte hashes. Historical repeated references stay explicitly qualified; they are not automatically copied into admitted production consumers. No historical gap is relabelled as a current absence finding.

The inventory contains 45 bounded current mappings (A: 14, D: 16, C: 4, R: 11), 109 records with historical candidates awaiting current admission, 94 historical gap records awaiting current binding, 187 outside-catalogue runtime records and 1 conditional/inapplicable records retaining ledger scope. Zero records remain unprocessed against the historical inventory. This is not exhaustive current consumer discovery: all records still require independent admission, and historical candidates require current feature/surface tracing.

The historical record revision is e722cf1b91ccc46465eb449df4abd84d9d6df2a1. Current binding bytes come from baseline cb88af0c006b62f5ab300630d4093f63ec8714d7. Later implemented behavior can supersede historical gaps, so neither historical status nor a current file hash proves semantic currency. PH01-T02-C02 remains incomplete. No test execution, review, audit, static analysis or capture was performed during this authoring pass.
