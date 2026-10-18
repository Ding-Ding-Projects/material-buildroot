# Real ISO production and export

The non-root application execution service completed a full Buildroot 2025.02 BIOS GRUB2 ISO build with exit zero and verified stopped-session cleanup. The [production receipt](production.json) records exact source, configuration and output hashes without local host paths. The ISO is 12,357,632 bytes, SHA-256 `1d75d40b94e3c441aaaead9109f8074f62334931e1d84a576f3d7a36ec566dba`. Product conversion preview and execution exported byte-identical ISO content.

[Independent boot acceptance](../iso-boot/README.md) reached Linux, a usable console, temporary file read/write, DHCP and internal gateway replies, followed by graceful guest shutdown. This accepts the documented QEMU 10.0.13/Cirrus/RTL8139 profile only. Other consumer failures remain recorded. No universal hardware, UEFI, persistence, Internet or native desktop acceptance follows from it.
