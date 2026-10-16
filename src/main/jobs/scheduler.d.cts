export interface BuildIntent { projectId: string; sourceRevision: string; configRevision: string }
export interface BuildAdmission {
  projectId: string; source: string; output: string; externalTrees?: string[];
  resourceDomain: string; storageDomain: string; cpuSlots: number; memoryBytes: number; storageBytes: number;
  intent: { sourceRevision: string; configRevision: string };
}
export interface ResourceObservation {
  resourceDomain: string; storageDomain: string; cpuSlots: number | null;
  memoryAvailableBytes: number | null; storageAvailableBytes: number | null;
}
export interface SchedulerJob { id: string; sequence: number; state: string; payload: { intent: BuildIntent; [key: string]: unknown } }
export interface SchedulerJobs {
  list(owner: string): SchedulerJob[];
  get(id: string, owner: string): SchedulerJob;
  run(id: string, owner: string, sequence: number): Promise<unknown>;
}
export function createBuildScheduler(options: {
  jobs: SchedulerJobs; ownerId: string;
  resolveAdmission(job: SchedulerJob): Promise<BuildAdmission>;
  observeResources(admission: BuildAdmission): Promise<ResourceObservation>;
  limits: { maxConcurrent: number; cpuSlots: number; memoryBytes: number; storageBytes: number };
  acquireLease?(admission: BuildAdmission): Promise<() => void>;
  maxScan?: number; callbackTimeoutMs?: number;
}): {
  reserveExternal(input: { id: string; admission: BuildAdmission; observed: ResourceObservation }): { id: string; budgetRevision: number; state: string };
  restoreExternal(input: { id: string; admission: BuildAdmission }): void;
  releaseExternal(id: string, terminalState: 'succeeded' | 'failed' | 'cancelled'): {id: string; state: string};
  externalStatus(): {id: string; state: string; budgetRevision: number; resourceDomain: string; cpuSlots: number; memoryBytes: number; storageBytes: number}[];
  pump(): Promise<void>;
  setLimits(limits: { maxConcurrent: number; cpuSlots: number; memoryBytes: number; storageBytes: number }): void;
  acquireMutationLease(paths: { projectId: string; source: string; output: string; externalTrees?: string[] }): () => void;
  status(): {
    closed: boolean;
    running: { jobId: string; projectId: string; cpuSlots: number; memoryBytes: number; storageBytes: number }[];
    blocked: { jobId: string; reason: string }[];
    reservations: { cpuSlots: number; memoryBytes: number; storageBytes: number };
  };
  awaitIdle(): Promise<void>;
  close(): void;
};

