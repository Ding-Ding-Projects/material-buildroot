# Initial planning website evidence

Scope: PH00 only, public initial documentation and repository records. This is not application implementation, complete production visitor feature parity, an authenticated companion, a native Windows test or a product release.

## Task verdicts

| Task | Verdict | Evidence |
| --- | --- | --- |
| PH00-T01 | Verified planning | [Roadmap](../../ROADMAP.md): 11 phases, 77 unique task IDs and all 105 feature identities mapped exactly once; [decisions](../../DECISIONS.md) retain unanswered P40–P42 |
| PH00-T02 | Verified locally | [Website source/build guide](../../website/README.md), rendered current planning/design articles and three complete source wiki articles |
| PH00-T03 | Verified locally | Genuine registered Material Web components, source-derived checkboxes, phase filters, expand/collapse, document search and [control inventory](../../website/components.json) |
| PH00-T04 | Verified locally | [Browser receipt](../../website/evidence/browser-check.json), real captures, internal link checks, 320px article checks, component registration and generic-control rejection |
| PH00-T05 | Blocked, unchecked | GitHub Pages creation denied with HTTP 403 `Resource not accessible by integration`; no live deployment or About-homepage readback is claimed |
| PH00-T06 | Verified records | [Handoff](../../HANDOFF.md), [next-session guide](../../NEXT_SESSION.md), public continuation prompt and explicit remaining scope |

## Reproducible checks and retained artifacts

Run `npm ci --prefix website`, `npm run build --prefix website` and `npm run check --prefix website`. The static checker verifies actual generated routes/assets/fragments, document inventory, task IDs, the 105-identity phase mapping, source snapshot freshness and absence of authored generic form/disclosure controls.

Serve the generated `docs/` directory under `/material-buildroot/` and run `node website/verify-browser.mjs` using a supported available Chromium or Playwright's installed browser. The browser test drives actual bundled components and records results, the browser version, source snapshot, base commit, exact HTML/JavaScript/CSS hashes and screenshot hashes. The latest retained JSON is authoritative for exact counts and provenance; a source base commit is not mislabelled as a clean built source when inputs differ.

Observed local checks cover phase filtering, expansion, full article search/navigation, persisted heading-language and theme preferences, mobile navigation scrolling/focus/close/re-entry, all current article routes at 320 CSS pixels, and home layouts at 320/390/768/1440 CSS pixels in all three offered heading modes. The initial interface offers translated headings; complete article localization remains a later requirement.

Retained genuine captures are [desktop](../../website/evidence/home-desktop.png), [dark desktop](../../website/evidence/home-desktop-dark.png), [phone](../../website/evidence/home-mobile.png) and [the roadmap article](../../website/evidence/roadmap-article.png). These show the documentation website, not the unimplemented desktop application.

The component guard was exercised red then green: inserting an actual native `select` into the generated home page made validation fail with the specific native-control-substitution error; restoring the original generated page passed. Genuine Material components' internal semantic elements are not generic substitutes. Standard prose hyperlinks, headings, tables and the labelled architecture illustration remain semantic content.

Independent read-only GUI review confirmed the initial site at 320/390/1440 pixels, all then-current 22 article routes at 320 pixels, usable mobile theme control, scrolling/inert/focus-restoring drawer and 48px footer action targets. Reported header overflow and font fallback were corrected and rechecked. Missing external-link glyphs were subsequently replaced by Material SVG icons. Final generated-source checks and browser receipts are rerun after documentation/polish updates.

## Publication evidence and required owner setting

The repository is public and source pushes to `main` work. `GET /repos/Ding-Ding-Projects/material-buildroot/pages` returned 404 with `has_pages: false`. Creating Pages using source branch `main` and path `/docs` returned HTTP 403 `Resource not accessible by integration`. Reading Actions permissions also returned 403. These are observed integration permission limits, not an automatic approval-review rejection.

An owner with settings access must open the repository's **Settings → Pages**, choose **Deploy from a branch**, set **main** and **/docs**, and save. After deployment, verify the actual home page, document routes and assets before setting or confirming the About website as `https://ding-ding-projects.github.io/material-buildroot/`. This is the intended URL, not a claim that it is live. Keep PH00-T05 unchecked until live content and the stored homepage are verified.

The GitHub wiki remote was not accessible as an initialized repository. Current wiki content lives in `docs/wiki/` and is rendered on the site. Separate GitHub wiki-service synchronization remains pending. Enabling Discussions previously returned the same integration permission error.

## Boundaries and next work

No desktop build, installer, native guest boot, complete shared feature matrix, authenticated companion or product release has been verified. Only website-specific dependencies were installed. The original desktop scaffold remains unverified.

Resume PH00-T05 when the hosting setting is enabled. Independent application preparation starts next session at PH01-T01. Keep P40–P42 pending until the owner answers. Full D/C parity, complete localized articles, installer downloads and native evidence remain open in later phases.
