# ISO profile and firmware

## Purpose and recommended default

The guided profile is x86-64 BIOS optical media using GRUB2 and an initial RAM filesystem. The source must already enable x86-64 and Linux. Easy mode reads the live source and offers the profile only when its requirements are selectable. It does not invent supported Buildroot releases or alternate firmware.

## Example and constraints

Expected profile: `x86_64-bios-grub2-initrd`. Firmware: BIOS. Bootloader: GRUB2. Filesystem: initrd. Output format: ISO9660. UEFI and hybrid USB boot are not configured or verified by this profile. The kernel and existing package selection remain project choices.

## What the RAM choice means

An ISO is one disc-image file. With the guided `initrd` choice, a copy of the Linux root files is loaded into memory when the computer starts. Programs can change that RAM copy while running. This does not rewrite the ISO file, and it does not establish that changes survive a restart. Persistent storage requires separate configuration and verification.

The captured Buildroot 2025.02 help for `BR2_TARGET_ROOTFS_ISO9660` distinguishes a direct, read-only ISO root from a read/write root in RAM. `BR2_TARGET_ROOTFS_ISO9660_INITRD` defaults to `y` in that captured source and packages the root separately with the kernel and bootloader. Source: `fs/iso9660/Config.in`, lines 1 and 68, SHA-256 `172e3e70c48df32d47e29d76b65ce60b48906ee1231a9426aaad6130309a7cc2`, recorded in the [source coverage inventory](../../planning/buildroot-coverage/README.md). This is a version-bound explanation, not universal compatibility evidence. The current guide still checks the selected source before applying its fixed profile.

## Optional profile-control guide

The compact info button directly above **Detected image profile** opens a non-modal explanation and worked example. Choose **RAM copy example** or **Read-only disc example**, then **Try example** to see what changing a sample note would mean. The disc option demonstrates the source alternative only; it does not change the real Easy ISO profile. The generated-name example remains `images/rootfs.iso9660`.

**Reset example** restores the RAM example. **Close profile guide** or Escape returns focus to the info button and discards the example state. Reopening starts fresh. Each guide instance owns its own sample state; nothing is persisted, copied from live records or sent to host operations. No file, permission, configuration or build is created by the example. Use the separate real workflow controls for actual work.

Control inventory for this bounded guidance item: `iso-profile-info` owns target `iso-profile-control` and panel `iso-profile-guide`. The button has a localized accessible name, hover/focus tooltip, 44-pixel minimum target and expanded state. The panel remains in the content flow at narrow widths. Renderer checks cover keyboard opening, focus return, isolated examples, reset, localization and no host calls; native acceptance remains separate.

## Recovery and advanced controls

An unavailable requirement keeps Apply disabled. For an empty or unsuitable processor configuration, use the [source-discovered PC starting points](beginner-board-presets.md), review replacement consent and renew the changed configuration's permission, then check again. Advanced mode retains package presets and the full configuration editor for remaining unsupported cases; manually enabling UEFI is not proof that this BIOS workflow supports it.

Accessibility adapter: the pinned `@material/web` 2.5.0 icon button does not forward host ID references. After rendering, the native button receives `ariaControlsElements` and `ariaDescribedByElements` pointing to this instance’s actual guide and tooltip. The adapter feature-detects both APIs, clears references on disconnect and rebinds after rendering/reconnection. Older engines without these APIs retain the name, expanded state and keyboard controls, but the two relationships remain unavailable. Native acceptance is still pending.
