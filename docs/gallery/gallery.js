import './assets/material-components.js';

const root = document.documentElement;
const gallery = document.querySelector('#gallery');
const search = document.querySelector('#search');
const results = document.querySelector('#results');
const count = document.querySelector('#capture-count');
const empty = document.querySelector('#empty-state');
const clearButton = document.querySelector('#clear-filters');
const themeSwitch = document.querySelector('#theme-toggle');
const languageSelect = document.querySelector('#language-select');
const filterChips = [...document.querySelectorAll('[data-filter]')];
let captures = [];
let activeFilter = 'all';
let language = 'both';
const filterLabels = {
  all: ['All captures', '全部截圖'],
  'current-app': ['Workspace', '工作區'],
  'native-windows': ['Native desktop', '原生桌面'],
  'historical-workspace': ['Historical workspace', '歷史工作區'],
  'legacy-shell': ['Legacy shell', '舊版介面'],
  'website-current': ['Interactive website', '互動網站'],
  'website-historical-landing': ['Earlier website', '早期網站'],
  'website-historical-preview': ['Early preview', '早期預覽']
};

const ui = {
  category: ['Collection', '分類'],
  search: ['Search screenshots', '搜尋截圖'],
  placeholder: ['Try “companion”, “dark”, or “320px”', '試試輸入「companion」、「深色」或「320px」'],
  theme: ['Dark theme', '深色主題'],
  lightTheme: ['Light theme', '淺色主題'],
  loading: ['Loading capture inventory…', '正在載入截圖目錄…'],
  shown: (visible, total) => [`${visible} of ${total} screenshots shown`, `顯示 ${total} 張中的 ${visible} 張截圖`],
  capDate: ['Captured', '截圖時間'],
  noCapDate: ['Capture time not separately recorded', '沒有獨立記錄截圖時間'],
  checked: ['Receipt checked', '收據檢查時間'],
  dimensions: ['Image dimensions', '圖片尺寸'],
  viewport: ['Recorded viewport', '有記錄的檢視區'],
  unavailable: ['Not recorded', '沒有記錄'],
  heightUnavailable: ['height not recorded', '沒有記錄高度'],
  provenance: ['Capture provenance and limits', '截圖來源與限制'],
  hideProvenance: ['Hide capture provenance', '隱藏截圖來源'],
  collection: ['Collection', '分類'],
  captureKind: ['Capture type', '截圖類型'],
  original: ['Original filename', '原始檔名'],
  sourceRevision: ['Source revision', '來源版本'],
  buildBase: ['Build base commit', '建置基礎提交'],
  deliveredCommit: ['Delivered site commit', '已發佈網站提交'],
  inputsDiffer: ['Source inputs differed from the base commit', '來源輸入與基礎提交不同'],
  snapshot: ['Source input snapshot SHA-256', '來源輸入快照 SHA-256'],
  captureTime: ['Recorded capture time', '有記錄的截圖時間'],
  receiptTime: ['Browser receipt check time', '瀏覽器收據檢查時間'],
  route: ['Capture route', '截圖路徑'],
  language: ['Language', '語言'],
  colorTheme: ['Theme', '主題'],
  sha: ['Original image SHA-256', '原始圖片 SHA-256'],
  artifact: ['Packaged artifact SHA-256', '封裝程式 SHA-256'],
  archive: ['Release archive SHA-256', '版本封存檔 SHA-256'],
  buildReceipt: ['Build receipt SHA-256', '建置收據 SHA-256'],
  boundary: ['Evidence boundary', '證據限制'],
  openImage: ['Open original image', '開啟原始圖片'],
  metadata: ['Gallery metadata', '截圖集資料'],
  clear: ['Clear filters', '清除篩選'],
  noMatches: ['No screenshots match', '沒有符合條件的截圖'],
  changeSearch: ['Change the search words or choose another collection.', '請更改搜尋文字或選擇其他分類。'],
  loadError: ['The capture inventory could not be loaded. Reload this page to try again.', '無法載入截圖目錄，請重新載入此頁。']
};

function pair(en, zh, extraClass = '') {
  const wrapper = document.createElement('span');
  if (extraClass) wrapper.className = extraClass;
  const english = document.createElement('span');
  english.className = 'en';
  english.textContent = en ?? '';
  const cantonese = document.createElement('span');
  cantonese.className = 'zh';
  cantonese.lang = 'zh-HK';
  cantonese.textContent = zh ?? '';
  wrapper.append(english, cantonese);
  return wrapper;
}

function setLanguage(value) {
  language = ['both', 'en', 'zh'].includes(value) ? value : 'both';
  root.dataset.language = language;
  document.documentElement.lang = language === 'zh' ? 'zh-HK' : 'en';
  search.label = language === 'en' ? ui.search[0] : language === 'zh' ? ui.search[1] : `${ui.search[0]} / ${ui.search[1]}`;
  search.placeholder = language === 'en' ? ui.placeholder[0] : language === 'zh' ? ui.placeholder[1] : `${ui.placeholder[0]} / ${ui.placeholder[1]}`;
  for (const chip of filterChips) {
    const [en, zh] = filterLabels[chip.dataset.filter] || ['', ''];
    chip.label = language === 'en' ? en : language === 'zh' ? zh : `${en} / ${zh}`;
    chip.setAttribute('aria-label', chip.label);
  }
  applyFilters();
  try { localStorage.setItem('gallery-language', language); } catch { /* Language stays active for this page view. */ }
}

