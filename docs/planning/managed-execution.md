# Managed execution and delivery admission

Status: contract implementation underway; execution adapters and runtime acceptance pending. User builds and product delivery are independent workflows. A workflow catalogue, generated YAML or a successful job submission cannot establish a build, installed product or release.

## Selected destinations

P40 includes S3-compatible object storage, Azure Blob Storage, Google Cloud Storage and GitHub Releases. Each adapter needs scoped vault references, explicit destination preview, checksums, cancellation/retry and actual provider readback. No account, bucket, container, region or paid tier is selected by this contract.

P41 includes Linux SSH processes, Linux SSH Docker containers, and Windows SSH targets running WSL or Docker. Host identity, capabilities, permissions, non-root Linux execution, paths and process/container ownership must be checked separately. Disconnection is not proof of job termination.

P42 includes USB, SD and physical-drive flashing plus guided ISO and guest installation. Preview the exact destination identity and affected data, obtain destructive confirmation, preserve unrelated media and retain cancellation/recovery evidence. This contract performs no device write.

## User-managed builds

PH05-T11-C01 through C05 cover guided setup, generated workflows, reviewed expert YAML, standard hosted and self-hosted Linux runners, source or dedicated execution repositories, durable jobs and verified output retrieval. Beginner and expert editing must use the same validated backend model. Never execute renderer-provided commands or accept workflow YAML as authority to access secrets or hosts. Show runner compatibility and capacity truthfully. Standard public hosted execution remains a fallback; larger billed runners require explicit user choice.

## Product delivery

PH10-T09-C01 through C03 independently admit delivery configuration, Windows package production and normal-release publication. Product build and packaging jobs select compatible hosted or self-hosted Windows runners and invoke exact root `build.bat` and `build-installer.bat` entrypoints respectively. Linux jobs may coordinate preparation and delivery but do not substitute for these Windows jobs or prove native installation or guest acceptance. Publication stays separate from build entrypoints. Require exact source, immutable unique tag, expected assets, normal-release classification and readback. Existing PH10 acceptance remains in force.

## Conditional encrypted transport

Only a user-selected push to a verified private repository enables the encrypted route. Public source uses the standard public hosted path. The approved public extraction contains only reviewed generic engine code. Private history, identities, operational records, credentials and private source remain excluded. Before implementation, define threat model, key lifecycle, encryption/authentication, destination verification, cleanup, recovery and output provenance; validate those contracts independently. This document grants no blanket publication of private material.

## Backend handoff

Admit a typed execution target discriminated union for local WSL, local Docker, Linux SSH process/container, Windows SSH WSL/Docker and managed Actions. Common job operations are preview, validate, submit, observe, cancel, reconnect and collect, with durable operation IDs, capability-scoped credential references and content hashes. Provider adapters own storage destination validation and readback. Device adapters own destination identity and destructive confirmation. Do not reuse a renderer string as a shell command or host capability. The initial `external` scalar still requires migration to an ordered external-tree array in its own implementation unit.
