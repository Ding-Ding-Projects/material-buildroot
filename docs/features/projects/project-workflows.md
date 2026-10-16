# Project creation and opening

Projects & runtime contains explicit Open, Create, Adopt, Import descriptor, Import extracted source and Clone actions. Create starts with the official Buildroot HTTPS repository and the dated maintained-LTS recommendation. Clone accepts another validated HTTPS source and branch or tag. Both use the existing host source service, a native parent-folder picker, explicit source trust and an unused child name. Existing destinations are not replaced. A separate output directory is created beside the source. Failed registration can leave a retained clone that can subsequently be adopted.

Adopt selects an existing workspace, Buildroot source and separate output directory using native pickers. Import extracted source uses this same non-destructive registration for an already extracted source tree. It does not extract archives or copy source files. These actions preserve existing configuration and output contents.

Open lists retained descriptors and distinguishes session-authorized projects from records requiring renewed folder access. A stored path is not a capability. Direct opening requires a currently held project grant and fresh identity checks. After restart, the user selects project folders and explicitly trusts the source again. The host never accepts renderer-supplied filesystem paths in the opening operation.

## Portable project descriptors

Export project descriptor downloads the versioned `material-buildroot-project` JSON format, version 1. The exact schema includes a name, runtime choice, ordered external-tree metadata and a source snapshot (resolved revision, branch, modification state, observation time and availability). It excludes credentials, source/output contents, primary folder paths and execution capabilities. External-tree paths are included as metadata, so users are told to protect the exported local file where those paths are sensitive.

Import descriptor uses a native JSON file picker and a bounded, duplicate-key-rejecting parser. Unknown versions, extra fields and malformed options or provenance are refused before registration. The reviewed import expires after fifteen minutes and is consumed once. A native import requires newly selected workspace/source/output folders and explicit source trust. A WSL descriptor instead opens the distribution-bound native selectors in its recorded distribution and obtains a fresh host receipt. The selected location must not already be registered; successful registration assigns a new local project UUID. Existing projects, source files and outputs are never replaced.

Imported runtime/options and the original source snapshot are retained locally. Export of an imported project retains that original snapshot, rather than silently relabeling it as a fresh observation. The separate provenance refresh always queries actual selected source state. External-tree paths never restore access; those trees require their own existing authorization workflow. Import does not checkout the recorded revision or claim that local files match it. A partial metadata-write failure revokes the session project grant and can leave a recoverable catalogue record; it never deletes source/output files or reports successful import.

Native and WSL adoption use the cancelable retained-workspace hook. A newly opened identity gets its own panel; opening an existing identity focuses that panel. Runtime controls load from that panel's actual host options, with stale responses ignored if the identity changes.

## Source and runtime provenance

Refresh project provenance displays the actual source/output paths, resolved source revision, current branch (or detached state), and local-modification status from the existing source status operation. A requested tag is never presented as evidence of the checked-out revision. Unavailable status remains explicitly unverified, including trees without ordinary Git provenance.

The recommendation is Buildroot 2025.02.18, verified against the [official download page](https://buildroot.org/download.html) on 2026-10-16. That page lists the 2025.02.x long-term-support series through March 2028. This is dated guidance, not an automatically refreshed latest-version claim. Users can supply another explicit branch or tag before trusting and cloning.

Runtime selection remains per-project through the existing WSL or digest-pinned Docker controls and project options store. Opening an authorized project restores its selected runtime controls. Adoption and cloning do not start a build or execute source code. WSL-native folder authority is supplied by the separate distribution-bound WSL workflow; generic native pickers do not acquire arbitrary UNC authority.

## Verification boundary

This change is delivered under a build-only workflow. Runtime, interaction, accessibility, persistence and screenshot acceptance have not been executed for this change. Archive extraction, live release discovery and source-upgrade machinery are outside this task.
