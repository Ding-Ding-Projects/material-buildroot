# Serialized operation requests

[香港粵語](operation-requests.zh-HK.md)

`src/main/security/operation-request.cjs` implements the first versioned request admission boundary. It accepts serialized JSON text or UTF-8 bytes and returns an immutable validated request with an internal canonical digest. It does not execute an action, resolve a filesystem path, authenticate a caller or grant a capability.

The executable schema is `src/shared/operation-request.schema.json`. The earlier planning schema remains a historical admission design; production code loads only the executable schema. `src/shared/api.ts` now describes an action-discriminated request union instead of a string dispatcher returning `any`. A production preload and broker still need to implement that contract.

## Input limits and rejection behavior

The parser accepts at most 65,536 UTF-8 bytes, eight nested containers and 2,048 counted container/property/literal events. A syntax visitor checks decoded duplicate property names, unsafe prototype-related keys, invalid Unicode, malformed input, comments and trailing commas before constructing an object. Numbers must use canonical decimal integer notation within JavaScript's safe integer range. Fractions, exponent notation and negative zero are rejected before numeric conversion can conceal rounding or underflow.

The JSON Schema validator performs no coercion, default insertion or removal of unknown fields. Top-level and action-specific additional properties are rejected. Opaque capability identifiers use a bounded ASCII URL-safe alphabet, not raw filesystem paths. The five current action shapes are language selection, project creation, build preview, preview-bound submission and owned-job cancellation. Accepting their shape does not mean those actions are implemented.

Object key ordering and insignificant whitespace do not change the canonical request digest. Changing an argument does. The returned envelope and nested request data are frozen. The digest is for internal idempotency bookkeeping; it is not an authorization credential and must not be published with private request content. Rejection exposes only a stable code and generic message, without reflecting input keys, values or capability contents.

## Dependencies and provenance

The implementation pins `jsonc-parser` 3.3.1 and Ajv 8.20.0, both under MIT licenses, in the production dependency lock. It uses the parser's syntax visitor with comments, trailing commas and empty content disabled, and Ajv's draft-2020 validation with mutation options disabled. The [parser API](https://github.com/microsoft/node-jsonc-parser) and [Ajv options](https://ajv.js.org/options.html) describe those upstream interfaces. Package version and local source inspection govern the admitted implementation.

## Verified scope and remaining integration

Nine focused local tests pass on the pinned Node.js 24.22.0 runtime. They cover all five action shapes, normalized identity, escaped duplicate names, prototype-related keys, invalid syntax and UTF-8, byte/depth/member bounds, numeric precision loss, schema mismatch and generic diagnostics. Independent read-only review reproduced fractional rounding and exponent underflow in the first candidate; the repaired lexeme check rejects those cases and the independent rerun reached no remaining actionable parser finding.

The next broker work must authenticate the actual IPC sender, validate capability ownership and real paths, compare expected revisions, persist idempotency acceptance/results, reconcile interrupted effects and expose bounded events. No caller may treat this parser result as permission to run a shell command. Production IPC, persistence, effectful actions and native runtime acceptance remain unimplemented.

The action union also passes TypeScript 7.0.2 with `--ignoreConfig --noEmit --strict --skipLibCheck --target es2022 --module commonjs tests/operation-request-types.ts`. Three expected-error fixtures require rejection of arbitrary actions, mismatched arguments and missing envelope fields. This is compile-time evidence only.
