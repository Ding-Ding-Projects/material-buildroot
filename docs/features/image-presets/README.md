# Image preset configuration

The configuration workspace offers additive minimal, desktop, server and appliance presets. Minimal requests BusyBox; server also requests Dropbear; appliance also requests SquashFS. Minimal does not strip an existing configuration. Desktop additionally selects Weston, Cage or X.Org when its Boolean symbol exists and is currently assignable in the selected source's semantic Kconfig tree. X.Org is a display server, not a complete desktop shell.

Read capabilities, choose a preset, preview requested symbols, confirm, then apply. The operation uses the configuration service's source/output revision, execution trust, reconciliation, rollback and undo. A stale revision, missing semantic model, missing symbol or unsatisfied dependency stops application. Reconciliation may change requested values; the panel shows the effective results. Changing selection invalidates confirmation. Refresh capabilities after an apply or an external configuration change.

The preview is a configuration plan, not a rendered desktop or proof of a bootable target. Account provisioning and credential entry are intentionally unavailable until a host-only protected provisioner is connected. No passwords, account records or SSH keys are accepted, generated, exported or stored by this feature. Selecting Dropbear adds its package only, and does not establish authentication or prove access. Review target access settings before deployment.

Implementation was prepared without tests, static analysis, runtime execution or captures in the requested fast-release mode. Runtime acceptance, graphical desktop evidence, non-root account provisioning, authorized-key installation and protected credential ingestion remain incomplete. No target build or provisioning was performed.
