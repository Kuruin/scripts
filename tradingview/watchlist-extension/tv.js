// Bridge between the watchlist and TradingView.
// The watchlist is docked inside the TradingView tab (an extension iframe), so
// "the tab" is normally the one hosting this frame. Symbols are switched in
// place through TradingView's own page API
// (window.TradingViewApi.activeChart().setSymbol), with a URL navigation as
// fallback. Outside an extension context (local preview) it degrades to
// opening the chart in a new tab.
window.TV = (() => {
  const TV_HOME = 'https://www.tradingview.com/chart/';
  const CHART_URL = (sym) => 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(sym);
  const available =
    typeof chrome !== 'undefined' && !!(chrome.tabs && chrome.scripting && chrome.windows);
  const embedded = new URLSearchParams(location.search).has('embed') && window.parent !== window;

  const isTV = (url) => /^https?:\/\/([a-z0-9-]+\.)*tradingview\.com\//i.test(url || '');
  const isChart = (url) => isTV(url) && /\/chart\//.test(url);

  async function windowId() {
    const w = await chrome.windows.getCurrent();
    return w.id;
  }

  // The TradingView tab this dock lives in.
  let ownTabId = null;
  async function ownTab() {
    if (!embedded || !available) return null;
    try {
      if (ownTabId == null) {
        const t = await chrome.tabs.getCurrent();
        if (t) ownTabId = t.id;
      }
      return ownTabId == null ? null : await chrome.tabs.get(ownTabId);
    } catch (e) {
      return null;
    }
  }

  // The dock's own tab, else the active TradingView tab, else any chart tab in this window.
  async function findTab() {
    const own = await ownTab();
    if (own) return own;
    const wid = await windowId();
    const [active] = await chrome.tabs.query({ active: true, windowId: wid });
    if (active && isTV(active.url)) return active;
    const tabs = await chrome.tabs.query({ windowId: wid, url: '*://*.tradingview.com/*' });
    return tabs.find((t) => isChart(t.url)) || tabs[0] || null;
  }

  // --- functions injected into the TradingView page (MAIN world) ---
  function inPageSetSymbol(symbol) {
    try {
      const api = window.TradingViewApi;
      const chart = api && typeof api.activeChart === 'function' ? api.activeChart() : null;
      if (chart && typeof chart.setSymbol === 'function') {
        chart.setSymbol(symbol);
        return true;
      }
    } catch (e) {}
    return false;
  }
  function inPageGetSymbol() {
    try {
      return window.TradingViewApi.activeChart().symbol() || null;
    } catch (e) {
      return null;
    }
  }

  async function run(tabId, func, args = []) {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args });
    return r ? r.result : undefined;
  }

  // Returns 'set' | 'navigated' | 'opened' | 'external'
  async function showSymbol(symbol) {
    if (!available) {
      window.open(CHART_URL(symbol), '_blank', 'noopener');
      return 'external';
    }
    const tab = await findTab();
    if (!tab) {
      await chrome.tabs.create({ windowId: await windowId(), url: CHART_URL(symbol) });
      return 'opened';
    }
    if (!tab.active) await chrome.tabs.update(tab.id, { active: true });
    if (isChart(tab.url)) {
      try {
        if ((await run(tab.id, inPageSetSymbol, [symbol])) === true) return 'set';
      } catch (e) {}
    }
    await chrome.tabs.update(tab.id, { url: CHART_URL(symbol) });
    return 'navigated';
  }

  async function currentSymbol() {
    if (!available) return null;
    try {
      const tab = await findTab();
      if (!tab || !isChart(tab.url)) return null;
      return (await run(tab.id, inPageGetSymbol)) || null;
    } catch (e) {
      return null;
    }
  }

  async function status() {
    if (!available) return { demo: true, connected: false, chart: false };
    const tab = await findTab();
    return { demo: false, connected: !!tab, chart: !!(tab && isChart(tab.url)) };
  }

  async function open() {
    if (!available) {
      window.open(TV_HOME, '_blank', 'noopener');
      return;
    }
    const tab = await findTab();
    if (tab) await chrome.tabs.update(tab.id, { active: true });
    else await chrome.tabs.create({ windowId: await windowId(), url: TV_HOME });
  }

  function onTabsChanged(cb) {
    if (!available) return;
    chrome.tabs.onUpdated.addListener((id, info) => {
      if (info.status === 'complete' || info.url || info.title) cb();
    });
    chrome.tabs.onActivated.addListener(cb);
    chrome.tabs.onRemoved.addListener(cb);
  }

  // ---------- symbol search (TradingView's own search service) ----------
  const SEARCH = 'https://symbol-search.tradingview.com/symbol_search/v3/';
  const LOGO = (id) => 'https://s3-symbol-logo.tradingview.com/' + id + '.svg';
  const strip = (s) => String(s || '').replace(/<\/?em>/g, '');

  function searchUrl(q, type, exchange) {
    const p = new URLSearchParams({
      text: q, hl: '1', exchange: exchange || '', lang: 'en',
      search_type: type || 'undefined', domain: 'production', sort_by_country: 'US',
    });
    return SEARCH + '?' + p.toString();
  }

  // Runs inside the TradingView page, so the request has TradingView's origin.
  async function inPageFetch(url) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      return r.ok ? await r.json() : null;
    } catch (e) {
      return null;
    }
  }

  function normalize(r) {
    let sym = r.symbol || '';
    let prefix = r.prefix || r.source_id || r.exchange || '';
    if (Array.isArray(r.contracts) && r.contracts.length) {
      // Futures: use the continuous contract (e.g. ES1!) like TradingView does
      sym = r.contracts[0].symbol || sym;
      prefix = r.contracts[0].prefix || prefix;
    }
    const ticker = strip(sym);
    const logo = r.logo || {};
    const ids = [];
    if (logo.logoid) ids.push(logo.logoid);
    if (logo.logoid2) ids.push(logo.logoid2);
    if (!ids.length && r.logoid) ids.push(r.logoid);
    if (!ids.length && r['base-currency-logoid']) ids.push(r['base-currency-logoid']);
    return {
      id: (prefix ? String(prefix).toUpperCase() + ':' : '') + ticker.toUpperCase(),
      ticker,
      symHtml: sym,
      descHtml: r.description || '',
      desc: strip(r.description),
      type: r.type || '',
      exch: r.exchange || prefix,
      country: r.country || '',
      logos: ids.map(LOGO),
      flag: r.country ? LOGO('country/' + r.country) : '',
    };
  }

  async function search(q, type, exchange) {
    const url = searchUrl(q, type, exchange);
    let json = null;
    try {
      const r = await fetch(url, { credentials: 'omit' });
      if (r.ok) json = await r.json();
    } catch (e) {}
    // Fallback: ask any loaded TradingView tab (in any window) to run the search.
    if (!json && available) {
      const tabs = [];
      try {
        const own = await findTab();
        if (own) tabs.push(own);
        const all = await chrome.tabs.query({ url: '*://*.tradingview.com/*' });
        for (const t of all) if (!tabs.some((x) => x.id === t.id) && !t.discarded) tabs.push(t);
      } catch (e) {}
      for (const t of tabs.slice(0, 3)) {
        try { json = await run(t.id, inPageFetch, [url]); } catch (e) {}
        if (json) break;
      }
    }
    if (!json) throw new Error('Symbol search unavailable');
    return (json.symbols || []).map(normalize);
  }

  // ---------- quotes (TradingView's scanner service) ----------
  // One request returns price, change, name, price precision and logo for up to
  // a few hundred symbols. Prices follow TradingView's own delay rules (often
  // 10-15 minutes for stocks when not signed in; crypto and forex are live).
  const SCAN = 'https://scanner.tradingview.com/global/scan';
  const QUOTE_COLS = ['close', 'change', 'change_abs', 'description', 'pricescale', 'logoid',
    'base_currency_logoid', 'currency_logoid', 'type', 'update_mode'];

  // Runs inside the TradingView page when the extension can't reach the scanner itself.
  async function inPagePost(url, body) {
    try {
      const r = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body });
      return r.ok ? await r.json() : null;
    } catch (e) {
      return null;
    }
  }

  async function quotes(tickers) {
    if (!tickers.length) return [];
    const body = JSON.stringify({ symbols: { tickers }, columns: QUOTE_COLS });
    let json = null;
    try {
      const r = await fetch(SCAN, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },   // simple request: no CORS pre-check
        body,
      });
      if (r.ok) json = await r.json();
    } catch (e) {}
    // Fallback: ask the TradingView tab to fetch, with TradingView's own origin.
    if (!json && available) {
      try {
        const tab = await findTab();
        if (tab && isTV(tab.url)) json = await run(tab.id, inPagePost, [SCAN, body]);
      } catch (e) {}
    }
    if (!json) throw new Error('quotes unavailable');
    return (json.data || []).map(({ s, d }) => {
      const [price, chp, ch, name, scale, logo, baseLogo, curLogo, type, mode] = d;
      const logos = [];
      if (logo) logos.push(LOGO(logo));
      else if (baseLogo) { logos.push(LOGO(baseLogo)); if (type === 'forex' && curLogo) logos.push(LOGO(curLogo)); }
      return {
        sym: s, price, chp, ch, name: name || '',
        dec: scale > 1 ? Math.min(8, Math.round(Math.log10(scale))) : 0,
        logos, delayed: /delayed/.test(mode || ''),
      };
    });
  }

  // ---------- close the side panel ----------
  async function closePanel() {
    if (embedded) {
      window.parent.postMessage({ wl: 'close' }, '*');
      return;
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.close) {
        await chrome.sidePanel.close({ windowId: await windowId() });
        return;
      }
    } catch (e) {}
    window.close();
  }

  return { available, embedded, quotes, showSymbol, currentSymbol, status, open, onTabsChanged, search, closePanel };
})();
