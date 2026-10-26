'use strict';

/* =====================================================================
   Watchlist for TradingView
   ===================================================================== */

/* ---------- constants ---------- */
const MAX_ITEMS = 1000;
const SYM_H = 40;             // symbol row: ticker | price over change
const SEC_H = 30;             // section header row
const TV = window.TV;

const TAGS = [
  { id: 'red', name: 'Red', color: '#f23645' },
  { id: 'blue', name: 'Blue', color: '#2962ff' },
  { id: 'green', name: 'Green', color: '#22ab94' },
  { id: 'orange', name: 'Orange', color: '#ff9800' },
  { id: 'purple', name: 'Purple', color: '#9c27b0' },
];
const TAG = Object.fromEntries(TAGS.map((t) => [t.id, t]));
const LIST_COLORS = ['#8a8a8a', '#f23645', '#ff9800', '#f5c400', '#22ab94', '#2962ff', '#9c27b0'];
const SEARCH_TYPES = [
  ['', 'All'], ['stocks', 'Stocks'], ['funds', 'Funds'], ['futures', 'Futures'],
  ['forex', 'Forex'], ['crypto', 'Crypto'], ['index', 'Indices'], ['bond', 'Bonds'],
];
const TYPE_LABEL = {
  stock: 'stock', fund: 'fund', dr: 'DR', futures: 'futures', forex: 'forex', spot: 'crypto',
  crypto: 'crypto', index: 'index', bond: 'bond', economic: 'economy', swap: 'swap', cfd: 'CFD',
};

// Icons come from the sprite in sidepanel.html so every icon shares one style.
const ico = (id, cls = '', style = '') => `<svg class="ic ${cls}"${style ? ` style="${style}"` : ''}><use href="#i-${id}"/></svg>`;
// A tag bookmark: filled in the tag's color, or an outline when untagged.
const bookmarkSvg = (color) => color ? ico('bookmark', '', `color:${color};fill:${color}`) : ico('bookmark');
const ICON = { del: ico('x'), chev: ico('chev', 'chev'), check: ico('check'), plus: ico('plus'), ban: ico('ban') };

// Stable hue per ticker for letter avatars when there is no logo.
const hueOf = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Escape everything, then turn TradingView's <em> match markers into <b>.
const hlHtml = (s) => esc(s).replace(/&lt;(\/?)em&gt;/g, '<$1b>');

/* ---------- storage (chrome.storage.local with localStorage fallback) ---------- */
const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
const store = {
  async load() {
    if (hasChromeStorage) return (await chrome.storage.local.get('wl')).wl || null;
    try { return JSON.parse(localStorage.getItem('wl') || 'null'); } catch { return null; }
  },
  async save(d) {
    if (hasChromeStorage) return chrome.storage.local.set({ wl: d });
    localStorage.setItem('wl', JSON.stringify(d));
  },
};

/* ---------- state ----------
 data = {
   v: 3, theme, wheel,
   active: 'list:<id>' | 'tag:<color>',
   lists: [{ id, name, color, items: [ {s, t} | {sec, c, t} ] }],
   meta:  { 'NASDAQ:AAPL': { f: 'red', ft: taggedAt, n: 'note' } }   // tags + notes are per symbol
 }
*/
let data = null;
let src = null;               // what the panel is showing: a list or a tag
let view = [];                // indices into src.items, in display order
let secCount = new Map();
let activeIdx = -1;           // keyboard selection (index into view)
let editingSym = null;        // symbol whose note is being edited
let currentSym = null;        // symbol on the TradingView chart
let currentItemIdx = -1;
let saveTimer = null;
let lastSaved = '';
let lastNavAt = 0;
let tops = [0];               // y offset of each row in view (variable heights)
let filterOpen = false;

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function defaultData() {
  const id = uid();
  return { v: 3, theme: 'system', wheel: false, active: 'list:' + id, lists: [{ id, name: 'Default', color: LIST_COLORS[0], items: [] }], meta: {}, logos: {} };
}

// Accepts any earlier version and upgrades it in place.
function migrate(d) {
  if (!d || !Array.isArray(d.lists) || !d.lists.length) return defaultData();
  d.meta = d.meta || {};
  for (const l of d.lists) {
    l.id = l.id || uid();
    l.name = l.name || 'Untitled';
    l.items = (l.items || []).map((it) => {
      if (it.sec) return { sec: it.sec, c: !!it.c, t: it.t || 0 };
      if (it.f || it.n) {
        const m = d.meta[it.s] || (d.meta[it.s] = {});
        if (it.f && !m.f) { m.f = TAG[it.f] ? it.f : 'orange'; m.ft = it.t || Date.now(); }
        if (it.n && !m.n) m.n = it.n;
      }
      return { s: it.s, t: it.t || 0 };
    });
  }
  for (const s of Object.keys(d.meta)) {
    const m = d.meta[s];
    if (m.f && !TAG[m.f]) m.f = 'orange';
  }
  if (!d.active && d.activeListId) d.active = 'list:' + d.activeListId;
  delete d.activeListId;
  const ok =
    (d.active || '').startsWith('tag:') ? !!TAG[d.active.slice(4)]
    : d.lists.some((l) => 'list:' + l.id === d.active);
  if (!ok) d.active = 'list:' + d.lists[0].id;
  d.theme = d.theme || 'system';
  d.wheel = !!d.wheel;
  // Seconds between price updates (0 = manual). Older versions defaulted to 5s or allowed 2s; move them to 15s once.
  if (d.refreshV !== 2) { if (d.refresh === 2 || d.refresh === 5 || d.refresh == null) d.refresh = 15; d.refreshV = 2; }
  d.refresh = [0, 5, 15, 60].includes(d.refresh) ? d.refresh : 15;
  d.session = d.session !== false;                                  // fetch prices with the user's TradingView login
  d.logos = d.logos && typeof d.logos === 'object' ? d.logos : {};
  d.v = 3;
  return d;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    lastSaved = JSON.stringify(data);
    store.save(data);
  }, 120);
}

const EMPTY_META = Object.freeze({});
const meta = (s) => data.meta[s] || EMPTY_META;
function setMeta(s, patch) {
  const m = { ...(data.meta[s] || {}), ...patch };
  if (!m.f) { delete m.f; delete m.ft; }
  if (!m.n) delete m.n;
  if (Object.keys(m).length) data.meta[s] = m; else delete data.meta[s];
  scheduleSave();
}
function tagItems(tag) {
  const out = [];
  for (const s in data.meta) if (data.meta[s].f === tag) out.push({ s, t: data.meta[s].ft || 0 });
  return out.sort((a, b) => a.t - b.t);
}
function tagCount(tag) {
  let n = 0;
  for (const s in data.meta) if (data.meta[s].f === tag) n++;
  return n;
}
const symbolCount = (items) => items.reduce((n, it) => n + (it.s ? 1 : 0), 0);

