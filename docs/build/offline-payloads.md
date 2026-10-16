# Offline capability payload assembly

`scripts/build/payloads.cjs` exports `assemblePayloads({ output, cache, complete })` for the root build driver. Both directories must be absolute. The output must not already exist. The cache is content addressed and valid downloads are reused; a mismatching existing entry is retained and causes a failure rather than being overwritten. Normal installer production invokes the complete required-bundled inventory through the root entrypoint.

The return value contains `directory`, `manifest`, and an `extraResources` mapping that places the tree at `resources/offline-payloads`. `complete` defaults to true and requires every ID in the explicit ten-engine `requiredBundledToolIds` list. An explicit false value permits an incomplete development package, whose manifest records missing bundled engines. It must never be described as the complete installer.

## Bundled and external capability classification

`src/main/tools/payload-manager.cjs` registers both packaged engines and executable routes selected from an existing host installation. Registration is not a redistribution instruction or evidence that a binary is packaged. The registry explicitly classifies the following additional routes as `external-user-admitted`:

| Tool ID | Host capability | Acquisition and license boundary |
| --- | --- | --- |
| `vboxmanage` | Existing VirtualBox installation | User-managed installation and its applicable license; not redistributed |
| `vmrun` | Existing VMware installation | User-managed installation and its applicable license; not redistributed |
| `qemu-img` | Existing QEMU image utility | User-managed installation and its applicable license; not redistributed |
| `ssh` | Existing OpenSSH client for admitted remote targets | User-managed installation and its applicable license; not redistributed |

These routes still require the existing native executable picker, explicit trust consent, fixed probe and local hash-bound admission receipt. Assembly does not install them, run probes, inspect host availability, acquire credentials, copy local paths or include user admission receipts in a package. They remain supported external routes, with availability determined by the runtime admission and operation rather than by the installer.

The generated manifest states `scope: "bundled-payload-inventory"`, `bundledComplete`, `requiredBundledToolIds` and `externalTools`. The legacy `complete` field is an alias of `bundledComplete` for build-driver compatibility only. Each external row records its acquisition and license boundary, `availability: "not-evaluated-during-build"`, `admission: "required-at-runtime"`, `admissionReceipt: "not-present-in-package"`, `installation: "not-performed-by-assembly"`, and `runtimeVerified: false`. Its provenance names the required native-picker admission route and local receipt scope, not a completed admission event. Each packaged archive row is classified `bundled`, with `runtimeVerified: false`.

`wholeToolsetOffline` remains false because the registered toolset includes these external capabilities. A complete bundled inventory never means every registered route is available offline. Unknown new registered IDs, overlapping classifications, duplicate archive IDs or missing required bundled archives stop assembly. Nothing is automatically downgraded to an external route to make production pass. All ten original bundled requirements, original archives, required notices and hash pins remain in place.

## Candidate inventory

All listed original source archives were acquired and matched to the checked-in SHA-256 and byte-length pins. This is source-acquisition evidence, not installer, engine-execution, offline runtime or redistribution-acceptance proof.

| Engine | Version | Original archive bytes | Composition |
| --- | --- | ---: | --- |
| FFmpeg | 9.0.2 | 114,768,076 | Explicit transcoder profile from the Gyan essentials ZIP, a Windows distribution linked by FFmpeg's official download page; original non-executable documentation and notices retained |
| ImageMagick | 7.1.2-34 | 12,022,003 | Complete official portable Q16 x64 archive, including original notices and security configuration |
| Pandoc | 3.12.1 | 42,154,914 | Complete official Windows x64 ZIP |
| LibreOffice | 26.8.1.1 | 374,870,016 | Read-only reconstruction of original MSI files under INSTALLLOCATION, with the original embedded x64 Microsoft runtime DLLs placed app-locally |
| calibre | 9.16.0 | 217,118,472 | Original portable payload extracted from its PE resource and LZIP version 0 container, without executing the installer |
| qpdf | 12.4.2 | 24,013,395 | Complete official MinGW64 ZIP, plus original project and compiler-runtime license texts |
| Java | Temurin 21.0.12.1+1 JRE | 48,999,141 | Complete official x64 JRE ZIP and legal directory |
| Docker client | 29.4.0 | 46,992,370 | Official standalone Windows client, with original CLI license and notice; the Windows daemon is not included |
| tar | Git for Windows 2.56.0.2 distribution | 60,027,568 | Complete official portable distribution preserving its MSYS runtime, notices and icons; only `usr/bin/tar.exe` is registered as an engine |
| Ollama | 0.40.5 | 1,471,226,485 | Explicitly pinned CPU/base members, helper executables and original notices from the official x64 archive |

The registry records original source URLs, per-archive SHA-256, byte lengths, executable paths and required notice paths. Official release digests supply the GitHub-hosted pins. LibreOffice's official distribution SHA-256 agrees with the upstream installer manifest. The Docker static ZIP is pinned to the bytes acquired directly from the official download host; that pin is not a detached signature or an independent authenticity claim.

## FFmpeg transcoder profile and package size

The registered FFmpeg payload family admits only `ffmpeg.exe`. The converter in `src/main/tools/converter.cjs`, native adapter in `src/main/security/native-file-broker.cjs` and fixed operations in `native/file-broker/main.cpp` use that transcoder. The installed converter-loader handoff also stages the executable named by the FFmpeg record. No supported consumer or declared tool requirement names the upstream standalone `ffplay.exe` player or `ffprobe.exe` analyzer.

