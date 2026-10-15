import type { ScheduleSourceEnrollment } from "./schedule-provider.mjs";
export interface SourceEnrollmentEntry {
  id: string;
  label: string;
  origin: string;
  kind: "https" | "home-assistant";
  privateAddresses: string[];
  credentialConfigured: boolean;
}
export interface SourceEnrollmentList {
  available: true;
  revision: string | null;
  entries: SourceEnrollmentEntry[];
}
export interface SourceEnrollmentSave {
  expectedRevision: string | null;
  id?: string;
  label: string;
  origin: string;
  kind: "https" | "home-assistant";
  privateAddresses?: string[];
  privateAddressConsent?: boolean;
  token?: string;
  retainCredential?: boolean;
  authorize?: () => boolean;
}
export interface SourceEnrollmentRemove {
  expectedRevision: string | null;
  id: string;
  authorize?: () => boolean;
}
export class SourceEnrollmentError extends Error {
  readonly code: string;
  constructor(code: string);
}
export function createSourceEnrollmentStore(options: {
  directory: string;
  profileId: string;
  vault?: { write(owner: string, secret: string): string | Promise<string> };
}): Readonly<{
  list(): Promise<SourceEnrollmentList>;
  /** Protected host-only provider binding. Never serialize into IPC, logs or ordinary history. */
  bindings(): Promise<{
    revision: string | null;
    entries: ScheduleSourceEnrollment[];
  }>;
  save(input: SourceEnrollmentSave): Promise<SourceEnrollmentList>;
  remove(input: SourceEnrollmentRemove): Promise<SourceEnrollmentList>;
  close(): void;
}>;
