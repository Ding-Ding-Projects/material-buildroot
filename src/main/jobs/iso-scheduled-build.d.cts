import type { DurableIsoHostOptions } from "./iso-durable-host-adapter.cjs";
import type { IsoHostBuildPayload, IsoHostBuildContext } from "./iso-host-build-adapter.cjs";
export interface IsoScheduledContext extends IsoHostBuildContext { item(value: unknown): void }
export function createIsoScheduledBuild(options: {
  hostOptions: DurableIsoHostOptions;
  quarantine: { begin(record: { jobId: string; workspaceId: string }): void; clear(jobId: string): void };
  activeRecovery: Set<string>; markRecoveryUnavailable(): void;
}): (payload: IsoHostBuildPayload, context: IsoScheduledContext) => Promise<unknown>;
export function createBuildJobRouter(options: { ordinary(payload: unknown, context: unknown): Promise<unknown>; iso(payload: unknown, context: unknown): Promise<unknown> }): (payload: unknown, context: unknown) => Promise<unknown>;
