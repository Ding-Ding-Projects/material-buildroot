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
| P17 | Kernel/BusyBox/U-Boot editors | Full supported configuration editors | Pending |
| P18 | Project storage | Linux-side sources/output, Windows browse/export | Pending |
| P19 | Rebuild policy | Explain required clean rebuild and confirm | Pending |
| P20 | Default release channel | Maintained LTS | Pending |
| P21 | Windows application architecture | x64 and ARM64 | Pending |
| P22 | Output previews | Safe text/graphs/archives/read-only filesystems | Pending |
| P23 | Offline bundle delivery | Complete installer or complete capability packs | Pending |
| P24 | Fresh language/theme | Bilingual and system theme | Pending |
| P25 | Native acceptance host | Exact Windows/VMware/VirtualBox versions and accessible host | Pending |

Recommendations are not approvals. Further questions will be recorded as the interview proceeds.
