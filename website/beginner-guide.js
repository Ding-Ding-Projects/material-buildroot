// Learning choices are browser-only. No desktop bridge or execution API belongs here.
export const beginnerStorageKey = 'mb-beginner-guide-v1';
export const beginnerDefaults = () => ({ version: 1, step: 0, goal: 'learn', runtime: 'wsl', field: 'profile', read: false });
export function normalizeBeginnerState(value) {
  const state = beginnerDefaults();
  if (!value || value.version !== 1) return state;
  if (Number.isInteger(value.step) && value.step >= 0 && value.step < 4) state.step = value.step;
  for (const [key, allowed] of Object.entries({ goal: ['learn', 'iso', 'recover'], runtime: ['wsl', 'docker'], field: ['profile', 'resources', 'output', 'validation'] })) {
    if (allowed.includes(value[key])) state[key] = value[key];
  }
  state.read = value.read === true;
  return state;
}

const goals = [
  ['learn', '○', ['Understand the basics', '認識基本流程'], ['Recommended for your first visit. Learn what each part does before changing anything.', '首次到訪建議由此開始。先認識每個部分，再作任何更改。']],
  ['iso', '◎', ['Prepare an ISO image', '準備 ISO 映像'], ['Learn the supported computer type, runtime and output choices.', '了解支援嘅電腦類型、執行環境同輸出選擇。']],
  ['recover', '↺', ['Understand a stopped build', '了解停止咗嘅建置'], ['Find the recorded result before deciding whether to try again.', '先找出已記錄嘅結果，再決定是否重試。']]
];
const runtimes = [
  ['wsl', '▣', ['WSL 2', 'WSL 2'], ['Start here if a suitable WSL 2 distribution is already set up. It gives Buildroot a Linux workspace inside Windows.', '已有合適 WSL 2 發行版就由此開始。佢會喺 Windows 內提供 Linux 工作空間畀 Buildroot。']],
  ['docker', '▦', ['Docker Linux container', 'Docker Linux 容器'], ['Choose this if your project already uses an admitted container image. The engine and image must be ready first.', '項目已有認可容器映像時可選此項。請先準備好引擎同映像。']]
];
export const beginnerFields = [
  { id: 'profile', icon: '◎', title: ['Which computer can use this image?', '邊類電腦可以用呢個映像？'], body: ['The guided target is x86_64 with BIOS. Read the installed app’s current plan for the exact bootloader and image settings. Think of firmware as the first instructions a computer reads. UEFI and hybrid USB are not supported by this profile. Keep the supported profile selected; the source must already enable x86_64 and Linux.', '引導目標係 x86_64 配合 BIOS。實際開機載入器同映像設定，請查看已安裝程式嘅目前計劃。韌體就好似電腦啟動時讀取嘅第一份指引。此設定唔支援 UEFI 或混合 USB。請保留支援嘅設定；來源必須已啟用 x86_64 同 Linux。'], example: ['Example only: a BIOS computer needs a compatible BIOS image. Choosing this explanation does not configure a project.', '純粹示例：BIOS 電腦需要相容嘅 BIOS 映像。選擇此說明唔會設定任何項目。'], article: 'profile-and-firmware.md' },
  { id: 'resources', icon: '▤', title: ['How much work happens at once?', '同時做幾多工作？'], body: ['Start with two parallel jobs, the current guided default. More jobs can use more memory. The installed app must check fresh CPU, memory and storage information before real work. A runtime appearing in a list is not proof that it is ready.', '可由引導預設嘅兩個並行工作開始。更多工作可能佔用更多記憶體。真正執行前，已安裝程式必須取得最新 CPU、記憶體同儲存資料。環境出現喺清單唔等於已準備好。'], example: ['Example only: 2 jobs. This guide does not measure your computer or reserve resources.', '純粹示例：2 個工作。此指南唔會量度電腦資源或預留資源。'], article: 'runtime-and-resources.md' },
  { id: 'output', icon: '▱', title: ['Where will the result go?', '結果會放喺邊？'], body: ['Source is the recipe. Output is the separate place where results are made. The generated filename is images/rootfs.iso9660 inside the build output. Use a separate output directory to protect earlier results: incremental builds can replace generated files. Rename only a later exported copy when supported.', '來源好似食譜；輸出係另外一個製作成果嘅地方。產生嘅檔名係建置輸出內嘅 images/rootfs.iso9660。使用獨立輸出資料夾保護舊結果，因為增量建置可能取代產生嘅檔案。支援時只重新命名之後匯出嘅副本。'], example: ['Example only: source → separate build output → images/rootfs.iso9660. No folder is opened or created here.', '純粹示例：來源 → 獨立建置輸出 → images/rootfs.iso9660。呢度唔會開啟或建立資料夾。'], article: 'output-and-validation.md' },
  { id: 'validation', icon: '✓', title: ['How do we know it worked?', '點樣知道成功？'], body: ['Read the real job result, then inspect the generated file and its validation evidence. A saved plan, accepted configuration or successful small command does not prove a complete ISO build. Booting is another check after producing the image.', '先睇真實工作結果，再檢查產生嘅檔案同驗證證據。儲存咗計劃、配置被接受或者小型指令成功，都唔代表完整 ISO 建置成功。產生映像後，啟動仍然係另一項檢查。'], example: ['Evidence boundary: WSL and Docker olddefconfig/show-info checks are verified. A produced and booted ISO is not yet verified by this guide.', '證據界線：WSL 同 Docker 嘅 olddefconfig/show-info 檢查已驗證。此指南尚未驗證產生並啟動 ISO。'], article: 'output-and-validation.md' }
];

