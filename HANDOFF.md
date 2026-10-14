# Handoff

## Current objective

Plan a Windows desktop Buildroot application with complete Material Design 3 controls, WSL and Docker execution, the full shared feature baseline and a GitHub Pages documentation companion. The owner authorized the initial documentation website now. Desktop application and authenticated companion implementation remain reserved for the next development session.

## Verification

The initial documentation website is built with genuine registered Material Web controls, phone-friendly layouts and separate categorized pages. A short overview leads to four roadmap categories, individual phase checklists, four documentation categories, articles/wiki and a separate downloads/status page. Local generated-site and browser checks passed; exact current artifacts and limitations are in [the evidence record](docs/evidence/planning-site.md). The checklist has 11 phases, 77 stable tasks and 105 mapped feature identities.

PH00-T01 through T04 and T06 are locally verified or completed records. PH00-T05 remains unchecked because GitHub denied Pages activation. The first application task for the next session is PH01-T01. Each task is implemented and verified before its checkbox is ticked; missing evidence stays open.

A minimal application scaffold predates the planning clarification. No application build, native runtime, installer, guest boot or product release verification has completed.

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

Source publication to `main` works. Pages creation with `main` → `/docs` returned HTTP 403 `Resource not accessible by integration`; no live website is claimed. Enabling Discussions also returned 403; no Discussion was created. Native Windows host access, exact newest-stable Windows/VMware/VirtualBox versions and installer/runtime capability remain unverified. Source wiki content exists and renders locally; GitHub's separate wiki service was not accessible as an initialized repository.

## Earlier isolation artifacts

Three linked planning/implementation lanes were created before the owner required main-only work. No backend or frontend implementation was written there. Their work must not resume. Early design drafts are retained as historical planning inputs, superseded by the primary `design/` documents. Main is the sole active source branch.

## Publication dependency

Public target: `Ding-Ding-Projects/material-buildroot`, provided by the repository owner. The generated site is prepared in `docs/` for Pages branch publishing from `main` → `/docs`, with `.nojekyll`. Owner settings access is needed to activate this route. Verify actual live routes/assets and the exact About homepage before checking PH00-T05. The intended home URL is `https://ding-ding-projects.github.io/material-buildroot/`.
