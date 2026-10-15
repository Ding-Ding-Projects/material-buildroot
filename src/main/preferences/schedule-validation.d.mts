import type {
  ScheduleDocument,
  ScheduleOptions,
} from "../../shared/scheduled-settings.mjs";
export function syntaxOptions(
  document: unknown,
  options: ScheduleOptions,
): ScheduleOptions;
export function parseStoredSchedule(
  bytes: Uint8Array,
  options: ScheduleOptions,
): ScheduleDocument;
export function validateStoredSchedule(
  document: unknown,
  options: ScheduleOptions,
): ScheduleDocument;
