# Documentation website

This is the initial planning website, independent of the unimplemented desktop application and authenticated companion. It renders the current public planning documents and source wiki directly. Production feature parity remains unchecked in the roadmap.

```sh
npm ci --prefix website
npm run build --prefix website
npm run check --prefix website
```

Commit the generated `docs/index.html`, `docs/.nojekyll` and `docs/site/` with their source changes on `main`. GitHub Pages publishes the `main` branch's `/docs` directory. No separate publishing branch or application dependency installation is required. Generation replaces only its own `docs/site/` directory and generated entry files; it preserves the Markdown planning sources.

The generator derives the checklist from `ROADMAP.md`; website visitors cannot change the authoritative completion state. Build metadata records the actual build time, base Git commit, whether inputs differ from that commit, and the SHA-256 of the exact input snapshot. A clean commit containing generated output necessarily follows generation. Never describe the base commit as the entire built source when the snapshot differs.

The website uses genuine registered `@material/web` buttons, icon buttons, chips, text fields, selects, switches, lists, checkboxes and progress indicators, bundled locally with licensed Roboto font files. [The component inventory](components.json) maps each control to its actual primitive. Native authored form controls and generic disclosure substitutes fail validation. Semantic prose links and tables remain ordinary accessible content.

The initial site has local theme/heading-language preferences, document search and phase filtering. It must fit phones from 320 CSS pixels, with reachable touch controls, a scrolling focus-managed navigation drawer and readable articles. These bounded controls do not complete the broader shared feature catalogue or complete article localization.

For actual browser verification, serve `docs/` under `/material-buildroot/`, install the pinned Playwright browser or use an available Chromium through `DOCS_CHROMIUM_PATH`, then run `node website/verify-browser.mjs`. `DOCS_TEST_URL` selects the local test URL or the intended GitHub Pages URL. The check retains genuine screenshots and a source/artifact-bound receipt in `website/evidence/`. Browser proof remains separate from native Windows and public hosting proof.

`npm run check` validates generated internal routes and fragment destinations, document inventory, roadmap identity uniqueness, completion/evidence links and source metadata. Browser interaction and visual inspection are separate evidence. Rebuild after changing an included document so the website cannot retain an old checklist.

The GitHub wiki service has no accessible initialized repository at the time of initial authoring. `docs/wiki/` contains the canonical starter wiki content and is rendered in this website. Synchronization with GitHub's separate wiki service remains pending.