function setTheme(isDark, persist = true) {
  root.dataset.theme = isDark ? 'dark' : 'light';
  themeSwitch.selected = isDark;
  themeSwitch.setAttribute('aria-label', isDark ? 'Light theme / 淺色主題' : 'Dark theme / 深色主題');
  if (persist) {
    try { localStorage.setItem('gallery-theme', isDark ? 'dark' : 'light'); } catch { /* Theme stays active for this page view. */ }
  }
}

try {
  const savedTheme = localStorage.getItem('gallery-theme');
  setTheme(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches, false);
  const savedLanguage = localStorage.getItem('gallery-language');
  setLanguage(['both', 'en', 'zh'].includes(savedLanguage) ? savedLanguage : 'both');
  languageSelect.value = language;
  languageSelect.updateComplete?.then(() => { languageSelect.value = language; });
} catch {
  setTheme(matchMedia('(prefers-color-scheme: dark)').matches, false);
  setLanguage('both');
  languageSelect.value = language;
}

themeSwitch.addEventListener('change', () => setTheme(themeSwitch.selected));
languageSelect.addEventListener('change', () => setLanguage(languageSelect.value));

function addDetail(list, enLabel, zhLabel, value) {
  if (value === null || value === undefined || value === '') return;
  const wrap = document.createElement('div');
  const dt = document.createElement('dt');
  dt.append(pair(enLabel, zhLabel));
  const dd = document.createElement('dd');
  dd.textContent = String(value);
  wrap.append(dt, dd);
  list.append(wrap);
}