The explicit `ffmpeg-transcoder` profile therefore includes the original `ffmpeg.exe` and every original non-executable document and notice. It excludes exactly the following independent executables, without modifying the retained executable or its codec functionality:

| Excluded original member | Original bytes | Original SHA-256 |
| --- | ---: | --- |
| `ffmpeg-9.0.2-essentials_build/bin/ffplay.exe` | 106,903,552 | `befbbd00a25965365f7fb3eed6ad5aa5f805eb70fabc567883a006de3b26c06f` |
| `ffmpeg-9.0.2-essentials_build/bin/ffprobe.exe` | 105,221,120 | `f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52` |

The actual acquired ZIP inventory measures 43 retained files totaling 117,097,063 uncompressed bytes and two excluded independent utilities totaling 212,124,672 uncompressed bytes. These are source-inventory measurements, not predicted or produced installer bytes. All retained files are individually pinned. The manifest records the profile, exact exclusions and reasons, source inventory, complete original archive URL, unchanged archive length and unchanged archive SHA-256. The complete 114,768,076-byte downloaded archive remains preserved in the source cache.

All ten required bundled IDs remain mandatory. No notice, documentation file, registered executable, codec DLL or required runtime companion is removed by this profile. The 1,400,000,000-byte production cap is unchanged. Only the next actual root producer can establish full/delta/Setup sizes and whether those produced files satisfy that cap; no size success is claimed by this source change.

## Extraction and preservation

ZIP acquisition is size bounded, hash checked and extracted with the project's admitted ZIP machinery. ImageMagick also pins every extracted member. The build-only 7-Zip bootstrap and full archive tool have official archive pins and member hashes; they are extracted without running either installer. Downloaded capability executables are never run by the assembly helper.

LibreOffice uses `WindowsInstaller.Installer.OpenDatabase` in read-only mode. The helper reads the File, Component and Directory tables and copies original cabinet bytes into their declared application paths. It never invokes an install action, administrative install, custom action or global runtime installation. Source acquisition reconstructed 19,279 original files. Engine execution from this reconstructed layout remains unverified.

The calibre source installer uses `FindResourceW(NULL, L"extra", L"extra")` and `ELZMA_lzip`, as documented in its [versioned upstream source](https://github.com/kovidgoyal/calibre/blob/v9.16.0/bypy/windows/portable-installer.cpp). Assembly admits the exact resource hash, translates the version 0 LZIP framing to an LZMA container, checks the exact expanded ZIP hash, and extracts the original 1,356-file portable tree. No installer code runs.

Ollama's [versioned Windows build script](https://github.com/ollama/ollama/blob/v0.40.5/scripts/build_windows.ps1) builds CPU/base into the root `lib/ollama` directory, and its [development documentation](https://github.com/ollama/ollama/blob/v0.40.5/docs/development.md) makes GPU backends explicit optional selections. The registry selects the exact pre-hashed root/base files and all root notices. It does not select CUDA, ROCm, Vulkan or MLX subdirectories. This package is CPU only. GPU acceleration requires a separate supported installation and is not claimed as offline bundled behavior.

Original archives, complete retained directories and failure staging are preserved. No binary is committed to Git. Cache and output trees belong under the existing ignored build locations. No normal Git LFS transfer is introduced.

## Bundled-first discovery and integrity

The payload manager loads `resources/offline-payloads/manifest.json` by default. An engine with a bundled record is resolved before any user-selected executable receipt. A bundled hash or path failure does not fall back to a different executable. Executable and companion files are checked for regular-file identity, byte length, SHA-256 and symbolic-link changes. Paths are constrained to the resource tree. A missing bundled manifest retains the existing user-selected workflow for development builds.

The generated manifest inventories every retained file and original archive, with notice locations and upstream source links. `THIRD-PARTY-NOTICES.txt` points to the retained original texts. The complete upstream directories preserve executable resources and icons. Installed product branding remains the responsibility of the installer packaging step.

## Limits and acceptance still required

The classification correction follows hosted run `38970438575`, whose source `bc5531d7b5c3c9fbf0c6da84a3f6c5b490ad25cf` stopped assembly when the four newly registered external routes were incorrectly required as bundled archives. This correction awaits a new source-bound root producer run. The source lane ran no tests, lint, static analysis, engine probes, runtime checks, screenshots, installer execution or installation. PH10-T01 remains open.

License-file presence is an inventory check, not a claim that every third-party source-delivery obligation has been independently accepted. The retained notices and source links require final redistribution acceptance before a complete-distribution claim. The full original archive source remains available by the recorded URLs and pins. No license, patent or codec guarantee is inferred from the archive's presence.

Docker client availability does not supply a Linux container engine, WSL2, virtualization, a Linux kernel or container images. Those host capabilities retain their setup and readiness checks. The standalone Windows daemon would run Windows containers and is deliberately excluded from this Linux-build workflow. No Docker Desktop license or installation is acquired or assumed.

The bundled Java 21 runtime does not prove compatibility with every historical or future Minecraft release. Model files, Minecraft servers, plugins, Buildroot sources, cross-toolchains and user workloads are separate acquired content. This inventory does not claim those are present offline.

Native offline discovery, converter execution, CPU model execution, server execution, update transitions, cancellation and rollback remain separate runtime acceptance. The eventual installer also requires actual Squirrel packaging, output-size checks, license-disclosure review and source-bound release receipts. No release or installation is claimed by this document.
