import type { ExecutionService, ExecutionLog, OwnershipReceipt } from "../execution/index.cjs";
import type { IsoTransactionReadExpectation, IsoTransactionReadResult } from "./iso-transaction-readback.cjs";
export interface IsoHostBuildPayload {
  workspaceId: string; target: "all"; runtime: { kind: "wsl"; distribution: string }; jobs: number;
  intent: { projectId: string; sourceRevision: string; configRevision: string };
  isoOutputPolicy: IsoTransactionReadExpectation["policy"];
}
export interface IsoHostBuildContext { jobId: string; signal?: AbortSignal; log(event: ExecutionLog): void }
export interface IsoRecoveryReference {
  version: 1; jobId: string; workspaceId: string; journalKey: string;
  receiptRecordSha256: string | null; state: "pending" | "receipt-recorded" | "verified";
}
export function createIsoHostBuildAdapter(options: {
  execution: ExecutionService; directory: string; resolveProject(workspaceId: string): unknown;
  authorize(payload: IsoHostBuildPayload, context: IsoHostBuildContext): Promise<void>;
  retainReference(reference: IsoRecoveryReference): Promise<void>;
  checkpointCurrentOwner(record: { version: 1; jobId: string; workspaceId: string; phase: "current-input"; receipt: OwnershipReceipt }): Promise<void>;
  checkpointCurrentCleanup(record: { version: 1; jobId: string; workspaceId: string; phase: "current-input"; receipt: OwnershipReceipt; verdict: { state: "verified-stopped" | "unknown"; reason: string } }): Promise<void>;
  run: (...args: unknown[]) => unknown; checkpoint: (...args: unknown[]) => unknown; signalScript: string;
}): (payload: IsoHostBuildPayload, context: IsoHostBuildContext) => Promise<{ state: "succeeded"; code: 0; iso: IsoTransactionReadResult & { bootVerified: false } }>;