function createCard(capture) {
  const card = document.createElement('article');
  card.className = 'capture-card';
  card.dataset.section = capture.section;
  card.dataset.search = [capture.titleEn, capture.titleZh, capture.categoryEn, capture.categoryZh, capture.kindEn, capture.kindZh, capture.boundaryEn, capture.boundaryZh, capture.sourceRevision, capture.buildBaseCommit, capture.deliveredSourceCommit, capture.language, capture.theme].filter(Boolean).join(' ').toLocaleLowerCase();

  const imgLink = document.createElement('a');
  imgLink.className = 'card-image-link';
  imgLink.href = capture.file;
  imgLink.target = '_blank';
  imgLink.rel = 'noopener';
  imgLink.setAttribute('aria-label', `Open original image / 開啟原始圖片: ${capture.titleEn}`);
  const image = document.createElement('img');
  image.className = 'card-image';
  image.src = capture.file;
  image.alt = `${capture.titleEn} / ${capture.titleZh}`;
  image.width = capture.imageDimensions.width;
  image.height = capture.imageDimensions.height;
  image.loading = 'lazy';
  image.decoding = 'async';
  imgLink.append(image);

  const body = document.createElement('div');
  body.className = 'card-body';
  const kicker = document.createElement('p');
  kicker.className = 'card-kicker';
  kicker.append(pair(capture.categoryEn, capture.categoryZh));
  body.append(kicker);
  const heading = document.createElement('h2');
  heading.append(pair(capture.titleEn, capture.titleZh));
  body.append(heading);

  const dateEn = capture.capturedAt ? `${ui.capDate[0]} ${capture.capturedAt}` : `${ui.noCapDate[0]}${capture.receiptCheckedAt ? ` · ${ui.checked[0]} ${capture.receiptCheckedAt}` : ''}`;
  const dateZh = capture.capturedAt ? `${ui.capDate[1]} ${capture.capturedAt}` : `${ui.noCapDate[1]}${capture.receiptCheckedAt ? ` · ${ui.checked[1]} ${capture.receiptCheckedAt}` : ''}`;
  const size = `${capture.imageDimensions.width} × ${capture.imageDimensions.height}`;
  const meta = document.createElement('p');
  meta.className = 'card-meta';
  meta.append(pair(`${dateEn} · ${ui.dimensions[0]} ${size}`, `${dateZh} · ${ui.dimensions[1]} ${size}`));
  body.append(meta);
  const boundary = document.createElement('p');
  boundary.className = 'card-boundary';
  boundary.append(pair(capture.boundaryEn, capture.boundaryZh));
  body.append(boundary);

  const provenance = document.createElement('div');
  provenance.className = 'card-details';
  const detailButton = document.createElement('md-outlined-button');
  detailButton.className = 'card-details-button';
  detailButton.setAttribute('aria-expanded', 'false');
  detailButton.append(pair(ui.provenance[0], ui.provenance[1]));
  const detailPanel = document.createElement('div');
  detailPanel.className = 'detail-panel';
  detailPanel.hidden = true;
  detailPanel.id = `detail-${capture.id}`;
  detailButton.setAttribute('aria-controls', detailPanel.id);
  const list = document.createElement('dl');
  list.className = 'detail-grid';
  addDetail(list, ...ui.collection, `${capture.categoryEn} / ${capture.categoryZh}`);
  addDetail(list, ...ui.captureKind, `${capture.kindEn} / ${capture.kindZh}`);
  addDetail(list, ...ui.original, capture.originalFilename);
  addDetail(list, ...ui.sourceRevision, capture.sourceRevision);
  addDetail(list, ...ui.buildBase, capture.buildBaseCommit);
  addDetail(list, ...ui.deliveredCommit, capture.deliveredSourceCommit);
  addDetail(list, ...ui.inputsDiffer, capture.sourceInputsDifferFromBase === undefined ? null : String(capture.sourceInputsDifferFromBase));
  addDetail(list, ...ui.snapshot, capture.sourceSnapshotSha256);
  addDetail(list, ...ui.captureTime, capture.capturedAt || ui.unavailable[0]);
  addDetail(list, ...ui.receiptTime, capture.receiptCheckedAt);
  addDetail(list, ...ui.route, capture.route);
  addDetail(list, ...ui.language, capture.language);
  addDetail(list, ...ui.colorTheme, capture.theme);
  addDetail(list, ...ui.dimensions, size);
  const viewport = capture.recordedViewport;
  const viewportLabel = viewport ? `${viewport.width} × ${viewport.height ?? ui.heightUnavailable[0]}` : ui.unavailable[0];
  addDetail(list, ...ui.viewport, viewportLabel);
  addDetail(list, ...ui.sha, capture.sha256);
  addDetail(list, ...ui.artifact, capture.artifactSha256);
  addDetail(list, ...ui.archive, capture.archiveSha256);
  addDetail(list, ...ui.buildReceipt, capture.buildReceiptSha256);
  addDetail(list, ...ui.boundary, `${capture.boundaryEn} / ${capture.boundaryZh}`);
  detailPanel.append(list);
  detailButton.addEventListener('click', () => {
    const expanded = detailButton.getAttribute('aria-expanded') === 'true';
    detailButton.setAttribute('aria-expanded', String(!expanded));
    detailPanel.hidden = expanded;
    const button = detailButton.shadowRoot?.querySelector('button');
    button?.setAttribute('aria-expanded', String(!expanded));
    button?.setAttribute('aria-controls', detailPanel.id);
    detailButton.replaceChildren(pair(expanded ? ui.provenance[0] : ui.hideProvenance[0], expanded ? ui.provenance[1] : ui.hideProvenance[1]));
  });
  provenance.append(detailButton, detailPanel);

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const original = document.createElement('md-outlined-button');
  original.href = capture.file;
  original.target = '_blank';
  original.rel = 'noopener';
  original.setAttribute('aria-label', `Open original image / 開啟原始圖片: ${capture.titleEn}`);
  original.append(pair(ui.openImage[0], ui.openImage[1]));
  const metadata = document.createElement('md-outlined-button');
  metadata.href = 'captures.json';
  metadata.append(pair(ui.metadata[0], ui.metadata[1]));
  actions.append(original, metadata);
  body.append(provenance, actions);
  card.append(imgLink, body);
  return card;
}

function applyFilters() {
  const query = String(search.value || '').trim().toLocaleLowerCase();
  let visible = 0;
  for (const card of gallery.children) {
    const categoryMatches = activeFilter === 'all' || card.dataset.section === activeFilter;
    const searchMatches = !query || card.dataset.search.includes(query);
    const show = categoryMatches && searchMatches;
    card.hidden = !show;
    if (show) visible += 1;
  }
  results.replaceChildren(pair(...ui.shown(visible, captures.length)));
  empty.hidden = visible !== 0;
}

filterChips.forEach(chip => chip.addEventListener('click', () => {
  activeFilter = chip.dataset.filter;
  filterChips.forEach(item => { item.selected = item === chip; });
  applyFilters();
}));
search.addEventListener('input', applyFilters);
clearButton.addEventListener('click', () => {
  search.value = '';
  activeFilter = 'all';
  const all = filterChips.find(chip => chip.dataset.filter === 'all');
  all.selected = true;
  filterChips.filter(chip => chip !== all).forEach(chip => { chip.selected = false; });
  applyFilters();
  search.focus();
});

fetch('captures.json')
  .then(response => {
    if (!response.ok) throw new Error(`Capture metadata returned ${response.status}`);
    return response.json();
  })
  .then(data => {
    captures = data.captures;
    count.textContent = String(data.reviewedCaptureCount);
    const fragment = document.createDocumentFragment();
    captures.forEach(capture => fragment.append(createCard(capture)));
    gallery.append(fragment);
    applyFilters();
  })
  .catch(() => {
    count.textContent = 'Unavailable';
    results.replaceChildren(pair('The capture inventory could not be loaded. Reload this page to try again.', '無法載入截圖目錄，請重新載入此頁。'));
    empty.hidden = false;
    clearButton.hidden = true;
  });
