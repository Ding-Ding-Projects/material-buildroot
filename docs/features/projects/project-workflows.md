# Project creation and opening

Projects & runtime contains explicit Open, Create, Adopt, Import extracted source and Clone actions. Create starts with the official Buildroot HTTPS repository and the dated maintained-LTS recommendation. Clone accepts another validated HTTPS source and branch or tag. Both use the existing host source service, a native parent-folder picker, explicit source trust and an unused child name. Existing destinations are not replaced. A separate output directory is created beside the source. Failed registration can leave a retained clone that can subsequently be adopted.

Adopt selects an existing workspace, Buildroot source and separate output directory using native pickers. Import extracted source uses this same non-destructive registration for an already extracted source tree. It does not extract archives or copy source files. These actions preserve existing configuration and output contents.

Open lists retained descriptors and distinguishes session-authorized projects from records requiring renewed folder access. A stored path is not a capability. Direct opening requires a currently held project grant and fresh identity checks. After restart, the user selects project folders and explicitly trusts the source again. The host never accepts renderer-supplied filesystem paths in the opening operation.

## Source and runtime provenance

Refresh project provenance displays the actual source/output paths, resolved source revision, current branch (or detached state), and local-modification status from the existing source status operation. A requested tag is never presented as evidence of the checked-out revision. Unavailable status remains explicitly unverified, including trees without ordinary Git provenance.

The recommendation is Buildroot 2025.02.18, verified against the [official download page](https://buildroot.org/download.html) on 2026-10-16. That page lists the 2025.02.x long-term-support series through March 2028. This is dated guidance, not an automatically refreshed latest-version claim. Users can supply another explicit branch or tag before trusting and cloning.

Runtime selection remains per-project through the existing WSL or digest-pinned Docker controls and project options store. Opening an authorized project restores its selected runtime controls. Adoption and cloning do not start a build or execute source code. WSL-native folder authority is supplied by the separate distribution-bound WSL workflow; generic native pickers do not acquire arbitrary UNC authority.

## Verification boundary

This change is delivered under a build-only workflow. Runtime, interaction, accessibility, persistence and screenshot acceptance have not been executed for this change. Archive extraction, live release discovery and source-upgrade machinery are outside this task.
