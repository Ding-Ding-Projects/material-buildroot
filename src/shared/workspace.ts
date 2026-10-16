export interface WorkspacePlan {
  id: string;
  name: string;
  runtime: "wsl" | "docker";
  target: "image" | "sdk" | "toolchain";
  status: "draft" | "ready-for-review";
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface WorkspacePayload {
  plans: WorkspacePlan[];
  preferences: { theme: "system" | "light" | "dark" };
  onboardingCompleted: boolean;
  onboarding: {
    step: 0 | 1 | 2;
    runtime: "wsl" | "docker";
    name: string;
    dismissed: boolean;
    planId?: string;
  };
}
export interface WorkspaceState extends WorkspacePayload {
  format: "material-buildroot-workspace";
  version: 1;
  revision: number;
  snapshots: Array<{
    id: string;
    name: string;
    createdAt: string;
    payload: WorkspacePayload;
  }>;
  activity: Array<{
    id: string;
    action: string;
    timestamp: string;
    revision: number;
  }>;
}
type PlanInput = Pick<
  WorkspacePlan,
  "name" | "runtime" | "target" | "status" | "notes"
>;
export type WorkspaceMutation = { expectedRevision: number } & (
  | { action: "plan.create"; plan: PlanInput }
  | { action: "plan.update"; id: string; changes: Partial<PlanInput> }
  | { action: "plan.delete"; id: string }
  | {
      action: "preferences.update";
      preferences: WorkspacePayload["preferences"];
    }
  | { action: "onboarding.complete" }
  | { action: "onboarding.update"; onboarding: WorkspacePayload["onboarding"] }
  | { action: "onboarding.createPlan"; plan: PlanInput }
  | { action: "snapshot.create"; name: string }
  | { action: "snapshot.restore"; id: string }
  | { action: "document.import"; document: string }
  | { action: "revision.restore"; revision: number }
  | { action: "history.read"; beforeRevision?: number }
  | { action: "history.compare"; revision: number }
  | { action: "history.label"; revision: number; label: string }
  | { action: "history.retain"; keep: 25 | 100 | 500 }
  | { action: "document.export"; scope: "workspace" | "plans" | "history" | "revisions"; ids: string[] }
);
export type WorkspaceReply =
  | { ok: true; state: WorkspaceState & { historyWarning?: boolean }; document?: string; history?: { records: Array<{ revision: number; action: string; timestamp: string | null; plans: number; labels: string[] }>; nextBeforeRevision: number | null }; removed?: number; comparison?: { fromRevision: number; toRevision: number; changes: Array<{ kind: string; id?: string; before: unknown; after: unknown }> } }
  | {
      ok: false;
      code:
        | "INVALID_REQUEST"
        | "REVISION_CONFLICT"
        | "STORAGE_BUSY"
        | "STORAGE_UNAVAILABLE"
        | "NOT_FOUND"
        | "LIMIT_REACHED"
        | "UNAUTHORIZED";
    };
