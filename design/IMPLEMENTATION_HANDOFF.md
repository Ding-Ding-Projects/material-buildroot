# Material Buildroot GUI remake: design handoff

Source design for the full renderer remake of `Ding-Ding-Projects/material-buildroot`. Frontend design only; nothing in the repository was changed.

## Location

In the repository these files live directly in `design/` (artboards, `canvas.json`, `audit.md`, `current-screens/`). The same canvas is also hosted as a private design project.

## Contents

- `canvas.json`: canvas index (artboard frames and order).
- `*.dc.html`: one artboard per screen. Open in a browser for a rough view; layout is fluid for desktop windows. Each has a `dark` toggle in its script props.
  - `Main.dc.html`: frameless title bar (brand, version and updated-at provenance, Ctrl+Shift+F search, notifications, help, window controls), navigation rail (Images, Builds, Tools, Help, Settings, Setup), left-docked tab strip (pinned, coloured groups, locked tab, dock-edge and tab search, close tabs containing text), Images home with project cards, filters and bulk select, guided five-stage creation with Easy/Advanced.
  - `Builds.dc.html`: queue with running, queued and interrupted jobs, admission limits, runtimes, resizable output dock with filter, regex builder and follow.
  - `Tools.dc.html`: searchable tool list (converter, flashing, download hand-off, Minecraft servers, Ollama suite, external editor, forge publishing, regex and diagram workbenches, SDK export); converter shown as the working tool with progress and resume.
  - `Help.dc.html`: offline reader with topic list, search and regex, back/forward, English/Cantonese article twin, on-this-page headings, changelog and Support Tickets entries.
  - `Settings.dc.html`: tabbed settings with search and regex; language modes, two funny-level sliders, dialog emoji switch, application name, narrator and voices, action sounds, theme, density, accent colour, logo, element appearance editor, the five focus (ADHD) modes, School mode, personal vocabulary, locks and authenticator, history, exports and schedules.
  - `Palette.dc.html`: command palette with anchored regex builder, rich live rows, locked-item behaviour, card/full-window size.
  - `Safety.dc.html`: two-key super confirmation with slider and Emergency exit, lock wizard with all six credential mixes and keypad, unlock ladder (dim sum rung shown), Support Tickets desk with the plain disclosure line.
  - `Overlays.dc.html`: context menu with filter, regex builder, shortcuts, Edit appearance and Lock this element; notification centre; bottom-corner toast; dim sum surprise toast; first-run setup step; accessibility tools; About with code name.
- `audit.md`: feature-by-feature audit of the current renderer against the required feature catalogue (59 GUI features: 30 wired, 24 partial, 3 missing), with route, element and file references.
- `current-screens/`: screenshots of the current shell (light and dark, five destinations) for before/after comparison.

## Design tokens

Material Design 3 roles, seed harbour blue with jade tertiary. Light: primary `#2D5DA1`, primary container `#D7E3FF`, secondary container `#DAE2F9`, tertiary `#326B5B` / container `#B6F0DC`, surface `#F9F9FF`, containers `#FFFFFF #F3F3FA #EDEDF4 #E7E8EE #E2E2E9`, on surface `#191C20`, on surface variant `#44474E`, outline `#74777F` / variant `#C4C6D0`, error `#BA1A1A` / container `#FFDAD6`. Dark equivalents are in each artboard's `.mb.dark` rule. Type: Roboto Flex with Noto Sans HK; icons: Material Symbols Rounded (the app must keep its vendored local icon subset, no CDN). Targets are at least 44 px.

## Implementation notes

- Build with registered `@material/web` components, not the raw HTML used in the mockups.
- Placeholders in brackets (`[UPDATED-AT]`, `[DATE]`, `[COMMIT]`, `[DIM SUM NAME]`, `[DISH PHOTO]`) must come from real data.
- Sample project names, sizes and counts are illustrative only; never ship invented records.
- Start from `audit.md`: the 24 partial and 3 missing features are the wiring backlog.