function computeSource() {
  if (data.active.startsWith('tag:')) {
    const tag = data.active.slice(4);
    return { kind: 'tag', tag, items: tagItems(tag), name: TAG[tag].name + ' list', color: TAG[tag].color };
  }
  const list = data.lists.find((l) => 'list:' + l.id === data.active) || data.lists[0];
  return { kind: 'list', list, items: list.items, name: list.name, color: list.color || LIST_COLORS[0] };
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const el = {
  themeSeg: $('themeSeg'), sectionBtn: $('sectionBtn'), menuBtn: $('menuBtn'), menu: $('menu'), wheelToggle: $('wheelToggle'), closeBtn: $('closeBtn'),
  listColor: $('listColor'), listName: $('listName'), listNameText: $('listNameText'), listMenu: $('listMenu'),
  addBtn: $('addBtn'), filterBtn: $('filterBtn'),
  searchRow: $('searchRow'), searchInput: $('searchInput'), filterCount: $('filterCount'),
  viewport: $('viewport'), spacer: $('spacer'), rows: $('rows'), empty: $('empty'),
  footDot: $('footDot'), footText: $('footText'), count: $('count'), footBtn: $('footBtn'),
  ss: $('ss'), ssTarget: $('ssTarget'), ssClose: $('ssClose'), ssInput: $('ssInput'), ssClear: $('ssClear'),
  ssTabs: $('ssTabs'), ssTabsWrap: $('ssTabsWrap'), ssTabsPrev: $('ssTabsPrev'), ssTabsNext: $('ssTabsNext'),
  ssBar: $('ssBar'), ssResults: $('ssResults'),
  flagPop: $('flagPop'),
  dlg: $('dlg'), dlgForm: $('dlgForm'), dlgTitle: $('dlgTitle'), dlgMsg: $('dlgMsg'), dlgInput: $('dlgInput'),
  dlgOk: $('dlgOk'), dlgCancel: $('dlgCancel'),
  toast: $('toaster'), fileInput: $('fileInput'),
  refreshSeg: $('refreshSeg'), sessionToggle: $('sessionToggle'), syncBtn: $('syncBtn'),
  priceWrap: $('priceWrap'), priceState: $('priceState'), priceAgo: $('priceAgo'),
};
const EMPTY_HINT = `Search by ticker or company and add it in one keystroke.<br><button class="cta" data-act="openSearch">${ico('plus')}Add symbol</button>`;
const TAG_HINT = (name) => `Tag a symbol with the ${ico('bookmark')} on its row and it shows up in the ${esc(name)}.`;

/* ---------- symbol parsing ---------- */
function normalizeSymbol(raw) {
  let s = String(raw).trim().toUpperCase();
  if (!s) return null;
  s = s.replace(/^["']+|["']+$/g, '').replace(/\s+/g, '');
  if (!/^[A-Z0-9][A-Z0-9:._\-!&/]*$/.test(s) || s.length > 40) return null;
  return s;
}

// Understands TradingView's export ("###Section,EXCH:SYM,...") and plain lists.
function parseEntries(text) {
  const out = [];
  const seen = new Set();
  String(text).split(/\r?\n|(?=###)/).forEach((line) => {
    line.split(/[,;\t]+/).forEach((part) => {
      part = part.trim();
      if (!part) return;
      if (part.startsWith('###')) {
        const name = part.slice(3).trim().slice(0, 60);   // same cap as typed names
        if (name) out.push({ sec: name });
        return;
      }
      part.split(/\s+/).forEach((tok) => {
        const s = normalizeSymbol(tok);
        if (s && !seen.has(s)) { seen.add(s); out.push({ s }); }
      });
    });
  });
  return out;
}

function splitSymbol(s) {
  const i = s.indexOf(':');
  return i > 0 ? { exch: s.slice(0, i), ticker: s.slice(i + 1) } : { exch: '', ticker: s };
}
const tickerOf = (s) => splitSymbol(s).ticker;

/* ---------- dialogs (in-panel, consistent with the UI) ---------- */
let dlgResolve = null;
function openDialog({ title, message = '', input = null, okText = 'OK', danger = false }) {
  el.dlgTitle.textContent = title;
  el.dlgMsg.textContent = message;
  el.dlgInput.hidden = input === null;
  el.dlgInput.value = input ?? '';
  el.dlgOk.textContent = okText;
  el.dlgOk.className = 'btn' + (danger ? ' danger' : '');
  el.dlg.hidden = false;
  setTimeout(() => {
    if (input === null) el.dlgOk.focus();
    else { el.dlgInput.focus(); el.dlgInput.select(); }
  }, 0);
  return new Promise((res) => (dlgResolve = res));
}
function closeDialog(result) {
  el.dlg.hidden = true;
  const r = dlgResolve;
  dlgResolve = null;
  if (r) r(result);
}
const dlgCancelValue = () => (el.dlgInput.hidden ? false : null);
el.dlgForm.addEventListener('submit', (e) => {
  e.preventDefault();
  closeDialog(el.dlgInput.hidden ? true : el.dlgInput.value.trim() || null);
});
el.dlgCancel.addEventListener('click', () => closeDialog(dlgCancelValue()));
el.dlg.addEventListener('mousedown', (e) => { if (e.target === el.dlg) closeDialog(dlgCancelValue()); });
const askText = (title, value = '', okText = 'Save') => openDialog({ title, input: value, okText });
const askConfirm = (title, message, okText = 'Delete') => openDialog({ title, message, okText, danger: true });

/* ---------- actions ---------- */
function addEntries(entries, { quiet = false } = {}) {
  let dupes = 0, overflow = 0, sections = 0;
  const addedSyms = [], dupeSyms = [];
  const now = Date.now();
  if (src.kind === 'tag') {
    let count = src.items.length;
    for (const e of entries) {
      if (!e.s) continue;
      if (meta(e.s).f === src.tag) { dupes++; dupeSyms.push(e.s); continue; }
      if (count >= MAX_ITEMS) { overflow++; continue; }
      setMeta(e.s, { f: src.tag, ft: now + addedSyms.length });
      addedSyms.push(e.s); count++;
    }
  } else {
    const list = src.list;
    const existing = new Set(list.items.filter((i) => i.s).map((i) => i.s));
    let count = existing.size;
    for (const e of entries) {
      if (e.sec) { list.items.push({ sec: e.sec, c: false, t: now }); sections++; continue; }
      if (existing.has(e.s)) { dupes++; dupeSyms.push(e.s); continue; }
      if (count >= MAX_ITEMS) { overflow++; continue; }
      list.items.push({ s: e.s, t: now + addedSyms.length });
      existing.add(e.s);
      count++; addedSyms.push(e.s);
    }
  }
  const added = addedSyms.length;
  scheduleSave();
  refresh();
  if (!quiet) {
    if (overflow) {
      toast('List is full', { type: 'error', description: `${plural(overflow, 'symbol')} weren't added. A list holds up to ${nf(0).format(MAX_ITEMS)}.` });
    } else if (!added && dupes) {
      toast(dupes === 1 ? `${tickerOf(dupeSyms[0])} is already in ${src.name}` : `All ${dupes} symbols are already in ${src.name}`, { type: 'info' });
    } else if (added) {
      const extra = [];
      if (dupes) extra.push(`${plural(dupes, 'symbol')} already in the list`);
      if (sections) extra.push(plural(sections, 'section'));
      toast(added === 1 ? `Added ${tickerOf(addedSyms[0])}` : `Added ${added} symbols`, { type: 'success', description: extra.join(' · ') });
    }
  }
  return { added, dupes, overflow, syms: addedSyms };
}
const plural = (n, word) => `${nf(0).format(n)} ${word}${n === 1 ? '' : 's'}`;

// Symbols typed, pasted or imported are checked against TradingView after they
// are added. Bare tickers get their exchange; anything TradingView doesn't list
// is taken back out and reported, so the list never holds dead rows.
const validating = new Set();
// TradingView writes dashes in tickers as underscores: NSE:BAJAJ-AUTO is NSE:BAJAJ_AUTO.
const tvSpelling = (s) => s.replace(/-/g, '_');
async function validateAdded(syms) {
  if (!syms || !syms.length) return { failed: [], stopped: false };
  const target = data.active;
  syms.forEach((s) => validating.add(s));
  const failed = [];
  let renamed = 0, checked = 0, stopped = false;
  const total = syms.length;
  const progress = total > 10
    ? toast(`Checking ${plural(total, 'symbol')}`, { type: 'info', description: 'Matching them with TradingView', duration: Infinity })
    : null;
  const tick = (n) => { checked += n; if (progress) updateToast(progress, { description: `${nf(0).format(Math.min(checked, total))} of ${nf(0).format(total)} checked` }); };
  try {
    const full = syms.filter((s) => s.includes(':'));
    const bare = syms.filter((s) => !s.includes(':'));
    const notFound = [];
    for (let i = 0; i < full.length; i += 200) {
      if (limited()) { stopped = true; break; }
      const chunk = full.slice(i, i + 200);
      const ask = [...new Set(chunk.concat(chunk.map(tvSpelling)))];
      const got = new Set((await TV.quotes(ask, { session: data.session })).map((q) => q.sym));
      let ok = 0;
      for (const s of chunk) {
        if (got.has(s)) ok++;
        else if (got.has(tvSpelling(s))) { renameSymbol(s, tvSpelling(s)); renamed++; ok++; }
        else notFound.push(s);
      }
      tick(ok);
      await pause(SEARCH_GAP);
    }
    // The price service doesn't carry every instrument; confirm with symbol search before rejecting.
    for (const s of notFound) {
      if (stopped || limited()) { stopped = true; break; }
      const { exch, ticker } = splitSymbol(s);
      const res = await TV.search(ticker, '', exch, { session: data.session });
      const hit = res.find((r) => r.id === s || r.id === tvSpelling(s));
      if (!hit) failed.push(s);
      else if (hit.id !== s) { renameSymbol(s, hit.id, hit.logos[0]); renamed++; }
      tick(1);
      await pause(SEARCH_GAP);
    }
    const pref = preferredExchange();
    for (const s of bare) {
      if (stopped || limited()) { stopped = true; break; }
      const res = await TV.search(s, '', '', { session: data.session });
      const exact = res.filter((r) => r.ticker.toUpperCase() === s || r.ticker.toUpperCase() === tvSpelling(s));
      const pick = (pref && exact.find((r) => r.id.startsWith(pref + ':'))) || exact[0];
      if (pick) { renameSymbol(s, pick.id, pick.logos[0]); renamed++; }
      else failed.push(s);
      tick(1);
      await pause(SEARCH_GAP);
    }
  } catch (e) {
    // Rate limited: pause everything. Unreachable: keep what was added; rows show "No data" if wrong.
    if (e instanceof TV.RateLimited) hitLimit();
    stopped = true;
  } finally {
    syms.forEach((s) => validating.delete(s));
    if (progress) dismissToast(progress);
  }
  if (failed.length) removeSymbols(failed, target);
  if (renamed || failed.length) { scheduleSave(); refresh(); }
  return { failed, stopped };
}

// Copy symbols as "A, B, C" and confirm on the button itself.
async function copyList(list, btn) {
  const label = btn.innerHTML;
  try {
    await navigator.clipboard.writeText(list.join(', '));
    btn.innerHTML = `${ico('check')}<span>Copied</span>`;
    btn.classList.add('done');
  } catch {
    btn.innerHTML = `<span>Couldn't copy</span>`;
  }
  setTimeout(() => { btn.innerHTML = label; btn.classList.remove('done'); }, 1500);
}

// Add typed / pasted / imported symbols, check them, then show one accurate result.
async function addAndValidate(entries) {
  const listName = src.name;
  const res = addEntries(entries, { quiet: true });
  const { failed, stopped } = await validateAdded(res.syms);
  const ok = res.added - failed.length;
  if (res.overflow) toast('List is full', { type: 'error', description: `${plural(res.overflow, 'symbol')} weren't added. A list holds up to ${nf(0).format(MAX_ITEMS)}.` });
  if (ok > 0) {
    const okSyms = res.syms.filter((x) => !failed.includes(x));
    toast(ok === 1 ? `Added ${tickerOf(okSyms[0])}` : `Added ${ok} symbols`, {
      type: 'success',
      description: stopped ? 'Some are still to be checked; that resumes on its own.'
        : res.dupes ? `${plural(res.dupes, 'symbol')} already in ${listName}` : `to ${listName}`,
    });
  } else if (res.dupes && !failed.length && !res.overflow) {
    toast(res.dupes === 1 ? 'Already in this list' : `All ${res.dupes} symbols are already in ${listName}`, { type: 'info' });
  }
  if (failed.length) {
    const names = failed.map((x) => tickerOf(x));
    toast(failed.length === 1 ? `${names[0]} wasn't added` : `${failed.length} symbols weren't added`, {
      type: 'error',
      duration: 12000,
      description: failed.length === 1
        ? "TradingView doesn't list it. Check the ticker and exchange."
        : "TradingView doesn't list these. Check the tickers and exchanges.",
      action: { label: failed.length === 1 ? 'Copy symbol' : `Copy ${failed.length} symbols`, icon: 'copy', onClick: (btn) => copyList(failed, btn) },
    });
  }
}

function removeSymbols(syms, key) {
  const drop = new Set(syms);
  if (key.startsWith('tag:')) syms.forEach((s) => setMeta(s, { f: '' }));
  else {
    const l = data.lists.find((x) => 'list:' + x.id === key);
    if (l) l.items = l.items.filter((i) => !drop.has(i.s));
  }
  syms.forEach((s) => quoteCache.delete(s));
}

function removeAt(itemIdx) {
  const it = src.items[itemIdx];
  if (!it) return;
  if (src.kind === 'tag') {
    setMeta(it.s, { f: '' });
    refresh();
    toast(`Removed ${tickerOf(it.s)} from ${src.name}`);
    return;
  }
  src.list.items.splice(itemIdx, 1);
  scheduleSave();
  refresh();
  toast(it.sec ? `Removed section "${it.sec}"` : `Removed ${tickerOf(it.s)}`);
}

function setTag(sym, tag) {
  const prev = meta(sym).f || '';
  if (prev === tag) return;
  setMeta(sym, { f: tag, ft: Date.now() });
  if (src.kind === 'tag') refresh(); else renderRows();
  toast(tag ? `${tickerOf(sym)} → ${TAG[tag].name} list` : `Tag removed from ${tickerOf(sym)}`);
}

function toggleSection(itemIdx) {
  const it = src.items[itemIdx];
  it.c = !it.c;
  scheduleSave();
  buildView();
}

async function renameSection(itemIdx) {
  const it = src.items[itemIdx];
  const name = await askText('Rename section', it.sec);
  if (!name || name === it.sec) return;
  it.sec = name;
  scheduleSave();
  renderRows();
}

/* ---------- chart control ---------- */
let chartTimer;
function showOnChart(sym, delay = 0) {
  lastNavAt = Date.now();
  setCurrent(sym);
  clearTimeout(chartTimer);
  chartTimer = setTimeout(async () => {
    const r = await TV.showSymbol(sym);
    if (r === 'opened') toast('Opened TradingView');
    updateFooter();
  }, delay);
}

function setCurrent(sym) {
  currentSym = sym;
  computeCurrentIdx();
  renderRows();
  updateFooterText();
}

function computeCurrentIdx() {
  currentItemIdx = -1;
  if (!currentSym) return;
  const t = tickerOf(currentSym);
  let byTicker = -1;
  for (let i = 0; i < src.items.length; i++) {
    const it = src.items[i];
    if (!it.s) continue;
    if (it.s === currentSym) { currentItemIdx = i; return; }
    if (byTicker < 0 && tickerOf(it.s) === t) byTicker = i;
  }
  currentItemIdx = byTicker;
}

// Select the nearest symbol row at/after `target` (in direction `dir`) and chart it.
function selectAt(target, dir) {
  if (!view.length) return;
  let i = Math.max(0, Math.min(view.length - 1, target));
  while (i >= 0 && i < view.length && src.items[view[i]].sec) i += dir;
  if (i < 0 || i >= view.length || i === activeIdx) return;
  activeIdx = i;
  ensureVisible(i);
  showOnChart(src.items[view[i]].s, 90);
}

// Step to the next/previous symbol and switch the chart to it.
function moveSel(delta) {
  let from = activeIdx;
  if (from < 0) {
    const cur = view.indexOf(currentItemIdx);
    from = cur >= 0 ? cur : delta > 0 ? -1 : view.length;
  }
  const target = from + delta;
  if (target < 0 || target >= view.length) return;
  selectAt(target, delta);
}

function ensureVisible(vi) {
  const top = tops[vi], bottom = tops[vi + 1];
  const vp = el.viewport;
  if (top < vp.scrollTop) vp.scrollTop = top;
  else if (bottom > vp.scrollTop + vp.clientHeight) vp.scrollTop = bottom - vp.clientHeight;
}

/* ---------- theme ---------- */
// "system" follows TradingView's own theme when docked inside it.
let tvTheme = null;
function applyTheme() {
  const follow = data.theme === 'system' && !!tvTheme;
  const t = follow ? tvTheme : data.theme;
  document.documentElement.setAttribute('data-theme', t);
  // Following TradingView: use its exact panel colour as the background.
  document.documentElement.classList.toggle('follow-tv', follow && !!document.documentElement.style.getPropertyValue('--tv-panel'));
  try { localStorage.setItem('wl-theme', t); } catch {}
}
function setTheme(theme) {
  data.theme = theme;
  applyTheme();
  el.themeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.theme === theme));
  scheduleSave();
}
window.addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data || e.data.wl !== 'tvTheme') return;
  tvTheme = e.data.theme === 'dark' ? 'dark' : 'light';
  if (typeof e.data.bg === 'string' && /^(#|rgb)/.test(e.data.bg)) document.documentElement.style.setProperty('--tv-panel', e.data.bg);
  if (data) applyTheme();
});

