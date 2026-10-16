# Native file capabilities

Native dialogs establish session-only file authority. Renderer-supplied paths never establish grants. Project grants are owner-bound random identifiers, expire after five minutes and carry read or read/write access. Trusted host import adapters can issue read-only single-file grants with `importFile`; this method is not exposed to the renderer. Existing project folder selection and tool input/output dialogs remain the native acquisition routes.

Every grant acquisition and resolution inspects the volume root and each existing component, records device/inode/birth identity and compares the exact native real path. Symbolic links, junctions that resolve elsewhere, hardlinked files, special files, case aliases, network/device paths and Windows reserved names or trailing-dot/space aliases are rejected. Replacing a parent or selected object invalidates the grant. A changed project grant is revoked. New outputs require an existing inspected parent and cannot overwrite an existing file.

The main-only `translate` adapter resolves its grant before calling a trusted host converter and resolves and compares the inspected object again afterwards. It accepts only a normalized absolute POSIX result, without control characters, backslashes or double-leading slashes. The converter is a host function, never renderer code or a command string. Existing execution adapters continue to own their WSL and container path mappings; this adapter does not admit an additional runtime or shell command.

## Limits and deferred verification

Path inspection is not an operating-system handle-relative sandbox. A concurrent external process can still race a later path-based open after resolution. Consumers must resolve immediately before use, use exclusive creation for outputs and retain existing execution admission rules. Unrecognized reparse mechanisms that preserve both the native path and object identity need native handle-based inspection before any stronger claim is possible.

This implementation was prepared under the requested speed mode. Tests, static analysis, independent review, runtime interaction and screenshots were deliberately deferred. PH02-T03 acceptance remains unverified, including native Windows reparse/case behavior and asynchronous translation cases.
