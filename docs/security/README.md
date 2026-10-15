# Security boundaries

- [Serialized operation requests](operation-requests.md)
- [Durable settings broker admission](broker-admission.md)

The parser accepts data only. The broker adds a trusted-host settings transaction and strict reply/event translation. No HTTP endpoint or production IPC bridge is installed yet, so a Postman collection is not applicable to this category at this checkpoint.
