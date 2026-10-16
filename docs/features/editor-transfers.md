# Editor handoff and browser transfers

The Tools workspace contains editor admission, document handoff, a download-start confirmation, a separate in-window progress dialog and a nonblocking completion notice. These are source implementations; runtime acceptance has not been performed.

## External editor

Discovery checks fixed per-user Programs, Program Files and System32 installation roots without running a candidate. It returns opaque, session-scoped candidate IDs. Selecting a candidate opens the native picker at that candidate, followed by the same hash-bound trust confirmation. Discovery alone grants no execution authority. Portable installations remain available through explicit native selection.

Select an installed `Code.exe`, `Code - Insiders.exe`, `notepad++.exe` or `notepad.exe` through the native picker. The trust confirmation names the selected executable and its SHA-256. The application stores that admission locally and rechecks the executable before each launch. Executable names are a supported adapter selection, not evidence of publisher authenticity: the user must trust the selected file. No executable is probed during admission.

Select a document or exported file through the native file picker, explicitly allow a foreground window, then choose **Open selected document**. The host passes fixed arguments without a shell. The editor receives the original document, so its own edits affect that document. The application records the pre-handoff hash and size. **Compare external changes** hashes the current document; **Acknowledge this exact revision** checks that hash again. This consumer never saves over the document. Changed documents must be reloaded through their owning workflow before a subsequent save.

Handoff metadata is persisted locally before launching an editor. File grants are session-scoped. Restart reports the old process state as unknown and requires a fresh native selection matching the original path and parent identity before reconciliation. Stored metadata never restores file authority or adopts an old process. Acknowledgement persists the exact current fingerprint without saving over user content. An editor replacing a file atomically can be reconciled only while its original parent identity remains unchanged. Unsupported executables, changed executable hashes, unsafe file paths, oversized documents and changed parents stop the operation. Documents are limited to 64 MiB. Code can also open a selected folder as a workspace root. Folder fingerprints include sorted relative entries and content hashes, with a 1,000-entry, 64 MiB and thirty-second bound; oversized projects fail explicitly.

## Download workflow

Enter a supported Buildroot release version and an independently obtained SHA-256, then choose a new output file through the native save picker. The preview binds those inputs to `https://buildroot.org/downloads/buildroot-<version>.tar.gz`. No arbitrary URL, credentials, request headers, command line or destination path is accepted from the renderer.

**Confirm and start** adds the transfer to the existing durable tool queue and starts that queue. The confirmation explicitly states that other already-queued tools may also run. Canceling the start dialog changes no queue state. The optional browser action opens only the fixed official download-information page, and requires the same explicit foreground choice.

The downloader resolves the fixed host to public IPv4 addresses, rejects private and reserved destinations, and pins the chosen address to the TLS request while preserving hostname certificate verification. Redirects and compressed HTTP content encodings are rejected. It uses a ten-second DNS limit, a thirty-second connection inactivity limit, a ten-minute total transfer limit and a 512 MiB maximum. Transfer bytes are streamed to a new partial file, with the received hash checked against the user's expected SHA-256 before exclusive publication. No download is extracted or executed.

Progress reports observed bytes, total bytes when provided, average byte rate and estimated remaining seconds. The completion notice is based on the queue's completed result, not on a started request. Partial data and local JSON receipts are retained beside the selected destination. Successful publication retains the partial hard link and its receipt as evidence. No overwrite or automatic cleanup is performed.

## Recovery

Cancellation stops the active request. Interrupted queue records remain interrupted until explicitly handled. Retrying requires a newly selected destination and a reviewed replacement request; the earlier outcome stays in queue history. Byte-range pause/resume is not implemented, so a retry starts a fresh transfer and preserves the previous partial file. A missing or moved destination grant requires native reselection. A published file whose receipt could not be confirmed is reported as an unknown outcome rather than a safe automatic retry.

## Remaining acceptance and source gaps

- No build, tests, static analysis, editor launch, network download, browser launch, runtime exercise or screen capture was performed for this source change.
- Installed browser-extension capture and authenticated extension-to-desktop transport are not connected.
- Start confirmation and completion remain inside the primary window. An explicit control can keep that host window above other applications without activating or focusing it. The choice remains until disabled or the application closes. Each transfer offers a separate progress window only on explicit action; it opens inactive and can only read, cancel or close its assigned transfer.
- Fixed-root discovery is connected. PATH-wide discovery is deliberately absent. Output-browser entries expose direct Code handoff using existing opaque entry grants, and SDK export returns fresh host-issued grants for direct instruction/receipt handoff. Other export surfaces still require selection in Tools. Code admission is required; these actions never silently substitute another editor.
- Secondary progress uses a dedicated host-owned registry, fixed bundled HTML, isolated preload, sandbox, context isolation and the same restrictive CSP. IPC admission binds the exact webContents, main frame, fixed URL and one host-assigned job. It exposes no general studio API, paths, queue enumeration, start, retry or configuration authority. Navigation and process loss revoke admission. The host closes owned secondary windows when their parent closes. A maximum of four progress windows is enforced.
- Native adapter behavior, cancellation races, DNS/TLS behavior, retained-output recovery, accessibility, localization and display-scale acceptance remain unverified.



