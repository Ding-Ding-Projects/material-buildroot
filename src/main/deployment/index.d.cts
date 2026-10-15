export interface Artifact { path: string; size: number; sha256: string; format: string; partitions: Array<Record<string, unknown>>; preview: string | null; previewTruncated: boolean; }
export interface Manifest { schemaVersion: 1; algorithm: 'sha256'; locks: Record<string, string>; entries: Array<{path:string;size:number;sha256:string}>; digest:string; }
export interface Hardware { memoryMiB?:number;cpus?:number;firmware?:'bios'|'efi';network?:'nat'|'none'|'hostonly'; }
export interface Guest { id:string;provider:'virtualbox'|'vmware';hardware:Hardware;state:string; }
export interface DeploymentService {
 listArtifacts(directory?:string):Promise<Array<{path:string;kind:string;size:number}>>;
 inspectArtifact(path:string):Promise<Artifact>;
 createManifest(input:{paths:string[];locks?:Record<string,string>}):Promise<Manifest>;
 compareManifests(before:Manifest,after:Manifest):{reproducible:boolean;differences:unknown[];locksChanged:boolean;interpretation:string};
 collectCompliance(directory?:string):Promise<Record<string,unknown>>;
 discoverHypervisors():Promise<Record<string,unknown>>;
 listGuests():Guest[];
 createGuest(input:{provider:'virtualbox'|'vmware';hardware?:Hardware;disk?:string}):Promise<Guest>;
 importGuest(input:{provider:'virtualbox'|'vmware';artifact:string;hardware?:Hardware}):Promise<Guest>;
 editGuest(input:{id:string;hardware:Hardware}):Promise<Guest>;
 launchGuest(input:{id:string}):Promise<{id:string;state:string;bootVerified:false}>;
 stopGuest(input:{id:string}):Promise<{id:string;state:string;shutdownVerified:false}>;
 refreshGuest(input:{id:string}):Promise<{id:string;state:string}>;
 previewConversion(input:{artifact:string;format:'raw'|'vmdk'|'vdi'|'qcow2';outputName:string}):Promise<Record<string,unknown>>;
 executeConversion(input:{id:string}):Promise<Artifact>;
 previewUpload(input:{artifact:string;destinationId:string}):Promise<Record<string,unknown>>;
 upload(input:{id:string;signal?:AbortSignal}):Promise<Record<string,unknown>>;
 enrollRemote(input:{targetId:string}):Promise<Record<string,unknown>>;
 startRemote(input:{targetId:string;manifest:string;target?:string;jobs?:number}):Promise<{id:string;state:string}>;
 observeRemote(input:{id:string}):Promise<Record<string,unknown>>;
 cancelRemote(input:{id:string}):Promise<{id:string;state:string}>;
 previewFlash(input:{artifact:string;deviceId:string}):Promise<Record<string,unknown>>;
 confirmFlash(input:{token:string;reviewedIdentity:string;signal?:AbortSignal}):Promise<Record<string,unknown>>;
}
export function createDeploymentService(options:{root:string;managedDirectory?:string;executor?: (file:string,args:string[],options:Record<string,unknown>)=>Promise<{state:string;stdout?:string}>;executables?:Record<string,string>;http?:typeof fetch;cloudDestinations?:unknown[];remoteTargets?:unknown[];remoteTransport?:Function;flashAdapter?:unknown}):DeploymentService;
