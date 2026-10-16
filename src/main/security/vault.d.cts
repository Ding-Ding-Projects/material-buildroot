import type { HostVault } from '../../shared/vault';
interface ProtectedStorage {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
  getSelectedStorageBackend?(): string;
}
export function createVault(options: { safeStorage: ProtectedStorage; directory: string }): HostVault;
