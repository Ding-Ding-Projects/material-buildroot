# Exact-destination clean confirmation

The build workspace exposes the fixed Buildroot `clean` target. Selecting it does
not run it. Submitting requests a short-lived host challenge for the exact adopted
output directory and the complete build request, including runtime and resource
selection. The host resolves the destination; a renderer-supplied path grants no
authority.

The application dialog shows the action and output directory. Two independent
checkbox keys and an explicit clean/rebuild consequence acknowledgement enable a
0–100 confirmation slider. Only completion of the full slider enables submission.
The progress strip animates as the slider moves, marks completion separately, and
respects reduced motion. English, Cantonese and bilingual wording is available.
Emergency exit and Escape cancel without submitting; closing returns focus to the
originating control. Confirmation expires after two minutes.

The resulting authorization is single-use and binds the complete requested action,
workspace identity and exact output destination. Changing any bound field requires
new consent. The host consumes authorization before queueing the clean job. Existing
project trust, path identity, queue admission and revision checks remain required.
The clean target removes generated output according to Buildroot's implementation;
it does not automatically start the next build. Choose a normal build explicitly
after inspecting the clean job's actual outcome. Clean jobs cannot use generic retry:
submit a new clean request and authorize it again.

## Verification status

Source implementation only in the current fast release mode. No tests, static
analysis, runtime interactions, screenshots or destructive operations were run.
Untouched/one-key/both-key states, partial/full slider, cancellation, focus return,
keyboard and assistive technology operation, reduced motion, localization, expiry,
single-use replay rejection and real success/failure paths remain unverified.
This delivery does not claim the complete target catalogue or all destructive
actions elsewhere in the application are covered.
