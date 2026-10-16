export interface ProjectStorageIdentity {
  applicationId: "com.dingdingprojects.materialbuildroot";
  surface: "desktop";
}

/** Saved paths describe a project. They never grant access to a filesystem. */
export interface ProjectDescriptor {
  id: string;
  name: string;
  root: string;
  source: string;
  output: string;
}

export interface ExternalTreeDescriptor {
  path: string;
  name: string;
}

export type ProjectRuntime =
  | { kind: "wsl"; distribution: string }
  | { kind: "docker"; image: string; uid: number; gid: number };

export interface ProjectOptions {
  revision: number;
  runtime: ProjectRuntime | null;
  /** Array order is the Buildroot BR2_EXTERNAL search order. */
  externalTrees: ExternalTreeDescriptor[];
}

export interface ProjectCatalogueDocument {
  format: "material-buildroot-projects";
  version: 2;
  storage: ProjectStorageIdentity;
  revision: number;
  projects: ProjectDescriptor[];
}

export interface ProjectOptionsDocument extends ProjectOptions {
  format: "material-buildroot-project-options";
  version: 2;
  storage: ProjectStorageIdentity;
  workspaceId: string;
}

/** Only v1 is migrated. Unknown versions must remain untouched. */
export type LegacyProjectCatalogueDocument = Omit<
  ProjectCatalogueDocument,
  "version" | "storage"
> & { version: 1 };
export type LegacyProjectOptionsDocument = Omit<
  ProjectOptionsDocument,
  "version" | "storage"
> & { version: 1 };
