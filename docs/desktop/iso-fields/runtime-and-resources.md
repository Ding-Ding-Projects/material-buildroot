# ISO runtime and resources

## Purpose and recommended default

Easy mode discovers the saved project runtime through the host. It displays its actual WSL distribution or admitted Docker image instead of suggesting an unverified image name. Choose and authorize that runtime in the Runtime workspace before starting.

## Example and constraints

A valid example is a locally discovered WSL distribution selected through the existing runtime controls. For Docker, use an admitted Linux build image and non-root execution; no universal image name is assumed. The guided build uses two parallel jobs and the existing scheduler defaults. More concurrency consumes more RAM and storage and may slow a constrained host.

## Recovery and advanced controls

Missing runtime, unsupported architecture, insufficient resources and permission failures stay incomplete. Fix the reported cause through runtime setup, then refresh the ISO plan. The existing Build controls retain manual parallelism and resource reservations. The ISO guided button intentionally does not accept raw shell commands or arbitrary runtime strings.
