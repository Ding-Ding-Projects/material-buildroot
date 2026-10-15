// Public, synthetic design data. No host discovery, filesystem or network actions.
export const referenceVersion = 'design-1';
export const referenceTime = '2026-10-14T12:00:00Z';
export const screens = {
  projects: ['empty', 'populated', 'missing'],
  wizard: ['source', 'runtime', 'review', 'invalid', 'created'],
  runtime: ['ready', 'missing', 'unavailable', 'restart-required'],
  configuration: ['effective', 'pending', 'rejected'],
  builds: ['queued', 'running', 'cancelling', 'cancelled', 'interrupted', 'succeeded'],
  execution: ['setup', 'review', 'saved', 'published', 'queued', 'running', 'unavailable', 'succeeded'],
  settings: ['default'],
};
export const projects = [
  {id:'p-guest', name:'Desktop guest', target:'x86_64 · UEFI', runtime:'WSL 2', revision:'fixture-source-01', state:'Ready'},
  {id:'p-appliance', name:'Network appliance', target:'x86_64 · BIOS', runtime:'Docker', revision:'fixture-source-02', state:'Queued'},
];
export const labels = {
  projects:['Projects','專案'], wizard:['Create or open','建立或開啟'], runtime:['Runtime setup','執行環境設定'],
  configuration:['Configuration','組態'], builds:['Build queue','建置佇列'], execution:['Managed execution','託管執行'], settings:['Settings','設定'],
  search:['Search','搜尋'], create:['Create project','建立專案'], open:['Open existing','開啟現有專案'],
  next:['Next','下一步'], back:['Back','上一步'], cancel:['Cancel','取消'], review:['Review','檢視'],
  refresh:['Refresh discovery','重新探索'], close:['Close','關閉'], reset:['Reset layout','重設版面'],
  tree:['Configuration menus','組態選單'], inspector:['Inspector','詳細資料'], help:['Help','說明'],
  language:['Language','語言'], theme:['Theme','主題'], state:['Reference state','參考狀態'],
  title:['Material Buildroot','Material Buildroot'], fixture:['Design fixture · no real execution','設計範例 · 不會實際執行'],
  unavailable:['Unavailable','未能使用'], ready:['Ready','就緒'], retry:['Retry as new job','以新工作重試'],
  selected:['Selected project','已選專案'], resources:['Resource limits','資源限制'],
};
export function text(key, language) {
  const pair=labels[key] || [key,key];
  return language==='yue' ? pair[1] : language==='both' ? `${pair[0]} · ${pair[1]}` : pair[0];
}
export function initialRoute(search) {
  const query=new URLSearchParams(search);
  const screen=Object.hasOwn(screens, query.get('screen')) ? query.get('screen') : 'projects';
  const state=screens[screen].includes(query.get('state')) ? query.get('state') : screens[screen][0];
  return {screen,state,language:['en','yue','both'].includes(query.get('lang'))?query.get('lang'):'both',theme:['light','dark','system'].includes(query.get('theme'))?query.get('theme'):'system'};
}
