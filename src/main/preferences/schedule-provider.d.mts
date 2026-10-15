import type {
  ScheduleRule,
  ScheduleOptions,
  SettingRegistry,
} from "../../shared/scheduled-settings.mjs";
export interface ScheduleSourceEnrollment {
  origin: string;
  kind: "https" | "home-assistant";
  privateAddresses: string[];
  developmentLoopback: boolean;
  credentialReference: string | null;
}
export interface ScheduleProviderOptions {
  enrollments: ScheduleSourceEnrollment[];
  registry: SettingRegistry;
  vault?: { read(reference: string, owner: string): string | Promise<string> };
  lookup?: (
    hostname: string,
    options: { all: true; verbatim: true },
  ) => Promise<Array<{ address: string; family: number }>>;
  trustedCa?: string | Uint8Array;
  maxConcurrent?: number;
}
export class ScheduleProviderError extends Error {
  readonly code: string;
  constructor(code: string);
}
export function homeAssistantVaultOwner(origin: string): string;
export function createScheduleSourceProvider(
  options: ScheduleProviderOptions,
): Readonly<{
  options(): ScheduleOptions;
  request(
    rule: ScheduleRule,
    options?: { signal?: AbortSignal },
  ): Promise<Uint8Array>;
  cancelAll(): void;
  close(): void;
}>;
