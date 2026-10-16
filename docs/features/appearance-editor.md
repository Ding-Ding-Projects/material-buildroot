# Element appearance, motion and local profiles

[香港粵語](appearance-editor.zh-HK.md)

Material Buildroot provides a target-specific, non-modal appearance editor through the shared element context menu. The keyboard context-menu route and touch long-press route use the same action. The shared command inventory lists every admitted property, identifies the current target, and opens/focuses the actual editor control. Execution re-resolves the stable target; a missing or ambiguous target produces an unavailable editor without changing another element. A workspace-surface fallback is explicitly labelled when no element has been selected.

This article describes current source behavior. Production builds have been produced, but tests, static analysis, reviews, installed execution, interaction and screenshots were intentionally not run in the selected delivery mode. No statement below constitutes rendered acceptance. Historical build receipts remain bound to their original commits in the task evidence, not relabelled as proof for later source.

## Editing and persistence

The editor uses registered Material controls, English/Cantonese/bilingual copy, an independent search/regex consumer, property/state reset, element/global reset, named presets, local style copy/paste, undo/redo and validated JSON transfer. It is draggable and resizable, with Alt+Arrow movement and Alt+Shift+Arrow sizing. Escape closes it and restores focus. Geometry and the property-inspector collapse preference persist locally. A collapsed inspector continues to report its active override count. At a narrow viewport the bounded panel may overlap its target; non-overlap at every supported layout is not established.

`src/shared/appearance.ts` owns the admitted properties, ranges and serialization. Imported declarations, selectors, scripts and network references are never executed. Values cannot supply visibility, pointer suppression, arbitrary positioning or focus removal. Opacity, rotation, scale and translation remain bounded to preserve the productive control. Material typeface/color roles accompany applicable host properties so the supported public component anatomy receives those values.

Explicit record keys and IDs are preferred within the shadow-host ancestry. Plans, snapshots, revisions, native-history records and activity entries use their actual stable IDs/revisions, not display names. Other static elements use route-scoped structural identity. Unkeyed repeated records recognized by the adapter remain session-only with a visible explanation. Structural identities are not guaranteed across future markup changes; universal durable identity for every other dynamic surface is not established.

Normal, hover, focus, pressed, selected, disabled, dragged, validation, loading, success, warning and error presentation states have separate scoped overrides. Semantic state selectors read existing state/ARIA attributes; they never manufacture operation success, remove validation or grant an action. Closed primitive internals and pseudo-elements remain managed by the primitive's supported public roles rather than arbitrary internal selectors.

The appearance document is limited to 1,000 target records, 30 named presets and 300,000 serialized characters. Unknown properties reject the complete applied import. Unsupported valid JSON can instead be explicitly retained in a separate local store, up to 650,000 characters, and exported unchanged. That retained input is never applied, indexed as an executable setting, transmitted to the host history adapter or included in schedules. Invalid JSON is not admitted to the retained store.

## Typography and color

Typography controls include installed/bundled/browser family selection and previews; size, weight, italic/oblique, decoration line/style/color, double decoration, capitalization, small caps, alignment, direction, negative/positive character and word spacing, line height, baseline, superscript/subscript, text outline and shadow. Standard `wght`, `wdth`, `slnt` and `opsz` axes have a real CSS consumer. An unsupported axis remains saved without a claim that it changed the chosen face.

The host font route runs one fixed hidden read-only enumeration command, with no renderer-supplied executable, argument or path. It admits safe family names, bounds time/output/count, and returns names only. Font bytes never cross the bridge. Font-specific variable-axis metadata/ranges are not enumerated; the editor exposes bounded standard axes and states that capability boundary.

Hue uses a continuous spectrum on the Material slider; saturation, brightness and alpha have continuous sliders and exact numeric color entry. The translator accepts browser-supported named, HEX/HEX8, RGB/RGBA, HSL/HSLA, HWB, CIELAB/LCH and OKLab/OKLCH input, plus HSV/HSB and CMYK. Readouts include their supported representations and a named value when present in the name catalog. Clipboard actions copy one color representation. The working gamut is sRGB; the UI warns that wider-gamut input is clipped and profile information is not retained. The displayed contrast ratio is opaque contrast, with an explicit warning that alpha and animated backgrounds require final-surface inspection.

