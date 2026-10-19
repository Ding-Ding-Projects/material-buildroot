import type { ExecutionService } from "../execution/index.cjs";
import type { IsoTransactionReadExpectation } from "./iso-transaction-readback.cjs";
export interface IsoSubmissionDescriptor { version: 1; id: string; captureRecordSha256: string }
export function assertDescriptor(value: unknown): IsoSubmissionDescriptor;
export function captureIsoSubmission(options: {
  directory: string; execution: ExecutionService; item: { grantId: string; source: string; output: string; externalTrees: string[]; storage?: unknown; runtime: { kind: "wsl"; distribution: string } };
  workspaceId: string; runtime: { kind: "wsl"; distribution: string }; policy: IsoTransactionReadExpectation["policy"];
  resolveProject(workspaceId: string): unknown; signal?: AbortSignal; onReserved(): void;
}): Promise<{ captured: { sourceRevision: string; configRevision: string; snapshot: Record<string, unknown> }; descriptor: IsoSubmissionDescriptor; commitJob(job: { id: string; payload: Record<string, any> }): void }>;
export function inspectIsoSubmissions(options: { directory: string; jobs: { list(owner: string): Array<{ id: string; kind: string; payload: Record<string, any> }> }; owner: string }): { state: "verified" | "unknown"; grantsRestored: false };
