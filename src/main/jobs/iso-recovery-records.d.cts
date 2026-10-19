import type { OwnershipReceipt } from "../execution/index.cjs";
import type { IsoTransactionReadExpectation } from "./iso-transaction-readback.cjs";
export interface IsoRecoveryBinding {
  jobId: string; workspaceId: string; grantId: string; runtime: { kind: "wsl"; distribution: string }; journalKey: string;
  sourceSha256: string; configurationSha256: string; projectProofSha256: string;
  policy: IsoTransactionReadExpectation["policy"];
}
export interface IsoRecoveryReferenceState { state: "pending" | "receipt-recorded" | "verified"; receiptRecordSha256: string | null }
export interface IsoCurrentCleanup { receipt: OwnershipReceipt; verdict: { state: "verified-stopped" | "unknown"; reason: string } }
export function createIsoRecoveryRecords(options: { directory: string; journalDirectory: string }): Readonly<{
  begin(binding: IsoRecoveryBinding): string;
  checkpointOwner(binding: IsoRecoveryBinding, owner: OwnershipReceipt): string;
  checkpointCleanup(binding: IsoRecoveryBinding, owner: OwnershipReceipt, verdict: IsoCurrentCleanup["verdict"]): string;
  recordReference(binding: IsoRecoveryBinding, reference: { state: "receipt-recorded" | "verified"; receiptRecordSha256: string }): string;
  read(binding: IsoRecoveryBinding): { state: "complete" | "incomplete" | "unknown"; jobId: string | null; reference: IsoRecoveryReferenceState | null; owners: OwnershipReceipt[]; cleanups: IsoCurrentCleanup[]; grantsAuthority: false };
}>;
