export type RemoteTargetKind = 'linux-process' | 'linux-docker' | 'windows-wsl' | 'windows-docker';
export type RemoteRuntimeRequest =
  | { action: 'list' | 'enroll' }
  | { action: 'reconnect'; targetId: string }
  | {action: 'transfer'; targetId: string; workspaceId: string}
  | { action: 'start'; targetId: string; transferId: string; target: 'all' | 'sdk' | 'legal-info' | 'source'; parallelism: number }
  | { action: 'observe' | 'cancel' | 'outputs' | 'logs'; id: string }
  | { action: 'download'; id: string; name: string; sha256: string };
export interface RemoteTarget { id: string; name: string; kind: RemoteTargetKind; host: string; port: number; authorized: boolean }
export interface RemoteJob { id: string; targetId: string; transferId: string; sourceDigest: string; target: string; parallelism: number; state: string }
export interface RemoteOutput { name: string; bytes: number; sha256: string }

