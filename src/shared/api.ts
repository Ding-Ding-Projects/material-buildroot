export type Backend = 'wsl' | 'docker';
export type Language = 'en' | 'yue' | 'both';
export interface Project { id: string; name: string; root: string; output: string; backend: Backend; distro: string; image: string; jobs: number; external: string; }
export interface SymbolNode { id: string; name: string; prompt: string; type: string; value: string; help: string; visible: boolean; assignable: string[]; children: SymbolNode[]; choices?: string[]; }
export interface TaskEvent { taskId: string; kind: 'log'|'state'|'progress'; text: string; stream?: string; state?: string; timestamp: string; }
export interface Result { ok: boolean; error?: string; [key: string]: unknown; }
export interface StudioAPI {
  invoke(action: string, payload?: Record<string, unknown>): Promise<any>;
  onEvent(listener: (event: TaskEvent) => void): () => void;
}
declare global { interface Window { studio: StudioAPI; } }