/* ---------- rendering ---------- */
function refresh() {
  src = computeSource();
  renderListBar();
  computeCurrentIdx();
  buildView();
  if (!el.listMenu.hidden) renderListMenu();
}

function renderListBar() {
  const isTag = src.kind === 'tag';
  el.listNameText.textContent = src.name;
  el.listName.title = `${src.name} · switch list`;
  el.listColor.classList.toggle('is-tag', isTag);
  el.listColor.style.background = isTag ? 'transparent' : src.color;
  el.listColor.innerHTML = isTag ? bookmarkSvg(src.color) : '';
  el.listColor.title = isTag ? src.name : 'Change list color';
  const n = symbolCount(src.items);
  el.count.textContent = `${nf(0).format(n)} / ${nf(0).format(MAX_ITEMS)}`;
  el.count.title = `${nf(0).format(n)} of ${nf(0).format(MAX_ITEMS)} symbols`;
  el.sectionBtn.disabled = isTag;
  el.wheelToggle.classList.toggle('on', data.wheel);
  renderRefreshSeg();
}

function buildView() {
  const q = el.searchInput.value.trim().toUpperCase();
  const items = src.items;
  view = [];
  secCount = new Map();
  let collapsed = false, curSec = -1, symbols = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.sec) {
      curSec = i; secCount.set(i, 0); collapsed = !!it.c;
      if (!q) view.push(i);
      continue;
    }
    symbols++;
    if (curSec >= 0) secCount.set(curSec, secCount.get(curSec) + 1);
    if (q) {
      const n = meta(it.s).n;
      const nm = quoteCache.get(it.s)?.name;
      if (it.s.includes(q) || (n && n.toUpperCase().includes(q)) || (nm && nm.toUpperCase().includes(q))) view.push(i);
    } else if (!collapsed) view.push(i);
  }
  el.filterCount.hidden = !q;
  if (q) el.filterCount.textContent = `${view.length}`;
  if (activeIdx >= view.length) activeIdx = view.length - 1;
  tops = [0];
  for (const idx of view) tops.push(tops[tops.length - 1] + (items[idx].sec ? SEC_H : SYM_H));
  el.spacer.style.height = tops[tops.length - 1] + 'px';

  el.searchRow.hidden = !filterOpen;
  el.filterBtn.classList.toggle('on', filterOpen);
  el.filterBtn.disabled = symbols === 0 && !q;
  const title = el.empty.querySelector('.empty-title');
  const hint = el.empty.querySelector('.empty-hint');
  if (symbols === 0) {
    el.empty.hidden = false;
    if (src.kind === 'tag') {
      title.textContent = `${src.name} is empty`;
      hint.innerHTML = TAG_HINT(src.name);
    } else {
      title.textContent = 'This list is empty';
      hint.innerHTML = EMPTY_HINT;
    }
  } else if (view.length === 0) {
    el.empty.hidden = false;
    title.textContent = 'No matches';
    hint.innerHTML = `<button class="link-btn" data-act="searchTV">Search TradingView for “${esc(el.searchInput.value.trim())}”</button>`;
  } else {
    el.empty.hidden = true;
  }
  renderRows();
}

// First row index whose bottom edge is below y.
function rowAt(y) {
  let lo = 0, hi = view.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (tops[mid + 1] <= y) lo = mid + 1; else hi = mid; }
  return lo;
}

function renderRows() {
  const items = src.items;
  const vp = el.viewport;
  const start = Math.max(0, rowAt(vp.scrollTop) - 4);
  const end = Math.min(view.length, rowAt(vp.scrollTop + vp.clientHeight) + 5);
  const frag = document.createDocumentFragment();
  rendered = [];

  for (let vi = start; vi < end; vi++) {
    const idx = view[vi];
    const it = items[idx];
    const row = document.createElement('div');
    row.style.transform = `translateY(${tops[vi]}px)`;
    row.dataset.vi = vi;
    row.dataset.idx = idx;

    if (it.sec) {
      row.className = 'row sec' + (it.c ? ' collapsed' : '') + (vi === activeIdx ? ' active' : '');
      row.title = 'Click to collapse · double-click to rename';
      row.innerHTML = `${ICON.chev}<span class="sec-name">${esc(it.sec)}</span><span class="sec-count">${nf(0).format(secCount.get(idx) || 0)}</span><button class="del" data-act="del" title="Remove section (keeps its symbols)">${ICON.del}</button>`;
      frag.appendChild(row);
      continue;
    }

    const { exch, ticker } = splitSymbol(it.s);
    const m = meta(it.s);
    const q = quoteCache.get(it.s);
    rendered.push(it.s);
    row.className = 'row sym' + (vi === activeIdx ? ' active' : '') + (idx === currentItemIdx ? ' current' : '');
    row.dataset.sym = it.s;
    row.title = q && q.name ? `${it.s} · ${q.name}` : it.s;
    const tagColor = m.f ? TAG[m.f].color : null;
    const sub = editingSym === it.s
      ? `<input class="note-input" data-act="note" maxlength="120" placeholder="Add a note" value="${esc(m.n || '')}">`
      : m.n
        ? `<span class="name note">${esc(m.n)}</span>`
        : q && q.missing ? `<span class="name">No data from TradingView</span>` : '';
    row.innerHTML =
      `<button class="flag${m.f ? ' set' : ''}" data-act="flag" title="${m.f ? 'In ' + TAG[m.f].name + ' list' : 'Tag this symbol'}">${bookmarkSvg(tagColor)}</button>` +
      avatarHtml(it.s, ticker, q) +
      `<span class="body">` +
        `<span class="left"><span class="sym-line"><span class="sym">${esc(ticker)}</span>${exch ? `<span class="ex-badge" title="${esc(exch)}">${esc(exch)}</span>` : ''}</span>${sub}</span>` +
        `<span class="right">${priceHtml(q)}${chgHtml(q)}</span>` +
      `</span>` +
      `<button class="del" data-act="del" title="${src.kind === 'tag' ? 'Remove from ' + esc(src.name) : 'Remove'}">${ICON.del}</button>`;
    frag.appendChild(row);
  }
  el.rows.replaceChildren(frag);
  el.rows.querySelectorAll('.row.sym').forEach(fitRow);
  if (initialDone && rendered.some((s) => s.includes(':') && !quoteCache.has(s))) scheduleQuotes(400);   // a newly added symbol's first price

  if (editingSym) {
    const inp = el.rows.querySelector('.note-input');
    if (inp && document.activeElement !== inp) { inp.focus(); inp.select(); }
  }
}

/* ---------- bare tickers ----------
 A ticker saved without its exchange ("SSWL" instead of "NSE:SSWL") gets no
 price from TradingView. Match each one to its listing with symbol search,
 preferring the exchange the rest of the user's symbols (and chart) use. */
