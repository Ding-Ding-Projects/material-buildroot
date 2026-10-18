# ISO profile and firmware

## Purpose and recommended default

The guided profile is x86-64 BIOS optical media using ISOLINUX and an initial RAM filesystem. The source must already enable x86-64 and Linux. Easy mode reads the live source and offers the profile only when its requirements are selectable. It does not invent supported Buildroot releases or alternate firmware.

## Example and constraints

Expected profile: `x86_64-bios-isolinux-initrd`. Firmware: BIOS. Bootloader: ISOLINUX. Filesystem: initrd. Output format: ISO9660. UEFI and hybrid USB boot are not configured or verified by this profile. The kernel and existing package selection remain project choices.

## Recovery and advanced controls

An unavailable requirement keeps Apply disabled. Select a suitable board, enable Linux and inspect the relevant Kconfig dependencies, then check again. Advanced mode retains package presets and the full configuration editor; manually enabling UEFI is not proof that this BIOS workflow supports it.
