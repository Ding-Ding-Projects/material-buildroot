# External tree image builds: verification record

This page records what was actually run for the [external tree image route](../../features/external-tree-images.md). Anything not listed here has not been verified.

## Host

- Windows 11 with Docker Desktop (engine 29.6.1, context `desktop-linux`, 32 CPUs and 31 GiB memory available to Docker).
- Source: the Home Assistant Material repository (HAOS 18.5 external tree, 14 board defconfigs).

## Defects found while bringing the route up

| Defect | Cause | Fix |
| --- | --- | --- |
| The first `ova` build stopped in Buildroot's kconfig with `syntax error near unexpected token $'\r'`. | Archiving `commit:operating-system` leaves the repository's root `.gitattributes` behind, so a host `core.autocrlf=true` converted every text file to CRLF. | The archive runs with `core.autocrlf=false` and `core.eol=lf`, exporting committed bytes unchanged. The builder image is built from the same archive. |

## Runs

Results are added as each run finishes.
