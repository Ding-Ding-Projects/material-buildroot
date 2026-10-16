import type { DeploymentService, Guest, Hardware, NetworkAdapter, StorageAttachment } from '../main/deployment/index.cjs';

export type GuestProvider = Guest['provider'];
export type GuestHardware = Required<Hardware>;
export interface ProviderAvailability {
  available: boolean;
  nativeAcceptance: string;
  capabilities?: { diskFormats: string[]; networkModes: string[]; selectableInterfaces: boolean };
}
export type ProviderDiscovery = Record<GuestProvider, ProviderAvailability>;
interface GuestOperations {
  'guest.discover': { request: undefined; result: ProviderDiscovery };
  'guest.list': { request: undefined; result: Guest[] };
  'guest.networks': { request: undefined; result: Awaited<ReturnType<DeploymentService['discoverNetworks']>> };
  'guest.create': { request: Parameters<DeploymentService['createGuest']>[0]; result: Guest };
  'guest.import': { request: Parameters<DeploymentService['importGuest']>[0]; result: Guest };
  'guest.preview': { request: Parameters<DeploymentService['previewGuestEdit']>[0]; result: Awaited<ReturnType<DeploymentService['previewGuestEdit']>> };
  'guest.edit': { request: Parameters<DeploymentService['editGuest']>[0]; result: Guest };
  'guest.launch': { request: Parameters<DeploymentService['launchGuest']>[0]; result: Awaited<ReturnType<DeploymentService['launchGuest']>> };
  'guest.stop': { request: Parameters<DeploymentService['stopGuest']>[0]; result: Awaited<ReturnType<DeploymentService['stopGuest']>> };
  'guest.refresh': { request: Parameters<DeploymentService['refreshGuest']>[0]; result: Awaited<ReturnType<DeploymentService['refreshGuest']>> };
  'guest.disk.create': { request: Parameters<DeploymentService['createDiskArtifact']>[0]; result: Awaited<ReturnType<DeploymentService['createDiskArtifact']>> };
  'artifacts.list': { request: undefined; result: Awaited<ReturnType<DeploymentService['listArtifacts']>> };
}
/** Compile-time workflow contract; the main process remains the validation authority. */
export async function guestOperation<K extends keyof GuestOperations>(workspaceId: string, action: K, request?: GuestOperations[K]['request']): Promise<GuestOperations[K]['result']> {
  if (!window.studio?.operations) throw new Error('DESKTOP_REQUIRED');
  const reply = await window.studio.operations({ action, workspaceId, ...(request ? { request } : {}) });
  if (!reply.ok) throw new Error(reply.code);
  return reply.result as GuestOperations[K]['result'];
}
export function validGuestTopology(hardware: GuestHardware, provider: GuestProvider, networks: NetworkAdapter[], storage: StorageAttachment[]): boolean {
  return Number.isInteger(hardware.memoryMiB) && hardware.memoryMiB >= 128 && hardware.memoryMiB <= 65536 &&
    Number.isInteger(hardware.cpus) && hardware.cpus >= 1 && hardware.cpus <= 32 &&
    networks.every(n => provider !== 'virtualbox' || !['bridged', 'hostonly'].includes(n.mode) || !!n.interface) &&
    storage.every(s => !!s.artifact);
}
