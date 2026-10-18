# Installer startup repair continuation

## Installer startup repair result, 2026-10-17

The component-discovery syntax repair is published in normal release [v0.1.0-build.230.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0-build.230.1), source d159bb1f33212002a606fa8672210d5d42afd98a. Release production, release timing annotation and documentation deployment passed. Setup.exe download SHA-256 matches b373285e67ae3af7b49cb30228387727ffb91aeb29bd251f7b2f39ad124861cf. Production syntax checks passed for 134 modules; configuration checks passed 12 with 3 skipped, and the new discovery regression passed.

Installed startup acceptance remains incomplete. The owner reports nothing or a blank window after attempting the installer and normal shortcut. Automated installer/readback resolved through the agent application's package-local cache, so it does not establish repair of the normal installation. Hidden diagnostic copies reach navigation start but not document readiness; black native captures and timed-out CDP commands are not accepted runtime evidence. Production source was not altered by diagnostic instrumentation. The three originally reported application processes were terminated after explicit owner authorization.

Continue through [issue #6](https://github.com/Ding-Ding-Projects/material-buildroot/issues/6). Clarify whether the normal shortcut produces no window or a blank visible window, complete a briefly visible isolated check only after explicit owner consent, resolve the actual installed target and finish startup acceptance. Preserve settings and data. Docker server 29.8.2 responds; WSL lists docker-desktop, with a separate Buildroot WSL distribution still unverified. This bounded repair does not adopt the broader product backlog.
