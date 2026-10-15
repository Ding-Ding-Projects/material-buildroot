export type Language = 'en' | 'zh-HK' | 'bilingual';
export type Runtime = 'wsl' | 'docker' | 'ssh-linux-process' | 'ssh-linux-container' | 'ssh-windows-wsl' | 'ssh-windows-docker' | 'actions-linux';
interface RequestIdentity {version: 1; operationId: string; projectId: string; expectedRevision: string; capability: string;}
export interface ActionArguments {
  'settings.setLanguage': {language: Language};
  'projects.create': {runtime: Runtime; destinationCapability: string; name: string};
  'builds.preview': {configurationRevision: string; target: 'image' | 'sdk' | 'toolchain'};
  'builds.submit': {previewId: string; previewSha256: string};
  'jobs.cancel': {jobId: string; expectedSequence: number};
}
export type OperationRequest = {[Action in keyof ActionArguments]: RequestIdentity & {action: Action; arguments: ActionArguments[Action]}}[keyof ActionArguments];
export type OperationFailureCode =
  | 'REQUEST_TYPE' | 'REQUEST_TOO_LARGE' | 'REQUEST_ENCODING' | 'REQUEST_SYNTAX'
  | 'REQUEST_DEPTH' | 'REQUEST_COMPLEXITY' | 'REQUEST_UNSAFE_KEY'
  | 'REQUEST_DUPLICATE_KEY' | 'REQUEST_NUMBER' | 'REQUEST_SCHEMA'
  | 'UNAUTHORIZED' | 'STALE_REVISION' | 'IDEMPOTENCY_CONFLICT' | 'UNAVAILABLE' | 'NOT_IMPLEMENTED';
export type OperationReply<Result = unknown> =
  | {ok: true; operationId: string; revision: string; result: Result}
  | {ok: false; code: OperationFailureCode; message: string};
export interface OperationEvent {
  version: 1; operationId: string; sequence: number; timestamp: string;
  state: 'accepted' | 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed' | 'interrupted' | 'partial';
}
export type WindowCommand = 'minimize' | 'maximize-restore' | 'close';
export interface StudioBootstrap {
  language: Language; revision: string; projectId: string; capability: string;
  storage: 'ready' | 'unavailable'; origin: 'default' | 'saved' | 'unavailable';
  version: string; source: string | null; updatedAt: string | null;
}
/** Only host-admitted documents receive this bridge. */
export interface StudioAPI {
  bootstrap(): Promise<StudioBootstrap>;
  windowControl(command: WindowCommand): Promise<boolean>;
  request(request: OperationRequest): Promise<OperationReply>;
  onEvent(listener: (event: OperationEvent) => void): () => void;
}
declare global {interface Window {studio: StudioAPI;}}
