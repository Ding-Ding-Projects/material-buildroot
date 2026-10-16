import { mountCompanionConsumers } from './companion-consumers.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/switch/switch.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/progress/linear-progress.js';
import '@fontsource-variable/roboto';
import './style.css';

const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Preferences remain usable without storage. */ } };
document.querySelectorAll('.article-bookmark[data-bookmark-url]').forEach(button => button.addEventListener('click', () => {
  const key='mb-learning-workspace-v1';
  try {
    const value=JSON.parse(localStorage.getItem(key)||'null');
    const state=value?.version===1?value:{version:1,step:0,complete:[],answer:[],bookmarks:[]};
    const url=button.dataset.bookmarkUrl,title=button.dataset.bookmarkTitle;
    state.bookmarks=Array.isArray(state.bookmarks)?state.bookmarks.filter(item=>item?.url!==url):[];
    state.bookmarks.unshift({url,title});state.bookmarks=state.bookmarks.slice(0,100);
    localStorage.setItem(key,JSON.stringify(state));
    const mode=document.documentElement.dataset.language;
    button.textContent=mode==='zh'?'已儲存參考':mode==='both'?'Saved reference · 已儲存參考':'Reference saved';
    button.setAttribute('aria-pressed','true');
  } catch { button.textContent=document.documentElement.dataset.language==='zh'?'無法儲存':'Could not save'; }
}));
const language = document.querySelector('#language');
const setLanguage = (mode) => {
  document.documentElement.dataset.language = mode;
  document.documentElement.lang = 'en'; // Articles retain English; translated spans declare zh-HK.
  document.querySelectorAll('[data-aria-en][data-aria-zh]').forEach(element => {
    element.setAttribute('aria-label', mode==='en' ? element.dataset.ariaEn : mode==='zh' ? element.dataset.ariaZh : `${element.dataset.ariaEn} · ${element.dataset.ariaZh}`);
  });
  if (language) language.value = mode;
  save('mb-docs-language', mode);
};
setLanguage(read('mb-docs-language', 'both'));
language?.addEventListener('change', () => setLanguage(language.value));

