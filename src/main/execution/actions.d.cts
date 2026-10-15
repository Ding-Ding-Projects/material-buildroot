import type { BuildTarget } from './index.cjs';
export type RunnerSelection = { kind: 'hosted'; labels: ['ubuntu-24.04'] } | { kind: 'self-hosted'; labels: string[]; billedRunnerConsent: true };
export interface WorkflowModel { sourceRepository: string; defconfig: string; runner: RunnerSelection }
export interface HttpRequest { method: string; url: string; headers: Record<string, string>; body?: unknown; timeoutMs?: number; maxBytes?: number; redirect?: string }
export interface ArtifactRequest { url: string; headers: Record<string, string>; maxBytes: number; timeoutMs: number; onChunk(chunk: Buffer): void; stripCredentialsOnRedirect?: boolean; allowedRedirectOrigins?: string[] }
export interface ActionsTransport { request(request: HttpRequest): Promise<{ status: number; body?: any }>; download(request: ArtifactRequest): Promise<void> }
export interface RunState { operationId: string; runId: number | null; state: string; conclusion?: string | null; htmlUrl?: string }
export interface OperationReceipt { operationId: string; repository: string; runId: number | null; workflowRevision: string }
export function generateWorkflow(model: WorkflowModel): string;
export function validateExpertWorkflow(text: string, model: WorkflowModel): { valid: true; model: WorkflowModel; sha256: string; canonical: string };
export function createGitHubTransport(options?: { fetch?: typeof fetch }): ActionsTransport;
export class ActionsService {
  constructor(options: { request: ActionsTransport['request']; download?: ActionsTransport['download']; getCredential(ref: string): Promise<string>; apiOrigin?: 'https://api.github.com' });
  selectRepository(request: { repository: string; credentialRef: string; trustedSource: true; workflow?: string; runner: RunnerSelection }): { repositoryId: string; repository: string; workflow: string; runner: RunnerSelection };
  revoke(repositoryId: string): void;
  discoverRunners(repositoryId: string): Promise<{ hosted: string[]; selfHosted: { id: number; name: string; os: string; status: string; busy: boolean; labels: string[] }[]; truncated: boolean }>;
  reviewWorkflow(request: { repositoryId: string; workflowRef: string; text: string; model: WorkflowModel }): Promise<{ workflowRef: string; revision: string; sha256: string }>;
  dispatch(request: { repositoryId: string; workflowRef: string; revision: string; target: BuildTarget; consent: true }): Promise<RunState>;
  observe(operationId: string): Promise<RunState>;
  reconnect(request: { repositoryId: string; operationId: string; runId: number; workflowRevision: string }): Promise<RunState>;
  receipt(operationId: string): OperationReceipt;
  jobs(operationId: string): Promise<{ jobs: { id: number; name: string; status: string; conclusion: string | null; runnerId: number | null; runnerName: string | null }[]; truncated: boolean }>;
  cancel(request: { operationId: string; consent: true }): Promise<{ state: string; cancelled: false }>;
  artifacts(operationId: string): Promise<{ id: number; name: string; size: number; digest?: string; expired: boolean }[]>;
  downloadArtifact(request: { operationId: string; artifactId: number; destination: string; expectedSha256: string; maxBytes?: number; consent: true }): Promise<{ destination: string; bytes: number; sha256: string; extracted: false }>;
}
