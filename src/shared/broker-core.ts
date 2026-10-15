import type {Language,OperationEvent,OperationReply} from './api';
export interface TrustedCaller {readonly principal:string;}
export type CoreFailureCode='INVALID_REQUEST'|'NOT_AUTHORIZED'|'NOT_IMPLEMENTED'|'OPERATION_CONFLICT'|'STALE_REVISION'|'STORAGE_UNAVAILABLE';
export interface CoreFailure {code:CoreFailureCode;}
export interface CoreLanguageSuccess {code:'OK';language:Language;revision:string;eventSequence:number;}
export type CoreReply=CoreLanguageSuccess|CoreFailure;
export interface CoreStoredEvent {sequence:number;operationId:string;kind:'settings.languageChanged';revision:string;timestamp:string;}
export interface CoreSettingsSuccess {code:'OK';language:Language;revision:string;}
export interface CoreEventsSuccess {code:'OK';events:CoreStoredEvent[];hasMore:boolean;nextSequence:number;}
export interface BrokerCore {
 execute(serialized:string|Uint8Array,caller:TrustedCaller):CoreReply;
 readSettings(caller:TrustedCaller,namespace:string,capability:string):CoreSettingsSuccess|CoreFailure;
 readEvents(caller:TrustedCaller,namespace:string,capability:string,afterSequence?:number):CoreEventsSuccess|CoreFailure;
}
export interface LanguageOperationResult {language:Language;eventSequence:number;}
export type LanguageOperationReply=OperationReply<LanguageOperationResult>;
export interface BrokerContract {
 toOperationReply(reply:CoreReply,operationId:string):LanguageOperationReply;
 toOperationEvent(event:CoreStoredEvent):OperationEvent;
}

export interface CapabilityAuthority {authorize(handle:string,scope:{principal:string;namespace:string;action:string}):boolean;}
export interface LanguageMutation {principal:string;namespace:string;operationId:string;digest:string;expectedRevision:string;language:Language;authorize:()=>boolean;}
export interface CoreSettingsStore {
 setLanguage(mutation:LanguageMutation):CoreReply;
 read(principal:string,namespace:string):{language:Language;revision:string};
 events(principal:string,namespace:string,afterSequence?:number):Omit<CoreEventsSuccess,'code'>;
}
