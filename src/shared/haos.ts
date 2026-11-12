export type HaosArtifact = { name: string; bytes: number; sha256: string };
export type HaosSummary = {
  source: null | { path: string; defconfigs: string[]; treeVersion: string | null; externalName: string | null; containerRecipe: boolean; core: string | null; sourceImages: boolean };
  output: string;
  job: null | {
    kind: "image" | "container";
    label: string;
    state: "running" | "succeeded" | "failed" | "cancelled";
    startedAt: number;
    folder: string;
    lines: string[];
    error: string | null;
    artifacts: HaosArtifact[];
    image: null | { id: string; bytes: number };
    commit: string | null;
    /** Images the OS image holds that were built from the repository, with the digest found in the OS image. */
    fromSource: { id: string; reference: string; digest: string; matches?: boolean }[];
  };
};
