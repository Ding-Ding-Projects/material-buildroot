export type SharedModeCredentialKind = "pin" | "password" | "passkey";
export interface SharedModeSnapshot {
  readonly available: boolean;
  readonly watching: boolean;
  readonly configured: boolean | null;
  readonly active: boolean | null;
  readonly displayName: string | null;
  readonly revision: string | null;
  readonly credentialKind: SharedModeCredentialKind | null;
}
export interface SharedModeVault {
  read(reference: string, owner: string): string | Promise<string>;
  write(owner: string, value: string): string | Promise<string>;
}
export interface SharedModeProof {
  secret?: string;
  assertion?: unknown;
}
export interface SharedModeService {
  start(): Promise<SharedModeSnapshot>;
  status(): SharedModeSnapshot;
  subscribe(listener: (snapshot: SharedModeSnapshot) => void): () => void;
  reload(): Promise<SharedModeSnapshot>;
  initialize(options?: { displayName?: string }): Promise<SharedModeSnapshot>;
  enrollCredential(options: {
    expectedRevision: string;
    kind: SharedModeCredentialKind;
    secret?: string;
    confirmation?: string;
    current?: SharedModeProof;
    registration?: unknown;
  }): Promise<SharedModeSnapshot>;
  enter(options: { expectedRevision: string }): Promise<SharedModeSnapshot>;
  leave(
    options: { expectedRevision: string } & SharedModeProof,
  ): Promise<SharedModeSnapshot>;
  rename(options: {
    expectedRevision: string;
    displayName: string;
  }): Promise<SharedModeSnapshot>;
  recovery(): Readonly<{
    directory: string;
    record: string;
    disclosure: string;
  }>;
  close(): void;
}
export class SharedModeError extends Error {
  readonly code: string;
  constructor(code: string);
}
export function createSharedModeService(options: {
  sharedDirectory: string;
  vault: SharedModeVault;
  passkey?: {
    enroll(registration: unknown): unknown | Promise<unknown>;
    verify(
      registration: unknown,
      assertion: unknown,
    ): boolean | Promise<boolean>;
  };
  watchFactory?: (
    directory: string,
    options: { persistent: boolean },
    listener: () => void,
  ) => {
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    close(): void;
  };
  watchRetries?: number;
  retryDelayMs?: number;
}): Readonly<SharedModeService>;
