import {
  parseScheduleBytes,
  validateScheduleDocument,
  SCHEDULE_LIMITS,
} from "../../shared/scheduled-settings.mjs";
/** Syntax admission never grants network authority. Provider enrollments remain independent. */
export function syntaxOptions(document, options) {
  const origins = new Set(options.allowedOrigins ?? []);
  if (
    Array.isArray(document?.rules) &&
    document.rules.length <= SCHEDULE_LIMITS.rules
  )
    for (const rule of document.rules) {
      const source = rule?.source,
        value =
          source?.type === "https"
            ? source.url
            : source?.type === "home-assistant"
              ? source.baseUrl
              : null;
      if (typeof value === "string" && value.length <= 2048) {
        try {
          origins.add(new URL(value).origin);
        } catch {}
      }
    }
  return { ...options, allowedOrigins: [...origins] };
}
export function parseStoredSchedule(bytes, options) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength > SCHEDULE_LIMITS.documentBytes
  )
    return parseScheduleBytes(bytes, options);
  let document;
  try {
    document = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    return parseScheduleBytes(bytes, options);
  }
  return parseScheduleBytes(bytes, syntaxOptions(document, options));
}
export function validateStoredSchedule(document, options) {
  return validateScheduleDocument(document, syntaxOptions(document, options));
}
