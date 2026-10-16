
## Appearance editor implementation

The element context menu opens a non-modal appearance editor for the exact target, including the editor's own controls. Shift+F10 and the context-menu key use the same action provider; the touch menu uses the shared long-press consumer. The editor supports English, Cantonese and bilingual copy. Geometry is viewport bounded, resizeable, and draggable, with Alt+Arrow movement and Alt+Shift+Arrow sizing. Escape restores focus. A narrow viewport can require the panel to overlap its target; non-overlap at every layout is not established.

### Property and state consumers

`src/shared/appearance.ts` owns the property allowlist, numeric bounds, twelve state selectors, validation and CSS serialization. Normal, hover, focus, pressed, selected and disabled overrides are separate. Normal values remain inherited unless an override is authored. Typography includes bundled/browser font families, size, weight, style, decoration line/style/color, capitalization, small caps, alignment, direction, character/word spacing and line height. Colors, border style/width, radius, padding, gap, maximum width and minimum height have live consumers. Standard Material button and text-field typography/color tokens accompany host styles. Closed Material internals and pseudo-elements are not individually authored targets.

Stable explicit element keys and IDs are preferred within the host ancestry. Other static elements use route-scoped structural identity. Repeated record rows without an explicit key are session-only, with a visible explanation, so values are not knowingly applied to another record after restart. Structural identities are not guaranteed across markup changes. Styles cannot supply arbitrary selectors, URLs, script, visibility, pointer behavior, positioning, transforms or focus suppression. Imported unsupported keys reject the complete file. There are at most 1,000 stored targets, 30 named presets and 300,000 serialized characters.

Named comfortable/readable presets, user presets, local style copy/paste, property/state/element/global reset, local import/export, and a bounded editor undo/redo history are implemented. Export excludes custom logo pixels. The inspector uses the shared independent literal/regex search consumer. Imported styles never change installer, executable, update or data-directory identities.

### Continuous color tools

Hue, saturation, brightness and alpha sliders provide continuous values alongside numeric color entry. The translator accepts browser-supported named/HEX/RGB/HSL/HWB/Lab/LCH/OKLab/OKLCH syntax, plus HSV/HSB and CMYK; output readouts include HEX8, RGB, HSL, HSV, HWB, D50 CIELAB/LCH, OKLab/OKLCH and CMYK. A bounded named-color lookup reports a name only when defined by that lookup. Clipboard actions copy one color representation only. The working gamut is sRGB; the UI discloses wide-gamut clipping and profile loss. Opaque contrast is reported with a warning below 4.5:1; alpha/animated-background contrast needs final-surface inspection.

Rainbow is a distinct background sentinel, not a swatch color. CSS traverses six hue stops. A shared speed level from 1 to 10 maps to `max(2, 24 - 2 * level)` seconds. Reduced motion cancels the animation instead of slowing it.

### Animation and transition workspace

`appearance-motion.ts` owns independent named tracks, enable/mute, solo, duplicate, remove and ordering; 2–32 ordered numeric keyframes per track; property, timing, delay, end delay, repeat, direction, fill, playback rate, composition and easing controls. The scoped property allowlist supports text/background/border color, radius, character/word spacing, padding, gap, size and weight. Explicit manual, entry, hover, focus and press triggers use Web Animations, without invoking the protected target action. Leaving hover/focus or releasing press cancels that preview. Playback offers play, pause, resume, reverse, stop/restore, slider seek and exact millisecond seek. OS reduced motion takes precedence; the application preference also cancels active animation while preserving authored tracks.

Track records use local storage and separate validated JSON import/export; logo pixels and credentials are absent. Limits are 16 tracks per target, 32 keyframes each, 60,000 ms duration, bounded delays, 100 repeats, playback rates −4 through 4, and 300,000 characters across stored motion. Transition property, duration, delay and easing use separate CSS consumers. Import refuses unrecognized fields instead of discarding them.

The current follow-up implements scroll/view timelines, groups, numeric sequence offsets, markers, infinite repetition and per-keyframe easing. Path/physics authoring, arbitrary custom renderer properties and portable retention of unknown settings remain unimplemented requirements. Those gaps are not a claim that the renderer cannot support them.

### Local logo conversion

Only bounded PNG and JPEG source bytes are accepted. The worker inspects signatures and dimensions before decoding, rejects animated PNG, limits input to 2 MiB, dimensions to 4,096 and total decoded pixels to four million, and terminates after five seconds. Fit/fill, numeric focal point, crop zoom and alpha background feed actual raster conversion. Only consumed 32/64/128 px PNG derivatives are generated, checked by signature and decoder round-trip, and stored locally. Invalid conversion preserves the previous mark. Reset removes the derived local selection. Original source bytes stay in memory only. The logo changes the application header presentation and local preview, not package identity or OS icon containers.

### Capability and verification boundaries

This is source implementation, not runtime acceptance. Tests, static analysis, reviews, installed execution and screenshots were intentionally not run in the selected delivery mode. The exact root build result is recorded by the owning task. The follow-up adds font enumeration, standard variable axes, semantic state coverage, scheduled appearance profiles and append-only cross-session history. Universal stable dynamic identity, advanced path/physics motion, portable unknown-value retention, every-property palette teleport and deep layered-image tooling remain outstanding. Deep layered-image work belongs to its separate product-roadmap scope; this article does not remove that requirement. A successful compile alone cannot tick those requirements or establish keyboard, contrast, layout, motion or decoder runtime behavior.