const taskGuides = {
  vocabulary: {label:['Personal vocabulary','個人詞彙'], stages:[
    {id:'import',title:['Import a local vocabulary file','匯入本機詞彙檔'],body:['In the desktop app, use its dedicated local vocabulary control and select a JSON file. The admitted format is schemaVersion 1 with an entries object, bounded to 262,144 input bytes. This website does not accept or inspect vocabulary files or their contents.','喺桌面程式使用專用本機詞彙控制項，選擇 JSON 檔案。格式為 schemaVersion 1 同 entries 物件，輸入上限 262,144 位元組。此網站不會接收或檢查詞彙檔案及其內容。'],next:['The app validates the complete file before selection. Invalid input leaves an earlier valid selection in place. Check only its generic status, then consult the security contract if it reports a problem.','程式會先驗證完整檔案，再套用內容。格式無效時會保留之前有效嘅詞彙。只檢查一般狀態；如有問題，請參閱安全規格。'],url:'docs/security/personal-vocabulary.md'},
    {id:'replace',title:['Replace without losing the current selection','安全取代現有詞彙'],body:['A valid replacement becomes selected only after validation and durable storage. Failed validation or storage preserves the previous valid selection. Do not paste private mappings into this browser guide.','只有新詞彙通過驗證並成功儲存後，先會取代目前所選嘅本機詞彙。驗證或儲存失敗會保留之前有效內容。請勿喺此瀏覽器指南貼上私人詞彙。'],next:['Review the app status and keep the old selection until replacement is confirmed. File names, mappings, counts and hashes are excluded from ordinary status and export records.','檢查程式狀態，並喺確認取代前保留舊內容。檔名、映射、數量同雜湊值都唔會列入一般狀態或匯出記錄。'],url:'docs/security/personal-vocabulary.md'},
    {id:'clear',title:['Clear the local selection','清除本機詞彙'],body:['The desktop panel suppresses personal substitutions as soon as you choose Clear. A successful IndexedDB deletion clears the selection. If deletion fails, the app keeps substitutions suppressed and disables further vocabulary changes until a full app reload. This browser guide does not change a real cache.','喺桌面面板選擇「清除」後，個人詞彙會即時停止套用。IndexedDB 成功刪除後，選取內容亦會清除。如果刪除失敗，程式會繼續停用個人詞彙，並禁止進一步變更，直至完整重新載入程式。此瀏覽器指南不會更改真實快取。'],next:['A full app reload revalidates the retained cache. If it is still valid, the previous selection may become active again. Check the generic status and decide whether to retry or replace it.','完整重新載入程式後會重新驗證保留嘅快取。如果內容仍有效，之前嘅選取可能會再次啟用。請檢查一般狀態，再決定重試清除或取代內容。'],url:'docs/security/personal-vocabulary.md'},
    {id:'shared-active',title:['Shared preference is active','共用偏好已啟用'],body:['An active shared preference suppresses personal vocabulary and its discoverable controls. The prior local selection is retained so it can return only after a successfully verified exit. This guide does not inspect your app or local cache.','共用偏好啟用時，個人詞彙及其可發現控制項會停用。原有本機詞彙會保留，只有成功驗證退出後先可恢復。此指南不會檢查程式或本機快取。'],next:['Use the shared preference panel to review its observed status. Do not route vocabulary bytes through shared mode, project exports or the companion.','使用共用偏好面板查看實際觀察到嘅狀態。唔好透過共用偏好、項目匯出或伴隨連線傳送詞彙內容。'],url:'docs/security/shared-mode.md'},
    {id:'shared-unknown',title:['Shared preference status is unavailable','無法取得共用偏好狀態'],body:['Unavailable is not the same as inactive. Keep personal vocabulary suppressed until the app can refresh and confirm shared state; do not guess from a missing record or browser-local flag.','無法取得狀態唔等於已停用。程式重新整理並確認共用狀態前，請保持個人詞彙停用；唔好根據記錄缺失或瀏覽器本機標記推斷。'],next:['Refresh from the app shared preference panel. If it remains unavailable, follow its manual recovery instructions and keep the vocabulary cache untouched.','喺程式嘅共用偏好面板重新整理。如果仍無法取得，請按手動復原指引處理，並保留詞彙快取不變。'],url:'docs/security/shared-mode.md'}
  ]},
  shared: {label:['Shared preference','共用偏好'], stages:[
    {id:'enter',title:['Enter only after checking current state','先檢查目前狀態再進入'],body:['Refresh shared preference and confirm its configured state and exact display name. Entering records the active preference, but does not prove a future exit credential check will succeed.','重新整理共用偏好，確認目前設定狀態及實際顯示名稱。進入會記錄偏好為啟用，但唔代表日後退出憑證驗證必定成功。'],next:['Before entry, understand the configured exit factor and user-managed recovery route. This is an experience preference, not a security boundary.','進入前先了解已設定嘅退出驗證方式及使用者自行管理嘅復原途徑。此服務係使用體驗偏好，唔係安全邊界。'],url:'docs/security/shared-mode.md'},
    {id:'verified-exit',title:['Confirm a verified exit','確認已驗證退出'],body:['The current adapter supports shared PIN or password verification. Passkey verification is not available. Only a confirmed successful exit restores prior interface preferences and vocabulary. A click or changed screen alone is not proof.','目前介面只支援使用共用 PIN 或密碼驗證退出，尚未提供通行密鑰驗證。只有確認成功退出後，先可恢復之前嘅介面偏好及詞彙。單憑按鈕點擊或畫面變化唔算證明。'],next:['Check the confirmed state in the shared preference panel. If neither supported credential can be verified, keep the restricted state and use the documented manual recovery route.','喺共用偏好面板檢查已確認嘅狀態。如果兩種支援嘅憑證都無法驗證，請保持受限狀態並使用文件所述嘅手動復原途徑。'],url:'docs/security/shared-mode.md'},
    {id:'unavailable-exit',title:['Exit verification is unavailable','退出驗證無法使用'],body:['Do not report the preference inactive when the vault or verifier cannot confirm exit. Preserve current state and use the documented user-managed recovery route. This guide never asks for or stores a secret.','保護儲存或驗證程序無法確認退出時，唔好報稱偏好已停用。請保留目前狀態，並使用文件所述由使用者管理嘅復原途徑。此指南不會要求或儲存任何秘密。'],next:['Refresh shared status and follow the exact manual recovery instructions shown by the installed app. Do not delete a record or reset a credential blindly.','重新整理共用狀態，並依照已安裝程式顯示嘅確切手動復原指引操作。唔好盲目刪除記錄或重設憑證。'],url:'docs/security/shared-mode.md'},
    {id:'recovery',title:['Use the user-managed recovery route','使用由使用者管理嘅復原途徑'],body:['The app may provide manual instructions that identify the configured shared record location. Review the disclosure and exact effect before acting. A user-managed reset affects participating applications and is not an app-side credential bypass.','程式可能會提供手動指引，列明已設定嘅共用記錄位置。操作前先查看披露內容及實際影響。使用者自行管理嘅重設會影響參與程式，唔係應用程式繞過憑證。'],next:['After recovery, refresh and verify actual shared preference state. An absent or unreadable record is not proof of a successful exit.','完成復原後，重新整理並驗證實際共用偏好狀態。記錄不存在或無法讀取都唔代表已成功退出。'],url:'docs/security/shared-mode.md'}
  ]},
  queue: {label:['Build queue recovery','建置佇列復原'], stages:[
    {id:'blocked-intent',title:['A queued job is blocked','佇列工作受阻'],body:['A queued item retains intent, but it has not run and is not evidence of a successful build. The scheduler can return an actionable blocked reason while preserving the queued job.','排入佇列嘅項目會保留原有意圖，但尚未執行，亦唔係建置成功嘅證據。排程器可以保留該工作，同時回報可處理嘅受阻原因。'],next:['Read the exact reason and prerequisite in the app. Resolve only the documented blocker, then authorize a fresh scheduling pass. Do not infer success, cancellation or free capacity.','喺程式查看確切原因同先決條件。只處理文件所列嘅阻礙，再授權重新排程。唔好推斷工作已成功、取消或容量已釋放。'],url:'docs/desktop/execution.md'},
    {id:'reauthorize',title:['Renew project and external-tree authority','重新授權項目及外部來源樹'],body:['After restart, queued work requires a new host-validated scheduling pass. Reauthorize the same ordered external paths through the native project workflow. Persisted descriptors are not fresh filesystem grants.','重新啟動後，佇列工作需要重新通過主機驗證排程。請透過原生項目流程，按相同順序重新授權外部路徑。已保存嘅描述資料唔係新檔案系統授權。'],next:['If renewed authority is unavailable or paths changed, keep the work blocked and inspect current app status. This browser guide contains no host paths and grants nothing.','如無法重新授權或路徑已變更，請保持工作受阻並檢查程式目前狀態。此瀏覽器指南不包含主機路徑，亦不會授予權限。'],url:'docs/desktop/execution.md'},
    {id:'quarantine',title:['Runtime cleanup remains quarantined','執行環境清理仍處於隔離狀態'],body:['When cleanup cannot be verified, the job remains interrupted and a durable quarantine reserves uncertain capacity across restart. New build admission and overlapping mutations stay blocked. A cancellation request is not confirmed cancellation.','執行環境清理未能驗證時，工作會保持中斷，持久隔離記錄會在重新啟動後保留不確定嘅資源佔用。新建置及重疊變更會繼續受阻。取消要求唔代表已確認取消。'],next:['Do not retry or assume the runtime stopped. Review the quarantine reason and complete ownership and capacity checks required for reconciliation. Independent read-only inspection remains separate.','唔好重試或假設執行環境已停止。請查看隔離原因，並完成復原所需嘅擁有權及資源檢查。獨立唯讀檢查仍可分開進行。'],url:'docs/desktop/execution.md'},
    {id:'reconcile',title:['Reconcile only with fresh verified evidence','只根據最新已驗證證據復原'],body:['Reconciliation requires renewed native project and external-tree authority, a read-only ownership result of verified-stopped, and fresh known CPU, memory and storage observations. Unknown or changed runtime identity preserves quarantine.','復原需要重新取得原生項目及外部樹授權、唯讀擁有權檢查確認已停止，以及最新而且已知嘅 CPU、記憶體同儲存空間數據。執行環境身分未知或已改變時，隔離狀態會保留。'],next:['Use explicit reconciliation only when every condition is met. It does not kill an arbitrary process, reconnect the old build or mark an interrupted job successful.','只有全部條件符合時，先使用程式明確提供嘅復原流程。該流程唔會終止任意程序、重新連接舊建置或將中斷工作標記為成功。'],url:'docs/desktop/execution.md'}
  ]},
  catalogue: {label:['Official model catalogue','官方模型目錄'], stages:[
    {id:'observed',title:['Read an observed official-source snapshot','查看官方來源觀察快照'],body:['The catalogue records a bounded traversal of public official library and tag pages. It is an observation, not an authoritative complete or simultaneous inventory. The displayed revision hashes the retained local snapshot.','模型目錄記錄對官方公開資料庫及標籤頁面嘅有限遍歷結果。這是一次觀察，唔係權威、完整或同步嘅總清單。顯示嘅修訂雜湊係本機保存快照嘅雜湊。'],next:['Check snapshot time, source availability, staleness and traversal completeness. Even a recent observation may differ from the upstream library now.','查看快照時間、來源可用狀態、過時程度同遍歷完整度。即使剛完成觀察，內容仍可能與目前官方資料庫不同。'],url:'docs/desktop/built-in-tools.md'},
    {id:'refresh',title:['Review a catalogue refresh','檢視模型目錄更新'],body:['Refresh uses fixed official HTTPS library and tag-list routes, bounded workers, request sizes and an overall deadline. An incomplete traversal preserves the last valid snapshot rather than replacing it with partial results.','更新只會使用固定官方 HTTPS 資料庫及標籤頁面路徑，並限制並行工作、要求大小同整體時限。遍歷未完成時會保留上一份有效快照，不會以部分結果取代。'],next:['A complete observed traversal still has exhaustive=false and metadataComplete=false because the source provides no authoritative total or atomic revision.','即使遍歷完整，exhaustive 同 metadataComplete 仍為 false，因為來源沒有權威總數或原子修訂版本。'],url:'docs/desktop/built-in-tools.md'},
    {id:'cancel',title:['Interpret refresh cancellation','理解取消更新嘅結果'],body:['An accepted cancellation before publication aborts active requests and preserves the previous snapshot. Once atomic publication has begun, cancellation is no longer accepted and the result must be read back.','發佈前成功接受嘅取消會中止進行中嘅要求並保留上一份快照。原子發佈一旦開始，就不再接受取消，必須再查看實際結果。'],next:['Distinguish an accepted abort from CATALOGUE_COMMIT_IN_PROGRESS. Never describe a late rejected cancellation as if refresh stopped.','請分清已接受嘅中止同 CATALOGUE_COMMIT_IN_PROGRESS。取消太遲而被拒絕時，唔好聲稱更新已停止。'],url:'docs/desktop/built-in-tools.md'},
    {id:'unknown-metadata',title:['Keep missing model metadata unknown','將缺少嘅模型資料保持為未知'],body:['Missing exact size, context length, capability, quantization or license remains unknown. Model names and approximate display strings do not establish these properties or prove runtime fit.','缺少確切大小、上下文長度、功能、量化或授權資料時，狀態必須保持未知。模型名稱同近似顯示文字唔能證明以上屬性，亦唔能證明執行環境適用。'],next:['Retain null or Unknown for fields not actually admitted. Remote catalogue metadata does not establish a successful local install or model load.','未有實際驗證嘅欄位要保留 null 或 Unknown。遠端目錄資料唔能證明本機安裝或載入成功。'],url:'docs/desktop/built-in-tools.md'}
  ]}
};


