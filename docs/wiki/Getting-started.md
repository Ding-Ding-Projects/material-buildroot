# Getting started

[香港粵語](Getting-started.zh-HK.md) · [Wiki home](Home.md)

## Take one small step

1. Read the [beginner introduction](../features/guided-documentation.md). Its browser choices teach the workflow without executing anything.
2. Choose a trusted Buildroot source and a separate output directory. Source is the recipe; output is where generated files are made. Keep previous results separate when needed.
3. In the installed application, select and authorize a suitable WSL 2 distribution or admitted Docker Linux build image. Buildroot does not execute natively on Windows. Use a non-root build account.
4. For the current ISO candidate, select an x86-64 source with Linux enabled and follow the [BIOS ISO workflow](../desktop/iso-workflow.md). Check requirements, review and apply the plan, then build only after effective configuration is confirmed.
5. Refresh the real job and inspect its output. A saved plan is not a successful build. Read the [field guides](../desktop/iso-fields/README.md) before interpreting an uncertain result or retrying.

## What is available and what is proved?

Normal unsigned Squirrel.Windows installers are available in the [release history](https://github.com/Ding-Ding-Projects/material-buildroot/releases). Unknown-publisher warnings are expected. [Build 233.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.1-build.233.1), source `21bf4ad4c6e1fb19a8a48fae57cdca6d63777c6a`, has verified normal installed startup, About navigation and return to the workspace. See the [delivery record](../../README.md). Later build 234.1 publication is separate; its installation is not proved here. The new ISO candidate interface is not thereby an accepted installed release.

A real non-root build produced a 12,357,632-byte BIOS GRUB2 ISO, SHA-256 `1d75d40b94e3c441aaaead9109f8074f62334931e1d84a576f3d7a36ec566dba`. The unchanged image booted on QEMU 10.0.13 with Cirrus VGA and RTL8139. Linux 6.12.9 console commands, temporary-file read/write, DHCP, two internal gateway replies and graceful shutdown passed. This is internal guest networking, not Internet or LAN proof; the RAM filesystem does not prove persistence across restart. Read the [production receipt](../evidence/iso-production/README.md) and [consumer limits](../evidence/iso-boot/README.md).

The current guided profile is BIOS-only. UEFI, hybrid USB and VMware/VirtualBox acceptance remain separate. Broader VMDK, VDI and OVA plans do not establish delivered behavior. Companion source exists; actual paired-host TLS/LAN acceptance remains separately tracked.

## For the next implementer

Start with the [current handoff](../../HANDOFF.md), [phased roadmap](../../ROADMAP.md) and [assignment inventory](../planning/implementation-queue.json). Preserve source-bound proof and leave acceptance-dependent tasks unchecked until their own evidence exists. The [feature inventory](../planning/feature-coverage.md) records required desktop, documentation and companion surfaces independently. Current ISO production and boot evidence does not complete unrelated features or every target combination.
