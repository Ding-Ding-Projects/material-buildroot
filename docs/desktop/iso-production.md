# BIOS ISO production and export

The image workflow offers a source-bound x86-64 BIOS ISO plan. First select a trusted Buildroot source and configure an x86-64 architecture and Linux kernel, for example through a suitable source-provided defconfig. The plan requests the source's Syslinux, Isolinux, ISO9660, Isolinux ISO bootloader and initrd options together. It does not install a desktop environment or configure UEFI.

Preview reads the selected source's live Kconfig symbols and current configuration revision. Apply accepts only that revision, uses the existing configuration transaction and runs `olddefconfig`. Existing configuration undo remains available. The result explicitly reports whether every requested ISO option survived reconciliation. A false effective result means configuration is incomplete, even if reconciliation exited successfully.

Run the full build through the build queue after applying the plan. Buildroot emits `images/rootfs.iso9660` in the selected output directory when its ISO target succeeds. The build must run through an admitted non-root WSL 2 or Linux-container environment. Existing output directories are not replaced by the ISO workflow. Toolchain, Linux, bootloader and host-tool downloads may be substantial on a new output tree.

Inspect the produced file before export. The viewer reports SHA-256, size, ISO volume descriptor consistency and bounded El Torito catalog checks, including the validation-entry checksum and initial boot-entry location. Invalid, absent or out-of-range structures remain visible. These are structural checks, not proof of successful firmware boot, kernel startup or a usable shell. UEFI, USB-hybrid and every other preset/firmware combination require separate configuration and runtime acceptance.

ISO export copies an existing ISO byte for byte to a new output name and verifies its checksum. It never manufactures a bootable ISO by renaming a disk image. Existing destinations are rejected; original bytes remain preserved. Export preview expires and is rejected if its source changes. Boot verification remains false until independently demonstrated from the exact produced image.

The `imagePreset.isoPlan` and `imagePreset.isoApply` operations accept only workspace identity and configuration revision. The renderer cannot supply shell commands, additional make arguments, bootloader paths or configuration fragments through these operations.
