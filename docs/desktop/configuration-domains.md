# Component configuration domains

[香港粵語](configuration-domains.zh-HK.md)

The Configuration workspace has separate Buildroot, Linux, BusyBox and U-Boot selections. Changing domains clears loaded values and defconfig results; unsaved edits must first be applied or discarded. Inspect, typed apply, defconfig discovery/application and undo all send the selected domain to the desktop host.

## Real component discovery

The host executes a fixed, non-root Buildroot `printvars` operation for `LINUX_DIR`, `BUSYBOX_DIR` and `UBOOT_DIR` through the selected admitted runtime. No renderer path, shell fragment, package directory guess or simulated result is accepted. Returned directories must be direct children of the selected output's `build` directory. Only enabled, already prepared components with regular configuration, entrypoint and Makefile files are admitted. Legacy non-Kconfig U-Boot remains unavailable. No extraction or download is performed by discovery.

Domain revisions bind the selected domain, canonical source/output directories, component directory identity, entrypoint, Makefile, parent Buildroot configuration and actual component `.config` text. The host rediscovers the target before reconciliation and rejects changed bindings. Each domain retains the existing serialized transaction, rollback, requested/effective diff and bounded undo behavior. The component source/output can be the same prepared directory, while Buildroot still requires separate roots.

## Reconciliation and semantics

The host dispatches the fixed `linux-olddefconfig`, `busybox-oldconfig` or `uboot-olddefconfig` target. It supplies the corresponding fixed `*_KCONFIG_EDITORS` override, using Buildroot's package Kconfig editor machinery so package fixups and rebuild stamp invalidation remain owned by Buildroot. BusyBox receives empty default answers through a fixed `yes` pipeline; no renderer-controlled input is executed. These operations can modify generated files and build stamps beyond `.config`; transaction rollback restores only `.config` and does not claim to undo every upstream side effect.

The target contract is grounded in upstream [Buildroot 2025.02.1 package Kconfig infrastructure](https://github.com/buildroot/buildroot/blob/2025.02.1/package/pkg-kconfig.mk). Older or unsupported package targets fail truthfully. Source trees and their Make/Kconfig code must already be trusted for execution.

The existing admitted Kconfig adapter receives `Kconfig` for Linux/U-Boot, `Config.in` for BusyBox, the `CONFIG_` prefix and architecture context from the actual Buildroot configuration. Its native safe parser remains unable to execute upstream shell macros. The authoritative runtime adapter is now connected through explicit source-specific execution consent. No synthetic symbol result is substituted, and typed edits require available semantics. Linux defconfigs are read from `arch/<SRCARCH>/configs`; other domains use `configs` where present. Missing defconfig directories yield an empty list. Architecture aliases currently cover x86 and AArch64; other Buildroot architecture identifiers are retained literally and unsupported layouts remain unavailable.

## Delivery evidence and remaining work

This change is source implementation only. No tests, static analysis, runtime operations or screenshots were run for this delivery. Actual WSL/container discovery, domain reconciliation, platform races, upstream side effects and built controls remain unverified. The authoritative Kconfig transport from the semantics workstream is wired into the host, with production build results recorded separately. This change does not establish complete acceptance of all component versions or persistent history across application restarts.

## Source-specific execution permission

The host exposes `config.trustPreview`, `config.trustGrant` and `config.trustRevoke`. A preview captures actual source bytes, configuration bytes, root identities, active external-source order and selected runtime. The UI displays that exact scope and requires an explicit checkbox before submitting the opaque challenge identifier. Merely selecting a directory or runtime grants no source execution permission.

Component inspection uses two stages: permission for the current Buildroot source/configuration allows fixed component discovery, then a second preview names and hashes the discovered component source and configuration. Challenges expire after five minutes; accepted permission lasts at most fifteen minutes in the current application session. A changed source, configuration, root identity or runtime requires a fresh preview and consent. Revocation clears the workspace's permission and pending challenges. No permission is stored across restarts.

The host recomputes admission before, during and after the fixed runtime interpreter transport. Native safe parsing remains a fallback when no execution permission exists. Every configuration mutation independently requires current domain permission. The UI discloses that source-defined commands execute with the selected WSL account's access, while the container inspection route uses read-only mounts and no network. Configuration reconciliation is a separate writable Buildroot operation. Inspection is not represented as a sandbox for hostile source.

Content capture remains bounded by entry, byte and time limits. Legacy host receipts that bind only link text are insufficient for linked Kconfig sources. The current native WSL route admits links only after its stronger namespace, referent-content and identity checks succeed; see [native WSL content intent](../security/native-wsl-content-intent.md). Exceeding the capture limits or failing those checks remains unavailable, not an implicit trust expansion.

Runtime inspection participates in disposal cancellation and records concrete process ownership in the existing recovery journal. Unconfirmed cleanup retains its recovery record. No renderer command, executable, environment map or filesystem root is accepted by these permission endpoints.

## Review permission from the ISO guide

Permission answers one question: may the selected source execute its configuration-inspection commands in this runtime? It is not an ISO build result. A source folder is like a recipe that can also contain executable steps; review whose source it is and the account that will run it.

1. In the ISO guide, choose **Review source execution permission**. The Configuration workspace opens its **Source execution permission** section for that same workspace and Buildroot scope. Opening the section grants nothing.
2. Read **Review exact scope** and the displayed source, configuration, external-source order and runtime. If the selection is wrong, return without approving it.
3. Select the checkbox **Allow execution of this exact source revision in this runtime for configuration inspection and reconciliation.** Then choose **Allow this scope**. The checkbox alone is not approval, and the host must accept the current challenge before success is reported.
4. Read the resulting permission status. Choose **Return to ISO guide** to resume. The guide checks ISO compatibility separately. Approval does not configure the image, submit a build or prove that semantic inspection is available.
5. If the reviewed scope changed or expired, use **Review current scope again** and review the new facts. Do not treat a previously checked box as authority for a different source or runtime.

For Linux, BusyBox or U-Boot inspection, component discovery is a separate first approval of the current Buildroot source/configuration. It permits only the fixed discovery operation. A second review then identifies the actual discovered component source/configuration before component execution permission is granted. Missing or unprepared components remain unavailable; discovery does not download or prepare them.

**Revoke configuration permission** clears permission and pending challenges for the whole selected workspace, not only the visible component. Permission is session-local, expires after at most fifteen minutes and is invalidated by the bound source/configuration/root/runtime changes. A pending challenge expires after five minutes.

## Interpret unavailable semantics separately

`KCONFIG_SEMANTICS_UNAVAILABLE` means the host did not supply usable authoritative Kconfig semantics for that inspection. It does not, by itself, mean permission is still missing. Read the permission result and the separate inspection result as two facts. Approval cannot manufacture an interpreter, a valid source environment or a completed inspection. Do not mark configuration or ISO production successful from the permission message.

In the native observation of candidate `37571d3`, opening the review, selecting the checkbox and choosing **Allow this scope** succeeded and reported permission approved. The automatic ISO recheck still returned `KCONFIG_SEMANTICS_UNAVAILABLE`. At `2026-10-18T09:25:32.580Z` the renderer subsequently exited with code `0xC0000005`; no source cause is established. A later intended `inspectConfig` operation did not execute because `Runtime.enable` timed out. The sequence does not prove that permission or inspection caused the exit, and the unexecuted operation supplies no result. See [renderer exit diagnostics](renderer-exit-diagnostics.md) for the receipt's limited meaning. No recovery command, native repair success or ISO success is inferred.