// The field guide is a browser-native learning aid. Its storage is personal,
// bounded, and deliberately separate from the desktop companion session.
const learning = document.querySelector('#learning-workspace');
if (learning) {
  const key = 'mb-learning-workspace-v1';
  let storageAvailable = true;
  const steps = [
    {title:['Choose a source and review the consent boundary','選擇來源並了解確認界線'],body:['A project plan begins with a source tree. The desktop app asks you to choose a local folder and confirm adoption; this guide cannot open or inspect one.','項目計劃由來源樹開始。桌面程式會要求你選擇本機資料夾並確認採用；此指南無法開啟或檢查資料夾。'],check:['Decide which source tree you intend to use and who owns its changes.','先決定要使用哪個來源樹，以及由誰負責管理變更。'],ref:['Source adoption and project ownership','來源採用與項目擁有權'],'url':'docs/desktop/modern-workspace.md'},
    {title:['Keep source, build output and artifacts distinct','分開來源、建置輸出與產物'],body:['The source tree is the input. Build output is a separate writable directory. Images and logs are outputs to inspect and retain. Keeping these roles distinct makes cleanup and review safer.','來源樹是輸入；建置輸出應放在獨立可寫入資料夾；映像檔與記錄則是要檢查和保存的產物。分清用途有助安全清理和審核。'],check:['Write down one source path and a different build-output path before starting.','開始前記下來源路徑和另一個建置輸出路徑。'],ref:['Project layout and workspace','項目結構與工作區'],'url':'docs/desktop/modern-workspace.md'},
    {title:['Discover a runtime before choosing a build','選擇建置前先確認執行環境'],body:['Runtime discovery reports candidates. A discovered WSL or Docker runtime does not prove that it can build your chosen tree. Review the adapter limits and prerequisites before a real run.','執行環境偵測只會列出候選項目。發現 WSL 或 Docker 不代表它一定可以建置指定來源。真正執行前請檢視介面限制和先決條件。'],check:['Record the runtime candidate and the exact prerequisites you still need to verify.','記下執行環境候選項目，以及仍需核實的先決條件。'],ref:['Execution adapters and limits','執行介面與限制'],'url':'docs/desktop/execution.md'},
    {title:['Treat configuration as typed, reviewable input','把配置視為可審核的型別化輸入'],body:['A configuration view should preserve symbol types, defaults, dependencies and the source revision. Reconcile a generated configuration against its source before you trust it.','配置檢視應保留符號型別、預設值、相依項目和來源修訂版本。信任產生的配置前，先與來源核對。'],check:['Check which source revision the configuration belongs to and what changed.','確認配置屬於哪個來源修訂版本，以及有哪些變更。'],ref:['Configuration and package models','配置與套件模型'],'url':'docs/desktop/configuration.md'},
    {title:['Review the job and its evidence','檢視工作狀態和證據'],body:['A job can fail or become uncertain. Read its recorded exit state and logs, then verify that the expected output exists. A queued job is not evidence of a completed build.','工作可能失敗或狀態未明。查看記錄的結束狀態和記錄檔，再確認預期輸出確實存在。排入工作佇列不代表建置完成。'],check:['Name the evidence you would require before calling this build successful.','列出你判定建置成功前需要的證據。'],ref:['Jobs, artifacts and recovery','工作、產物與復原'],'url':'docs/desktop/execution.md'}
  ];
  const workflowIds = new Set(Object.entries(taskGuides).flatMap(([family,guide])=>guide.stages.map(stage=>`workflow:${family}:${stage.id}`)));
  const allowed = new Set([...steps.map((_,i)=>String(i)),...workflowIds]);
  const fresh = () => ({version:1, step:0, workflowFamily:'vocabulary', workflowStage:'import', complete:[], answer:[] , bookmarks:[]});
  const readState = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value?.version !== 1) return fresh();
      const workflowFamily=Object.hasOwn(taskGuides,value.workflowFamily)?value.workflowFamily:'vocabulary';
      const familyGuide=taskGuides[workflowFamily];
      const workflowStage=familyGuide.stages.some(item=>item.id===value.workflowStage)?value.workflowStage:familyGuide.stages[0].id;
      return {version:1,step:Math.max(0,Math.min(steps.length-1,Number.isInteger(value.step)?value.step:0)),workflowFamily,workflowStage,complete:Array.isArray(value.complete)?[...new Set(value.complete.filter(x=>allowed.has(String(x))))]:[],answer:Array.isArray(value.answer)?value.answer.slice(0,3).filter(x=>['yes','no','unknown'].includes(x)):[],bookmarks:Array.isArray(value.bookmarks)?value.bookmarks.filter(x=>x&&typeof x.url==='string'&&typeof x.title==='string'&&x.url.startsWith('/material-buildroot/site/articles/')).slice(0,100):[]};
    } catch { storageAvailable=false; return fresh(); }
  };
  let state = readState();
  const mode = () => document.documentElement.dataset.language;
  const copy = (en,zh) => mode()==='zh' ? zh : mode()==='both' ? `${en} · ${zh}` : en;
  const persist = () => { try { localStorage.setItem(key,JSON.stringify(state));storageAvailable=true; } catch { storageAvailable=false; } };
  const setBilingual = (node,pair) => { node.replaceChildren(); for (const [lang,text] of [['en',pair[0]],['zh-HK',pair[1]]]) { const span=document.createElement('span');span.className=lang==='en'?'en':'zh';span.lang=lang;span.textContent=text;node.append(span); } };
  const stageSelect=learning.querySelector('#workflow-stage');
  const renderWorkflow = () => {
    const familySelect=learning.querySelector('#workflow-family');
    const family=taskGuides[state.workflowFamily]||taskGuides.vocabulary;
    if(familySelect.value!==state.workflowFamily)familySelect.value=state.workflowFamily;
    familySelect.querySelectorAll('md-select-option').forEach(option=>{const guide=taskGuides[option.value],headline=option.querySelector('[slot="headline"]');if(guide&&headline)headline.textContent=copy(guide.label[0],guide.label[1]);});
    familySelect.label=copy('Workflow','工作流程');familySelect.setAttribute('aria-label',copy('Choose a workflow','選擇工作流程'));
    const previous=state.workflowStage;
    stageSelect.replaceChildren();
    for(const stage of family.stages){const option=document.createElement('md-select-option');option.value=stage.id;option.setAttribute('value',stage.id);const headline=document.createElement('div');headline.slot='headline';headline.textContent=copy(stage.title[0],stage.title[1]);option.append(headline);stageSelect.append(option);}
    state.workflowStage=family.stages.some(item=>item.id===previous)?previous:family.stages[0].id;
    stageSelect.value=state.workflowStage;stageSelect.label=copy('Situation','情況');stageSelect.setAttribute('aria-label',copy('Choose a situation','選擇情況'));
    const current=family.stages.find(item=>item.id===state.workflowStage);
    learning.querySelector('#workflow-kicker').textContent=copy(family.label[0],family.label[1]);
    setBilingual(learning.querySelector('#workflow-stage-title'),current.title);
    setBilingual(learning.querySelector('#workflow-stage-body'),current.body);
    setBilingual(learning.querySelector('#workflow-stage-next'),current.next);
    const reference=learning.querySelector('#workflow-reference');reference.href=`/material-buildroot/site/articles/${current.url.replace(/\.md$/,'.html')}`;reference.textContent=copy('Open the supporting contract','開啟相關規格');
    const id=`workflow:${state.workflowFamily}:${state.workflowStage}`,done=state.complete.includes(id),button=learning.querySelector('#workflow-complete');
    button.disabled=false;setBilingual(button,done?['Guide step saved as complete','已記錄此指南步驟完成']:['Mark this guide step complete','標記此指南步驟已完成']);button.setAttribute('aria-pressed',String(done));
    setBilingual(learning.querySelector('#workflow-status'),done?['Progress is stored in this browser only.','進度只儲存喺此瀏覽器。']:['This is a visitor learning example. No desktop action was run.','呢個係訪客學習示例，並無執行任何桌面操作。']);
  };
  learning.querySelector('#workflow-family').addEventListener('change',()=>{state.workflowFamily=taskGuides[learning.querySelector('#workflow-family').value]?learning.querySelector('#workflow-family').value:'vocabulary';state.workflowStage=taskGuides[state.workflowFamily].stages[0].id;persist();renderWorkflow();});
  stageSelect.addEventListener('change',()=>{const family=taskGuides[state.workflowFamily];if(family.stages.some(item=>item.id===stageSelect.value)){state.workflowStage=stageSelect.value;persist();renderWorkflow();}});
  learning.querySelector('#workflow-complete').addEventListener('click',()=>{const id=`workflow:${state.workflowFamily}:${state.workflowStage}`;state.complete=state.complete.includes(id)?state.complete.filter(item=>item!==id):[...state.complete,id];persist();renderWorkflow();renderStep();});
  const rail=learning.querySelector('#walkthrough-rail');
  const renderStep = () => {
    const item=steps[state.step];
    rail.replaceChildren();
    const shortTitles=[['Choose source','選擇來源'],['Separate folders','分開資料夾'],['Check runtime','檢查執行環境'],['Review config','檢視配置'],['Inspect outputs','檢查輸出']];
    steps.forEach((step,index)=>{const button=document.createElement('md-outlined-button');button.className='walkthrough-step';button.dataset.step=String(index);button.setAttribute('aria-current',index===state.step?'step':'false');const done=state.complete.includes(String(index))?' ✓':'';button.setAttribute('aria-label',`${index+1}. ${step.title[0]}${done} · ${index+1}. ${step.title[1]}${done}`);button.title=`${step.title[0]} · ${step.title[1]}`;setBilingual(button,[`${index+1}. ${shortTitles[index][0]}${done}`,`${index+1}. ${shortTitles[index][1]}${done}`]);button.addEventListener('click',()=>{state.step=index;persist();renderStep();});rail.append(button);});
    learning.querySelector('#walkthrough-step-count').textContent=copy(`Step ${state.step+1} of ${steps.length}`,`第 ${state.step+1} 步，共 ${steps.length} 步`);
    learning.querySelector('#walkthrough-kicker').textContent=copy('SOURCE TO IMAGE','由來源到映像');
    setBilingual(learning.querySelector('#walkthrough-step-title'),item.title);setBilingual(learning.querySelector('#walkthrough-step-body'),item.body);setBilingual(learning.querySelector('#walkthrough-check'),item.check);
    const ref=learning.querySelector('#walkthrough-reference');ref.href=`/material-buildroot/site/articles/${item.url}`;ref.textContent=copy(`Read: ${item.ref[0]}`,`閱讀：${item.ref[1]}`);
    learning.querySelector('#walkthrough-back').disabled=state.step===0;learning.querySelector('#walkthrough-next').disabled=state.step===steps.length-1;
    learning.querySelector('#walkthrough-complete').textContent=copy(state.complete.includes(String(state.step))?'Completed':'Mark this step complete',state.complete.includes(String(state.step))?'已完成':'標記此步驟已完成');
    learning.querySelector('#walkthrough-status').textContent=state.complete.includes(String(state.step))?copy('This step is saved as complete in this browser.','此步驟已記錄為完成，資料只存於此瀏覽器。'):'';
    const total=steps.length+workflowIds.size,done=state.complete.length;learning.querySelector('#learning-progress').value=done/total;learning.querySelector('#learning-progress-label').textContent=storageAvailable?copy(`${done} of ${total} guide steps completed. Progress stays in this browser.`,`${done}/${total} 個指南步驟已完成。進度只存於此瀏覽器。`):copy(`${done} of ${total} guide steps completed. Browser storage is unavailable, so progress will not survive a reload.`,`${done}/${total} 個指南步驟已完成。瀏覽器儲存空間無法使用，重新載入後進度會消失。`);
  };
  learning.querySelector('#walkthrough-back').addEventListener('click',()=>{state.step=Math.max(0,state.step-1);persist();renderStep();});
  learning.querySelector('#walkthrough-next').addEventListener('click',()=>{state.step=Math.min(steps.length-1,state.step+1);persist();renderStep();});
  learning.querySelector('#walkthrough-complete').addEventListener('click',()=>{const id=String(state.step);state.complete=state.complete.includes(id)?state.complete.filter(x=>x!==id):[...state.complete,id];persist();renderStep();});
  learning.querySelector('#learning-reset').addEventListener('click',()=>{state.step=0;state.complete=[];persist();renderStep();renderWorkflow();learning.querySelector('#learning-storage-status').textContent=copy('Walkthrough progress cleared from this browser. Saved references are kept.','已清除此瀏覽器內的引導進度。已儲存參考資料會保留。');});
  const fields=['name','version','site','license'].map(id=>learning.querySelector(`#recipe-${id}`));
  const syncFields=()=>fields.forEach(field=>{field.label=copy(field.dataset.labelEn,field.dataset.labelZh);field.supportingText=copy(field.dataset.supportingEn,field.dataset.supportingZh);});
  const generate=()=>{
    const [name,version,site,license]=fields.map(f=>f.value.trim());let message='';
    let parsed;try{parsed=new URL(site);}catch{}
    if(!/^[a-z][a-z0-9_-]{0,39}$/.test(name))message=copy('Use a lowercase identifier starting with a letter (up to 40 characters).','識別碼須以小寫字母開頭，最多 40 個字元。');
    else if(!/^[0-9][A-Za-z0-9._+-]{0,31}$/.test(version))message=copy('Use a version starting with a number and containing up to 32 safe characters.','版本須以數字開頭，最多 32 個安全字元。');
    else if(!parsed||parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname.split('/').includes('..')||parsed.pathname==='/'||parsed.pathname.endsWith('/')===false)message=copy('Use an HTTPS release directory ending in a slash, without credentials, query or fragment.','請使用以斜線結尾的 HTTPS 發佈目錄，不可含登入資料、查詢或片段。');
    else if(!/^[A-Za-z0-9][A-Za-z0-9.+-]{0,39}$/.test(license))message=copy('Use a bounded SPDX-style license identifier.','請輸入有限長度的 SPDX 格式授權識別碼。');
    const output=learning.querySelector('#recipe-output');
    if(message){output.hidden=true;learning.querySelector('#recipe-status').textContent=message;return;}
    const upper=name.toUpperCase().replace(/[^A-Z0-9]/g,'_');const text=`config BR2_PACKAGE_${upper}\n\tbool "${name}"\n\thelp\n\t  Example package skeleton. Review dependencies before use.\n\n${upper}_VERSION = ${version}\n${upper}_SITE = ${parsed.origin}${parsed.pathname}\n${upper}_SITE_METHOD = https\n${upper}_LICENSE = ${license}\n${upper}_LICENSE_FILES = LICENSE\n\n$(eval $(generic-package))\n`;
    learning.querySelector('#recipe-code').textContent=text;output.hidden=false;learning.querySelector('#recipe-status').textContent=copy('Preview generated locally. No network request, file write or build was made.','已在本機產生預覽，沒有網絡要求、檔案寫入或建置。');
  };
  learning.querySelector('#recipe-generate').addEventListener('click',generate);
  learning.querySelector('#recipe-clear').addEventListener('click',()=>{fields.forEach(f=>f.value='');learning.querySelector('#recipe-output').hidden=true;learning.querySelector('#recipe-status').textContent=copy('Fields cleared.','欄位已清除。');fields[0].focus();});
  fields.forEach(f=>f.addEventListener('input',()=>learning.querySelector('#recipe-status').textContent=''));
  learning.querySelector('#recipe-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(learning.querySelector('#recipe-code').textContent);learning.querySelector('#recipe-status').textContent=copy('Preview copied to clipboard.','預覽已複製到剪貼簿。');}catch{learning.querySelector('#recipe-status').textContent=copy('Clipboard access is unavailable. Select the preview text to copy it.','無法使用剪貼簿，請選取預覽文字複製。');}});
  const questions=[{en:'Do you know which runtime you plan to use?',zh:'你知道打算使用哪個執行環境嗎？',yes:['Review that runtime’s documented prerequisites before a real run.','真正執行前，先檢視該執行環境的文件先決條件。'],no:['Read the runtime discovery guide. Discovery lists candidates; it does not certify build readiness.','閱讀執行環境偵測指南。偵測只列出候選項目，不會認證建置準備狀態。']},{en:'Have you identified a separate writable build-output directory?',zh:'你是否已指定獨立可寫入的建置輸出資料夾？',yes:['Check available disk space and confirm the source tree remains separate.','檢查可用磁碟空間，並確認來源樹保持分離。'],no:['Choose and record a separate output directory before launching a job.','啟動工作前先選擇並記錄獨立的輸出資料夾。']}];
  const renderTroubleshooter=()=>{const i=Math.min(state.answer.length,questions.length-1),q=questions[i],question=learning.querySelector('#troubleshooter-question'),choices=learning.querySelector('#troubleshooter-choices'),result=learning.querySelector('#troubleshooter-result');choices.replaceChildren();if(state.answer.length>=questions.length){question.textContent=copy('Suggested next step','建議下一步');result.hidden=false;setBilingual(result,['Review source ownership, runtime prerequisites and output separation, then run the desktop app’s documented checks. This browser guide has not inspected your system.','檢視來源擁有權、執行環境先決條件和輸出分隔，再執行桌面程式文件所列的檢查。此瀏覽器指南沒有檢查你的系統。']);return;}result.hidden=true;question.textContent=copy(q.en,q.zh);for(const answer of ['yes','no','unknown']){const b=document.createElement(answer==='yes'?'md-filled-button':'md-outlined-button');b.textContent=copy(answer==='yes'?'Yes':answer==='no'?'No':'Not sure',answer==='yes'?'是':answer==='no'?'否':'不確定');b.addEventListener('click',()=>{state.answer.push(answer);persist();renderTroubleshooter();if(answer==='unknown'){result.hidden=false;setBilingual(result,['This answer is a prompt to read the linked runtime guide before proceeding. No system checks were made.','此答案表示應先閱讀相關執行環境指南再繼續。此處沒有檢查系統。']);}});choices.append(b);}};
  learning.querySelector('#troubleshooter-reset').addEventListener('click',()=>{state.answer=[];persist();renderTroubleshooter();});
  const renderBookmarks=()=>{const list=learning.querySelector('#learning-bookmarks');list.replaceChildren();learning.querySelector('#bookmark-count').textContent=copy(`${state.bookmarks.length} saved`,`已儲存 ${state.bookmarks.length} 項`);learning.querySelector('#bookmarks-empty').hidden=state.bookmarks.length>0;for(const item of state.bookmarks){const row=document.createElement('md-list-item');row.type='link';row.href=item.url;const title=document.createElement('span');title.slot='headline';title.textContent=item.title;const remove=document.createElement('md-outlined-button');remove.slot='end';remove.textContent=copy('Remove','移除');remove.setAttribute('aria-label',copy(`Remove ${item.title}`,`移除${item.title}`));remove.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();state.bookmarks=state.bookmarks.filter(b=>b.url!==item.url);persist();renderBookmarks();});row.append(title,remove);list.append(row);}};
  document.querySelectorAll('[data-bookmark-url][data-bookmark-title]').forEach(button=>button.addEventListener('click',()=>{const url=button.dataset.bookmarkUrl,title=button.dataset.bookmarkTitle;if(!url?.startsWith('/material-buildroot/site/articles/'))return;if(!state.bookmarks.some(x=>x.url===url))state.bookmarks.unshift({url,title:title.slice(0,180)});state.bookmarks=state.bookmarks.slice(0,100);persist();renderBookmarks();learning.querySelector('#learning-storage-status').textContent=copy('Reference saved in this browser.','參考資料已儲存在此瀏覽器。');}));
  renderStep();renderWorkflow();renderTroubleshooter();renderBookmarks();syncFields();learning.querySelector('#recipe-generate').click();
  language?.addEventListener('change',()=>{renderStep();renderWorkflow();renderTroubleshooter();renderBookmarks();syncFields();});
}
const theme = document.querySelector('#theme');
const preferredDark = matchMedia('(prefers-color-scheme: dark)');
const setTheme = (value) => {
  const dark = value === 'system' ? preferredDark.matches : value === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (theme) { theme.selected = dark; theme.setAttribute('aria-label', dark ? 'Use light theme' : 'Use dark theme'); }
};
setTheme(read('mb-docs-theme', 'system'));
preferredDark.addEventListener('change', () => { if (read('mb-docs-theme', 'system') === 'system') setTheme('system'); });
theme?.addEventListener('change', () => { const value = theme.selected ? 'dark' : 'light'; save('mb-docs-theme', value); setTheme(value); });
document.querySelector('#system-theme')?.addEventListener('click', () => { save('mb-docs-theme', 'system'); setTheme('system'); });

