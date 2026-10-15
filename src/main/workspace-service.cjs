'use strict';
const {randomUUID}=require('node:crypto');
const contract=require('./security/workspace-contract.cjs');
const {createWorkspaceStore}=require('./storage/workspace-store.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
const payload=state=>clone({plans:state.plans,preferences:state.preferences,onboardingCompleted:state.onboardingCompleted,onboarding:state.onboarding});
function createWorkspaceService(options){
 const store=createWorkspaceStore(options);
 const result=work=>{try{return {ok:true,...work()};}catch(error){return {ok:false,code:['INVALID_REQUEST','REVISION_CONFLICT','STORAGE_BUSY','NOT_FOUND','LIMIT_REACHED'].includes(error.code)?error.code:'STORAGE_UNAVAILABLE'};}};
 const reject=code=>{const error=new Error(code);error.code=code;throw error;};
 function mutate(input){return result(()=>{contract.request(input);const request=clone(input);const state=store.transact(request.expectedRevision,current=>{const timestamp=new Date().toISOString();switch(request.action){
 case 'plan.create':if(current.plans.length>=100)reject('LIMIT_REACHED');current.plans.push({id:randomUUID(),...request.plan,createdAt:timestamp,updatedAt:timestamp});break;
 case 'plan.update':{const plan=current.plans.find(p=>p.id===request.id);if(!plan)reject('NOT_FOUND');Object.assign(plan,request.changes,{updatedAt:timestamp});break;}
 case 'plan.delete':if(!current.plans.some(p=>p.id===request.id))reject('NOT_FOUND');current.plans=current.plans.filter(p=>p.id!==request.id);break;
 case 'preferences.update':current.preferences=request.preferences;break;
 case 'onboarding.update':current.onboarding=request.onboarding;break;
 case 'onboarding.complete':current.onboardingCompleted=true;break;
 case 'snapshot.create':if(current.snapshots.length>=20)reject('LIMIT_REACHED');current.snapshots.push({id:randomUUID(),name:request.name,createdAt:timestamp,payload:payload(current)});break;
 case 'snapshot.restore':{const snapshot=current.snapshots.find(s=>s.id===request.id);if(!snapshot)reject('NOT_FOUND');Object.assign(current,clone(snapshot.payload));break;}
 case 'document.import':{const document=contract.parseExport(request.document);Object.assign(current,payload(document));break;}
 default:reject('INVALID_REQUEST');
 }current.activity.push({id:randomUUID(),action:request.action,timestamp,revision:current.revision+1});current.activity=current.activity.slice(-100);return current;});return {state};});}
 return {activityPage:input=>result(()=>store.activityPage(input)),get:()=>result(()=>({state:store.read()})),mutate,exportDocument:()=>result(()=>{const state=store.read();return {state,document:JSON.stringify({format:'material-buildroot-workspace-export',version:1,...payload(state)},null,2)};})};
}
module.exports={createWorkspaceService};
