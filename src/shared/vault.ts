/** Host-only contracts. Secret-bearing methods must never be exported by preload. */
export type VaultReference = `vault:${string}`;
export type VaultPermission = 'read' | 'write' | 'remove';
export interface VaultAvailability { available: boolean; reason?: string }
export interface VaultOperationRecord {
  readonly sequence: number;
  readonly operation: VaultPermission;
  readonly outcome: 'succeeded' | 'rejected';
}
export interface ScopedHostVault {
  availability(): VaultAvailability;
  read(reference: VaultReference): string;
  write(secret: string): VaultReference;
  remove(reference: VaultReference): boolean;
  revoke(): void;
  records(): readonly VaultOperationRecord[];
}
export interface HostVault {
  availability(): VaultAvailability;
  write(owner: string, secret: string): VaultReference;
  read(reference: VaultReference, owner: string): string;
  remove(reference: VaultReference, owner: string): boolean;
  /** Host code chooses the owner and permissions after its own review. */
  forOwner(owner: string, permissions: readonly VaultPermission[]): ScopedHostVault;
}
