# Product production workflows

[香港粵語](product-workflows.zh-HK.md)

The Execution workspace has a separate product build setup, independent of Linux Buildroot user jobs. Sign in through the existing GitHub CLI controls, choose the public source repository and its immutable 40-character revision, then select the source repository or a dedicated existing execution repository. Account and repository write access are checked through GitHub CLI. Private product source is rejected because this route does not supply the required encrypted builder.

## Runner and build selection

The product selector offers Windows 2022 hosted capacity and discovers repository-visible Windows x64 self-hosted runners. Offline or busy self-hosted runners cannot be selected. Hosted availability and billing are account-dependent and never a capacity reservation. Selecting a runner requires explicit billing/capacity consent. Inventory permissions can be unavailable without inventing a successful inventory.

Choose Build or Installer. The fixed action model checks out the selected immutable revision using a pinned checkout action and invokes exactly root build.bat /s or build-installer.bat /s with the resulting exit status. Installer production uses the source revision's existing unsigned Squirrel.Windows entrypoint. No tests, lint, release publication, artifact upload, dispatch, custom commands or caller-provided executable paths are generated. Entrypoints remain responsible for dependency acquisition. An unattended elevation requirement can prevent production and is not represented as success.

## Guided and expert editing

The guided controls generate YAML 1.2. Expert editing accepts the same action model only: source repository, immutable revision and product target can change. Unknown actions or keys, arbitrary scripts, changed permissions, tags, aliases, anchors, duplicate keys and alternate documents are rejected. The input text stays available after rejection. The host limits YAML to 64 KiB, 2,000 nodes and 20 levels.

## Preview, export and explicit write

Preview checks source accessibility and destination revision, and rejects an occupied workflow path. It displays the full generated YAML, runner labels, source and destination revisions and SHA-256. The preview expires after five minutes and selections expire after thirty minutes or account change. Any editor change invalidates the displayed preview and confirmation.

Export uses a native Save dialog and creates a new file exclusively, preserving existing files. Export never writes a repository workflow or starts a run. Explicit publication requires a separate checkbox, rechecks the destination and source revisions, consumes the preview before the write, and reads back exact bytes at the resulting commit. An uncertain write is reported unverified and never retried automatically. Published workflow names are content-addressed. Workflow write permission is not claimed from ordinary repository write permission.

## Verification status

Implementation only. Build and packaging are pending the coordinated build slot. No tests, static analysis, runtime interactions, workflow publication or remote execution were run for this change. Runner discovery, native export, YAML rejection and publication readback require subsequent permitted acceptance evidence.
