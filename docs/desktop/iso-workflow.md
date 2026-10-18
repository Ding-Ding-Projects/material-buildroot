# BIOS ISO workflow

The image presets panel provides an explicit workflow for an adopted x86-64 project with Linux already enabled. It reads the selected source's live configuration capabilities.

1. **Check ISO prerequisites** reads the current revision and previews the fixed ISOLINUX, ISO9660 and initial RAM filesystem requests. Unsupported requirements remain visible. Select a suitable x86-64 Linux board before retrying.
2. Review the requests, approve and choose **Configure BIOS ISO**. The host reconciles Kconfig. **Build ISO image** is enabled only when all required values remain effective. This is configuration success, not image production.
3. **Build ISO image** submits target `all` using the saved WSL or Docker runtime and two parallel jobs. **Refresh ISO job and log** reads the actual job and first 50 log records. **Cancel ISO build** requests cancellation of that specific job and sequence.
4. **Inspect ISO output** reads `images/rootfs.iso9660` through the confined host reader. It shows bytes, SHA-256 and ISO descriptor/BIOS El Torito structural verdict. A pre-existing file may belong to an earlier build; inspection does not bind it to the latest job.

## Scope and recovery

This profile is BIOS-only. UEFI, other architectures and complete desktop/server/appliance preset coverage remain outside this route. ISO export only copies an existing ISO; it cannot create bootable optical media from a raw disk.

Configure and authorize the runtime first. Downloads and compilation may take substantial time. No shell command, arbitrary symbol or path input is accepted. Revision conflicts require a fresh plan. Values not retained after reconciliation are explicitly incomplete. Configuration undo remains in the existing editor.

Changing workspaces discards ISO planning and inspection state. Older replies cannot populate a new workspace. Other preset changes invalidate readiness. The workflow does not delete unrelated outputs. Normal incremental Buildroot production may update generated files; inspection performs no boot or mount operation.

## Verification boundary

Typed renderer fixtures verify request sequencing, disabled states, incomplete configuration, workspace isolation and inspection wording. They do not prove native IPC, real Buildroot production or bootability. Runtime acceptance separately records source/configuration, job, output hash and actual boot result. Successful build and valid metadata alone are insufficient boot evidence.

## Easy and Advanced modes

Easy mode reads the selected source and saved runtime automatically. Its profile and runtime dropdowns display actual discovered values. Advanced mode retains existing preset choices and the full configuration editor. Each ISO field group has expandable contextual help and a button that opens its bundled article in the documentation workspace. See the [ISO field guide index](iso-fields/README.md). Runtime selection and custom resource reservations remain in their existing dedicated controls; broad source-to-GUI parity is not claimed.

Easy mode uses three Back/Next steps: prepare the detected disc profile, make the image, and inspect the result. The device stores only step, mode and job identity per workspace. On resume, configuration success and inspected output are never restored as facts; check configuration again before a new build and refresh any recovered job. Browser storage failures are visible. The generated filename is explained rather than exposed as an unsupported rename field.
