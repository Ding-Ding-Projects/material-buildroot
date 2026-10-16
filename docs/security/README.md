# Security boundaries

- [Serialized operation requests](operation-requests.md)
- [Durable settings broker admission](broker-admission.md)
- [Scheduled-preference core and host service](scheduled-settings.md)
- [Local scheduled-preference draft recovery](schedule-draft-recovery.md)
- [Workspace state and persistence](workspace-state.md)
- [Jobs and recovery](jobs-and-recovery.md)
- [Shared-mode restrictions](shared-mode.md)
- [Personal wording import and privacy](personal-vocabulary.md)
- [Offline documentation admission](offline-documentation.md)
- [Opt-in HTTPS companion](companion.md)

The parser accepts data only. The broker adds a trusted-host settings transaction and strict reply/event translation. Local preferences use an owned-frame IPC bridge. Those IPC-only boundaries do not require a Postman collection.

The opt-in companion separately exposes authenticated HTTPS endpoints for pairing, session discovery, scoped actions and disconnection. Its complete protocol and privacy limits are documented in the companion article. A category-level and master Postman collection are still missing; their absence remains an acceptance gap rather than an exemption for the whole category. Do not enter production pairing credentials or session values into shared collections.
