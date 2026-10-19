# Forge release publication

The output inspector offers a bounded GitHub publication workflow for a selected set of locally built outputs. It creates a unique normal release at an exact existing commit in the destination default-branch lineage. It is distinct from Cloud destinations, which uploads one file to an existing storage destination or release.

## Prepare

1. Admit GitHub CLI and complete sign-in in Execution setup. Existing CLI-managed credentials remain in that host-owned account flow; the publication panel never accepts or returns a credential.
2. Select up to 16 output files with the inspector checkboxes, with unique asset names and at most 1 GiB total. A matching successful build provenance receipt must cover their exact bytes and current inputs.
3. Enter an existing private owner/repository and inspect its authenticated identity, visibility and write access. Enter the exact 40-character release target commit.
4. Preview the account, destination, unique tag, commit, local source snapshot digest, manifest digest, build record and every asset size and SHA-256.
5. Consent in the panel, then review the native host confirmation. The preview expires after two minutes and is consumed once. Inputs are checked again and copied to exclusive retained snapshots before the queued publication starts.

## Exact identities and privacy

The remote commit and the local source snapshot are separate identities. This workflow does not claim that their source contents are identical. The remote commit must exist and be an ancestor of the destination default branch. The local output bytes must match the successful local build receipt and remain unchanged throughout snapshotting.

Only private destinations are admitted. Unknown local output content is never promoted to a public destination. This workflow does not create repositories, fork, copy source, change visibility, switch accounts, replace tags, overwrite assets, or execute arbitrary command text. GitHub requests use the admitted executable with fixed CLI argument models. Existing execution setup owns authentication; the selected account and private repository are rechecked during the operation. No credential values are returned in IPC, prompts, history or logs.

## Publication and readback

Each release uses a timestamp and random identifier in a new tag, with the exact commit passed as its target. Existing matching tags block creation. Draft and prerelease flags are not used. Release notes name the immutable identities and asset hashes without claiming unrun checks.

Completion requires the tag to resolve to the expected commit, a non-draft/non-prerelease release, the expected asset inventory and sizes, and downloaded asset bytes with matching SHA-256. A bounded annotated-tag chain is supported. The tag, account and private destination are checked again after download.

Publication is queued in persistent per-workspace history and bounded to ten minutes. Raw CLI output and credentials are not retained. The panel exposes honest queued, running, cancelled, interrupted, unverified and verified states.

## Cancellation and recovery

Cancellation stops local work; it cannot promise to undo a server-side operation. An uncertain result retains any remote tag, release, uploaded assets and local snapshots. No automatic deletion or rollback occurs.

After reconnecting the same account and destination, **Read retained release** retries only readback. It never repeats a create or upload. Missing assets stay incomplete. The user must reconcile a partial publication separately; this UI does not overwrite or repair it automatically. Interrupted jobs are not automatically restarted.

## Current evidence boundary

Implementation only in this delivery lane. No tests, reviews, static analysis, live authentication, publication, runtime interaction or screenshots were performed under the selected fast-delivery mode. Public publication, repository creation/copy/fork, multiple-account management and proof that a remote commit is byte-identical to a local build snapshot are not implemented by this release-output consumer.