Rainbow is a distinct background sentinel, never a swatch color. CSS traverses six hue stops. One speed level from 1 to 10 maps to `max(2, 24 - 2 * level)` seconds. CSS animations synchronize to the shared document timeline when admitted, without per-frame script repainting. Operating-system or application reduced motion cancels the cycle and retains a stable hue.

Primary, on-primary, surface, on-surface and outline role colors use the same color tools. Admitted role-color motion requests typed color registration when supported by the renderer. Arbitrary unregistered custom properties are not accepted.

## Animation and transitions

The motion workspace provides independent named tracks; enable/mute, solo, duplication, removal and ordering; group playback; numeric sequence offsets; 2–32 ordered keyframes per track; local keyframe copy/paste/reversal; per-segment easing; and numeric markers. Track controls include duration, automatic duration, negative/positive delay, end delay, repeat hold, finite/infinite repetition, iteration start, direction, fill, playback rate, composition, named easing and editable cubic-Bezier points.

Playback includes play, pause, resume, reverse, stop/restore, document-timeline scrubbing, numeric seeking, zoom and 1/60-second stepping. Automatic duration is reported as renderer-computed rather than assigned an invented total. Repeat-hold time participates in finite duration readouts. Scroll/view timelines use the renderer API when available, the nearest actual scroll container or exact view target, and an explicit axis. Their progress is source-driven; millisecond seeking reports the unavailable operation instead of assigning an incompatible time value.

Manual, entry, hover, focus, press and semantic state-attribute triggers invoke presentation only, never the underlying protected action. Leaving hover/focus or releasing press cancels that preview. Overlapping tracks use explicit replace/add/accumulate and their authored order. Renderer capability failures are reported without discarding authored values.

Cubic motion paths use six numeric relative coordinates bounded to ±24 px and retain upright orientation. The spring model has explicit mass, stiffness, damping and velocity. It produces exactly 32 deterministic samples, clamps values to the admitted property range and snaps the final sample to the target. This is a declared bounded sampling model, not a native-physics claim. Repeat holds append a stationary endpoint segment.

Limits are 16 tracks per target, 32 authored keyframes, 60,000 ms duration and bounded delays, up to 100 finite repetitions or the explicit infinite sentinel, and playback rates −4 through 4. Infinite tracks remain stoppable and obey reduced motion. The complete persisted motion collection is bounded to 300,000 characters. Transition property, duration, delay and easing have separate CSS consumers. Source coverage is the admitted property registry, not every arbitrary CSS property exposed by a browser.

## Local logo presentation

The local logo editor provides shipped transparent/light/dark presentations and a custom PNG/JPEG picker, fit/fill, numeric focal point, crop zoom, alpha background, and real 32/64/128 px previews. Conversion occurs in an isolated worker. It inspects source signatures and dimensions before decode, rejects animated PNG, bounds input to 2 MiB, dimensions to 4,096 and total decoded pixels to four million, and terminates after five seconds. Emitted PNGs receive signature/dimension/decoder-round-trip checks before use. Cached derivative headers must match their admitted sizes.

Only the derivatives used by the interface are produced. Conversion flattens color profiles and drops metadata; the UI discloses this. Invalid conversion retains the prior selection. Reset removes the derivative selection. Original source bytes remain in memory only. Custom pixels are excluded from appearance export and host history. Presentation changes never alter the executable, installer, update feed, application ID or data-directory identity. OS icon-container replacement is not implemented by this presentation surface.

## Local history and scheduled profiles

`appearance-history.cjs` reuses the existing append-only local history abstraction in a separate host-owned namespace. The renderer never selects its path. Appends are serialized and the underlying reference update remains compare-and-swap. The host validates the safe projection before append and after read. Snapshots exclude image/font bytes, custom preset/track names, personal-vocabulary payloads, paths and credentials. Family names must match the admitted installed catalog. Local Git availability remains necessary.

