# Package authoring and source-editor handoff

[香港粵語](package-authoring.zh-HK.md)

## Start a package draft

Open **Package authoring** for an adopted project. Choose a prepared, authorized
`BR2_EXTERNAL` tree, or initialize an empty folder through the external-tree
workflow. Selecting an external tree for writing and activating it for a build are
separate operations.

The typed editor supports literal archive metadata for `generic`, `autotools`,
`cmake`, `meson`, `cargo`, `go` and `python` recipes. It collects the package name,
version, direct HTTP(S) source archive URL, source basename, homepage, help,
license expression, license files, build dependencies and `BR2_` configuration
constraints. Python recipes additionally choose a supported setup type. Source
and homepage URLs cannot contain credentials, query strings or fragments. The
archive URL must end with the supplied source filename. The editor does not
infer dependency toolchain constraints or evaluate Kconfig expressions.

The GNU Hello example replaces the current draft with metadata, but deliberately
leaves hashes empty. Supply one actual SHA-256 or SHA-512 digest for the source
archive and each license file. The editor neither downloads the source nor
invents a digest. License files currently use basenames, not nested paths.

## Configure patches, options and file operations

The **Patches & files** tab adds these controls:

| Control | Supported behavior |
| --- | --- |
| Ordered patches | Up to 64 HTTPS patch URLs, with move-up, move-down and removal. They generate the package `_PATCH` value in displayed order. Buildroot applies them later; the editor does not download or execute them. Local patch uploads and patch-hash generation are not implemented. |
| Configure options | Up to 64 literal options, one per line, for Autotools, CMake and Meson only. They generate `_CONF_OPTS`. Each option is bounded to 512 characters and excludes spaces and shell expressions. Other infrastructures reject nonempty options. |
| Ordered hooks | Up to 64 structured `copy` or `mkdir` operations at `PRE_CONFIGURE`, `POST_CONFIGURE`, `PRE_BUILD`, `POST_BUILD` or `POST_INSTALL_TARGET`. Display order determines registration order within each lifecycle stage; Buildroot determines the order between stages. |
| Overlay mappings | Up to 64 existing external-tree source files mapped to distinct target-filesystem destinations, with explicit three-digit octal permissions from `000` through `777`. They generate a post-install target hook after the configured file hooks. |

Hook source paths are relative to the extracted package build directory.
Destinations are relative to that directory except at `POST_INSTALL_TARGET`,
where they are relative to the target filesystem. `copy` generates a fixed
`$(INSTALL) -D -m` operation; `mkdir` generates `$(INSTALL) -d -m`. No free-form
shell command is accepted. Generic recipes still do not receive a custom build
command from this editor. Use the source-editor handoff for unsupported manual
recipe constructs, followed by a separate trusted build workflow.

Overlay sources are relative to the selected external tree, and destinations are
relative to the target filesystem, without a leading slash. For example, map
`board/demo/banner.txt` to `etc/banner.txt` with mode `644`. Sources must already
exist as safely readable files. The editor includes their content hashes and
identities in the preview revision, so a changed source invalidates an earlier
preview when Apply recomputes it. This is not a copy of the source into a frozen
build input, and later external changes are outside that preview's guarantee.

Hook and overlay paths admit only letters, digits, underscores, dots, plus signs,
hyphens and slash separators. Empty, absolute, traversal and leading-hyphen path
components are rejected. Permissions describe the generated target operation;
the editor does not change the host source file's permissions.

## Preview, consent and apply

Select **Preview generated files**, inspect every before/after file and its mode,
then explicitly approve **Apply reviewed package files**. Changes invalidate the
preview and its consent. Apply checks the external-tree revision and generated
content hash again before writing. Writes use the existing authorized-tree,
safe-path, per-root locking and rollback workflow. A failed rollback is reported
as incomplete, never as a successful apply.

Generated files include `Config.in`, the package `.mk` and `.hash`, and the parent
external-tree includes. Drafts with structured extension fields also carry
`material-package.json`. That file records schema version 1, the external-tree
name and the model needed for preserving re-import. Empty extension lists remain
represented after their items are removed, rather than leaving stale metadata.

