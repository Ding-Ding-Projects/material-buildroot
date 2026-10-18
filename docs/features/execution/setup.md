# GitHub execution setup

[香港粵語](setup.zh-HK.md)

The runtime workspace includes a guided selection panel for an existing source repository and either that same repository or an existing dedicated execution repository. Enter explicit owner/name pairs. Checking access uses the GitHub CLI account signed in on the host. Separate explicit controls acquire the pinned CLI, select a trusted existing executable, and start device sign-in. Setup never creates repositories, provisions runners or starts builds automatically.

The host reads the authenticated account and repository access through fixed `gh api` calls. Renderer inputs cannot supply CLI arguments, executable paths, API hosts, credentials or arbitrary endpoints. Credential environment overrides are removed so the CLI uses its configured authentication store. Errors are bounded and raw CLI diagnostics are never returned to the renderer.

Selections are held in memory, expire after 30 minutes and must be repeated after restart. Every remote operation rechecks the account identity. The source and destination must match the repository identities returned by GitHub; the execution destination must be writable and neither archived nor disabled. Repository write permission is not a claim that workflow publication permission is available. Publication establishes that separately.

Private source in a separate execution repository is refused because an appropriately scoped cross-repository checkout credential is not yet supported. No credential is guessed or copied to work around that boundary.

Runner discovery reads up to ten pages of the selected repository's visible inventory. Compatible self-hosted choices require Linux, X64, online and not-busy status. Missing administrative access leaves an explicit unavailable inventory, rather than an empty successful result. The pinned hosted choice is ubuntu-24.04; availability and account billing are not promised. Every choice requires an explicit billing/capacity acknowledgement. Confirmation refreshes self-hosted inventory. No choice reserves capacity or provisions a machine.

The trusted host exposes selection and transport helpers to the workflow and job services. JSON responses are limited to 2 MiB and 30 seconds; streaming transfers have a ten-minute limit. Binary artifact responses stream into a host-granted destination, with a caller bound of at most 1 GiB plus 32 MiB. Expected size and SHA-256 must match before the final file is created without overwrite; cancellation, timeout and failed verification retain nonempty partial files as explicitly incomplete; only empty temporary files are removed. No complete archive is buffered in memory. Selection handles are not credentials and are not persisted or exported.

## Verification status

Source implementation only. No tests, static analysis, runtime execution, visual capture, authentication, repository mutation, workflow publication or build dispatch was performed in this implementation lane. Pinned acquisition, trusted executable selection, device sign-in, streaming cancellation and complete product acceptance remain unverified.

## CLI acquisition and sign-in

`src/main/execution/gh-release.json` is the shared pinned version and archive hash used by the product and release bootstrap. Acquisition downloads only that archive from GitHub with an HTTPS redirect allowlist, a 100 MiB ceiling and a three-minute timeout. Archive integrity is checked before extracting the single `bin/gh.exe` entry into a new owned directory. Existing installations are not replaced. Admission records the executable path and SHA-256 locally, and every launch rechecks those bytes. A changed executable requires explicit readmission. A native file picker also admits an existing executable the user trusts.

Device sign-in runs `gh auth login --hostname github.com --git-protocol https --web --scopes workflow` only after the user chooses it. The CLI owns browser authorization and credential storage. The panel displays only the parsed bounded device code, the fixed official `https://github.com/login/device` URL and lifecycle status. Raw process output is neither displayed nor persisted. Cancellation stops the local process, clears the code and does not claim to revoke authorization already completed on GitHub. Device attempts expire locally after ten minutes. A CLI warning about insecure storage is reported as incomplete secure storage, not successful readiness.

Official behavior references: [GitHub CLI login](https://cli.github.com/manual/gh_auth_login) and [GitHub CLI environment](https://cli.github.com/manual/gh_help_environment). Actual device-flow behavior has not been exercised in this source-only implementation pass.


## Live transport verification

The 0.1.1 candidate was exercised against Buildroot 2025.02 source through both WSL 2 and Docker as a non-root user. The olddefconfig and show-info targets completed with independent ownership cleanup readback. These bounded checks cover configuration-tool compilation and package metadata, not a full firmware-image build. WSL session creation must retain its child until completion, using setsid --wait. The Windows source transfer did not preserve every Linux symbolic link, so the Docker result applies only to the exercised targets.
