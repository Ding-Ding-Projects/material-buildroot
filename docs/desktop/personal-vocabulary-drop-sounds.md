# Personal wording drop sounds

Actual window file drops request native feedback only after the serialized import returns its validated, persisted result. A successful drop requests the native completion sound once. Invalid JSON, a non-JSON filename, files over 256 KiB, and multiple-file drops request the native invalid-input sound once per drop. Existing wording and visible outcome messages retain their previous behavior.

The renderer sends only `{kind: "applied"}` or `{kind: "invalid"}`. It never sends file contents, metadata, paths, imported headings or mappings to the sound endpoint. Imports remain serialized by the existing vocabulary controller. Rapid drops keep their separate outcomes; each drop continuation requests at most one sound. A separate renderer sound queue waits for each native response without blocking subsequent imports. Queued sounds are discarded when restricted mode or clear invalidates them. The native endpoint also serializes playback; an unavailable or busy response remains silent and is never retried automatically.

Unavailable storage or file reads, restricted/unknown shared mode, and disconnected feedback controls are silent. Restoration, reload, clearing and Settings-file-picker imports do not trigger this drop-only sound route. Playback rejection is contained and cannot undo an applied file, change the result to invalid, or suppress the existing visual celebration, reduced-motion behavior or live-region announcement.

## Verification boundary

Browser fixtures verify the enum-only request counts, serialized valid/invalid outcomes, restricted and unavailable suppression, silence during pending reads, Settings/reload silence and playback rejection isolation. They do not prove audible native output; native endpoint and physical-host audio acceptance remain separate.
