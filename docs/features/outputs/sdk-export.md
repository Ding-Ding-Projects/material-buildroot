# SDK and toolchain export

The output inspector contains an SDK export consumer. First produce Buildroot's
`sdk` target using the named-target queue, then browse the adopted output directory
and select the generated `.tar.gz` archive. Inspection returns a two-minute preview,
archive hash, input locks, available successful-job binding, observed compiler
names and Linux environment instructions. Export creates a unique
`sdk-export-<id>` directory inside the adopted output root with `sdk.tar.gz`,
`README.md` and `sdk-export.json`. Existing files are never replaced.

The archive is copied byte-for-byte. A host-generated receipt records the original
relative source, SHA-256, size, source/configuration locks, any matching successful
job receipt, archive metadata and explicit unverified toolchain/consumer states.
Current-input observation is not historical build provenance. The successful-build provenance producer captures top-level
`images/*_sdk-buildroot.tar.gz` after the actual queued `sdk` target succeeds,
under the same input/root/runtime binding as image builds. Older or unavailable
SDK job evidence may have no matching output receipt. This is shown as unbound,
never inferred from the archive filename or a nearby successful job.

## Environment handoff

Use a compatible Linux environment, including WSL 2 or a Linux container, as a
non-root user. This is not a Windows-native toolchain. Transfer the complete export
folder and compare the archive hash before and after transfer. Inspect the archive
and its scripts, extract it into a new empty directory, then review and run its
`relocate-sdk.sh` according to the Buildroot version's SDK instructions.

If a regular `environment-setup` file was observed, review it before sourcing it
in a disposable shell. Otherwise use the SDK's explicit compiler paths or its
`bin` directory according to that version's documentation. The application does
not create a replacement environment script, infer an ABI from a filename,
execute relocation, source shell files, run compilers or execute renderer commands.
Observed compiler names are metadata only. Toolchain contents and environment
contents have no asserted independent lock.

## Boundaries and unsupported cases

Host-issued output identities expire and are rebound to the adopted output root.
The consumer rejects source symlinks, changed files and root replacements. It
streams gzip/tar metadata with a 4 GiB compressed limit, 16 GiB expanded limit,
100,000-entry limit, 4,096-byte path limit and two-minute inspection deadline.
It supports traditional/GNU tar regular files, directories, GNU long names and
relative links whose normalized target remains under the single archive root.
PAX extensions, absolute/escaping links, duplicate paths, special files and
multi-root archives are unsupported. A relocation script and cross-compiler
filename must be present. No archive member is extracted or executed. Passing
metadata admission does not establish that executable SDK content is trustworthy.

Export runs under the existing source/output path lease. The preview is single-use
and the source manifest must still match. A new exclusive destination is created;
copy SHA-256 must match before the final receipt is written. An export failure
retains its incomplete directory and reports `SDK_EXPORT_INCOMPLETE_RETAINED`.
The generated directory is not rolled back through recursive deletion. An expired
preview requires another inspection. Linux-only output unavailable through the
current adopted native output grant cannot be exported by this consumer.

## Verification state

Implementation only. Tests, static analysis, review, runtime interaction and
screenshots are deferred. No actual SDK production, relocation, environment
sourcing, consumer smoke build, ABI inspection or target execution was performed.
The export receipt records `consumerBuildVerified: false` and
`runtimeVerified: false`. Desktop packaging does not change those verdicts.

## 廣東話操作摘要

先喺具名目標佇列執行 `sdk`，再喺輸出瀏覽器選擇產生嘅 `.tar.gz`。
檢視後可匯出至輸出根目錄內嘅全新獨立資料夾，保留原始壓縮檔、摘要收據同英文
Linux 環境指引。唔會覆寫現有檔案，失敗時會保留未完成資料夾。

SDK 只供相容 Linux 環境使用，唔係 Windows 原生編譯器。請以非 root 身份操作，
傳送前後核對摘要，檢查壓縮檔同腳本，再按該 Buildroot 版本指引搬移 SDK。
本程式唔會解壓、執行搬移腳本、載入環境腳本或編譯使用方程式。
來源綁定缺少時只顯示目前輸入觀察，唔會當成歷史構建證據。
實際 SDK、ABI、使用方構建同運行驗收全部仍未核實。

