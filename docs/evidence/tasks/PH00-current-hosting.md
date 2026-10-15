# PH00-T05 current hosting evidence

Verdict: **Verified for the current published revision.** This record independently checks the existing GitHub Pages deployment and repository About homepage. It covers website hosting only.

At `2026-10-15T18:55:30Z`, the public Pages configuration reported branch `main`, path `/docs`, and `https://ding-ding-projects.github.io/material-buildroot/`. The public repository About field read back to that same URL. The remote `main` ref resolved to `e4202d9c78524c6bd692476fbbb924ae0a08ed1c`; the latest successful Pages workflow for that revision is [run 38693546900](https://github.com/Ding-Ding-Projects/material-buildroot/actions/runs/38693546900).

A read-only HTTP fetch checked all **108** tracked published files (`docs/index.html` and every file under `docs/site/`) against the exact Git blob contents at that revision. All returned HTTP 200 and all 108 response bodies matched byte for byte. This includes 71 HTML pages and 37 supporting files: scripts, styles, fonts, images, icons, and data files. The PH00 route `site/phases/ph00.html` and the bundled application script were also checked directly; their responses matched the tracked blobs.

The per-file status, length, response SHA-256, expected SHA-256, Git blob ID, and match result are in the ignored local receipt `.cache/phase00-hosting.json`. Repository API readbacks and the workflow result were obtained with `gh api`; public content was fetched over HTTPS. No site source or generated output was changed for this verification.

This closes PH00-T05's live URL, route/content delivery, and About-homepage requirements for revision `e4202d9c78524c6bd692476fbbb924ae0a08ed1c`. It does not claim a new browser interaction run or application/product acceptance. Existing local browser evidence remains separately recorded in [planning-site evidence](../planning-site.md).
