import type {
  ScheduleDocument,
  ScheduleHistoryReceipt,
} from "./scheduled-settings.mjs";
import type { Language } from "./api";

export interface ScheduledValues {
  language: Language;
  "appearance.theme": "system" | "light" | "dark";
}
export interface ScheduledEffective {
  values: ScheduledValues;
  provenance: Record<keyof ScheduledValues, string | null>;
  appliedRuleIds: string[];
  issues: Array<{ ruleId: string; code: string }>;
}
export interface ScheduledPreferencesSnapshot {
  available: boolean;
  watching: boolean;
  running: boolean;
  revision: number | null;
  externalAvailable: boolean;
  effective: ScheduledEffective | null;
  evaluatedAt: number | null;
}
export interface ScheduledHistoryPage {
  records: Array<{ sequence: number; receipt: ScheduleHistoryReceipt }>;
  next: number;
  hasMore: boolean;
}
export type ScheduledPreferencesRequest =
  | { action: "status" | "read" | "refresh" | "cancel" }
  | {
      action: "replace";
      document: ScheduleDocument;
      expectedRevision: number | null;
    }
  | { action: "history"; after: number; limit: number };
export type ScheduledPreferencesReply =
  | {
      ok: true;
      result:
        | ScheduledPreferencesSnapshot
        | ScheduleDocument
        | ScheduledHistoryPage
        | null;
    }
  | { ok: false; code: string };
