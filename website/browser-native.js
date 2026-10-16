import {bindDurableConverter} from './browser-native-queue-bindings.js';
import {mountBrowserBinary} from './browser-native-binary.js';
import {mountBrowserTable} from './browser-native-table.js';
import {mountBrowserMedia} from './browser-native-media.js';
import {mountBrowserDocuments} from './browser-native-documents.js';
import {mountBrowserConverter} from './browser-native-converter.js';
import {mountBrowserExport} from './browser-native-exports.js';
import {mountBrowserGuidance} from './browser-native-guidance.js';
import {mountBrowserTabs} from './browser-native-tabs.js';
import {mountBrowserTone,browserCopy} from './browser-native-tone.js';
import {mountBrowserAuthenticator} from './browser-native-authenticator.js';
import {mountBrowserLocks} from './browser-native-locks.js';
import {mountBrowserLogo} from './browser-native-logo.js';
import {mountBrowserSchedule} from './browser-native-schedule.js';
import {mountBrowserAppearance} from './browser-native-appearance.js';
import {mountBrowserNavigation} from './browser-native-navigation.js';
import {protectBrowserMutation} from './browser-native-confirmation.js';
import {mountBrowserRecords} from './browser-native-records.js';
import {mountLocalSearch} from './browser-native-search-mount.js';
import {mountBrowserPreferences} from './browser-native-preferences.js';
const MAX_TEXT_BYTES = 1024 * 1024;
const CHECKS = ['read-roadmap', 'check-evidence', 'write-notes'];
const encode = value => new TextEncoder().encode(value);
const text = (en, zh) => browserCopy(en, zh);
const validPlan = value => value && value.version === 1 && typeof value.goal === 'string' && value.goal.length <= 180 && typeof value.notes === 'string' && value.notes.length <= 4000 && value.checks && typeof value.checks === 'object' && CHECKS.every(key => typeof value.checks[key] === 'boolean');

