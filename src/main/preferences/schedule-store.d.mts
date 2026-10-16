import type {
  ScheduleCommitAdapter,
  ScheduleOptions,
  ScheduleHistoryReceipt,
  ScheduleDocument,
  SettingRegistry,
  ScheduleDraftReceipt,
  ScheduleDraftPage,
  ScheduleDraftRecord,
} from "../../shared/scheduled-settings.mjs";
export class ScheduleStorageError extends Error {
  readonly code: string;
  constructor(code?: string);
}
export interface SqliteScheduleAdapter extends ScheduleCommitAdapter {
  historyRead(input:{revision:number}):Promise<{document:ScheduleDocument}|null>;
  history(page?: { after?: number; limit?: number }): Promise<{
    records: Array<{ sequence: number; receipt: ScheduleHistoryReceipt }>;
    next: number;
    hasMore: boolean;
  }>;
  close(): void;
}
export function createSqliteScheduleAdapter(
  options: ScheduleOptions & {
    directory: string;
    profileId: string;
    afterWrite?: () => void;
    allowUnenrolledSources?: boolean;
  },
): Readonly<SqliteScheduleAdapter>;
export const SCHEDULE_DRAFT_LIMITS: Readonly<{records:64;totalBytes:16777216;page:20}>;
export function createSqliteScheduleDiscardStore(options: {
  directory:string; profileId:string; registry:SettingRegistry;
  clock?:()=>number; afterWrite?:()=>void;
}): Readonly<{
  append(input:{document:ScheduleDocument;authorize?:()=>boolean}):Promise<ScheduleDraftReceipt>;
  list(input?:{after?:number;limit?:number;authorize?:()=>boolean}):Promise<ScheduleDraftPage>;
  read(input:{sequence:number;authorize?:()=>boolean}):Promise<ScheduleDraftRecord|null>;
  close():void;
}>;
