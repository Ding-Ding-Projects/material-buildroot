# GitHub execution setup

The runtime workspace includes a guided selection panel for an existing source repository and either that same repository or an existing dedicated execution repository. Enter explicit owner/name pairs. Checking access uses the GitHub CLI account already signed in on the host; it never signs in, creates repositories, provisions runners, or starts builds automatically.

The host reads the authenticated account and repository access through fixed `gh api` calls. Renderer inputs cannot supply CLI arguments, executable paths, API hosts, credentials or arbitrary endpoints. Credential environment overrides are removed so the CLI uses its configured authentication store. Errors are bounded and raw CLI diagnostics are never returned to the renderer.

Selections are held in memory, expire after 30 minutes and must be repeated after restart. Every remote operation rechecks the account identity. The source and destination must match the repository identities returned by GitHub; the execution destination must be writable and neither archived nor disabled. Repository write permission is not a claim that workflow publication permission is available. Publication establishes that separately.

Private source in a separate execution repository is refused because an appropriately scoped cross-repository checkout credential is not yet supported. No credential is guessed or copied to work around that boundary.

Runner discovery reads up to ten pages of the selected repository's visible inventory. Compatible self-hosted choices require Linux, X64, online and not-busy status. Missing administrative access leaves an explicit unavailable inventory, rather than an empty successful result. The pinned hosted choice is ubuntu-24.04; availability and account billing are not promised. Every choice requires an explicit billing/capacity acknowledgement. Confirmation refreshes self-hosted inventory. No choice reserves capacity or provisions a machine.

The trusted host exposes selection and transport helpers to the workflow and job services. JSON responses are limited to 2 MiB and 30 seconds. Binary artifact responses are limited to the caller's bound, at most 64 MiB. Selection handles are not credentials and are not persisted or exported.

## Verification status

Source implementation only. No tests, static analysis, runtime execution, visual capture, authentication, repository mutation, workflow publication or build dispatch was performed in this implementation lane. Installation-time GitHub CLI discovery and complete product acceptance remain unverified.
