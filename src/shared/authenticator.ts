export type AuthenticatorEntry = {id:string; issuer:string; account:string; group:string; icon?:string; algorithm:string; digits:number; period:number};
export type Pairing = {issuer:string; account:string; secret:string; algorithm:string; digits:number; period:number; pendingId:string; expires:number; qr:{size:number;data:number[]}};
export type AuthenticatorReply = {ok:boolean;code?:string;result?:any};
