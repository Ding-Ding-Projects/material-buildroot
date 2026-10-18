# ISO9660 source-to-control map

This supplements the existing lexical and native inventories with an explicit control disposition for every symbol, the bootloader choice and prerequisite comment in the selected Buildroot 2025.02 `fs/iso9660/Config.in`. It does not duplicate their broader inventories or claim current native GUI acceptance.

The [machine-readable map](iso9660-control-map.json) preserves exact source blocks, help, line locations and hashes, and binds concrete backend, renderer and existing help references. Source-file SHA-256: `172e3e70c48df32d47e29d76b65ce60b48906ee1231a9426aaad6130309a7cc2`. Application baseline: `2ae93775f2165e75345b0d8387fc56036f0b9470`. No source reference is inferred merely because a symbol exists in a catalog. Missing direct references are explicitly marked as profile context only.

## Every source item

| Source item and line | Guided workflow | Advanced / Easy-mode and help disposition |
| --- | --- | --- |
| `BR2_TARGET_ROOTFS_ISO9660`, 1 | Fixed profile requests `true` | Generic advanced boolean consumer only. Explain upstream i386/x86_64 plus Linux/bootloader prerequisites; the guided route is x86_64 only. |
| Bootloader choice, 24 | Fixed GRUB2 selection | A source-derived mutually exclusive bootloader dropdown is not implemented by the single fixed profile; generic individual symbol controls do not prove complete choice behavior. |
| `BR2_TARGET_ROOTFS_ISO9660_GRUB2`, 27 | Fixed profile requests `true` | Explain BIOS/EFI platforms, `iso9660` built-in modules and CD-root configuration. Full alternative-platform control/help acceptance is pending. |
| `BR2_TARGET_ROOTFS_ISO9660_ISOLINUX`, 43 | Profile explicitly requests `false` | Source-supported alternative, deliberately outside this guided route. Explain its own prerequisite and hybrid option; no guided alternative selection is claimed. |
| `BR2_TARGET_ROOTFS_ISO9660_BIOS_BOOTLOADER`, 50 | Hidden derived flag | Source selects it from GRUB2 PC or ISOLINUX. There is no direct profile request or independent toggle; explain the derived capability. |
| `BR2_TARGET_ROOTFS_ISO9660_EFI_BOOTLOADER`, 53 | Hidden derived flag | Source can select it from x86 GRUB2 EFI platforms. Profile disables those two platform options; EFI remains outside guided support. |
| `BR2_TARGET_ROOTFS_ISO9660_BOOT_MENU`, 56 | Fixed `fs/iso9660/grub.cfg` | Generic advanced string field is not a guided custom-menu browser/editor. Explain bootloader-specific defaults and `__KERNEL_PATH__` / `__INITRD_PATH__` substitution. |
| `BR2_TARGET_ROOTFS_ISO9660_INITRD`, 68 | Fixed profile requests `true` | Explain external initrd, an already integrated initramfs and the direct optical root alternative. The source defaults this option to `y`; profile does not provide a root-mode choice. |
| `BR2_TARGET_ROOTFS_ISO9660_TRANSPARENT_COMPRESSION`, 79 | Not requested; incompatible with guided initrd | Source requires both ISO initrd and integrated initramfs to be disabled. Do not offer an unavailable Easy choice or imply universal kernel support. |
| `BR2_TARGET_ROOTFS_ISO9660_HYBRID`, 88 | Not directly requested | Source depends on ISOLINUX, which the profile disables. Expected dependency reconciliation is not an explicit hybrid mutation or USB boot proof. |
| Prerequisite comment, 99 | Partial contextual replacement | Current requirement summaries explain the fixed x86_64/kernel route; they do not render the exact upstream comment or every alternative prerequisite. |

All nine symbols retain the existing `filesystem-option:fs/iso9660/Config.in:<symbol>` lexical identities. Hidden and unsupported states are intentional distinctions, not evidence of complete control coverage.

## Current consumer boundaries

`src/main/configuration/image-presets.cjs` defines the requested booleans and strings, derives a source-bound plan, applies through the configuration service and checks requested/effective results. It explicitly disables ISOLINUX and the two x86 GRUB2 EFI platforms. It does not directly request the hidden BIOS/EFI flags, compression or hybrid symbols.

`src/renderer/image-presets-panel.ts` offers Easy/Advanced mode, profile-level review, an explicit approval checkbox and Configure BIOS ISO. Its current guided profile is `x86_64-bios-grub2-initrd`. Advanced mode points users to preset controls and the full configuration editor; it does not change the guided build's fixed profile. `configuration-panel.ts` provides generic typed controls and source help/dependencies subject to graph availability, visibility and reconciliation. These source references are not current built/native interaction proof.

The [profile guide](../../desktop/iso-fields/profile-and-firmware.md) and [configuration/recovery guide](../../desktop/iso-fields/configuration-and-recovery.md) already explain the fixed profile. This map adds exact per-source-item gaps instead of duplicating those articles. Additional Easy controls must discover actual eligibility, retain source defaults and explain missing prerequisites before offering icon dropdowns or prefilled choices. Hidden derived flags should not become misleading independent switches.

The retained [ISO production](../../evidence/iso-production/production.json) and [boot evidence](../../evidence/iso-boot/acceptance.json) prove a separate historical one-profile BIOS/GRUB2 image under the documented consumer. Current integrated GUI/service acceptance remains pending. Neither this map nor that bounded boot record proves UEFI, ISOLINUX/hybrid, i386, every root/compression combination or all-version support.

## Integrity and omission witnesses

```text
node docs/planning/buildroot-coverage/iso9660-control-map.cjs --source <retained-source> --application-baseline 2ae93775f2165e75345b0d8387fc56036f0b9470
node docs/planning/buildroot-coverage/iso9660-control-map.cjs --source <retained-source> --check
```

Regeneration requires an explicitly supplied full lowercase 40-hex commit identity. It never infers the current HEAD or silently preserves an older label while reading newer consumers. Ordinary `--check` defaults to the saved map's `applicationBaseline`; an explicit different baseline does not relabel the saved map and must still match it.

Before generation or checking, literal `git` CLI calls verify that the baseline is a commit and read each of the five fixed consumer/help blobs from that exact commit. Every current consumer must match its selected committed content. Only this comparison normalizes CRLF to LF to accommodate checkout conversion; retained current-file SHA-256 values remain exact and can still require an explicit refresh after checkout-byte changes. A real semantic change rejects the command before writing a map. To refresh after a merged frontend change, supply that reviewed candidate's full commit identity explicitly and retain the new exact consumer hashes.

The checker reads only strict non-aliased selected paths, binds source and current consumer hashes, compares the handwritten nine-symbol inventory with the exact source declarations and requires one choice plus one prerequisite comment. It deliberately removes each of the eleven records, observes rejection, then accepts the restored map. It also accepts a known CRLF/LF-equivalent fixture and rejects both changed public fixture content and a deliberately changed in-memory consumer against the actual selected commit blob. No working file is altered for these witnesses. No native runtime, build, source macro or GUI executes. This finite lexical map is not a general Kconfig evaluator.
