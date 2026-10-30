# Material Buildroot GUI remake: design handoff

Source design for the full renderer remake of `Ding-Ding-Projects/material-buildroot` (`src/renderer`). Frontend design only; no renderer behaviour was changed.

## Location

In the repository these files live directly in `design/`: the eight artboards, `canvas.json`, the shared `m3.css` and `theme.css`, `audit.md` and `current-screens/`. The same canvas is also hosted as a private design project.

## Pure Material 3 Expressive

Every surface uses Material 3 component anatomy only. There are no native selects, range inputs, checkboxes, tables or disclosure widgets, and no custom widgets outside the Material catalogue. Implement each with the matching registered `@material/web` component where one exists, and follow the Material 3 Expressive specification where the library has not caught up yet.

| Surface need | Material 3 component used |
| --- | --- |
| Window chrome | Custom title bar with a search bar, icon buttons and window controls |
| Destinations | Navigation rail (Expressive, collapsed 96 dp) with menu button, FAB, active indicator and badges |
| Layout | Canonical list-detail and supporting-pane layouts: rounded panes on a surface-container window |
| Tabs (left-docked) | Navigation drawer items as a vertical tab list, with group headers |
| Build output | Resizable pane with drag handle, filter search bar and Follow switch |
| Guide stages | Filled and outlined cards with stage icons and linear progress |
| Records | Expressive segmented lists, one- to three-line items with leading icons or shaped avatars |
| Choices of two to four | Connected button groups (replacing segmented buttons) |
| Choice lists | Radio list items |
| On/off | Switches with handle icon |
| Ranges | Expressive slider: 16 dp track, bar handle, gaps and stop indicators |
| Pickers | Outlined exposed dropdown text fields |
| Text entry | Outlined and filled text fields with supporting text |
| Filters | Filter chips, plus assist chips for quick actions |
| Primary actions | Filled, tonal, outlined and text buttons (Expressive sizes with shape morph on press), split buttons, FAB |
| Bulk actions | Floating toolbar (vibrant) |
| Progress | Wavy linear progress, linear progress with stop indicator, loading indicator |
| Section switching | Primary tabs |
| Context actions | Expressive vertical menu with segmented groups, a filter field and shortcuts |
| Confirmations and wizards | Dialogs with hero icon |
| Transient feedback | Snackbar, badges, elevated card for the dim sum surprise |

## Artboards

Each `.dc.html` artboard links `theme.css` and `m3.css` and has a `dark` toggle in its script props. Layouts adapt to the expanded, medium and compact window size classes. In the compact class the rail becomes a navigation bar and secondary panes hide.

- `Main.dc.html`: Images home.
  - Title bar with build provenance, Ctrl+Shift+F search with regex builder, runtime assist chip, notifications and accessibility tools.
  - Rail with FAB and five destinations, plus a left-docked vertical tab list with groups, pin and lock state.
  - Project cards with shaped icons, stage progress and a split Flash button, plus an error card for a missing source.
  - Guided creation with an Easy/Advanced button group and the five stage cards.
- `Builds.dc.html`: running build with loading indicator and wavy progress, queued and interrupted items, admission and runtime lists, and a resizable output pane with filter and Follow switch.
- `Tools.dc.html`: searchable tool list in segmented groups; file converter with drop card, per-file progress and resume, and output options using dropdown, text field and switches.
- `Help.dc.html`: offline reader with topic drawer, search with regex builder, back and forward, English and Cantonese article button group, and on-this-page navigation.
- `Settings.dc.html`: navigation drawer sections with search and regex, and segmented setting lists.
  - Language mode, the two funny-level Expressive sliders, emoji switch, application name.
  - Narrator, voice dropdowns and action sounds.
  - Theme, density, accent colour and the element appearance editor.
  - The five focus modes.
- `Palette.dc.html`: command palette search view over a scrim, with regex builder chips, filter chips and live rows (switch, slider, article, locked item).
- `Safety.dc.html`: dialogs for the two-key super confirmation with slider and Emergency exit; the lock wizard with PIN keypad; the unlock ladder (dim sum rung); and Support Tickets with the plain disclosure line.
- `Overlays.dc.html`: segmented context menu with filter, shortcuts, Edit appearance and Lock this element; notification list; setup step; accessibility tools; About with code name; dim sum surprise card; snackbar.

## Design tokens

`theme.css` holds the full Material 3 colour role set generated from a blue seed, for light and dark: primary `#415F91`, secondary `#565F71`, tertiary `#705575`, error `#BA1A1A`, and the five surface-container tones. `m3.css` is shared with the Material Browser remake. It holds:

- **Type scale:** the full Material 3 scale with emphasized weights, in Roboto Flex with Noto Sans HK for Cantonese.
- **Shapes:** Expressive shapes, from rounded corners to the cookie and sunny forms.
- **Elevation:** levels 1 to 3.
- **State layers:** hover and press overlays.
- **Motion:** shape morph on press, with a reduced-motion path.

Icons are Material Symbols Rounded. The app keeps its vendored local icon set, with no CDN.

## Implementation notes

- Build with registered `@material/web` components in Lit, matching this anatomy.
- Placeholders in brackets (`[UPDATED-AT]`, `[DATE]`, `[COMMIT]`, `[DIM SUM NAME]`, `[PHOTO]`, `[DISH PHOTO]`) must come from real data.
- Sample project names, sizes and counts are illustrative only; never ship invented records.
- `audit.md` maps every required feature to the current renderer and is the wiring backlog.
