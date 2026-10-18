# Choose a package build target

[香港粵語](package-targets.zh-HK.md) · [Desktop guides](README.md)

A package is one component in the selected Buildroot source. A package action asks Buildroot to work on that component. For a complete image, keep **Build target** set to `all`. To choose one component, use **Search source packages**, select **Source package**, choose **Package action**, then press **Select package action**. Review the resulting target, runtime and parallelism before the separate **Queue build** action. Choosing a package or target never submits a build.

## Find a package without losing your place

The host supplies the complete discovered source inventory through `build.targets`; the interface does not truncate it to the first page. Each page contains 50 matching packages. **Previous packages** and **Next packages** move between pages and are keyboard accessible. A valid selected package outside the current page is retained as one additional option, labelled **Selected outside this page**, so at most 51 options are mounted. The count reports matching packages, total source packages and the displayed range. No matches displays a recovery explanation; changing the query or disabling regular expressions restores ordinary browsing. **Refresh targets** rechecks the source catalogue and clears a selection that is no longer admitted.

The 3,263-entry source-catalogue fixture checks access to the last entry, keyboard paging and selection retention across filtering. That count is the fixture's complete inventory, not a fixed count promised for every Buildroot release. A source-discovered package is not proof that it is enabled in the current configuration.

## Literal and expression search

Literal search is the default and compares package names without case sensitivity. The adjacent full regex workbench owns its pattern and flags independently. Patterns are limited to 2,000 characters. The worker admits at most 1,000 entries per message and 70,000 characters per entry; supported flag characters are `dgimsuvy`, without duplicates, subject to the browser's regular-expression engine.

A regex query processes the complete supplied inventory in chunks under one 600 ms deadline. Matching IDs are published only after every chunk succeeds for the current query generation. Invalid expressions, unavailable workers or timeout yield no partial matches and show a recovery message. Changing the query or leaving regex mode invalidates late replies. This bounds the search operation; it does not execute or configure packages.

## What the actions mean

- `rebuild`: rebuild the selected package. Reverse dependencies and final images may remain stale; run the full image target afterwards. Toolchain or ABI changes may require a full clean rebuild.
- `reconfigure`: rerun that package's configuration and compilation, with the same reverse-dependency and final-image limitations.
- `dirclean`: remove that package's generated build directory. Its next build starts again; installed files and reverse dependencies are not automatically rebuilt. Exact-output destructive confirmation is required.
- `download`: request that package's source-download target through the selected admitted runtime. Availability still depends on configuration, runtime and network constraints.

The host validates the package/action against its current catalogue and source/configuration intent at submission. A label or saved selection grants no filesystem or execution authority. Destructive targets retain the existing exact-destination confirmation. Runtime discovery, resource admission, queue state, cancellation and cleanup remain separate workflows. The chooser accepts named actions, not arbitrary shell commands.

## Evidence and limits

`tests/renderer/renderer-package-chooser.spec.mjs` contains source-backed renderer fixtures for the complete 3,263-entry inventory, bounded options, keyboard paging, retained selection, removed-package rejection, literal/regex search, all-or-nothing timeout and late-reply rejection, localized narrow layouts and the absence of `build.submit` during selection. The fixture host supplies the catalogue and records requests; it does not run a native build. Native GUI, real runtime submission, destructive confirmation and ISO production/boot require their own source-bound evidence. This article adds no native or ISO success claim.
