import type {
  ScheduleCommitAdapter,
  ScheduleOptions,
  ScheduleHistoryReceipt,
} from "../../shared/scheduled-settings.mjs";
export class ScheduleStorageError extends Error {
  readonly code: string;
  constructor(code?: string);
}
export interface SqliteScheduleAdapter extends ScheduleCommitAdapter {
  history(page?: {
    after?: number;
    limit?: number;
  }): Promise<{
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
  },
): Readonly<SqliteScheduleAdapter>;