// Browser-owned operations never call the companion transport or grant host access.
export function mountBrowserNative(visitor, {readPlan, restorePlan, applyPreferences}) {
  for(const section of visitor.querySelectorAll(':scope > section')) if(!section.id && !section.classList.contains('companion-status')) section.id='visitor-panel-'+(section.querySelector('h2')?.id || 'local');
  const root = document.createElement('section');
  root.className = 'visitor-card'; root.id = 'browser-native-tools';
  root.setAttribute('aria-labelledby', 'browser-native-title');
  const localized = [];
  const node = (tag, en, zh, parent = root) => {
    const element = document.createElement(tag);
    if (en) localized.push(() => { element.textContent = text(en, zh); });
    parent.append(element); return element;
  };
  const title = node('h2', 'Local files and workbench backups', '本機檔案同工作區備份'); title.id = 'browser-native-title';
  node('p', 'These controls operate on your actual browser workbench and explicitly selected local text. They are not learning examples. No files or notes are uploaded. Browser storage is not encrypted; do not enter credentials or private vocabulary files.', '呢啲控制項會操作真實瀏覽器工作區同你明確選取嘅本機文字，唔係學習示例。檔案同筆記唔會上載。瀏覽器儲存未加密，請勿輸入憑證或私人詞彙檔案。');
  const status = node('p'); status.role = 'status'; status.setAttribute('aria-live', 'polite'); status.className = 'visitor-message';
  let statusCopy = ['Ready. Local operations do not need a connection.', '準備就緒，本機操作唔需要網絡。'];
  const report = (en, zh) => { statusCopy = [en, zh]; status.textContent = text(en, zh); };
  localized.push(() => { status.textContent = text(...statusCopy); });
  const actions = parent => { const row = node('div', '', '', parent); row.className = 'visitor-actions'; return row; };
  const button = (parent, en, zh, action) => { const element = node('md-outlined-button', en, zh, parent); element.addEventListener('click', action); return element; };
  const field = (parent, en, zh, limit) => {
    const element = node('md-outlined-text-field', '', '', parent); element.className = 'visitor-field'; element.maxLength = limit;
    localized.push(() => { element.label = text(en, zh); }); return element;
  };
  const event = type => visitor.dispatchEvent(new CustomEvent('browser-native-status',{detail:type}));
  const download = (payload, name, type) => {
    const url = URL.createObjectURL(new Blob([payload], {type}));
    const link = document.createElement('a'); link.href = url; link.download = name; root.append(link);
    try { link.click(); event('download'); report('Download requested. Confirm completion in your browser downloads; this page cannot observe the final saved file.', '已要求下載。請喺瀏覽器下載記錄確認完成，此頁無法觀察最後儲存嘅檔案。'); }
    finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
  };
  const downloadSafe = (make, name, type) => { try { download(make(), name, type); } catch { report('The export could not be prepared. Your work is unchanged.', '未能準備匯出，現有資料不變。'); } };

  node('h3', 'Export the current visitor plan', '匯出目前訪客計劃');
  node('p', 'JSON is the complete version 1 backup accepted by Restore above. Markdown and plain text are readable copies, not round-trip backups. All output uses UTF-8 with LF line endings. Companion data, credentials and learning progress are excluded.', 'JSON 係可由上方還原功能匯入嘅完整版本 1 備份。Markdown 同純文字只供閱讀，唔能作完整還原。全部輸出使用 UTF-8 同 LF 換行；不包含配對資料、憑證同學習進度。');
  const exportRow = actions(root);
  mountBrowserExport(root, readPlan, 'visitor-plan', 'Current visitor goal, notes and checklist only');
  button(exportRow, 'JSON backup', 'JSON 備份', () => downloadSafe(() => JSON.stringify({...readPlan(), exportedAt:new Date().toISOString()}, null, 2), 'visitor-plan.json', 'application/json'));
  const prose = markdown => {
    const plan = readPlan();
    return `${markdown ? '# ' : ''}Visitor plan\n\n${plan.goal}\n\n${plan.notes}\n\n${CHECKS.map(key => `${plan.checks[key] ? '[x]' : '[ ]'} ${key}`).join('\n')}\n\nUpdated: ${plan.updatedAt || 'unknown'}\n`;
  };
  button(exportRow, 'Markdown copy', 'Markdown 副本', () => downloadSafe(() => prose(true), 'visitor-plan.md', 'text/markdown'));
  button(exportRow, 'Plain-text copy', '純文字副本', () => downloadSafe(() => prose(false), 'visitor-plan.txt', 'text/plain'));

  node('h3', 'Named recovery copies', '具名稱復原副本');
  node('p', 'Save a recovery copy before replacing your plan. Copies live in a separate browser database and survive Clear local work above. Restoring preserves the current plan as another copy first. This is browser snapshot storage, not native version control. Use browser site-data controls to remove all copies; that also removes other local site data.', '取代計劃前可儲存復原副本。副本位於獨立瀏覽器資料庫，上方清除本機資料唔會刪除佢哋。還原前會先保留目前計劃為另一副本。呢個係瀏覽器快照儲存，唔係原生版本控制。可透過瀏覽器網站資料控制刪除全部副本，同時亦會刪除其他本機網站資料。');
  const name = field(root, 'Recovery copy label (maximum 80 characters)', '復原副本名稱（最多 80 字元）', 80); name.id='browser-recovery-name';
  const historyRow = actions(root);
  const selection = node('p'); selection.tabIndex = 0; selection.style.overflowWrap = 'anywhere';
  const preview = field(root, 'Selected recovery copy', '已選復原副本', 5000); preview.type = 'textarea'; preview.rows = 5; preview.readOnly = true;
  let database; let dbRequest; let selected; let keys = []; let allCopies = []; let search; let position = -1; let busy = false;
  const controls = [];
  const updateControls = () => controls.forEach(control => { control.disabled = busy || !database; });
  const transaction = (mode, action) => new Promise((resolve, reject) => {
    const tx = database.transaction('copies', mode); let result;
    tx.oncomplete = () => resolve(result); tx.onerror = () => reject(new Error('Storage failed')); tx.onabort = () => reject(new Error('Storage aborted'));
    try { const request = action(tx.objectStore('copies')); request.onsuccess = () => { result = request.result; }; }
    catch { tx.abort(); reject(new Error('Storage unavailable')); }
  });
  const show = () => {
    selection.textContent = selected ? `${position + 1} / ${keys.length}: ${selected.label} (${selected.at})` : text('No saved recovery copies.', '未有已儲存復原副本。');
    preview.value = selected ? `${selected.plan.goal}\n\n${selected.plan.notes}` : '';
  };
  const reload = async id => {
    allCopies = await new Promise((resolve,reject)=>{
      const tx=database.transaction('copies','readonly');const rows=[];
      tx.oncomplete=()=>resolve(rows.reverse());tx.onerror=tx.onabort=()=>reject(new Error('Storage failed'));
      const cursor=tx.objectStore('copies').openCursor(null,'prev');
      cursor.onsuccess=()=>{if(cursor.result&&rows.length<1000){rows.push({...cursor.result.value,id:cursor.result.key});cursor.result.continue();}};
    });
    keys=allCopies.map(copy=>copy.id);
    if(search) search.entries=allCopies.map(copy=>({id:String(copy.id),text:`${copy.label} ${copy.at} ${copy.plan.goal} ${copy.plan.notes}`}));
    position = id === undefined ? keys.length - 1 : keys.indexOf(id);
    if (position < 0 && keys.length) position = keys.length - 1;
    selected = position < 0 ? undefined : await transaction('readonly', store => store.get(keys[position])); show();
  };
  const run = async action => {
    if (busy || !database) return;
    busy = true; updateControls();
    try { await action(); } catch { report('Browser storage could not complete this operation. Retry after checking storage access and quota. The operation is incomplete; inspect the current plan before retrying.', '瀏覽器儲存未能完成操作。請檢查儲存存取權同容量後重試，操作未完成，重試前請檢視目前計劃。'); }
    finally { busy = false; updateControls(); }
  };
  const capture = async label => {
    const plan = readPlan(); if (!validPlan(plan)) throw new Error('Invalid plan');
    return transaction('readwrite', store => store.add({label:label.slice(0,80), at:new Date().toISOString(), plan}));
  };
  controls.push(button(historyRow, 'Save recovery copy', '儲存復原副本', () => run(async () => {
    const id = await capture(name.value.trim() || text('Manual recovery copy', '手動復原副本')); await reload(id); event('saved'); report('Recovery copy saved in this browser.', '復原副本已儲存喺此瀏覽器。');
  })));
  controls.push(button(historyRow, 'Previous', '上一份', () => run(async () => { if(position > 0) { position--; selected = await transaction('readonly', store => store.get(keys[position])); show(); } })));
  controls.push(button(historyRow, 'Next', '下一份', () => run(async () => { if(position + 1 < keys.length) { position++; selected = await transaction('readonly', store => store.get(keys[position])); show(); } })));
  controls.push(button(historyRow, 'Restore selected copy', '還原已選副本', () => run(async () => {
    if (!selected || !validPlan(selected.plan)) { report('Select a valid recovery copy first.', '請先選擇有效復原副本。'); return; }
    const plan = structuredClone(selected.plan);
    const before = JSON.stringify(readPlan());
    await capture(text('Before restore', '還原前'));
    if (JSON.stringify(readPlan()) !== before) { await reload(); report('Your plan changed while saving its recovery copy. Restore was cancelled. Select the desired copy and try again.', '儲存復原副本期間計劃已變更，還原已取消。請重新選擇副本再試。'); return; }
    restorePlan(plan); await capture(text('Restored plan', '已還原計劃')); await reload(); event('restored'); report('Plan restored; the preceding plan remains in recovery copies.', '計劃已還原，之前嘅計劃仍保留喺復原副本。');
  })));
  controls.push(button(historyRow, 'Export selected copy', '匯出已選副本', () => { if(selected) downloadSafe(() => JSON.stringify(selected.plan, null, 2), 'visitor-recovery.json', 'application/json'); }));
  mountBrowserExport(root,()=>{if(!selected)throw Error('No selected copy');return selected.plan;},'visitor-recovery','The currently selected recovery copy only');
  const searchHost=node('div');historyRow.before(searchHost);
  search=mountLocalSearch(searchHost,'Search the latest 1,000 recovery copies','搜尋最近 1,000 份復原副本',[],ids=>{keys=allCopies.filter(copy=>ids.has(String(copy.id))).map(copy=>copy.id);position=keys.length-1;selected=allCopies.find(copy=>copy.id===keys[position]);show();});
  localized.push(show); updateControls();
  try {
    dbRequest = indexedDB.open('material-buildroot-visitor-recovery-v1', 1);
    dbRequest.onupgradeneeded = () => { dbRequest.result.createObjectStore('copies', {autoIncrement:true}); };
    dbRequest.onerror = () => report('Recovery storage is unavailable. Current-plan exports still work.', '復原儲存無法使用，目前計劃仍可匯出。');
    dbRequest.onblocked = () => report('Recovery storage is waiting for another tab to close.', '復原儲存正等待其他分頁關閉。');
    dbRequest.onsuccess = () => { database = dbRequest.result; database.onversionchange = () => { database.close(); database = undefined; updateControls(); report('Recovery storage changed in another tab. Reload to reconnect.', '另一分頁已變更復原儲存，請重新載入以連接。'); }; run(() => reload()); };
  } catch { report('Recovery storage is unavailable. Current-plan exports still work.', '復原儲存無法使用，目前計劃仍可匯出。'); }

  node('h3', 'Local text conversion', '本機文字轉換');
  node('p', 'Choose one UTF-8 .txt or .md file up to 1 MiB. Text is memory-only before conversion. Conversion retains its input and output in the shared queue. Clearing the editor does not remove queued copies. JSON, executables and binary formats are not accepted. PDF, office, audio, video, image and archive conversion are unavailable in this visitor tool.', '選擇一份最大 1 MiB 嘅 UTF-8 .txt 或 .md 檔案。轉換前文字只留喺記憶體，轉換會將輸入同輸出保留喺共用佇列。清除編輯器唔會移除佇列副本。唔接受 JSON、可執行檔或二進位格式。此訪客工具唔支援 PDF、辦公室文件、音訊、影片、圖片同封存轉換。');
  const picker = node('input'); picker.type = 'file'; picker.accept = '.txt,.md,text/plain,text/markdown'; picker.style.maxWidth = '100%';
  localized.push(() => picker.setAttribute('aria-label', text('Select a local text file, maximum 1 MiB', '選擇本機文字檔案，最大 1 MiB')));
  const editor = field(root, 'Text to convert (UTF-8, maximum 1 MiB)', '要轉換嘅文字（UTF-8，最大 1 MiB）', MAX_TEXT_BYTES); editor.type = 'textarea'; editor.rows = 6; editor.id='browser-native-text-editor';
  const fileRow = actions(root); let generation = 0;
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0]; const current = ++generation;
    if (!file) return;
    if (file.size > MAX_TEXT_BYTES || !/\.(txt|md)$/i.test(file.name)) { picker.value = ''; report('Choose a .txt or .md file no larger than 1 MiB. Current text is unchanged.', '請選擇唔超過 1 MiB 嘅 .txt 或 .md 檔案，現有文字不變。'); return; }
    report('Reading the selected local file…', '正在讀取所選本機檔案…');
    try {
      const bytes = await file.arrayBuffer();
      if (current !== generation) return;
      const content = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
      if (content.includes('\0')) throw new Error('Binary text');
      editor.value = content; editor.dispatchEvent(new Event('change',{bubbles:true})); report('Local text loaded. Nothing was uploaded or saved to browser storage.', '已載入本機文字，並無上載或寫入瀏覽器儲存。');
    } catch { if(current === generation) report('This file is not supported UTF-8 text. Current text is unchanged.', '此檔案唔係支援嘅 UTF-8 文字，現有文字不變。'); }
    finally { if(current === generation) picker.value = ''; }
  });
  editor.addEventListener('input', () => { generation++; });
  const content = () => { if (encode(editor.value).byteLength > MAX_TEXT_BYTES) throw new Error('Too large'); return editor.value.replace(/\r\n?/g, '\n'); };
  let retainedText;
  const textPreview=node('pre');textPreview.style.whiteSpace='pre-wrap';textPreview.style.overflowWrap='anywhere';
  const retainedDownload=button(fileRow,'Download retained text output','下載保留文字輸出',()=>{if(!retainedText)return;const url=URL.createObjectURL(retainedText.output);const link=node('a');link.href=url;link.download=retainedText.outputName;link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);report('Retained output download requested. Confirm the final save in browser downloads.','已要求下載保留輸出，請喺瀏覽器下載記錄確認最後儲存。');});retainedDownload.disabled=true;
  for(const [format,en,zh]of[['txt','Queue UTF-8 text conversion','將 UTF-8 文字轉換排入佇列'],['md','Queue Markdown-source conversion','將 Markdown 原文轉換排入佇列'],['json','Queue JSON text envelope','將 JSON 文字封裝排入佇列']]){
    const run=button(fileRow,en,zh,()=>{});
    bindDurableConverter({category:'text',run,inputs:[editor,picker],report,acceptResult:item=>item.options.format===format,
      request:()=>({category:'text',name:'Local text draft',sources:[new Blob([editor.value],{type:'text/plain'})],options:{format}}),
      async onResult(item,isCurrent){const value=await item.output.text();if(!isCurrent())return;retainedText=item;retainedDownload.disabled=false;textPreview.textContent=text('Preview of the first 2,000 characters; the retained download contains all output.','預覽首 2,000 字元，保留下載包含完整輸出。')+'\n'+value.slice(0,2000);}
    });
  }
  button(fileRow, 'Clear selected text', '清除已選文字', () => { generation++; editor.value = ''; picker.value = ''; event('cleared'); report('Editor cleared. The source file and retained queued copies are unchanged.', '已清除編輯器，來源檔案同保留佇列副本不變。'); });
  node('p', 'Markdown output preserves source text; it does not render or sanitize embedded markup. The JSON text envelope preserves the entire normalized text as one string, and is not a visitor-plan backup. Line endings normalize to LF. Downloads do not overwrite the source file. Editor discovery and opening a native editor require the installed app; this public page cannot confirm an editor installation.', 'Markdown 輸出保留原文，唔會顯示或淨化內嵌標記。JSON 文字封裝會將全部已統一換行嘅文字保留為一個字串，唔係訪客計劃備份。換行會統一為 LF。下載唔會覆寫來源檔案。偵測同開啟原生編輯器需要已安裝程式，此公開頁無法確認編輯器安裝狀態。');
  visitor.querySelector('#companion-title')?.closest('section')?.before(root);
  if (!root.isConnected) visitor.append(root);
  mountBrowserTone(visitor);
  mountBrowserPreferences(visitor);
  mountBrowserRecords(visitor);
  mountBrowserAppearance(visitor);
  mountBrowserSchedule(visitor, applyPreferences);
  mountBrowserLogo(visitor);
  const authenticator = mountBrowserAuthenticator(visitor);
  mountBrowserLocks(visitor, authenticator);
  mountBrowserConverter(visitor);
  mountBrowserDocuments(visitor);
  mountBrowserMedia(visitor);
  mountBrowserTable(visitor);
  mountBrowserBinary(visitor);
  mountBrowserNavigation(visitor);
  mountBrowserTabs(visitor);
  mountBrowserGuidance(visitor);
  protectBrowserMutation(visitor.querySelector('#visitor-reset'),()=>text('Clear the current visitor goal, notes and checklist in this browser. Recovery copies, learning progress, preferences and companion sessions are not cleared. Export or save a recovery copy first if needed.','清除此瀏覽器目前訪客目標、筆記同清單。不會清除復原副本、學習進度、偏好或配對連線。如有需要請先匯出或儲存復原副本。'));
  protectBrowserMutation(visitor.querySelector('#visitor-import'),()=>text('Replace the current visitor goal, notes and checklist with the validated backup entered above. Invalid input changes nothing. Recovery copies and companion sessions are not replaced.','以上方輸入且通過驗證嘅備份取代目前訪客目標、筆記同清單。無效輸入不會更改資料，亦唔會取代復原副本或配對連線。'));
  localized.forEach(update => update());
  document.querySelector('#language')?.addEventListener('change', () => localized.forEach(update => update()));
  document.addEventListener('browser-native-copy-change', () => localized.forEach(update => update()));
}


















