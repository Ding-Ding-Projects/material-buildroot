
## Appearance editor implementation

The element context menu opens a non-modal appearance editor for the exact target, including the editor's own controls. Shift+F10 and the context-menu key use the same action provider; the touch menu uses the shared long-press consumer. The editor supports English, Cantonese and bilingual copy. Geometry is viewport bounded, resizeable, and draggable, with Alt+Arrow movement and Alt+Shift+Arrow sizing. Escape restores focus. A narrow viewport can require the panel to overlap its target; non-overlap at every layout is not established.

### Property and state consumers

`src/shared/appearance.ts` owns the property allowlist, numeric bounds, six state selectors, validation and CSS serialization. Normal, hover, focus, pressed, selected and disabled overrides are separate. Normal values remain inherited unless an override is authored. Typography includes bundled/browser font families, size, weight, style, decoration line/style/color, capitalization, small caps, alignment, direction, character/word spacing and line height. Colors, border style/width, radius, padding, gap, maximum width and minimum height have live consumers. Standard Material button and text-field typography/color tokens accompany host styles. Closed Material internals and pseudo-elements are not individually authored targets.

Stable explicit element keys and IDs are preferred within the host ancestry. Other static elements use route-scoped structural identity. Repeated record rows without an explicit key are session-only, with a visible explanation, so values are not knowingly applied to another record after restart. Structural identities are not guaranteed across markup changes. Styles cannot supply arbitrary selectors, URLs, script, visibility, pointer behavior, positioning, transforms or focus suppression. Imported unsupported keys reject the complete file. There are at most 1,000 stored targets, 30 named presets and 300,000 serialized characters.

Named comfortable/readable presets, user presets, local style copy/paste, property/state/element/global reset, local import/export, and a bounded editor undo/redo history are implemented. Export excludes custom logo pixels. The inspector uses the shared independent literal/regex search consumer. Imported styles never change installer, executable, update or data-directory identities.

### Continuous color tools

Hue, saturation, brightness and alpha sliders provide continuous values alongside numeric color entry. The translator accepts browser-supported named/HEX/RGB/HSL/HWB/Lab/LCH/OKLab/OKLCH syntax, plus HSV/HSB and CMYK; output readouts include HEX8, RGB, HSL, HSV, HWB, D50 CIELAB/LCH, OKLab/OKLCH and CMYK. A bounded named-color lookup reports a name only when defined by that lookup. Clipboard actions copy one color representation only. The working gamut is sRGB; the UI discloses wide-gamut clipping and profile loss. Opaque contrast is reported with a warning below 4.5:1; alpha/animated-background contrast needs final-surface inspection.

Rainbow is a distinct background sentinel, not a swatch color. CSS traverses six hue stops. A shared speed level from 1 to 10 maps to `max(2, 24 - 2 * level)` seconds. Reduced motion cancels the animation instead of slowing it.

### Animation and transition workspace

`appearance-motion.ts` owns independent named tracks, enable/mute, solo, duplicate, remove and ordering; 2–32 ordered numeric keyframes per track; property, timing, delay, end delay, repeat, direction, fill, playback rate, composition and easing controls. The scoped property allowlist supports text/background/border color, radius, character/word spacing, padding, gap, size and weight. Explicit manual, entry, hover, focus and press triggers use Web Animations, without invoking the protected target action. Leaving hover/focus or releasing press cancels that preview. Playback offers play, pause, resume, reverse, stop/restore, slider seek and exact millisecond seek. OS reduced motion takes precedence; the application preference also cancels active animation while preserving authored tracks.

Track records use local storage and separate validated JSON import/export; logo pixels and credentials are absent. Limits are 16 tracks per target, 32 keyframes each, 60,000 ms duration, bounded delays, 100 repeats, playback rates −4 through 4, and 300,000 characters across stored motion. Transition property, duration, delay and easing use separate CSS consumers. Import refuses unrecognized fields instead of discarding them.

Scroll/view timelines, arbitrary/custom renderer properties, path and physics animation, track groups/sequencing, marker editing, infinite repetition, per-keyframe easing and portable retention of unknown settings remain unimplemented. Those are required advanced motion capabilities, not a claim that the renderer cannot support them. The bounded workspace is a partial implementation of the full motion contract.

### Local logo conversion

Only bounded PNG and JPEG source bytes are accepted. The worker inspects signatures and dimensions before decoding, rejects animated PNG, limits input to 2 MiB, dimensions to 4,096 and total decoded pixels to four million, and terminates after five seconds. Fit/fill, numeric focal point, crop zoom and alpha background feed actual raster conversion. Only consumed 32/64/128 px PNG derivatives are generated, checked by signature and decoder round-trip, and stored locally. Invalid conversion preserves the previous mark. Reset removes the derived local selection. Original source bytes stay in memory only. The logo changes the application header presentation and local preview, not package identity or OS icon containers.

### Capability and verification boundaries

This is source implementation, not runtime acceptance. Tests, static analysis, reviews, installed execution and screenshots were intentionally not run in the selected delivery mode. The exact root build result is recorded by the owning task. Font enumeration, variable axes, advanced word-processing effects, deep layered-image tooling, complete pseudo-state coverage, universal stable dynamic identity, scheduled appearance binding, append-only cross-session history, every-property palette teleport and all advanced motion rows remain outstanding. Deep layered-image work belongs to its separate product-roadmap scope; this article does not remove that requirement. A successful compile alone cannot tick those requirements or establish keyboard, contrast, layout, motion or decoder runtime behavior.

Appearance property protection uses the shared experience-policy provider. Each property row and its Material input share an app-scoped `appearance:<target>:<state>:<property>` identity. Original mutation, undo/redo, reset and import consumers consult the registered permission checks; a denied change preserves existing style. Policy registration is a separate integration prerequisite and is not itself evidence of an effective persisted lock.

The combined appearance export includes the validated motion record collection, while separate per-element motion export remains available. Global reset clears motion and custom logo derivatives as well as static styles. Cached PNG headers must match the exact admitted derivative size before display. The property inspector can be collapsed with a persisted keyboard-operable control that continues to disclose the number of active overrides.
