## Remote runtime changes

- Added strict SSH host enrollment for Linux process/container and Windows WSL/container target shapes.
- Added source/configuration-bound project transfer and chunked output downloads with exclusive destinations and retained partials.
- Connected remote reservations to existing global scheduler budgets; uncertain jobs retain reservations until exact terminal observation.
- Added sequence-bound bounded remote log pages, explicit recovery and owned cancellation requests.
- Runtime and delivery acceptance remain pending; WSL-owned and external-tree source transfer are explicitly unsupported.
