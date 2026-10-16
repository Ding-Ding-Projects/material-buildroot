export type StatusHubCode = "STARTING" | "CONNECTED" | "CLIENT_UNAVAILABLE" | "MISSING_ENROLLMENT" | "DELIVERY_UNAVAILABLE" | "CLOSED";
export interface StatusHubSnapshot {
  state: "starting" | "connected" | "unavailable" | "closed";
  code: StatusHubCode;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  authenticated: boolean;
}
export type StatusHubReply = { ok: true; result: StatusHubSnapshot } | { ok: false; code: "UNAUTHORIZED" | "INVALID_REQUEST" };
