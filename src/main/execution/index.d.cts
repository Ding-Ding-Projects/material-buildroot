export type BuildTarget = 'all' | 'olddefconfig' | 'savedefconfig' | 'legal-info' | 'source' | 'show-info' | 'graph-depends';
export type ExecutionRuntime = { kind: 'wsl'; distribution: string } | { kind: 'docker'; image: string; uid: number; gid: number } | { kind: 'linux-fixture' };
export interface ExecutionResult { state: 'succeeded' | 'failed' | 'unavailable' | 'timed-out' | 'cancelled' | 'output-limit' | 'runtime-cleanup-failed'; code: number | null; signal?: string | null; stdout: string; stderr: string }
export interface ExecutionLog { stream: 'stdout' | 'stderr'; text: string }
export interface ExecutionJob { completion: Promise<ExecutionResult>; cancel(): Promise<ExecutionResult> }
export class ExecutionService {
  constructor(options?: { platform?: string; executables?: { wsl?: string; docker?: string; make?: string }; linuxFixture?: boolean });
  grantProject(options: { root: string; source: string; output: string; trustedSource: true }): { grantId: string; root: string; source: string; output: string };
  revoke(grantId: string): void;
  discover(): Promise<{ docker: ExecutionResult & { available: boolean }; wsl: Partial<ExecutionResult> & { distributions: string[] } }>;
  start(request: { grantId: string; target: BuildTarget; runtime: ExecutionRuntime; jobs?: number }, onLog?: (event: ExecutionLog) => void): Promise<ExecutionJob>;
}
export const TARGETS: readonly BuildTarget[];
