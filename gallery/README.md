# Material Buildroot screenshot gallery

This is a bilingual, provenance-bound screenshot gallery prepared for the Material Buildroot Pages site. After the parent repository publishes this change, the nested site will be available at `https://ding-ding-projects.github.io/material-buildroot/gallery/`. This is a nested site in the main repository; a separate gallery repository was not created.

The gallery contains 51 reviewed original PNGs across six collections:

- 24 latest retained workspace renderer captures from source revision `e8f9bebf2b96397b00000be485870a61c16cb3e2`.
- 9 historical workspace captures from `7c14df34ffe785e2a7e108b17f839e15668d1183`.
- 6 captures of the interactive documentation site, including the 320 CSS-pixel supplemental view.
- 5 historical landing-refresh captures and 5 early website-preview captures.
- 2 historical v0.1.0 packaged desktop-shell captures from `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd`.

The app set is the latest retained capture set, not proof of every newer screen. Shared-mode, queue/catalogue, and schedule changes after `e8f9beb` are not pictured. The renderer captures show visible states only; typed fixture data and unverified native operations are identified per image. They do not establish Windows, installer, guest boot, host build, or LAN-companion acceptance. The archived desktop-shell inventory does not identify the capture host operating system, so those two images do not establish Windows-native acceptance.

Each image is byte-for-byte identical to its reviewed source. `captures.json` records its SHA-256, image pixel dimensions, recorded viewport (when known), capture time when the source recorded one, source provenance, and evidence boundary. Website preview receipt-check timestamps are kept separate from capture time. Where the source did not record an individual capture clock, capture time is explicitly unavailable; it is never inferred from a filename or filesystem timestamp. The current interactive-site preview was built from a source snapshot whose inputs differed from base commit `c527753`; the separately recorded delivered source commit is `3de9822`. The historical landing refresh likewise records its build base and delivered commit independently.

The browser interface uses locally bundled `@material/web` 2.4.1 controls. Search, collection chips, language choice, light/dark theme, and provenance disclosure act only on this gallery in the browser. Language and theme preferences are stored locally in the browser. The layout supports 320 CSS-pixel screens, keyboard interaction, and reduced-motion preferences.

To rebuild the local Material bundle from this repository root with the already installed website toolchain, run `./website/node_modules/.bin/esbuild gallery/components.js --bundle --format=esm --target=es2022 --minify --alias:@material/web=./website/node_modules/@material/web --outfile=gallery/assets/material-components.js`, then copy that file to `docs/gallery/assets/material-components.js`. The alias pins package resolution to the admitted `website/node_modules/@material/web` 2.4.1 instead of a different root-level package. Keep `gallery/THIRD_PARTY_NOTICES.txt` beside the source and copy it to `gallery/assets/THIRD_PARTY_NOTICES.txt` and `docs/gallery/assets/THIRD_PARTY_NOTICES.txt`; no new package is required. The bundle metafile check confirmed all 83 Material inputs came from that pinned directory.

## Captures not included

Preliminary shared-mode, queue, and vocabulary screenshots under unmanifested local cache paths are withheld. Their source identity and capture conditions are not established by an admitted manifest, so they cannot be represented as reviewed evidence. No source code, private instructions, credentials, or local filesystem paths are included in the public gallery.

## Validation

The local source preview has passed browser checks for all registered Material controls, bilingual chip labels, filters and search, provenance disclosure, keyboard activation, preference persistence, reduced motion, all 51 image decodes, and widths from 320 to 1440 CSS pixels. Sanitized observed results and local source asset SHA-256 values are in [`local-browser-receipt.json`](local-browser-receipt.json); it records no capture clock. The gallery is still prepared and awaits the parent repository's commit and deployment. Treat it as unpublished until the live route and all 51 image responses have been verified against `captures.json`.
