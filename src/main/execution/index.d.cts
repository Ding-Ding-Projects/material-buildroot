export type BuildTarget =
  | "all"
  | "sdk"
  | "clean"
  | `${string}-${"rebuild" | "reconfigure" | "dirclean" | "download"}`
  | "olddefconfig"
  | "savedefconfig"
  | "legal-info"
  | "source"
  | "show-info"
  | "graph-depends";
export type ExecutionRuntime =
  | { kind: "wsl"; distribution: string }
  | { kind: "docker"; image: string; uid: number; gid: number }
  | { kind: "linux-fixture" };
export type OwnershipReceipt =
  | { version: 1; kind: "docker"; ownerToken: string; containerName: string; daemonId: string }
  | { version: 1; kind: "wsl"; ownerToken: string; distribution: string; bootId: string; pidNamespace: string; pid: number | null; startTime: string | null };
export interface CleanupVerdict { state: "verified-stopped" | "unknown"; reason: string }
export function validateOwnershipReceipt(receipt: unknown): Readonly<OwnershipReceipt>;
export interface ExecutionResult {
  state:
    | "succeeded"
    | "failed"
    | "unavailable"
    | "timed-out"
    | "cancelled"
    | "output-limit"
    | "runtime-cleanup-failed";
  code: number | null;
  ownership?: OwnershipReceipt;
  cleanup?: CleanupVerdict;
  processState?: string;
  signal?: string | null;
  stdout: string;
  stderr: string;
}
export interface ExecutionEnvironment {
  hostArchitecture: string;
  hostGccVersion: string;
}
export interface ExecutionLog {
  stream: "stdout" | "stderr";
  text: string;
}
export interface ExecutionJob {
  ownership?: OwnershipReceipt | null;
  completion: Promise<ExecutionResult>;
  cancel(): Promise<ExecutionResult>;
}
export interface NativeDockerProjectReceipt {
  readonly id: string; readonly daemonId: string; readonly image: string;
  readonly uid: 1000; readonly gid: 1000; readonly profile: "buildroot-2025.02-x86_64-bios";
  readonly archiveSha256: string;
  readonly volumes: Readonly<Record<"source" | "output" | "cache", { readonly name: string; readonly key: string }>>;
  readonly seal: { readonly uid: 1000; readonly gid: 1000; readonly identities: Readonly<Record<string, readonly number[]>>;
    readonly source: { readonly sha256: string; readonly entries: number; readonly bytes: number }; readonly configurationSha256: string; readonly configurationBytes: number };
}
export class ExecutionService {
  constructor(options?: {
    platform?: string;
    executables?: { wsl?: string; docker?: string; make?: string };
    linuxFixture?: boolean;
  });
  grantProject(options: {
    root: string;
    source: string;
    output: string;
    trustedSource: true;
    externalTrees?: string[];
    trustedExternalTrees?: boolean;
  }): {
    grantId: string;
    root: string;
    source: string;
    output: string;
    externalTrees: string[];
  };
  revoke(grantId: string): void;
  prepareNativeDockerProject(input: { archivePath: string; profile: "buildroot-2025.02-x86_64-bios"; consent: true; onProgress?(event: { workspaceId: string; daemonId: string; phase: "volume-created"; volumes: Record<string, {name:string;key:string}> }): void | Promise<void> }): Promise<NativeDockerProjectReceipt>;
  grantNativeDockerProject(receipt: NativeDockerProjectReceipt): Promise<{ grantId: string; kind: "docker-native"; workspaceId: string; profile: string; runtime: ExecutionRuntime; sourceReceipt: { sha256: string; entries: number; bytes: number }; volumes: Record<string, string> }>;
  acquireNativeDockerCache(input: { grantId: string; consent: true; onLog?(event: ExecutionLog): void; onOwnership?(receipt: Readonly<OwnershipReceipt>): Promise<void> | void }): Promise<ExecutionJob>;
  inspectNativeDockerOutputs(input: { grantId: string }): Promise<{ workspace: unknown; files: Array<{ name: string; sha256: string; bytes: number }> }>;
  validateOwnershipReceipt(receipt: unknown): Readonly<OwnershipReceipt>;
  reconcileCleanup(receipt: unknown): Promise<CleanupVerdict>;
  prepareDocker(request: { grantId: string; runtime: ExecutionRuntime }): Promise<{ name: string; daemonId: string; uid: number; gid: number; state: "prepared"; permissions: "unverified"; retained: true }>;
  discover(): Promise<{
    docker: ExecutionResult & { available: boolean; reason: string; images: string[]; imageState: string };
    wsl: Partial<ExecutionResult> & { distributions: string[] };
  }>;
  probeResources(request: { grantId: string; runtime: ExecutionRuntime }): Promise<{ cpuSlots: number | null; memoryAvailableBytes: number | null; storageAvailableBytes: number | null; observedAt: string; constraintModel: "unknown" | "cgroup-v2-and-affinity" }>;
  probeEnvironment(request: {
    grantId: string;
    runtime: ExecutionRuntime;
  }): Promise<ExecutionEnvironment>;
  start(
    request: {
      grantId: string;
      target: BuildTarget;
      runtime: ExecutionRuntime;
      jobs?: number;
    },
    onLog?: (event: ExecutionLog) => void,
    options?: { onOwnership?(receipt: Readonly<OwnershipReceipt>): Promise<void> | void; signal?: AbortSignal },
  ): Promise<ExecutionJob>;
}
export const TARGETS: readonly BuildTarget[];


