export interface SourceSnapshot { id: string; revision: string; createdAt: string }
export interface SourceStatus { revision: string; branch: string | null; dirty: boolean; changes: string; snapshots: SourceSnapshot[] }
export interface SourcePreview { previewId: string; fromRevision: string; toRevision: string; dirty: boolean; diff: string; patch: string; changedFiles: string[]; compatibilityAreas: string[]; outputCompatibility: 'unknown'; outputPreserved: true }
export class SourceService {
  constructor(options?: { git?: string; allowLocalFixture?: boolean; acquireSourceLock?: ((canonicalSource: string) => Promise<() => void>) | null });
  dispose(): void;
  grantRoot(root: string): { grantId: string; root: string };
  revoke(grantId: string): void;
  adopt(request: { grantId: string; directory: string; trustedSource: true }): Promise<SourceStatus & { projectId: string; source: string }>;
  clone(request: { grantId: string; directory: string; url: string; ref?: string; trustedSource: true }): Promise<SourceStatus & { projectId: string; source: string }>;
  status(projectId: string): Promise<SourceStatus>;
  snapshots(projectId: string): Promise<SourceSnapshot[]>;
  snapshotRevision(projectId: string, snapshotId: string): Promise<string>;
  snapshot(request: {projectId: string; expectedRevision: string}): Promise<SourceStatus & {snapshot: SourceSnapshot}>;
  acquireRef(request: { projectId: string; ref: string }): Promise<SourceStatus & { fetchedRevision: string }>;
  previewUpgrade(request: { projectId: string; revision: string }): Promise<SourcePreview>;
  applyUpgrade(request: { previewId: string; expectedRevision: string; consent: true }): Promise<SourceStatus & { snapshot: SourceSnapshot; rollbackRevision: string; outputPreserved: true; outputCompatibility: 'unknown' }>;
}