let resolving = false;
const resolveFailed = new Set();
function preferredExchange() {
  const n = new Map();
  const add = (sym, w = 1) => { const i = sym.indexOf(':'); if (i > 0) { const ex = sym.slice(0, i); n.set(ex, (n.get(ex) || 0) + w); } };
  for (const l of data.lists) for (const it of l.items) if (it.s) add(it.s);
  if (currentSym) add(currentSym, 3);
  let best = '', max = 0;
  for (const [ex, c] of n) if (c > max) { best = ex; max = c; }
  return best;
}
function renameSymbol(from, to, logo) {
  for (const l of data.lists) {
    if (!l.items.some((i) => i.s === from)) continue;
    const has = l.items.some((i) => i.s === to);
    l.items = l.items.filter((i) => !(has && i.s === from)).map((i) => (i.s === from ? { ...i, s: to } : i));
  }
  if (data.meta[from]) { data.meta[to] = { ...data.meta[from], ...(data.meta[to] || {}) }; delete data.meta[from]; }
  if (logo && !data.logos[to]) data.logos[to] = logo;
  delete data.logos[from];
  quoteCache.delete(from);
  if (currentSym === from) currentSym = to;
}
async function resolveBareSymbols() {
  if (resolving || limited()) return;
  const bare = [...new Set(data.lists.flatMap((l) => l.items.filter((i) => i.s && !i.s.includes(':') && !resolveFailed.has(i.s) && !validating.has(i.s)).map((i) => i.s)))];
  if (!bare.length) return;
  resolving = true;
  const pref = preferredExchange();
  bare.sort((a, b) => (rendered.includes(b) ? 1 : 0) - (rendered.includes(a) ? 1 : 0));   // on-screen first
  const progress = bare.length > 10
    ? toast(`Matching ${plural(bare.length, 'symbol')} to their exchange`, { type: 'info', description: 'This runs slowly to stay within TradingView limits', duration: Infinity })
    : null;
  let fixed = 0, done = 0, sinceRender = 0;
  for (const sym of bare) {
    if (limited()) break;
    let res;
    try { res = await TV.search(sym, '', '', { session: data.session }); }
    catch (e) { if (e instanceof TV.RateLimited) hitLimit(); break; }   // try again later
    const exact = res.filter((r) => r.ticker.toUpperCase() === sym || r.ticker.toUpperCase() === tvSpelling(sym));
    const pick = (pref && exact.find((r) => r.id.startsWith(pref + ':'))) || exact[0];
    if (pick) { renameSymbol(sym, pick.id, pick.logos[0]); fixed++; sinceRender++; }
    else {
      resolveFailed.add(sym);
      const miss = { sym, missing: true, logos: [] };
      quoteCache.set(sym, miss);
      patchRow(miss, null);
    }
    done++;
    if (progress) updateToast(progress, { description: `${nf(0).format(done)} of ${nf(0).format(bare.length)} done` });
    if (sinceRender >= 10) { sinceRender = 0; scheduleSave(); refresh(); }   // show progress on long lists
    await pause(SEARCH_GAP);
  }
  resolving = false;
  if (progress) dismissToast(progress);
  if (fixed) {
    scheduleSave();
    refresh();
    toast(`Matched ${plural(fixed, 'symbol')} to ${pref || 'their exchanges'}`, { type: 'success' });
  }
}

// When a row is too cramped to show the ticker, drop the point change for that row only.
function fitRow(row) {
  const sym = row.querySelector('.sym');
  if (!sym) return;
  // The ticker comes first: drop the point change, then the exchange badge, until it fits.
  // Compare exact widths: scrollWidth rounds, which hides a sub-pixel overflow that still ellipsizes.
  const range = document.createRange();
  range.selectNodeContents(sym);
  const cut = () => range.getBoundingClientRect().width > sym.getBoundingClientRect().width + 0.25;
  row.classList.remove('tight', 'no-badge');
  if (cut() && row.querySelector('.chg .abs')) row.classList.add('tight');
  if (cut() && row.querySelector('.sym-line .ex-badge')) row.classList.add('no-badge');
}

/* ---------- logos ---------- */
const badLogos = new Set();   // logo URLs that failed to load: show the letter instead
function avatarHtml(sym, ticker, q) {
  const urls = ((q && q.logos.length) ? q.logos : (data.logos[sym] ? [data.logos[sym]] : [])).filter((u) => !badLogos.has(u));
  const imgs = urls.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('');
  return `<span class="av${urls.length > 1 ? ' pair' : ''}" style="--h:${hueOf(ticker)}">${esc(ticker[0] || '?')}${imgs}</span>`;
}

/* ---------- quotes ----------
 Prices for the rows on screen (plus a few either side) are fetched in one
 request and refreshed every few seconds while the dock is visible. Price
 cells are patched in place so a tick never re-renders the list. */
const quoteCache = new Map();
let rendered = [];
let quoteTimer = null;
let lastQuoteAt = 0;
let quoteStatus = { delayMin: 0, failed: false };

const numFmt = new Map();
function nf(dec) {
  if (!numFmt.has(dec)) numFmt.set(dec, new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
  return numFmt.get(dec);
}
const round = (v, dec) => Number(v.toFixed(dec));
const sign = (v) => (v > 0 ? '+' : v < 0 ? '\u2212' : '');
const dirOf = (q) => (q && q.ch != null ? Math.sign(round(q.ch, q.dec)) : 0);
const dirClass = (q) => ['down', 'flat', 'up'][dirOf(q) + 1];
// Billions and up (market caps, TOTAL2) in short form, as TradingView does: 1.523T.
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 3 });
const fmtNum = (v, dec) => (Math.abs(v) >= 1e9 ? compact.format(v) : nf(dec).format(v));
const fmtPrice = (q) => (q.price == null ? '\u2014' : fmtNum(q.price, q.dec));
function fmtChange(q) {
  if (q.ch == null || q.chp == null) return '';
  const ch = round(q.ch, q.dec), chp = round(q.chp, 2);
  const sg = sign(ch);   // percent takes the sign of the move even when it rounds to 0.00
  return `<span class="abs">${sg}${fmtNum(Math.abs(ch), q.dec)}</span><span class="pct">${sg}${nf(2).format(Math.abs(chp))}%</span>`;
}
// Placeholder bars until the first price arrives; a dash when there is no data.
function priceHtml(q) {
  if (!q) return '<span class="price"><span class="sk sk-price"></span></span>';
  if (q.missing) return '<span class="price muted" title="TradingView has no price for this symbol">\u2014</span>';
  return `<span class="price">${fmtPrice(q)}</span>`;
}
function chgHtml(q) {
  if (!q) return '<span class="chg"><span class="sk sk-chg"></span></span>';
  if (q.missing) return '<span class="chg"></span>';
  return `<span class="chg ${dirClass(q)}">${fmtChange(q)}</span>`;
}

/* Safeguards so the extension stays a light, polite client of TradingView:
   - one request at a time, only for rows on screen, only while visible;
   - every open dock shares what it fetched, so tabs don't repeat each other;
   - errors slow polling down; a "slow down" answer (429/503/blocked) pauses
     prices and symbol checks in every tab: 30s, then 1m, 2m ... up to 5m. */
const SEARCH_GAP = 400;                  // ms between symbol checks
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let backoffUntil = 0, backoffMs = 0, failStreak = 0, lastLimitToast = 0;
const limited = () => Date.now() < backoffUntil;
const fmtWait = (ms) => { const s = Math.max(1, Math.ceil(ms / 1000)); return s < 60 ? `${s}s` : `${Math.ceil(s / 60)}m`; };
let quotePromise = null;
let shared = { at: 0, syms: new Set() };
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('wl-quotes') : null;

function hitLimit(fromPeer = false, peer = null) {
  if (peer) { backoffMs = peer.ms; backoffUntil = Math.max(backoffUntil, peer.until); }
  else {
    backoffMs = Math.min(300000, backoffMs ? backoffMs * 2 : 30000);
    backoffUntil = Date.now() + backoffMs;
  }
  if (!fromPeer) {
    bc?.postMessage({ type: 'limit', until: backoffUntil, ms: backoffMs });
    if (Date.now() - lastLimitToast > 60000) {
      lastLimitToast = Date.now();
      toast('TradingView asked us to slow down', { type: 'error', description: `Prices and symbol checks are paused for ${fmtWait(backoffMs)}. They resume on their own.` });
    }
  }
  updatePriceStatus();
  scheduleQuotes();
}

function scheduleQuotes(delay) {
  clearTimeout(quoteTimer);
  if (delay == null) {
    if (!data.refresh) { if (limited()) quoteTimer = setTimeout(updatePriceStatus, backoffUntil - Date.now() + 250); return; }
    // After failures, wait longer each time (up to 5 minutes).
    delay = Math.min(300000, data.refresh * 1000 * Math.pow(2, Math.min(failStreak, 5)));
  }
  if (limited()) delay = Math.max(delay, backoffUntil - Date.now() + 250);
  quoteTimer = setTimeout(() => pullQuotes(), delay);
}

// At most one request in flight; callers (timer, sync button) share it.
function pullQuotes(force = false) {
  if (quotePromise) return quotePromise;
  quotePromise = fetchQuotes(force).finally(() => { quotePromise = null; });
  return quotePromise;
}

// Prices are fetched for every symbol once, when the TradingView tab (re)loads.
// After that they refresh only on the user's schedule (5s / 15s / 1m / Off).
let initialDone = false;
let dockHidden = false;
async function loadAllQuotes() {
  const all = new Set();
  for (const l of data.lists) for (const it of l.items) if (it.s && it.s.includes(':')) all.add(it.s);
  for (const s in data.meta) if (data.meta[s].f && s.includes(':')) all.add(s);
  const order = [...rendered.filter((s) => all.has(s)), ...[...all].filter((s) => !rendered.includes(s))];   // on-screen first
  for (let i = 0; i < order.length; i += 200) {
    if (limited()) break;
    const chunk = order.slice(i, i + 200);
    try {
      const res = await TV.quotes(chunk, { session: data.session });
      failStreak = 0;
      applyQuotes(res, chunk, Date.now());
    } catch (e) {
      if (e instanceof TV.RateLimited) hitLimit();
      else { failStreak++; quoteStatus = { ...quoteStatus, failed: true }; }
      break;
    }
    updatePriceStatus();
    if (i + 200 < order.length) await pause(SEARCH_GAP);
  }
  initialDone = true;
  updatePriceStatus();
  if (rendered.some((s) => !s.includes(':'))) resolveBareSymbols();
  // A bare ticker matched to its exchange while this ran has no price yet: get it now.
  scheduleQuotes(rendered.some((s) => s.includes(':') && !quoteCache.has(s)) ? 400 : undefined);
}
window.addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data || e.data.wl !== 'dockVisible') return;
  // Opening or closing the dock never fetches or resets the schedule. The refresh
  // timer keeps its own rhythm; refreshes that fall while the dock is closed are skipped.
  dockHidden = !e.data.open;
});

