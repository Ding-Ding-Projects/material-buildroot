# Release execution and evidence

The release workflow defaults to the hosted `windows-2025` x64 image. Manual dispatch may select the fixed `windows-2022` x64 fallback. Any other input resolves to the default; arbitrary runner labels and renderer commands are never accepted. Each selected host must provide Windows X64 before the existing build entrypoint runs. A queued or unavailable host does not automatically start a second publisher. An owner may dispatch the fallback explicitly after deciding how to handle the original run.

No self-hosted runner, external cloud account, paid provisioning, or fallback credential is configured. Those routes remain unavailable rather than being represented as working failover. A source checkout remains public; introduction of private source requires a separately configured encrypted public-builder transport.

## Inventories

`scripts/ci/collect-evidence.ps1` records the exact source/run/attempt, selected image, reported image version, safe fixed source-file digests, and executable version/digest metadata for a small named tool list. The always-run output phase also records available pinned build tools. Missing tools are recorded as unavailable. No environment dump, executable location, machine identity, credentials, or arbitrary source content is collected.

## Defensive output collection

Only direct files under `release/publish` and `release/installer` matching the fixed installer/package/receipt allowlist are eligible. Each directory contributes at most its first 64 sorted direct files. Reparse-point files are excluded. Each eligible output records its source-relative name, byte count, and SHA-256 digest. Copied names have unique numeric prefixes so equal names from separate directories cannot overwrite each other. The combined copied payload is limited to 1,200,000,000 bytes; omitted files retain a reason in the inventory. Required release downloads remain separate and authoritative.

The optional evidence upload uses compression level zero because installers and NuGet packages are already compressed. Collection and upload use `always()` and remain best-effort. Failure cannot turn an unsuccessful build or publication into success, and a successful release does not imply an evidence upload completed. Retention is seven days.

## Delivery boundary

This change is source-only under the owner-selected fast delivery mode. Tests, lint, static analysis, reviews, runtime interaction, and screenshots were not run. A completed hosted run and its inventory downloads remain unverified until delivery executes the changed workflow. The workflow still triggers every branch push and manual dispatch, excludes tag recursion, and publishes through the existing normal-release path.
