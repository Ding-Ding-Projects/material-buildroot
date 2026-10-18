# Common questions

[香港粵語](FAQ.zh-HK.md) · [Wiki home](Home.md)

## Can I download Material Buildroot now?

Normal unsigned Squirrel.Windows installers are published in the [release history](https://github.com/Ding-Ding-Projects/material-buildroot/releases). Select an actual release and read its attached files and source information. A published package alone is not installation proof. [Build 233.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.1-build.233.1), source `21bf4ad4c6e1fb19a8a48fae57cdca6d63777c6a`, has separately verified normal installed startup and About/workspace navigation, recorded in the [delivery boundary](../../README.md). Build 234.1 publication does not establish its installation. The current ISO candidate interface still needs its own native release acceptance.

## Does Buildroot run directly on Windows?

The desktop application targets Windows. Buildroot itself runs in Linux through WSL 2 or Docker. Per-project runtime selection and real WSL/Docker checks exist. A full non-root BIOS GRUB2 ISO build also succeeded; see [production evidence](../evidence/iso-production/README.md). This does not establish every runtime, restart or target combination. See [project workflows](../features/projects/project-workflows.md) and [runtime setup](../features/execution/setup.md).

## Is this only a form for entering command-line options?

No. The required design includes typed controls, guided configuration, visual dependency explanations, rich package and overlay editors, and appropriate keyboard-accessible canvas editors. An expert terminal supplements those controls.

## Will VMware and VirtualBox be supported?

Both remain required guest targets with their own acceptance requirements. The current demonstrated BIOS ISO consumer is QEMU 10.0.13 with Cirrus VGA and RTL8139, not proof of VMware or VirtualBox acceptance. Its unchanged image reached Linux 6.12.9, accepted console commands, read and wrote a temporary file, obtained DHCP, reached the internal gateway and shut down normally. The initial RAM filesystem is ephemeral. Other QEMU profiles had preserved display, driver or early kernel limitations. Read the [exact boot evidence and limits](../evidence/iso-boot/README.md).

## Is the browser companion available?

The source implements an opt-in HTTPS desktop companion and a browser consumer, using explicit pairing, exact approved origin, native host review, scoped sessions and CSRF protection. Actual paired-browser/TLS/LAN acceptance remains open. The documentation website has no ambient host authority: desktop access requires the separately configured and approved companion session. Read the [protocol and privacy boundaries](../security/companion.md) and [API collection guide](../postman/api-workflow.md) before connecting. An operation receipt is not proof that a delegated build finished.

## How is completion tracked?

The [roadmap](../../ROADMAP.md) is authoritative. Each checkbox needs the evidence required by its task and phase. Publishing a plan does not complete an application feature. The site displays the source-controlled state; it cannot tick tasks on behalf of contributors.

## Which decisions still need answers?

Read the [decision log](../../DECISIONS.md) for the recorded cloud destinations, remote targets and flashing routes. Source implementations are documented in [cloud destinations](../features/cloud-destinations.md), [remote runtimes](../features/remote-runtimes.md) and [flashing and installation](../features/flashing-installation.md). Their remaining runtime and platform limitations stay explicit; a recorded decision or authored adapter is not acceptance.
