export type Language = "en" | "zh-HK" | "bilingual";
export type Runtime =
  | "wsl"
  | "docker"
  | "ssh-linux-process"
  | "ssh-linux-container"
  | "ssh-windows-wsl"
  | "ssh-windows-docker"
  | "actions-linux";
interface RequestIdentity {
  version: 1;
  operationId: string;
  projectId: string;
  expectedRevision: string;
  capability: string;
}
export interface ActionArguments {
  "settings.setLanguage": { language: Language };
  "projects.create": {
    runtime: Runtime;
    destinationCapability: string;
    name: string;
  };
  "builds.preview": {
    configurationRevision: string;
    target: "image" | "sdk" | "toolchain";
  };
  "builds.submit": { previewId: string; previewSha256: string };
  "jobs.cancel": { jobId: string; expectedSequence: number };
}
export type OperationRequest = {
  [Action in keyof ActionArguments]: RequestIdentity & {
    action: Action;
    arguments: ActionArguments[Action];
  };
}[keyof ActionArguments];
export type OperationFailureCode =
  | "REQUEST_TYPE"
  | "REQUEST_TOO_LARGE"
  | "REQUEST_ENCODING"
  | "REQUEST_SYNTAX"
  | "REQUEST_DEPTH"
  | "REQUEST_COMPLEXITY"
  | "REQUEST_UNSAFE_KEY"
  | "REQUEST_DUPLICATE_KEY"
  | "REQUEST_NUMBER"
  | "REQUEST_SCHEMA"
  | "UNAUTHORIZED"
  | "STALE_REVISION"
  | "IDEMPOTENCY_CONFLICT"
  | "UNAVAILABLE"
  | "NOT_IMPLEMENTED";
export type OperationReply<Result = unknown> =
  | { ok: true; operationId: string; revision: string; result: Result }
  | { ok: false; code: OperationFailureCode; message: string };
export interface OperationEvent {
  version: 1;
  operationId: string;
  sequence: number;
  timestamp: string;
  state:
    | "accepted"
    | "running"
    | "cancelling"
    | "cancelled"
    | "succeeded"
    | "failed"
    | "interrupted"
    | "partial";
}
export type WindowCommand = "minimize" | "maximize-restore" | "close";
export interface StudioBootstrap {
  language: Language;
  revision: string;
  projectId: string;
  capability: string;
  storage: "ready" | "unavailable";
  origin: "default" | "saved" | "unavailable";
  version: string;
  source: string | null;
  updatedAt: string | null;
}
/** Only host-admitted documents receive this bridge. */
export interface WorkspaceTabSummary {id:string;label:string;group:string;pinned:boolean;workspace:string}
export type WorkspaceTabsRequest={action:'publish';tabs:WorkspaceTabSummary[]}|{action:'list'}|{action:'activate';windowId:string;tabId:string};
export type WorkspaceTabsReply={ok:false;code:string}|{ok:true;windowId?:string;currentWindowId?:string;requested?:boolean;windows?:Array<{id:string;tabs:WorkspaceTabSummary[]}>};
export interface StudioAPI {
  notifications?(request:import('./notifications').NotificationRequest):Promise<import('./notifications').NotificationReply>;
  onNotificationsChanged?(listener:()=>void):()=>void;
  workspaceTabs?(request:WorkspaceTabsRequest):Promise<WorkspaceTabsReply>;
  onWorkspaceTabActivate?(listener:(tabId:string)=>void):()=>void;
  onWorkspaceTabsChanged?(listener:()=>void):()=>void;
  dimSum?(request:{action:'catalog'|'photo'|'surprise';id?:string}):Promise<{ok:boolean;code?:string;source?:string;revision?:string;dishes?:Array<{id:string;en:string;zh:string;photo:string|null}>;dish?:{id:string;en:string;zh:string;photo:string|null;image?:string}|null}>;
  statusHub?(action: "read" | "refresh"): Promise<import("./status-hub").StatusHubReply>;
  appearanceHistory?(request:{action:string;[key:string]:unknown}):Promise<{ok:boolean;revision?:number;snapshot?:any;records?:Array<{revision:number;timestamp:string;elementCount:number;trackTargetCount:number}>;hasMore?:boolean;code?:string}>;
  appearanceFonts?(): Promise<{ok:true;fonts:string[];variableAxesAvailable:false}|{ok:false;code:string}>;
  authenticator?(request: Record<string, unknown>): Promise<import("./authenticator").AuthenticatorReply>;
  experiencePolicies?(request: import("./experience-policies").ExperienceRequest): Promise<import("./experience-policies").ExperienceReply>;
  scheduledPreferences?(
    request: import("./scheduled-preferences").ScheduledPreferencesRequest,
  ): Promise<import("./scheduled-preferences").ScheduledPreferencesReply>;
  onScheduledPreferences?(
    listener: (
      snapshot: import("./scheduled-preferences").ScheduledPreferencesSnapshot,
    ) => void,
  ): () => void;
  sharedMode?(
    request: import("./shared-mode").SharedModeRequest,
  ): Promise<import("./shared-mode").SharedModeReply>;
  sharedModeRecovery?(): Promise<
    | { ok: true; result: import("./shared-mode").SharedModeRecovery }
    | { ok: false; code: string }
  >;
  onSharedMode?(
    listener: (snapshot: import("./shared-mode").SharedModeSnapshot) => void,
  ): () => void;
  operations?(request: {
    action: string;
    [key: string]: unknown;
  }): Promise<{ ok: true; result: unknown } | { ok: false; code: string }>;
  workspaceGet?(): Promise<import("./workspace").WorkspaceReply>;
  workspaceMutate?(
    request: import("./workspace").WorkspaceMutation,
  ): Promise<import("./workspace").WorkspaceReply>;
  workspaceExport?(): Promise<import("./workspace").WorkspaceReply>;
  bootstrap(): Promise<StudioBootstrap>;
  windowControl(command: WindowCommand): Promise<boolean>;
  request(request: OperationRequest): Promise<OperationReply>;
  onEvent(listener: (event: OperationEvent) => void): () => void;
}
declare global {
  interface Window {
    studio: StudioAPI;
  }
}



