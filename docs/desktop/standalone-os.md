# Standalone container operating systems

The Images workspace is gaining a guided standalone Linux OS creator. It accepts a Linux x86-64 container image, a local image archive, or a supported Compose project. A WSL build produces an independent BIOS ISO containing its own Linux kernel, root filesystem and container runtime. A successful media build is separate from a successful boot or healthy application.

## Workflow

Choose the source and a non-root WSL 2 environment, configure kiosk or console use and persistent or temporary data, then preview the plan before approving execution. Native pickers grant only the chosen input. The application owns build, cancellation, status, boot verification and export actions. Export uses the operating system's Downloads folder and preserves existing files.

Persistent mode uses a separate volume explicitly labelled for this appliance. The boot service never formats a discovered disk. Temporary mode loses records when the guest stops. Source selection is not a universal compatibility promise.

## Source compatibility and execution consent

Source preparation inspects a small fixed set of tracked files at the selected commit to identify a compatible build recipe. Repository origins are parsed strictly as credential-free GitHub addresses and remain local selection metadata; no maintainer-specific origin allowlist is shipped. A matching package name or file layout is compatibility evidence, not cryptographic trust or permission to execute source code.

Native source grants, pinned primary and companion revisions, clean tracked inputs and explicit execution approval remain required. The renderer cannot select an adapter or supply commands. Untracked deployment files and existing data are omitted from the isolated source snapshot.

## Personal wording and tunnels

An optional local personal-wording JSON can be included in private media. It must validate in full, stays out of logs and public receipts, and activates only on supported private surfaces after authentication. Media containing it must not be published. A third-party application needs its own compatible loader for its internal labels.

Tunnel choices are off, a temporary Cloudflare Quick Tunnel, and an account-owned named tunnel. Credentials are enrolled inside the guest after boot, never embedded into the ISO or printed in process arguments. Activation requires an explicit action and actual service readiness. A configured tunnel is not proof of public reachability. Quick Tunnels have changing addresses and do not support Server-Sent Events; use a named tunnel for workloads requiring that transport.

## Verification status

Implementation and focused checks are in progress. No current-candidate WSL build, ISO, independent boot, kiosk, LAN, tunnel, persistence, Job 2027 or custom Home Assistant acceptance is claimed. Each requires separate source-bound evidence from the running application. Existing deployments and source history remain preserved.
