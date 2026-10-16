# Minecraft server manager

The Tools workspace contains a dedicated Minecraft manager with Distribution, Configuration, Plugins and mods, and Run and stop views. All controls have English, Cantonese and bilingual labels. Selecting a server directory uses the native directory picker and explicit execution consent. Directory grants expire when the application closes.

## Distributions

Java discovery retains the complete official Mojang version catalogue. A catalogue entry is not proof that a dedicated server exists for that version. Vanilla installation verifies the metadata SHA-1, then the server archive's published size and SHA-1, and creates `server.jar` without replacing an existing file. The returned result includes the required Java major version where Mojang supplies it; an absent field remains unknown.

Paper discovery uses the [official downloads service](https://docs.papermc.io/misc/downloads-service/) with an identifying User-Agent. Choose a version, load its stable builds, explicitly select a build and accept its licence. Installation verifies the exact published size and SHA-256 before creating `server.jar`. It never silently chooses a different Minecraft version, replaces a file, installs a runtime, or starts the downloaded server.

Fabric discovery lists the official game and loader metadata. Its server launcher installation remains manual. Bedrock discovery lists recognized current official download links. No complete authoritative historical Bedrock catalogue or reviewed archive manifest is bundled, so automatic Bedrock archive installation remains unavailable. Download and install the official distribution independently before selecting its directory. Missing history is not treated as supported.

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
| SSH process | Uses the user-selected, hash-admitted OpenSSH executable and existing SSH configuration to start a preinstalled Linux server with a fixed command. | Existing key authentication, strict known-host checking, non-root remote identity and an explicit native launch confirmation. No password collection, host-key acceptance or remote provisioning. |
| SSH container | Uses that same SSH boundary to start the uniquely owned container on the selected host. | All SSH requirements plus an already installed Docker daemon and preloaded compatible digest-pinned image. |

Container publication maps the configured port to the same port inside the container, using TCP for Java and UDP for Bedrock. The server's own properties must agree with the selected port. Bedrock IPv6 publication and additional ports are not configured automatically.

The server entry point is `server.jar` for Java, `bedrock_server.exe` for local Windows Bedrock, and `bedrock_server` for Linux Bedrock. Existing authenticated SSH aliases are accepted, not renderer-provided commands or arbitrary executable paths. The native confirmation identifies the actual target and directory. Local server entry bytes are hashed before confirmation and checked again before execution.

## Lifecycle and connection state

Startup reports `process-started`, never game readiness. Status reports the observed process state and explicitly returns `readinessVerified: false`. Java and Bedrock process stop writes the fixed `stop` console command; container stop addresses only the generated container name. The manager does not force-kill a server or change host power state.

An unexpected SSH exit reports `connection-lost`, preserving uncertainty about the remote process. A disconnected process is not declared stopped, and blind replacement is refused. An SSH container can receive a subsequent targeted stop attempt. Confirm exit before closing the application. Shutdown requests graceful stop and reports an unverified result if the owned process does not settle in the bounded wait.

Ownership records are session-local. There is no durable process adoption, reconnect reconciliation, health probe, restart scheduler, remote file transfer, remote installation or world migration in this change.

## Delivery status

This is a source implementation under the requested build-only delivery mode. No tests, static analysis, review pass, runtime invocation, server installation, container execution, SSH execution or screenshots were performed for this change. Build/package results are recorded separately by the release coordinator and do not establish runtime acceptance.

The complete server-manager requirement remains partial. Outstanding work includes full version-bound configuration descriptors, historical Bedrock acquisition, Fabric provisioning, remote provisioning, players/permissions, world/backup/restore workflows, command/rule editors, schedules, import/export/history, extension dependency/update/remove/rollback, persistent managed identities and reconnect behavior, and the edition/version/flavour/target/extension acceptance matrix. Existing screenshots predate this manager and are not evidence of its new behavior.
