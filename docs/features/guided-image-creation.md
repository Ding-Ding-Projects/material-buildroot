# Create and resume an image

[繁體中文](guided-image-creation.zh-HK.md)

An image is the Linux system you want to produce. A project keeps its source, configuration and output folders together. Start with what you want to make; the guided workspace helps you choose or open the project afterward.

This article describes the guided-workspace candidate. Actual installed startup, current-GUI ISO production and boot verification remain separate acceptance work. Follow the readiness shown by each operation rather than assuming that a saved choice has already been checked.

## 1. Choose a purpose and target

From **Images**, choose **Create image**. This first step does not open a native folder picker or start a build.

| Entry | What to choose | When to change it |
| --- | --- | --- |
| Image name | Keep the suggested name or enter a short safe filename-style name. | Use a name that helps you recognize the saved draft and proposed exported copy. It does not rename Buildroot's producer output. |
| Mode | Start with Easy. | Advanced exposes the same choices together; it does not reset them or apply a preset. |
| Purpose | Keep existing contents if you already have a configuration. | Minimal, desktop, server and appliance choices express your intention. Their support is checked against the selected source later. |
| Target | The guided ISO target is x86-64 with BIOS startup. | UEFI-only machines are not supported by this guided producer. Do not assume that an unavailable target is supported. |

Choose **Next: source and runtime** when the name is valid. Your choices are saved locally. Returning to Images or closing the application does not turn those choices into execution permission.

## 2. Choose the project and build environment

Use the existing create, open, adopt, import or source-clone workflow that matches your files. A canceled folder picker leaves the image draft available to resume. A suggested project name must not replace a name you have already typed.

Images also lists the real saved project catalogue. A saved project can need **Renew folder access** after reopening the application. Select the intended project folders through the normal picker; a stored project name or path does not grant access by itself. If a different project is selected, the application must not silently substitute it for the requested project.

After the project is accepted, the same image choices continue into its guide. Check the source and runtime before changing configuration. A saved WSL distribution or Docker image name is a saved selection, not a successful access check. The source-permission review names what will be allowed to run; approval, configuration and building are separate actions.

## 3. Choose contents

Only apply a preset after reading the source's actual capabilities. An unavailable or custom choice remains visible instead of being silently replaced. Presets add requested packages to the existing configuration; **Minimal** is not a command to remove every other package.

Use the contextual explanation beside a complicated field for a short example and its full article. Demonstrations change their example only. They do not execute the installed application or prove that a real image works.

## 4. Review and configure

Review the requested changes, selected source and build environment. Select the explicit approval only when those are the intended changes, then apply the configuration. A changed source, configuration or runtime requires a fresh review. Moving to another page or reopening a draft never restores approval or a successful result.

If this project already has another image draft, choose **Resume existing** to keep it, or explicitly replace the draft choices. Replacement preserves a recoverable copy and retains any recorded job identity. If storage is unavailable, full or changed concurrently, the application keeps the existing records and explains what was not saved.

## 5. Build and inspect the result

Start the build only after configuration is confirmed. The result view reports the recorded job, refreshes its log and offers cancellation when the host permits it. A cancellation request is not proof that the process has stopped.

The fixed producer output is `images/rootfs.iso9660`. The image name provides a suggested name for a separately exported copy. Inspection checks the current file's bytes and structure; the file could be from an earlier build. A successful job or structural check does not prove that the image boots.

If a saved job cannot be found, refresh the project-scoped job list. Only a successful lookup proving that the reference is absent enables explicit local detachment. Detaching changes the local saved reference only: it stops no process, removes no output and changes no host job record. Review Builds for running or quarantined work before trying again.

## Continue learning

- [Project creation and folder access](projects/project-workflows.md)
- [Execution setup](execution/setup.md)
- [Image presets](image-presets/README.md)
- [Job interruption and recovery](../security/jobs-and-recovery.md)
- [Output inspection and export](outputs/viewers-and-export.md)
- [Bundled source links](bundled-source-links.md)
