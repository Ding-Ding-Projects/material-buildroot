# Handoff

## Current objective

Plan a Windows desktop Buildroot application with complete Material Design 3 controls, WSL and Docker execution, the full shared feature baseline and a GitHub Pages documentation companion. Implementation is reserved for the next development session.

## Verification

Planning interview is active. A minimal scaffold was created before the planning-only clarification. Implementation lanes stopped before backend or renderer code was written. No build, runtime, installer or release verification has completed.

## Working policy

Work on `main` only and publish planning checkpoints frequently. Preserve existing work. Read [PLAN.md](PLAN.md) and [DECISIONS.md](DECISIONS.md) before implementation, and resolve pending owner answers rather than guessing.

## Implementation handoff

- [Design and 40-screen state inventory](design/README.md).
- [Typed architecture, source/configuration concurrency, VM ownership and companion security](docs/planning/architecture.md).
- [105 individually identified feature obligations](docs/planning/feature-coverage.md), each unverified for production.
- [Official-source Buildroot/runtime constraints](docs/planning/buildroot-constraints.md); recheck current versions before pinning.
- [Repository issue handoff](https://github.com/Ding-Ding-Projects/material-buildroot/issues/1).
- [Next-session operating prompt](NEXT_SESSION.md).

The complete specified application, all shared features, public website and authenticated LAN companion remain in scope. Internal sequencing never waives unfinished rows. Interactive rich controls and appropriate canvas editors are explicit requirements.

## External-state evidence

Source publication to `main` works. Enabling Discussions through the connected account returned HTTP 403 `Resource not accessible by integration`; no Discussion was created. Native Windows host access, exact newest-stable Windows/VMware/VirtualBox versions, Pages settings, live website and installer/runtime capability remain unverified.

## Earlier isolation artifacts

Three linked planning/implementation lanes were created before the owner required main-only work. No backend or frontend implementation was written there. Their work must not resume. Early design drafts are retained as historical planning inputs, superseded by the primary `design/` documents. Main is the sole active source branch.

## Publication dependency

Public target: `Ding-Ding-Projects/material-buildroot`, provided by the repository owner. Publication verification is pending.
