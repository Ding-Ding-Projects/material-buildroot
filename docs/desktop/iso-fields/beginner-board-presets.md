# Easy ISO board presets

An empty or default 32-bit project may not have the processor and Linux kernel needed by the BIOS ISO profile. The **Need a PC starting point?** section in Easy ISO offers source-discovered starting points without requiring symbol names.

## Choose an actual source preset

1. Adopt a trusted source and a separate output directory, then select its supported runtime.
2. Use **Review source execution permission**, read the exact scope, select the consent checkbox and choose **Allow this scope** only if you trust that source.
3. Choose **Find source PC presets**. The host reads the current source catalogue and returns revision-bound identities. The guide offers only matching entries from the primary Buildroot source, never a fabricated entry or an external-tree name override.
4. The preferred entry, when present, is `pc_x86_64_bios_defconfig`, the source's BIOS PC sample. `qemu_x86_64_defconfig` is a separate sample for a QEMU emulated machine. The guide does not suggest EFI-only presets for this BIOS ISO workflow.

These names identify source-provided samples, not universal hardware support. The source controls their kernel, packages, firmware and post-build actions. A sample may also generate a disk image. Offering its catalogue entry does not prove its effective configuration, an ISO build or a successful boot.

## Review the replacement

The guide shows the exact preset name, its source directory and the output configuration that will be replaced. Applying the preset replaces existing package and kernel choices. It does not edit the source preset itself.

Select **Replace this output configuration with the selected PC preset**, then **Apply this PC starting point**. Merely browsing or selecting an entry does not apply it. Changing the selected entry clears replacement consent. A fresh catalogue, workspace change or external configuration change also invalidates the earlier selection and consent.

The existing configuration service saves the previous configuration in its bounded session undo history and restores it if reconciliation fails. Use another output directory before applying if both configurations must remain independently available. Undo is a session recovery mechanism, not a durable backup or permission to overwrite unrelated outputs.

To undo a completed replacement, review permission for the changed configuration, choose **Inspect configuration** in the configuration editor, then **Queue undo**. Inspect the returned result. Undo changes the scope again, so review permission again before continuing with the ISO guide. Do not assume a lost response means the configuration was unchanged.

## Continue after application

The guide checks the returned effective values for `BR2_x86_64` and `BR2_LINUX_KERNEL`. Missing values remain incomplete. A preset result never enables ISO building by itself.

Changing configuration invalidates the previous permission scope. Review source execution permission again, then check and configure the ISO profile through its existing steps. Each approval is explicit. No preset application automatically grants permission, applies the ISO profile or starts a build.

## Unavailable and stale results

If neither recognized source name exists, the guide reports that no supported starting point was found. Advanced configuration and the complete existing defconfig catalogue remain available. It does not substitute a different architecture, external preset or invented universal PC configuration.

Expired permission, changed catalogue revisions, missing runtimes and unsuccessful reconciliation leave the result unconfirmed. Refresh the source catalogue and review the required permission before retrying. A delayed response after a workspace or configuration change is ignored; no automatic retry loop runs.

Verification is separate: renderer fixtures establish selection, consent, request binding and stale-result handling. Actual Buildroot reconciliation, native runtime behavior, ISO production and boot require their own evidence.

[Cantonese guide](beginner-board-presets.zh-HK.md)
