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
const language = document.querySelector('#language');
const setLanguage = (mode) => {
  document.documentElement.dataset.language = mode;
  document.documentElement.lang = 'en'; // Articles retain English; translated spans declare zh-HK.
  if (language) language.value = mode;
  save('mb-docs-language', mode);
};
setLanguage(read('mb-docs-language', 'both'));
language?.addEventListener('change', () => setLanguage(language.value));
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
