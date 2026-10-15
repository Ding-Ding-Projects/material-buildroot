# Productive desktop workspace

The application opens into an editable workspace. First-run setup records an intended Linux runtime, creates a real saved project plan, and reviews appearance. Back, skip and resume preserve progress; completion is separate from dismissal. Setup does not claim to install or verify a runtime.

## Plans and recovery

Plans have a name, intended runtime/output, planning status and notes. Apply and Discard control pending edits. Leaving a dirty plan requires an explicit decision. Plans, appearance and onboarding use revision-bound atomic local storage; rejected or uncertain writes retain the draft. An uncertain result disables further changes until the application reloads its saved state.

Snapshots preserve applied workspace content. Restore and validated import replace content as a new revision after review. JSON exports exclude authority tokens and protected records. Download initiation is reported as a request, not proof that the operating system saved a file. Activity retains durable records with a bounded current view.

## Project operations

Native folder pickers select the workspace, existing Buildroot source and separate output directory. The owner reviews source execution consent before adoption. Persisted descriptors preserve project identity across restart but do not grant filesystem authority: choose the same directories and approve the source again to reconnect existing job records.

Runtime discovery checks installed WSL distributions and Docker availability. Builds use curated targets and a non-root runtime. Docker requires an existing image pinned by digest. Unsupported paths, missing tools and missing runtime prerequisites fail explicitly. Builds never run native Windows make or accept renderer shell commands. See [execution](execution.md).

Jobs retain actual state, log pages and outcomes. Cancellation is a request until the adapter settles. Retry creates a new attempt. A configuration transaction cannot modify the output while a build is running, and new builds are blocked during reconciliation.

The configuration panel exposes typed values and revision conflicts, defconfig application and ordered undo. An explicitly selected trusted Python interpreter can run the bundled, pinned Kconfig reader to expose actual menu, type, dependency, choice, range and help metadata. Applying changes runs the admitted runtime's `olddefconfig`. Compatibility with a particular Buildroot source remains a distinct runtime requirement. See [configuration](configuration.md).

Artifact controls inspect file metadata, hashes and bounded text. Guest controls use owned VirtualBox or VMware guests and reviewed conversion previews. Shutdown requests do not assert a guest has stopped; refresh reads actual state. See [deployment](deployment.md).

The local assistant sends explicitly composed messages to loopback Ollama. It does not attach project files or execute proposals automatically. Update controls discover normal releases and verify installer bytes; download alone does not install an update. See [tools](built-in-tools.md) and [updates](updates.md).

## Interface and accessibility

Controls are registered Material Web components with bundled licensed Roboto, explicit Material typeface tokens, dark/light/system appearance and English/Hong Kong Cantonese/bilingual copy. Navigation focuses its destination heading. Dialogs retain explicit identities and return focus. The action launcher supports keyboard traversal. Every motion family respects reduced-motion preference.

The regex workbench runs bounded matching in an isolated worker, provides captures and replacement previews, guided constructs, flags, test cases and session snippets. It reports engine limitations and timeout; it is not evidence of complete canonical search integration on every surface.

## Verification boundaries

Linux Chromium fixtures exercise real renderer controls and, for workspace persistence cases, the actual local workspace service. They do not prove Windows IPC, installation, display scaling, WSL, Docker daemon or guest behavior. Native Windows runtime tests are deferred by owner instruction. The complete roadmap and per-surface requirements remain open where their own implementation or proof is absent.

The browser visitor workspace uses its own storage and does not acquire host authority from local planning data. Authenticated companion enrollment requires separately reviewed HTTPS, origin and session controls; browser transport acceptance is independent of desktop checks.

[香港粵語](modern-workspace.zh-HK.md)
