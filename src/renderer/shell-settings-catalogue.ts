/** One inventory drives settings navigation, search and explicit New tab destinations. */
export const shellSettings = [
  {id:'language',en:'Language and wording',zh:'語言同用詞',icon:'description',personal:true,keywords:['Interface language Humor English Cantonese Display name Rename Dialog emoji','介面語言 幽默 英文 粵語 顯示名稱 改名 對話框表情符號']},
  {id:'appearance',en:'Appearance',zh:'外觀',icon:'preview',personal:false,keywords:['Theme Density Comfortable Compact Accent Logo Element editor','主題 密度 舒適 緊密 重點顏色 標誌 元素編輯器']},
  {id:'attention',en:'Accessibility and focus',zh:'無障礙同專注',icon:'tune',personal:false,keywords:['Narration voices Attention low stimulation time awareness momentum','旁白 聲線 專注 低刺激 時間提示 繼續提示']},
  {id:'shared',en:'Shared preference',zh:'共用偏好',icon:'computer',personal:false,keywords:['Exit credential Recovery','退出憑證 復原']},
  {id:'vocabulary',en:'Personal vocabulary',zh:'個人詞彙',icon:'description',personal:true,keywords:['Import Replace Clear JSON local wording','匯入 取代 清除 JSON 本機用詞']},
  {id:'experience',en:'Safety and locks',zh:'安全同鎖定',icon:'security',personal:false,keywords:['Experience locks Local support tickets Credential policies Waiting challenges','體驗鎖 本機支援工單 憑證規則 等候挑戰']},
  {id:'backups',en:'History and backups',zh:'歷史同備份',icon:'history',personal:false,keywords:['Workspace backups Snapshots Import Export Restore','工作區備份 快照 匯入 匯出 還原']},
  {id:'schedules',en:'Schedules',zh:'排程',icon:'history',personal:false,keywords:['Scheduled preferences Rules Timezone History External source enrollment','偏好排程 規則 時區 歷史 外部來源登記']},
  {id:'updates',en:'Updates and About',zh:'更新同關於',icon:'info',personal:false,keywords:['Version Source Installed provenance Licenses','版本 來源 已安裝來源資料 授權']},
] as const;

export function visibleShellSettings(restricted:boolean){return shellSettings.filter(item=>!restricted||!item.personal);}
