# Owner decisions

## Confirmed

| Decision | Selection |
| --- | --- |
| Desktop platform | Windows |
| Runtime | Requested desktop web runtime |
| Interface | Complete genuine Material Design 3 controls |
| Build execution | WSL and Docker |
| Shared application features | Complete required baseline |
| Repository | Public `Ding-Ding-Projects/material-buildroot` |
| Website | GitHub Pages documentation companion |
| Working branch | `main` only, frequent publication checkpoints |
| Current session | Planning and owner interview |
| Implementation | Next development session |

## Pending owner interview

| ID | Topic | Current recommendation | Owner answer |
| --- | --- | --- | --- |
| P01 | Audience | Beginners and experienced developers | Both beginners and experienced builders |
| P02 | First complete workflow | Board selection through image export | Choose a board, configure, build and export an image |
| P03 | Default backend | WSL 2, Docker selectable | Ask per project and remember the choice |
| P04 | Source setup | Existing trees and official releases | Also manage Git clones, branches and upgrades |
| P05 | Initial hardware | Owner's actual boards plus an emulator fixture | VMware Workstation and VirtualBox guest targets |
| P06 | In-app development | Full package, overlay and external-tree editors | Full package, overlay and external-tree editors |
| P07 | First implementation milestone | One complete workflow and shared services, with all baseline requirements retained | Complete specified application and all shared features |
| P08 | Guest content | Selectable minimal/desktop/server/appliance presets | Selectable minimal, desktop, server and appliance presets |
| P09 | Image formats | ISO, VMDK, VDI and OVA | Bootable ISO, VMDK, VDI and OVA appliances |
| P10 | VM lifecycle | Create/import/configure/launch controls | Create/import/configure/launch through rich controls |
| P11 | Firmware | Both UEFI and BIOS | Both UEFI and legacy BIOS, compatibility presets |
| P12 | Architecture | x86_64 first, broader Buildroot controls retained | x86_64 first, retain other architectures in Buildroot controls |
| P13 | WSL prerequisite ownership | Dedicated managed distro plus existing distro support | Offer dedicated managed distro and support existing distros |
| P14 | Buildroot versions | Current stable, maintained LTS and chosen Git refs | Current stable, maintained LTS and chosen Git refs |
| P15 | Configuration reconciliation | Staged edits, preview and Apply | Immediately after every edit, with undo/history |
| P16 | Upgrade safety | Snapshot/preview migration or separate upgraded project | Snapshot first, preview migration, require Apply |
| P17 | Kernel/BusyBox/U-Boot editors | Full supported configuration editors | Full rich editors for all supported configuration systems |
| P18 | Project storage | Linux-side sources/output, Windows browse/export | Linux-side WSL storage or Docker volumes, Windows browse/export |
| P19 | Rebuild policy | Explain required clean rebuild and confirm | Explain why and offer a confirmed clean rebuild |
| P20 | Default release channel | Maintained LTS | Maintained Buildroot LTS |
| P21 | Windows application architecture | x64 and ARM64 | Windows x64 first |
| P22 | Output previews | Safe text/graphs/archives/read-only filesystems | Everything feasible, including genuine screenshots after guest boot tests |
| P23 | Offline bundle delivery | Complete installer or complete capability packs | One complete installer, accepting a large download |
| P24 | Fresh language/theme | Bilingual and system theme | Bilingual and system theme |
| P25 | Native acceptance host | Exact Windows/VMware/VirtualBox versions and accessible host | Newest stable versions; exact versions and host access must be discovered |
| P26 | Concurrent projects/builds | Multiple projects with global resource limits | Per-project queues and global CPU/RAM/storage limits |
| P27 | Expert terminal | Scoped embedded terminal supplement | Embedded terminal scoped to selected runtime/project |
| P28 | Desktop presets | Several genuinely supported desktop/compositor choices | Several supported choices with previews |
| P29 | Guest networking | NAT default, bridged/host-only/advanced controls | NAT default, bridged/host-only and advanced controls |
| P30 | Guest account/SSH provisioning | Guided accounts/keys, no shared default password | Full configurable account/SSH presets with security explanations |
| P31 | Reproducibility | Locks/hashes/manifests/SBOM/licenses/repeat-build comparisons | Complete first-class reproducibility workflow |
| P32 | Buildroot model assistance | Explanations and reviewed change proposals | Full local assistant workflows with checkpoints and reviewed actions |
| P33 | Browser companion | Secure opt-in desktop connection | Secure opt-in companion alongside full website coverage |
| P34 | Companion browsers | Edge and Chrome first | Edge and Chrome, explicit pairing |
| P35 | Companion reachability | Local-only pairing and revocable scoped permissions | Also authenticated access from other LAN devices |
| P36 | Guest boot acceptance | Boot/login/networking/disk persistence/graceful guest shutdown | All five checks required |
| P37 | Secure Boot | Explicit support states and required-format signing only | BIOS/UEFI without Secure Boot first |
| P38 | Cleanup policy | Configurable budgets, preserve records, confirm destructive cleanup | Keep everything until the user chooses cleanup |
| P39 | Additional first-delivery workflows | Owner can name additional essentials | All listed: SDK/toolchain export, image flashing, guest installers, remote Buildroot execution and cloud upload |
| P40 | Cloud destinations | S3-compatible, Azure Blob, Google Cloud Storage, GitHub Releases | Pending |
| P41 | Remote execution targets | SSH Linux/Docker and Windows SSH with WSL/Docker | Pending |
| P42 | Flashing/installation routes | USB/SD/disk flashing and guided ISO/guest installation | Pending |
| P43 | Execution plan | Ordered work units with prerequisite and acceptance evidence | Structure implementation into phases and a checklist; check off items one by one |
| P44 | Immediate website scope | Planning website before desktop implementation | Create the public documentation website now; desktop implementation remains next session |
| P45 | Phone and component requirements | Responsive layout and genuine Material controls | Phone-friendly website and pure Material Design 3 controls, no generic control substitutes |

## Additional explicit interface requirement

The application must be interactive with rich controls and productive workflows. Textbox collections cannot substitute for trees, pickers, graphs, previews, visual editors, queues or lifecycle controls. Text and code editing are appropriate only where the underlying task needs them.

Canvas editors are required where appropriate. Proposed applicable surfaces are VM/network topology, disk/partition layouts, build pipelines, package dependencies, image/logo editing and appearance timelines. Each canvas requires keyboard-accessible alternatives, an inspector, validation, undo/redo and a preview of the changes it applies.

Recommendations are not approvals. Further questions will be recorded as the interview proceeds.