Applying files does not activate the tree, execute a recipe, validate Buildroot
compatibility or prove that a build succeeds. Source trust and actual build
submission remain separate workflows.

## Discover and preserve existing recipes

Expand **Discover and import source packages** to inspect declarations and
original file bytes from the adopted source and authorized external trees.
Discovery is static reading, not make execution. Existing bounded catalogue,
file-size and traversal limits still apply.

An import is offered to the typed editor only when it can reproduce the current
files exactly. Structured metadata is validated, then regenerated content is
compared with the current bytes. Unexpected additional package files, unsupported
syntax, comments or formatting that would be lost, and external modifications
prevent automatic round-tripping. These files remain available for read-only
inspection and manual editor handoff. Import replaces the draft only after
consent; writing still requires a new preview and Apply.

## Open an installed editor

Select **Discover installed editors**. The host checks the known installation
locations for Notepad, user or machine Visual Studio Code, and Notepad++. It
returns only installed regular executable files, not arbitrary renderer-supplied
executables or command lines. Discovery currently targets Windows; other hosts
return an empty list. A supported editor installed elsewhere is not discovered.

Choose an editor and use **Open current source in editor** beside an inspected
package file. The host re-discovers the package, checks the imported snapshot
revision and selected file hash, validates the file path, and launches the editor
without a shell. The supported file extensions are `.mk`, `.in`, `.hash`,
`.patch`, `.json`, `.txt`, `.sh` and `.conf` (case-insensitive). The handoff reports
process launch only, not a completed edit or a successful save. Refresh discovery
after saving in the editor before importing or requesting another handoff.

## Configuration and failure recovery

No host editor path or arbitrary command is configurable through these controls.
The draft fields, selected external tree, current package snapshot and discovered
editor selection form the operation context. Runtime trust, output location and
external-tree activation retain their existing separate configuration.

- Invalid patch URLs, unsupported configure options, malformed paths, duplicate
  overlay destinations and invalid modes stop preview generation. Correct the
  field and create a fresh preview.
- Missing or unsafe overlay source files prevent preview; grant and select the
  intended tree and correct the relative source path.
- `REVISION_CONFLICT` or `PACKAGE_PREVIEW_CONFLICT` means the current files or
  generated model no longer match the reviewed candidate. Refresh or preview
  again, inspect the differences, and provide new consent.
- `PACKAGE_MANUAL_EDIT_REQUIRED` means automatic generation would not preserve
  the existing recipe. Inspect the original files and use a discovered editor.
- `EDITOR_NOT_AVAILABLE`, `EDITOR_FILE_NOT_ADMITTED` or `EDITOR_LAUNCH_FAILED`
  leaves the handoff incomplete. Rediscover installed editors or choose an
  admitted file; do not treat a launch attempt as a save.
- `PACKAGE_ROLLBACK_FAILED` requires inspection of the external tree before any
  retry. Preserve the remaining files and do not assume the prior state was fully
  restored.

The controls restrict generated syntax and host access; they do not certify the
contents of downloaded patches, package source, imported recipes or subsequently
edited files. Review those inputs before granting actual build execution.

## Production evidence and deferred acceptance

The source implementation candidate is
`2f2aa74b78f91e8d8f22888f597cbcbd87c6243a` (source tree
`14f588fa78eba708f6c4c9343893791530a9ff68`). Its exact root `build.bat /s`
completed with exit 0 and produced the desktop directory output. The candidate's
`release/app/build-receipt.json` has SHA-256
`8c38d3f8e76fb21c6d38efc3ae6033c0579f7ca1cf97c4756a1b4937d5902bc9`.
Its `win-unpacked/resources/app.asar` is 23,631,436 bytes with SHA-256
`970446cf4b0e8de1e4a42a4c8e802a9e5ec9398aa28f50ce058df03bc8b2c616`.
The receipt records `runtimeVerified: false` and `installer: false`.

This proves production of that exact source candidate only. It does not bind
later integrated or documentation-only commits to the earlier output. A later
cumulative documentation and product build must record its own source identity.
Tests, reviews, audits, static-analysis runs, runtime launches and screenshots
were intentionally not performed in this implementation lane. Actual Buildroot
patch/hook/overlay execution, editor interaction, installation, accessibility and
layout acceptance remain unverified.
