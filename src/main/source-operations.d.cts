import type { SourceService } from "./execution/source.cjs";
export type SourceOperation =
  | { action: "source.choose" }
  | { action: "source.clone.official"; selectionId: string; directory: string; ref: string; trust: true }
  | {
      action: "source.clone";
      selectionId: string;
      directory: string;
      url: string;
      ref: string;
      trust: true;
    }
  | { action: "source.status"; workspaceId: string }
  | { action: "source.snapshot"; workspaceId: string; expectedRevision: string; consent: true }
  | { action: "source.ref"; workspaceId: string; ref: string }
  | { action: "source.upgrade.preview"; workspaceId: string; revision: string }
  | {
      action: "source.upgrade.apply" | "source.rollback.apply";
      workspaceId: string;
      previewId: string;
      expectedRevision: string;
      consent: true;
    }
  | {
      action: "source.rollback.preview";
      workspaceId: string;
      rollbackId: string;
    };
export type SourceErrorCode =
  | "INVALID_REQUEST"
  | "SOURCE_SERVICE_CLOSED"
  | "WORKSPACE_UNAVAILABLE"
  | "SOURCE_PATH_CHANGED"
  | "SOURCE_PICKER_UNAVAILABLE"
  | "SOURCE_TRUST_REQUIRED"
  | "SOURCE_SELECTION_UNAVAILABLE"
  | "WORKSPACE_REGISTRATION_UNAVAILABLE"
  | "WORKSPACE_REGISTRATION_FAILED"
  | "SOURCE_LOCK_UNAVAILABLE"
  | "ROLLBACK_UNAVAILABLE"
  | "INVALID_REVISION"
  | "SOURCE_APPLY_CONSENT_REQUIRED"
  | "PREVIEW_UNAVAILABLE"
  | "SOURCE_BUSY"
  | "REVISION_CONFLICT"
  | "ADOPTION_REQUIRED"
  | "INVALID_SOURCE_DIRECTORY"
  | "SOURCE_REPOSITORY_REQUIRED"
  | "UNSAFE_SOURCE_URL"
  | "INVALID_SOURCE_REF"
  | "DESTINATION_NOT_EMPTY"
  | "SOURCE_CHANGED_OR_DIRTY"
  | "GIT_UNAVAILABLE"
  | "SOURCE_TIMEOUT"
  | "SOURCE_OUTPUT_LIMIT"
  | "SOURCE_GIT_FAILED"
  | "SOURCE_UNAVAILABLE";
export interface SourceOperationSuccess {
  ok: true;
  cancelled?: true;
  selectionId?: string;
  name?: string;
  workspaceId?: string;
  revision?: string;
  branch?: string | null;
  dirty?: boolean;
  changes?: string;
  snapshots?: { id: string; revision: string; createdAt: string }[];
  snapshot?: { id: string; revision: string; createdAt: string };
  fetchedRevision?: string;
  previewId?: string;
  kind?: "upgrade" | "rollback";
  fromRevision?: string;
  toRevision?: string;
  diff?: string;
  patch?: string;
  changedFiles?: string[];
  compatibilityAreas?: string[];
  outputCompatibility?: "unknown";
  outputPreserved?: true;
  rollbackId?: string;
  rollbackRevision?: string;
}
export function createSourceOperations(options: {
  chooseDirectory?(): Promise<string | null>;
  resolveWorkspace?(workspaceId: string): Promise<{ source: string } | null>;
  onSourceAdopted?(source: {
    root: string;
    source: string;
    revision: string;
    branch: string | null;
  }): Promise<{ workspaceId: string }>;
  acquireSourceLock?(canonicalSource: string): Promise<() => void>;
  sourceOptions?: { git?: string; allowLocalFixture?: boolean };
  sourceService?: SourceService;
  sourceServiceForWorkspace?(workspace: {source: string}): SourceService | undefined;
}): {
  handle(
    request: SourceOperation,
  ): Promise<SourceOperationSuccess | { ok: false; code: SourceErrorCode }>;
  dispose(): void;
};
