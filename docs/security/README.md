# Security boundaries

- [Serialized operation requests](operation-requests.md)
- [Durable settings broker admission](broker-admission.md)
- [Scheduled-preference core and host service](scheduled-settings.md)
- [Local scheduled-preference draft recovery](schedule-draft-recovery.md)

The parser accepts data only. The broker adds a trusted-host settings transaction and strict reply/event translation. Local preferences use an owned-frame IPC bridge. These boundaries expose no HTTP endpoint, so a Postman collection is not applicable to this category.
