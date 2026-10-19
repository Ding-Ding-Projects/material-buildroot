import { createIsoHostBuildAdapter } from "./iso-host-build-adapter.cjs";
export type DurableIsoHostOptions = Omit<Parameters<typeof createIsoHostBuildAdapter>[0], "retainReference" | "checkpointCurrentOwner" | "checkpointCurrentCleanup"> & { recoveryDirectory: string };
export function createDurableIsoHostBuildAdapter(options: DurableIsoHostOptions): ReturnType<typeof createIsoHostBuildAdapter>;
