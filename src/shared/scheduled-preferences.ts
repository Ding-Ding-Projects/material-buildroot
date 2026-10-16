import type {
  ScheduleDocument,
  ScheduleHistoryReceipt,
  ScheduleDraftReceipt,
  ScheduleDraftPage,
  ScheduleDraftRecord,
} from "./scheduled-settings.mjs";
export type {ScheduleDraftReceipt, ScheduleDraftPage, ScheduleDraftRecord} from "./scheduled-settings.mjs";
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
export interface ScheduledSourceEntry {
  id: string;
  label: string;
  origin: string;
  kind: "https" | "home-assistant";
  privateAddresses: string[];
  /** A stored protected reference, not a successful provider health check. */
  credentialConfigured: boolean;
}
export interface ScheduledSourceList {
  available: true;
  revision: string | null;
  entries: ScheduledSourceEntry[];
}
export type ScheduledPreferencesRequest =
  | { action: "status" | "read" | "refresh" | "cancel" }
  | { action: "enrollment.list" }
  | { action: "draft.discard"; document: ScheduleDocument }
  | { action: "draft.list"; after: number; limit: number }
  | { action: "draft.read"; sequence: number }
  | { action: "history.read"; revision: number }
  | {
      action: "enrollment.save";
      expectedRevision: string | null;
      id?: string;
      label: string;
      origin: string;
      kind: "https" | "home-assistant";
      privateAddresses?: string[];
      privateAddressConsent?: boolean;
      token?: string;
      retainCredential?: boolean;
    }
  | { action: "enrollment.remove"; expectedRevision: string | null; id: string }
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
        | {document:ScheduleDocument}
        | ScheduledSourceList
        | ScheduleDraftReceipt
        | ScheduleDraftPage
        | ScheduleDraftRecord
        | null;
    }
  | { ok: false; code: string };
