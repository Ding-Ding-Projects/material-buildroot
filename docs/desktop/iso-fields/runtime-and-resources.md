# ISO runtime and resources

## Purpose and recommended default

Easy mode discovers the saved project runtime through the host. It displays its actual WSL distribution or admitted Docker image instead of suggesting an unverified image name. Choose and authorize that runtime in the Runtime workspace before starting.

## Example and constraints

A valid example is a locally discovered WSL distribution selected through the existing runtime controls. For Docker, use an admitted Linux build image and non-root execution; no universal image name is assumed. The guided build uses two parallel jobs and the existing scheduler defaults. More concurrency consumes more RAM and storage and may slow a constrained host.

## Recovery and advanced controls

Missing runtime, unsupported architecture, insufficient resources and permission failures stay incomplete. Fix the reported cause through runtime setup, then refresh the ISO plan. The existing Build controls retain manual parallelism and resource reservations. The ISO guided button intentionally does not accept raw shell commands or arbitrary runtime strings.

## Optional guide at the saved runtime control

The 44-pixel info button directly above **Saved execution runtime** explains the value already returned by the project. It displays that WSL distribution or Docker image reference, or explicitly says the identity is unknown. A saved value never proves current access, authorization or readiness. For missing or inaccessible runtimes, return to **Projects & runtime**, review the environment and permission, then check the ISO prerequisites again.

The guide explains the existing fixed two-job request. **Try two-job example** shows four synthetic tasks sharing two work spaces: two running and two waiting. It starts no real job, makes no host call and writes no storage. **Reset runtime example**, closing, disconnecting or changing workspace discards the sample. Reopening starts empty. No alternative runtime or resource setting is selected by this example.

The registered Material info button has a localized name, tooltip, expanded state, Enter/Space activation and Escape/Close focus return. Its actual native button receives element-reference relationships to this instance's explanation and tooltip through the same version-bound `@material/web` 2.5.0 adapter as the profile guide. Independent instances do not share references or examples. Engines without the element-reference APIs retain keyboard controls, but those relationships are unavailable. Source-browser checks are separate from pending native acceptance.
