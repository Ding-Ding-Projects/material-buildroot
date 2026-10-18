# Project wiki

[香港粵語](Home.zh-HK.md) · [Documentation index](../README.md)

Material Buildroot is a Windows desktop workspace with project, configuration and execution workflows. Start with the [beginner guide](../features/guided-documentation.md), then follow [Getting started](Getting-started.md).

Normal unsigned Squirrel.Windows releases exist. [Build 233.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.1-build.233.1), source `21bf4ad4c6e1fb19a8a48fae57cdca6d63777c6a`, has verified normal installed startup, About navigation and return to the workspace. See the [recorded installed-release boundary](../../README.md). Build 234.1 was subsequently published, but its installation is not proved here. The current ISO interface candidate must not be treated as already included in an accepted installed release.

Real WSL/Docker checks and a full non-root BIOS GRUB2 ISO production run are recorded. The unchanged 12,357,632-byte image booted on the documented QEMU 10.0.13/Cirrus/RTL8139 profile and completed console, temporary-file, DHCP, internal gateway and shutdown checks. Read the [production evidence](../evidence/iso-production/README.md) and [bounded boot evidence](../evidence/iso-boot/README.md). Other hardware, firmware, persistence, Internet connectivity and candidate native release acceptance are separate requirements. The [current handoff](../../HANDOFF.md) and [roadmap](../../ROADMAP.md) retain those unfinished states.

- [Getting started with the plan](Getting-started.md)
- [Common questions](FAQ.md)
- [Implementation phases and checklist](../../ROADMAP.md)
- [Confirmed decisions and open questions](../../DECISIONS.md)
- [Buildroot and runtime constraints](../planning/buildroot-constraints.md)
- [Task-oriented article catalog](../features/README.md)
- [HTTP API workflow and non-HTTP boundaries](../postman/api-workflow.md)

The complete current wiki content is available directly on this documentation website. The separate GitHub wiki repository returned Repository not found. Its synchronization remains unverified; the existing source wiki is included directly during documentation generation.
