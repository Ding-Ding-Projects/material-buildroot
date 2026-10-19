export function restoreIsoSchedulerRecovery(options: {
  jobs: { list(owner: string): Array<{ id: string; state: string; itemCount: number; payload: Record<string, any> }>; page(id: string, channel: "item", options: { after: number; limit: number }, owner: string): { records: Array<{ value: any }> } };
  owner: string; quarantine: { list(): Array<{ jobId: string }>; begin(record: { jobId: string; workspaceId: string }): void };
  recoveryDirectory: string; journalDirectory: string; markRecoveryUnavailable(): void;
}): { state: "observed" | "unknown"; retained: Array<{ jobId: string; workspaceId: string; reason: string }>; grantsRestored: false };
