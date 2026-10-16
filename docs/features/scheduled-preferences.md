# Scheduled language and appearance preferences

The Settings schedule workspace edits local date, time, weekday and priority rules.
An explicit Save validates the whole document against the current stored revision.
The effective view identifies active values while preserving the user's base
preferences; expired rules fall back to those base values.

## Editing and recovery

Unsaved edits protect navigation and window close. Pending saves cannot discard or
close the editor. A conflict retains the draft and requires stored-state inspection.
Unknown save or removal outcomes require readback before another mutation; source
removal also requires renewed selection and confirmation.

Explicit discard first records the validated local draft in the separate bounded
history. Restore loads editor data without activating it. Mixed documents preserve
local edits separately only when their external records were not edited. Restoration
combines those local edits with current external records, anchors the current
revision, and rejects identifier collisions or limits. The user still explicitly saves.
See [draft storage and authority](../security/schedule-draft-recovery.md).

## Protected source enrollment

The editor provides list, save and remove controls for explicitly enrolled HTTPS
and Home Assistant origins. Setup retains same-origin choices, requires deliberate
private-address choices and discloses that enabling external rules may apply their
values on refresh. Credentials remain transient operation input and are cleared;
safe readback contains metadata only. Shared restrictions remove editing forms and
block mutations while preserving the permitted metadata view.

## Verification and limits

The current 20-case isolated headless Edge source-preview matrix passed on Windows
in 55.6 seconds. It uses the production SQLite service and typed IPC adapter, with
an explicit fixture for desktop-frame admission. Cases cover save/reload/history,
expiry and shared precedence, base display, navigation and close protection,
conflicts, pending and unknown results, invalid fields, external-rule preservation,
English/Cantonese/bilingual controls and keyboard add at narrow width, enrollment
setup/conflict/shared restriction, durable discard/restore and mixed-document recovery.
Independent source review and TypeScript verification passed for this candidate.

This evidence does not prove native frame admission, packaged-window input,
installed-profile protection, complete language/theme/display-scale layout,
installer/update behavior or full roadmap acceptance. Those remain pending.
No new HTTP API is introduced, so a Postman collection is not applicable.
