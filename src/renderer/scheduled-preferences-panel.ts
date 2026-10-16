import {localizedCopy} from './language-wording';
import {listAppearanceProfiles} from './appearance-schedule';
import {LitElement,html,css,nothing,type PropertyValues} from 'lit';
import '@material/web/checkbox/checkbox.js';
import '@material/web/switch/switch.js';
import '@material/web/iconbutton/icon-button.js';
import {materialIcon} from './material-icons';
import {captureOwnedStatus,displayOwnedStatus} from './owned-status';
import {validateScheduleDocument,SCHEDULE_LIMITS,type ScheduleDocument,type ScheduleRule} from '../shared/scheduled-settings.mjs';
import type {ScheduledPreferencesRequest,ScheduledPreferencesSnapshot,ScheduledHistoryPage,ScheduledSourceEntry,ScheduledSourceList,ScheduleDraftPage,ScheduleDraftRecord} from '../shared/scheduled-preferences';
const registry={'appearance.profile':(v:unknown)=>v===null||typeof v==='string'&&/^p[a-f0-9-]{36}$/.test(v),language:(v:unknown)=>['en','zh-HK','bilingual'].includes(v as string),'appearance.theme':(v:unknown)=>['system','light','dark'].includes(v as string)};
const empty=():ScheduleDocument=>({schemaVersion:1,revision:0,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',rules:[]});
const emptySource=()=>({id:'',label:'',origin:'',kind:'https' as 'https'|'home-assistant',privateAddresses:'',privateAddressConsent:false,retainCredential:false,authorityConsent:false});
export class ScheduledPreferencesPanel extends LitElement{
 static properties={language:{type:String},restricted:{type:Boolean},snapshot:{attribute:false},baseLanguage:{type:String},baseTheme:{type:String},revision:{state:true}};
 language='en';restricted=true;snapshot:ScheduledPreferencesSnapshot|null=null;baseLanguage='bilingual';baseTheme='system';revision=0;
 private document=empty();
 private baseline=JSON.stringify(this.document);
 private expectedRevision:number|null=null;
 private loaded=false;
 private pending=false;
 private refreshing=false;
 private uncertain=false;
 private conflict=false;
 private selected='';
 private feedback='';
 private validation='';
 private history?:ScheduledHistoryPage;
 private confirmAction?:()=>void;
 private confirmResolve?:(ok:boolean)=>void;
 private leavePromise?:Promise<boolean>;
 private confirmOpener?:HTMLElement;
 private sources:ScheduledSourceList|null=null;
 private sourceDraft=emptySource();
 private sourceBaseline=JSON.stringify(this.sourceDraft);
 private sourceExpectedRevision:string|null=null;
 private sourceBusy=false;
 private sourceConflict=false;
 private sourceUncertain=false;
 private sourceFeedback='';
 private sourceValidation='';
 private credentialDraft=false;
 private removeSource:ScheduledSourceEntry|null=null;
 private removeSourceRevision:string|null=null;
 private draftHistory?:ScheduleDraftPage;
 private discardUncertain=false;
 static styles=css`.rule,.record,.status{transition:background-color 140ms ease,border-color 140ms ease}.record,.status{animation:state-enter 120ms ease-out}@keyframes state-enter{from{opacity:.6}to{opacity:1}}@media(prefers-reduced-motion:reduce){.rule,.record,.status{transition:none;animation:none}}:host{display:block;color:inherit;font:inherit;container-type:inline-size;min-width:0}.stack{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}h2{font-size:20px;margin:0}h3{font-size:16px;margin:0}p{margin:4px 0;overflow-wrap:anywhere}.layout{display:grid;grid-template-columns:minmax(190px,1fr) minmax(0,2fr);gap:16px}.rules{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;align-content:start;gap:6px}.rule{padding:8px;border:1px solid var(--md-sys-color-outline-variant)}.rule.selected{background:var(--md-sys-color-secondary-container)}.rule-title{max-width:100%;overflow-wrap:anywhere}.rule-title md-text-button{max-width:100%;height:auto;min-height:48px}.editor{min-width:0;border-left:1px solid var(--md-sys-color-outline-variant);padding-left:16px}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}md-outlined-text-field,md-outlined-select{width:100%;min-width:0}md-outlined-button,md-filled-button,md-text-button,md-icon-button{min-height:48px}md-icon-button{min-width:48px}.days label{display:flex;align-items:center;min-height:48px}.status{padding:10px;background:var(--md-sys-color-surface-container-low);border:1px solid var(--md-sys-color-outline-variant)}.timeline{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px}.day{padding:6px 2px;text-align:center;background:var(--md-sys-color-surface-container-high);font-size:12px}.day.active{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}.status span,.status strong{overflow-wrap:anywhere;min-width:0}.status md-text-button,.status md-outlined-button{max-width:100%;height:auto;min-height:48px;white-space:normal;overflow-wrap:anywhere}.history{display:grid;gap:8px}.error{color:var(--md-sys-color-error)}md-dialog{max-width:min(560px,94vw)}md-dialog>[slot="actions"]{flex-wrap:wrap}md-dialog>[slot="actions"]>*{min-width:0;max-width:100%;height:auto;white-space:normal;text-wrap:wrap;overflow-wrap:anywhere}@container(max-width:800px){.layout{grid-template-columns:1fr}.editor{border-left:0;border-top:1px solid var(--md-sys-color-outline-variant);padding:12px 0 0}}@container(max-width:600px){.fields{grid-template-columns:1fr}}`;
 private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
 private get dirty(){return JSON.stringify(this.document)!==this.baseline;}
 private get sourceDirty(){return JSON.stringify(this.sourceDraft)!==this.sourceBaseline||this.credentialDraft;}
 get hasPendingDraft(){return this.dirty||this.pending||this.sourceDirty||this.sourceBusy;}
 private get hiddenRules(){return this.restricted&&this.document.rules.some(r=>'language' in r.values);}
 private get protectedChanges(){if(!this.restricted)return false;const original=JSON.parse(this.baseline) as ScheduleDocument;return JSON.stringify(original.rules.filter(r=>'language' in r.values))!==JSON.stringify(this.document.rules.filter(r=>'language' in r.values))||original.timeZone!==this.document.timeZone&&this.hiddenRules;}
 private get rule(){return this.document.rules.find(r=>r.id===this.selected&&r.source.type==='local'&&(!this.restricted||!('language' in r.values)));}
 private get hasExternal(){return this.document.rules.some(r=>r.source.type!=='local');}
 private get fixedOrder(){return this.hiddenRules||this.hasExternal;}
 private get canEdit(){return this.loaded&&!this.pending&&!this.uncertain&&this.snapshot?.available===true;}
 private change(){this.validation='';this.revision++;}
 private beforeUnload=(e:BeforeUnloadEvent)=>{if(this.hasPendingDraft){e.preventDefault();e.returnValue='';}};
 connectedCallback(){super.connectedCallback();window.addEventListener('beforeunload',this.beforeUnload);void this.read();}
 disconnectedCallback(){window.removeEventListener('beforeunload',this.beforeUnload);this.clearSourceCredential();this.confirmResolve?.(false);super.disconnectedCallback();}
 protected updated(changes:PropertyValues){if(changes.has('restricted')&&this.restricted){this.clearSourceCredential();this.removeSource=null;}if(changes.has('snapshot')&&this.loaded&&this.snapshot?.available&&!this.pending&&this.snapshot.revision!==this.expectedRevision&&!this.conflict){this.conflict=true;this.revision++;}}
 private async call(request:ScheduledPreferencesRequest){const reply=await window.studio?.scheduledPreferences?.(request);if(!reply?.ok)throw Error(reply?.code||'UNAVAILABLE');return reply.result;}
 private fail(e:unknown){const code=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'UNAVAILABLE';this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Schedule operation not confirmed. Your draft is retained. Read the stored revision before retrying.','未能確認排程操作，草稿已保留。重試前請讀取已儲存版本。')+' '+code);return code;}
 private publish(snapshot:ScheduledPreferencesSnapshot|null){this.dispatchEvent(new CustomEvent('scheduled-snapshot',{detail:snapshot,bubbles:true,composed:true}));}
 private async read(){if(this.pending)return;this.pending=true;this.revision++;try{const stored=await this.call({action:'read'}) as ScheduleDocument|null;if(this.dirty){this.conflict=(stored?.revision??null)!==this.expectedRevision;this.uncertain=false;this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Stored revision inspected. Your unsaved draft was retained; reload and discard it explicitly to use the stored version.','已檢視儲存版本並保留未儲存草稿，要使用已儲存版本請明確重新載入並放棄草稿。'));}else{this.document=stored??empty();this.expectedRevision=stored?.revision??null;this.baseline=JSON.stringify(this.document);this.loaded=true;this.conflict=false;this.uncertain=false;this.selected=this.document.rules.find(r=>r.source.type==='local'&&(!this.restricted||!('language'in r.values)))?.id||'';}const snapshot=await this.call({action:'status'}) as ScheduledPreferencesSnapshot;this.publish(snapshot);}catch(e){this.fail(e);}finally{this.pending=false;this.revision++;}}
 private async reload(){if(this.dirty){this.confirmAction=()=>{this.document=JSON.parse(this.baseline);void this.read();};await this.updateComplete;(this.shadowRoot?.querySelector('#schedule-leave-dialog') as any)?.show();}else await this.read();}
 private options(){return {registry};}
 private validate(){try{validateScheduleDocument({...this.document,rules:this.document.rules.filter(r=>r.source.type==='local')},this.options());this.validation='';return true;}catch(e){this.validation=(e as {code?:string}).code||'INVALID_RULE';return false;}}
 async save(){
  if(!this.canEdit||this.conflict||this.protectedChanges||!this.validate()){this.revision++;return false;}
  this.pending=true;this.revision++;
  try{
   const saved=await this.call({action:'replace',document:structuredClone(this.document),expectedRevision:this.expectedRevision}) as ScheduleDocument;
   this.document=saved;this.expectedRevision=saved.revision;this.baseline=JSON.stringify(saved);this.conflict=false;this.uncertain=false;
   this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Schedule saved. Base preferences were not changed.','排程已儲存，基礎偏好未變更。'));
   // A failed status read does not undo a confirmed durable save.
   try{this.publish(await this.call({action:'status'}) as ScheduledPreferencesSnapshot);}catch{this.publish(null);this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Schedule saved, but effective values are unavailable. Refresh to check them.','排程已儲存，但未能取得有效值，請重新整理查看。'));}
   return true;
  }catch(e){const code=this.fail(e);if(code==='STALE_REVISION')this.conflict=true;else this.uncertain=true;return false;}
  finally{this.pending=false;this.revision++;}
 }
 async confirmLeave():Promise<boolean>{
  if(this.pending||this.sourceBusy)return false;if(!this.dirty&&!this.sourceDirty)return true;if(this.leavePromise)return this.leavePromise;
  this.confirmAction=undefined;this.confirmOpener=this.shadowRoot?.activeElement as HTMLElement|undefined;
  this.leavePromise=new Promise<boolean>(resolve=>this.confirmResolve=resolve);
  await this.updateComplete;(this.shadowRoot?.querySelector('#schedule-leave-dialog') as any)?.show();return this.leavePromise;
 }
 private closeConfirm(ok:boolean){(this.shadowRoot?.querySelector('#schedule-leave-dialog') as any)?.close();const resolve=this.confirmResolve;this.confirmResolve=undefined;this.leavePromise=undefined;this.confirmAction=undefined;resolve?.(ok);if(!ok)this.confirmOpener?.focus();}
 private async discard(){
  if(this.pending||this.sourceBusy||this.discardUncertain)return;
  if(this.dirty){
   if(this.restricted){this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Discard history is available only with shared restrictions inactive. The draft was retained.','共用限制關閉之後先可以使用放棄歷史，草稿已保留。'));this.revision++;return;}
   const original=JSON.parse(this.baseline) as ScheduleDocument;
   if(JSON.stringify(this.document.rules.filter(rule=>rule.source.type!=='local'))!==JSON.stringify(original.rules.filter(rule=>rule.source.type!=='local'))){this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('External rule edits cannot be stored in local draft history. The complete draft was retained.','外部規則變更無法存入本機草稿歷史，完整草稿已保留。'));this.revision++;return;}
   const localDraft={...structuredClone(this.document),rules:structuredClone(this.document.rules.filter(rule=>rule.source.type==='local'))};
   this.pending=true;this.revision++;
   try{await this.call({action:'draft.discard',document:localDraft});}
   catch(e){this.fail(e);this.discardUncertain=true;this.pending=false;this.revision++;return;}
  }
  this.document=JSON.parse(this.baseline);this.validation='';if(!this.confirmAction)this.resetSourceDraft();this.revision++;
  const action=this.confirmAction;this.pending=false;this.closeConfirm(true);if(action)action();
 }
 private async readDraftHistory(more=false){
  if(this.restricted||this.pending)return;this.pending=true;this.revision++;
  try{const page=await this.call({action:'draft.list',after:more?this.draftHistory?.next??0:0,limit:20}) as ScheduleDraftPage;if(!this.restricted){this.draftHistory={...page,records:more?[...(this.draftHistory?.records??[]),...page.records]:page.records};this.discardUncertain=false;}}
  catch(e){this.fail(e);}
  finally{this.pending=false;this.revision++;}
 }
 private async restoreDraft(sequence:number,active=false){
  if(this.restricted||this.pending||this.sourceBusy||this.dirty||this.sourceDirty)return;
  this.pending=true;this.revision++;
  try{
   const current=await this.call({action:'read'}) as ScheduleDocument|null;
   const record=await this.call(active?{action:'history.read',revision:sequence}:{action:'draft.read',sequence}) as {document:ScheduleDocument}|null;
   if(this.restricted)return;
   if(!record){this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('That historical local snapshot is unavailable. The editor was not changed.','未能取得該已放棄草稿，編輯器維持不變。'));return;}
   const externalIds=new Set((current?.rules??[]).filter(rule=>rule.source.type!=='local').map(rule=>rule.id));
   if(record.document.rules.some(rule=>rule.source.type!=='local'||externalIds.has(rule.id))){this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Restoration cannot merge this local draft: a rule identifier conflicts with a current external rule, or the stored draft is not local-only. The editor was not changed.','未能合併此本機草稿：規則識別碼同目前外部規則衝突，或儲存草稿唔係只含本機規則。編輯器維持不變。'));return;}
   const locals=structuredClone(record.document.rules),rules:ScheduleRule[]=[];let localIndex=0;
   for(const rule of current?.rules??[]){if(rule.source.type!=='local')rules.push(structuredClone(rule));else if(localIndex<locals.length)rules.push(locals[localIndex++]);}
   rules.push(...locals.slice(localIndex));
   const restored={...structuredClone(record.document),rules};
   if(rules.length>SCHEDULE_LIMITS.rules||new TextEncoder().encode(JSON.stringify(restored)).byteLength>SCHEDULE_LIMITS.documentBytes){this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('The combined current external rules and restored local draft exceed the document limit. The editor was not changed.','目前外部規則加上還原本機草稿超出文件限制，編輯器維持不變。'));return;}
   const snapshot=await this.call({action:'status'}) as ScheduledPreferencesSnapshot;
   if(this.restricted)return;
   this.expectedRevision=current?.revision??null;this.baseline=JSON.stringify(current??empty());this.document=restored;this.selected=this.document.rules.find(rule=>rule.source.type==='local')?.id??'';this.loaded=true;this.uncertain=false;this.discardUncertain=false;this.conflict=snapshot.available&&snapshot.revision!==this.expectedRevision;
   this.publish(snapshot);this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('Historical local rules restored to the editor only. Review them, then use Save schedule to apply a new revision.','已放棄草稿只還原到編輯器，請先檢視，再用儲存排程按目前儲存版本套用。'));
  }catch(e){this.fail(e);}
  finally{this.pending=false;this.revision++;}
 }
 private renderDraftHistory(){
  if(this.restricted)return nothing;
  return html`<section class="history" id="discarded-draft-history"><h3>${this.l('Discarded local drafts','已放棄本機草稿',true)}</h3><p>${this.l('Discard stores only the local rules, their desired order, timezone and original revision in append-only history. Unchanged external rules are excluded and remain in the current saved document; unsaved external edits block discard. Invalid local drafts and a full history store stay in the editor. Source forms and credentials are excluded. Restore replaces local rules in the editor, fills current local slots in recorded order and appends remaining locals, keeping current external records and their relative order. The restored timezone applies to the whole document only after an explicit Save.','放棄只會將本機規則、所需次序、時區同原始版本存入只增不減歷史。未變更外部規則不會加入，仍保留喺目前儲存文件；未儲存外部變更會阻止放棄。無效本機草稿或歷史已滿時會保留編輯資料。來源表格同憑證不會加入。還原會喺編輯器取代本機規則，按記錄次序填入目前本機位置，再附加剩餘本機規則，保留目前外部記錄同彼此次序。明確儲存之後，還原時區先會套用到整份文件。',true)}</p><md-outlined-button ?disabled=${this.pending} @click=${()=>this.readDraftHistory()}>${materialIcon('history','icon')}${this.l('Read discarded drafts','讀取已放棄草稿',true)}</md-outlined-button>${this.discardUncertain?html`<p role="status">${this.l('Discard was not confirmed and the draft remains. Close the decision dialog and inspect discarded-draft history before retrying.','未能確認放棄，草稿仍保留。請關閉決定對話框，檢視已放棄草稿歷史後再重試。',true)}</p>`:nothing}${this.dirty||this.sourceDirty?html`<p>${this.l('Save or explicitly discard pending drafts before restoring another draft.','還原其他草稿前，請儲存或明確放棄待儲存草稿。',true)}</p>`:nothing}<md-outlined-button ?disabled=${this.pending||!this.draftHistory} @click=${()=>this.exportHistoryPage(true)}>${this.l('Export loaded draft page','匯出已載入草稿頁',true)}</md-outlined-button>${this.draftHistory?.records.map(record=>html`<section class="status"><p>${this.l('Draft record','草稿記錄',true)} ${record.sequence} · ${new Date(record.discardedAt).toISOString()}</p><md-outlined-button ?disabled=${this.pending||this.sourceBusy||this.dirty||this.sourceDirty} @click=${()=>this.restoreDraft(record.sequence)}>${this.l('Restore to editor','還原到編輯器',true)} ${record.sequence}</md-outlined-button></section>`)}${this.draftHistory&&!this.draftHistory.records.length?html`<p>${this.l('No discarded drafts are recorded.','冇已放棄草稿記錄。',true)}</p>`:nothing}${this.draftHistory?.hasMore?html`<md-text-button ?disabled=${this.pending} @click=${()=>this.readDraftHistory(true)}>${this.l('More discarded drafts','更多已放棄草稿',true)}</md-text-button>`:nothing}</section>`;
 }
 private async refresh(){if(this.refreshing)return;this.refreshing=true;this.revision++;try{this.publish(await this.call({action:'refresh'}) as ScheduledPreferencesSnapshot);}catch(e){this.fail(e);this.publish(null);}finally{this.refreshing=false;this.revision++;}}
 private async cancel(){try{this.publish(await this.call({action:'cancel'}) as ScheduledPreferencesSnapshot);this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('External requests cancelled for the host pause interval. Local rules remain active; disable and save a rule to stop its override.','已喺主機暫停期間取消外部要求，本機規則仍然有效；停用並儲存規則先會停止覆寫。'));}catch(e){this.fail(e);}this.revision++;}
 private async exportHistoryPage(drafts=false){
  if(this.restricted||this.pending)return;this.pending=true;this.revision++;
  try{
   const records=[];
   const page=drafts?this.draftHistory?.records.slice(-20):this.history?.records.slice(-25);
   if(!page)throw new Error("Read history first");
   for(const record of page){
    const item=drafts?await this.call({action:'draft.read',sequence:record.sequence}):await this.call({action:'history.read',revision:(record as ScheduledHistoryPage['records'][number]).receipt.toRevision});
    if(this.restricted)return;
    records.push({...record,snapshot:item});
   }
   const document=JSON.stringify({format:'material-buildroot-schedule-history-page',version:1,scope:drafts?'loaded-discarded-drafts':'loaded-active-history',records,exclusions:['credentials','external rules and enrollments','personal wording and source metadata'],encoding:'UTF-8',lineEndings:'LF'},null,2);
   const url=URL.createObjectURL(new Blob([document],{type:'application/json'}));const link=window.document.createElement('a');link.href=url;link.download=drafts?'schedule-draft-history-page.json':'schedule-active-history-page.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){this.fail(e);}finally{this.pending=false;this.revision++;}
 }
 private async readHistory(more=false){if(this.pending)return;this.pending=true;this.revision++;try{const page=await this.call({action:'history',after:more?this.history?.next??0:0,limit:25}) as ScheduledHistoryPage;this.history={...page,records:more?[...(this.history?.records||[]),...page.records]:page.records};}catch(e){this.fail(e);}finally{this.pending=false;this.revision++;}}
 private add(){if(!this.canEdit||this.document.rules.length>=256)return;const r:ScheduleRule={id:crypto.randomUUID(),label:this.l('New rule','新規則',true),enabled:true,priority:0,startDate:null,endDate:null,startTime:'09:00',endTime:'17:00',days:{type:'everyday'},values:{'appearance.theme':'dark'},source:{type:'local'}};this.document.rules.push(r);this.selected=r.id;this.change();}
 private move(id:string,direction:number){const index=this.document.rules.findIndex(r=>r.id===id),next=index+direction;if(next<0||next>=this.document.rules.length)return;[this.document.rules[index],this.document.rules[next]]=[this.document.rules[next],this.document.rules[index]];this.change();}
 private field(label:string,zh:string,value:string,set:(value:string)=>void,type='text'){return html`<md-outlined-text-field .label=${this.l(label,zh)} .value=${value} type=${type} ?disabled=${!this.canEdit} @input=${(e:Event)=>{set((e.target as HTMLInputElement).value);this.change();}}></md-outlined-text-field>`;}
 private select(label:string,zh:string,value:string,choices:[string,string][],set:(v:string)=>void){return html`<md-outlined-select .label=${this.l(label,zh)} .value=${value} .displayText=${choices.find(([v])=>v===value)?.[1]||value} ?disabled=${!this.canEdit} @change=${(e:Event)=>{set((e.target as HTMLSelectElement).value);this.change();}}>${choices.map(([v,text])=>html`<md-select-option .value=${v} ?selected=${v===value}><div slot="headline">${text}</div></md-select-option>`)}</md-outlined-select>`;}
 private clearSourceCredential(){
  const input=this.shadowRoot?.querySelector('#source-credential') as (HTMLElement&{value:string})|null;
  if(input)input.value='';this.credentialDraft=false;
 }
 private sourceMessage(en:string,zh:string){this.sourceFeedback=captureOwnedStatus(this,'sourceFeedback',this.l.bind(this),l=>l(en,zh));}
 private sourceFailure(error:unknown){
  const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'UNAVAILABLE';
  this.sourceMessage('Source operation was not confirmed. Read stored sources before retrying. A submitted credential was cleared from this form.','未能確認來源操作，重試前請讀取已儲存來源。已提交憑證已從表格清除。');
  this.sourceValidation=code;return code;
 }
 private get canEditSource(){return !this.restricted&&!!this.sources&&!this.sourceBusy&&!this.sourceUncertain&&!this.sourceConflict;}
 private get canRetainCredential(){const previous=this.sources?.entries.find(e=>e.id===this.sourceDraft.id);return this.sourceDraft.kind==='home-assistant'&&previous?.kind==='home-assistant'&&previous.credentialConfigured&&previous.origin===this.sourceDraft.origin;}
 private resetSourceDraft(){this.clearSourceCredential();this.sourceDraft=JSON.parse(this.sourceBaseline);this.sourceValidation='';this.revision++;}
 private editSource(entry?:ScheduledSourceEntry){
  if(this.restricted||this.sourceBusy||this.sourceDirty||!this.sources)return;
  this.clearSourceCredential();
  this.sourceDraft=entry?{id:entry.id,label:entry.label,origin:entry.origin,kind:entry.kind,privateAddresses:entry.privateAddresses.join('\n'),privateAddressConsent:false,retainCredential:entry.kind==='home-assistant'&&entry.credentialConfigured,authorityConsent:false}:emptySource();
  this.sourceBaseline=JSON.stringify(this.sourceDraft);this.sourceExpectedRevision=this.sources.revision;this.sourceConflict=false;this.sourceUncertain=false;this.sourceValidation='';this.revision++;
 }
 private sourceChanged(identity=false){
  if(identity){this.clearSourceCredential();this.sourceDraft.authorityConsent=false;if(!this.canRetainCredential)this.sourceDraft.retainCredential=false;if(this.sourceDraft.kind==='https'){this.sourceDraft.privateAddresses='';this.sourceDraft.privateAddressConsent=false;}}
  this.sourceValidation='';this.revision++;
 }
 private async readSources(){
  if(this.restricted||this.sourceBusy)return;this.removeSource=null;this.removeSourceRevision=null;(this.shadowRoot?.querySelector('#source-remove-dialog') as any)?.close();this.sourceBusy=true;this.revision++;
  try{
   const result=await this.call({action:'enrollment.list'}) as ScheduledSourceList;
   if(this.restricted)return;
   const dirty=this.sourceDirty;this.sources=result;this.sourceUncertain=false;
   if(dirty){this.sourceConflict=result.revision!==this.sourceExpectedRevision;this.sourceMessage('Stored sources inspected. The unsaved source draft was retained. Discard it explicitly before selecting another source.','已檢視儲存來源並保留未儲存草稿，選擇其他來源前請明確放棄草稿。');}
   else{this.sourceBusy=false;this.editSource(result.entries.find(e=>e.id===this.sourceDraft.id));this.sourceMessage('Stored source enrollments loaded. This is not a provider connection or credential health check.','已載入來源登記，呢個動作唔係供應方連線或憑證健康檢查。');}
  }catch(e){this.sourceFailure(e);this.sourceUncertain=true;}
  finally{this.sourceBusy=false;this.revision++;}
 }
 private validateSource(){
  const draft=this.sourceDraft;
  try{
   if(!draft.label.trim()||[...draft.label].length>96||/[\u0000-\u001f\u007f]/u.test(draft.label))throw Error('INVALID_SOURCE_LABEL');
   if(draft.origin.length>2048||/[\u0000-\u0020\u007f]/u.test(draft.origin))throw Error('INVALID_SOURCE_ORIGIN');
   const url=new URL(draft.origin);
   if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||draft.origin!==url.origin&&draft.origin!==url.origin+'/')throw Error('INVALID_SOURCE_ORIGIN');
   const host=url.hostname.replace(/^\[|\]$/g,'');
   if(host==='localhost'||/^(127\.|169\.254\.|0\.)/.test(host)||host==='::1'||/^fe[89ab][0-9a-f]:/i.test(host)||host.includes('::ffff:'))throw Error('INVALID_SOURCE_ORIGIN');
   const addresses=draft.kind==='home-assistant'?draft.privateAddresses.split(/[\s,]+/).filter(Boolean).map(value=>{
    if(value.includes('%'))throw Error('INVALID_PRIVATE_ADDRESSES');
    if(value.includes(':')){const normalized=new URL('https://['+value+']/').hostname.slice(1,-1);if(!/^f[cd][0-9a-f]{2}:/i.test(normalized))throw Error('INVALID_PRIVATE_ADDRESSES');return normalized;}
    const parts=value.split('.');if(parts.length!==4||parts.some(p=>!/^\d{1,3}$/.test(p)||Number(p)>255||String(Number(p))!==p))throw Error('INVALID_PRIVATE_ADDRESSES');
    const [a,b]=parts.map(Number);if(!(a===10||a===172&&b>=16&&b<=31||a===192&&b===168))throw Error('INVALID_PRIVATE_ADDRESSES');return value;
   }):[];
   if(addresses.length>16||new Set(addresses).size!==addresses.length)throw Error('INVALID_PRIVATE_ADDRESSES');
   if(addresses.length&&!draft.privateAddressConsent)throw Error('PRIVATE_ADDRESS_CONSENT_REQUIRED');
   if(this.sources?.entries.some(e=>e.id!==draft.id&&e.origin===url.origin))throw Error('DUPLICATE_SOURCE_ORIGIN');
   if(!draft.id&&(this.sources?.entries.length??0)>=32)throw Error('SCHEDULE_ENROLLMENTS_LIMIT');
   if(!draft.authorityConsent)throw Error('SOURCE_AUTHORITY_CONSENT_REQUIRED');
   return {origin:url.origin,addresses};
  }catch(e){this.sourceValidation=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'INVALID_SOURCE_ORIGIN';this.revision++;return null;}
 }
 private async saveSource(){
  if(!this.canEditSource||!this.sourceDirty)return;const checked=this.validateSource();if(!checked)return;
  const draft=this.sourceDraft;
  const request:Extract<ScheduledPreferencesRequest,{action:'enrollment.save'}>={action:'enrollment.save',expectedRevision:this.sourceExpectedRevision,...(draft.id?{id:draft.id}:{}),label:draft.label,origin:checked.origin,kind:draft.kind,privateAddresses:checked.addresses,privateAddressConsent:draft.privateAddressConsent};
  if(draft.kind==='home-assistant'){
   if(draft.retainCredential&&this.canRetainCredential)request.retainCredential=true;
   else{
    const input=this.shadowRoot?.querySelector('#source-credential') as (HTMLElement&{value:string})|null;
    const value=input?.value??'';
    if(!value||value.length>8192||/[\u0000-\u0020\u007f]/u.test(value)){this.sourceValidation='SOURCE_CREDENTIAL_REQUIRED';this.revision++;return;}
    request.token=value;
   }
  }
  // The credential exists only in the password control and this one in-flight request.
  this.clearSourceCredential();this.sourceBusy=true;this.revision++;
  try{
   let saved:ScheduledSourceList;
   try{saved=await this.call(request) as ScheduledSourceList;}finally{delete request.token;}
   this.sources=saved;this.sourceExpectedRevision=saved.revision;this.sourceBaseline=JSON.stringify(this.sourceDraft);
   if(!this.restricted){this.sourceBusy=false;this.editSource(saved.entries.find(e=>e.origin===checked.origin));this.sourceBusy=true;}
   this.sourceMessage('Source enrollment saved. Reading stored metadata to confirm it. No provider health check has run.','來源登記已儲存，正讀取儲存資料確認，尚未執行供應方健康檢查。');
   try{
    const observed=await this.call({action:'enrollment.list'}) as ScheduledSourceList;
    this.sources=observed;
    if(observed.revision!==saved.revision||JSON.stringify(observed.entries)!==JSON.stringify(saved.entries)){this.sourceConflict=true;this.sourceMessage('Enrollment saved, but another writer changed the stored sources before readback. Read them again before editing.','登記已儲存，但讀回前其他寫入者已變更來源，編輯前請重新讀取。');}
    else this.sourceMessage('Enrollment saved and stored metadata confirmed. Provider reachability and credential validity are still unverified.','登記已儲存並確認儲存資料，供應方能否連接及憑證是否有效仍未驗證。');
   }catch(e){this.sourceUncertain=true;this.sourceMessage('Enrollment save was confirmed, but stored metadata could not be read back. Read stored sources before another change.','已確認登記儲存，但未能讀回儲存資料，再變更前請讀取儲存來源。');}
  }catch(e){const code=this.sourceFailure(e);this.sourceConflict=code==='STALE_REVISION';this.sourceUncertain=!this.sourceConflict;}
  finally{delete request.token;this.clearSourceCredential();this.sourceBusy=false;this.revision++;}
 }
 private async askRemoveSource(entry:ScheduledSourceEntry){
  if(!this.canEditSource||this.sourceDirty)return;const current=this.sources!.entries.find(source=>source.id===entry.id);if(!current)return;this.removeSource=current;this.removeSourceRevision=this.sources!.revision;this.revision++;await this.updateComplete;(this.shadowRoot?.querySelector('#source-remove-dialog') as any)?.show();
 }
 private async confirmRemoveSource(){
  if(!this.canEditSource||this.sourceDirty||!this.removeSource||this.removeSourceRevision!==this.sources?.revision)return;
  const id=this.removeSource.id,expectedRevision=this.removeSourceRevision;this.sourceBusy=true;this.revision++;
  try{
   const saved=await this.call({action:'enrollment.remove',expectedRevision,id}) as ScheduledSourceList;
   this.sources=saved;this.sourceExpectedRevision=saved.revision;this.sourceDraft=emptySource();this.sourceBaseline=JSON.stringify(this.sourceDraft);this.clearSourceCredential();
   (this.shadowRoot?.querySelector('#source-remove-dialog') as any)?.close();this.removeSource=null;
   try{const observed=await this.call({action:'enrollment.list'}) as ScheduledSourceList;this.sources=observed;this.sourceConflict=observed.revision!==saved.revision||JSON.stringify(observed.entries)!==JSON.stringify(saved.entries);this.sourceMessage(observed.entries.some(e=>e.id===id)?'Removal was followed by another source change. Read stored sources before continuing.':'Enrollment removal confirmed by readback. Saved schedule rules and protected credential storage were not deleted.',observed.entries.some(e=>e.id===id)?'移除之後來源再有變更，繼續之前請讀取儲存來源。':'已讀回確認登記移除，已儲存排程規則同受保護憑證儲存並未刪除。');}
   catch{this.sourceUncertain=true;this.sourceMessage('Enrollment removal was confirmed, but readback is unavailable. Read stored sources before another change.','已確認登記移除，但未能讀回，再變更前請讀取儲存來源。');}
  }catch(e){const code=this.sourceFailure(e);this.sourceConflict=code==='STALE_REVISION';this.sourceUncertain=!this.sourceConflict;}
  finally{this.removeSource=null;this.removeSourceRevision=null;(this.shadowRoot?.querySelector('#source-remove-dialog') as any)?.close();this.sourceBusy=false;this.revision++;}
 }
 private sourceField(en:string,zh:string,value:string,change:(value:string)=>void,multiline=false){return html`<md-outlined-text-field .label=${this.l(en,zh)} .value=${value} type=${multiline?'textarea':'text'} ?disabled=${!this.canEditSource} @input=${(event:Event)=>{change((event.target as HTMLInputElement).value);this.sourceChanged();}}></md-outlined-text-field>`;}
 private renderSources(){
  if(this.restricted)return html`<section class="stack"><h3>External source enrollment</h3><p>Source enrollment controls are unavailable while shared preference restrictions apply. Stored enrollments remain unchanged.</p></section>`;
  const draft=this.sourceDraft;
  return html`<section class="stack" aria-labelledby="source-enrollment-heading">
   <h3 id="source-enrollment-heading">${this.l('External source enrollment','外部來源登記',true)}</h3>
   <p>${this.l('Enroll an exact HTTPS origin before an external source may be used. Enrollment can make existing enabled schedules for that origin start applying external values on a later refresh. It does not change their saved enabled flags or prove provider health. Existing external rules remain read-only in this editor.','使用外部來源前，先登記確切 HTTPS 來源。登記後，此來源現有已啟用排程可能喺之後更新時開始套用外部值；唔會改變已儲存啟用標記，亦唔代表供應方健康檢查通過。此編輯器現有外部規則仍只供檢視。',true)}</p>
   <md-outlined-button ?disabled=${this.sourceBusy} @click=${this.readSources}>${materialIcon('refresh','icon')}${this.l('Read stored sources','讀取儲存來源',true)}</md-outlined-button>
   ${!this.sources?html`<p>${this.l('Read stored sources to load available enrollments and enable editing. Missing protected storage remains unavailable.','請讀取儲存來源以載入登記並啟用編輯，受保護儲存不可用時會維持不可用狀態。',true)}</p>`:html`
   <p>${this.l('Stored enrollments','已儲存登記',true)}: ${this.sources.entries.length} / 32</p>
   ${this.sources.entries.map(entry=>html`<section class="status stack"><strong>${entry.label}</strong><span>${entry.origin}</span><span>${entry.kind==='https'?'HTTPS API':'Home Assistant'}</span><p>${entry.credentialConfigured?this.l('Protected credential reference configured; validity not checked.','已設定受保護憑證參照，尚未檢查有效性。',true):this.l('No credential is stored for this source kind.','此來源類型唔儲存憑證。',true)}</p><div class="row"><md-text-button ?disabled=${!this.canEditSource||this.sourceDirty} @click=${()=>this.editSource(entry)}>${this.l('Edit source','編輯來源',true)} ${entry.label}</md-text-button><md-outlined-button ?disabled=${!this.canEditSource||this.sourceDirty} @click=${()=>this.askRemoveSource(entry)}>${this.l('Remove enrollment','移除登記',true)} ${entry.label}</md-outlined-button></div></section>`)}
   <md-outlined-button ?disabled=${!this.canEditSource||this.sourceDirty||this.sources.entries.length>=32} @click=${()=>this.editSource()}>${materialIcon('add','icon')}${this.l('New source enrollment','新增來源登記',true)}</md-outlined-button>
   ${this.sourceDirty?html`<p>${this.l('An unsaved source draft is open. Save or explicitly discard it before selecting another source or removing an enrollment.','有未儲存來源草稿，選擇其他來源或移除登記前，請儲存或明確放棄草稿。',true)}</p>`:nothing}
   ${this.sourceConflict?html`<p role="status">${this.l('Stored source revision changed. Discard the draft and read stored sources before saving.','儲存來源版本已變更，儲存前請放棄草稿並讀取儲存來源。',true)}</p>`:nothing}
   ${this.sourceUncertain?html`<p role="status">${this.l('Source state is unconfirmed. Read stored sources before another mutation.','來源狀態未能確認，再變更前請讀取儲存來源。',true)}</p>`:nothing}
   <div class="fields">
    ${this.sourceField('Source label','來源標籤',draft.label,value=>draft.label=value)}
    <md-outlined-select .label=${this.l('Source kind','來源類型',true)} .value=${draft.kind} .displayText=${draft.kind==='https'?'HTTPS API':'Home Assistant'} ?disabled=${!this.canEditSource} @change=${(event:Event)=>{draft.kind=(event.target as HTMLSelectElement).value as typeof draft.kind;this.sourceChanged(true);}}><md-select-option value="https" ?selected=${draft.kind==='https'}><div slot="headline">HTTPS API</div></md-select-option><md-select-option value="home-assistant" ?selected=${draft.kind==='home-assistant'}><div slot="headline">Home Assistant</div></md-select-option></md-outlined-select>
    <md-outlined-text-field .label=${this.l('HTTPS origin','HTTPS 來源',true)} .value=${draft.origin} ?disabled=${!this.canEditSource} supporting-text=${this.l('HTTPS scheme and host only, with an optional port. No path, query, fragment or embedded credentials.','只限 HTTPS 協定同主機，可選連接埠，唔接受路徑、查詢、片段或內嵌憑證。',true)} @input=${(event:Event)=>{draft.origin=(event.target as HTMLInputElement).value;this.sourceChanged(true);}}></md-outlined-text-field>
   </div>
   ${draft.kind==='home-assistant'?html`<div class="stack">
    ${this.sourceField('Allowed private addresses (optional)','允許私人地址（可選）',draft.privateAddresses,value=>{draft.privateAddresses=value;draft.privateAddressConsent=false;},true)}
    <p>${this.l('Up to 16 exact RFC 1918 IPv4 or unique-local IPv6 addresses, separated by lines or commas. No ranges, loopback, link-local or metadata addresses. The host validates the resolved destination again.','最多 16 個確切 RFC 1918 IPv4 或唯一本地 IPv6 地址，用換行或逗號分隔。唔接受範圍、迴路、鏈路本地或中繼資料地址，主機會再次驗證解析後目的地。',true)}</p>
    <label class="row"><md-checkbox aria-label=${this.l('Allow the listed private network destinations','允許列出嘅私人網絡目的地',true)} ?checked=${draft.privateAddressConsent} ?disabled=${!this.canEditSource} @change=${(event:Event)=>{draft.privateAddressConsent=(event.target as HTMLInputElement).checked;this.sourceChanged();}}></md-checkbox>${this.l('Explicitly allow only the listed private network destinations for this origin.','明確允許此來源使用所列私人網絡目的地，其他地址不獲授權。',true)}</label>
    ${this.canRetainCredential?html`<label class="row"><md-checkbox aria-label=${this.l('Keep existing protected credential','保留現有受保護憑證',true)} ?checked=${draft.retainCredential} ?disabled=${!this.canEditSource} @change=${(event:Event)=>{draft.retainCredential=(event.target as HTMLInputElement).checked;this.clearSourceCredential();this.sourceChanged();}}></md-checkbox>${this.l('Keep existing protected credential for this unchanged origin.','為此未變更來源保留現有受保護憑證。',true)}</label>`:nothing}
    ${!draft.retainCredential?html`<md-outlined-text-field id="source-credential" type="password" autocomplete="off" spellcheck="false" maxlength="8192" .label=${this.l('Home Assistant access token','Home Assistant 存取權杖',true)} ?disabled=${!this.canEditSource} @input=${(event:Event)=>{this.credentialDraft=!!(event.target as HTMLInputElement).value;this.sourceValidation='';this.revision++;}}></md-outlined-text-field>`:nothing}
    <p>${this.l('The credential goes only to the protected host save action. It is not included in schedule documents, exports or history. The form clears it on submission, shared restriction or exit; failed submissions require re-entry. No saved credential can be revealed here.','憑證只會交畀主機受保護儲存動作，唔會加入排程文件、匯出或歷史。提交、共用限制或退出時會清除表格憑證；提交未成功需要重新輸入。此處無法顯示已儲存憑證。',true)}</p>
   </div>`:nothing}
   <label class="row"><md-checkbox aria-label=${this.l('Allow this source for existing enabled schedules','允許現有已啟用排程使用此來源',true)} ?checked=${draft.authorityConsent} ?disabled=${!this.canEditSource} @change=${(event:Event)=>{draft.authorityConsent=(event.target as HTMLInputElement).checked;this.sourceChanged();}}></md-checkbox>${this.l('Allow existing enabled schedules for this origin to use the enrolled source after refresh. Review those rules before granting access.','允許此來源現有已啟用排程喺更新後使用已登記來源。授權之前請先檢視相關規則。',true)}</label>
   ${this.sourceValidation?html`<p role="alert" class="error">${this.l('Check the label (1–96 characters), exact HTTPS origin, source kind, private-address consent and required protected credential. Host validation is final.','請檢查標籤（1 至 96 個字）、確切 HTTPS 來源、來源類型、私人地址同意及所需受保護憑證，最後由主機驗證。',true)} ${this.sourceValidation}</p>`:nothing}
   <div class="row"><md-filled-button ?disabled=${!this.canEditSource||!this.sourceDirty} @click=${this.saveSource}>${materialIcon('save','icon')}${this.sourceBusy?this.l('Source operation in progress…','來源操作進行中…',true):this.l('Save source enrollment','儲存來源登記',true)}</md-filled-button><md-outlined-button ?disabled=${this.sourceBusy||!this.sourceDirty} @click=${async()=>{await this.updateComplete;(this.shadowRoot?.querySelector('#source-discard-dialog') as any)?.show();}}>${this.l('Discard source draft','放棄來源草稿',true)}</md-outlined-button></div>
   `}
   ${!this.sources&&this.sourceValidation?html`<p role="status">${this.sourceValidation}</p>`:nothing}<p role="status">${displayOwnedStatus(this,'sourceFeedback',this.sourceFeedback,this.language)}</p>
  </section>
  <md-dialog id="source-discard-dialog"><div slot="headline">${this.l('Discard unsaved source draft?','放棄未儲存來源草稿？',true)}</div><div slot="content">${this.l('This clears only the unsaved source form, including its transient credential. Stored enrollments and the schedule draft stay unchanged.','只清除未儲存來源表格，包括暫存憑證。已儲存登記同排程草稿維持不變。',true)}</div><div slot="actions"><md-text-button @click=${()=>{(this.shadowRoot?.querySelector('#source-discard-dialog') as any)?.close();}}>${this.l('Keep editing','繼續編輯',true)}</md-text-button><md-outlined-button ?disabled=${this.sourceBusy} @click=${()=>{this.resetSourceDraft();(this.shadowRoot?.querySelector('#source-discard-dialog') as any)?.close();}}>${this.l('Discard source draft','放棄來源草稿',true)}</md-outlined-button></div></md-dialog>
  <md-dialog id="source-remove-dialog" @cancel=${(event:Event)=>{if(this.sourceBusy)event.preventDefault();else this.removeSource=null;}}><div slot="headline">${this.l('Remove this source enrollment?','移除此來源登記？',true)}</div><div slot="content"><p>${this.removeSource?.label} ${this.removeSource?.origin}</p><p>${this.l('This revokes this enrollment for future source requests. Saved schedule rules remain and will fall back when their source is unavailable. This action does not erase the protected credential from its host storage.','移除後唔再授權未來來源要求。已儲存排程規則會保留，來源不可用時使用後備值。此動作唔會從主機儲存抹除受保護憑證。',true)}</p></div><div slot="actions"><md-text-button ?disabled=${this.sourceBusy} @click=${()=>{this.removeSource=null;(this.shadowRoot?.querySelector('#source-remove-dialog') as any)?.close();}}>${this.l('Keep enrollment','保留登記',true)}</md-text-button><md-outlined-button ?disabled=${!this.canEditSource||this.sourceDirty||!this.removeSource||this.removeSourceRevision!==this.sources?.revision} @click=${this.confirmRemoveSource}>${this.l('Remove enrollment','移除登記',true)}</md-outlined-button></div></md-dialog>`;
 }
 private theme(value:string){return value==='system'?this.l('Follow system','跟隨系統',true):value==='dark'?this.l('Dark','深色',true):this.l('Light','淺色',true);}
 private languageName(value:string){return value==='en'?'English':value==='zh-HK'?'香港粵語':'English + 香港粵語';}
 private days(){return [['Sun','日'],['Mon','一'],['Tue','二'],['Wed','三'],['Thu','四'],['Fri','五'],['Sat','六']];}
 private editor(r:ScheduleRule){return html`<div class="editor stack"><h3>${this.l('Rule editor','規則編輯器',true)}</h3>${r.source.type!=='local'?html`<p>${this.l('This existing external rule is preserved. Source setup is unavailable in this editor.','保留此現有外部規則，此編輯器未提供來源設定。',true)}</p>`:nothing}<div class="fields">${this.field('Rule label','規則標籤',r.label,v=>r.label=v)}${this.field('Priority (−1000 to 1000)','優先次序（−1000 至 1000）',String(r.priority),v=>r.priority=v===''?NaN:Number(v),'number')}${this.field('Start date (optional)','開始日期（可選）',r.startDate||'',v=>r.startDate=v||null,'date')}${this.field('End date (optional)','結束日期（可選）',r.endDate||'',v=>r.endDate=v||null,'date')}${this.field('Start time','開始時間',r.startTime,v=>r.startTime=v,'time')}${this.field('End time','結束時間',r.endTime,v=>r.endTime=v,'time')}</div><p>${this.l('Dates are inclusive. Start is inclusive and end exclusive. Equal times mean the whole selected calendar day; an end before start crosses midnight and belongs to the starting day.','日期包括首尾日，開始時間包括在內，結束時間除外。時間相同代表整個所選曆日，結束早過開始會跨午夜並屬於開始嗰日。',true)}</p><label class="row"><md-checkbox aria-label=${this.l('Every day','每日',true)} ?checked=${r.days.type==='everyday'} ?disabled=${!this.canEdit} @change=${(e:Event)=>{r.days=(e.target as HTMLInputElement).checked?{type:'everyday'}:{type:'weekdays',weekdays:[1,2,3,4,5]};this.change();}}></md-checkbox>${this.l('Every day','每日',true)}</label>${r.days.type==='weekdays'?html`<div class="row days">${this.days().map(([en,zh],day)=>html`<label><md-checkbox aria-label=${this.l(en,zh)} ?checked=${r.days.type==='weekdays'&&r.days.weekdays.includes(day)} ?disabled=${!this.canEdit} @change=${(e:Event)=>{if(r.days.type==='weekdays')r.days.weekdays=(e.target as HTMLInputElement).checked?[...r.days.weekdays,day]:r.days.weekdays.filter(d=>d!==day);this.change();}}></md-checkbox>${this.l(en,zh)}</label>`)}</div>`:nothing}<div class="timeline" aria-label=${this.l('Selected weekdays','已選星期',true)} role="group">${this.days().map(([en,zh],day)=>html`<span class=${`day ${r.days.type==='everyday'||r.days.weekdays.includes(day)?'active':''}`}>${this.l(en,zh)}</span>`)}</div><h3>${this.l('Temporary values','暫時值',true)}</h3><label class="row"><md-checkbox aria-label=${this.l('Override appearance profile','覆寫外觀設定組合',true)} ?checked=${'appearance.profile'in r.values} ?disabled=${!this.canEdit} @change=${(e:Event)=>{if((e.target as HTMLInputElement).checked)r.values['appearance.profile']=null;else delete r.values['appearance.profile'];this.change();}}></md-checkbox>${this.l('Override appearance profile','覆寫外觀設定組合',true)}</label>${'appearance.profile'in r.values?this.select('Scheduled appearance profile','排程外觀組合',String(r.values['appearance.profile']||''),[['',this.l('Manual appearance','手動外觀',true)],...listAppearanceProfiles().map(id=>[id,id])],v=>r.values['appearance.profile']=v||null):nothing}<p>${this.l('Save a local appearance profile in the appearance editor first. Profiles include static styles, motion and local logo presentation. Missing profile IDs fall back to the manual appearance and are reported.','請先在外觀編輯器儲存本機外觀組合，包括靜態樣式、動態及本機標誌。遺失嘅組合識別碼會回復手動外觀並顯示通知。',true)}</p><label class="row"><md-checkbox aria-label=${this.l('Override theme','覆寫主題',true)} ?checked=${'appearance.theme'in r.values} ?disabled=${!this.canEdit} @change=${(e:Event)=>{if((e.target as HTMLInputElement).checked)r.values['appearance.theme']='dark';else delete r.values['appearance.theme'];this.change();}}></md-checkbox>${this.l('Override theme','覆寫主題',true)}</label>${'appearance.theme'in r.values?this.select('Scheduled theme','排程主題',String(r.values['appearance.theme']),['system','light','dark'].map(v=>[v,this.theme(v)]),v=>r.values['appearance.theme']=v):nothing}${!this.restricted?html`<label class="row"><md-checkbox aria-label=${this.l('Override language','覆寫語言',true)} ?checked=${'language'in r.values} ?disabled=${!this.canEdit} @change=${(e:Event)=>{if((e.target as HTMLInputElement).checked)r.values.language='en';else delete r.values.language;this.change();}}></md-checkbox>${this.l('Override language','覆寫語言',true)}</label>${'language'in r.values?this.select('Scheduled language','排程語言',String(r.values.language),['en','zh-HK','bilingual'].map(v=>[v,this.languageName(v)]),v=>r.values.language=v):nothing}`:nothing}<md-outlined-button ?disabled=${!this.canEdit} @click=${()=>{this.document.rules=this.document.rules.filter(rule=>rule.id!==r.id);this.selected='';this.change();}}>${materialIcon('delete','icon')}${this.l('Delete rule from draft','從草稿刪除規則',true)}</md-outlined-button></div>`;}
 render(){const s=this.snapshot,eff=s?.available?s.effective:null;return html`<div class="stack"><h2 id="schedule-heading" tabindex="-1">${this.l('Scheduled preferences','偏好排程',true)}</h2><p>${this.l('Rules temporarily override saved preferences in the chosen timezone. Higher priority wins; at equal priority the later rule wins per setting. Ending or disabling an override restores another matching rule or the saved base.','規則會喺所選時區暫時覆寫已儲存偏好，優先次序較高者生效，同級時較後規則按設定勝出。覆寫結束或停用後會恢復其他符合規則或已儲存基礎值。',true)}</p><div class="status stack"><strong>${s?.available?this.l('Host schedule available','主機排程可用',true):this.l('Host schedule unavailable; saved base preferences apply.','主機排程未能使用，採用已儲存基礎偏好。',true)}</strong><p>${this.l('Base theme','基礎主題',true)}: ${this.theme(this.baseTheme)} · ${this.l('Effective theme','有效主題',true)}: ${this.theme(String(eff?.provenance['appearance.theme']?eff.values['appearance.theme']:this.baseTheme))} · ${this.l('Rule','規則',true)}: ${eff?.provenance['appearance.theme']?(this.restricted?this.l('Active scheduled rule','生效中嘅排程規則',true):eff.provenance['appearance.theme']):this.l('Saved base','已儲存基礎值',true)}</p>${!this.restricted?html`<p>${this.l('Base language','基礎語言',true)}: ${this.languageName(this.baseLanguage)} · ${this.l('Effective language','有效語言',true)}: ${this.languageName(String(eff?.provenance.language?eff.values.language:this.baseLanguage))} · ${this.l('Rule','規則',true)}: ${eff?.provenance.language||this.l('Saved base','已儲存基礎值',true)}</p>`:html`<p>Shared preference restrictions take precedence. Restricted controls and rule details are omitted; stored values are preserved.</p>`}<p>${this.l('Evaluated at','評估時間',true)}: ${s?.evaluatedAt!=null?new Date(s.evaluatedAt).toISOString():this.l('Unknown','未知',true)} · ${this.l('Revision','版本',true)}: ${s?.revision??this.l('Not stored','未儲存',true)}</p>${eff?.issues.length?html`<p>${this.l('Some rules have unavailable source results. Inspect host source setup when available.','部分規則來源結果未能使用，主機來源設定可用時請檢視。',true)}</p>${!this.restricted?eff.issues.map(i=>html`<p>${i.ruleId} · ${i.code}</p>`):nothing}`:nothing}<p>${s?.externalAvailable?this.l('External capability is available. Manage protected source enrollments below; existing external rules remain read-only.','外部能力可用，可喺下方管理受保護來源登記；現有外部規則仍只供檢視。',true):this.l('No external source is currently available. Inspect protected source enrollments below. Local rules need no network access.','目前冇可用外部來源，請喺下方檢視受保護來源登記。本機規則毋須網絡。',true)}</p></div><div class="row"><md-outlined-button ?disabled=${this.pending} @click=${()=>this.read()}>${materialIcon('info','icon')}${this.l('Read stored revision','讀取儲存版本',true)}</md-outlined-button><md-outlined-button ?disabled=${this.pending} @click=${()=>this.reload()}>${materialIcon('refresh','icon')}${this.l('Reload schedule','重新載入排程',true)}</md-outlined-button><md-outlined-button ?disabled=${this.refreshing||!s?.available} @click=${this.refresh}>${materialIcon('sync','icon')}${this.l('Refresh effective values','更新有效值',true)}</md-outlined-button><md-outlined-button ?disabled=${!s?.available} @click=${this.cancel}>${materialIcon('stop','icon')}${this.l('Cancel external requests','取消外部要求',true)}</md-outlined-button></div>${this.conflict?html`<p class="error" role="status">${this.l('Stored revision changed. Your draft is preserved; reload explicitly before saving.','儲存版本已變更，草稿已保留，儲存前請明確重新載入。',true)}</p>`:nothing}${this.protectedChanges?html`<p role="status">Some pending edits are restricted. Keep the draft until the shared preference permits them, or reload and discard explicitly.</p>`:nothing}<md-outlined-text-field .label=${this.l('Schedule timezone','排程時區',true)} .value=${this.document.timeZone} ?disabled=${!this.canEdit||this.fixedOrder} supporting-text=${this.l('IANA timezone, for example Asia/Hong_Kong or UTC. Daylight saving follows local wall time: skipped times do not occur and repeated times match twice.','IANA 時區，例如 Asia/Hong_Kong 或 UTC。本地時間跟隨夏令時間：跳過嘅時間唔會發生，重複時間會符合兩次。',true)} @input=${(e:Event)=>{this.document.timeZone=(e.target as HTMLInputElement).value;this.change();}}></md-outlined-text-field><div class="row"><md-outlined-button ?disabled=${!this.canEdit||this.document.rules.length>=256} @click=${this.add}>${materialIcon('add','icon')}${this.l('Add local rule','新增本機規則',true)}</md-outlined-button><md-filled-button ?disabled=${!this.canEdit||!this.dirty||this.conflict||this.protectedChanges} @click=${()=>this.save()}>${materialIcon('save','icon')}${this.l('Save schedule','儲存排程',true)}</md-filled-button><span>${this.dirty?this.l('Unsaved draft','未儲存草稿',true):this.l('No pending edits','冇待儲存變更',true)}</span></div>${this.validation?html`<p role="alert" class="error">${this.l('Check the timezone, calendar dates, time window, weekdays, priority and at least one temporary value.','請檢查時區、日期、時間範圍、星期、優先次序及至少一個暫時值。',true)} ${this.validation}</p>`:nothing}${this.hiddenRules?html`<p>Restricted rules are preserved and omitted from this editor.</p>`:nothing}${this.hasExternal?html`<p>${this.l('Existing external rules are preserved unchanged. Reordering and timezone changes are unavailable until source editing is supported.','現有外部規則保持不變，來源編輯支援之前未能重新排序或改時區。',true)}</p>`:nothing}<div class="layout"><div class="rules" aria-label=${this.l('Ordered schedule rules','已排序排程規則',true)}>${this.document.rules.filter(r=>!this.restricted||!('language'in r.values)).map(r=>html`<section class=${`rule ${this.selected===r.id?'selected':''}`}><div class="rule-title"><md-text-button aria-pressed=${this.selected===r.id} ?disabled=${r.source.type!=='local'} @click=${()=>{this.selected=r.id;this.revision++;}}>${materialIcon('edit','icon')}${r.label}</md-text-button></div><p>${r.startTime}–${r.endTime} · ${this.l('Priority','優先次序',true)} ${r.priority}</p><div class="row"><md-switch aria-label=${this.l('Enable rule','啟用規則',true)+' '+r.label} ?selected=${r.enabled} ?disabled=${!this.canEdit||r.source.type!=='local'} @change=${(e:Event)=>{r.enabled=(e.target as HTMLInputElement&{selected:boolean}).selected;this.change();}}></md-switch>${([-1,1] as const).map(d=>html`<md-icon-button aria-label=${this.l(d<0?'Move rule earlier':'Move rule later',d<0?'將規則移前':'將規則移後')+' '+r.label} title=${this.l(d<0?'Move rule earlier':'Move rule later',d<0?'將規則移前':'將規則移後')} ?disabled=${!this.canEdit||this.fixedOrder||(d<0?this.document.rules.indexOf(r)===0:this.document.rules.indexOf(r)===this.document.rules.length-1)} @click=${()=>this.move(r.id,d)}>${materialIcon(d<0?'arrow_upward':'arrow_downward')}</md-icon-button>`)}</div></section>`)}</div>${this.rule?this.editor(this.rule):html`<p>${this.l('Add or select a local rule to edit its calendar window and temporary values.','新增或選擇本機規則以編輯日期範圍同暫時值。',true)}</p>`}</div>${this.renderSources()}${this.renderDraftHistory()}<section class="history" id="schedule-history"><div class="row"><h3>${this.l('Schedule history','排程歷史',true)}</h3><md-outlined-button ?disabled=${this.pending} @click=${()=>this.readHistory()}>${materialIcon('history','icon')}${this.l('Read schedule history','讀取排程歷史',true)}</md-outlined-button></div>${!this.restricted?html`<p>${this.l('Active local-rule snapshots can be restored to the editor, then saved as a new revision. Earlier receipt-only records have no snapshot. External rules and credentials are excluded.','生效中本機規則快照可還原到編輯器，再儲存為新版本。較舊純收據記錄冇快照，外部規則同憑證不包含在內。',true)}</p><md-outlined-button ?disabled=${this.pending||!this.history} @click=${()=>this.exportHistoryPage()}>${this.l('Export loaded history page','匯出已載入歷史頁',true)}</md-outlined-button>`:nothing}${this.history?.records.map(r=>html`<p>${r.sequence} · ${r.receipt.action} · ${r.receipt.fromRevision??'∅'} → ${r.receipt.toRevision}</p>${!this.restricted?html`<md-outlined-button ?disabled=${this.pending||this.dirty||this.sourceDirty} @click=${()=>this.restoreDraft(r.receipt.toRevision,true)}>${this.l('Restore local rules to editor','還原本機規則到編輯器',true)}</md-outlined-button>`:nothing}`)}${this.history&&!this.history.records.length?html`<p>${this.l('No recorded schedule revisions.','冇排程版本記錄。',true)}</p>`:nothing}${this.history?.hasMore?html`<md-text-button ?disabled=${this.pending} @click=${()=>this.readHistory(true)}>${materialIcon('arrow_forward','icon')}${this.l('More history','更多歷史',true)}</md-text-button>`:nothing}</section><p role="status">${displayOwnedStatus(this,'feedback',this.feedback,this.language)}</p></div><md-dialog id="schedule-leave-dialog" @cancel=${(event:Event)=>{if(this.pending||this.sourceBusy)event.preventDefault();else this.closeConfirm(false);}}><div slot="headline">${this.l('Unsaved preference drafts','未儲存偏好草稿',true)}</div><div slot="content">${this.l('Before discard, history preserves all local rule edits, their desired order, timezone and original revision. External rules remain current stored records; unsaved external edits are not discarded. Source forms and credentials are excluded from history and are cleared only when leaving. Save source enrollments in their section before choosing Save and continue.','放棄之前，歷史會保留全部本機規則變更、所需次序、時區同原始版本。外部規則維持目前儲存記錄，未儲存外部變更唔會被放棄。來源表格同憑證不會加入歷史，只有離開時先會清除。選擇儲存並繼續之前，請先喺來源區儲存登記。',true)}${this.dirty&&(this.restricted||this.discardUncertain)?html`<p>${this.l('History-backed discard is unavailable for this draft. Keep editing, or close this dialog to inspect draft history and the displayed preservation requirements.','此草稿暫時無法連同歷史記錄一齊放棄。請繼續編輯，或關閉對話框以檢視草稿歷史同顯示嘅保留要求。',true)}</p>`:nothing}</div><div slot="actions"><md-text-button ?disabled=${this.pending||this.sourceBusy} @click=${()=>this.closeConfirm(false)}>${this.l('Keep editing','繼續編輯',true)}</md-text-button><md-outlined-button ?disabled=${this.pending||this.sourceBusy||this.dirty&&(this.restricted||this.discardUncertain)} @click=${this.discard}>${materialIcon('close','icon')}${this.sourceDirty&&!this.confirmAction?this.l('Discard pending drafts','放棄待儲存草稿',true):this.l('Discard schedule draft','放棄排程草稿',true)}</md-outlined-button>${!this.confirmAction&&!this.sourceDirty?html`<md-filled-button ?disabled=${!this.canEdit||this.sourceBusy||this.conflict||this.protectedChanges} @click=${async()=>{if(await this.save())this.closeConfirm(true);}}>${materialIcon('save','icon')}${this.l('Save and continue','儲存並繼續',true)}</md-filled-button>`:nothing}</div></md-dialog>`;}
}
customElements.define('scheduled-preferences-panel',ScheduledPreferencesPanel);
