# Kconfig evaluation and source trust

The bundled Kconfiglib 14.1.0 parser remains pinned by the file digests in
`scripts/configuration/vendor/provenance.json`. It provides evaluated menu,
symbol, choice, range, dependency and visibility metadata. The source tree's
native configuration target remains the authority for reconciliation. A parsed
tree alone does not establish compatibility with every current Linux release.

## Safe host inspection

`createKconfigAdapter({pythonExecutable, admitted:true})` runs the fixed bundled
helper with an explicitly selected Python executable. Its default read-only mode
rejects subprocesses and reads outside admitted trees. Source requiring command
expansion is unavailable through this mode. It does not fabricate macro results.
Source-provided Python function modules are disabled in both modes.

## Trusted Linux runtime integration

The alternative host-only constructor is
`createKconfigAdapter({executeInspection, resolveAdmission, timeoutMs})`.
Neither callback is exposed through IPC. `resolveAdmission(roots)` must resolve
current host-owned authorization and return:

```json
{
  "sourceTrusted": true,
  "runtime": "wsl2",
  "admissionId": "host-owned-authorization-id",
  "sourceRevision": "source-content-revision",
  "configRevision": "configuration-content-revision"
}
```

The other supported runtime value is `docker`. The admission must bind the
selected runtime, source, output and all active external trees. It must be
invalidated when any relevant source content or execution authorization changes.
A directory path or repository HEAD alone is insufficient for a modified tree.
The host must obtain explicit trust for source execution before issuing it.

`executeInspection` receives the fixed `inspect-kconfig-v1` operation, admission
identifier, runtime identifier, validated request, bundle, and `AbortSignal`.
The bundle carries the actual helper and pinned parser bytes as base64, their
SHA-256 digests, and the parser version. The request contains admitted source,
output and external paths, Kconfig entrypoint, prefix, environment, and binding.
It contains no executable or renderer-supplied shell command.

The host transport must revalidate the admission, translate every admitted path
and path-valued environment field into the selected Linux runtime, materialize
and verify the exact bundle in an owned temporary directory, and invoke only
the fixed Python helper with `-I -B` and the request on standard input. Its
process ownership, descendant cancellation, output limit and cleanup must use
the runtime's existing verified lifecycle. It must return parsed JSON, propagate
nonzero exit or malformed output, and honor cancellation. The adapter bounds
the wait to 30 seconds by default, permits 100 to 120000 milliseconds, and
accepts at most 16 MiB of JSON. The transport must enforce these bounds while
collecting output, rather than only after collection.

Trusted evaluation is source execution, not a Python sandbox. Linux Kconfig's
`shell` macro executes commands supplied by the trusted source. The helper
therefore requires a non-root Linux process and an explicit source-specific
binding before enabling that mode. Runtime isolation and filesystem access
remain the host transport's responsibility. The helper does not itself write
configuration files, but trusted source commands can have side effects allowed
by that runtime. Grant only the access intended for the selected source.

The response must echo the same admission and source/configuration revisions.
The host adapter reads current admission again after execution and rejects a
changed binding. `evaluationMode` distinguishes `read-only-host` from
`trusted-linux-runtime-v1`. `reconciliationAuthority` is explicitly
`source-native-conf-required`. Kconfig `info` output is separated from the JSON
protocol and retained as bounded diagnostics. Unsupported syntax, missing tools,
unavailable runtime and rejected trust remain unavailable, never successful
substitutions.

## Delivery status and remaining integration

The trusted helper mode and fixed runtime transport are implemented in
`src/main/execution/kconfig-inspection.cjs`. The host constructs
`createKconfigInspection({execution, resolveContext, onOwnership})`, then passes
the resulting callback as `executeInspection`. The context resolver accepts
only an admission identifier and returns the current execution grant identifier,
existing admitted runtime object, exact domain source/output roots, and the same
binding returned by `resolveAdmission`. It must recompute content revisions on
every resolution. Component domains may live below the admitted output tree;
their exact root pair must match the host's discovered domain record. External
roots must exactly match the active execution grant.

The transport checks root identities and admission again before launch and after
completion. Docker uses the admitted digest-pinned image and non-root identity,
read-only source/output/external mounts, no network, a read-only container root,
and an owned temporary filesystem. WSL uses the admitted distribution and
non-root default user, with its existing filesystem authority. WSL is not a
container sandbox. Both require `python3` and `setsid` in the runtime. Their
absence is an explicit runtime failure, with no runtime installation or fallback.
The fixed launcher verifies bundled bytes, streams bounded output, enforces an
internal 30-second limit and reports a process identity before source execution.
WSL cancellation verifies boot, PID namespace, PID start time and process group
before signalling; Docker cancellation verifies the operation label and daemon.
The optional ownership callback lets the host durably record that receipt before
the parser receives input. Cancellation without verified ownership fails closed.

Workspace authorization wiring is required before the application can activate
trusted Linux inspection. No WSL, Docker, parser execution, tests or runtime
acceptance were performed in this implementation lane. Modern-source
compatibility and production transport acceptance are unverified.

The ordinary configuration service still preserves the prior configuration,
checks revision conflicts, runs the source-native fixed reconciliation target,
and restores the prior configuration when reconciliation fails. No trusted
inspection result replaces that transactional write path.

## Official references

- [Linux Kconfig macro language](https://cdn.kernel.org/doc/html/latest/kbuild/kconfig-macro-language.html)
  specifies command execution and built-in macro behavior.
- [Kconfiglib upstream](https://github.com/ulfalizer/Kconfiglib) describes parser
  behavior and Linux-source command expansion.
- [Linux Kconfig language](https://kernel.org/doc/html/latest/kbuild/kconfig-language.html)
  defines configuration symbols and dependency behavior.
