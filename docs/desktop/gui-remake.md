# Working with the redesigned desktop

The desktop remake follows the current eight-artboard [design references](../../design/IMPLEMENTATION_HANDOFF.md) from repository revision `9223534b5cfd4f2d6daa62bff9670411931f0f3d`. The earlier attachment is retired as an implementation input. The renderer keeps the existing host API and its source, project, file-access and execution checks. The window shell, Images home, Tabs pane, Settings navigation, shared search bar and command palette now use the design folder's own `m3.css` component anatomy and `theme.css` colour roles, vendored under `src/renderer/design-system/`. Every Material Web component inside the existing workspaces reads the same roles through a token bridge, so Builds, Tools, Help and overlays share one palette in light and dark.

## Create or resume an image

Images opens with filter chips (All, Drafts, Open, Needs attention) and one card per saved project from the host catalogue. A project whose folder access must be renewed shows an error card with **Locate source**. The saved image draft appears as its own card with its stage. **Search projects** reveals the full searchable catalogue with regex, selection and export. Guided image creation sits below, with Easy and Advanced sharing one draft and the five stages shown as cards. Opening a project still renews its actual folder authority through the host. The five-stage creation guide retains its existing saved draft and Easy/Advanced controls.

## Keep work visible

The title bar presents real version and update provenance, the command search (Ctrl+Shift+F opens the same palette), the saved runtime of the open project when known, notifications and accessibility tools. The navigation rail opens Images, Builds, Tools, Help and Settings. New installations use the left workspace dock; an existing saved dock position is preserved. Utility tabs retain their owning project, and closing navigation does not delete a project or silently discard its draft.

## Build, inspect and recover

Builds separates queue and admission state from the selected output. Search that output through its independent literal/regex field, follow loaded output, and resize the dock by pointer or keyboard. Missing project, runtime or measured values remain explicit. Reviewing source permission does not itself configure or build an image.

## Use a tool or read offline help

Tools provides searchable task categories while retaining the existing converter, queue, PDF, editor and related operation routes. Only admitted file capabilities reach the host. Help separates topics, formatted articles and the article outline, with retained Back/Forward history and local document actions.

## Adjust the workspace safely

Settings uses task groups and search while retaining the actual language, appearance, schedule, attention, personal-wording, backup and update consumers. Each owning search has its own adjacent regex workbench and independent state. Existing engine limitations remain visible; the redesign does not certify complete third-party parity.

The palette resolves current permitted actions when invoked. Notification review keeps the selected record IDs and actual host results. Destructive confirmation retains its authorization stages, expiry and emergency cancellation.

## Verification boundary

The current artboards and historical reference images are design data. Sample projects, measurements and successful states are not shipped records. Source checks, browser fixtures, the built desktop, native installation and release publication have separate verdicts in [HANDOFF.md](../../HANDOFF.md). Earlier built evidence does not establish parity with this newer reference. The supported client areas are 1440 by 960 normally and 960 by 640 minimum, with English, Cantonese and bilingual presentation, light/dark themes, keyboard access and reduced motion.
