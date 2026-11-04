// Loaded at document_start, before TradingView's own scripts, so this listener
// runs first. While the dock is open or minimized, ↑ / ↓ on a TradingView chart
// step through *this* watchlist (minimized is the default until the user picks
// otherwise), and the key is consumed so TradingView doesn't also switch through
// its own watchlist. The keys are left to TradingView when the dock is closed,
// on pages that aren't a chart, and while the active list has no symbols.
(() => {
  // After an extension update the old copy is orphaned; a fresh copy replaces it.
  const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
  if (window.__wlEarly && window.__wlEarly.alive()) return;
  window.__wlEarly = { alive };

  let mode = 'mini';     // minimized until the user chooses otherwise
  let hasSymbols = false;
  const readDock = (d) => { mode = d ? (d.mode || (d.open ? 'open' : 'closed')) : 'mini'; };
  // Same rule as the background's list lookup: the active list, or the active tag list.
  const readList = (wl) => {
    if (!wl || !Array.isArray(wl.lists)) { hasSymbols = false; return; }
    const key = wl.active || '';
    if (key.startsWith('tag:')) {
      const tag = key.slice(4);
      hasSymbols = Object.values(wl.meta || {}).some((m) => m && m.f === tag);
      return;
    }
    const list = wl.lists.find((l) => 'list:' + l.id === key) || wl.lists[0];
    hasSymbols = !!(list && (list.items || []).some((i) => i.s));
  };
  try {
    chrome.storage.local.get(['dock', 'wl']).then((r) => { readDock(r.dock); readList(r.wl); }).catch(() => {});
    chrome.storage.onChanged.addListener((c, area) => {
      if (area !== 'local') return;
      if (c.dock) readDock(c.dock.newValue);
      if (c.wl) readList(c.wl.newValue);
    });
  } catch (e) {}

  const busy = (t) => t instanceof Element && (
    t.isContentEditable ||
    t.matches('input, textarea, select') ||
    t.closest('[role="menu"], [role="listbox"], [role="dialog"], [role="combobox"], [data-dialog-name]')
  );

  let at = 0;
  function onKey(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (!alive()) { window.removeEventListener('keydown', onKey, true); return; }   // orphaned: hand the keys back
    if (mode !== 'open' && mode !== 'mini') return;
    if (!hasSymbols) return;                                                       // nothing to step through
    if (!/^\/chart(\/|$)/.test(location.pathname)) return;   // home, news, screener...: keys behave as usual
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (busy(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const now = Date.now();
    if (e.repeat && now - at < 110) return;   // holding the key: about 9 symbols a second
    at = now;
    try { chrome.runtime.sendMessage({ wl: 'step', dir: e.key === 'ArrowDown' ? 1 : -1 }).catch(() => {}); } catch (err) {}
  }
  window.addEventListener('keydown', onKey, true);
})();
