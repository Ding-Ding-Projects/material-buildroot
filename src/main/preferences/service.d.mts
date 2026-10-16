import type {
  SourceEnrollmentList,
  SourceEnrollmentSave,
  SourceEnrollmentRemove,
} from "./source-enrollments.mjs";
import type {
  ScheduleDocument,
  SettingRegistry,
  ScheduleHistoryReceipt,
  ScheduleDraftReceipt,
  ScheduleDraftPage,
  ScheduleDraftRecord,
} from "../../shared/scheduled-settings.mjs";
import type { SqliteScheduleAdapter } from "./schedule-store.mjs";
import type {
  ScheduleProviderOptions,
  ScheduleSourceEnrollment,
} from "./schedule-provider.mjs";
export interface ScheduleEffective {
  values: {
    language: "en" | "zh-HK" | "bilingual";
    "appearance.theme": "system" | "light" | "dark";
  };
  provenance: Record<"language" | "appearance.theme", string | null>;
  appliedRuleIds: string[];
  issues: Array<{ ruleId: string; code: string }>;
}
export interface SchedulePreferencesSnapshot {
  available: boolean;
  watching: boolean;
  running: boolean;
  revision: number | null;
  externalAvailable: boolean;
  effective: ScheduleEffective | null;
  evaluatedAt: number | null;
}
export const CURRENT_SCHEDULE_REGISTRY: SettingRegistry;
export class SchedulePreferencesError extends Error {
  readonly code: string;
  constructor(code: string);
}
export function createSchedulePreferencesService(options: {
  directory: string;
  profileId: string;
  baseReader: () =>
    | ScheduleEffective["values"]
    | Promise<ScheduleEffective["values"]>;
  sourceEnrollments?: ScheduleSourceEnrollment[];
  vault?: ScheduleProviderOptions["vault"] & {
    write?(owner: string, secret: string): string | Promise<string>;
  };
  clock?: () => number;
  tickMs?: number;
  watchFactory?: (
    directory: string,
    options: { persistent: boolean },
    listener: () => void,
  ) => { on(event: string, listener: () => void): unknown; close(): void };
  lookup?: ScheduleProviderOptions["lookup"];
  trustedCa?: ScheduleProviderOptions["trustedCa"];
  storageAdapter?: SqliteScheduleAdapter;
}): Readonly<{
  start(): Promise<SchedulePreferencesSnapshot>;
  read(): Promise<ScheduleDocument | null>;
  draftDiscard(input:{document:ScheduleDocument;authorize?:()=>boolean}):Promise<ScheduleDraftReceipt>;
  draftList(input?:{after?:number;limit?:number;authorize?:()=>boolean}):Promise<ScheduleDraftPage>;
  draftRead(input:{sequence:number;authorize?:()=>boolean}):Promise<ScheduleDraftRecord|null>;
  enrollmentList(): Promise<SourceEnrollmentList>;
  enrollmentSave(input: SourceEnrollmentSave): Promise<SourceEnrollmentList>;
  enrollmentRemove(
    input: SourceEnrollmentRemove,
  ): Promise<SourceEnrollmentList>;
  replace(options: {
    document: ScheduleDocument;
    expectedRevision: number | null;
    authorize?: () => boolean;
  }): Promise<ScheduleDocument>;
  historyRead(input:{revision:number;authorize?:()=>boolean}):Promise<{document:ScheduleDocument}|null>;
  history(page?: { after?: number; limit?: number }): Promise<{
    records: Array<{ sequence: number; receipt: ScheduleHistoryReceipt }>;
    next: number;
    hasMore: boolean;
  }>;
  evaluate(options?: { at?: number }): Promise<ScheduleEffective>;
  refresh(): Promise<SchedulePreferencesSnapshot>;
  cancel(): Promise<SchedulePreferencesSnapshot>;
  status(): SchedulePreferencesSnapshot;
  subscribe(
    listener: (snapshot: SchedulePreferencesSnapshot) => void,
  ): () => void;
  close(): void;
}>;
