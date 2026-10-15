# Desktop shell capture evidence

These are genuine captures of the packaged desktop executable built from commit `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd`. They show the current bounded shell and saved language behavior, not a complete Buildroot management product. Later documentation-only commits do not change this captured source identity.

## Captured surfaces

![Projects empty workspace in bilingual dark mode at 1440 by 960](projects-dark.png)

![Settings in bilingual dark mode at 1440 by 960](settings-dark.png)

[The exact inventory](inventory.json) records source, executable, archive and capture hashes, capture timestamps, state tuples and interaction identities. The original PNG bytes were staged without editing or recompression. Private launch, process-ownership, layout, interaction, privacy and cleanup receipts are retained outside this repository.

## Verified behavior

The settings matrix covered 48 tuples: three languages, two explicit themes, two viewports (1440 by 960 and 960 by 640), and four runtime scale factors (1, 1.25, 1.5 and 2). All 48 captures were inspected. The 48 matrix layout receipts and four startup layout receipts passed validation, 52 passed and zero failed. No horizontal document overflow was measured. Settings content below the viewport remains vertically scrollable.

English, Hong Kong Cantonese and bilingual settings were saved through the rendered controls and restored after actual process restarts. All nine language/theme-label combinations were correct. The repaired dark foreground and selected-theme wording were verified against earlier failing captures. Native maximize/restore and background Tab focus were exercised; hidden-desktop enumeration observed minimize geometry of 237 by 39 followed by restored/maximized geometry of 2582 by 1550. Event subscription, unsubscribe and bounded invalid IPC rejection were verified on the earlier source candidate; those results are historical interaction evidence, not silently relabeled as a new-candidate security audit.

The four current matrix observation intervals recorded zero console errors, unhandled exceptions or page errors. This excludes startup history and native process diagnostics. All four current product process trees were independently proved absent and their named hidden desktops closed afterward.

## Limits

Native window DPI was 144 where measured. The matrix uses actual runtime scale switches followed by matching CDP viewport emulation; it does not prove independently configured operating-system DPI at 100%, 125%, 150% and 200%. No physical display settings were changed. The available isolated virtual-display capability is Linux Xvfb and does not provide that Windows proof.

Captures are top-of-scroll views. Some first light-theme captures preserve the short language-control enable transition; the following smaller-viewport captures show the enabled text. The two published dark captures are readable and inspected. Viewport emulation is not native window-resize coverage. Programmatic DOM control activation proves renderer wiring rather than physical pointer targeting. No installer, fresh operating-system installation, Buildroot execution, WSL or container workflow, full accessibility audit, or complete required-feature coverage is claimed. Appearance remains session-only as the interface explicitly states.
