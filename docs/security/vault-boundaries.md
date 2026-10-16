# Host vault and privilege boundaries

Status: source implementation for PH02-T04. Tests, static analysis, review and runtime acceptance are deferred for this release lane. This article does not claim a completed roadmap acceptance check.

## Protected storage and references

The host vault encrypts bounded string records through the operating system protected-storage provider. It rejects unavailable encryption, plaintext or unknown storage backends, unsafe storage roots, linked or oversized record files, malformed records and owner mismatches. Callers persist opaque `vault:` references, not plaintext credentials. A reference alone does not authorize reading or removal. Authenticator verification supplies the enrolled record owner when resolving its reference.

## Explicit host ownership

`createVault().forOwner(owner, permissions)` is a trusted-host enrollment operation. Host code selects a validated owner and a nonempty, duplicate-free subset of `read`, `write` and `remove` after reviewing the workflow. Each returned facade captures that owner and permission set. Calls cannot supply another owner or add permissions. Revocation invalidates subsequent operations on that facade, including references it previously wrote; it does not delete credentials or revoke separately enrolled facades. Retain the root vault only inside trusted composition code. Never expose either root or scoped secret-bearing methods through preload, browser pairing or renderer IPC.

The typed host contract lives in `src/shared/vault.ts`, with the factory declaration beside the implementation. It grants access only to this process's existing protected storage. It provides no administrator execution, shell, process-launch, security-setting or automatic elevation operation. A workflow requiring additional host privilege still needs a separately typed, reviewed native route and user-owned native consent. This source change does not implement such a route or assert that it has been exercised.

## Redacted operation records

Each facade retains at most 256 recent operation records in memory. The fixed fields are sequence, operation and outcome. They deliberately exclude owners, references, input values, ciphertext, plaintext, lengths, paths and platform exception details. Records are immutable snapshots, not a persistent audit journal. Failures use a fixed generic message and code. Records disappear with the process; they cannot prove historical execution after restart.

## Remaining verification

Owner separation, read-only permission rejection, revocation, bounded record retention, backend refusal, authenticator verification and native protected-storage behavior require execution in the deferred verification pass. This article supplies no test result, installation receipt or runtime evidence. Existing file-capability admission, command execution and privileged installer work retain their separate ownership and acceptance requirements.
