# Native feedback for local wording-file drops

[香港粵語](vocabulary-drop-sound.zh-HK.md)

After a local wording-file drop finishes validation and persistence, the desktop renderer may request one native sound for its actual outcome. Successful application selects the operating system's local `Media\tada.wav`; invalid input selects the current native `SystemHand` sound alias. The endpoint never receives file content, filenames, paths, mappings or validation details.

The sandboxed preload exposes `window.studio.vocabularyDropSound({kind: 'applied' | 'invalid'})`. Both preload and main process reject every other property or enum value. The main process also requires the admitted desktop sender and rechecks that authority before queued playback. Four pending requests are allowed, including the active request. Accepted requests play in order through synchronous native playback in hidden, bounded local child processes.

The route respects the host's existing volume, mute and sound-scheme settings. It changes none of them, uses no network or downloaded sound, runs no renderer-provided commands and records no imported content. An accepted native request returns `{ok: true, status: 'requested'}`. This confirms the native call, not human-audible output. Missing media, unsupported hosts, unavailable playback or a full queue return a separate unavailable/busy result and never change whether the wording import succeeded or failed. No generic beep substitutes for a missing success sound.

Focused checks cover strict enum admission, unauthorized senders, accessor rejection, serialized order, bounded queue capacity, authority revocation, native-launch arguments, local-only media selection and preload payload narrowing. Actual audibility depends on the host audio settings and hardware.
