# Development instructions

Material Buildroot is a Windows desktop application. Buildroot runs through WSL 2 or Docker Linux containers; Windows native execution is not supported. Preserve existing checkouts and output trees. Never build as root or run arbitrary renderer-provided commands.

Use genuine registered Material Design 3 components. Keep the renderer sandboxed with context isolation and expose a narrowly validated IPC API. Document actual feature and runtime verification, and keep unverified requirements visible in ROADMAP.md and HANDOFF.md.

Run the focused local checks before publishing. Windows installers use unsigned Squirrel.Windows. Build scripts build only; publication is separate. Do not expose credentials, local machine details, or private instructions in source, documentation, logs, or releases.

## Agent conversation vocabulary

Agents working in this repository use the shared private conversation vocabulary defined in
the maintainer's canonical agent instructions for every reply, including chat prose, visible
reasoning, status lines, and task or session titles. Read those instructions and apply them
in full. They are deliberately not restated here, because this file is part of this
repository's public record.

That vocabulary never appears in anything published. Keep it out of commit messages, branch
names, code, code comments, test names, documentation, this file, issues, pull requests,
discussions, release notes, published sites, logs, and every other file in this repository.
Published writing uses ordinary professional English, and exact technical identifiers always
keep their literal spelling. The single documented public-safe exception is named in those
canonical instructions; do not infer any other.

Scan any text bound for a public surface against that vocabulary before publishing it. A
reviewer cannot tell a correct release note from a leaking one by reading it, so the scan is
a step, not a habit.
