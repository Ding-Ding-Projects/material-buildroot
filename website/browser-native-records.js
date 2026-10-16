import {mountBrowserExport} from './browser-native-exports.js';
import {browserCopy} from './browser-native-tone.js';
import {mountLocalSearch} from './browser-native-search-mount.js';
/** Local recovery desk. Records never represent a submitted support request. */
export function mountBrowserRecords(visitor) {
  const l=(en,zh)=>browserCopy(en,zh);
  const section=document.createElement('section');section.className='visitor-card';section.id='browser-native-records';
  const localized=[];const make=(tag,en='',zh='',parent=section)=>{const item=document.createElement(tag);if(en)localized.push(()=>item.textContent=l(en,zh));parent.append(item);return item;};
  const heading=make('h2','Local recovery desk','本機復原工作台');heading.id='browser-records-title';section.setAttribute('aria-labelledby',heading.id);
  make('p','Keep your own troubleshooting requests and operation notices here. Requests are saved in this browser only and are never submitted to a maintainer. Do not enter credentials. Records are unencrypted. The newest 1,000 requests and 1,000 notices are loaded; older records remain stored and are not included in this view or its exports.','喺此保留你嘅疑難排解事項同操作通知。事項只儲存喺此瀏覽器，唔會提交畀維護者。請勿輸入憑證，記錄未加密。此頁載入最近 1,000 項事項同 1,000 則通知；舊記錄仍然保留，但不會列入此檢視或匯出。');
  const state=make('p');state.role='status';state.setAttribute('aria-live','polite');
  let status=['Opening browser storage…','正在開啟瀏覽器儲存…'];const report=(en,zh)=>{status=[en,zh];state.textContent=l(en,zh);};localized.push(()=>state.textContent=l(...status));
  const title=make('md-outlined-text-field');title.className='visitor-field';title.maxLength=180;localized.push(()=>title.label=l('Describe the request','描述事項'));
  const body=make('md-outlined-text-field');body.className='visitor-field';body.type='textarea';body.rows=4;body.maxLength=4000;localized.push(()=>body.label=l('Observed behavior, desired result and next step','實際情況、預期結果同下一步'));
  const actions=make('div');actions.className='visitor-actions';
  const button=(en,zh,action,parent=actions)=>{const b=make('md-outlined-button',en,zh,parent);b.addEventListener('click',action);return b;};
  let db;let records=[];let visible=[];let selected=new Set();let editing;let lastIndex=-1;let busy=false;let cancelled=false;let search;
  const disabled=[];const setBusy=value=>{busy=value;disabled.forEach(b=>b.disabled=busy||!db);};
  const operation=(store,mode,action)=>new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode);const object=tx.objectStore(store);let result;
    tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error('Storage failed'));
    try{action(object,value=>{result=value;});}catch{tx.abort();reject(new Error('Storage unavailable'));}
  });
  const recent=store=>operation(store,'readonly',(object,done)=>{const items=[];const cursor=object.openCursor(null,'prev');cursor.onsuccess=()=>{if(cursor.result&&items.length<1000){items.push({...cursor.result.value,id:cursor.result.key});cursor.result.continue();}else done(items);};});
  const run=async action=>{if(!db||busy)return;setBusy(true);try{await action();}catch{report('The storage operation did not complete. Refresh to inspect saved records before retrying.','儲存操作未完成，重試前請重新整理以檢視已儲存記錄。');}finally{setBusy(false);}};
  const list=make('div');list.setAttribute('role','group');localized.push(()=>list.setAttribute('aria-label',l('Loaded recovery requests','已載入復原事項')));
  const count=make('p');count.role='status';
  const selectRange=(index,checked,range)=>{const from=range&&lastIndex>=0?Math.min(lastIndex,index):index;const to=range&&lastIndex>=0?Math.max(lastIndex,index):index;for(let i=from;i<=to;i++)checked?selected.add(visible[i].id):selected.delete(visible[i].id);lastIndex=index;render();};
  const statusText=value=>value==='open'?l('Open','未完成'):value==='resolved'?l('Resolved','已解決'):l('Archived','已封存');
  const render=()=>{
    list.replaceChildren();count.textContent=l(`${visible.length} loaded matches; ${[...selected].filter(id=>visible.some(r=>r.id===id)).length} selected.`,`${visible.length} 項已載入符合事項；已選 ${[...selected].filter(id=>visible.some(r=>r.id===id)).length} 項。`);
    if(!visible.length){make('p','','',list).textContent=l('No matching loaded requests. Clear the search or create one above.','未有符合嘅已載入事項。請清除搜尋或喺上方建立。');return;}
    visible.forEach((record,index)=>{
      const card=make('article','','',list);card.className='companion-record';
      const label=make('label','','',card);const box=make('md-checkbox','','',label);box.checked=selected.has(record.id);box.setAttribute('aria-label',l(`Select request ${record.id}`,`選擇事項 ${record.id}`));
      box.addEventListener('click',event=>selectRange(index,!selected.has(record.id),event.shiftKey));
      make('strong','','',label).textContent=record.title;
      make('p','','',card).textContent=`${statusText(record.status)} · ${record.updatedAt}`;
      make('p','','',card).textContent=record.body;
      const edit=make('md-text-button','','',card);edit.textContent=l('Edit this request','編輯此事項');edit.addEventListener('click',()=>{if(busy)return;editing=record;title.value=record.title;body.value=record.body;title.focus();report('Editing the selected local request. Save checks its revision before replacing it.','正在編輯所選本機事項，儲存前會檢查版本。');});
    });
  };
  const reload=async()=>{records=await recent('tickets');selected=new Set([...selected].filter(id=>records.some(r=>r.id===id)));visible=records;if(search)search.entries=records.map(r=>({id:String(r.id),text:`${r.title} ${r.body} ${r.status} ${r.createdAt} ${r.updatedAt}`}));render();};
  disabled.push(button('Save local request','儲存本機事項',()=>run(async()=>{
    if(!title.value.trim()||title.value.length>180||body.value.length>4000){report('Add a title up to 180 characters and details up to 4,000 characters.','請加入最多 180 字元嘅標題同最多 4,000 字元嘅內容。');return;}
    const draft={title:title.value.trim(),body:body.value};const expected=editing;
    const outcome=await operation('tickets','readwrite',(object,done)=>{
      const write=current=>{if(expected&&(!current||current.revision!==expected.revision)){done(false);return;}const at=new Date().toISOString();const value={...draft,status:current?.status||'open',createdAt:current?.createdAt||at,updatedAt:at,revision:(current?.revision||0)+1};const request=expected?object.put(value,expected.id):object.add(value);request.onsuccess=()=>done(true);};
      if(expected){const request=object.get(expected.id);request.onsuccess=()=>write(request.result);}else write();
    });
    if(!outcome){report('Another tab changed this request. Your draft is retained. Refresh, select the current record and reconcile it.','另一分頁已變更此事項，草稿已保留。請重新整理、選取目前記錄並核對內容。');return;}
    editing=undefined;title.value='';body.value='';await reload();report('Request saved locally. Nothing was submitted to a maintainer.','事項已儲存本機，並無提交畀維護者。');
  })));
  button('New request','新增事項',()=>{editing=undefined;title.value='';body.value='';title.focus();});
  disabled.push(button('Refresh records','重新整理記錄',()=>run(reload)));
  button('Select all loaded matches','選取全部已載入符合事項',()=>{selected=new Set(visible.map(r=>r.id));render();});
  button('Invert loaded selection','反轉已載入選取',()=>{for(const r of visible)selected.has(r.id)?selected.delete(r.id):selected.add(r.id);render();});
  button('Clear selection','清除選取',()=>{selected.clear();render();});
  const bulk=async status=>run(async()=>{
    const targets=visible.filter(r=>selected.has(r.id));if(!targets.length){report('Select one or more loaded requests first.','請先選擇一項或以上已載入事項。');return;}
    cancelled=false;let updated=0,stale=0;
    for(const record of targets){if(cancelled)break;const changed=await operation('tickets','readwrite',(object,done)=>{const request=object.get(record.id);request.onsuccess=()=>{const current=request.result;if(!current||current.revision!==record.revision){done(false);return;}const write=object.put({...current,status,updatedAt:new Date().toISOString(),revision:current.revision+1},record.id);write.onsuccess=()=>done(true);};});changed?updated++:stale++;report(`Updated ${updated} of ${targets.length}; ${stale} stale records skipped.`,`已更新 ${updated}／${targets.length} 項；跳過 ${stale} 項舊版本。`);}
    await reload();report(`Updated ${updated}; stale ${stale}; not attempted ${targets.length-updated-stale}. Refresh before retrying.`,`已更新 ${updated} 項；舊版本 ${stale} 項；未嘗試 ${targets.length-updated-stale} 項。重試前請重新整理。`);
  });
  disabled.push(button('Mark selected resolved','將已選事項標為已解決',()=>bulk('resolved')));
  disabled.push(button('Reopen selected','重新開啟已選事項',()=>bulk('open')));
  disabled.push(button('Archive selected (retained)','封存已選事項（保留資料）',()=>bulk('archived')));
  button('Cancel remaining bulk work','取消餘下批次操作',()=>{cancelled=true;});
  const exportData=(data,name)=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,scope:'loaded-matches',exportedAt:new Date().toISOString(),records:data},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;section.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);report('Download requested. Scope is selected loaded matches, or all loaded matches when none are selected. Confirm completion in browser downloads.','已要求下載，範圍為已選已載入符合事項；未有選取時為全部已載入符合事項。請喺瀏覽器下載記錄確認完成。');};
  button('Export matching requests','匯出符合事項',()=>exportData(selected.size?visible.filter(r=>selected.has(r.id)):visible,'visitor-requests.json'));
  mountBrowserExport(section,()=>({version:1,scope:'loaded-matches',records:selected.size?visible.filter(record=>selected.has(record.id)):visible}),'visitor-requests','Selected loaded matches, or all loaded matches when none are selected');
  const searchHost=make('div');list.before(searchHost);search=mountLocalSearch(searchHost,'Search local requests','搜尋本機事項',[],ids=>{lastIndex=-1;visible=records.filter(r=>ids.has(String(r.id)));render();});
  make('h3','Operation notices','操作通知');
  make('p','Only fixed generic browser-operation events are recorded. Request details, filenames, selected text, private mappings and companion data are excluded. These notices prove only that this page reached the named step, not successful native work or a completed download.','只記錄固定嘅一般瀏覽器操作事件，唔包含事項內容、檔名、所選文字、私人映射或配對資料。通知只表示此頁到達所列步驟，唔能證明原生工作成功或下載完成。');
  const notices=make('div');let noticeRows=[],shownNotices=[];let noticeSearch;
  const messages={saved:['Recovery copy saved','復原副本已儲存'],restored:['Visitor plan restored','訪客計劃已還原'],download:['Browser download requested; completion unknown','已要求瀏覽器下載，完成狀態未知'],cleared:['Selected text cleared from memory','已清除記憶體內所選文字']};
  const renderNotices=()=>{notices.replaceChildren();for(const value of shownNotices){const p=make('p','','',notices);p.textContent=`${value.at} · ${l(...messages[value.type])}`;}if(!shownNotices.length)make('p','','',notices).textContent=l('No matching operation notices.','未有符合嘅操作通知。');};
  const reloadNotices=async()=>{noticeRows=(await recent('notices')).filter(r=>Object.hasOwn(messages,r.type));shownNotices=noticeRows;if(noticeSearch)noticeSearch.entries=noticeRows.map(r=>({id:String(r.id),text:`${r.at} ${messages[r.type].join(' ')}`}));renderNotices();};
  const noticeHost=make('div');notices.before(noticeHost);noticeSearch=mountLocalSearch(noticeHost,'Search operation notices','搜尋操作通知',[],ids=>{shownNotices=noticeRows.filter(r=>ids.has(String(r.id)));renderNotices();});
  button('Export matching notices','匯出符合通知',()=>exportData(shownNotices,'visitor-notices.json'),section);
  mountBrowserExport(section,()=>({version:1,scope:'loaded-matches',records:shownNotices}),'visitor-notices','Loaded matching operation notices only');
  visitor.addEventListener('browser-native-status',event=>{if(!db||!Object.hasOwn(messages,event.detail))return;operation('notices','readwrite',(object,done)=>{const request=object.add({type:event.detail,at:new Date().toISOString()});request.onsuccess=()=>done();}).then(reloadNotices).catch(()=>report('The action status could not be saved in notices. The action itself is not rolled back.','未能將操作狀態儲存至通知，操作本身不會撤回。'));});
  section.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelled=true;}});
  visitor.querySelector('#browser-native-tools')?.after(section);if(!section.isConnected)visitor.append(section);
  const relocalize=()=>{localized.forEach(update=>update());render();renderNotices();};document.querySelector('#language')?.addEventListener('change',relocalize);document.addEventListener('browser-native-copy-change',relocalize);relocalize();setBusy(false);
  try{const request=indexedDB.open('material-buildroot-visitor-records-v1',1);request.onupgradeneeded=()=>{request.result.createObjectStore('tickets',{autoIncrement:true});request.result.createObjectStore('notices',{autoIncrement:true});};request.onerror=()=>report('Browser record storage is unavailable. Notes and downloads elsewhere remain separate.','瀏覽器記錄儲存無法使用，其他筆記同下載功能保持獨立。');request.onblocked=()=>report('Storage is waiting for another browser tab to close.','儲存正等待其他瀏覽器分頁關閉。');request.onsuccess=()=>{db=request.result;db.onversionchange=()=>{db.close();db=undefined;setBusy(false);report('Storage changed. Reload before editing records.','儲存已變更，編輯記錄前請重新載入。');};run(async()=>{await reload();await reloadNotices();report('Local recovery desk ready. Requests are not sent externally.','本機復原工作台已就緒，事項唔會向外傳送。');});};}catch{report('Browser record storage is unavailable.','瀏覽器記錄儲存無法使用。');}
}