The editor reads paged metadata and restores through the real consumers as a fresh revision. Restore preserves current local named presets and existing track names, because those names are deliberately absent from the safe historical projection. Local style application is immediate; history preservation follows through a serialized queue. A failed history append is explicitly reported and is not claimed preserved. Cross-store application and history append are not one atomic transaction.

The additive schedule field `appearance.profile` is null or a stable locally stored profile ID. Existing calendar evaluation and language/theme precedence remain unchanged. Profiles carry local static styles, motion and logo presentation; schedule/provider payloads carry the ID only. The renderer subscribes to actual evaluated snapshots, applies a validated temporary profile overlay and restores the manual base when the rule ends. Missing, invalid or locked profiles are reported. Manual edits stay saved beneath an active profile. Profiles are saved in the appearance editor and chosen in the existing schedule editor. The profile cache is limited to 20 profiles and 2.5 million serialized characters.

## Permission and acceptance boundaries

Property rows and their public Material controls share `appearance:<target>:<state>:<property>` experience identities. Original mutation, undo/redo, import and reset consumers consult the registered permission provider. Motion uses the corresponding target's motion identity. A denied mutation preserves the prior value. Registration and source integration do not prove a persisted lock worked at runtime.

| Capability | Implemented consumer | Stored representation | Runtime verdict |
| --- | --- | --- | --- |
| Properties and semantic states | Allowlisted declarations/state selectors | Local appearance document | Unrun |
| Font families and standard axes | Host name catalog and CSS axes | Local values; safe family metadata in history | Unrun |
| Continuous color tools/rainbow | sRGB translator and synchronized CSS animation | Values/shared speed | Unrun |
| Tracks/keyframes/timing | Bounded Web Animations consumer | Local tracks/history/profiles | Unrun |
| Paths/springs | Numeric cubic path and 32-point sampler | Typed parameters | Unrun |
| Scroll/view progress | Feature-detected renderer timelines | Timeline/axis values | Unrun |
| Palette teleport | Shared command provider and live stable lookup | No command-specific mutable state | Unrun |
| Scheduled profiles | Evaluated snapshots and temporary overlay | ID in schedule, profile locally | Unrun |
| History/restore | Separate validated append-only adapter | Immutable safe revisions | Unrun |
| Unsupported portable input | Explicit local retention and unchanged export | Separate bounded store | Unrun |
| Logos | Isolated decode and admitted derivatives | Local derivative cache | Unrun |

Full layered-image editing remains separate roadmap work. Arbitrary CSS/custom-property authoring, font-specific axis discovery, universal stable identity outside instrumented records, complete non-overlap layout, and full rendered acceptance remain unproved or unimplemented as described above. A successful build cannot establish those claims or satisfy the required keyboard, localization, contrast, scale, decoder, timing and per-interaction capture evidence.

### Stable workspace-tab and group identity

Workspace-tab targets may declare `data-appearance-owner="workspace-tabs"` with a bounded explicit key: `tab:workspace:<backend-id>`, `tab:utility:<owner-and-destination>` or `group:<stable-id>`. The appearance adapter uses this route only within an instance of the registered `workspace-tabs` component belonging to the current application. It hashes the fixed presentation namespace plus that explicit key independently of the application route, group placement and ancestor order. Descendants receive separate structural suffixes relative to the nearest explicitly keyed target, rather than sharing the parent style identity.

The marker conveys presentation identity only. It never grants an action, changes a credential, bypasses the permission provider or treats DOM metadata as authorization. Original appearance mutation checks remain in place. Duplicate live identities remain ambiguous for command re-resolution instead of silently selecting a different target. Changes to the explicit identity attributes schedule reassociation. Other element identities retain their existing behavior.

Earlier structural records are preserved and are not automatically reassigned to a new namespace, because a reordered old position cannot prove which record originally owned the style. This source addition has a candidate-bound production build only; tab/group reorder, route changes, persistence and permission behavior still require the separate runtime acceptance pass.