async function fetchQuotes(force) {
  if (!initialDone && !force) return;   // the load-time fetch is still running; it schedules the next one
  if (((document.hidden || dockHidden) && !force) || !rendered.length) { scheduleQuotes(); return; }
  if (limited()) { updatePriceStatus(); scheduleQuotes(); return; }
  const want = rendered.filter((s) => s.includes(':')).slice(0, 120);
  if (rendered.some((s) => !s.includes(':'))) resolveBareSymbols();
  if (!want.length) { scheduleQuotes(); return; }
  // Another open dock fetched these symbols moments ago: use its prices instead.
  const interval = (data.refresh || 15) * 1000;
  if (!force && Date.now() - shared.at < interval * 0.8 && want.every((s) => shared.syms.has(s))) { scheduleQuotes(); return; }
  try {
    const res = await TV.quotes(want, { session: data.session });
    failStreak = 0;
    backoffMs = 0;
    applyQuotes(res, want, Date.now());
    bc?.postMessage({ type: 'quotes', at: lastQuoteAt, want, quotes: res });
  } catch (e) {
    if (e instanceof TV.RateLimited) hitLimit();
    else { failStreak++; quoteStatus = { ...quoteStatus, failed: true }; }   // offline: keep the last prices
  }
  updatePriceStatus();
  scheduleQuotes();
}

function applyQuotes(res, want, at) {
  const got = new Set(res.map((q) => q.sym));
  lastQuoteAt = Math.max(lastQuoteAt, at);
  quoteStatus = { delayMin: res.reduce((m, q) => Math.max(m, q.delayMin || 0), 0), failed: false };
  for (const sym of want) {
    if (got.has(sym) || quoteCache.get(sym)?.missing) continue;
    const miss = { sym, missing: true, logos: [] };
    quoteCache.set(sym, miss);
    patchRow(miss, null);
  }
  for (const q of res) {
    const prev = quoteCache.get(q.sym);
    quoteCache.set(q.sym, q);
    if (q.logos[0] && data.logos[q.sym] !== q.logos[0]) { data.logos[q.sym] = q.logos[0]; scheduleSave(); }
    patchRow(q, prev);
  }
}

if (bc) {
  bc.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'quotes' && Array.isArray(m.quotes)) {
      shared = { at: m.at, syms: new Set(m.want || []) };
      applyQuotes(m.quotes, m.want || [], m.at);
      updatePriceStatus();
    } else if (m.type === 'limit') {
      hitLimit(true, m);
    }
  };
}

// Footer: live or delayed, when prices last updated, and a sync button.
function agoText(ms) {
  const s = Math.round(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}
function updatePriceStatus() {
  if (!el.priceState) return;
  const st = quoteStatus;
  let label, cls, tip;
  if (limited()) {
    label = 'Paused'; cls = 'delayed';
    tip = `TradingView asked us to slow down. Prices resume in ${fmtWait(backoffUntil - Date.now())}.`;
  } else if (st.failed) { label = 'Offline'; cls = 'off'; tip = "Couldn't reach TradingView. Showing the last prices; retrying less often until it's back."; }
  else if (!lastQuoteAt) { label = 'Loading'; cls = ''; tip = 'Fetching prices'; }
  else if (st.delayMin) {
    label = `Delayed ${st.delayMin}m`; cls = 'delayed';
    tip = `TradingView delays prices from some exchanges by ${st.delayMin} minutes unless your TradingView plan includes real-time data for them.` +
      (data.session ? '' : ' Turn on "Use my TradingView login" to get the prices your plan includes.');
  } else { label = 'Live'; cls = 'live'; tip = 'Real-time prices'; }
  el.priceState.textContent = label;
  el.priceState.title = tip;
  el.footDot.className = 'dot ' + cls;
  el.priceAgo.textContent = lastQuoteAt ? '· ' + agoText(Date.now() - lastQuoteAt) : '';
  el.priceAgo.title = lastQuoteAt ? 'Updated ' + new Date(lastQuoteAt).toLocaleTimeString() : '';
  el.syncBtn.disabled = limited();
  el.syncBtn.title = limited() ? `Paused for ${fmtWait(backoffUntil - Date.now())}: TradingView asked us to slow down` : 'Sync prices now';
}
setInterval(() => { if (!document.hidden) updatePriceStatus(); }, 1000);

async function syncNow() {
  if (limited()) return;
  const started = Date.now();
  el.syncBtn.classList.add('spinning');
  if (quotePromise) await quotePromise;                               // a refresh is running: that one is the latest
  else if (Date.now() - lastQuoteAt > 1500) await pullQuotes(true);   // anything newer than 1.5s is already current
  await pause(Math.max(0, 450 - (Date.now() - started)));             // keep the feedback visible for a beat
  el.syncBtn.classList.remove('spinning');
}

// Update one visible row's price cells without rebuilding the list.
function patchRow(q, prev) {
  const row = el.rows.querySelector(`.row[data-sym="${CSS.escape(q.sym)}"]`);
  if (!row) return;
  const price = row.querySelector('.price');
  const chg = row.querySelector('.chg');
  const name = row.querySelector('.name:not(.note)');
  if (q.name) row.title = `${q.sym} · ${q.name}`;
  const av = row.querySelector('.av');
  if (av && q.logos.some((u) => !badLogos.has(u)) && !av.querySelector('img')) av.outerHTML = avatarHtml(q.sym, splitSymbol(q.sym).ticker, q);
  if (q.missing) {
    if (price) price.outerHTML = priceHtml(q);
    if (chg) chg.outerHTML = chgHtml(q);
    if (name) name.textContent = 'No data from TradingView';
    else if (!row.querySelector('.name, .note-input')) row.querySelector('.left')?.insertAdjacentHTML('beforeend', '<span class="name">No data from TradingView</span>');
    return;
  }
  if (price) { price.className = 'price'; price.removeAttribute('title'); price.textContent = fmtPrice(q); }
  if (chg) { chg.className = 'chg ' + dirClass(q); chg.innerHTML = fmtChange(q); }
  fitRow(row);
  // A brief colour tick when the price moves, fading back on its own.
  if (price && prev && prev.price != null && q.price !== prev.price) {
    price.classList.remove('tick-up', 'tick-down');
    void price.offsetWidth;
    price.classList.add(q.price > prev.price ? 'tick-up' : 'tick-down');
    setTimeout(() => price.classList.remove('tick-up', 'tick-down'), 60);
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleQuotes(); });

/* ---------- list dropdown ---------- */
function renderListMenu() {
  const solo = data.lists.length === 1;
  let html = '<div class="lm-label">Watchlists</div>';
  data.lists.forEach((l) => {
    const key = 'list:' + l.id;
    const active = data.active === key;
    html +=
      `<div class="lm-item${active ? ' active' : ''}" role="option" tabindex="0" aria-selected="${active}" data-key="${key}">` +
      `<span class="lm-dot" style="background:${esc(l.color || LIST_COLORS[0])}"></span>` +
      `<span class="lm-name">${esc(l.name)}</span>` +
      `<span class="lm-count">${nf(0).format(symbolCount(l.items))}</span>` +
      `<span class="lm-actions">` +
        `<button class="lm-act" data-act="rename" data-id="${l.id}" title="Rename ${esc(l.name)}">${ico('pencil')}</button>` +
        (solo ? '' : `<button class="lm-act danger" data-act="delete" data-id="${l.id}" title="Delete ${esc(l.name)}">${ico('trash')}</button>`) +
      `</span>` +
      `</div>`;
  });
  html += `<button class="lm-item lm-new" data-act="newList">${ICON.plus}<span class="lm-name">Create new list</span></button>`;
  html += '<hr class="lm-sep"><div class="lm-label">Tags</div><div class="lm-tags">';
  for (const t of TAGS) {
    const n = tagCount(t.id);
    const key = 'tag:' + t.id;
    html +=
      `<button class="tag-btn${data.active === key ? ' active' : ''}" data-key="${key}" title="${t.name} list · ${n} symbol${n === 1 ? '' : 's'}">` +
      `${bookmarkSvg(t.color)}</button>`;
  }
  html += '</div>';
  el.listMenu.innerHTML = html;
}
function openListMenu() {
  closePops();
  renderListMenu();
  el.listMenu.hidden = false;
  el.listName.parentElement.classList.add('open');
}
function closeListMenu() {
  el.listMenu.hidden = true;
  el.listName.parentElement.classList.remove('open');
}
function switchTo(key) {
  if (data.active !== key) {
    data.active = key;
    activeIdx = -1;
    editingSym = null;
    el.searchInput.value = '';
    el.viewport.scrollTop = 0;
    scheduleSave();
    refresh();
  }
  closeListMenu();
  el.viewport.focus({ preventScroll: true });
}

/* ---------- tag picker for a row ---------- */
let flagPopSym = null;
function openFlagPop(sym, anchor) {
  closePops();
  flagPopSym = sym;
  const cur = meta(sym).f || '';
  el.flagPop.innerHTML =
    TAGS.map((t) => `<button data-tag="${t.id}" class="${cur === t.id ? 'active' : ''}" title="${t.name} list">${bookmarkSvg(t.color)}</button>`).join('') +
    `<button data-tag="" title="Remove tag">${ICON.ban}</button>`;
  el.flagPop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = el.flagPop.offsetWidth, h = el.flagPop.offsetHeight;
  const left = Math.min(Math.max(4, r.left - 4), window.innerWidth - w - 4);
  let top = r.bottom + 4;
  if (top + h > window.innerHeight - 4) top = r.top - h - 4;
  el.flagPop.style.left = left + 'px';
  el.flagPop.style.top = top + 'px';
}
el.flagPop.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !flagPopSym) return;
  setTag(flagPopSym, b.dataset.tag);
  el.flagPop.hidden = true;
  flagPopSym = null;
});

function closePops() {
  el.menu.hidden = true;
  closeListMenu();
  el.flagPop.hidden = true;
}

/* ---------- symbol search (TradingView style) ---------- */
let ssType = '';
let ssResults = [];
let ssHl = 0;
let ssSeq = 0;
let ssTimer = null;
let ssState = 'hint';         // hint | loading | ok | empty | error | bulk
let ssBulk = null;

function openSearch(q = '', { instant = false } = {}) {
  el.ss.classList.toggle('instant', instant);   // keyboard-opened: no animation
  closePops();
  el.ss.hidden = false;
  el.ssTarget.textContent = 'to ' + src.name;
  el.ssInput.value = q;
  renderTabs();
  updateTabArrows();
  runSearch();
  el.ssInput.focus();
  el.ssInput.setSelectionRange(q.length, q.length);
}
function closeSearch() {
  el.ss.hidden = true;
  el.viewport.focus({ preventScroll: true });
}
function renderTabs() {
  el.ssTabs.innerHTML = SEARCH_TYPES.map(([id, label]) => `<button class="chip${id === ssType ? ' on' : ''}" data-type="${id}">${label}</button>`).join('');
  updateTabArrows();
  requestAnimationFrame(updateTabArrows);
}

