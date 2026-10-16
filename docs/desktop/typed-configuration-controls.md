# Typed configuration controls

[香港粵語](typed-configuration-controls.zh-HK.md)

The configuration workspace uses real Kconfig symbol types from the admitted parser. Boolean switches, assignable tristate selections, decimal integers, hexadecimal values and strings send completed edits to a serial reconciliation queue. Numeric and string controls submit on change rather than on every keystroke.

The queue takes the latest returned revision for each operation. Undo enters the same queue after earlier edits. A rejected or uncertain request stops automatic draining and retains the pending edits. The user can inspect and explicitly retry that queue or discard it. Source execution permission remains mandatory and may require renewal when configuration changes invalidate the admitted scope.

The host replaces `.config` atomically, remembers whether the original file existed, and restores that state when reconciliation fails. Undo history is limited to twenty applications within the current host session, is bound to the source/output/domain binding and expected revision, and rejects external changes. Successful undo updates the next history entry's expected revision. History is not persisted across application restart.

Requested/effective differences include symbols added by reconciliation as well as changed or removed values. The panel retains the latest returned differences beside the controls. Parser help, dependency expressions, ranges and menu paths remain source-provided.

## Verification status

Implemented for production compilation. Runtime, interaction, restoration, concurrency and accessibility acceptance were not executed in the current release mode. This document does not claim those checks passed.
