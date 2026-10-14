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
| P08 | Guest content | Selectable minimal/desktop/server/appliance presets | Pending |
| P09 | Image formats | ISO, VMDK, VDI and OVA | Pending |
| P10 | VM lifecycle | Create/import/configure/launch controls | Pending |
| P11 | Firmware | Both UEFI and BIOS | Pending |
| P12 | Architecture | x86_64 first, broader Buildroot controls retained | Pending |
| P13 | WSL prerequisite ownership | Dedicated managed distro plus existing distro support | Pending |
| P14 | Buildroot versions | Current stable, maintained LTS and chosen Git refs | Pending |
| P15 | Configuration reconciliation | Staged edits, preview and Apply | Pending |
| P16 | Upgrade safety | Snapshot/preview migration or separate upgraded project | Pending |

Recommendations are not approvals. Further questions will be recorded as the interview proceeds.
