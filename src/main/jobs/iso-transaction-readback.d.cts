export interface IsoTransactionReadExpectation {
  jobId: string; grantId: string;
  runtime: { kind: "wsl"; distribution: string };
  policy: { version: 1; profile: "x86_64-bios-grub2-initrd"; appliedConfigurationRevision: string; path: "images/rootfs.iso9660"; freshness: "required"; state: "intent-only" };
  binding: { sourceSha256: string; configurationSha256: string; projectProofSha256: string };
  /** Trusted external anchor, never derived from the same readback being verified. */
  receiptRecordSha256: string | null;
}
export type IsoTransactionReadResult =
  | { state: "complete"; jobId: string; receiptRecordSha256: string; reason: "anchored-records-consistent"; receipt: Readonly<Record<string, unknown>> }
  | { state: "incomplete" | "unknown"; jobId: string | null; receipt: null; reason: string };
export function readIsoTransaction(input: { directory: string; expected: IsoTransactionReadExpectation }): IsoTransactionReadResult;