async function runSearch() {
  const q = el.ssInput.value.trim();
  el.ssClear.hidden = !q;
  const seq = ++ssSeq;
  const syms = parseEntries(q).filter((e) => e.s);
  ssBulk = syms.length > 1 ? syms : null;
  if (!q) { ssResults = []; ssState = 'hint'; renderResults(); return; }
  if (ssBulk) { ssResults = []; ssState = 'bulk'; renderResults(); return; }
  ssState = 'loading';
  el.ssBar.classList.add('loading');
  try {
    if (limited()) throw new TV.RateLimited('paused');
    const res = await TV.search(q, ssType, '', { session: data.session });
    if (seq !== ssSeq) return;
    ssResults = res;
    ssState = res.length ? 'ok' : 'empty';
  } catch (e) {
    if (seq !== ssSeq) return;
    ssResults = [];
    ssState = e instanceof TV.RateLimited ? 'limited' : 'error';
    if (e instanceof TV.RateLimited && e.message !== 'paused') hitLimit();
  }
  ssHl = 0;
  renderResults();
  el.ssResults.scrollTop = 0;
}

function inCurrent(sym) {
  return src.kind === 'tag' ? meta(sym).f === src.tag : src.items.some((it) => it.s === sym);
}

function logoHtml(r) {
  const letter = esc((r.ticker || '?')[0]);
  const hue = `--h:${hueOf(r.ticker || '')}`;
  if (!r.logos.length) return `<span class="ss-logo" style="${hue}">${letter}</span>`;
  const imgs = r.logos.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('');
  return `<span class="ss-logo${r.logos.length > 1 ? ' pair' : ''}" style="${hue}">${letter}${imgs}</span>`;
}

// Short exchange code for the badge: the symbol's prefix (NSE, BSE, NASDAQ, BINANCE...).
const exchCode = (r) => (r.id.includes(':') ? r.id.slice(0, r.id.indexOf(':')) : String(r.exch || '')).toUpperCase();

function renderResults() {
  if (ssState !== 'loading') el.ssBar.classList.remove('loading');
  const q = esc(el.ssInput.value.trim().toUpperCase());
  let html = '';
  if (ssState === 'hint') {
    html = '<div class="ss-empty">Search stocks, ETFs, crypto, forex, futures and indices.<small>Paste AAPL, MSFT, TSLA to add all three at once.</small></div>';
  } else if (ssState === 'bulk') {
    html = `<button class="ss-bulk" data-act="bulk"><strong>Add ${ssBulk.length} symbols</strong><span>${esc(ssBulk.map((e) => e.s).join(', '))}</span></button>`;
  } else if (ssState === 'error') {
    html = `<div class="ss-empty">Couldn't reach TradingView search.<small>Check your connection, or add the symbol exactly as typed.</small><br><button class="link-btn" data-act="raw">Add “${q}” as typed</button></div>`;
  } else if (ssState === 'limited') {
    html = `<div class="ss-empty">TradingView asked us to slow down.<small>Search is paused for ${fmtWait(backoffUntil - Date.now())}. Try again then.</small></div>`;
  } else if (ssState === 'empty') {
    html = `<div class="ss-empty">No symbols match “${q}”.<br><button class="link-btn" data-act="raw">Add “${q}” as typed</button></div>`;
  } else {
    html = ssResults.map((r, i) => {
      const added = inCurrent(r.id);
      const flag = r.flag ? `<img src="${esc(r.flag)}" alt="">` : '';
      return (
        `<div class="ss-row${i === ssHl ? ' hl' : ''}${added ? ' added' : ''}" data-i="${i}" title="${esc(r.id)}">` +
        logoHtml(r) +
        `<span class="ss-text"><span class="ss-line"><span class="ss-sym">${hlHtml(r.symHtml)}</span>` +
        `<span class="ex-badge" title="${esc(r.exch)}">${esc(exchCode(r))}</span></span>` +
        `<span class="ss-desc">${hlHtml(r.descHtml)}</span></span>` +
        `<span class="ss-meta">${flag ? `<span class="ss-ex">${flag}</span>` : ''}<span class="ss-type">${esc(TYPE_LABEL[r.type] || r.type)}</span></span>` +
        `<span class="ss-act">${added ? ICON.check : ICON.plus}</span></div>`
      );
    }).join('');
  }
  el.ssResults.innerHTML = html;
}

function addResult(i) {
  const r = ssResults[i];
  if (!r) return;
  if (inCurrent(r.id)) { toast(`${r.ticker} is already in ${src.name}`, { type: 'info' }); return; }
  data.logos[r.id] = r.logos[0] || '';
  const res = addEntries([{ s: r.id }], { quiet: true });
  if (res.overflow) toast(`${r.ticker} wasn't added`, { type: 'error', description: `${src.name} is full. A list holds up to ${nf(0).format(MAX_ITEMS)} symbols.` });
  else toast(`Added ${r.ticker}`, { type: 'success', description: `to ${src.name}` });
  renderResults();
  el.ssInput.focus();
  el.ssInput.select();
}

function addRaw() {
  const entries = parseEntries(el.ssInput.value);
  if (!entries.length) return toast('Enter a symbol like AAPL or NASDAQ:AAPL', { type: 'info' });
  addAndValidate(entries);
  el.ssInput.value = '';
  runSearch();
  el.ssInput.focus();
}

function moveHl(delta) {
  if (!ssResults.length) return;
  ssHl = Math.max(0, Math.min(ssResults.length - 1, ssHl + delta));
  el.ssResults.querySelectorAll('.ss-row').forEach((r) => r.classList.toggle('hl', Number(r.dataset.i) === ssHl));
  el.ssResults.querySelector(`.ss-row[data-i="${ssHl}"]`)?.scrollIntoView({ block: 'nearest' });
}

// Placeholder: the longest wording that fits the box, so it's never cut off.
const SS_PLACEHOLDERS = ['Symbol, ISIN, or CUSIP', 'Symbol or ISIN', 'Symbol', 'Search'];
const measureCtx = document.createElement('canvas').getContext('2d');
function fitSearchPlaceholder() {
  const inp = el.ssInput;
  const cs = getComputedStyle(inp);
  const room = inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
  if (room <= 0) return;
  // Placeholder text is regular weight even though typed text is bold.
  measureCtx.font = `400 ${cs.fontSize} ${cs.fontFamily}`;
  inp.placeholder = SS_PLACEHOLDERS.find((t) => measureCtx.measureText(t).width <= room) || '';
}
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitSearchPlaceholder).observe(el.ssInput);

el.ssInput.addEventListener('input', () => {
  clearTimeout(ssTimer);
  ssTimer = setTimeout(() => { ssTimer = null; runSearch(); }, 160);
});
el.ssInput.addEventListener('keydown', async (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveHl(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveHl(-1); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (!el.ssInput.value.trim()) return;
    if (ssTimer) { clearTimeout(ssTimer); ssTimer = null; await runSearch(); }
    if (ssState === 'ok') addResult(ssHl);
    else if (ssState === 'bulk' || ssState === 'empty' || ssState === 'error') addRaw();
  } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSearch(); }
});
// Multi-line pastes (TradingView exports) are added directly, keeping sections.
el.ssInput.addEventListener('paste', (e) => {
  const text = e.clipboardData.getData('text');
  if (!/[\r\n]/.test(text) && !text.includes('###')) return;
  const entries = parseEntries(text);
  if (!entries.length) return;
  e.preventDefault();
  addAndValidate(entries);
});
el.ssClear.addEventListener('click', () => { el.ssInput.value = ''; runSearch(); el.ssInput.focus(); });
el.ssClose.addEventListener('click', closeSearch);
/* Category slider: arrows and edge fades appear only when there's more to see
   in that direction; the wheel scrolls sideways; the row can be dragged. */
function updateTabArrows() {
  const t = el.ssTabs;
  const max = t.scrollWidth - t.clientWidth;
  el.ssTabsWrap.classList.toggle('can-prev', t.scrollLeft > 2);
  el.ssTabsWrap.classList.toggle('can-next', t.scrollLeft < max - 2);
}
function slideTabs(dir) {
  el.ssTabs.scrollBy({ left: dir * Math.max(80, el.ssTabs.clientWidth * 0.7), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
el.ssTabsPrev.addEventListener('click', () => slideTabs(-1));
el.ssTabsNext.addEventListener('click', () => slideTabs(1));
el.ssTabs.addEventListener('scroll', updateTabArrows, { passive: true });
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateTabArrows).observe(el.ssTabs);
el.ssTabs.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // trackpads already scroll sideways
  e.preventDefault();
  el.ssTabs.scrollLeft += e.deltaY;
  updateTabArrows();
}, { passive: false });
// Drag to scroll; a real drag (more than 4px) doesn't count as a chip click.
let tabDrag = null;
el.ssTabs.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.pointerType === 'touch') return;
  tabDrag = { x: e.clientX, left: el.ssTabs.scrollLeft, moved: false, id: e.pointerId };
});
el.ssTabs.addEventListener('pointermove', (e) => {
  if (!tabDrag) return;
  const dx = e.clientX - tabDrag.x;
  if (!tabDrag.moved && Math.abs(dx) > 4) { tabDrag.moved = true; el.ssTabs.setPointerCapture(tabDrag.id); el.ssTabs.classList.add('dragging'); }
  if (tabDrag.moved) { el.ssTabs.scrollLeft = tabDrag.left - dx; updateTabArrows(); }
});
const endTabDrag = () => {
  if (!tabDrag) return;
  if (tabDrag.moved) {
    el.ssTabs.classList.remove('dragging');
    // Swallow the click that follows a drag.
    el.ssTabs.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
  }
  tabDrag = null;
};
el.ssTabs.addEventListener('pointerup', endTabDrag);
el.ssTabs.addEventListener('pointercancel', endTabDrag);

el.ssTabs.addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  ssType = b.dataset.type;
  renderTabs();
  el.ssTabs.querySelector('.chip.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  runSearch();
  el.ssInput.focus();
});
el.ssResults.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'bulk' || act === 'raw') { addRaw(); return; }
  const row = e.target.closest('.ss-row');
  if (row) addResult(Number(row.dataset.i));
});
el.ssResults.addEventListener('mousemove', (e) => {
  const row = e.target.closest('.ss-row');
  if (row && Number(row.dataset.i) !== ssHl) { ssHl = Number(row.dataset.i); moveHl(0); }
});
// Broken logos fall back to the letter avatar underneath.
el.ssResults.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);
el.rows.addEventListener('error', (e) => {
  if (e.target.tagName !== 'IMG') return;
  badLogos.add(e.target.getAttribute('src'));
  e.target.parentElement?.classList.remove('pair');
  e.target.remove();
}, true);

