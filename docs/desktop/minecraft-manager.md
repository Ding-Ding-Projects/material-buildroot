# Minecraft server manager

The Tools workspace contains a dedicated Minecraft manager with Distribution, Configuration, Plugins and mods, and Run and stop views. All controls have English, Cantonese and bilingual labels. Selecting a server directory uses the native directory picker and explicit execution consent. Directory grants expire when the application closes.

## Distributions

Java discovery retains the complete official Mojang version catalogue. A catalogue entry is not proof that a dedicated server exists for that version. Vanilla installation verifies the metadata SHA-1, then the server archive's published size and SHA-1, and creates `server.jar` without replacing an existing file. The returned result includes the required Java major version where Mojang supplies it; an absent field remains unknown.

Paper discovery uses the [official downloads service](https://docs.papermc.io/misc/downloads-service/) with an identifying User-Agent. Choose a version, load its stable builds, explicitly select a build and accept its licence. Installation verifies the exact published size and SHA-256 before creating `server.jar`. It never silently chooses a different Minecraft version, replaces a file, installs a runtime, or starts the downloaded server.

Fabric discovery lists the official game and loader metadata. The continuation below adds explicit official launcher acquisition; later runtime installation remains separate. Bedrock discovery lists recognized current official download links. No complete authoritative historical Bedrock catalogue or reviewed archive manifest is bundled, so automatic Bedrock archive installation remains unavailable. Download and install the official distribution independently before selecting its directory. Missing history is not treated as supported.

Search filters the catalogue without removing entries from its backing inventory. Additional matching entries can be loaded in batches of 100.

## Configuration

Select the correct edition, load the existing configuration, and edit the displayed properties: server name/MOTD, world folder name, port, player limit, difficulty, game mode and allowlist requirement. Online authentication remains enabled. Port, player and memory bounds are application admission limits; they do not claim universal historical compatibility.

Saving preserves unrecognized property lines and creates a uniquely named backup before replacing an existing configuration. Duplicate recognized keys are consolidated. Java requires explicit EULA acceptance; an existing nonaccepted EULA file is not silently overwritten. The manager blocks configuration changes for a directory it is actively managing. Stop any externally started server before saving. These settings require restart, and no live configuration or world migration is implied.

## Extensions

Choose the exact Minecraft version and Paper or Fabric loader, then enter a Modrinth project identifier. The manager only offers releases whose declared game version and loader match both selections. The host independently checks those values again before installation. Choose the existing `plugins` or `mods` directory as appropriate and explicitly accept executable code and its licence.

The extension download requires an allowlisted HTTPS origin, declared size, SHA-512, and JAR archive signature. Installation never replaces an existing file. Releases declaring required dependencies are refused for automatic installation because dependency resolution is not implemented. Update, remove, dependency orchestration and rollback remain unavailable. A compatibility declaration is not runtime acceptance.

## Execution targets

| Target | Actual operation | Requirements and limits |
|---|---|---|
| Local process | Starts the selected trusted Java or Bedrock server with fixed arguments and a private console input pipe. | Java is selected through the verified executable picker. Bedrock must already be installed. Root execution is refused on platforms exposing a Unix UID. |
| Local container | Starts a uniquely named Docker container with an ownership label, UID/GID 1000, dropped capabilities, no-new-privileges, memory/CPU bounds and loopback-only port publication. | The compatible image must already be present under its exact SHA-256 digest. No automatic image pull. The server directory must be writable by UID/GID 1000. |
| SSH process | Uses the user-selected, hash-admitted OpenSSH executable and existing SSH configuration to start a preinstalled Linux server with a fixed command. | Existing key authentication, strict known-host checking, non-root remote identity and an explicit native launch confirmation. No password collection or host-key acceptance. File provisioning uses the separate preview workflow below. |
| SSH container | Uses that same SSH boundary to start the uniquely owned container on the selected host. | All SSH requirements plus an already installed Docker daemon and preloaded compatible digest-pinned image. |

Container publication maps the configured port to the same port inside the container, using TCP for Java and UDP for Bedrock. The server's own properties must agree with the selected port. Bedrock IPv6 publication and additional ports are not configured automatically.

The server entry point is `server.jar` for Java, `bedrock_server.exe` for local Windows Bedrock, and `bedrock_server` for Linux Bedrock. Existing authenticated SSH aliases are accepted, not renderer-provided commands or arbitrary executable paths. The native confirmation identifies the actual target and directory. Local server entry bytes are hashed before confirmation and checked again before execution.

## Lifecycle and connection state

Startup reports `process-started`, never game readiness. Status reports the observed process state and explicitly returns `readinessVerified: false`. Java and Bedrock process stop writes the fixed `stop` console command; container stop addresses only the generated container name. The manager does not force-kill a server or change host power state.

An unexpected SSH exit reports `connection-lost`, preserving uncertainty about the remote process. A disconnected process is not declared stopped, and blind replacement is refused. An SSH container can receive a subsequent targeted stop attempt. Confirm exit before closing the application. Shutdown requests graceful stop and reports an unverified result if the owned process does not settle in the bounded wait.

Active native-process handles are session-local. The continuation below adds durable records and explicit container reconnection, but not durable native-process adoption, a health probe, restart scheduling, remote runtime installation or world migration.

## Delivery status

This is a source implementation under the requested build-only delivery mode. No tests, static analysis, review pass, runtime invocation, server installation, container execution, SSH execution or screenshots were performed for this change. Build/package results are recorded separately by the release coordinator and do not establish runtime acceptance.

The complete server-manager requirement remains partial. The continuation below records the added ordinary management consumers and the outstanding completion boundary. Existing screenshots predate this manager and are not evidence of its new behavior.

## Management workflow continuation

This source continuation adds the Worlds, Players, Console actions, and Profiles and schedules views. It supersedes the earlier paragraphs describing those consumers as absent. No runtime or acceptance evidence is added by this source change.

### Fabric launcher acquisition

Current official metadata admits the selected game version, stable loader and stable installer combination before acquisition. The generated launcher comes directly from the official HTTPS origin with redirects refused, a bounded download, JAR inventory checks and a locally recorded SHA-256. Explicit licence and later-runtime-download consent are required. The API supplies no separately published digest for this generated launcher, so the receipt states `publishedDigestVerified: false`. This installs only the bootstrap JAR. It neither executes the launcher nor claims that its later runtime dependencies are installed.

### World backup and restore

The Worlds view discovers local directories containing `level.dat`; Bedrock uses the server directory beneath `worlds`. A preview requires the declared edition/version/flavour, stopped-server confirmation and a native destination grant. It inventories at most 100,000 regular files, 16 GiB and 32 directory levels, rejects unsafe paths and symbolic links, and records per-file SHA-256 plus an inventory digest. Preview authority expires after ten minutes.

Execution rereads the source, refuses changed content or an existing destination, copies with no-overwrite semantics and verifies copied bytes. Failed or cancelled copies retain `.material-transfer-incomplete` and are not usable worlds. Backups include only relative file names, hashes and the declared compatibility tuple. Restore requires a matching manifest and tuple. This is a byte-preserving copy, not proof of the world creator version. No original is replaced, removed, activated or migrated. Externally managed servers must be independently confirmed stopped. The later typed SSH workflow below adds transfer of a completed backup to a fresh remote directory.

### Player and permission records

Java `whitelist.json` and `ops.json`, and Bedrock `allowlist.json` and `permissions.json`, have structured read/add/edit/remove controls. Use independently verified UUIDs/XUIDs. Writes require stopped-server confirmation and the exact loaded revision, preserve unknown fields and create backups. Concurrent edits require reload. Changes require restart; the manager does not claim online identity verification.

### Typed actions and readiness observations

Player-list request, announcement, difficulty and a bounded Boolean-rule selector write fixed commands to the owned process input pipe. There is no shell-command field. Non-list actions require a distribution receipt matching the exact selected local entry bytes. Java Boolean rules are admitted only for the explicit 1.13 through 1.21.8 descriptor range. Newer semantics, snapshots, unverified remote distributions and Bedrock rule descriptors remain unavailable. Sending a command returns `appliedVerified: false`.

Bounded owned-process output can record `server-reported-ready` and a structured Java player-list observation. Raw console output is neither persisted nor exported. A readiness message is not a listener-ownership or network-connectivity probe, so `readinessVerified` stays false.

### Durable local ownership and profiles

Private application data retains the last observed ownership state and source identity. Saved PIDs never authorize native-process adoption. Unresolved prior records block blind replacement and report `ownership-unverified`. Explicit container reconnect uses native consent and checks the generated name, ownership label, non-root user and exact image through the selected transport. An unreachable or missing container remains `unreachable-or-absent`, not stopped. Reconnection does not prove game readiness.

Up to 100 named profiles store edition/version/flavour/target/port/memory values. JSON export excludes paths, host aliases, credentials, history and execution authority. Import validates every entry before adding new identities and refuses duplicates or existing-name collisions without partial application. Profile loading requires fresh directory selection and execution consent. Up to 1,000 recent metadata-only history rows record operation/state/time/server identifier; they exclude console text, announcements, player identities and credentials.

### One-time graceful-stop schedules

Choose a local time with its IANA time zone, at most 30 days ahead, for a currently managed server. The application must remain open. Pending actions can be cancelled; due actions are claimed before execution. Restart marks past pending actions missed, future pending actions requiring explicit rescheduling, and in-progress actions interrupted/unverified. It never replays them. A stop request is not an exit confirmation. Recurrence, scheduled start/restart, host shutdown and an operating-system scheduler remain unavailable.

### Remaining completion boundary

The overall requirement remains partial. Full historical/version-bound descriptors, admitted historical Bedrock acquisition, completion of Fabric runtime provisioning, remote runtime installation, world activation/migration, extension dependency/update/remove/rollback, durable native-process adoption, complete readiness/reconnect acceptance, recurring/start/restart schedules and the full version/flavour/target acceptance matrix remain unfinished. The source unit below adds typed file provisioning and world transfer. No tests, static analysis, review pass, runtime, SSH/container execution or screenshots were run for this continuation.

## Typed SSH provisioning and world transfer

The Remote transfer view prepares new directories for the existing SSH process and SSH container targets. This is a file-provisioning workflow, not a remote package manager: it never installs Java, pulls an image, starts a container/server, accepts a host key or collects a password.

### Source and destination authority

Choose the source directory through a native read grant. Java provisioning requires `server.jar` to match the selected edition/version/flavour and the manager distribution receipt SHA-256. The workflow copies that exact entry point and regenerates only the supported configuration properties, online authentication, EULA and a minimal distribution receipt. Extensions, worlds, unrecognized configuration and credential-bearing settings are excluded. Fabric remains bootstrap-only.

World transfer requires a completed manager backup with the exact declared compatibility tuple and a matching inventory digest. It sends only the inventoried world files, never local machine paths. It does not activate, overwrite or migrate a world.

Preview is local-only and does not contact the SSH host. It displays the host alias, target, exact destination, file names, sizes, hashes and an expiring aggregate digest. Execution requires that exact preview digest plus a native confirmation naming the host, destination and total size. Changing the source invalidates execution.

### Fixed authenticated transport

The host uses the previously selected and hash-admitted OpenSSH executable. Fixed arguments enforce batch authentication, strict known-host checking and bounded connection/keepalive timeouts. Existing SSH configuration supplies authentication. A successful remote preflight is required before reporting host-key verification; preview alone reports `not-contacted`.

The supported destination is a Linux host with `sha256sum`, `realpath` and GNU `dd`. Its parent directory must already exist at the exact canonical absolute path without symbolic links. The operation refuses root. SSH container preparation additionally requires UID 1000, matching the existing lifecycle adapter. The runtime or compatible digest-pinned container image must already be available for the later separate start action.

Commands are assembled exclusively by the host from fixed templates and strictly validated or quoted values. The renderer supplies structured fields, never shell text. Binary bytes stream through SSH standard input directly, without an external SCP executable or text/base64 conversion.

### Preservation and verification

The destination is created with a nonrecursive exclusive directory creation. Existing destinations are refused. A unique ownership marker identifies the in-progress transfer. Every regular file is created with exclusive-open semantics, checked remotely against its preview SHA-256, and rechecked before completion. Nested directories must resolve to their exact intended paths. The transfer writes a relative-path receipt, verifies its hash, and removes only its own incomplete marker after all checks succeed. Source files are rechecked throughout.

Server start refuses a destination retaining `.material-transfer-incomplete`. No remote source, existing destination, user file or world is removed. Cancellation terminates only this owned SSH client transport; it never launches a remote deletion command. Failed or cancelled destinations remain preserved. If the connection is lost during finalization, the final remote state remains unknown rather than being described as definitely incomplete or complete. Retry requires a new preview and a fresh destination.

Transfers are bounded to one active operation, 10 retained previews, 10,000 world files, 8 GiB of world data, 512-character relative paths, a ten-minute preview lifetime and a one-hour total operation timeout. Individual SSH operations also have bounded time and output. The UI offers cancellation and independent status refresh while a transfer is pending.

Private local transfer records retain the destination, host, state and byte/file counts for recovery across navigation and application restart. Restart never resumes a transfer automatically. Previously active records become `interrupted-remote-state-unknown` until inspected independently. Profile export still excludes these private operational records.

### Evidence and remaining scope

This unit is source-only: no remote host, SSH command, server, container, runtime installer, test, review, capture or producer was invoked. The earlier build receipt for `7218f688219c909a46223778d7b51b66315962b5` does not cover this later source.

Historical Bedrock acquisition, full Fabric runtime provisioning, remote runtime installation, remote Windows destinations, automatic extension provisioning, world activation/migration, recurring schedules and full runtime acceptance remain incomplete. Strict SSH transport and file hashes do not establish game readiness.