const menu = document.querySelector('#menu');
const sidebar = document.querySelector('.sidebar');
const narrow = matchMedia('(max-width: 700px)');
const closeMenu = document.querySelector('#close-menu');
const skipLink = document.querySelector('.skip');
const setDrawer = (open, restoreFocus = false) => {
  open = narrow.matches && open;
  const focusWillBeHidden = narrow.matches && !open && sidebar.contains(document.activeElement);
  document.body.classList.toggle('nav-open', open);
  menu?.setAttribute('aria-expanded', String(open));
  sidebar.inert = narrow.matches && !open;
  document.querySelector('main').inert = open;
  document.querySelector('.topbar').inert = open;
  if (skipLink) skipLink.inert = open;
  if (open) {
    sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); sidebar.setAttribute('aria-label', 'Project navigation');
    closeMenu?.focus();
  } else {
    sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal');
    if (restoreFocus || focusWillBeHidden) menu?.focus();
  }
};
setDrawer(false);
narrow.addEventListener('change', () => setDrawer(false));
menu?.addEventListener('click', () => setDrawer(true));
closeMenu?.addEventListener('click', () => setDrawer(false, true));
document.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('nav-open')) return;
  if (event.key === 'Escape') { setDrawer(false, true); return; }
  if (event.key === 'Tab') {
    // Material lists keep only the current item in each list in the Tab order.
    // The close button delegates focus to its internal button instead of its host.
    const focusable = [...sidebar.querySelectorAll('md-icon-button, md-list-item, a')]
      .filter(element => (element === closeMenu || element.tabIndex >= 0)
        && !element.disabled && !element.inert && element.getClientRects().length > 0);
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
document.querySelectorAll('.sidebar a, .sidebar md-list-item').forEach(a => a.addEventListener('click', () => setDrawer(false)));

const search = document.querySelector('#doc-search');
const results = document.querySelector('#search-results');
const documents = JSON.parse(document.querySelector('#document-index')?.textContent || '[]');
const searchWrap = search?.closest('.search-wrap');
const closeSearch = () => { if (results) results.hidden = true; };
const showSearch = () => {
  if (!search || !results) return;
  const query = search.value.trim().toLocaleLowerCase();
  results.replaceChildren();
  results.hidden = !query;
  if (!query) return;
  const matches = documents.filter(d => (d.title + ' ' + d.text).toLocaleLowerCase().includes(query));
  const count = document.createElement('p');
  count.className = 'search-count'; count.textContent = matches.length ? `${matches.length} matching ${matches.length === 1 ? 'document' : 'documents'}${matches.length > 12 ? '; showing the first 12. Refine your search for more specific results.' : ''}` : 'No matching documents. Try “WSL”, “canvas” or “phases”.';
  results.append(count);
  for (const match of matches.slice(0, 12)) {
    const list = document.createElement('md-list');
    const link = document.createElement('md-list-item'); link.type = 'link'; link.href = match.url;
    const title = document.createElement('span'); title.slot = 'headline'; title.textContent = match.title;
    const caption = document.createElement('span'); caption.slot = 'supporting-text'; caption.textContent = match.category;
    link.append(title, caption); list.append(link); results.append(list);
  }
};
search?.addEventListener('input', showSearch);
search?.addEventListener('focusin', showSearch);
search?.addEventListener('keydown', async event => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  showSearch();
  const links = results?.querySelectorAll('md-list-item');
  const target = event.key === 'ArrowDown' ? links?.[0] : links?.[links.length - 1];
  if (target) {
    event.preventDefault();
    await target.updateComplete;
    if (!results.hidden && target.isConnected && document.activeElement === search) target.focus();
  }
});
searchWrap?.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || results.hidden) return;
  event.preventDefault();
  search.focus();
  closeSearch();
});
document.addEventListener('pointerdown', event => {
  if (searchWrap && !event.composedPath().includes(searchWrap)) closeSearch();
});
document.addEventListener('focusin', event => {
  if (searchWrap && !event.composedPath().includes(searchWrap)) closeSearch();
});

