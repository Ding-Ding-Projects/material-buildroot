# Native compiler acquisition

The native file broker requires an x64 MSVC compiler, linker and Windows SDK. The root build pipeline can source `scripts/build/native-toolchain.ps1` and call `Initialize-NativeToolchain` before invoking the native broker producer. Discovery uses the installed Microsoft-signed `vswhere.exe`, admits complete Visual Studio versions 17 or 18 with the C++ tools component, initializes `VsDevCmd.bat` for x64, and requires the compiler, linker, SDK headers and x64 import library. Environment changes affect only the build process. Nothing is installed by discovery.

The hosted Windows 2025 image documents installed Visual Studio, but the build still discovers its actual tools instead of assuming an image label proves readiness. A missing or incomplete SDK stops production. An actual hosted compiler invocation remains necessary evidence.

## Explicit missing-compiler installation

`Get-NativeToolchainPlan` describes the fixed Visual Studio Build Tools 2022 **17.14.42** bootstrapper, file version **17.14.37806.7**, from Microsoft's fixed-version release-history link. Its 4,474,848 bytes have SHA-256 `68978bb28916156802e60e04c5ee50b94348d802fe151a3ca24433f27984187b`. Acquisition requires both that digest and a valid Microsoft Corporation Authenticode signature before execution. Cached downloads are checked again; invalid bytes and interrupted downloads remain retained.

The explicit components are:

- `Microsoft.VisualStudio.Component.VC.Tools.x86.x64`
- `Microsoft.VisualStudio.Component.Windows11SDK.26100`

`Install-PinnedNativeToolchain` requires both `-OwnerApprovedInstallation` and `-LicenseAccepted`. It uses native UAC through `RunAs`, `--quiet --wait --norestart`, English installer resources and a dedicated `Microsoft Visual Studio/2022/MaterialBuildrootBuildTools` destination under Program Files (x86). It does not modify an existing destination, uninstall other installations, force-close applications or request a restart. Installation and related SDK components need administrator consent and Microsoft license entitlement. This helper does not assert that an owner has that entitlement or accept terms on their behalf.

Exit zero is followed by installed-tool discovery. Cancellations, other nonzero results and restart-required code 3010 remain incomplete. Installer logs remain in the Microsoft setup location. This preparation did not install the compiler, exercise native UAC, compile the broker or prove cancellation, rollback or runtime behavior.

## Official references

- [Fixed-version Visual Studio release history](https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-history)
- [Installer arguments and exit codes](https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio)
- [Build Tools component identifiers](https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools)
- [Microsoft license terms](https://visualstudio.microsoft.com/license-terms/)
- [Hosted Windows 2025 image inventory](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md)

These references and the bootstrapper bytes were read during preparation. They describe supported routes, not proof that a particular host is ready.