/* ---------- toasts ----------
 Modelled on Sonner (Emil Kowalski): stacked cards at the bottom, newest in
 front, older ones tucked behind and scaled down; hover fans the stack out and
 pauses the timers; swipe down or click × to dismiss. Transitions (not
 keyframes) so rapid toasts retarget smoothly. */
const TOAST_ICONS = {
  success: '<svg class="tst-ic" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.3a.75.75 0 0 0-1.22-.88l-3.24 4.5-1.6-1.6a.75.75 0 1 0-1.06 1.06l2.22 2.22a.75.75 0 0 0 1.14-.09l3.76-5.2Z" clip-rule="evenodd"/></svg>',
  error: '<svg class="tst-ic" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd"/></svg>',
  info: '<svg class="tst-ic" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.25v3.25c0 .41.34.75.75.75h.75a.75.75 0 0 0 0-1.5h-.25V9.75A.75.75 0 0 0 10.75 9H9Z" clip-rule="evenodd"/></svg>',
};
const TOAST_GAP = 8;
const TOAST_VISIBLE = 3;
const toasts = [];             // newest first
let toastsExpanded = false;

function toast(title, { type = 'default', description = '', duration, items = null, action = null } = {}) {
  const t = {
    el: document.createElement('li'),
    remaining: duration ?? (type === 'error' ? 6000 : 2400),
    started: 0, timer: 0, height: 0,
  };
  t.el.className = `tst tst-${type}`;
  t.el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.el.innerHTML =
    (TOAST_ICONS[type] || '') +
    '<div class="tst-body"><div class="tst-title"></div><div class="tst-desc"></div></div>' +
    `<button class="tst-x" aria-label="Dismiss">${ICON.del}</button>`;
  t.el.querySelector('.tst-title').textContent = title;
  const d = t.el.querySelector('.tst-desc');
  if (description) d.textContent = description; else d.remove();
  const body = t.el.querySelector('.tst-body');
  if (items && items.length) {
    // Every item, as chips; a long list scrolls inside the toast.
    const box = document.createElement('div');
    box.className = 'tst-items';
    for (const it of items) {
      const chip = document.createElement('span');
      chip.className = 'tst-chip';
      chip.textContent = it;
      box.appendChild(chip);
    }
    body.appendChild(box);
  }
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'tst-btn';
    btn.innerHTML = `${action.icon ? ico(action.icon) : ''}<span>${esc(action.label)}</span>`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); action.onClick(btn, t); });
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());   // not a swipe
    body.appendChild(btn);
  }
  t.el.querySelector('.tst-x').addEventListener('click', () => dismissToast(t));
  swipeToDismiss(t);

  el.toast.appendChild(t.el);
  t.height = t.el.offsetHeight;
  toasts.unshift(t);
  while (toasts.length > TOAST_VISIBLE + 2) dismissToast(toasts[toasts.length - 1], true);
  requestAnimationFrame(() => { t.el.dataset.mounted = 'true'; layoutToasts(); });
  layoutToasts();
  if (!toastsExpanded && !document.hidden) startToastTimer(t);
  return t;
}

function updateToast(t, { title, description } = {}) {
  if (title != null) t.el.querySelector('.tst-title').textContent = title;
  if (description != null) {
    let d = t.el.querySelector('.tst-desc');
    if (!d) { d = document.createElement('div'); d.className = 'tst-desc'; t.el.querySelector('.tst-body').appendChild(d); }
    d.textContent = description;
  }
}

function startToastTimer(t) {
  clearTimeout(t.timer);
  if (!Number.isFinite(t.remaining)) return;   // stays until dismissed in code
  t.started = Date.now();
  t.timer = setTimeout(() => dismissToast(t), t.remaining);
}
function pauseToastTimer(t) {
  if (!t.started || !Number.isFinite(t.remaining)) return;
  clearTimeout(t.timer);
  t.remaining = Math.max(800, t.remaining - (Date.now() - t.started));
  t.started = 0;
}

function dismissToast(t, instant = false) {
  const i = toasts.indexOf(t);
  if (i < 0) return;
  toasts.splice(i, 1);
  clearTimeout(t.timer);
  if (instant) t.el.remove();
  else {
    t.el.dataset.removed = 'true';
    setTimeout(() => t.el.remove(), 200);
  }
  layoutToasts();
}

// Collapsed: a tidy stack. Expanded (hover): every toast fully visible.
function layoutToasts() {
  let offset = 0;
  toasts.forEach((t, i) => {
    const s = t.el.style;
    s.zIndex = String(100 - i);
    if (toastsExpanded) {
      s.transform = `translateY(${-offset}px)`;
      s.opacity = '1';
      offset += t.height + TOAST_GAP;
    } else {
      // Older toasts sit behind, same height as the front one so the stack looks even.
      s.transform = i === 0 ? 'translateY(0)' : `translateY(${-i * 10}px) scale(${1 - i * 0.05})`;
      s.opacity = i < TOAST_VISIBLE ? '1' : '0';
      t.el.classList.toggle('behind', i > 0);
    }
    if (toastsExpanded) t.el.classList.remove('behind');
    // Collapsed, the cards behind take the front card's height so the stack edges line up.
    s.height = !toastsExpanded && i > 0 && toasts[0] ? toasts[0].height + 'px' : '';
    s.overflow = s.height ? 'hidden' : '';
  });
}
el.toast.addEventListener('mouseenter', () => { toastsExpanded = true; toasts.forEach(pauseToastTimer); layoutToasts(); });
el.toast.addEventListener('mouseleave', () => { toastsExpanded = false; toasts.forEach(startToastTimer); layoutToasts(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) toasts.forEach(pauseToastTimer);
  else if (!toastsExpanded) toasts.forEach(startToastTimer);
});

// Drag down to dismiss; a quick flick is enough.
function swipeToDismiss(t) {
  let startY = 0, startAt = 0, dy = 0, dragging = false;
  t.el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tst-x') || dragging) return;
    dragging = true; startY = e.clientY; startAt = Date.now(); dy = 0;
    t.el.setPointerCapture(e.pointerId);
    t.el.style.transition = 'none';
  });
  t.el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const raw = e.clientY - startY;
    dy = raw > 0 ? raw : raw * 0.2;          // friction when dragged the wrong way
    t.el.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    t.el.style.transition = '';
    const velocity = Math.abs(dy) / Math.max(1, Date.now() - startAt);
    if (dy > 40 || (dy > 8 && velocity > 0.11)) dismissToast(t);
    else layoutToasts();
  };
  t.el.addEventListener('pointerup', end);
  t.el.addEventListener('pointercancel', end);
}

/* ---------- footer / TradingView status ---------- */
let tvStatus = { demo: true, connected: false, chart: false };
async function updateFooter() {
  tvStatus = await TV.status();
  updateFooterText();
}
function updateFooterText() {
  const st = tvStatus;
  const noTab = !st.demo && !st.chart && !st.connected;
  el.footBtn.hidden = !noTab;
  el.priceWrap.hidden = noTab;
  el.footText.hidden = !noTab && !st.demo;
  el.footText.textContent = st.demo ? 'Preview' : 'No TradingView tab';
  if (noTab) el.footDot.className = 'dot';
  else updatePriceStatus();
}
let syncTimer;
async function syncFromChart() {
  const sym = await TV.currentSymbol();
  // Ignore stale reports while the user is stepping through the list
  if (sym && Date.now() - lastNavAt > 1500 && (!currentSym || tickerOf(sym) !== tickerOf(currentSym))) {
    setCurrent(sym);
    activeIdx = view.indexOf(currentItemIdx);
    renderRows();
  }
  updateFooter();
}
const scheduleSync = () => { clearTimeout(syncTimer); syncTimer = setTimeout(syncFromChart, 400); };

