# Publication eligibility exit handling

`scripts/ci/publication-eligibility.ps1` distinguishes a completed publication decision from an admission failure. An exact source commit belonging to freshly fetched `origin/main` produces `eligible=true`. A valid source outside that ancestry produces `eligible=false` with `publication-deferred`; its preservation build does not publish a release. Both completed decisions exit successfully.

The Windows PowerShell workflow caller propagates the last native-command exit code after an invoked script returns. `git merge-base --is-ancestor` intentionally returns `1` for a non-ancestor. Without an explicit successful script exit, that legitimate deferred decision incorrectly makes the step fail even though the evidence and output correctly deny publication. The script now exits `0` only after its decision and final evidence write complete.

Invalid source values, failed fetches, unresolved source or main commits, ancestry lookup errors and evidence-writing errors remain nonzero. No main-ancestry requirement is relaxed, and deferred task source is never granted publication eligibility.

The focused fixture runs the real script through Windows PowerShell with the workflow caller's native exit-propagation suffix. It creates an isolated local Git origin and verifies eligible and deferred decisions, invalid and missing source objects, a commit with an unavailable parent that makes ancestry traversal fail, and an unavailable origin. Before the repair, only the legitimate deferred case incorrectly exited `1`; after the repair it exits `0`, while the admission-failure cases remain nonzero.
