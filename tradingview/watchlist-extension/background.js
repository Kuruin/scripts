// Toolbar button and Alt+W: toggle the watchlist docked inside TradingView.
const TV_HOME = 'https://www.tradingview.com/chart/';
const isTV = (url) => /^https?:\/\/([a-z0-9-]+\.)*tradingview\.com\//i.test(url || '');

// Earlier versions used Chrome's side panel; make sure it no longer grabs the click.
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

chrome.action.onClicked.addListener((tab) => toggle(tab));

async function toggle(tab) {
  if (tab && isTV(tab.url)) {
    await send(tab.id, 'toggle');
    return;
  }
  // Not on TradingView: bring a TradingView tab forward (or open one) with the dock open.
  await chrome.storage.local.set({ dock: { ...(await getDock()), open: true, mode: 'open' } });
  const windowId = tab ? tab.windowId : undefined;
  const tvTabs = await chrome.tabs.query({ windowId, url: '*://*.tradingview.com/*' });
  const target = tvTabs.find((t) => /\/chart\//.test(t.url || '')) || tvTabs[0];
  if (target) {
    await chrome.tabs.update(target.id, { active: true });
    await send(target.id, 'open');
  } else {
    await chrome.tabs.create({ windowId, url: TV_HOME });
  }
}

async function getDock() {
  const r = await chrome.storage.local.get('dock');
  return r.dock || { open: false, mode: 'mini', width: 240 };
}

/* ---------- switching symbols from the keyboard / minimized pill ----------
   ↑ / ↓ on the TradingView page (while the dock is open or minimized), the
   pill's arrows and the wheel over the pill step through *this* watchlist:
   the list (or tag list) last selected in the dock. */
const TAG_NAMES = { red: 'Red list', blue: 'Blue list', green: 'Green list', orange: 'Orange list', purple: 'Purple list' };

function activeSymbols(wl) {
  const key = wl.active || '';
  if (key.startsWith('tag:')) {
    const tag = key.slice(4);
    const syms = Object.entries(wl.meta || {})
      .filter(([, m]) => m && m.f === tag)
      .sort((a, b) => (a[1].ft || 0) - (b[1].ft || 0))
      .map(([s]) => s);
    return { name: TAG_NAMES[tag] || 'Tag list', syms };
  }
  const lists = wl.lists || [];
  const list = lists.find((l) => 'list:' + l.id === key) || lists[0];
  if (!list) return { name: '', syms: [] };
  return { name: list.name, syms: (list.items || []).filter((i) => i.s).map((i) => i.s) };
}

// Compare by ticker: TradingView may report NSE_DLY:TCS or BATS:AAPL, and writes "-" as "_".
const tickerOf = (s) => String(s || '').split(':').pop().replace(/-/g, '_').toUpperCase();

async function inPage(tabId, func, args = []) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args });
  return r ? r.result : undefined;
}
const chartSymbol = (tabId) => inPage(tabId, () => { try { return window.TradingViewApi.activeChart().symbol(); } catch (e) { return null; } });

async function position(tabId) {
  const { wl } = await chrome.storage.local.get('wl');
  if (!wl) return { syms: [], name: '', i: -1, key: '' };
  const { name, syms } = activeSymbols(wl);
  const key = 'step:' + tabId;
  const last = (await chrome.storage.session.get(key))[key];
  let i = -1;
  // Rapid presses: the chart takes a moment to report its new symbol, so continue
  // from where the last step landed if that was recent.
  if (last && Date.now() - last.at < 4000 && last.list === wl.active && syms[last.i] === last.sym) i = last.i;
  if (i < 0) {
    const cur = await chartSymbol(tabId);
    if (cur) {
      i = syms.indexOf(cur);
      if (i < 0) i = syms.findIndex((s) => tickerOf(s) === tickerOf(cur));
    }
  }
  return { syms, name, i, key, active: wl.active };
}

async function step(tabId, dir) {
  const p = await position(tabId);
  if (!p.syms.length) { report(tabId, { empty: true, list: p.name }); return; }
  const next = p.i < 0 ? (dir > 0 ? 0 : p.syms.length - 1) : (p.i + dir + p.syms.length) % p.syms.length;   // wraps
  const sym = p.syms[next];
  const ok = await inPage(tabId, (s) => {
    try { window.TradingViewApi.activeChart().setSymbol(s); return true; } catch (e) { return false; }
  }, [sym]);
  if (!ok) return;
  await chrome.storage.session.set({ [p.key]: { i: next, sym, list: p.active, at: Date.now() } });
  report(tabId, { sym, n: next + 1, total: p.syms.length, list: p.name });
}

function report(tabId, info) {
  chrome.tabs.sendMessage(tabId, { wl: 'pos', ...info }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || !sender.tab || !isTV(sender.tab.url)) return;
  if (msg.wl === 'step') { step(sender.tab.id, msg.dir > 0 ? 1 : -1).catch(() => {}); return; }
  if (msg.wl === 'where') {
    // Where the chart is in the list right now (for the pill when it appears).
    position(sender.tab.id).then((p) => {
      if (!p.syms.length) reply({ empty: true, list: p.name });
      else if (p.i < 0) reply({ list: p.name, total: p.syms.length });
      else reply({ sym: p.syms[p.i], n: p.i + 1, total: p.syms.length, list: p.name });
    }).catch(() => reply(null));
    return true;   // async reply
  }
});

// Message the tab's dock script, injecting it first if the tab predates the extension.
async function send(tabId, action) {
  try {
    await chrome.tabs.sendMessage(tabId, { wl: 'dock', action });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, { wl: 'dock', action });
    } catch (e2) {}
  }
}