// Public visitor state is local to this browser profile. It never grants desktop
// or companion authority and stays separate from authenticated companion data.
const visitor = document.querySelector('#visitor-workspace');
if (visitor) {
  const storageKey = 'mb-visitor-workspace-v1';
  const defaults = () => ({version:1, goal:'', notes:'', checks:{'read-roadmap':false,'check-evidence':false,'write-notes':false}, updatedAt:null});
  const loadVisitor = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaults();
      const value = JSON.parse(raw);
      if (value?.version !== 1 || typeof value.goal !== 'string' || typeof value.notes !== 'string') return defaults();
      const initial = defaults();
      for (const id of Object.keys(initial.checks)) initial.checks[id] = value.checks?.[id] === true;
      initial.goal = value.goal.slice(0,180); initial.notes = value.notes.slice(0,4000);
      initial.updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : null;
      return initial;
    } catch { return defaults(); }
  };
  let visitorState = loadVisitor();
  const goalField = visitor.querySelector('#visitor-goal');
  const notesField = visitor.querySelector('#visitor-notes');
  const saved = visitor.querySelector('#visitor-saved');
  const message = visitor.querySelector('#visitor-message');
  const offlineStatus = visitor.querySelector('#visitor-offline-status');
  const languageMode = () => document.documentElement.dataset.language;
  const copy = (en, zh) => languageMode() === 'zh' ? zh : languageMode() === 'both' ? `${en} · ${zh}` : en;
  const syncVisitorFields = () => {
    visitor.querySelectorAll('[data-label-en]').forEach(field => {
      field.label = copy(field.dataset.labelEn, field.dataset.labelZh);
      field.supportingText = copy(field.dataset.supportingEn, field.dataset.supportingZh);
    });
  };
  const persistVisitor = () => {
    visitorState.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(storageKey, JSON.stringify(visitorState));
      saved.textContent = copy('Saved on this device.', '已儲存喺呢部裝置。');
    } catch {
      saved.textContent = copy('Browser storage is unavailable. Export your work to keep it.', '無法使用瀏覽器儲存空間，請匯出資料以作保存。');
    }
  };
  goalField.value = visitorState.goal; notesField.value = visitorState.notes;
  syncVisitorFields();
  language?.addEventListener('change', syncVisitorFields);
  visitor.querySelectorAll('[data-check]').forEach(box => { box.checked = visitorState.checks[box.dataset.check] === true; });
  goalField.addEventListener('input', () => { visitorState.goal = goalField.value.slice(0,180); persistVisitor(); });
  notesField.addEventListener('input', () => { visitorState.notes = notesField.value.slice(0,4000); persistVisitor(); });
  visitor.querySelectorAll('[data-check]').forEach(box => box.addEventListener('change', () => {
    visitorState.checks[box.dataset.check] = box.checked; persistVisitor();
  }));
  visitor.querySelectorAll('[data-plan-prompt]').forEach(button => button.addEventListener('click', () => {
    visitorState.goal = languageMode() === 'zh' ? button.dataset.planPromptZh : button.dataset.planPrompt;
    goalField.value = visitorState.goal; persistVisitor(); notesField.focus();
  }));
  visitor.querySelector('#visitor-offline').addEventListener('click', async () => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      offlineStatus.textContent = copy('Offline saving needs a secure site and service worker support.', '離線保存需要安全網站同 Service Worker 支援。'); return;
    }
    offlineStatus.textContent = copy('Preparing offline pages…', '正在準備離線頁面…');
    try {
      const registration = await navigator.serviceWorker.register(new URL('../service-worker.js', location.href), {scope:new URL('../', location.href).pathname});
      await navigator.serviceWorker.ready;
      const worker = registration.active || registration.waiting || registration.installing;
      if (!worker) throw new Error('No active service worker');
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { navigator.serviceWorker.removeEventListener('message', receive); reject(new Error('Offline save timed out')); }, 30000);
        const receive = event => {
          if (!['CACHE_COMPLETE','CACHE_ERROR'].includes(event.data?.type)) return;
          clearTimeout(timer); navigator.serviceWorker.removeEventListener('message', receive);
          event.data.type === 'CACHE_COMPLETE' ? resolve(event.data.count) : reject(new Error(event.data.message));
        };
        navigator.serviceWorker.addEventListener('message', receive);
        worker.postMessage('CACHE_DOCUMENTATION');
      });
      offlineStatus.textContent = copy(`${result} site pages saved for offline reading.`, `已保存 ${result} 個網站頁面供離線閱讀。`);
    } catch {
      offlineStatus.textContent = copy('Offline save failed. Check your connection and browser storage, then try again.', '離線保存失敗，請檢查網絡同瀏覽器儲存空間，再試一次。');
    }
  });
  visitor.querySelector('#visitor-export').addEventListener('click', () => {
    const payload = JSON.stringify({...visitorState, exportedAt:new Date().toISOString()}, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([payload], {type:'application/json'}));
    link.download = 'material-buildroot-visitor-workspace.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    message.textContent = copy('Backup downloaded. It contains only this browser workbench.', '備份已下載，只包含呢個瀏覽器工作區資料。');
  });
  visitor.querySelector('#visitor-reset').addEventListener('click', () => {
    visitorState = defaults(); goalField.value = ''; notesField.value = '';
    visitor.querySelectorAll('[data-check]').forEach(box => { box.checked = false; });
    try { localStorage.removeItem(storageKey); saved.textContent = copy('Local work cleared.', '已清除本機資料。'); }
    catch { saved.textContent = copy('Could not clear browser storage.', '無法清除瀏覽器儲存空間。'); }
    message.textContent = '';
  });
  visitor.querySelector('#visitor-import').addEventListener('click', () => {
    try {
      const source = JSON.parse(visitor.querySelector('#visitor-import-json').value);
      const allowedChecks = ['read-roadmap','check-evidence','write-notes'];
      const allowedFields = ['version','goal','notes','checks','updatedAt','exportedAt'];
      if (!source || source.version !== 1 || typeof source.goal !== 'string' || source.goal.length > 180
        || typeof source.notes !== 'string' || source.notes.length > 4000 || !source.checks || typeof source.checks !== 'object'
        || Object.keys(source).some(key => !allowedFields.includes(key))
        || (source.updatedAt !== undefined && source.updatedAt !== null && typeof source.updatedAt !== 'string')
        || (source.exportedAt !== undefined && typeof source.exportedAt !== 'string')
        || Object.keys(source.checks).some(key => !allowedChecks.includes(key))
        || allowedChecks.some(key => source.checks[key] !== undefined && typeof source.checks[key] !== 'boolean')) throw new Error('shape');
      visitorState = {version:1,goal:source.goal,notes:source.notes,checks:Object.fromEntries(allowedChecks.map(key=>[key,source.checks[key]===true])),updatedAt:new Date().toISOString()};
      goalField.value = visitorState.goal; notesField.value = visitorState.notes;
      visitor.querySelectorAll('[data-check]').forEach(box => { box.checked = visitorState.checks[box.dataset.check]; });
      persistVisitor(); message.textContent = copy('Backup validated and imported.', '備份已通過驗證並匯入。');
    } catch {
      message.textContent = copy('That backup is not valid. Your current work is unchanged.', '備份格式無效，現有資料未有改動。');
    }
  });

  const endpointField = visitor.querySelector('#companion-endpoint');
  const challengeField = visitor.querySelector('#companion-challenge');
  const companionMessage = visitor.querySelector('#companion-message');
  const sessionPanel = visitor.querySelector('#companion-connected');
  const endpointStorageKey = 'mb-companion-endpoint-v1';
  const readOnlyScopes = new Set(['workspace:read','projects:read','jobs:read','source:read','outputs:read','jobs:cancel','configuration:read','builds:submit']);
  const actionScope = {'workspace.read':'workspace:read','projects.list':'projects:read','jobs.list':'jobs:read'};
  let companion = null; // Session, CSRF token and sequence intentionally stay in page memory.
  let lastCompanionResult = null;
  let consumerBusy=false;
  const consumerWorkspace=mountCompanionConsumers({container:sessionPanel,copy,
    session:()=>companion?.session||null,
    request:async(action,args)=>{
      const active=companion;
      if(!active||active.sequenceUnknown||consumerBusy)throw Error('SESSION_UNAVAILABLE');
      consumerBusy=true;
      const sequence=active.nextSequence;
      try {
        const {response,payload}=await companionFetch('/actions',{action,args,sequence,nonce:makeUUID()},active.csrfToken);
        if(companion!==active)throw Error('SESSION_CHANGED');
        if(Number.isSafeInteger(payload.nextSequence)&&payload.nextSequence>sequence)active.nextSequence=payload.nextSequence;
        else active.sequenceUnknown=true;
        if(!response.ok){if(response.status===401)clearCompanionMemory();throw Error('ACTION_UNAVAILABLE');}
        if(payload.operation?.action!==action||payload.operation?.sessionId!==active.session.id||payload.operation?.authorityRevoked||payload.operation?.state!=='succeeded'||!Object.hasOwn(payload,'result'))throw Error('INVALID_RESULT');
        return payload.result;
      } catch(error){active.sequenceUnknown=true;throw error;}
      finally{consumerBusy=false;}
    }});

  function parseIPv6(value) {
    if (!/^[0-9a-f:]+$/i.test(value) || value.includes(':::')) return null;
    const halves = value.split('::');
    if (halves.length > 2) return null;
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const pieces = [...left,...right];
    if (pieces.some(part => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
    if (halves.length === 1 && pieces.length !== 8) return null;
    if (halves.length === 2 && pieces.length >= 8) return null;
    const values = [...left.map(part=>parseInt(part,16)),...Array(halves.length===2?8-pieces.length:0).fill(0),...right.map(part=>parseInt(part,16))];
    return values.length === 8 ? values : null;
  }
  function validateCompanionEndpoint(raw) {
    const value = raw.trim();
    const match = /^https:\/\/(\[[0-9a-f:]+\]|(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}):([1-9][0-9]{0,4})$/i.exec(value);
    if (!match) throw new Error('endpoint');
    const port = Number(match[2]);
    if (port < 1 || port > 65535) throw new Error('endpoint');
    const hostText = match[1];
    if (hostText.startsWith('[')) {
      const words = parseIPv6(hostText.slice(1,-1));
      if (!words) throw new Error('endpoint');
      const loopback = words.slice(0,7).every(part=>part===0) && words[7]===1;
      const local = (words[0] & 0xfe00)===0xfc00 || (words[0] & 0xffc0)===0xfe80;
      const mappedV4 = words.slice(0,5).every(part=>part===0) && words[5]===0xffff;
      if ((!loopback && !local) || mappedV4) throw new Error('endpoint');
    } else {
      const octets=hostText.split('.').map(Number);
      if (octets.some(part=>part>255)) throw new Error('endpoint');
      const [a,b]=octets;
      if (!(a===127 || a===10 || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===169&&b===254))) throw new Error('endpoint');
    }
    const parsed = new URL(value);
    if (parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.pathname!=='/' || parsed.search || parsed.hash || !parsed.port) throw new Error('endpoint');
    return parsed.origin;
  }
  const storedEndpoint = read(endpointStorageKey,'');
  if (storedEndpoint) {
    try { endpointField.value = validateCompanionEndpoint(storedEndpoint); }
    catch { save(endpointStorageKey,''); }
  }
  const localizeVisitorFields = () => {
    visitor.querySelectorAll('[data-label-en]').forEach(field => {
      field.label = copy(field.dataset.labelEn, field.dataset.labelZh);
      field.supportingText = copy(field.dataset.supportingEn, field.dataset.supportingZh);
    });
  };
  localizeVisitorFields();
  language?.addEventListener('change', localizeVisitorFields);
  function endpointForRequest() { return validateCompanionEndpoint(endpointField.value); }
  function companionError(code) {
    const messages = {
      PAIRING_REJECTED:copy('The desktop did not approve this challenge, or it expired. Create a new one on the desktop.','桌面未批准此挑戰碼，或挑戰碼已過期。請喺桌面建立新挑戰碼。'),
      ORIGIN_REJECTED:copy('This challenge was created for a different website origin.','此挑戰碼係為另一個網站來源建立。'),
      CSRF_REJECTED:copy('The host rejected the session token. Refresh the session or pair again.','主機拒絕此連線權杖。請更新連線狀態或重新配對。'),
      UNAUTHORIZED:copy('The host session expired or was revoked. Pair again to continue.','主機連線已過期或撤銷。請重新配對。'),
      SCOPE_REJECTED:copy('The host did not grant this read-only action. No data was changed.','主機未授予此唯讀操作，資料未有更改。'),
      REPLAY_REJECTED:copy('The host rejected an out-of-date request sequence. Refresh the session before another action.','主機拒絕過期請求序號。請先更新連線狀態。'),
      ACTION_FAILED:copy('The host could not complete this read request. Its operation record may be unknown; no retry was sent.','主機未能完成讀取要求。操作記錄可能未知；頁面未有重試。')
    };
    return messages[code] || copy('The host rejected the request. Check its status and try again only after reviewing the message.','主機拒絕此要求。請查看狀態訊息，再決定是否重試。');
  }
  async function companionFetch(path, body, csrfToken='') {
    const endpoint = path === '/pair' ? endpointForRequest() : companion?.endpoint;
    if (!endpoint) throw new Error('endpoint-changed');
    const headers = {'Content-Type':'application/json'};
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const response = await fetch(new URL(path,endpoint+'/'), {
      method:'POST', mode:'cors', credentials:'include', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer',
      headers, body:JSON.stringify(body)
    });
    let payload;
    try { payload = await response.json(); } catch { throw new Error('response-invalid'); }
    if (!payload || Object.getPrototypeOf(payload)!==Object.prototype) throw new Error('response-invalid');
    return {response,payload};
  }
  function makeUUID() { return crypto.randomUUID(); }
  function clearCompanionMemory() {
    companion = null;
    consumerWorkspace.clear();
    lastCompanionResult = null;
    sessionPanel.hidden = true;
    visitor.querySelector('#companion-refresh').hidden = true;
    visitor.querySelector('#companion-disconnect').hidden = true;
    visitor.querySelector('#companion-pair').hidden = false;
    visitor.querySelector('#companion-session-details').replaceChildren();
    visitor.querySelector('#companion-data').replaceChildren();
    challengeField.value = '';
  }
  function showCompanionSession(session) {
    consumerWorkspace.update();
    sessionPanel.hidden = false;
    visitor.querySelector('#companion-pair').hidden = true;
    visitor.querySelector('#companion-refresh').hidden = false;
    visitor.querySelector('#companion-disconnect').hidden = false;
    const title=visitor.querySelector('#companion-session-state');
    title.textContent=copy(`Paired · expires ${new Date(session.expiresAt).toLocaleString()}`,`已配對 · 到期時間 ${new Date(session.expiresAt).toLocaleString()}`);
    const details=visitor.querySelector('#companion-session-details');details.replaceChildren();
    const rows=[[copy('Website origin','網站來源'),session.origin],[copy('Granted read access','已授予讀取權限'),session.scopes.join(', ')]];
    for(const [labelText,value] of rows){const term=document.createElement('dt');term.textContent=labelText;const description=document.createElement('dd');description.textContent=value;details.append(term,description);}
    for(const button of visitor.querySelectorAll('[data-companion-action]')) button.disabled=!session.scopes.includes(actionScope[button.dataset.companionAction]);
  }
  function validSession(session) {
    return session && Object.getPrototypeOf(session)===Object.prototype
      && Object.keys(session).sort().join(',')==='expiresAt,id,origin,scopes,status'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(session.id)
      && session.origin===location.origin && Array.isArray(session.scopes) && session.scopes.length>0
      && session.scopes.every(scope=>typeof scope==='string') && Number.isSafeInteger(session.expiresAt)
      && session.status==='active';
  }
  visitor.querySelector('#companion-save-endpoint').addEventListener('click', () => {
    try {
      const endpoint=endpointForRequest();
      if(companion && companion.endpoint!==endpoint){companionMessage.textContent=copy('Disconnect the current desktop session before changing its endpoint.','更改連線位址前，請先中斷目前桌面連線。');return;}
      endpointField.value=endpoint;save(endpointStorageKey,endpoint);
      companionMessage.textContent=copy('Private endpoint saved in this browser. No connection has been made yet.','私人連線位址已儲存喺呢個瀏覽器。尚未建立連線。');
    } catch { companionMessage.textContent=copy('Enter an HTTPS loopback or private IP address with a port. Public hosts and hostnames are not allowed.','請輸入含連接埠嘅 HTTPS 本機或私人 IP 位址。唔允許公用主機或主機名稱。'); }
  });
  visitor.querySelector('#companion-pair').addEventListener('click', async () => {
    let endpoint;
    try { endpoint=endpointForRequest(); } catch { companionMessage.textContent=copy('Enter a valid HTTPS private IP endpoint first.','請先輸入有效嘅 HTTPS 私人 IP 位址。');return; }
    const challenge=challengeField.value.trim();
    if(!/^[A-Za-z0-9_-]{43}$/.test(challenge)){companionMessage.textContent=copy('Paste the current one-time challenge from the desktop app.','請貼上桌面程式提供嘅有效一次性挑戰碼。');return;}
    save(endpointStorageKey,endpoint);
    companionMessage.textContent=copy('Pairing request sent. Review and approve it on the desktop. Do not submit it again while approval is pending.','配對要求已送出。請喺桌面查看同批准。等待批准時請勿重複提交。');
    const clientNonce=makeUUID();
    try {
      const {response,payload}=await companionFetch('/pair',{challenge,clientNonce});
      if(!response.ok){companionMessage.textContent=companionError(payload.code);return;}
      if(Object.keys(payload).sort().join(',')!=='csrfToken,nextSequence,session'||typeof payload.csrfToken!=='string'||!payload.csrfToken||!Number.isSafeInteger(payload.nextSequence)||payload.nextSequence<1||!validSession(payload.session))throw new Error('response-invalid');
      const broader=payload.session.scopes.some(scope=>!readOnlyScopes.has(scope));
      companion={endpoint,session:payload.session,csrfToken:payload.csrfToken,nextSequence:payload.nextSequence,sequenceUnknown:false};
      if(broader){
        let revoked=false;
        try {const closed=await companionFetch('/disconnect',{},companion.csrfToken);revoked=closed.response.ok&&closed.payload?.revoked===true&&closed.payload?.session?.id===payload.session.id&&closed.payload?.session?.status==='revoked';} catch {}
        clearCompanionMemory();
        companionMessage.textContent=revoked
          ? copy('This challenge granted access beyond the read-only scope. The page immediately asked the desktop to revoke it and received confirmation.','此挑戰碼授予超出唯讀範圍嘅權限。頁面已立即要求桌面撤銷，並收到確認。')
          : copy('This challenge granted access beyond the read-only scope. The page will not use it; the desktop did not confirm revocation. Revoke it from the desktop.','此挑戰碼授予超出唯讀範圍嘅權限。頁面不會使用該權限；桌面未確認撤銷。請喺桌面撤銷連線。');
        return;
      }
      challengeField.value='';showCompanionSession(payload.session);
      companionMessage.textContent=copy('Paired. The desktop approved this read-only browser session.','配對成功。桌面已批准此唯讀瀏覽器連線。');
    } catch {
      companionMessage.textContent=copy('The browser could not complete pairing. Check the trusted TLS certificate, exact website origin, CORS/private-network permission and local network policy. No certificate bypass or automatic retry was used.','瀏覽器未能完成配對。請檢查受信任嘅 TLS 憑證、網站來源、CORS／私人網絡權限同本機網絡政策。頁面無繞過憑證檢查，亦無自動重試。');
    }
  });
  visitor.querySelector('#companion-refresh').addEventListener('click', async () => {
    if(!companion)return;
    try {
      const {response,payload}=await companionFetch('/session',{},companion.csrfToken);
      if(!response.ok){companionMessage.textContent=companionError(payload.code);if(payload.code==='UNAUTHORIZED')clearCompanionMemory();return;}
      if(Object.keys(payload).sort().join(',')!=='nextSequence,session'||!validSession(payload.session)||payload.session.id!==companion.session.id||!Number.isSafeInteger(payload.nextSequence)||payload.nextSequence<1)throw new Error('response-invalid');
      companion.session=payload.session;companion.nextSequence=payload.nextSequence;companion.sequenceUnknown=false;showCompanionSession(payload.session);
      companionMessage.textContent=copy('Session status refreshed from the desktop.','已更新桌面連線狀態。');
    } catch {companionMessage.textContent=copy('Could not refresh the desktop session. The connection state is unknown; no host work was cancelled.','無法更新桌面連線狀態。連線狀態未知；主機工作未有取消。');}
  });
  visitor.querySelector('#companion-disconnect').addEventListener('click', async () => {
    if(!companion)return;
    const previous=companion;
    try {
      const {response,payload}=await companionFetch('/disconnect',{},previous.csrfToken);
      if(response.ok && payload?.revoked===true && payload?.session?.id===previous.session.id && payload?.session?.status==='revoked'){
        clearCompanionMemory();companionMessage.textContent=copy('The desktop revoked this browser session.','桌面已撤銷此瀏覽器連線。');return;
      }
      clearCompanionMemory();
      if(response.status===401&&payload.code==='UNAUTHORIZED'){
        companionMessage.textContent=copy('The host says this session is already expired or revoked and cleared its cookie.','主機表示此連線已過期或撤銷，並已清除 Cookie。');return;
      }
      companionMessage.textContent=copy('This page cleared its session. The server did not confirm revocation; ask the desktop owner to revoke it.','此頁已清除連線資料。伺服器未確認撤銷；請聯絡桌面擁有人撤銷。');
    } catch {
      clearCompanionMemory();
      companionMessage.textContent=copy('This page cleared its session, but could not confirm server revocation. Ask the desktop owner to revoke it.','此頁已清除連線資料，但未能確認伺服器撤銷。請聯絡桌面擁有人撤銷。');
    }
  });
  visitor.querySelectorAll('[data-companion-action]').forEach(button=>button.addEventListener('click',async()=>{
    if(!companion||consumerBusy)return;
    const action=button.dataset.companionAction;
    if(!actionScope[action]||!companion.session.scopes.includes(actionScope[action])){companionMessage.textContent=companionError('SCOPE_REJECTED');return;}
    if(companion.sequenceUnknown){companionMessage.textContent=copy('Refresh the session sequence before another action.','請先更新連線序號，然後再進行操作。');return;}
    if(consumerBusy)return;
    consumerBusy=true;
    const sequence=companion.nextSequence;
    const actionButtons=[...visitor.querySelectorAll('[data-companion-action]')];
    actionButtons.forEach(item=>item.disabled=true);
    companionMessage.textContent=copy(`Requesting ${action} from the desktop…`,`正在向桌面要求 ${action}…`);
    try {
      const {response,payload}=await companionFetch('/actions',{action,args:{},sequence,nonce:makeUUID()},companion.csrfToken);
      if(Number.isSafeInteger(payload.nextSequence)&&payload.nextSequence>sequence)companion.nextSequence=payload.nextSequence;
      else companion.sequenceUnknown=true;
      if(!response.ok){companionMessage.textContent=companionError(payload.code);renderCompanionData(action,null,payload.code);return;}
      if(payload.operation?.action!==action||!['succeeded','failed','unknown'].includes(payload.operation?.state)||!Object.hasOwn(payload,'result'))throw new Error('response-invalid');
      if(payload.operation.state!=='succeeded'){companionMessage.textContent=companionError('ACTION_FAILED');renderCompanionData(action,null,'ACTION_FAILED');return;}
      const displayed=renderCompanionData(action,payload.result,'');
      companionMessage.textContent=displayed
        ? copy('The desktop returned a read-only result.','桌面已回覆唯讀資料。')
        : copy('The host response did not match this read-only view. No raw data was displayed.','主機回覆格式與唯讀檢視不符，未顯示原始資料。');
    } catch {
      companion.sequenceUnknown=true;
      renderCompanionData(action,null,'INVALID_RESULT');
      companionMessage.textContent=copy('The request may have reached the desktop, but its reply was lost. No automatic retry was sent. Refresh the session before another request; this page cannot infer whether host work stopped.','要求可能已送達桌面，但回覆遺失。頁面無自動重試。請更新連線狀態後再要求資料；此頁無法推斷主機工作是否停止。');
    } finally {consumerBusy=false;actionButtons.forEach(item=>item.disabled=!companion||!companion.session.scopes.includes(actionScope[item.dataset.companionAction]));}
  }));

  function renderCompanionData(action,result,errorCode) {
    // Accept only the host's public projection, never a full workspace or raw response.
    const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
    const text=value=>typeof value==='string'&&value.length<=1024;
    const count=value=>Number.isSafeInteger(value)&&value>=0;
    const list=(value,validate)=>Array.isArray(value)&&value.length<=1000&&value.every(validate);
    const plan=value=>exact(value,['id','name','runtime','target','status','updatedAt'])&&Object.values(value).every(text);
    const project=value=>exact(value,['id','name','authorized'])&&text(value.id)&&text(value.name)&&typeof value.authorized==='boolean';
    const job=value=>exact(value,['id','kind','state','sequence','createdAt','updatedAt','logCount','itemCount'])&&['id','kind','state','createdAt','updatedAt'].every(key=>text(value[key]))&&['sequence','logCount','itemCount'].every(key=>count(value[key]));
    const valid=!errorCode&&(action==='workspace.read'
      ? exact(result,['revision','onboardingCompleted','plans'])&&count(result.revision)&&typeof result.onboardingCompleted==='boolean'&&list(result.plans,plan)
      : action==='projects.list' ? exact(result,['projects'])&&list(result.projects,project)
      : action==='jobs.list' ? exact(result,['jobs'])&&list(result.jobs,job) : false);
    lastCompanionResult = {action,result:valid?result:null,errorCode:errorCode||(!valid?'INVALID_RESULT':'')};
    const region=visitor.querySelector('#companion-data');region.replaceChildren();
    const actionNames={'workspace.read':copy('Workspace summary','工作區摘要'),'projects.list':copy('Saved projects','已儲存項目'),'jobs.list':copy('Recent jobs','最近工作')};
    const heading=document.createElement('h4');heading.textContent=actionNames[action]||copy('Read-only result','唯讀結果');region.append(heading);
    const summary=document.createElement('dl');summary.className='companion-summary';region.append(summary);
    if(errorCode){const note=document.createElement('p');note.textContent=companionError(errorCode);region.append(note);return false;}
    const addRow=(title,value)=>{const term=document.createElement('dt');term.textContent=title;const description=document.createElement('dd');description.textContent=String(value);summary.append(term,description);};
    if(!valid){addRow(copy('Result','結果'),copy('The host response did not match this read-only view. No raw data was displayed.','主機回覆格式與唯讀檢視不符，未顯示原始資料。'));return false;}
    if(action==='workspace.read'){
      const state=result;
      addRow(copy('Saved plans','已儲存計劃'),state.plans.length);addRow(copy('Onboarding','入門設定'),state.onboardingCompleted?copy('Completed','已完成'):copy('In progress','進行中'));
      for(const plan of state.plans.slice(0,50)){
        const item=document.createElement('div');item.className='companion-record';
        const name=document.createElement('strong');name.textContent=typeof plan?.name==='string'?plan.name:copy('Unnamed plan','未命名計劃');
        const meta=document.createElement('p');meta.textContent=[plan?.runtime,plan?.target,plan?.status].filter(value=>typeof value==='string').join(' · ');
        item.append(name,meta);region.append(item);
      }
      return true;
    }
    if(action==='projects.list'){
      addRow(copy('Projects','項目'),result.projects.length);
      for(const project of result.projects.slice(0,100)){
        const item=document.createElement('div');item.className='companion-record';
        const name=document.createElement('strong');name.textContent=typeof project?.name==='string'?project.name:copy('Project','項目');
        const meta=document.createElement('p');meta.textContent=project?.authorized===true?copy('Open in current desktop session','已喺目前桌面連線中開啟'):copy('Saved metadata; not open in this desktop session','已儲存資料；未喺目前桌面連線中開啟');
        item.append(name,meta);region.append(item);
      }
      return true;
    }
    if(action==='jobs.list'){
      addRow(copy('Jobs','工作'),result.jobs.length);
      for(const job of result.jobs.slice(0,100)){
        const item=document.createElement('div');item.className='companion-record';
        const name=document.createElement('strong');name.textContent=`${typeof job?.kind==='string'?job.kind:copy('Job','工作')} · ${typeof job?.state==='string'?job.state:copy('state unavailable','狀態無法取得')}`;
        const meta=document.createElement('p');meta.textContent=typeof job?.updatedAt==='string'?job.updatedAt:typeof job?.createdAt==='string'?job.createdAt:copy('Latest host record','最新主機記錄');
        item.append(name,meta);region.append(item);
      }
      return true;
    }
    addRow(copy('Result','結果'),copy('The host response did not match this read-only view. No raw data was displayed.','主機回覆格式與唯讀檢視不符，未顯示原始資料。'));
  }
  language?.addEventListener('change', () => {
    if(companion)showCompanionSession(companion.session);
    if(lastCompanionResult)renderCompanionData(lastCompanionResult.action,lastCompanionResult.result,lastCompanionResult.errorCode);
  });
}

let phaseFilter = 'all';
const applyPhaseFilter = () => {
  let visible = 0;
  document.querySelectorAll('.phase').forEach(phase => {
    const show = phaseFilter === 'all' || phase.dataset.status === phaseFilter;
    phase.hidden = !show; if (show) visible++;
  });
  const status = document.querySelector('#phase-count');
  if (status) status.textContent = `${visible} phases shown`;
};
document.querySelectorAll('[data-phase-filter]').forEach(chip => chip.addEventListener('click', () => {
  phaseFilter = chip.dataset.phaseFilter;
  document.querySelectorAll('[data-phase-filter]').forEach(c => c.selected = c === chip);
  applyPhaseFilter();
}));
document.querySelectorAll('time[data-local]').forEach(time => {
  const date = new Date(time.dateTime);
  if (Number.isNaN(date.valueOf())) return;
  time.textContent = new Intl.DateTimeFormat(undefined, {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(date);
});



