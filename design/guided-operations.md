# Guided operations adapter

## Scope and navigation

The existing Lit operations component accepts `presentation="guided"`. The default is `legacy`, and all fourteen existing `tab` values remain valid: runtime, source, package, builds, config, artifacts, guests, assistant, updates, regex, tools, authenticator, companion and documentation.

The guided presentation removes the explorer rail, full destination tab strip and permanent jobs dock from the visible layout. The parent workspace owns the primary Images, Builds, Tools, Help and Settings navigation. Inside Images, the adapter offers image guide, source, project/runtime, generated output and package authoring. Tools uses a categorized selector for local utilities, execution/assistance and connections/security, each opening the existing functional child. The active region is labelled by the actual visible page heading. Legacy tab controls reference corresponding retained panel IDs.

The adapter uses inherited theme colors and registered Material controls. Its own navigation explicitly overrides the shared vertical navigation-rail rules: horizontal direction, automatic width, wrapping, contextual button height and no side border. The supported desktop viewport targets are 1440 by 960 and 960 by 640 CSS pixels. Narrower layouts wrap rather than using a fixed secondary rail.

## Retained state and permission review

Runtime, builds, configuration, output, assistant and updates views mount on their first visit and remain connected afterwards. Existing source, package, guest and utility children retain their previous mounted behavior. Hiding a destination does not recreate its child or discard its draft. In particular, the exact image-presets child and its permission epoch remain intact while navigating away and back.

Configuration separates image guide, configuration inspection, accounts and saved configurations. All four real children remain mounted; only the selected section is visible. ISO permission review selects the inspection section and focuses the review. Returning clears the pending preview and checkbox, reveals the image section, then invokes the same image child's public return method. Changing a configuration section through its controls invalidates outstanding consent and the ISO review context. Existing workspace, domain, generation, destination and disconnect invalidation stays in force. A delayed grant result after navigation cannot recheck or resume the old guide.

The builds destination retains admission, project queue, selected output, cancellation, retry, reconciliation, quarantine and global scheduling controls. New-build admission is initially collapsed in guided mode so reviewing queued or interrupted work does not first require scrolling through runtime setup. Opening admission exposes the existing validated build action; navigation never submits a build.

## Public integration contract

- `openProjectWorkflow(mode: 'create' | 'open')` selects the existing runtime/project section, waits for rendering and calls the project's public method. It does not access another component's shadow implementation. The child preserves typed source draft values, clears consent, and selects its actual existing create/open workflow. Open refreshes the saved project list through the existing read operation. Pending project work is not interrupted.
- `operation-destination-changed` bubbles and crosses shadow boundaries after a destination changes, with `{destination: string}`. This lets the shell synchronize primary navigation without private state inspection.
- `guided-workflow-navigate` is accepted only in guided presentation when its workspace ID exactly matches the adopted workspace and its destination is runtime, source, config or artifacts. Invalid or foreign requests are ignored. Configuration requests reveal the inspection section and runtime requests reveal execution setup. After rendering, a current workspace/generation check focuses the visible destination heading. This event selects presentation only; no command string, authority, configuration change or execution request is accepted.

## Verification and remaining acceptance

The focused renderer suite covers legacy defaults, all fourteen retained destinations, image child identity, explicit project create/open selection and draft retention, workspace/destination allowlists, real tool routing, grouped configuration, visible permission round trips, late consent after subsection changes, queued-build access and minimum-size geometry in English, Hong Kong Cantonese and bilingual modes. The existing ISO permission suite is retained to cover delayed results after workspace, configuration, domain, destination and connection changes.

On October 18, 2026, the focused local run passed 25 tests (12 guided adapter regressions and 13 existing ISO permission regressions). `git diff --check` passed. The preview used its own loopback port and an ignored configuration; no native operation was invoked.

These are isolated renderer fixtures with synthetic host replies. They do not establish WSL or container execution, current-source image production, native startup, installer behavior, source-bound packaged layout, real display scaling or release delivery. The complete built-artifact layout/capture matrix and integration with the replacement five-stage image guide remain parent-workflow acceptance work. Whole-tree TypeScript checking currently has 23 existing diagnostics; no new diagnostic is introduced in the operations adapter. Parent review independently confirmed the baseline diagnostics.