/* ---------- import / export ---------- */
function exportList() {
  const text = src.items.map((it) => (it.sec ? '###' + it.sec : it.s)).join(',');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${src.name.replace(/[^\w\- ]+/g, '').trim() || 'watchlist'}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${symbolCount(src.items)} symbols`);
}

async function copySymbols() {
  try {
    await navigator.clipboard.writeText(src.items.filter((i) => i.s).map((i) => i.s).join(', '));
    toast('Copied to clipboard');
  } catch { toast('Copy failed'); }
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const entries = parseEntries(reader.result);
    if (!entries.some((e) => e.s)) return toast('No symbols found in that file', { type: 'error' });
    addAndValidate(entries);
  };
  reader.readAsText(file);
}

/* ---------- list management ---------- */
async function newList() {
  closePops();
  const name = await askText('New list', `List ${data.lists.length + 1}`, 'Create');
  if (!name) return;
  const l = { id: uid(), name, color: LIST_COLORS[data.lists.length % LIST_COLORS.length], items: [] };
  data.lists.push(l);
  switchTo('list:' + l.id);
}

async function renameList(id) {
  const l = id ? data.lists.find((x) => x.id === id) : src.list;
  if (!l) return;
  const name = await askText('Rename list', l.name);
  if (!name || name === l.name) return;
  l.name = name;
  scheduleSave();
  refresh();
}

async function deleteList(id) {
  const l = id ? data.lists.find((x) => x.id === id) : src.list;
  if (!l) return;
  if (data.lists.length === 1) return toast('Keep at least one list');
  const n = symbolCount(l.items);
  const ok = await askConfirm(`Delete "${l.name}"?`, n ? `This removes its ${n} symbol${n === 1 ? '' : 's'}. Their tags stay in your tag lists.` : 'This list is empty.');
  if (!ok) return;
  const wasActive = data.active === 'list:' + l.id;
  data.lists = data.lists.filter((x) => x.id !== l.id);
  scheduleSave();
  if (wasActive) switchTo('list:' + data.lists[0].id);
  else refresh();
  toast(`Deleted ${l.name}`);
}

function cycleListColor() {
  if (src.kind !== 'list') return;
  const l = src.list;
  const i = LIST_COLORS.indexOf(l.color || LIST_COLORS[0]);
  l.color = LIST_COLORS[(i + 1) % LIST_COLORS.length];
  scheduleSave();
  renderListBar();
}

async function addSection() {
  if (src.kind !== 'list') return toast('Sections are only available in watchlists');
  const name = await askText('Add section', '', 'Add');
  if (!name) return;
  src.list.items.push({ sec: name, c: false, t: Date.now() });
  scheduleSave();
  refresh();
  el.viewport.scrollTop = el.viewport.scrollHeight;
}

async function clearList() {
  const n = symbolCount(src.items);
  if (!n) return;
  const ok = await askConfirm(
    `Remove all ${n} symbols?`,
    src.kind === 'tag' ? `This clears the ${src.name}. The symbols stay in your watchlists.` : `This empties "${src.name}". Your tags stay.`,
    'Remove all',
  );
  if (!ok) return;
  if (src.kind === 'tag') src.items.forEach((it) => setMeta(it.s, { f: '' }));
  else src.list.items = [];
  activeIdx = -1;
  scheduleSave();
  refresh();
}

// Sorts symbols within each section; sections keep their order.
function sortList(mode) {
  const cmp = mode === 'az' ? (a, b) => a.s.localeCompare(b.s) : mode === 'new' ? (a, b) => b.t - a.t : (a, b) => a.t - b.t;
  if (src.kind === 'tag') {
    const base = Date.now();
    [...src.items].sort(cmp).forEach((it, i) => { data.meta[it.s].ft = base + i; });
  } else {
    const out = [];
    let group = [];
    const flush = () => { group.sort(cmp); out.push(...group); group = []; };
    for (const it of src.list.items) { if (it.sec) { flush(); out.push(it); } else group.push(it); }
    flush();
    src.list.items = out;
  }
  scheduleSave();
  refresh();
}

/* ---------- events ---------- */
el.closeBtn.addEventListener('click', () => TV.closePanel());
// Minimize: the dock collapses to a pill; ↑/↓ on TradingView keep switching this watchlist.
document.getElementById('miniBtn').addEventListener('click', () => window.parent.postMessage({ wl: 'minimize' }, '*'));
el.addBtn.addEventListener('click', () => openSearch());
el.listColor.addEventListener('click', cycleListColor);
el.listName.addEventListener('click', (e) => {
  e.stopPropagation();
  if (el.listMenu.hidden) openListMenu(); else closeListMenu();
});
el.listMenu.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    e.stopPropagation();
    if (act.dataset.act === 'newList') { newList(); return; }
    if (act.dataset.act === 'rename') { closeListMenu(); renameList(act.dataset.id); return; }
    if (act.dataset.act === 'delete') { closeListMenu(); deleteList(act.dataset.id); return; }
  }
  const item = e.target.closest('[data-key]');
  if (item) switchTo(item.dataset.key);
});
el.listMenu.addEventListener('keydown', (e) => {
  const item = e.target.closest('.lm-item[data-key]');
  if (item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); switchTo(item.dataset.key); }
});

// Filter: narrows the current list by symbol, name or note. Hidden until asked for.
function setFilter(open) {
  filterOpen = open;
  if (!open && el.searchInput.value) el.searchInput.value = '';
  activeIdx = -1;
  buildView();
  if (open) el.searchInput.focus();
  else el.viewport.focus({ preventScroll: true });
}
el.filterBtn.addEventListener('click', () => setFilter(!filterOpen));

el.searchInput.addEventListener('input', () => {
  activeIdx = -1;
  el.viewport.scrollTop = 0;
  buildView();
});
el.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); el.viewport.focus(); moveSel(1); }
  if (e.key === 'Escape') { e.stopPropagation(); setFilter(false); }
});

el.viewport.addEventListener('scroll', renderRows, { passive: true });
window.addEventListener('resize', renderRows);

// Optional: mouse wheel steps through symbols and switches the chart.
let wheelAcc = 0, wheelAt = 0;
el.viewport.addEventListener('wheel', (e) => {
  if (!data.wheel || e.ctrlKey) return;
  e.preventDefault();
  wheelAcc += e.deltaY;
  const now = Date.now();
  if (Math.abs(wheelAcc) >= 40 && now - wheelAt > 70) {
    moveSel(Math.sign(wheelAcc));
    wheelAcc = 0;
    wheelAt = now;
  }
}, { passive: false });

el.empty.addEventListener('click', (e) => {
  if (e.target.closest('[data-act="searchTV"]')) openSearch(el.searchInput.value.trim());
  if (e.target.closest('[data-act="openSearch"]')) openSearch();
});

el.rows.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);

// Row interactions
function animateOut(row, done) {
  if (!row || matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
  row.classList.add('removing');
  setTimeout(done, 140);
}

el.rows.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (!row) return;
  const idx = Number(row.dataset.idx);
  const it = src.items[idx];
  const actEl = e.target.closest('[data-act]');
  const act = actEl?.dataset.act;
  if (act === 'flag') { e.stopPropagation(); openFlagPop(it.s, actEl); return; }
  if (act === 'del') { e.stopPropagation(); animateOut(row, () => removeAt(idx)); return; }
  if (act === 'note' || editingSym) return;
  activeIdx = Number(row.dataset.vi);
  el.viewport.focus({ preventScroll: true });
  if (it.sec) { toggleSection(idx); return; }
  showOnChart(it.s);
});
el.rows.addEventListener('dblclick', (e) => {
  const row = e.target.closest('.row');
  if (!row || e.target.closest('[data-act]')) return;
  const idx = Number(row.dataset.idx);
  const it = src.items[idx];
  if (it.sec) { renameSection(idx); return; }
  editingSym = it.s;
  renderRows();
});
el.rows.addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('note-input')) return;
  e.stopPropagation();
  if (e.key === 'Enter') commitNote(e.target.value);
  if (e.key === 'Escape') { editingSym = null; renderRows(); el.viewport.focus(); }
});
el.rows.addEventListener('focusout', (e) => {
  if (e.target.classList.contains('note-input')) commitNote(e.target.value);
});
function commitNote(value) {
  if (!editingSym) return;
  setMeta(editingSym, { n: value.trim() });
  editingSym = null;
  buildView();
  el.viewport.focus({ preventScroll: true });
}

// Keyboard: arrows / space step through the list and switch the chart.
el.viewport.addEventListener('keydown', (e) => {
  if (editingSym || !view.length) return;
  const k = e.key;
  const page = Math.max(1, Math.floor(el.viewport.clientHeight / SYM_H) - 1);
  const base = activeIdx < 0 ? Math.max(0, view.indexOf(currentItemIdx)) : activeIdx;
  if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); moveSel(k === 'ArrowDown' ? 1 : -1); }
  else if (k === ' ') { e.preventDefault(); moveSel(e.shiftKey ? -1 : 1); }
  else if (k === 'PageDown') { e.preventDefault(); selectAt(base + page, 1); }
  else if (k === 'PageUp') { e.preventDefault(); selectAt(base - page, -1); }
  else if (k === 'Home') { e.preventDefault(); selectAt(0, 1); }
  else if (k === 'End') { e.preventDefault(); selectAt(view.length - 1, -1); }
  else if (k === 'Enter' && activeIdx >= 0) {
    const idx = view[activeIdx];
    if (src.items[idx].sec) toggleSection(idx); else showOnChart(src.items[idx].s);
  } else if ((k === 'Delete' || k === 'Backspace') && activeIdx >= 0) { e.preventDefault(); removeAt(view[activeIdx]); }
});

// Theme: system -> light -> dark
// Price refresh interval
el.refreshSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-refresh]');
  if (!b) return;
  data.refresh = Number(b.dataset.refresh);
  renderRefreshSeg();
  scheduleSave();
  scheduleQuotes();
});
function renderRefreshSeg() {
  el.refreshSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.refresh) === data.refresh));
  el.sessionToggle.classList.toggle('on', data.session);
}
el.syncBtn.addEventListener('click', syncNow);

// Theme: Auto (match TradingView) / Light / Dark
el.themeSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-theme]');
  if (b) setTheme(b.dataset.theme);
});

// Settings menu
el.menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = el.menu.hidden;
  closePops();
  el.menu.hidden = !open;
});
el.menu.addEventListener('click', (e) => {
  const act = e.target.closest('button')?.dataset.act;
  if (!act) return;
  if (act === 'session') {
    data.session = !data.session;
    el.sessionToggle.classList.toggle('on', data.session);
    scheduleSave();
    toast(data.session ? 'Using your TradingView login for prices' : 'Using public prices', { type: 'info' });
    return;
  }
  if (act === 'wheel') {
    data.wheel = !data.wheel;
    el.wheelToggle.classList.toggle('on', data.wheel);
    scheduleSave();
    toast(data.wheel ? 'Mouse wheel now switches the chart' : 'Mouse wheel scrolls the list');
    return;
  }
  el.menu.hidden = true;
  ({
    newList, renameList, deleteList, addSection, clear: clearList,
    import: () => el.fileInput.click(),
    export: exportList,
    copy: copySymbols,
    sortAZ: () => sortList('az'),
    sortNew: () => sortList('new'),
    sortOld: () => sortList('old'),
  })[act]?.();
});

// Click outside closes popovers
document.addEventListener('mousedown', (e) => {
  if (!el.menu.hidden && !e.target.closest('.menu-wrap')) el.menu.hidden = true;
  if (!el.listMenu.hidden && !e.target.closest('#listMenu, #listName')) closeListMenu();
  if (!el.flagPop.hidden && !e.target.closest('#flagPop, .flag')) el.flagPop.hidden = true;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!el.dlg.hidden) { closeDialog(dlgCancelValue()); return; }
    if (!el.flagPop.hidden || !el.menu.hidden || !el.listMenu.hidden) { closePops(); return; }
    if (!el.ss.hidden) closeSearch();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setFilter(true); return; }
  // Typing a letter anywhere opens symbol search, like on TradingView
  const inField = e.target instanceof Element && e.target.matches('input, textarea, select');
  if (!inField && el.ss.hidden && el.dlg.hidden && e.key.length === 1 && /[a-z0-9]/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    openSearch(e.key.toUpperCase(), { instant: true });
  }
});

el.fileInput.addEventListener('change', () => {
  if (el.fileInput.files[0]) importFile(el.fileInput.files[0]);
  el.fileInput.value = '';
});

el.footBtn.addEventListener('click', async () => { await TV.open(); scheduleSync(); });

// Paste a block of symbols anywhere (outside inputs)
document.addEventListener('paste', (e) => {
  if (e.target instanceof Element && e.target.matches('input, textarea')) return;
  const entries = parseEntries(e.clipboardData.getData('text'));
  if (entries.some((x) => x.s)) { e.preventDefault(); addAndValidate(entries); }
});

// Drag & drop a .txt file onto the panel
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files?.[0];
  if (f) importFile(f);
});

// Stay in sync with the panel in other windows
if (hasChromeStorage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.wl || !changes.wl.newValue) return;
    if (JSON.stringify(changes.wl.newValue) === lastSaved) return;
    data = migrate(changes.wl.newValue);
    editingSym = null;
    refresh();
  });
}

// Follow the chart: highlight whatever symbol TradingView shows
TV.onTabsChanged(scheduleSync);
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(); });

/* ---------- init ---------- */
(async function init() {
  data = migrate(await store.load());
  setTheme(data.theme);
  refresh();
  el.viewport.focus({ preventScroll: true });
  syncFromChart();
  loadAllQuotes();
  setTimeout(resolveBareSymbols, 300);
  if (TV.embedded) window.parent.postMessage({ wl: 'ready' }, '*');
})();
