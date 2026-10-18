export interface Artifact {
  path: string;
  size: number;
  sha256: string;
  format: string;
  partitions: Array<Record<string, unknown>>;
  preview: string | null;
  previewTruncated: boolean;
  iso: null | {
    descriptorValid: boolean; volumeSectors: number; logicalBlockBytes: number;
    declaredBytes: number; withinImage: boolean; bootVerified: false;
    elTorito: { present: boolean; catalogLba: number | null; validationChecksumValid: boolean;
      bootEntryValid: boolean; platformId: number | null; bootImageLba: number | null };
  };
}
export interface Manifest {
  schemaVersion: 1;
  algorithm: "sha256";
  locks: Record<string, string>;
  entries: Array<{ path: string; size: number; sha256: string }>;
  digest: string;
}
export interface Hardware {
  memoryMiB?: number;
  cpus?: number;
  firmware?: "bios" | "efi";
  network?: "nat" | "none" | "hostonly" | "bridged";
}
export interface NetworkAdapter {
  slot: 1 | 2 | 3 | 4;
  mode: "nat" | "none" | "bridged" | "hostonly";
  interface?: string;
}
export interface StorageAttachment {
  slot: 0 | 1 | 2 | 3;
  kind: "disk" | "iso";
  artifact: string;
}
export interface ManagedMedia extends StorageAttachment {
  sha256: string;
  size: number;
  fileName: string;
}
export interface Guest {
  id: string;
  provider: "virtualbox" | "vmware";
  hardware: Hardware;
  networks: NetworkAdapter[];
  storage: ManagedMedia[];
  revision: number;
  state: string;
}
export interface GuestEdit {
  id: string;
  expectedRevision?: number;
  hardware?: Hardware;
  networks?: NetworkAdapter[];
  storage?: StorageAttachment[];
}
export interface GuestEditPreview {
  previewId: string;
  id: string;
  revision: number;
  hardware: Hardware;
  networks: NetworkAdapter[];
  storage: ManagedMedia[];
  expiresAt: number;
  warning: string;
}
export interface DeploymentService {
  listArtifacts(
    directory?: string,
  ): Promise<Array<{ path: string; kind: string; size: number }>>;
  inspectArtifact(path: string): Promise<Artifact>;
  createManifest(input: {
    paths: string[];
    locks?: Record<string, string>;
  }): Promise<Manifest>;
  compareManifests(
    before: Manifest,
    after: Manifest,
  ): {
    reproducible: boolean;
    differences: unknown[];
    locksChanged: boolean;
    interpretation: string;
  };
  collectCompliance(directory?: string): Promise<Record<string, unknown>>;
  discoverHypervisors(): Promise<Record<string, unknown>>;
  listGuests(): Guest[];
  createDiskArtifact(input: {
    outputName: string;
    format: "vdi" | "vmdk";
    capacityMiB: number;
  }): Promise<{
    artifact: string;
    format: string;
    capacityMiB: number;
    sha256: string;
    state: "created";
    overwritten: false;
  }>;
  discoverNetworks(): Promise<{ bridged: string[]; hostonly: string[] }>;
  previewGuestEdit(input: GuestEdit): Promise<GuestEditPreview>;
  createGuest(input: {
    provider: "virtualbox" | "vmware";
    hardware?: Hardware;
    disk?: string;
    networks?: NetworkAdapter[];
    storage?: StorageAttachment[];
  }): Promise<Guest>;
  importGuest(input: {
    provider: "virtualbox" | "vmware";
    artifact: string;
    hardware?: Hardware;
  }): Promise<Guest>;
  editGuest(input: GuestEdit & { previewId?: string }): Promise<Guest>;
  launchGuest(input: {
    id: string;
    expectedRevision?: number;
  }): Promise<{
    id: string;
    state: string;
    revision: number;
    bootVerified: false;
  }>;
  stopGuest(input: {
    id: string;
    expectedRevision?: number;
  }): Promise<{
    id: string;
    state: string;
    revision: number;
    shutdownVerified: false;
  }>;
  refreshGuest(input: {
    id: string;
  }): Promise<{
    id: string;
    state: string;
    observedState: string;
    revision: number;
  }>;
  previewConversion(input: {
    artifact: string;
    format: "raw" | "vmdk" | "vdi" | "qcow2" | "iso" | "ova";
    outputName: string;
  }): Promise<Record<string, unknown>>;
  executeConversion(input: { id: string }): Promise<{
    path: string;
    format: "raw" | "vmdk" | "vdi" | "qcow2" | "iso" | "ova";
    size: number;
    sha256: string;
    sourceSha256: string;
    contentVerified: true;
    bootVerified: false;
    importerCompatibilityVerified: false;
    overwritten: false;
  }>;
  previewUpload(input: {
    artifact: string;
    destinationId: string;
  }): Promise<Record<string, unknown>>;
  upload(input: {
    id: string;
    signal?: AbortSignal;
  }): Promise<Record<string, unknown>>;
  enrollRemote(input: { targetId: string }): Promise<Record<string, unknown>>;
  startRemote(input: {
    targetId: string;
    manifest: string;
    target?: string;
    jobs?: number;
  }): Promise<{ id: string; state: string }>;
  observeRemote(input: { id: string }): Promise<Record<string, unknown>>;
  cancelRemote(input: { id: string }): Promise<{ id: string; state: string }>;
  previewFlash(input: {
    artifact: string;
    deviceId: string;
  }): Promise<Record<string, unknown>>;
  confirmFlash(input: {
    token: string;
    reviewedIdentity: string;
    signal?: AbortSignal;
  }): Promise<Record<string, unknown>>;
}
export function createDeploymentService(options: {
  root: string;
  managedDirectory?: string;
  executor?: (
    file: string,
    args: string[],
    options: Record<string, unknown>,
  ) => Promise<{ state: string; stdout?: string }>;
  resolveExecutable?: (toolId: "vboxmanage" | "vmrun" | "qemu-img") => Promise<{
    path: string; sha256: string; origin: "user-selected" | "bundled";
    bundled: boolean; receiptId?: string;
  }>;
  http?: typeof fetch;
  cloudDestinations?: unknown[];
  remoteTargets?: unknown[];
  remoteTransport?: Function;
  flashAdapter?: unknown;
}): DeploymentService;
