export type ExperiencePolicy = 'pin'|'password'|'pin+password'|'password+totp'|'pin+totp'|'password+pin+totp';
export interface ExperienceLock {targetId:string;policy:ExperiencePolicy;duration:{mode:'surface'|'minutes'|'session';minutes:number};remaining:number;waitUntil:number;escalation:number;rung:'dish'|'sums'|'moles'|'clock';locked:boolean;unlockedUntil?:number;disclosure:string}
export interface ExperienceTicket {id:string;targetId:string;category:string;description:string;severity:string;status:string;createdAt:number;response?:string}
export interface ExperienceState {locks:ExperienceLock[];tickets:ExperienceTicket[];recovery:{directory:string;disclosure:string};available:boolean;historyWarning?:boolean;configurationHistory?:Array<{revision:number;timestamp:number;locks:Array<{targetId:string;policy:ExperiencePolicy;duration:ExperienceLock["duration"]}>}>}
export type ExperienceRequest = {action:string;[key:string]:unknown};
export type ExperienceReply = {ok:true;result:any}|{ok:false;code:string};
