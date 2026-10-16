# Image presets and target account plans

## Presets

The configuration workspace offers additive minimal, desktop, server and appliance presets. Minimal requests BusyBox; server also requests Dropbear; appliance also requests SquashFS. Minimal does not strip an existing configuration. Desktop selects Weston, Cage or X.Org when its Boolean symbol exists and is assignable in the selected source's semantic Kconfig tree. X.Org is a display server, not a complete desktop shell.

Read capabilities, choose a preset, preview requested symbols, confirm, then apply. The operation uses the existing configuration service's revision, execution trust, reconciliation, rollback and undo. Missing symbols, unsatisfied dependencies or stale revisions stop application. Reconciliation may change requested values; the panel shows effective results. The preview is a configuration plan, never a rendered desktop or proof of a bootable target.

## Password-locked account and public-key plan

The separate account panel accepts a non-root lowercase account name, a fixed UID/GID from 2000 through 60000, and a single Ed25519 public key selected through the native file picker. The selected public key is held only in host process memory and usable for at most 15 minutes (expired selections are removed on the next operation), represented to the renderer only by an opaque session handle. The parser checks the SSH binary structure and rejects other key types, key options, multiple keys and private-key material. Comments are discarded. Neither key contents nor input paths are returned to the renderer or added to logs.

Preview requires a selected SSH server, execution trust, current Kconfig semantics, the three string settings, the source's users/permissions implementation and manual files, and the default skeleton's account databases. It binds source hashes, configuration revision, existing table contents, selected runtime mappings and account choices. Existing tables are checked for name or ID collisions; overlays containing the account's home or identity databases stop the plan. Unsupported variable-expanded paths, paths outside granted roots, custom skeletons, missing files or unsupported runtime mappings stop the operation instead of guessing.

After explicit confirmation, apply rechecks the plan and creates a new uniquely named directory inside the granted output. Exclusive creation preserves any existing directory. It contains a users table with a locked password (`!`), a home-directory overlay with `.ssh/authorized_keys`, and a permissions table setting the home and `.ssh` to 0700 and the public-key file to 0600 with the selected UID/GID. Configuration references are appended to existing `BR2_ROOTFS_USERS_TABLES`, `BR2_ROOTFS_OVERLAY` and `BR2_ROOTFS_DEVICE_TABLE` values and reconciled. Existing files and configuration lists are not replaced. A reconciliation failure retains generated files for recovery; the configuration service restores its prior configuration. An effective-value mismatch remains visibly incomplete.

Supported runtime mappings are the existing container `/source` and `/output` mounts (plus granted external mounts), and WSL projects carrying explicit Linux source/output storage paths. Other mappings remain unsupported. This operation prepares target inputs, not a host account or a live target. It neither generates private keys nor accepts passwords. Password enrollment remains unavailable. Locked-account behavior differs between SSH implementations; successful authentication, account creation in an image, shell availability and ownership must still be verified on the built target. Package-defined account collisions also remain the target build's responsibility.

The mechanism follows the [Buildroot user manual](https://buildroot.org/downloads/manual/manual.html), sections 9.5, 9.6, 25 and 26. Selected source capability checks remain decisive when a source differs from the current manual.

## Verification status

Implementation was prepared without tests, static analysis, runtime execution or captures in the requested fast-release mode. No target build, account provisioning, host account creation or SSH login was performed. Actual desktop evidence, target account creation/authentication, secure password enrollment and runtime acceptance remain incomplete.