Appearance property protection uses the shared experience-policy provider. Each property row and its Material input share an app-scoped `appearance:<target>:<state>:<property>` identity. Original mutation, undo/redo, reset and import consumers consult the registered permission checks; a denied change preserves existing style. Policy registration is a separate integration prerequisite and is not itself evidence of an effective persisted lock.

The combined appearance export includes the validated motion record collection, while separate per-element motion export remains available. Global reset clears motion and custom logo derivatives as well as static styles. Cached PNG headers must match the exact admitted derivative size before display. The property inspector can be collapsed with a persisted keyboard-operable control that continues to disclose the number of active overrides.

## Follow-up source implementation

The appearance host now enumerates installed Windows font family names through a fixed, hidden, bounded read-only command. No renderer-supplied executable, command, argument or file path is accepted. Only safe family names are returned; font bytes are not transmitted. Standard `wght`, `wdth`, `slnt` and `opsz` controls have a real `font-variation-settings` consumer, with unsupported axes preserved rather than described as applied. Baseline, superscript/subscript, outline, shadow, negative spacing and bounded opacity/rotation/scale/translation consumers extend the typography and geometry inspector.

State overrides additionally target dragged, validation, loading, success, warning and error semantics through explicit state/ARIA attributes. This is a presentation mapping, never an operation-status override. It does not fabricate success or clear validation.

### Appearance history namespace

`appearance-history.cjs` reuses `createWorkspaceHistory` in a separate host-owned namespace. Renderer requests never select the path. Append operations are serialized; the underlying reference update remains compare-and-swap. The host validates the entire safe projection before append and after read. Stored snapshots exclude logo pixels, font bytes, preset names, track names, personal-vocabulary content, paths and credentials. Font-family values must match the actual enumerated family catalog. The UI provides paged metadata and restore as a new saved revision. Local style application is immediate; history append follows through a serialized queue and failure is explicitly reported rather than claimed preserved. Local Git availability remains necessary for this store.

### Scheduled complete profiles

The additive `appearance.profile` field is null or a stable local profile ID. Existing schedule precedence and calendar evaluation remain unchanged. Local profiles retain styles, motion and local logo derivatives; neither profile bytes nor images enter schedule source/provider payloads. The renderer subscribes to actual evaluated snapshots, applies an admitted profile as a temporary overlay, and restores the manual base after the rule ends. Missing/invalid/locked profiles are reported. Manual edits remain saved beneath an active schedule. A local profile is saved in the appearance editor and selected through the existing schedule editor. The local profile cache is limited to 20 profiles and 2.5 million serialized characters.

### Additional motion consumers

The expanded workspace adds per-keyframe easing, numeric markers, timeline zoom, parallel groups, sequence offsets, iteration start, infinite iteration, state-attribute triggers and renderer-supported scroll/view timelines. A scroll timeline uses the nearest actual scroll container; a view timeline uses the exact target. Unsupported renderer APIs retain the authored track and report an unavailable preview. Reduced motion continues to cancel animation without erasing authoring values. These source changes do not establish runtime timing, accessibility or screenshot acceptance.

### Motion authoring and identity continuation

The motion workspace now authors a bounded cubic path through six numeric relative coordinates, each within ±24 px. Orientation stays upright. A damped spring model uses explicit mass, stiffness, damping and velocity, emits exactly 32 sampled points, clamps values to the admitted property bounds and snaps the final sample to the target. It is a declared bounded sampling model, not a claim that the browser supplies a native spring engine. Repeat holds append a stationary endpoint segment; automatic timing delegates duration to the renderer. Keyframe sets can be copied locally, pasted and reversed, and cubic-Bezier points have individual numeric controls.

Unsupported JSON imports remain unapplied. The user can explicitly retain the bounded original locally and re-export it unchanged; the retained original never enters history, schedules or renderer styles. Invalid JSON is not admitted to that retained store. This preserves portable input without pretending the unavailable fields executed.

Existing plan, snapshot, revision, native-history and activity rows now carry appearance identities derived from their actual record IDs/revisions. No display label or personal wording is persisted as an identity. Appearance history restore preserves the current named-preset collection and existing local track names because those user-authored names are deliberately excluded from the safe historical projection.

| Capability | Source consumer | Persistence | Runtime verdict |
| --- | --- | --- | --- |
| Static properties and semantic states | Validated declarations and scoped state selectors | Local appearance document | Unrun |
| Installed fonts and standard axes | Host family catalog and CSS font axes | Local values, admitted family metadata in history | Unrun |
| Color translation and rainbow | sRGB translator and CSS animation | Local values/shared speed | Unrun |
| Motion tracks/keyframes/timing | Web Animations with bounded schema | Local tracks, safe history, profiles | Unrun |
| Cubic paths and sampled springs | Numeric path keyframes and 32-point spring sampler | Typed track parameters | Unrun |
| Scroll/view progress | Feature-detected renderer timelines | Typed timeline/axis values | Unrun |
| Schedules | Existing evaluated rule snapshots and temporary local profile overlay | Stable profile ID in schedule; profile bytes local only | Unrun |
| Local history | Separate host-owned append-only history adapter | Immutable validated revisions | Unrun |
| Unsupported portable input | Explicit local retention and unchanged export | Separate bounded local store | Unrun |
| Custom logos | Isolated decoder, fixed PNG derivatives | Local derivative cache; excluded from history/export | Unrun |
