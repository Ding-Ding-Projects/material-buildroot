# Material 3 Expressive desktop captures, 2026-10-31

Captures of the running application after the renderer was rebuilt on the repository design (`design/m3.css`, `design/theme.css` and the eight artboards).

## How these were produced

- Source: commit `84bf8c9` on main, renderer built with `vite build`.
- The real Electron shell (`electron .`, Electron 44.9.0) with its real main process and preload, run on Linux under Xvfb with a fresh, disposable profile directory. No fixture bridge was injected.
- Window content size 1440 by 960. Light and dark come from the operating-system colour scheme with the theme left on System.
- Language was switched to English through the application's own language save before capture. Everything else is the fresh-profile state: no saved projects, no running build, setup not completed.
- The palette capture opens the command palette from the title bar search.

## What they show and do not show

They show the rebuilt title bar, navigation rail, Tabs pane, rounded panes, status bar, Images home, Settings navigation, shared search bar, command palette and the design palette carried into Builds, Tools and Help.

They do not show saved projects, running builds, Windows font rendering, display scaling, installed-package behaviour or any WSL or Docker runtime. "Updated Unavailable" is the real value for a source run without installed build metadata. The humour suffix on some sentences is the application's default funny level.

## Files

| File | SHA-256 |
| --- | --- |
| `builds-dark.png` | `f8e62f798ca662b85d8ae7f2e19c26d20d52edda7e7d92ad29dcd317f2f08fb7` |
| `builds-light.png` | `db1c0441e58bd349ee12b787e66204eb01d87c541c24822aa884d2a82e1b6579` |
| `help-dark.png` | `c58331c19237f9fdce945360bd94062604cf34706274115893a695a2e963c32b` |
| `help-light.png` | `9339f45a68b4bfef1eaef0db078ad9a115f53f5f6f099b2719a6b96635c356e1` |
| `images-dark.png` | `259f9e600c1f397faaedbb57bb8758d35de98c380bb94bc692007c18f12802bf` |
| `images-light.png` | `c600926af1e147bf85abeb18b3f09caf97b0d8a633e5a7f1972e310b313ea4c5` |
| `palette-light.png` | `dd0c4965d4455b69d494f6b74d4339755cbb925b931037cf826cb6cbfccb5934` |
| `settings-dark.png` | `b5fb9e93cbfd7cdcbdece51354a1e9a83b388b917b564e78d953ba13a1d5a955` |
| `settings-light.png` | `188e0aa1deb69ad1090b87488ce4b90a1bd8117fb27e5f61ea990a5662edf31e` |
| `tools-dark.png` | `a1d970f9e474eea858d474049ea156d2bd97bb8d542f769a4d12acb8056786a5` |
| `tools-light.png` | `bb0cb94aa79666845ae2f701c6cc85f8a2e9ae5bb3964514923eb5a005c2a284` |