export const beginnerRuntimeArticle = 'desktop/iso-fields/runtime-and-resources.md';
export const beginnerNextArticles = Object.freeze({ learn: 'desktop/modern-workspace.md', iso: 'desktop/iso-workflow.md', recover: 'desktop/iso-fields/configuration-and-recovery.md' });
export const beginnerArticleUrl = article => `/material-buildroot/site/articles/docs/${article.replace(/\.md$/, '.html')}`;
export const beginnerArticleSources = () => [...new Set([beginnerRuntimeArticle, ...beginnerFields.map(field => `desktop/iso-fields/${field.article}`), ...Object.values(beginnerNextArticles)])];
export function verifyBeginnerDestinations(inventory) {
  for (const article of beginnerArticleSources()) {
    const entry = inventory.find(item => item.source === `docs/${article}`);
    if (!entry || entry.url !== beginnerArticleUrl(article)) throw new Error(`Beginner article route absent or mismatched: ${article}`);
  }
  return beginnerArticleSources().length;
}

export function mountBeginnerGuide(host) {
  if (!host) return;
  let storageAvailable = true;
  let state;
  try { state = normalizeBeginnerState(JSON.parse(localStorage.getItem(beginnerStorageKey) || 'null')); }
  catch { state = beginnerDefaults(); storageAvailable = false; }
  const section = host.querySelector('#beginner-guide');
  if (!section) return;
  section.id = 'beginner-guide'; section.className = 'learning-card beginner-guide';
  section.setAttribute('aria-labelledby', 'beginner-title');
  const copy = pair => document.documentElement.dataset.language === 'zh' ? pair[1] : document.documentElement.dataset.language === 'en' ? pair[0] : pair.join(' · ');
  const node = (tag, pair, parent = section) => { const element = document.createElement(tag); if (pair) element.textContent = copy(pair); parent.append(element); return element; };
  const persist = () => { try { localStorage.setItem(beginnerStorageKey, JSON.stringify(state)); storageAvailable = true; } catch { storageAvailable = false; } };
  const link = (title, article, parent = section) => { const a = node('a', title, parent); a.href = beginnerArticleUrl(article); return a; };
  const action = (title, callback, parent, filled = false) => { const b = node(filled ? 'md-filled-button' : 'md-outlined-button', title, parent); b.addEventListener('click', callback); return b; };
  function choices(items, key, parent) {
    const grid = node('div', null, parent); grid.className = 'beginner-choices'; grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', copy(key === 'goal' ? ['Choose your learning goal', '選擇學習目標'] : ['Compare runtime explanations', '比較執行環境說明']));
    for (const [id, icon, title, body] of items) {
      const card = node('div', null, grid); card.className = 'beginner-choice';
      const symbol = node('span', null, card); symbol.textContent = icon; symbol.className = 'beginner-symbol'; symbol.setAttribute('aria-hidden', 'true');
      const b = action(title, () => { state[key] = id; state.read = false; persist(); render(id); }, card);
      b.dataset.choice = id; b.setAttribute('aria-pressed', String(state[key] === id));
      node('p', body, card);
    }
  }
  function render(focusChoice) {
    section.replaceChildren();
    node('p', ['START HERE · BROWSER LEARNING ONLY', '由呢度開始 · 只供瀏覽器學習']).className = 'eyebrow';
    const title = node('h2', ['A small first step', '先行一小步']); title.id = 'beginner-title'; title.tabIndex = -1;
    node('p', ['Choose an answer, read a short explanation, then go Next. Your choices stay in this browser. Nothing here runs a build or changes the installed app.', '揀答案、睇簡短說明，再按「下一步」。選擇只留喺此瀏覽器，唔會執行建置或更改已安裝程式。']);
    const position = node('p', [`Step ${state.step + 1} of 4`, `第 ${state.step + 1} 步，共 4 步`]); position.id = 'beginner-position'; position.setAttribute('role', 'status');
    const headings = [['What would you like to do?', '你想做啲乜？'], ['Where will Buildroot do its work?', 'Buildroot 會喺邊度工作？'], ['What do these image choices mean?', '呢啲映像選擇代表乜？'], ['What is your next small step?', '下一小步係乜？']];
    node('h3', headings[state.step]);
    if (state.step === 0) choices(goals, 'goal', section);
    if (state.step === 1) {
      node('p', ['Buildroot needs Linux. Windows hosts the desktop app; WSL 2 or a Docker Linux container performs the build. Prefer a suitable environment already set up for this project.', 'Buildroot 需要 Linux。Windows 用嚟執行桌面程式，建置則由 WSL 2 或 Docker Linux 容器處理。優先用項目已設定好嘅合適環境。']);
      choices(runtimes, 'runtime', section);
      node('p', state.runtime === 'wsl' ? ['Next in the app: discover WSL distributions and review the selected distribution and non-root build user.', '之後喺程式：偵測 WSL 發行版，檢視所選發行版同非 root 建置使用者。'] : ['Next in the app: discover Docker, review the admitted image and verify a non-root build user and owned mounts.', '之後喺程式：偵測 Docker，檢視認可映像，驗證非 root 建置使用者同已授權掛載。']).className = 'learning-callout';
      link(['Read the complete runtime guide', '閱讀完整執行環境指南'], beginnerRuntimeArticle);
    }
    if (state.step === 2) {
      const buttons = node('div'); buttons.className = 'learning-actions beginner-fields';
      for (const field of beginnerFields) {
        const b = action(field.title, () => { state.field = field.id; persist(); render(field.id); }, buttons);
        b.dataset.choice = field.id; b.setAttribute('aria-pressed', String(state.field === field.id));
      }
      const field = beginnerFields.find(item => item.id === state.field);
      const panel = node('div'); panel.className = 'learning-callout'; panel.id = 'beginner-field-detail'; panel.setAttribute('role', 'status');
      node('h4', field.title, panel); node('p', field.body, panel); node('p', field.example, panel);
      link(['Read this field’s full guide', '閱讀此欄位完整指南'], `desktop/iso-fields/${field.article}`, panel);
    }
    if (state.step === 3) {
      node('p', [ `Your learning choices: ${goals.find(item => item[0] === state.goal)[2][0]} / ${runtimes.find(item => item[0] === state.runtime)[2][0]}.`, `你嘅學習選擇：${goals.find(item => item[0] === state.goal)[2][1]} / ${runtimes.find(item => item[0] === state.runtime)[2][1]}。`]);
      const next = state.goal === 'recover' ? ['Read the recorded job state before retrying. If ownership or cleanup is uncertain, keep the job stopped and follow recovery guidance.', '重試前先睇記錄嘅工作狀態。如果擁有權或清理情況未明，請保持工作停止，按復原指南處理。'] : state.goal === 'iso' ? ['In the installed app, choose your source and separate output folder, open Create ISO, and review its live plan before applying it.', '喺已安裝程式選擇來源同獨立輸出資料夾，開啟「建立 ISO」，套用前先檢視即時計劃。'] : ['Continue the source-to-image walkthrough below. Learn the difference between a source recipe, a build workspace and the resulting file.', '繼續下方由來源到映像嘅引導流程，認識來源食譜、建置工作區同結果檔案嘅分別。'];
      node('p', next).className = 'learning-callout';
      link(['Open the next complete article', '開啟下一篇完整文章'], beginnerNextArticles[state.goal]);
      node('p', beginnerFields[3].example);
      action(state.read ? ['Reading saved', '已記錄閱讀'] : ['Mark this introduction read', '標記已讀此入門指南'], () => { state.read = !state.read; persist(); render('read'); }, section).dataset.choice = 'read';
      node('p', ['This records reading only. It never marks a real build successful.', '呢個記錄只代表已閱讀，唔會將真實建置標記為成功。']);
    }
    const navigation = node('div'); navigation.className = 'learning-actions';
    const move = delta => { state.step += delta; persist(); render(); section.querySelector('h2').focus(); };
    action(['Back', '上一步'], () => move(-1), navigation).disabled = state.step === 0;
    action(['Next', '下一步'], () => move(1), navigation, true).disabled = state.step === 3;
    action(['Start this introduction again', '重新開始此入門指南'], () => { state = beginnerDefaults(); persist(); render(); section.querySelector('h2').focus(); }, navigation);
    node('p', storageAvailable ? ['Saved on this browser only. Resetting this introduction leaves your other guides and references alone.', '只儲存喺此瀏覽器。重設此入門指南唔會影響其他指南同參考資料。'] : ['Browser storage is unavailable. You can keep learning, but these choices will not survive a reload.', '瀏覽器儲存空間無法使用。你仍可繼續學習，但重新載入後選擇會消失。']).setAttribute('role', 'status');
    if (focusChoice) section.querySelector(`[data-choice="${focusChoice}"]`)?.focus();
  }
  render();
  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-language'] });
}
