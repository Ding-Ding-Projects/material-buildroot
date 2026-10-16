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

## Native layout repair

The first actual desktop build at `10ec6bc40eb985f8c0f62f3d104bd97856dbf4f4`
confirmed save, draft preservation, editor-only restoration, invalid-draft rejection
and restart persistence through the real admitted frame. Both owned native runs
closed normally, with all four processes absent and each named desktop gone.
This is current-host built-payload evidence, not installer or native keyboard-input proof.

That built run also exposed horizontal rule-editor overflow at a 1280 × 752 logical
viewport and actual 150% scale. A seven-element validated layout receipt measured
503/531 px layout client/scroll widths and 296/325 px editor widths. The panel was
only about 503 px wide even though viewport media queries selected the two-column
layout. Implicit intrinsic grid tracks compounded the mismatch.

The bounded repair uses the panel's inline-size container for responsive rules and
explicit shrinkable single-column tracks. A regression first failed against the
original styles, then passed at 1200, 1280 and 1440 px widths in bilingual light mode
at device ratio 1.5. TypeScript and independent source review passed. The expanded
Material touch region is excluded from visible-content geometry checks; panel,
field and control bounds and owning-main scroll containment remain asserted.
The rebuilt native after-state and identical-tuple measurement are still pending.
