# Development instructions

Buildroot Studio is a Windows desktop application. Buildroot runs through WSL 2 or Docker Linux containers; Windows native execution is not supported. Preserve existing checkouts and output trees. Never build as root or run arbitrary renderer-provided commands.

Use genuine registered Material Design 3 components. Keep the renderer sandboxed with context isolation and expose a narrowly validated IPC API. Document actual feature and runtime verification, and keep unverified requirements visible in ROADMAP.md and HANDOFF.md.

Run the focused local checks before publishing. Windows installers use unsigned Squirrel.Windows. Build scripts build only; publication is separate. Do not expose credentials, local machine details, or private instructions in source, documentation, logs, or releases.
