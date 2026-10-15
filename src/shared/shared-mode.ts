export interface SharedModeSnapshot {
  available: boolean;
  watching: boolean;
  configured: boolean | null;
  active: boolean | null;
  displayName: string | null;
  revision: string | null;
  credentialKind: "pin" | "password" | "passkey" | null;
}
export type SharedModeRequest =
  | { action: "status" | "reload" }
  | { action: "initialize"; displayName: string }
  | { action: "enter"; expectedRevision: string }
  | { action: "leave"; expectedRevision: string; secret: string }
  | { action: "rename"; expectedRevision: string; displayName: string }
  | {
      action: "enroll";
      expectedRevision: string;
      kind: "pin" | "password";
      secret: string;
      confirmation: string;
      currentSecret?: string;
    };
export type SharedModeReply =
  | { ok: true; result: SharedModeSnapshot }
  | { ok: false; code: string };
export interface SharedModeRecovery {
  directory: string;
  record: string;
  disclosure: string;
}
