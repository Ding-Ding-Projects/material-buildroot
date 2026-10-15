export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export type SettingValues = Record<string, JsonValue>;
export type SettingRegistry = Readonly<
  Record<string, (value: JsonValue) => boolean>
>;
export interface ScheduleOptions {
  registry: SettingRegistry;
  allowedOrigins?: readonly string[];
  allowLoopbackHttp?: boolean;
}
export interface RemoteSourceLimits {
  refreshMs: number;
  timeoutMs: number;
  maxResponseBytes: number;
}
export type ScheduleSource =
  | { type: "local" }
  | ({ type: "https"; url: string } & RemoteSourceLimits)
  | ({
      type: "home-assistant";
      baseUrl: string;
      entityId: string;
    } & RemoteSourceLimits);
export interface ScheduleRule {
  id: string;
  label: string;
  enabled: boolean;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  startTime: string;
  endTime: string;
  days: { type: "everyday" } | { type: "weekdays"; weekdays: number[] };
  values: SettingValues;
  source: ScheduleSource;
}
export interface ScheduleDocument {
  schemaVersion: 1;
  revision: number;
  timeZone: string;
  rules: ScheduleRule[];
}
export interface ExternalRequest {
  readonly generation: number;
  readonly revision: number;
  readonly ruleId: string;
  readonly startedAt: number;
  readonly signal: AbortSignal;
}
export interface ExternalPayload {
  schemaVersion: 1;
  status: "ready" | "off" | "failed";
  values: SettingValues;
}
declare const receipt: unique symbol;
export interface ExternalReceipt {
  readonly [receipt]: true;
}
export interface ScheduleHistoryReceipt {
  schemaVersion: 1;
  action: "schedule.created" | "schedule.updated";
  fromRevision: number | null;
  toRevision: number;
}
export interface ScheduleCommitAdapter {
  read(): Promise<Uint8Array | null>;
  commit(transaction: {
    expectedBytes: Uint8Array | null;
    bytes: Uint8Array;
    receipt: ScheduleHistoryReceipt;
  }): Promise<boolean>;
}
export const SCHEDULE_LIMITS: Readonly<{
  documentBytes: number;
  rules: number;
  depth: number;
  keys: number;
  arrayItems: number;
  stringCodePoints: number;
  valueBytes: number;
  responseBytes: number;
}>;
export class ScheduleError extends Error {
  readonly code: string;
  constructor(code: string);
}
export function validateScheduleDocument(
  input: unknown,
  options: ScheduleOptions,
): ScheduleDocument;
export function parseScheduleBytes(
  bytes: Uint8Array,
  options: ScheduleOptions,
): ScheduleDocument;
export function evaluateSchedule(
  options: ScheduleOptions & {
    document: ScheduleDocument;
    base: SettingValues;
    at: number;
    external?: Record<string, ExternalReceipt>;
  },
): {
  values: SettingValues;
  provenance: Record<string, string | null>;
  appliedRuleIds: string[];
  issues: Array<{ ruleId: string; code: string }>;
};
export function createExternalScheduleCoordinator(
  options: ScheduleOptions,
): Readonly<{
  reset(document: ScheduleDocument): number;
  reconcile(document: ScheduleDocument, at: number): void;
  begin(
    document: ScheduleDocument,
    ruleId: string,
    at: number,
  ): ExternalRequest;
  settleBytes(token: ExternalRequest, bytes: Uint8Array, at: number): boolean;
  settle(token: ExternalRequest, payload: ExternalPayload, at: number): boolean;
  snapshot(): Record<string, ExternalReceipt>;
  cancel(): void;
}>;
export function createScheduleStore(
  options: ScheduleOptions & { adapter: ScheduleCommitAdapter },
): Readonly<{
  load(): Promise<ScheduleDocument | null>;
  replace(
    input: ScheduleDocument,
    options: { expectedRevision: number | null },
  ): Promise<ScheduleDocument>;
}>;
