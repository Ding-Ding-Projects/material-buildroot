# Common questions

## Can I download Material Buildroot now?

No installer has been published. This website provides the implementation plan, decisions, design handoff and checklist. It does not present a prototype as an available application.

## Does Buildroot run directly on Windows?

The planned desktop application runs on Windows. Buildroot itself runs in Linux through WSL 2 or Docker. Projects will remember the selected backend.

## Is this only a form for entering command-line options?

No. The required design includes typed controls, guided configuration, visual dependency explanations, rich package and overlay editors, and appropriate keyboard-accessible canvas editors. An expert terminal supplements those controls.

## Will VMware and VirtualBox be supported?

Both are required initial guest targets. Image presets, hardware and networking controls, creation, import and launch are planned. Success requires real boot, login or console access, networking, disk persistence and graceful guest shutdown.

## Is the browser companion available?

No. A future companion must use explicit desktop pairing and authenticated local or LAN access. This public static website has no host access and does not start builds or connect to local services.

## How is completion tracked?

The [roadmap](../../ROADMAP.md) is authoritative. Each checkbox needs the evidence required by its task and phase. Publishing a plan does not complete an application feature. The site displays the source-controlled state; it cannot tick tasks on behalf of contributors.

## Which decisions still need answers?

See P40–P42 in the [decision log](../../DECISIONS.md) for exact cloud destinations, remote execution targets and flashing or guest-installation routes. Proposed choices do not become defaults without an answer.
