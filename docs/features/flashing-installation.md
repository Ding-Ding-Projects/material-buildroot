# Flashing and installation routes

The output inspector includes an exact-destination workflow for physical media and ISO guest preparation. Select a file from the adopted output browser, choose a route, and prepare a two-minute preview. The host resolves the file capability, inspects its format and hashes its bytes. No renderer-provided path or command establishes authority.

## Physical media

Discovery explicitly starts the packaged Windows helper through native administrator consent. The helper queries the fixed Get-Disk inventory. USB, SD and physical devices use the same protection rules: boot, system, online, mounted, read-only and identity-incomplete devices are excluded. Only already-offline disks are eligible. The application does not automatically unmount volumes, take disks offline, change host boot configuration or reboot.

Review the device capacity, host-derived identity, source format, byte count and SHA-256. Type the exact identity before continuing. An application-native confirmation is followed by the elevated helper's destructive confirmation, with cancellation selected by default. Cancelling elevation or either confirmation never means success.

The helper rechecks the destination after consent, opens it exclusively, checks its disk number and capacity through device IOCTLs, and revalidates the disk identity before writing. It holds the source open without write/delete sharing, hashes it before writing, restricts the image to recognized sector-aligned disk/ISO headers, writes in bounded chunks, flushes and hashes the written range by reading it back. Bootability is never inferred from a matching hash. Bytes beyond the image range are not erased or sanitized.

Cancellation is cooperative and applies to the owned operation. After any partial write or failed readback, the receipt remains incomplete. Do not boot or use that destination. Restore from an independently retained backup or prepare and explicitly confirm a new write. Cancellation cannot restore overwritten bytes. Request and result receipts are retained in application-owned local storage for recovery; no automatic deletion occurs.

## ISO guest preparation

An ISO-9660 source can prepare a new owned VirtualBox or VMware guest through the existing guest service, with networking disabled. This creates installation media attachment only. In Virtual machines, create an owned blank disk, attach it, review hardware and launch explicitly. Complete the operating system installer inside the guest. The route reports `guest-created-installation-pending`, never installation success. Guest launch, stop and recovery remain the existing owned guest controls.

## Packaging contract

The separate `native/flashing/MaterialBuildroot.Flash.csproj` targets `net8.0-windows`, self-contained `win-x64`, with a `requireAdministrator` manifest. The root build owner must publish it through the normal root build entrypoint and place `MaterialBuildroot.Flash.exe` under `resources/native/flashing/`, alongside `manifest.json` containing `protocol: 1` and the executable's lowercase SHA-256 in `sha256`. The application verifies that digest before every launch. This is package consistency, not publisher authentication; the executable remains unsigned. SDK acquisition and version pinning belong to the existing root dependency manifest, not this consumer module.

The helper takes only one application-created absolute request-file argument, protocol version 1 and a unique nonce. The host creates the request and validates the corresponding result nonce. It accepts no arbitrary shell command, executable, script or renderer device path. PowerShell is used only for the fixed native elevation launcher and fixed disk inventory expression. This helper is separate from the converter and file broker.

### Root build integration API

The root build owner can dot-source `scripts/build/flashing.ps1` and call `Invoke-FlashingBuild -RepositoryRoot <source-root> -ToolsRoot <owned-cache> -OutputDirectory <new-resource-directory>`. Loading the script defines functions only. Actual invocation must remain inside `build.bat` or `build-installer.bat`; this helper is not a replacement entrypoint. No driver or packaging configuration is changed by this source addition.

The function returns `Directory`, `Executable`, `Manifest`, `Sha256` and `RuntimeAcceptance`. Include the entire resulting directory at packaged `resources/native/flashing/`, including `notices/` and any additional publish files. An existing output is never replaced. Concurrent use of the same tools root fails on an exclusive lock. Corrupt downloads, changed extracted caches, compile failures and missing outputs produce a real exception, with partial material retained.

`native/flashing/build-inputs.json` records SDK 8.0.426 and runtime 8.0.32 from the official [.NET 8 release metadata](https://builds.dotnet.microsoft.com/dotnet/release-metadata/8.0/releases.json), release date 2026-10-13, maintenance support at selection. Both portable archive inputs have official SHA-512 values, bounded downloads, bounded extraction and reuse only after byte verification. The SDK is selected with `global.json` and disabled roll-forward. The self-contained publish pins `RuntimeFrameworkVersion` to 8.0.32 and disables latest-patch substitution. Runtime-pack restoration uses the official NuGet feed at that exact version; a separately generated NuGet content lock has not been produced in this source-only pass. Runtime archive acquisition supplies the preserved original runtime notices, alongside the SDK notices. SDK and runtime archives are not shipped wholesale.

The produced `manifest.json` includes protocol, executable SHA-256, SDK/runtime versions, runtime identifier, self-contained/unsigned declarations, source-file hashes, build-input hash and an explicitly unverified runtime-acceptance field. Manifest creation follows successful [`dotnet publish`](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-publish). It never executes the helper, discovers disks, obtains administrator consent, writes media, publishes a release or claims runtime acceptance.

## Delivery and verification state

Source authored only. Native compilation, helper resource inclusion, package production, administrator consent, disk discovery, physical writes, cancellation, readback, ISO preparation, guest installation, boot and UI acceptance were not executed in this pass. Until packaging supplies the executable and matching manifest, physical operations fail closed with `FLASH_HELPER_UNAVAILABLE`. This document does not claim PH07-T07 runtime acceptance or a usable packaged physical-writing route before that integration.
