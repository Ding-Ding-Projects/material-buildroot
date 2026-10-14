# Product decisions for the planning interview

These are questions to settle with the product owner, not permission gates for work already authorized. Recommendations are proposals. The implementation owner must incorporate the final answers before building.

## Main workflow

1. Who is the first user: embedded developer with an existing tree (recommended), beginner creating a first image, or team maintainer managing many boards?
2. What should the first successful journey produce: configure/build/export one board image (recommended), inspect/edit existing configurations, or manage a fleet of board projects?
3. Should opening an existing project be the first-run primary action (recommended), or guided acquisition of a Buildroot release?
4. Which initial target boards and Buildroot releases must have end-to-end proof? Choose one real baseline plus explicit compatibility boundaries, not an untestable claim that all versions work.
5. Should edits apply immediately with undo, or accumulate in an explicit review/apply set (recommended for dependency-changing Kconfig edits)?
6. Should hidden Kconfig symbols be excluded by default with a Show unavailable option (recommended), or always displayed with dependency explanations?
7. What expert workflows belong in the first contract: external trees, custom packages, overlays, patch stacks, toolchain configuration, Linux/BusyBox/U-Boot configuration, SDK export, reproducibility, package rebuild and legal-info? These need distinct actual controls and backend proof.
8. How should multiple projects behave: one selected project per window with task history across projects (recommended), or simultaneous project workspaces with parallel builds?

## Runtime and safety

9. Preferred default: WSL 2 when detected (recommended), Docker when detected, or explicit first-run selection with no preference?
10. Should runtime preparation be app-managed after review, or use existing installations only? What exact installation/licensing/restart decisions must remain user-owned?
11. Are Docker engines local-only, Docker Desktop contexts, or remote contexts in scope? Avoid claiming remote support from a local engine picker.
12. Where should sources and outputs live: Linux filesystem with Windows file access guidance (recommended), or allow Windows-mounted paths with performance/permission disclosure?
13. May builds share downloads/cache between projects, and what storage limit/cleanup behavior should the GUI expose?
14. Should project adoption permit modifications immediately, or first make a local snapshot and show the intended configuration/output boundaries (recommended)?
15. Is a raw terminal required as an expert supplement? It must not replace typed GUI workflows and changes the process/security scope.

## Interface preferences

16. Preferred starting density: balanced desktop (recommended), compact engineering view, or comfortable touch-friendly?
17. Is the proposed green/neutral palette suitable, or is another brand direction desired?
18. Should the detail inspector stay open by default at normal width (recommended), or open on demand?
19. Should the log panel remain open during active builds and restore its previous state afterwards (recommended), or always stay visible?
20. Default language: English (recommended), Cantonese, or bilingual? Required independent humor defaults remain level 5 unless explicitly changed by the owner.
21. Should optional per-control guides be shown on first use, user-enabled globally, or enabled per feature (recommended)?
22. Which update policy is intended: automatic background download with visible restart choice, notification before download, or manual checks? Clarify against the shared update contract.

## Scope and delivery

23. Confirm the complete universal feature set remains part of the eventual release, including deep per-element graphics/motion editing, conversion, local model suite, server management, authenticator, locks and recovery. These are substantial subproducts and cannot be represented by a few toggles.
24. Which workflows should the next implementation owner prioritize while preserving the full acceptance backlog? Priority does not waive remaining requirements.
25. What qualifies as first release acceptance: verified Windows install and one real build plus transparently unfinished inventory, or no release until the full universal contract passes? Avoid presenting partial implementation as complete.
26. Which Windows versions/architectures and accessibility assistive technologies are required for native proof?
27. Should project state export include absolute local paths by deliberate user choice, or default to a portable redacted profile (recommended)? Secrets and private vocabulary remain excluded.
28. What is the chosen documentation language and article-review process? English and Cantonese coverage must be real, with exact code/paths unchanged.
