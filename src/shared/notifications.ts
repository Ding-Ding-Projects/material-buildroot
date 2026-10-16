export type NotificationReview = 'unread'|'read'|'dismissed'|'resolved';
export interface NotificationRecord {id:string;title:string;message:string;severity:'info'|'success'|'warning'|'error';timestamp:string;status:NotificationReview;sequence:number}
export interface ReleaseRecord {tag:string;title:string;publishedAt:string;body:string;source:string;url:string;html:string;unavailableResources:number}
export type NotificationRequest={action:'list';offset:number}|{action:'review';ids:string[];status:NotificationReview}|{action:'changelog'}|{action:'open';tag:string;id:string};
export type NotificationReply={ok:false;code:string}|{ok:true;result:{records:NotificationRecord[];total:number;next:number}|{entries:ReleaseRecord[];retrievedAt:string}|{completed:number}|{opened:boolean}};
