# Startup repair continuation

## Startup and runtime repair candidate, 2026-10-17

Version 0.1.1 repairs missing workspace-tab registration, native Element.matches collisions in tab/authenticator components, and repeated identical search-result notifications that can keep the renderer busy. The startup browser regression passed. Runtime probing no longer references an undefined target, and WSL launches use setsid --wait so output and process ownership survive session creation.

Real execution through ExecutionService passed olddefconfig and show-info for both WSL 2 and Docker, using upstream Buildroot commit aa2d7ca53f704af901f6c33c13e4bb1591886700 and the official Buildroot environment image digest 340aa0de68e8e13e4eca70a00aaf94ec68d3a3891c28f3e7495d844829a8c958. Builds ran as UID 1000, and cleanup independently reported stopped WSL sessions or absent owned containers. These checks compile the configuration tool and enumerate package metadata; they do not prove a complete firmware build. WSL uses a task-owned distribution and preserves Linux source links. Native Windows extraction could not preserve all source links, so Docker's bind-mounted source check is limited to these two exercised targets.

The earlier broad execution suite had 11 passes, 8 failures and 6 skips. Two environment-probe failures are repaired; the remaining broad failures include outdated target/cache fixtures and remain separate from live runtime acceptance. Focused changed-path checks are recorded separately.

Next: build the 0.1.1 installer with the exact root entrypoint, verify packaged startup, publish and read back the exact release, update the matching normal installation through its supported route, and verify the actual installed workspace. Existing package-local filesystem redirection remains a verification concern. A visible-desktop check still requires explicit owner consent. Keep issue #6 current and preserve user data and unrelated applications.
