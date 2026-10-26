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

  // ---------- requests to TradingView ----------
  // TradingView refused or throttled us: callers must back off, not retry.
  class RateLimited extends Error {}

  // Runs inside the TradingView page (MAIN world), so requests carry
  // TradingView's own origin, and its login cookies when `creds` is 'include'.
  // Must be self-contained: it is serialised into the page.
  async function inPageRequest(url, method, body, creds) {
    try {
      const init = { method, credentials: creds };
      if (body) { init.headers = { 'Content-Type': 'text/plain;charset=UTF-8' }; init.body = body; }
      const r = await fetch(url, init);
      let json = null;
      if (r.ok) { try { json = await r.json(); } catch (e) {} }
      return { status: r.status, json };
    } catch (e) {
      return { status: 0, json: null };
    }
  }

  // Through the TradingView tab hosting the dock. null = no tab to use.
  async function viaTab(url, method, body, creds) {
    if (!available) return null;
    try {
      const tab = await findTab();
      if (!tab || !isTV(tab.url)) return null;
      return await run(tab.id, inPageRequest, [url, method, body, creds]);
    } catch (e) {
      return null;
    }
  }

  // From the extension itself (no cookies). null = network failure.
  async function direct(url, method, body) {
    try {
      const init = { method, credentials: 'omit' };
      if (body) { init.headers = { 'Content-Type': 'text/plain;charset=UTF-8' }; init.body = body; }
      const r = await fetch(url, init);
      let json = null;
      if (r.ok) { try { json = await r.json(); } catch (e) {} }
      return { status: r.status, json };
    } catch (e) {
      return null;
    }
  }

  // 429 / 503 always mean "slow down". From TradingView's own origin, 403 means blocked too.
  function unwrap(res, what, fromTab) {
    if (!res) throw new Error(what + ' unavailable');
    const s = res.status;
    if (s === 429 || s === 503 || (fromTab && s === 403)) throw new RateLimited(what + ' rate limited (' + s + ')');
    if (!res.json) throw new Error(what + ' failed (' + s + ')');
    return res.json;
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

  // Searches run inside the TradingView tab with TradingView's real origin.
  // (The search service refuses requests from other origins.)
  async function search(q, type, exchange, { session = true } = {}) {
    const url = searchUrl(q, type, exchange);
    const res = await viaTab(url, 'GET', null, session ? 'include' : 'omit');
    return (unwrap(res, 'search', true).symbols || []).map(normalize);
  }

  // ---------- quotes (TradingView's scanner service) ----------
  // One request returns price, change, name, price precision and logo for up to
  // a few hundred symbols. Prices follow TradingView's own delay rules (often
  // 10-15 minutes for stocks when not signed in; crypto and forex are live).
  const SCAN = 'https://scanner.tradingview.com/global/scan';
  const QUOTE_COLS = ['close', 'change', 'change_abs', 'description', 'pricescale', 'logoid',
    'base_currency_logoid', 'currency_logoid', 'type', 'update_mode'];

  // One request per call. With `session`, it goes through the TradingView tab
  // with the user's login (real-time where their plan includes it); otherwise
  // straight from the extension. The other path is used only when the first
  // one isn't available at all, never to retry a refusal.
  async function quotes(tickers, { session = false } = {}) {
    if (!tickers.length) return [];
    const body = JSON.stringify({ symbols: { tickers }, columns: QUOTE_COLS });
    let res, fromTab;
    if (session) {
      res = await viaTab(SCAN, 'POST', body, 'include'); fromTab = true;
      if (!res) { res = await direct(SCAN, 'POST', body); fromTab = false; }
    } else {
      res = await direct(SCAN, 'POST', body); fromTab = false;
      if (!res) { res = await viaTab(SCAN, 'POST', body, 'omit'); fromTab = true; }
    }
    const json = unwrap(res, 'quotes', fromTab);
    return (json.data || []).map(({ s, d }) => {
      const [price, chp, ch, name, scale, logo, baseLogo, curLogo, type, mode] = d;
      const logos = [];
      if (logo) logos.push(LOGO(logo));
      else if (baseLogo) { logos.push(LOGO(baseLogo)); if (type === 'forex' && curLogo) logos.push(LOGO(curLogo)); }
      return {
        sym: s, price, chp, ch, name: name || '',
        dec: scale > 1 ? Math.min(8, Math.round(Math.log10(scale))) : 0,
        logos, delayMin: (/delayed_streaming_(\d+)/.exec(mode || '') || [])[1] / 60 || 0,
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

  return { available, embedded, RateLimited, quotes, showSymbol, currentSymbol, status, open, onTabsChanged, search, closePanel };
})();
