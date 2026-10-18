# BIOS ISO console acceptance

This Linux-only helper drives a task-owned QEMU process through a Unix QMP socket. It keeps the ISO read-only and uses the original boot menu and kernel arguments. `-display none` hides the host window while preserving the VGA framebuffer for genuine `screendump` captures. This does not verify the Windows application or installer.

The verified profile uses QEMU 10.0.13, `qemu64`, Cirrus VGA and RTL8139 networking. The default Buildroot kernel supports RTL8139 C+ and preserves its text console with Cirrus. The `--vga`, `--cpu`, `--nic` and diagnostic `--single-step` options record materially different consumers, not changes to the ISO. See the bounded results and retained unsuccessful profiles in `docs/evidence/iso-boot/README.md`.

Use Python 3.11 or later and QEMU with the x86 PC machine. Run as a non-root account. Keep the session directory private, fresh, and short enough for a Unix socket. The start command stays attached until the guest exits; retain that process and use a second terminal for controls. A nonzero consumer exit produces a nonzero helper exit. Review receipts before copying any evidence into source control: raw session data contains local paths and process identities.

Before launch, obtain a terminal full-build result, exact application source revision, Buildroot source identity, final configuration hash, and immutable ISO hash and byte count. The minimal machine-readable build receipt has `exitCode: 0` and `isoSha256` matching the supplied ISO. Those fields are prerequisites, not independent proof that the producer ran. The reviewer must verify the original build result.

```sh
python3 qmp_console.py --session /tmp/iso-acceptance-unique start \
  --iso /path/to/rootfs.iso9660 --sha256 VERIFIED_SHA256 \
  --build-receipt /path/to/reviewed-build.json
python3 qmp_console.py --session /tmp/iso-acceptance-unique capture boot-menu
python3 qmp_console.py --session /tmp/iso-acceptance-unique key ret
python3 qmp_console.py --session /tmp/iso-acceptance-unique capture console-login
python3 qmp_console.py --session /tmp/iso-acceptance-unique text root
python3 qmp_console.py --session /tmp/iso-acceptance-unique key ret
```

Inspect each real capture before the next input. Capture the unmodified default menu, completed Linux boot, successful login, `uname -a`, `uname -m`, `id`, `/proc/cmdline`, filesystem write/read and, if configured, interface and network results. The helper does not infer acceptance from elapsed time or QEMU's running state. Do not send credentials through this helper or retain private data in console captures.

The text command supports lowercase ASCII letters, digits, spaces and a small command punctuation set. Send other keys explicitly with QMP qcodes. Inputs affect only the owned guest console. For example, enter `uname -a` and then `key ret`; inspect the resulting framebuffer rather than assuming execution.

Request guest shutdown through its console (`poweroff`) and verify that QEMU exits. The separate `powerdown` operation requests guest ACPI shutdown when supported. `verify-exit` checks the original PID and Linux process start identity. It does not terminate any process. Preserve failed or incomplete runs and report the missing shutdown proof. An initramfs root is ephemeral; a write/read in that root never establishes reboot persistence.

Keep original PPM captures and SHA-256 receipts. A lossless PPM-to-PNG format conversion may be used for viewing, with both hashes recorded. Review actual pixels, capture timestamps, ISO binding and privacy before promoting images. Record unverified networking, persistence, GUI and installation checks separately.
