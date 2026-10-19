import { createIsoHostBuildAdapter } from "./iso-host-build-adapter.cjs";
import type { IsoRecoveryBinding } from "./iso-recovery-records.cjs";
export type DurableIsoHostOptions = Omit<Parameters<typeof createIsoHostBuildAdapter>[0], "retainReference" | "checkpointCurrentOwner" | "checkpointCurrentCleanup"> & { recoveryDirectory: string; onRecoveryBinding?(binding: Readonly<IsoRecoveryBinding>): Promise<void> };
export function createDurableIsoHostBuildAdapter(options: DurableIsoHostOptions): ReturnType<typeof createIsoHostBuildAdapter>;
