# Common questions

[香港粵語](FAQ.zh-HK.md) · [Wiki home](Home.md)

## Can I download Material Buildroot now?

Normal unsigned Squirrel.Windows installers are published in the [release history](https://github.com/Ding-Ding-Projects/material-buildroot/releases). Select an actual release and read its attached files and source information. A published package is not evidence of installation, update, Buildroot execution or complete feature acceptance. The [current handoff](../../HANDOFF.md) separates implementation, build and deferred acceptance.

## Does Buildroot run directly on Windows?

The desktop application targets Windows. Buildroot itself runs in Linux through WSL 2 or Docker. The source implements per-project runtime selection; real runtime and restart acceptance remain separately tracked. See [project workflows](../features/projects/project-workflows.md) and [runtime setup](../features/execution/setup.md).

## Is this only a form for entering command-line options?

No. The required design includes typed controls, guided configuration, visual dependency explanations, rich package and overlay editors, and appropriate keyboard-accessible canvas editors. An expert terminal supplements those controls.

## Will VMware and VirtualBox be supported?

Both are required initial guest targets. Image presets, hardware and networking controls, creation, import and launch are planned. Success requires real boot, login or console access, networking, disk persistence and graceful guest shutdown.

## Is the browser companion available?

The source implements an opt-in HTTPS desktop companion and a browser consumer, using explicit pairing, exact approved origin, native host review, scoped sessions and CSRF protection. Actual paired-browser/TLS/LAN acceptance remains open. The documentation website has no ambient host authority: desktop access requires the separately configured and approved companion session. Read the [protocol and privacy boundaries](../security/companion.md) and [API collection guide](../postman/api-workflow.md) before connecting. An operation receipt is not proof that a delegated build finished.

## How is completion tracked?

The [roadmap](../../ROADMAP.md) is authoritative. Each checkbox needs the evidence required by its task and phase. Publishing a plan does not complete an application feature. The site displays the source-controlled state; it cannot tick tasks on behalf of contributors.

## Which decisions still need answers?

Read the [decision log](../../DECISIONS.md) for the recorded cloud destinations, remote targets and flashing routes. Source implementations are documented in [cloud destinations](../features/cloud-destinations.md), [remote runtimes](../features/remote-runtimes.md) and [flashing and installation](../features/flashing-installation.md). Their remaining runtime and platform limitations stay explicit; a recorded decision or authored adapter is not acceptance.
