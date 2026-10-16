# Managed hypervisor controls

The guest workspace supports VirtualBox and VMware through the existing main-process operation service. The topology toolbar discovers providers and lists only application-managed records. Discovery reports command availability, not guest boot acceptance.

## Executable admission

Before discovery or guest operations, open Tools, refresh the executable list and select the installed `VBoxManage.exe`, `vmrun.exe` or `qemu-img.exe` through its native picker. The native trust dialog displays the exact resolved path and SHA-256 and defaults to Cancel. Only explicit approval executes the fixed probe and persists a local identity receipt. The renderer supplies a tool ID, never a command, executable path or argument list.

Every deployment invocation resolves that receipt again and checks the absolute path and current SHA-256 before calling the fixed argument consumer. Missing admission or a replaced executable stops the operation; there is no bare-name or PATH fallback. Select and approve an updated installation again when its bytes change. The receipt is a user trust decision, not a vendor signature or publisher certification. VMware uses a read-only running-state availability probe and records version as unverified. Discovery returns no guest paths from that probe. QEMU admission is required for disk inspection, creation and conversion as applicable.

## Create or import

Start with the new guest draft. New drafts reset to NAT, BIOS, 2048 MiB and two CPUs, with no attached media. Add up to four adapters and four storage attachments. VirtualBox bridged and host-only adapters require a discovered interface. VMware uses its provider-managed interface selection. The create action remains unavailable for invalid numeric settings, empty media selections, missing required interfaces or a provider observed unavailable.

Use Guest records and disk conversion to import a validated output disk as a new managed guest. Appliance archives are not admitted. VMware VMDK input must pass the existing owned conversion route. The backend copies admitted source media into its managed directory; source and shared output disks are not modified. Detaching media retains the managed copy.

## Configure and operate

Select a stopped guest, edit topology, preview the exact changes and approve the preview before applying. Preview revision, expiry and main-process validation remain authoritative. Hardware-only editing in Guest records retains all adapters and media; network changes belong to the topology editor.

The topology toolbar can refresh provider state, request launch of a stopped guest, or request graceful shutdown of a running guest. Launch and shutdown include the selected record revision. A shutdown request is not proof of shutdown; refresh observes its resulting state. A running provider process is not proof of guest boot. Unknown and partial-provisioning states remain explicit and do not enable launch.

Changing projects clears the previous guest, topology, provider discovery and media list. Selecting a new draft clears the selected guest's topology. Refreshing records resynchronizes the selected record and invalidates a previous preview. Provider selection clears interface names from the previous provider. These actions do not execute host virtualization commands until the corresponding explicit action is selected.

## Delivery evidence

This change connects source workflows only. Tests, static analysis, reviews, captures and native create, import, configure, launch and stop acceptance were intentionally not run in the scoped delivery mode. The primary coordinator records the production build result separately. Native runtime acceptance and preservation evidence remain pending.
