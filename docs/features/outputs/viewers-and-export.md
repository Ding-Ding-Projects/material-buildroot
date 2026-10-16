# Output viewers and validated export

## Workflow

Open an adopted project's **Artifacts** destination, choose **Output root**, and navigate directory entries. The host issues opaque entry identities. The renderer cannot submit an absolute filesystem path to these new viewer operations. Entry identities expire after fifteen minutes and are invalidated by root refresh; refresh after a build changes output bytes.

Choose a file to view detected format, byte length, plain text, supported archive members, partition entries, simple dependency graph edges or CSV records. The host reads at most 1 MiB for ordinary preview. Text, XML, HTML, SVG, CSV cells and graph labels are displayed as text rather than executable markup or spreadsheet formulas. No source directive, link or script runs.

SHA-256 is an explicit action, with an optional expected digest. A match is a byte comparison only, not an authenticity or licensing determination. Hashing admits regular files up to 16 GiB and a two-minute streaming deadline. File identity and modification metadata are rechecked around reads.

## Supported viewers and limits

- Directory navigation: at most 1,000 examined entries per read, no symbolic links or special files, real-path containment and retained identity checks.
- TAR: checksummed fixed-size headers, at most 1,000 members. Link and extension records remain display-only; PAX/GNU extensions are not interpreted as extraction instructions.
- ZIP: bounded central directory, at most 1,000 members and 1 MiB of metadata. Multi-volume and ZIP64 layouts are unavailable. Compressed data is never inflated.
- ISO9660: primary-volume root-directory records only, at most 1 MiB and 1,000 entries. Nested directory traversal, Joliet and Rock Ridge interpretation are unavailable.
- Disk images: bounded MBR/GPT metadata with a read-only selectable partition map and equivalent table. No partition modification, mounting or filesystem repair occurs. Sector size is explicitly 512 bytes; other layouts are not inferred.
- ext-family: basic superblock fields only. It does not browse ext files or establish filesystem consistency.
- Graphs: a simple directed DOT edge subset, capped at 200 edges and 60 visible nodes. Selecting a node filters the edge table. This is not a complete Graphviz interpreter.
- CSV/license source: up to 201 records, 32 columns and 4,096 characters per cell, with no legal conclusion. Truncated previews do not establish collection completeness.

Compressed TAR streams, general filesystem browsing inside disk images, PDF graph rasterization, raster-image decoding and archive extraction are not implemented by this component. Unsupported data remains unavailable rather than being reported as inspected successfully.

## Export workflow

The output inspector summary and existing guest disk conversion controls offer raw, VMDK, VDI, QCOW2, ISO and OVA output choices. Navigate to a source file in the inspector, provide a new basename with the selected extension, preview, then confirm. The renderer sends only its host-issued file identity; the host resolves the source. Previews bind the source SHA-256 and expire after two minutes. No output is overwritten.

Disk parsing and conversion require an admitted native `qemu-img` through the host's executable resolver. A basename on PATH is not trusted admission. Missing native admission remains an operation error; this feature does not download or execute a converter silently.

Inputs are limited to 16 GiB and virtual capacity to 64 GiB. QCOW2 backing files, snapshots, encryption and unsupported incompatible features are rejected before parsing. Differencing VDI files are rejected. VMDK input requires an unchanged disk produced by this running host's conversion service, rather than accepting arbitrary external extent references.

Both preview and execution copy the admitted input into a private directory and recheck its digest before native parsing. External-reference admission is repeated on the snapshot. QEMU receives an explicit input format and bounded host-owned arguments, never renderer-provided CLI options. Generated disk metadata must match the selected format and expected virtual capacity. `qemu-img compare` must report equal logical contents before publication. The final copy is exclusive and its SHA-256 is read back. The original remains untouched.

ISO export is explicitly a byte-identical copy of an existing detected ISO9660 image. It does not author a bootable ISO from a root filesystem. OVA export converts to a stream-optimized VMDK and packages a fixed OVF descriptor, SHA-256 manifest and disk as USTAR. The descriptor declares one CPU, 1024 MiB RAM, SATA storage and no network adapter. Individual USTAR entries must fit the octal size limit. Appliance import and boot compatibility are not asserted.

## Verification state

This source was implemented under a mode that excludes tests, reviews, static analysis, runtime interaction, actual conversions and screenshots. A future production build receipt must name its exact source. No conversion, archive parsing, filesystem inspection, keyboard interaction, localization layout, importer compatibility or boot result has been established by this implementation task. Keep runtime acceptance open.
