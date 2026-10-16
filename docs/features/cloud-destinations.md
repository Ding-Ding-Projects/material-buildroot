# Private cloud destinations

[香港粵語](cloud-destinations.zh-HK.md)

PH07-T09 adds an output-inspector workflow for S3-compatible storage, Azure Blob Storage, Google Cloud Storage and existing GitHub Releases. The implementation is source-only at this checkpoint. Builds, tests, reviews, runtime transfers and visual verification have not run for this change.

## Workflow

1. Select an adopted workspace and one file in the output inspector. Directory uploads and automatic source collection are not supported.
2. Import a destination enrollment JSON through the native file picker. Review its exact scope in the native confirmation dialog. The host encrypts the credential using the existing vault, bound to the newly assigned destination ID. Renderer requests never carry a credential or a destination URL.
3. Select the destination and choose **Preview exact upload**. The preview includes the relative file, destination account/container, exact unique object name, byte length, SHA-256 and two-minute expiry. This stage performs no network request.
4. Consent to the exact file, destination, network transfer and possible provider charges. Confirm the same details in the native dialog. The host snapshots the admitted file, checks its identity and digest, and starts a durable job.
5. Refresh transfer history to observe progress, cancel an active job, or retry readback of an interrupted object. The panel refreshes active jobs every 2.5 seconds while connected.

Only private destinations are admitted. S3 must return all four public-access-block settings enabled. Compatible endpoints must implement that API and conditional object creation. Azure must report no public container access. GCS must return explicit `publicAccessPrevention: enforced`; inherited-but-unverifiable settings are not accepted. GitHub must report a private repository and an existing normal release with the exact selected tag. No repository, release, bucket, container, IAM policy or account is created or changed.

## Enrollment format

The selected local JSON contains exactly `version`, `profile` and `credential`. The file is limited to 32 KiB. A maximum of 32 profiles is retained. The input file is not deleted or modified; keep it in protected local storage and never place real credentials in a repository, chat, screenshot or log.

```json
{
  "version": 1,
  "profile": {
    "provider": "s3",
    "label": "Private build outputs",
    "endpoint": "https://s3.us-east-1.amazonaws.com",
    "bucket": "example-private-build-output",
    "region": "us-east-1",
    "prefix": "builds/"
  },
  "credential": {
    "accessKeyId": "EXAMPLEONLY",
    "secretAccessKey": "EXAMPLE-NOT-A-CREDENTIAL"
  }
}
```

All values in the example are placeholders. S3 accepts an optional `sessionToken`. Azure profiles contain `provider: "azure"`, `label`, `account`, `container` and `prefix`. GCS profiles contain `provider: "gcs"`, `label`, `bucket` and `prefix`. GitHub profiles contain `provider: "github"`, `label`, `repository` (`owner/name`) and `tag`. Azure, GCS and GitHub credentials use `accessToken`. Use a short-lived credential with only the selected destination's read/write and privacy-inspection rights. Expired credentials fail closed; enroll a replacement profile. Automatic refresh and IAM provisioning are not implemented.

Storage prefixes contain ASCII letters, numbers, underscores and hyphens with a final `/`, for example `builds/project/`. File names are limited to 120 ASCII letters, numbers, periods, hyphens and underscores. Files must be nonempty and no larger than 1 GiB. S3 endpoints must be HTTPS origins, without embedded credentials, query, path or nondefault port. An imported S3 endpoint is an explicit host trust choice: only import an enrollment from a trusted administrator. There is no renderer-selected endpoint or command route.

## Provider protocols and provenance

Adapters use fixed host-owned requests with redirect rejection. They introduce no third-party SDK dependency.

| Provider | Protocol and behavior | Official reference |
| --- | --- | --- |
| S3-compatible | S3 2006-03-01, Signature Version 4, `PutObject`, `If-None-Match: *`, SHA-256 request checksum, complete `GetObject` readback | [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html), [public access block](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetPublicAccessBlock.html) |
| Azure Blob | REST `2023-11-03`, bearer credential, block blob PUT with create-only condition, full GET readback | [Put Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob), [Get Container Properties](https://learn.microsoft.com/en-us/rest/api/storageservices/get-container-properties) |
| Google Cloud Storage | JSON API v1, media insert with `ifGenerationMatch=0`, full `alt=media` readback | [Objects insert](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/insert), [preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions) |
| GitHub Releases | Existing execution-setup pinned/admitted `gh` executable, `repo view`, `release view`, `release upload` without overwrite, `release download` | [Upload](https://cli.github.com/manual/gh_release_upload), [Download](https://cli.github.com/manual/gh_release_download) |

GitHub CLI executable admission and its SHA-256 are reused from execution setup. The cloud route injects only the destination's scoped credential into the child environment and discards standard error. It does not use a raw HTTP substitute or rely on an ambient account. Other provider exceptions and response bodies do not enter history. Network/provider failures are recorded as bounded codes.

## Integrity, cancellation and retry

Each preview uses an unguessable object name inside the selected prefix, or an unguessable release asset name. PUT admission is create-only, and the GitHub command never uses `--clobber`. The host copies the file into a retained local transfer folder while comparing the preview digest and file identity. Providers upload that snapshot, not a mutable renderer path.

A successful job requires complete provider bytes to match both expected length and SHA-256, plus private-scope readback after transfer. A successful PUT alone is not success. The existing durable job manager records queued, running, cancelling, cancelled, failed, interrupted and succeeded states; its checkpoint records admission, upload and readback stages without secrets.

Cancellation aborts the owned operation. The ten-minute bound includes admission, upload and readback. Cancellation or a connection loss cannot prove that a remote write did not finish, so any remote object and local snapshot are retained. Restarted in-flight jobs become interrupted, never successful. Retry requires native confirmation and reads only the exact retained object. It does not upload again. If the object is absent or incomplete, create a new preview with a new unique name. Existing objects are not overwritten or deleted. Removal hides the destination profile but preserves transfer history and encrypted recovery material.

## Cantonese walkthrough

喺輸出檢視器揀一個檔案，匯入私人目的地設定檔，再預覽確實檔案、位置、位元組同 SHA-256。主機確認對話框會再次列出上載範圍；同意之前唔會傳送檔案。憑證由主機加密保管，唔會進入畫面、紀錄或匯出資料。

只有供應商實際讀回嘅完整內容同長度、SHA-256 都相符，而且目的地仍然私人，先會記錄成功。取消、逾時或中斷會保留現有資料，唔會扮成功。重試只會讀回同一物件；缺少物件就重新預覽。呢次改動未執行構建、測試、審查、實際傳輸或畫面驗證。

## Remaining acceptance

- All four provider accounts, scoped credentials, denied access, privacy changes, conditional-write conflicts and actual readback remain unverified.
- Cancellation during each transfer stage, process restart, snapshot retention, retry and provider billing behavior remain unverified.
- Full language, keyboard, screen-reader and layout acceptance remains unverified.
- Public destinations, directory/source collection, multipart resume, credential refresh and automated deletion are deliberately excluded from this bounded workflow.
