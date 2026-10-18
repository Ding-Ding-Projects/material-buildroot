# Docker compiler diagnostic evidence, 2026-10-18

The final permitted offline firmware attempt stopped with exit `2` while building the initial GCC 13.3.0 cross compiler. Two host C++ compilation commands reported internal compiler errors with segmentation faults. A later isolated compilation of the first failing object reproduced that diagnostic class. Firmware production remains incomplete.

The bounded machine-readable record is [evidence.json](evidence.json). It contains source and content bindings, compiler and generated-input hashes, numeric results, isolation settings and explicit limits. Original logs, compiler inputs and retained temporary outputs remain private and are not included here.

## Host compiler and cross compiler

The host compiler was **g++ (Debian 12.2.0-14) 12.2.0**. GCC **13.3.0** was the cross compiler being built, not the host compiler version.

The final firmware attempt reported:

| Object | Generated input location | Diagnostic |
| --- | --- | --- |
| `generic-match.o` | `generic-match.cc`, line 16611, column 175 | Internal compiler error: segmentation fault |
| `gimple-match.o` | `gimple-match.cc`, line 210565, column 1 | Internal compiler error: segmentation fault during the `ccp` GIMPLE pass |

The failure propagated from the object compilation rules through `all-gcc` to the initial cross-compiler package build. These were host compiler operations, before successful target firmware production.

## Fixed metadata inspection

One offline, non-root metadata container checked the pinned builder image and verified the existing source, configuration, cache and application-owned volume bindings. It recorded the host compiler version, resolved g++ driver executable hash and hashes of the two generated inputs. It did not compile either input. The container completed successfully and its absence was verified.

| Item | Bytes | SHA-256 |
| --- | ---: | --- |
| Resolved g++ driver executable | 1,305,592 | `7f286ca4017ae9052c4233eb4cc129373222a4356088d21e0feed12fc583f3a0` |
| `generic-match.cc` | 3,191,126 | `4ddaa2778d57f3bb19844595ab1dcf542f6f9a678621421afd34d3ceb1fe3471` |
| `gimple-match.cc` | 6,591,426 | `b528ace69d09e2ea0777094dac48fffd10326a20aa0ac33707d0632ee48f59c3` |

## One isolated object compilation

The accepted diagnostic compiled only `generic-match.cc`. It retained the recorded compiler, `-O2`, defines, include options, source input and working directory. Only the object and dependency-output destinations moved to fresh temporary storage, and `-save-temps=obj` was added to retain the actual preprocessed translation unit.

The compiler returned **exit `1` after 7.477 seconds**, again reporting an internal compiler error and segmentation fault. The diagnostic wrapper completed with exit `0`, and exact owned-container absence was verified. No object file was produced. The isolated diagnostic retained classifications and a hash of its 785-byte stderr, not a new independently readable raw diagnostic trace. No exact source location is claimed for this isolated fault; the locations above come from the original firmware log.

The resolved g++ driver hash and generated-input hash matched the metadata inspection. The driver hash does not independently verify `cc1plus` or every compiler dependency; the pinned builder image supplies a separate image binding. Source, configuration and download-cache verification matched before and after. The run retained:

- `generic-match.ii`: **6,330,801 bytes**, SHA-256 `aeddc475f03dde9765f987e74ed96f5a97cb4fe824c6dd74c94c0d59f73d6e78`.
- Generated assembly and dependency records, with byte counts and hashes in the JSON record.
- A private archive totaling **7,720,960 bytes**, SHA-256 `5ee5be4117ea2ff946525e58894e13fb8c65ebf3f5be3df0a1f96ab337a348c3`.

Every retained file was independently read back and verified without displaying its contents. The archive remains private and ignored by version control.

## Isolation and interpretation

The diagnostic used the same **4 GiB memory limit**, **2 CPU quota** and **512-process limit** as the firmware attempt. It ran one isolated compiler command, whereas the firmware attempt allowed two concurrent jobs. The compiler timeout was 180 seconds. Recorded peak child RSS was 410,764 KiB; no killed-signal or no-space diagnostic class was observed.

The container ran as a non-root user with networking disabled, a read-only root, read-only producer volumes, all capabilities dropped and no new privileges. Source, output and cache data were preserved. Temporary compiler output remained below the 512 MiB retention bound.

This reproduces the compiler fault class under those stated conditions. It does not establish a hardware cause, a particular upstream defect, or the absence of every possible resource-related contribution. No fourth firmware attempt, full ISO success or public compiler report is claimed.

[GCC's reporting guidance](https://gcc.gnu.org/bugs/) requests the exact compiler version, complete command and preprocessed translation unit for a reproducible report. That guidance explains the evidence collected here; it is not a diagnosis or proof that this failure matches a known defect. Publication of the private compiler inputs would require a separate review and authorization.
