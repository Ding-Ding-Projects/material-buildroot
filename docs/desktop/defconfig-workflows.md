# Defconfig workflows

The Configuration workspace includes a Buildroot defconfig browser. Grant configuration execution trust first, then refresh the catalog. It enumerates the source `configs/` directory followed by each currently authorized external tree in saved order. Duplicate names remain separate entries with source identity and content hashes. Filtering narrows the displayed catalog to 250 entries at a time.

Applying a selection requires explicit replacement acknowledgement. The host refreshes the catalog, checks its revision and selected content, and passes host-read bytes to the configuration service. The service preserves its revision, trust, reconciliation and rollback behavior. No renderer-supplied shell command or filesystem path is executed.

Minimal save executes Buildroot `savedefconfig` with a fixed `BR2_DEFCONFIG` override pointing to `material-minimal-defconfig` within the project's separate output directory. An existing destination stops the operation. Move that saved file deliberately before saving again. A separate JSON receipt records the resulting SHA-256, source/configuration revision, runtime and ordered external trees. This avoids overwriting the original source defconfig selected by `BR2_DEFCONFIG`.

Changing source bytes, configuration, runtime, tree order or grants requires renewed trust or a refreshed catalog. Missing native grants, unsafe links, oversized files and concurrent project activity stop the operation. External-tree authorization remains session-only and must be renewed after restart.

Implementation is source-complete for this workflow. Runtime behavior, visual appearance and automated checks were not exercised in this delivery mode and remain unverified.
