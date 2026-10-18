# ISO output and validation

## Purpose and recommended default

Buildroot generates `images/rootfs.iso9660` beneath the adopted output root. This filename and location are selected by the host profile; users do not need to research an extension. Use a separate output directory at project adoption when preserving a previous generated image is required.

## Example and overwrite constraints

The relative output `images/rootfs.iso9660` is valid. Absolute paths and arbitrary filenames are not accepted by this guided inspector. Normal incremental Buildroot production may update its own generated output. The workflow does not delete unrelated files. Existing ISO export copies an ISO to a new basename and rejects an already-existing destination; it is not raw-disk-to-ISO authoring.

## Validation and recovery

Inspection reports bytes, SHA-256, descriptor bounds and BIOS El Torito catalog structure. A pre-existing file may be from an earlier job. Bind the hash to the intended build evidence before distributing it. Metadata and build success are separate from actual boot acceptance. Missing output requires reviewing the job and configuration. Invalid bounds or catalog checks require rebuilding after correcting the cause, never renaming a raw disk to an ISO.
